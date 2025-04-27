use anchor_lang::prelude::*;

use super::{GameStatus, PricePrediction};

#[event]
pub struct PriceFetched {
    pub description: String,
    pub price: f64,
    pub timestamp: i64,
}

#[event]
pub struct PriceChanged {
    pub initial_price: f64,
    pub final_price: f64,
    pub percentage_change: f64,
    pub threshold_exceeded: bool,
    pub timestamp: i64,
}

#[event]
pub struct GameCreated {
    pub game_id: u64,
    pub status: GameStatus,
    pub initiator: Pubkey,
    pub prediction: PricePrediction,
    pub initial_price: f64,
    pub entry_amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct GameJoined {
pub game_id: u64,
pub status: GameStatus,
pub challenger: Pubkey,
pub challenger_prediction: PricePrediction,
pub timestamp: i64,
}

#[event]
pub struct GameClosed {
    pub game_id: u64,
    pub status: GameStatus,
    pub details: GameStatusDetails,
    pub timestamp: i64,
}

#[derive(Debug, AnchorSerialize, AnchorDeserialize)]
pub enum GameStatusDetails {
    Complete {
        winner: Pubkey,
        winning_prediction: PricePrediction,
        price_movement_percentage: f64,
        final_price: f64,
        total_payout: u64,
    },
    None,
}
