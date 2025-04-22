use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{common::CustomError, state::GameState};

#[derive(Accounts)]
#[instruction(game_id: u64, initiator: Pubkey)]
pub struct DrawGame<'info> {
    #[account(mut)]
    pub player: Signer<'info>,

    #[account(
        mut,
        seeds = [b"game_state", initiator.key().as_ref(), &game_id.to_le_bytes()],
        bump = game_state.bump
    )]
    pub game_state: Account<'info, GameState>,

    #[account(
        mut,
        seeds = [b"game_vault", initiator.key().as_ref(), &game_id.to_le_bytes()],
        bump
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = initiator_token_account.owner == game_state.initiator && initiator_token_account.mint == usdc_mint.key() @ CustomError::InvalidTokenAccount
    )]
    pub initiator_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = game_state.challenger.is_some() && challenger_token_account.owner == game_state.challenger.unwrap() && challenger_token_account.mint == usdc_mint.key() @ CustomError::InvalidTokenAccount
    )]
    pub challenger_token_account: Account<'info, TokenAccount>,

    pub usdc_mint: Account<'info, Mint>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}
