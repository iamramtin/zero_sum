#![allow(clippy::result_large_err)]

use anchor_lang::{prelude::*, Discriminator};
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};
use chainlink_solana as chainlink;

declare_id!("5ngJ1FaFSZAtsW6rrRmQEN65FXKgxVTr51epWTpsGyLf");

pub mod constants {
    pub const ENTRY_AMOUNT_USDC: u64 = 1_000_000_000; // 1000 USDC (with 6 decimals)
    pub const MAX_JOIN_PRICE_MOVEMENT: f64 = 0.01; // 1% max change for joining
    pub const WIN_PRICE_THRESHOLD: f64 = 0.05; // 5% movement for win
}

#[program]
pub mod zero_sum {
    use super::*;

    // Initializes game
    // Player one entry with prediction (increase / decrease)
    pub fn create_game(
        ctx: Context<CreateGame>,
        game_id: u64,
        prediction: PricePrediction,
    ) -> Result<()> {
        require!(
            prediction == PricePrediction::Increase || prediction == PricePrediction::Decrease,
            CustomError::InvalidPrediction
        );

        let game_state = &mut ctx.accounts.game_state;
        let current_time = Clock::get()?.unix_timestamp;

        // Get price data from Chainlink
        let initial_price = get_chainlink_price(
            &ctx.accounts.chainlink_program,
            &ctx.accounts.chainlink_feed,
            current_time,
        )?;

        game_state.game_id = game_id;
        game_state.initiator = ctx.accounts.initiator.key();
        game_state.initiator_prediction = prediction;
        game_state.entry_amount = constants::ENTRY_AMOUNT_USDC;
        game_state.initial_price = initial_price;
        game_state.creation_timestamp = current_time;
        game_state.bump = ctx.bumps.game_state;

        // Transfer entry amount into escrow / vault account
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_accounts = TransferChecked {
            from: ctx.accounts.initiator_token_account.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
            mint: ctx.accounts.usdc_mint.to_account_info(),
            authority: ctx.accounts.initiator.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        token::transfer_checked(
            cpi_ctx,
            game_state.entry_amount,
            ctx.accounts.usdc_mint.decimals,
        )?;

        emit!(GameCreated {
            initiator: *ctx.accounts.initiator.key,
            prediction,
            initial_price,
            entry_amount: constants::ENTRY_AMOUNT_USDC,
            game_id: ctx.accounts.game_state.game_id,
            timestamp: current_time,
        });

        Ok(())
    }

    // Starts game when second player joins
    // Player two enters with opposite price prediction
    pub fn join_game(ctx: Context<JoinGame>, game_id: u64, initiator: Pubkey) -> Result<()> {
        let game_state = &mut ctx.accounts.game_state;
        let challenger = &ctx.accounts.challenger;
        let challenger_key = challenger.key();
        let current_time = Clock::get()?.unix_timestamp;

        require!(
            game_state.is_correct_game_id(game_id),
            CustomError::IncorrectGameId
        );
        require!(
            game_state.is_correct_initiator(initiator),
            CustomError::IncorrectInitiator
        );
        require!(!game_state.is_ended(), CustomError::GameAlreadyEnded);
        require!(
            !game_state.is_initiator(challenger_key),
            CustomError::CannotJoinOwnGame
        );
        require!(game_state.joinable_game(), CustomError::GameAlreadyFull);

        // Get price data from Chainlink
        let current_price = get_chainlink_price(
            &ctx.accounts.chainlink_program,
            &ctx.accounts.chainlink_feed,
            current_time,
        )?;

        let (threshold_exceeded, _, _) = has_price_moved_by_percentage(
            game_state.initial_price,
            current_price,
            constants::MAX_JOIN_PRICE_MOVEMENT,
        )?;

        require!(!threshold_exceeded, CustomError::ExcessivePriceVolatility);

        game_state.challenger = Some(challenger_key);
        game_state.start_timestamp = Some(current_time);

        // Transfer entry amount into escrow / vault account
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_accounts = TransferChecked {
            from: ctx.accounts.challenger_token_account.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
            mint: ctx.accounts.usdc_mint.to_account_info(),
            authority: ctx.accounts.challenger.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        token::transfer_checked(
            cpi_ctx,
            game_state.entry_amount,
            ctx.accounts.usdc_mint.decimals,
        )?;

        let challenger_prediction = game_state.get_challenger_prediction();

        emit!(GameJoined {
            challenger: challenger_key,
            challenger_prediction,
            game_id,
            timestamp: current_time,
        });
        Ok(())
    }

    // Ends game when price movement is met
    pub fn close_game(ctx: Context<CloseGame>, game_id: u64, initiator: Pubkey) -> Result<()> {
        let game_state = &mut ctx.accounts.game_state;
        let current_time = Clock::get()?.unix_timestamp;

        require!(
            game_state.is_correct_game_id(game_id),
            CustomError::IncorrectGameId
        );
        require!(
            game_state.is_correct_initiator(initiator),
            CustomError::IncorrectInitiator
        );
        require!(game_state.is_active(), CustomError::GameNotActive);

        // Get price data from Chainlink
        let final_price = get_chainlink_price(
            &ctx.accounts.chainlink_program,
            &ctx.accounts.chainlink_feed,
            current_time,
        )?;

        let (threshold_exceeded, direction, percentage_change) = has_price_moved_by_percentage(
            game_state.initial_price,
            final_price,
            constants::WIN_PRICE_THRESHOLD,
        )?;

        require!(threshold_exceeded, CustomError::ThresholdNotReached);

        let player_one_won = (direction == 1
            && game_state.initiator_prediction == PricePrediction::Increase)
            || (direction == -1 && game_state.initiator_prediction == PricePrediction::Decrease);

        let winner = if player_one_won {
            game_state.initiator
        } else {
            game_state.challenger.unwrap()
        };

        require!(
            ctx.accounts.winner.key() == winner,
            CustomError::NotTheWinner
        );

        // Mark game as completed
        let game_state = &mut ctx.accounts.game_state;
        game_state.end_timestamp = Some(current_time);

        // Transfer the full balance (both players' stakes) to the winner
        let seeds = &[
            b"game_state",
            initiator.as_ref(),
            &game_id.to_le_bytes(),
            &[game_state.bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_accounts = TransferChecked {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.winner_token_account.to_account_info(),
            mint: ctx.accounts.usdc_mint.to_account_info(),
            authority: game_state.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);

        let total_payout = game_state
            .entry_amount
            .checked_mul(2)
            .ok_or(error!(CustomError::Overflow))?;

        token::transfer_checked(cpi_ctx, total_payout, ctx.accounts.usdc_mint.decimals)?;

        let winning_prediction = if direction == 1 {
            PricePrediction::Increase
        } else {
            PricePrediction::Decrease
        };

        emit!(GameClosed {
            winner,
            final_price,
            price_movement_percentage: percentage_change,
            winning_prediction,
            total_payout,
            game_id,
            timestamp: current_time,
        });

        Ok(())
    }

    // Quits game
    // Withdraws player one if second player hasn't joined
    pub fn withdraw(ctx: Context<Withdraw>, game_id: u64) -> Result<()> {
        let game_state = &mut ctx.accounts.game_state;
        let initiator = &ctx.accounts.initiator;
        let initiator_key = initiator.key();
        let current_time = Clock::get()?.unix_timestamp;

        require!(
            game_state.is_correct_game_id(game_id),
            CustomError::IncorrectGameId
        );
        require!(
            game_state.is_initiator(initiator_key),
            CustomError::NotInitiator
        );
        require!(!game_state.is_ended(), CustomError::GameAlreadyEnded);
        require!(game_state.joinable_game(), CustomError::WithdrawalBlocked);

        game_state.cancelled_timestamp = Some(current_time);
        game_state.end_timestamp = Some(current_time);

        let seeds = &[
            b"game_state",
            initiator_key.as_ref(),
            &game_id.to_le_bytes(),
            &[game_state.bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_accounts = TransferChecked {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.initiator_token_account.to_account_info(),
            mint: ctx.accounts.usdc_mint.to_account_info(),
            authority: game_state.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);

        token::transfer_checked(
            cpi_ctx,
            game_state.entry_amount,
            ctx.accounts.usdc_mint.decimals,
        )?;

        emit!(GameCancelled {
            game_id,
            timestamp: current_time,
        });

        Ok(())
    }
}

/**
 * INSTRUCTIONS
 */
#[derive(Accounts)]
#[instruction(game_id: u64)]
pub struct CreateGame<'info> {
    #[account(mut)]
    pub initiator: Signer<'info>,

    #[account(
        mut,
        constraint = initiator_token_account.owner == initiator.key() @ CustomError::InvalidTokenAccount,
        constraint = initiator_token_account.mint == usdc_mint.key() @ CustomError::InvalidTokenMint,
    )]
    pub initiator_token_account: Account<'info, TokenAccount>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = initiator,
        token::mint = usdc_mint,
        token::authority = game_state,
        seeds = [b"game_vault", initiator.key().as_ref(), &game_id.to_le_bytes()],
        bump
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = initiator,
        space = GameState::DISCRIMINATOR.len() + GameState::INIT_SPACE,
        seeds = [b"game_state", initiator.key().as_ref(), &game_id.to_le_bytes()],
        bump
    )]
    pub game_state: Account<'info, GameState>,

    /// CHECK: We're reading data from this specified chainlink feed
    pub chainlink_feed: AccountInfo<'info>,

    /// CHECK: This is the Chainlink program library on Devnet
    pub chainlink_program: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(game_id: u64, initiator: Pubkey)]
pub struct JoinGame<'info> {
    #[account(mut)]
    pub challenger: Signer<'info>,

