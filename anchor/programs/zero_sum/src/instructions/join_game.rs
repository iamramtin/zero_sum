use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{common::CustomError, state::GameState};

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
        constraint = game_state.is_initiator(initiator) @ CustomError::IncorrectInitiator,
        constraint = game_state.is_correct_game_id(game_id) @ CustomError::IncorrectGameId,
        seeds = [b"game_state", initiator.key().as_ref(), &game_id.to_le_bytes()],
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
