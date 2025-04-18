#![allow(clippy::result_large_err)]

use anchor_lang::prelude::*;

declare_id!("coUnmi3oBUtwtd9fjeAvSsJssXh5A5xyPbhpewyzRVF");

#[program]
pub mod zero_sum {
    use super::*;

  pub fn close(_ctx: Context<CloseZeroSum>) -> Result<()> {
    Ok(())
  }

  pub fn decrement(ctx: Context<Update>) -> Result<()> {
    ctx.accounts.zero_sum.count = ctx.accounts.zero_sum.count.checked_sub(1).unwrap();
    Ok(())
  }

  pub fn increment(ctx: Context<Update>) -> Result<()> {
    ctx.accounts.zero_sum.count = ctx.accounts.zero_sum.count.checked_add(1).unwrap();
    Ok(())
  }

  pub fn initialize(_ctx: Context<InitializeZeroSum>) -> Result<()> {
    Ok(())
  }

  pub fn set(ctx: Context<Update>, value: u8) -> Result<()> {
    ctx.accounts.zero_sum.count = value.clone();
    Ok(())
  }
}

#[derive(Accounts)]
pub struct InitializeZeroSum<'info> {
  #[account(mut)]
  pub payer: Signer<'info>,

  #[account(
  init,
  space = 8 + ZeroSum::INIT_SPACE,
  payer = payer
  )]
  pub zero_sum: Account<'info, ZeroSum>,
  pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
pub struct CloseZeroSum<'info> {
  #[account(mut)]
  pub payer: Signer<'info>,

  #[account(
  mut,
  close = payer, // close account and return lamports to payer
  )]
  pub zero_sum: Account<'info, ZeroSum>,
}

#[derive(Accounts)]
pub struct Update<'info> {
  #[account(mut)]
  pub zero_sum: Account<'info, ZeroSum>,
}

#[account]
#[derive(InitSpace)]
pub struct ZeroSum {
  count: u8,
}
