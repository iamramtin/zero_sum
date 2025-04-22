use anchor_lang::prelude::*;

use super::{GameOutcome, PricePrediction};

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
    pub game_id: u64,
    pub outcome: GameOutcome,
    pub details: GameOutcomeDetails,
    pub timestamp: i64,
}

#[derive(Debug, AnchorSerialize, AnchorDeserialize)]
pub enum GameOutcomeDetails {
    Win {
        winner: Pubkey,
        winning_prediction: PricePrediction,
        price_movement_percentage: f64,
        final_price: f64,
        total_payout: u64,
    },
    None,
}
