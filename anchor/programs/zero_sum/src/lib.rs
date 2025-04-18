#![allow(clippy::result_large_err)]

use anchor_lang::{prelude::*, Discriminator};
use pyth_solana_receiver_sdk::price_update::{PriceUpdateV2, TwapUpdate};

declare_id!("Cy59cDTqWRNtNF2x7ESkB1vEuSV2uLW85en5Ph7h1LrU");

// get_price_no_older_than will fail if the price update is more than this
pub const MAXIMUM_AGE: u64 = 30; // 30 sec

// Feeds from https://pyth.network/developers/price-feed-ids
pub const ETH_USD_FEED_ID: &str =
    "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";

pub mod game_constants {
    pub const ENTRY_AMOUNT_USDC: u64 = 1_000_000_000; // 1000 USDC (with 6 decimals)
    pub const MAX_JOIN_PRICE_MOVEMENT: f64 = 0.01; // 1% max change for joining
    pub const WIN_PRICE_THRESHOLD: f64 = 0.05; // 5% movement for win
    pub const TWAP_WINDOW_SECONDS: u64 = 900; // 15 minutes for TWAP
}

#[program]
pub mod zero_sum {
    use pyth_solana_receiver_sdk::price_update::get_feed_id_from_hex;

    use super::*;

    // Helper function to check if price has moved by percentage
    pub fn check_price_movement(
        ctx: Context<CheckPriceMovement>,
        base_price: i64,
        base_exponent: i32,
        percentage: f64,
    ) -> Result<()> {
        let price_update = &mut ctx.accounts.price_update;

        // Get the feed ID for ETH/USD
        let feed_id = get_feed_id_from_hex(ETH_USD_FEED_ID)?;

        // Get current price
        let current_price = price_update
            .get_price_no_older_than(&Clock::get()?, MAXIMUM_AGE, &feed_id)
            .map_err(|_| CustomError::StalePriceFeed)?;

        // Check price movement
        let (increased, decreased) = has_price_moved_by_percentage(
            base_price,
            current_price.price,
            base_exponent,
            percentage,
        )?;

        // Emit price movement event
        emit!(PriceMovementChecked {
            base_price,
            current_price: current_price.price,
            exponent: base_exponent,
            percentage,
            increased,
            decreased,
        });

        Ok(())
    }

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
        let price_update = &mut ctx.accounts.price_update;

        let current_time = Clock::get()?;

        // Get current ETH price
        let feed_id = get_feed_id_from_hex(ETH_USD_FEED_ID)?;
        let price = price_update
            .get_price_no_older_than(&current_time, MAXIMUM_AGE, &feed_id)
            .map_err(|_| CustomError::StalePriceFeed)?;

        emit!(PriceFetched {
            price: price.price,
            conf: price.conf,
            exponent: price.exponent,
            formatted_price: format_price(price.price, price.exponent),
        });

        game_state.game_id = game_id;
        game_state.initiator = ctx.accounts.player.key();
        game_state.initiator_prediction = prediction;
        game_state.entry_amount = game_constants::ENTRY_AMOUNT_USDC;
        game_state.initial_price = price.price;
        game_state.price_exponent = price.exponent;
        game_state.creation_timestamp = current_time.unix_timestamp;
        game_state.bump = ctx.bumps.game_state;

        // TODO: Handle USDC transfer from player to escrow / vault account
        // [USDC transfer code will go here]

        emit!(GameCreated {
            initiator: *ctx.accounts.player.key,
            prediction,
            initial_price: price.price,
            formatted_price: format_price(price.price, price.exponent),
            exponent: price.exponent,
            entry_amount: game_constants::ENTRY_AMOUNT_USDC,
            game_id: ctx.accounts.game_state.game_id,
            timestamp: current_time.unix_timestamp,
        });

