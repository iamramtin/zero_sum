use anchor_lang::prelude::*;

#[error_code]
pub enum CustomError {
    #[msg("Arithmetic overflow")]
    Overflow,

    #[msg("Caller is not a participant of the game")]
    NotAuthorized,

    #[msg("Only the winner can the game")]
    NotTheWinner,

    #[msg("Only the initiator can withdraw from this game")]
    NotInitiator,

    #[msg("The price feed data is stale or unavailable")]
    StalePriceFeed,

    #[msg("Invalid token account")]
    InvalidTokenAccount,

    #[msg("Token mint must be USDC")]
    InvalidTokenMint,

    #[msg("Invalid price value received from oracle")]
    InvalidPriceValue,

    #[msg("Prediction must be 'Increase' or 'Decrease'")]
    InvalidPrediction,

    #[msg("Invalid price feed")]
    InvalidPriceFeed,

    #[msg("Incorrect initiator address provided")]
    IncorrectInitiator,

    #[msg("Incorrect game ID provided")]
    IncorrectGameId,

    #[msg("Game does not exist or has not been properly initialized")]
    GameNotActive,

    #[msg("This game has already been completed or cancelled")]
    GameAlreadyEnded,

    #[msg("This game already has two players")]
    GameAlreadyFull,

    #[msg("Withdrawal not allowed after a challenger has joined")]
    WithdrawalBlocked,

    #[msg("Cannot join - price has moved more than 1% since creation")]
    ExcessivePriceVolatility,

    #[msg("Neither price threshold has been reached yet")]
    ThresholdNotReached,

    #[msg("Cannot join your own game")]
    CannotJoinOwnGame,
}
