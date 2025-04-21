use anchor_lang::prelude::*;

use super::PricePrediction;

#[event]
pub struct PriceFetched {
    pub description: String,
    pub price: f64,
    pub timestamp: i64,
}

#[event]
pub struct GameCreated {
    pub initiator: Pubkey,
    pub prediction: PricePrediction,
    pub initial_price: f64,
    pub entry_amount: u64,
    pub game_id: u64,
    pub timestamp: i64,
}

#[event]
pub struct GameJoined {
    pub challenger: Pubkey,
    pub challenger_prediction: PricePrediction,
    pub game_id: u64,
    pub timestamp: i64,
}

#[event]
pub struct GameClosed {
    pub winner: Pubkey,
    pub final_price: f64,
    pub price_movement_percentage: f64,
    pub winning_prediction: PricePrediction,
    pub total_payout: u64,
    pub game_id: u64,
    pub timestamp: i64,
}

#[event]
pub struct GameCancelled {
    pub game_id: u64,
    pub timestamp: i64,
}