    #[account(
        mut,
        constraint = challenger_token_account.owner == challenger.key() @ CustomError::InvalidTokenAccount,
        constraint = challenger_token_account.mint == usdc_mint.key() @ CustomError::InvalidTokenMint,
    )]
    pub challenger_token_account: Account<'info, TokenAccount>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = vault.mint == usdc_mint.key() @ CustomError::InvalidTokenMint,
        seeds = [b"game_vault", initiator.key().as_ref(), &game_id.to_le_bytes()],
        bump
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = !game_state.is_initiator(challenger.key()) @ CustomError::CannotJoinOwnGame,
        constraint = game_state.is_correct_initiator(initiator) @ CustomError::IncorrectInitiator,
        constraint = game_state.is_correct_game_id(game_id) @ CustomError::IncorrectGameId,
        seeds = [b"game_state", initiator.as_ref(), &game_id.to_le_bytes()],
        bump = game_state.bump
    )]
    pub game_state: Account<'info, GameState>,

    /// CHECK: We're reading data from this specified chainlink feed
    pub chainlink_feed: AccountInfo<'info>,

    /// CHECK: This is the Chainlink program library on Devnet
    pub chainlink_program: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(game_id: u64, initiator: Pubkey)]
pub struct CloseGame<'info> {
    #[account(mut)]
    pub winner: Signer<'info>,

    #[account(
        mut,
        constraint = winner_token_account.owner == winner.key() @ CustomError::InvalidTokenAccount,
        constraint = winner_token_account.mint == usdc_mint.key() @ CustomError::InvalidTokenMint,
    )]
    pub winner_token_account: Account<'info, TokenAccount>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = vault.mint == usdc_mint.key() @ CustomError::InvalidTokenMint,
        seeds = [b"game_vault", initiator.key().as_ref(), &game_id.to_le_bytes()],
        bump
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = (game_state.is_participant(winner.key())) @ CustomError::NotAuthorized,
        constraint = game_state.is_active() @ CustomError::GameNotActive,
        constraint = game_state.is_correct_initiator(initiator) @ CustomError::IncorrectInitiator,
        constraint = game_state.is_correct_game_id(game_id) @ CustomError::IncorrectGameId,
        seeds = [b"game_state", initiator.as_ref(), &game_id.to_le_bytes()],
        bump = game_state.bump
    )]
    pub game_state: Account<'info, GameState>,

    /// CHECK: We're reading data from this specified chainlink feed
    pub chainlink_feed: AccountInfo<'info>,

    /// CHECK: This is the Chainlink program library on Devnet
    pub chainlink_program: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(game_id: u64)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub initiator: Signer<'info>,

    #[account(
        mut,
        constraint = initiator_token_account.owner == initiator.key() @ CustomError::InvalidTokenAccount,
        constraint = initiator_token_account.mint == usdc_mint.key() @ CustomError::InvalidTokenMint,
    )]
    pub initiator_token_account: Account<'info, TokenAccount>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = vault.mint == usdc_mint.key() @ CustomError::InvalidTokenMint,
        seeds = [b"game_vault", initiator.key().as_ref(), &game_id.to_le_bytes()],
        bump
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = game_state.is_initiator(initiator.key()) @ CustomError::NotInitiator,
        constraint = !game_state.is_ended() @ CustomError::GameAlreadyEnded,
        constraint = game_state.joinable_game() @ CustomError::WithdrawalBlocked,
        seeds = [b"game_state", initiator.key().as_ref(), &game_id.to_le_bytes()],
        bump = game_state.bump
    )]
    pub game_state: Account<'info, GameState>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

