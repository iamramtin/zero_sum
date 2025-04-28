use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct FetchPrice<'info> {
    /// CHECK: We're reading data from this specified chainlink feed
    pub chainlink_feed: AccountInfo<'info>,

    /// CHECK: This is the Chainlink program library on Devnet
    pub chainlink_program: AccountInfo<'info>,
}
