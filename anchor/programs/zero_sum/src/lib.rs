#![allow(clippy::result_large_err)]

use anchor_lang::{
    prelude::*,
    solana_program::{native_token::LAMPORTS_PER_SOL, system_instruction},
};
use pyth_solana_receiver_sdk::price_update::{PriceUpdateV2, TwapUpdate};

declare_id!("Cy59cDTqWRNtNF2x7ESkB1vEuSV2uLW85en5Ph7h1LrU");

// get_price_no_older_than will fail if the price update is more than this
pub const MAXIMUM_AGE: u64 = 30; // 30 sec

// Feeds from https://pyth.network/developers/price-feed-ids
pub const BTC_USD_FEED_ID: &str =
    "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43";
pub const SOL_USD_FEED_ID: &str =
    "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
pub const ETH_USD_FEED_ID: &str =
    "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace"; // use this for escrow program

#[program]
pub mod zero_sum {
    use pyth_solana_receiver_sdk::price_update::get_feed_id_from_hex;

    use super::*;

    pub fn price_feed(ctx: Context<PriceFeed>) -> Result<()> {
        let price_update = &mut ctx.accounts.price_update;

        let feed_id: [u8; 32] = get_feed_id_from_hex(BTC_USD_FEED_ID)?;
        let price = price_update.get_price_no_older_than(&Clock::get()?, MAXIMUM_AGE, &feed_id)?;

        emit!(PriceFetched {
            price: price.price,
            conf: price.conf,
            exponent: price.exponent,
        });

        Ok(())
    }

    pub fn send(ctx: Context<Send>, amount_in_usd: u64) -> Result<()> {
        let price_update = &mut ctx.accounts.price_update;
        let payer = &mut ctx.accounts.payer;
        let destination = &mut ctx.accounts.destination;

        let current_time = Clock::get()?;

        let feed_id =
            get_feed_id_from_hex(SOL_USD_FEED_ID).map_err(|_| CustomError::InvalidPriceFeed)?;

        // Will fail if the price update is for a different price feed
        let price = price_update
            .get_price_no_older_than(&current_time, MAXIMUM_AGE, &feed_id)
            .map_err(|_| CustomError::StalePriceFeed)?;

        emit!(PriceFetched {
            price: price.price,
            conf: price.conf,
            exponent: price.exponent,
        });

        let amount_in_lamports = usd_to_lamports(amount_in_usd, price.price, price.exponent)?;

        let transfer_instruction =
            system_instruction::transfer(payer.key, destination.key, amount_in_lamports);

        anchor_lang::solana_program::program::invoke(
            &transfer_instruction,
            &[payer.to_account_info(), destination.to_account_info()],
        )?;

        emit!(TransferExecuted {
            amount_in_lamports,
            to: *destination.key,
        });

        Ok(())
    }

    pub fn send_using_twap(
        ctx: Context<SendUsingTwap>,
        amount_in_usd: u64,
        twap_window_seconds: u64,
    ) -> Result<()> {
        let twap_update = &mut ctx.accounts.twap_update;
        let payer = &mut ctx.accounts.payer;
        let destination = &mut ctx.accounts.destination;

        let current_time = Clock::get()?;

        let feed_id =
            get_feed_id_from_hex(SOL_USD_FEED_ID).map_err(|_| CustomError::InvalidPriceFeed)?;

        // Will fail if the price update is for a different price feed
        let price = twap_update
            .get_twap_no_older_than(&current_time, MAXIMUM_AGE, twap_window_seconds, &feed_id)
            .map_err(|_| CustomError::StalePriceFeed)?;

        emit!(PriceFetched {
            price: price.price,
            conf: price.conf,
            exponent: price.exponent,
        });

        let amount_in_lamports = usd_to_lamports(amount_in_usd, price.price, price.exponent)?;

        let transfer_instruction =
            system_instruction::transfer(payer.key, destination.key, amount_in_lamports);

        anchor_lang::solana_program::program::invoke(
            &transfer_instruction,
            &[payer.to_account_info(), destination.to_account_info()],
        )?;

        emit!(TransferExecuted {
            amount_in_lamports,
            to: *destination.key,
        });

        Ok(())
    }
}

