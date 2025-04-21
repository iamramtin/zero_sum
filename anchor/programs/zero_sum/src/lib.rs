#![allow(clippy::result_large_err)]

use anchor_lang::prelude::*;
use anchor_spl::token::{self, TransferChecked};

pub mod common;
pub mod instructions;
pub mod state;

use crate::common::*;
use crate::instructions::*;

declare_id!("5ngJ1FaFSZAtsW6rrRmQEN65FXKgxVTr51epWTpsGyLf");

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
        game_state.entry_amount = ENTRY_AMOUNT_USDC;
        game_state.initial_price = initial_price;
        game_state.created_at = current_time;
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
            entry_amount: ENTRY_AMOUNT_USDC,
            game_id: ctx.accounts.game_state.game_id,
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

        game_state.validate_close(game_id, initiator)?;

        // Get price data from Chainlink
        let final_price = get_chainlink_price(
            &ctx.accounts.chainlink_program,
            &ctx.accounts.chainlink_feed,
            current_time,
        )?;

        let (threshold_exceeded, direction, percentage_change) = has_price_moved_by_percentage(
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

        require!(
            ctx.accounts.winner.key() == winner,
            CustomError::NotTheWinner
        );

        // Mark game as completed
        let game_state = &mut ctx.accounts.game_state;
        game_state.closed_at = Some(current_time);

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

    /// Cancels a game and allows the initiator to withdraw their stake.
    ///
    /// Only allowed if no challenger has joined yet.
    ///
    /// This function:
    /// - Ensures the game is still joinable and hasn't closed
    /// - Returns the entry amount to the initiator
    /// - Marks the game as cancelled
    pub fn withdraw(ctx: Context<Withdraw>, game_id: u64) -> Result<()> {
        let game_state = &mut ctx.accounts.game_state;
        let initiator = &ctx.accounts.initiator;
        let initiator_key = initiator.key();
        let current_time = Clock::get()?.unix_timestamp;

        game_state.validate_withdraw(game_id, initiator_key)?;

        game_state.cancelled_at = Some(current_time);
        game_state.closed_at = Some(current_time);

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