/**
 * ACCOUNTS
 */
#[account]
#[derive(InitSpace)]
pub struct GameState {
    pub initiator: Pubkey,                     // Game creator address
    pub initiator_prediction: PricePrediction, // First player's prediction
    pub challenger: Option<Pubkey>,            // Joining player address
    pub entry_amount: u64,                     // Amount in USDC
    pub initial_price: f64,                    // Price when game was created
    pub creation_timestamp: i64,               // When game was created
    pub start_timestamp: Option<i64>,          // When game was started (challenger joins)
    pub end_timestamp: Option<i64>,            // When game was closed
    pub cancelled_timestamp: Option<i64>,      // When (if) initiator withdrew
    pub game_id: u64,                          // ID to keep track of game
    pub bump: u8,
}

impl GameState {
    pub fn is_active(&self) -> bool {
        self.challenger.is_some() && self.end_timestamp.is_none()
    }

    pub fn is_open(&self) -> bool {
        self.challenger.is_none() && self.end_timestamp.is_none()
    }

    pub fn is_ended(&self) -> bool {
        self.end_timestamp.is_some()
    }

    pub fn is_cancelled(&self) -> bool {
        self.cancelled_timestamp.is_some()
    }

    pub fn joinable_game(&self) -> bool {
        self.challenger.is_none()
    }