/**
 * INSTRUCTIONS
 */
#[derive(Accounts)]
#[instruction()]
pub struct PriceFeed<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    // Add this account to any instruction Context that needs price data.
    pub price_update: Account<'info, PriceUpdateV2>,
}

#[derive(Accounts)]
#[instruction(amount_in_usd: u64)]
pub struct Send<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(mut)]
    /// CHECK : Just a destination
    pub destination: AccountInfo<'info>,

    // Add this account to any instruction Context that needs price data
    pub price_update: Account<'info, PriceUpdateV2>,

    pub system_program: Program<'info, System>,
}

// Use TWAP (Time-Weighted Average Price)
// Concerned about fairness more than high frequency
// - Reflects general trend over time.
// - Resistant to price manipulation.
// - Trustworthy for barrier crossing logic.
// Anchor it to the price at game start, and compare to TWAP at "closeGame" time
#[derive(Accounts)]
#[instruction(amount_in_usd: u64)]
pub struct SendUsingTwap<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(mut)]
    /// CHECK : Just a destination
    pub destination: AccountInfo<'info>,

    // Add this account to any instruction Context that needs price data
    pub twap_update: Account<'info, TwapUpdate>,

    pub system_program: Program<'info, System>,
}

/**
 * ERRORS
 */
#[error_code]
pub enum CustomError {
    #[msg("The Pyth price feed account is invalid.")]
    InvalidPriceFeed,

    #[msg("The Pyth price feed is stale.")]
    StalePriceFeed,

    #[msg("Arithmetic overflow occurred during a calculation.")]
    MathOverflow,

    #[msg("Invalid price value conversion.")]
    InvalidPriceValue,

    #[msg("Positive exponent values are not supported.")]
    UnsupportedPositiveExponent,
}

/**
 * EVENTS
 */
#[event]
pub struct PriceFetched {
    pub price: i64,
    pub conf: u64,
    pub exponent: i32,
}

#[event]
pub struct TransferExecuted {
    pub amount_in_lamports: u64,
    pub to: Pubkey,
}

/// Converts an amount in USD to lamports using a raw price value and exponent from a Pyth price feed.
///
/// # How It Works
/// Given:
/// - amount_in_usd = $5
/// - price = 7160106530699
/// - exponent = -8
///
/// It calculates:
///     lamports = ($5 * 1e9 * 1e8) / 7160106530699
///
/// # Arguments
/// * `amount_in_usd` - The amount in quote currency (e.g. USD)
/// * `price` - The raw price from Pyth (e.g. `7160106530699`)
/// * `exponent` - The Pyth price exponent (e.g. `-8`)
///
/// # Returns
/// * Result<u64> - The amount in lamports
pub fn usd_to_lamports(amount_in_usd: u64, price: i64, exponent: i32) -> Result<u64> {
    if price <= 0 {
        return Err(CustomError::InvalidPriceValue.into());
    }

    if exponent > 0 {
        return Err(CustomError::UnsupportedPositiveExponent.into());
    }

    // Compute 10 ^ |exponent| to scale the price properly
    let exponent_factor = 10_u64
        .checked_pow(
            exponent
                .abs()
                .try_into()
                .map_err(|_| CustomError::MathOverflow)?,
        )
        .ok_or(CustomError::MathOverflow)?;

    // Compute the scaled numerator (e.g. lamports * 10^exponent)
    let numerator = LAMPORTS_PER_SOL
        .checked_mul(exponent_factor)
        .ok_or(CustomError::MathOverflow)?;

    // Scale the input amount (USD * numerator)
    let scaled_amount = numerator
        .checked_mul(amount_in_usd)
        .ok_or(CustomError::MathOverflow)?;

    let price_value = price
        .try_into()
        .map_err(|_| CustomError::InvalidPriceValue)?;

    // Divide the scaled value by the price to get lamports
    let base_amount = scaled_amount
        .checked_div(price_value)
        .ok_or(CustomError::MathOverflow)?;

    Ok(base_amount)
}
