use anchor_lang::prelude::*;

#[derive(InitSpace, AnchorSerialize, AnchorDeserialize, Debug, Clone, Copy, PartialEq)]
pub enum PricePrediction {
    Increase,
    Decrease,
}

#[derive(InitSpace, AnchorSerialize, AnchorDeserialize, Debug, Clone, Copy, PartialEq)]
pub enum GameStatus {
    /// Game is active and awaiting completion
    Active,

    /// Game created, but waiting for another player to join
    Pending,

    /// Game ended with a winner; contains the winning prediction
    Complete(PricePrediction),

    /// Game ended in a draw due to timeout or other draw condition
    Draw,

    /// Game was cancelled before another player joined
    Cancelled,
}
