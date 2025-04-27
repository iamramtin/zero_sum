#![allow(clippy::result_large_err)]

use anchor_lang::prelude::*;
use anchor_spl::token::{self, TransferChecked};

pub mod common;
pub mod instructions;
pub mod state;

use crate::common::*;
use crate::instructions::*;

declare_id!("HyTwoM3vT59WKAcBKAQSu2zHh7vAoduS5tTL8Z1uLDdc");

#[program]
pub mod zero_sum {
    use super::*;

    /// Creates a new game and initializes game state.
    ///
    /// This is called by the first player (initiator), who also provides their prediction
    /// on whether the price will increase or decrease.
    ///
    /// This function:
    /// - Initializes the GameState account
    /// - Stores the initiator’s prediction
    /// - Sets initial game state
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
        game_state.entry_amount = usdc_to_on_chain_amount(ENTRY_AMOUNT_USDC);
        game_state.initial_price = initial_price;
        game_state.created_at = current_time;
        game_state.status = GameStatus::Pending;
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
            game_id: ctx.accounts.game_state.game_id,
            status: GameStatus::Pending,
            initiator: *ctx.accounts.initiator.key,
            prediction,
            initial_price,
            entry_amount: ENTRY_AMOUNT_USDC,
            timestamp: current_time,
        });

        Ok(())
    }

    /// Allows a second player (challenger) to join an open game.
    ///
    /// The challenger is automatically assigned the *opposite* prediction to the initiator.
    ///
    /// This function:
    /// - Validates game is joinable
    /// - Ensures challenger is not the same as initiator
    /// - Marks the game as started
    pub fn join_game(ctx: Context<JoinGame>, game_id: u64, initiator: Pubkey) -> Result<()> {
        let game_state = &mut ctx.accounts.game_state;
        let challenger = &ctx.accounts.challenger;
        let challenger_key = challenger.key();
        let current_time = Clock::get()?.unix_timestamp;

        game_state.validate_join(game_id, challenger_key, initiator)?;

        // Get price data from Chainlink
        let current_price = get_chainlink_price(
            &ctx.accounts.chainlink_program,
            &ctx.accounts.chainlink_feed,
            current_time,
        )?;

        let (threshold_exceeded, _, _) = has_price_moved_by_percentage(
            game_state.initial_price,
            current_price,
            MAX_JOIN_PRICE_MOVEMENT,
        )?;

        require!(!threshold_exceeded, CustomError::ExcessivePriceVolatility);

        game_state.challenger = Some(challenger_key);
        game_state.started_at = Some(current_time);
        game_state.status = GameStatus::Active;

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
            game_id,
            status: GameStatus::Active,
            challenger: challenger_key,
            challenger_prediction,
            timestamp: current_time,
        });
        Ok(())
    }

    /// Closes the game and determines outcome based on price movement.
    ///
    /// Called by the initiator once the game is ready to be closed (price condition met).
    ///
    /// This function:
    /// - Validates that the game is active and not already closed
    /// - Marks the game as closed
    /// - Handles payout logic based on outcome
    pub fn close_game(ctx: Context<CloseGame>, game_id: u64, initiator: Pubkey) -> Result<()> {
        let game_state = &mut ctx.accounts.game_state;
        let current_time = Clock::get()?.unix_timestamp;

        game_state.validate_close(game_id, ctx.accounts.winner.key(), initiator)?;

        // Get price data from Chainlink
        let final_price = get_chainlink_price(
            &ctx.accounts.chainlink_program,
            &ctx.accounts.chainlink_feed,
            current_time,
        )?;

        let (threshold_exceeded, direction, price_movement_percentage) =
            has_price_moved_by_percentage(
                game_state.initial_price,
                final_price,
                WIN_PRICE_THRESHOLD,
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

        let winning_prediction = if direction == 1 {
            PricePrediction::Increase
        } else {
            PricePrediction::Decrease
        };

        require!(
            ctx.accounts.winner.key() == winner,
            CustomError::NotTheWinner
        );

        // Mark game as completed
        game_state.closed_at = Some(current_time);
        game_state.final_price = Some(final_price);
        game_state.winning_prediction = Some(winning_prediction);
        game_state.status = GameStatus::Complete(winning_prediction);

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

        emit!(GameClosed {
            game_id,
            status: GameStatus::Complete(winning_prediction),
            details: GameStatusDetails::Complete {
                winner,
                winning_prediction,
                price_movement_percentage,
                final_price,
                total_payout,
            },
            timestamp: current_time,
        });

        Ok(())
    }

    /// Allows players to claim back their stake if the game has timed out
    /// without reaching the price threshold.
    ///
    /// This function:
    /// - Checks if the game is active
    /// - Verifies that the timeout period has elapsed
    /// - Returns the entry amount to both players
    pub fn draw_game(ctx: Context<DrawGame>, game_id: u64, initiator: Pubkey) -> Result<()> {
        let game_state = &mut ctx.accounts.game_state;
        let current_time = Clock::get()?.unix_timestamp;

        game_state.validate_close(game_id, ctx.accounts.player.key(), initiator)?;

        // Check the game hasn't been closed already
        require!(!game_state.is_closed(), CustomError::GameAlreadyEnded);

        // Check if timeout has elapsed
        let start_time = game_state.started_at.unwrap();
        require!(
            current_time
                > start_time
                    .checked_add(GAME_TIMEOUT_SECONDS)
                    .ok_or(error!(CustomError::Overflow))?,
            CustomError::GameTimeoutNotReached
        );

        // Mark game as closed
        game_state.closed_at = Some(current_time);
        game_state.status = GameStatus::Draw;

        // Return the entry amounts to players
        let seeds = &[
            b"game_state",
            initiator.as_ref(),
            &game_id.to_le_bytes(),
            &[game_state.bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_program = ctx.accounts.token_program.to_account_info();

        // Return initiator's stake
        let cpi_accounts_initiator = TransferChecked {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.initiator_token_account.to_account_info(),
            mint: ctx.accounts.usdc_mint.to_account_info(),
            authority: game_state.to_account_info(),
        };
        let cpi_ctx_initiator =
            CpiContext::new_with_signer(cpi_program.clone(), cpi_accounts_initiator, signer);

        token::transfer_checked(
            cpi_ctx_initiator,
            game_state.entry_amount,
            ctx.accounts.usdc_mint.decimals,
        )?;

        // Return challenger's stake
        let cpi_accounts_challenger = TransferChecked {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.challenger_token_account.to_account_info(),
            mint: ctx.accounts.usdc_mint.to_account_info(),
            authority: game_state.to_account_info(),
        };
        let cpi_ctx_challenger =
            CpiContext::new_with_signer(cpi_program.clone(), cpi_accounts_challenger, signer);

        token::transfer_checked(
            cpi_ctx_challenger,
            game_state.entry_amount,
            ctx.accounts.usdc_mint.decimals,
        )?;

        emit!(GameClosed {
            game_id,
            status: GameStatus::Draw,
            details: GameStatusDetails::None,
            timestamp: current_time,
        });

        Ok(())
    }

    /// Cancels a game and allows the initiator to withdraw their stake.
    ///
    /// Only allowed if no challenger has joined yet.
    ///
    /// This function:
    /// - Ensures the game is still joinable and hasn't closed
    /// - Returns the entry amount to the initiator
    /// - Marks the game as cancelled
    pub fn cancel_game(ctx: Context<CancelGame>, game_id: u64) -> Result<()> {
        let game_state = &mut ctx.accounts.game_state;
        let initiator = &ctx.accounts.initiator;
        let initiator_key = initiator.key();
        let current_time = Clock::get()?.unix_timestamp;

        game_state.validate_withdraw(game_id, initiator_key)?;

        game_state.closed_at = Some(current_time);
        game_state.status = GameStatus::Cancelled;

        // Return the entry amount to initiator
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

        emit!(GameClosed {
            game_id,
            status: GameStatus::Cancelled,
            details: GameStatusDetails::None,
            timestamp: current_time,
        });

        Ok(())
    }
}