        Ok(())
    }

    // Starts game when second player joins
    // Player two enters with opposite price prediction
    pub fn start_game(ctx: Context<StartGame>) -> Result<()> {
        let game_state = &mut ctx.accounts.game_state;
        let price_update = &mut ctx.accounts.price_update;

        require!(game_state.is_ended(), CustomError::GameAlreadyEnded);
        require!(
            !game_state.is_initiator(ctx.accounts.player.key()),
            CustomError::CannotJoinOwnGame
        );
        require!(game_state.joinable_game(), CustomError::GameAlreadyFull);

        let current_time = Clock::get()?;

        // Get current ETH price
        let feed_id = get_feed_id_from_hex(ETH_USD_FEED_ID)?;
        let price = price_update
            .get_price_no_older_than(&current_time, MAXIMUM_AGE, &feed_id)
            .map_err(|_| CustomError::StalePriceFeed)?;

        emit!(PriceFetched {
            price: price.price,
            conf: price.conf,
            exponent: price.exponent,
            formatted_price: format_price(price.price, price.exponent),
        });

        let (increased, decreased) = has_price_moved_by_percentage(
            game_state.initial_price,
            price.price,
            game_state.price_exponent,
            game_constants::MAX_JOIN_PRICE_MOVEMENT,
        )?;

        require!(
            !increased && !decreased,
            CustomError::ExcessivePriceVolatility
        );

        game_state.challenger = Some(ctx.accounts.player.key());
        game_state.start_timestamp = Some(current_time.unix_timestamp);

        // TODO: Handle USDC transfer from player to escrow / vault account
        // [USDC transfer code will go here]

        let challenger_prediction = game_state.get_challenger_prediction();

        emit!(GameStarted {
            challenger: *ctx.accounts.player.key,
            challenger_prediction,
            game_id: ctx.accounts.game_state.game_id,
            timestamp: current_time.unix_timestamp,
        });
        Ok(())
    }

    // Ends game when price change is met
    pub fn close_game(ctx: Context<CloseGame>) -> Result<()> {
        let game_state = &mut ctx.accounts.game_state;
        let twap_update = &ctx.accounts.twap_update;

        require!(game_state.is_active(), CustomError::GameNotActive);

        let current_time = Clock::get()?;

        // Get current ETH price
        let feed_id = get_feed_id_from_hex(ETH_USD_FEED_ID)?;
        let price = twap_update
            .get_twap_no_older_than(
                &current_time,
                MAXIMUM_AGE,
                game_constants::TWAP_WINDOW_SECONDS,
                &feed_id,
            )
            .map_err(|_| CustomError::StalePriceFeed)?;

        // Emit the TWAP price data
        emit!(PriceFetched {
            price: price.price,
            conf: price.conf,
            exponent: price.exponent,
            formatted_price: format_price(price.price, price.exponent),
        });

        let (increased, decreased) = has_price_moved_by_percentage(
            game_state.initial_price,
            price.price,
            game_state.price_exponent,
            game_constants::WIN_PRICE_THRESHOLD,
        )?;

        // Verify a winner exists
        require!(increased || decreased, CustomError::ThresholdNotReached);
        let player_one_won = (increased
            && game_state.initiator_prediction == PricePrediction::Increase)
            || (decreased && game_state.initiator_prediction == PricePrediction::Decrease);

        let winner = if player_one_won {
            game_state.initiator
        } else {
            game_state.challenger.unwrap()
        };

        // TODO: Transfer all USDC to winner
        // [USDC transfer code will go here]

        // Mark game as completed
        let game_state = &mut ctx.accounts.game_state;
        game_state.end_timestamp = Some(current_time.unix_timestamp);

        // TODO: replace with safer arithmetic and error handling
        let initial_price_value =
            (game_state.initial_price as f64) * 10_f64.powi(game_state.price_exponent);
        let current_price_value = (price.price as f64) * 10_f64.powi(price.exponent);
        let price_movement_percentage =
            ((current_price_value - initial_price_value) / initial_price_value) * 100.0;

        let winning_prediction = if increased {
            PricePrediction::Increase
        } else {
            PricePrediction::Decrease
        };

        let total_payout = ctx
            .accounts
            .game_state
            .entry_amount
            .checked_mul(2)
            .ok_or(error!(CustomError::Overflow))?;

        emit!(GameClosed {
            winner,
            final_price: price.price,
            formatted_final_price: format_price(price.price, price.exponent),
            price_movement_percentage,
            winning_prediction,
            total_payout,
            game_id: ctx.accounts.game_state.game_id,
            timestamp: current_time.unix_timestamp,
        });
        Ok(())
    }

    // Quits game
    // Withdraws player one if second player hasn't joined
    pub fn withdraw(ctx: Context<Withdraw>) -> Result<()> {
        let game_state = &mut ctx.accounts.game_state;

        require!(
            game_state.is_initiator(ctx.accounts.player.key()),
            CustomError::NotInitiator
        );
        require!(!game_state.is_ended(), CustomError::GameAlreadyEnded);
        require!(game_state.joinable_game(), CustomError::WithdrawalBlocked);

        let current_time = Clock::get()?;

        game_state.end_timestamp = Some(current_time.unix_timestamp);

        emit!(GameWithdraw {
            end_timestamp: current_time.unix_timestamp,
        });

        Ok(())
    }
}

/**
 * INSTRUCTIONS
 */
#[derive(Accounts)]
pub struct CheckPriceMovement<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    // Pyth price update account
    pub price_update: Account<'info, PriceUpdateV2>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(game_id: u64)]
pub struct CreateGame<'info> {
    #[account(mut)]
    pub player: Signer<'info>,

    pub price_update: Account<'info, PriceUpdateV2>,

    #[account(
        init,
        payer = player,
        space = GameState::DISCRIMINATOR.len() + GameState::INIT_SPACE,
        seeds = [b"game_state", player.key().as_ref(), &game_id.to_le_bytes()],
        bump
    )]
    pub game_state: Account<'info, GameState>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(game_id: u64, initiator: Pubkey)]