    pub fn is_initiator(&self, pubkey: Pubkey) -> bool {
        pubkey == self.initiator
    }

    pub fn is_challenger(&self, pubkey: Pubkey) -> bool {
        Some(pubkey) == self.challenger
    }

    pub fn is_participant(&self, pubkey: Pubkey) -> bool {
        self.is_initiator(pubkey) || self.is_challenger(pubkey)
    }

    pub fn is_correct_initiator(&self, pubkey: Pubkey) -> bool {
        pubkey == self.initiator
    }

    pub fn is_correct_game_id(&self, game_id: u64) -> bool {
        game_id == self.game_id
    }

    // Get challenger's prediction (opposite of initiator)
    pub fn get_challenger_prediction(&self) -> PricePrediction {
        match self.initiator_prediction {
            PricePrediction::Increase => PricePrediction::Decrease,
            PricePrediction::Decrease => PricePrediction::Increase,
        }
    }
}

/**
 * ENUM
 */
#[derive(InitSpace, AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq)]
pub enum PricePrediction {
    Increase,
    Decrease,
}

/**
 * ERRORS
 */
#[error_code]
pub enum CustomError {
    #[msg("Arithmetic overflow")]
    Overflow,

    #[msg("Caller is not a participant of the game")]
    NotAuthorized,

    #[msg("Only the winner can the game")]
    NotTheWinner,

    #[msg("Only the initiator can withdraw from this game")]
    NotInitiator,

    #[msg("The price feed data is stale or unavailable")]
    StalePriceFeed,

