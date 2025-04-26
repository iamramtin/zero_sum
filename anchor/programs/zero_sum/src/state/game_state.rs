use anchor_lang::prelude::*;

use crate::common::{CustomError, GameStatus, PricePrediction, GAME_TIMEOUT_SECONDS};

#[account]
#[derive(InitSpace)]
pub struct GameState {
    pub game_id: u64,                                // Unique identifier for the game
    pub initiator: Pubkey,                           // Game creator address
    pub initiator_prediction: PricePrediction,       // First player's prediction
    pub challenger: Option<Pubkey>,                  // Joining player address
    pub winning_prediction: Option<PricePrediction>, // Winning player's prediction
    pub entry_amount: u64,                           // Amount to enter the game (in USDC)
    pub initial_price: f64,                          // Price at game creation
    pub final_price: Option<f64>,                    // Price at game completion
    pub created_at: i64,                             // Timestamp of game creation
    pub started_at: Option<i64>, // Timestamp when challenger joined and game started
    pub closed_at: Option<i64>,  // Timestamp when game was closed
    pub status: GameStatus,      // Status of the game
    pub bump: u8,
}

impl GameState {
    /// Returns true if the game has a challenger and hasn't ended.
    pub fn is_active(&self) -> bool {
        self.challenger.is_some() && self.closed_at.is_none()
    }

    /// Returns true if the game has ended.
    pub fn is_closed(&self) -> bool {
        self.closed_at.is_some()
    }

    /// Returns true if the game has no challenger.
    pub fn joinable_game(&self) -> bool {
        self.challenger.is_none()
    }

    /// Returns true if the given public key is the initiator.
    pub fn is_initiator(&self, pubkey: Pubkey) -> bool {
        pubkey == self.initiator
    }

    /// Returns true if the given public key matches the challenger.
    pub fn is_challenger(&self, pubkey: Pubkey) -> bool {
        Some(pubkey) == self.challenger
    }

    /// Returns true if the given public key is a participant in the game.
    pub fn is_player(&self, pubkey: Pubkey) -> bool {
        self.is_initiator(pubkey) || self.is_challenger(pubkey)
    }

    /// Returns true if the provided game_id matches the stored one.
    pub fn is_correct_game_id(&self, game_id: u64) -> bool {
        game_id == self.game_id
    }

    /// Validates whether a player can join the game.
    pub fn validate_join(
        &self,
        game_id: u64,
        challenger_key: Pubkey,
        initiator_key: Pubkey,
    ) -> Result<()> {
        require!(
            self.is_correct_game_id(game_id),
            CustomError::IncorrectGameId
        );
        require!(
            self.is_initiator(initiator_key),
            CustomError::IncorrectInitiator
        );
        require!(!self.is_closed(), CustomError::GameAlreadyEnded);
        require!(
            !self.is_initiator(challenger_key),
            CustomError::CannotJoinOwnGame
        );
        require!(self.joinable_game(), CustomError::GameAlreadyFull);

        Ok(())
    }

    /// Validates whether a player can close the game.
    pub fn validate_close(
        &self,
        game_id: u64,
        player_key: Pubkey,
        initiator_key: Pubkey,
    ) -> Result<()> {
        require!(
            self.is_correct_game_id(game_id),
            CustomError::IncorrectGameId
        );
        require!(self.is_active(), CustomError::GameNotActive);
        require!(self.is_player(player_key), CustomError::NotAuthorized);
        require!(
            self.is_initiator(initiator_key),
            CustomError::IncorrectInitiator
        );

        Ok(())
    }

    /// Validates whether the initiator can withdraw from an open game.
    pub fn validate_withdraw(&self, game_id: u64, initiator_key: Pubkey) -> Result<()> {
        require!(
            self.is_correct_game_id(game_id),
            CustomError::IncorrectGameId
        );
        require!(self.is_initiator(initiator_key), CustomError::NotInitiator);
        require!(!self.is_closed(), CustomError::GameAlreadyEnded);
        require!(self.joinable_game(), CustomError::WithdrawalBlocked);

        Ok(())
    }

    /// Returns the prediction for the challenger (opposite of initiator's).
    pub fn get_challenger_prediction(&self) -> PricePrediction {
        match self.initiator_prediction {
            PricePrediction::Increase => PricePrediction::Decrease,
            PricePrediction::Decrease => PricePrediction::Increase,
        }
    }

    /// Returns true if the game has timed out without being resolved.
    pub fn is_timed_out(&self, current_time: i64) -> Result<bool> {
        // If the game is not active, it's not timed out
        if !self.is_active() {
            return Ok(false);
        }

        // If game has a challenger (active game), check against started_at
        let start_time = self.started_at.unwrap();
        let timeout_time = start_time
            .checked_add(GAME_TIMEOUT_SECONDS)
            .ok_or(error!(CustomError::Overflow))?;

        return Ok(current_time > timeout_time);
    }
}