pub struct StartGame<'info> {
    #[account(mut)]
    pub player: Signer<'info>,

    #[account(
        mut,
        constraint = game_state.is_initiator(player.key()) @ CustomError::CannotJoinOwnGame,
        constraint = game_state.is_correct_initiator(initiator) @ CustomError::IncorrectInitiator,
        constraint = game_state.is_correct_game_id(game_id) @ CustomError::IncorrectGameId,
        seeds = [b"game_state", initiator.as_ref(), &game_id.to_le_bytes()],
        bump = game_state.bump
    )]
    pub game_state: Account<'info, GameState>,

    pub price_update: Account<'info, PriceUpdateV2>,

    pub system_program: Program<'info, System>,
}

// Use TWAP (Time-Weighted Average Price) for price checks
// Concerned about fairness more than high frequency
// - Reflects general trend over time.
// - Resistant to price manipulation.
// - Trustworthy for barrier crossing logic.
// Anchor it to the price at game start, and compare to TWAP at "closeGame" time
#[derive(Accounts)]
#[instruction(game_id: u64, initiator: Pubkey)]
pub struct CloseGame<'info> {
    #[account(mut)]
    pub player: Signer<'info>,

    pub twap_update: Account<'info, TwapUpdate>,

    #[account(
        mut,
        constraint = game_state.is_active() @ CustomError::GameNotActive,
        constraint = game_state.is_ended() @ CustomError::GameAlreadyEnded,
        constraint = game_state.is_correct_initiator(initiator) @ CustomError::IncorrectInitiator,
        constraint = game_state.is_correct_game_id(game_id) @ CustomError::IncorrectGameId,
        seeds = [b"game_state", initiator.as_ref(), &game_id.to_le_bytes()],
        bump = game_state.bump
    )]
    pub game_state: Account<'info, GameState>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub player: Signer<'info>,

    #[account(
        mut,
        close = player,
        seeds = [b"game_state", player.key().as_ref(), &game_state.game_id.to_le_bytes()],
        bump
    )]
    pub game_state: Account<'info, GameState>,
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
    pub initial_price: i64,                    // Price when game was created
    pub price_exponent: i32,                   // Price exponent
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
        pubkey != self.initiator
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

    #[msg("Only the initiator can withdraw from this game")]
    NotInitiator,

    #[msg("The price feed data is stale or unavailable")]
    StalePriceFeed,

    #[msg("Invalid price value received from oracle")]
    InvalidPriceValue,

    #[msg("Prediction must be 'Increase' or 'Decrease'")]
    InvalidPrediction,

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
    pub price: i64,
    pub conf: u64,
    pub exponent: i32,
    pub formatted_price: f64,
}

#[event]
pub struct PriceMovementChecked {
    pub base_price: i64,
    pub current_price: i64,
    pub exponent: i32,
    pub percentage: f64,
    pub increased: bool,
    pub decreased: bool,
}

#[event]
pub struct TransferExecuted {
    pub amount_in_lamports: u64,
    pub to: Pubkey,
}

#[event]
pub struct GameCreated {
    pub initiator: Pubkey,
    pub prediction: PricePrediction,
    pub initial_price: i64,
    pub formatted_price: f64,
    pub exponent: i32,
    pub entry_amount: u64,
    pub game_id: u64,
    pub timestamp: i64,
}

#[event]
pub struct GameStarted {
    pub challenger: Pubkey,
    pub challenger_prediction: PricePrediction,
    pub game_id: u64,
    pub timestamp: i64,
}

#[event]
pub struct GameClosed {
    pub winner: Pubkey,
    pub final_price: i64,
    pub formatted_final_price: f64,
    pub price_movement_percentage: f64,
    pub winning_prediction: PricePrediction,
    pub total_payout: u64,
    pub game_id: u64,
    pub timestamp: i64,
}

#[event]
pub struct GameWithdraw {
    pub end_timestamp: i64,
}

/**
 * HELPER FUNCTIONS
 */
// Format price as a human-readable float
fn format_price(price: i64, exponent: i32) -> f64 {
    (price as f64) * 10_f64.powi(exponent)
}

// Checks if price has moved by given percentage
fn has_price_moved_by_percentage(
    initial_price: i64,
    current_price: i64,
    exponent: i32,
    percentage: f64,
) -> Result<(bool, bool)> {
    if initial_price <= 0 || current_price <= 0 {
        return Err(CustomError::InvalidPriceValue.into());
    }

    let initial = (initial_price as f64) * 10_f64.powi(exponent);
    let current = (current_price as f64) * 10_f64.powi(exponent);

    let increase_threshold = initial * (1.0 + percentage);
    let decrease_threshold = initial * (1.0 - percentage);

    let increased = current >= increase_threshold;
    let decreased = current <= decrease_threshold;

    Ok((increased, decreased))
}
