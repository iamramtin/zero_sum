use anchor_lang::prelude::*;
use chainlink_solana as chainlink;

use crate::common::{PriceChanged, PriceFetched, USDC_DECIMALS};

use super::CustomError;

// Format chainlink price response as a floating point number
pub fn format_price(value: i128, decimals: u8) -> f64 {
    (value as f64) * 10_f64.powi(-(decimals as i32))
}

// Function to get the current price from Chainlink
pub fn get_chainlink_price<'info>(
    chainlink_program: &AccountInfo<'info>,
    chainlink_feed: &AccountInfo<'info>,
    current_time: i64,
) -> Result<f64> {
    let round = chainlink::latest_round_data(
        chainlink_program.to_account_info(),
        chainlink_feed.to_account_info(),
    )?;

    let decimals = chainlink::decimals(
        chainlink_program.to_account_info(),
        chainlink_feed.to_account_info(),
    )?;

    let description = chainlink::description(
        chainlink_program.to_account_info(),
        chainlink_feed.to_account_info(),
    )?;

    let formatted_price = format_price(round.answer, decimals);

    emit!(PriceFetched {
        description: description.clone(),
        price: formatted_price,
        timestamp: current_time,
    });

    Ok(formatted_price)
}

// Checks if price has moved by given percentage
pub fn has_price_moved_by_percentage(
    initial_price: f64,
    final_price: f64,
    percentage: f64,
) -> Result<(bool, i8, f64)> {
    if initial_price <= 0.0 || final_price <= 0.0 {
        return Err(CustomError::InvalidPriceValue.into());
    }

    // Calculate the percentage change
    let percentage_change = (final_price - initial_price) / initial_price;

    // Determine if threshold is exceeded and the direction
    let threshold_exceeded = percentage_change.abs() >= percentage.abs();

    // Return direction: 1 for increase, -1 for decrease, 0 for no change
    let direction = if percentage_change > 0.0 {
        1
    } else if percentage_change < 0.0 {
        -1
    } else {
        0
    };

    emit!(PriceChanged {
        initial_price,
        final_price,
        percentage_change,
        threshold_exceeded,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok((threshold_exceeded, direction, percentage_change))
}

// Converts a human-readable USDC amount to on-chain representation
// Example: 1000 -> 1_000_000_000
pub fn usdc_to_on_chain_amount(amount: u64) -> u64 {
    let usdc_multiplier: u64 = 10u64.pow(USDC_DECIMALS);

    amount * usdc_multiplier
}
