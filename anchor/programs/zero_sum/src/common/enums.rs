use anchor_lang::prelude::*;

#[derive(InitSpace, AnchorSerialize, AnchorDeserialize, Debug, Clone, Copy, PartialEq)]
pub enum PricePrediction {
    Increase,
    Decrease,
}

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone, Copy, PartialEq)]
pub enum GameOutcome {
    Win(PricePrediction), // Indicates which prediction won
    Draw,                 // Timeout or other draw condition
    Cancel,               // Initiator withdrew before anyone joined
}
