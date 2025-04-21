use anchor_lang::{prelude::*, Discriminator};
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{common::CustomError, state::GameState};

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