    #[msg("Invalid token account")]
    InvalidTokenAccount,

    #[msg("Token mint must be USDC")]
    InvalidTokenMint,

    #[msg("Invalid price value received from oracle")]
    InvalidPriceValue,

    #[msg("Prediction must be 'Increase' or 'Decrease'")]
    InvalidPrediction,

    #[msg("Invalid price feed")]
    InvalidPriceFeed,

    #[msg("Incorrect initiator address provided")]
    IncorrectInitiator,

    #[msg("Incorrect game ID provided")]
    IncorrectGameId,

    #[msg("Game does not exist or has not been properly initialized")]
    GameNotActive,

    #[msg("This game has already been completed or cancelled")]
    GameAlreadyEnded,

    #[msg("This game already has two players")]
    GameAlreadyFull,

    #[msg("Withdrawal not allowed after a challenger has joined")]
    WithdrawalBlocked,

    #[msg("Cannot join - price has moved more than 1% since creation")]
    ExcessivePriceVolatility,

    #[msg("Neither price threshold has been reached yet")]
    ThresholdNotReached,

    #[msg("Cannot join your own game")]
    CannotJoinOwnGame,
}

/**
 * EVENTS
 */
#[event]
pub struct PriceFetched {
    pub description: String,
    pub price: f64,
    pub timestamp: i64,
}

#[event]
pub struct GameCreated {
    pub initiator: Pubkey,
    pub prediction: PricePrediction,
    pub initial_price: f64,
    pub entry_amount: u64,
    pub game_id: u64,
    pub timestamp: i64,
}

#[event]
pub struct GameJoined {
    pub challenger: Pubkey,
    pub challenger_prediction: PricePrediction,
    pub game_id: u64,
    pub timestamp: i64,
}

#[event]
pub struct GameClosed {
    pub winner: Pubkey,
    pub final_price: f64,
    pub price_movement_percentage: f64,
    pub winning_prediction: PricePrediction,
    pub total_payout: u64,
    pub game_id: u64,
    pub timestamp: i64,
}

#[event]
pub struct GameCancelled {
    pub game_id: u64,
    pub timestamp: i64,
}

/**
 * HELPER FUNCTIONS
 */
// Format chainlink price response as a floating point number
fn format_price(value: i128, decimals: u8) -> f64 {
    (value as f64) * 10_f64.powi(-(decimals as i32))
}

// Function to get the current price from Chainlink
fn get_chainlink_price<'info>(
    chainlink_program: &AccountInfo<'info>,
    chainlink_feed: &AccountInfo<'info>,
    current_time: i64,
) -> Result<f64> {
    let round = chainlink::latest_round_data(
        chainlink_program.to_account_info(),
        chainlink_feed.to_account_info(),
    )?;

    let decimals = chainlink::decimals(
        chainlink_program.to_account_info(),
        chainlink_feed.to_account_info(),
    )?;

    let description = chainlink::description(
        chainlink_program.to_account_info(),
        chainlink_feed.to_account_info(),
    )?;

    let formatted_price = format_price(round.answer, decimals);

    emit!(PriceFetched {
        description: description.clone(),
        price: formatted_price,
        timestamp: current_time,
    });

    Ok(formatted_price)
}

// Checks if price has moved by given percentage
fn has_price_moved_by_percentage(
    initial_price: f64,
    current_price: f64,
    percentage: f64,
) -> Result<(bool, i8, f64)> {
    if initial_price <= 0.0 || current_price <= 0.0 {
        return Err(CustomError::InvalidPriceValue.into());
    }

    // Calculate the percentage change
    let percentage_change = ((current_price - initial_price) / initial_price) * 100.0;

    // Determine if threshold is exceeded and the direction
    let threshold_exceeded = percentage_change.abs() >= percentage.abs();

    // Return direction: 1 for increase, -1 for decrease, 0 for no change
    let direction = if percentage_change > 0.0 {
        1
    } else if percentage_change < 0.0 {
        -1
    } else {
        0
    };

    Ok((threshold_exceeded, direction, percentage_change))
}
