use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{common::CustomError, state::GameState};

#[derive(Accounts)]
#[instruction(game_id: u64)]
pub struct CancelGame<'info> {
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
        constraint = !game_state.is_closed() @ CustomError::GameAlreadyEnded,
        constraint = game_state.joinable_game() @ CustomError::WithdrawalBlocked,
        seeds = [b"game_state", initiator.key().as_ref(), &game_id.to_le_bytes()],
        bump = game_state.bump
    )]
    pub game_state: Account<'info, GameState>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}
