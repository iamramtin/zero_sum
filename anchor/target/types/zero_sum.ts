/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/zero_sum.json`.
 */
export type ZeroSum = {
  "address": "HYCj1f1r6zS2AwBcsCvQF68fjhUovJBRvo3eNR4AETVY",
  "metadata": {
    "name": "zeroSum",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "cancelGame",
      "docs": [
        "Cancels a game and allows the initiator to withdraw their stake.",
        "",
        "Only allowed if no challenger has joined yet.",
        "",
        "This function:",
        "- Ensures the game is still joinable and hasn't closed",
        "- Returns the entry amount to the initiator",
        "- Marks the game as cancelled"
      ],
      "discriminator": [
        121,
        194,
        154,
        118,
        103,
        235,
        149,
        52
      ],
      "accounts": [
        {
          "name": "initiator",
          "writable": true,
          "signer": true
        },
        {
          "name": "initiatorTokenAccount",
          "writable": true
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "initiator"
              },
              {
                "kind": "arg",
                "path": "gameId"
              }
            ]
          }
        },
        {
          "name": "gameState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "initiator"
              },
              {
                "kind": "arg",
                "path": "gameId"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "gameId",
          "type": "u64"
        }
      ]
    },
    {
      "name": "closeGame",
      "docs": [
        "Closes the game and determines outcome based on price movement.",
        "",
        "Called by the initiator once the game is ready to be closed (price condition met).",
        "",
        "This function:",
        "- Validates that the game is active and not already closed",
        "- Marks the game as closed",
        "- Handles payout logic based on outcome"
      ],
      "discriminator": [
        237,
        236,
        157,
        201,
        253,
        20,
        248,
        67
      ],
      "accounts": [
        {
          "name": "winner",
          "writable": true,
          "signer": true
        },
        {
          "name": "winnerTokenAccount",
          "writable": true
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "initiator"
              },
              {
                "kind": "arg",
                "path": "gameId"
              }
            ]
          }
        },
        {
          "name": "gameState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "initiator"
              },
              {
                "kind": "arg",
                "path": "gameId"
              }
            ]
          }
        },
        {
          "name": "chainlinkFeed"
        },
        {
          "name": "chainlinkProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "gameId",
          "type": "u64"
        },
        {
          "name": "initiator",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "createGame",
      "docs": [
        "Creates a new game and initializes game state.",
        "",
        "This is called by the first player (initiator), who also provides their prediction",
        "on whether the price will increase or decrease.",
        "",
        "This function:",
        "- Initializes the GameState account",
        "- Stores the initiator’s prediction",
        "- Sets initial game state"
      ],
      "discriminator": [
        124,
        69,
        75,
        66,
        184,
        220,
        72,
        206
      ],
      "accounts": [
        {
          "name": "initiator",
          "writable": true,
          "signer": true
        },
        {
          "name": "initiatorTokenAccount",
          "writable": true
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "initiator"
              },
              {
                "kind": "arg",
                "path": "gameId"
              }
            ]
          }
        },
        {
          "name": "gameState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "initiator"
              },
              {
                "kind": "arg",
                "path": "gameId"
              }
            ]
          }
        },
        {
          "name": "chainlinkFeed"
        },
        {
          "name": "chainlinkProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "gameId",
          "type": "u64"
        },
        {
          "name": "prediction",
          "type": {
            "defined": {
              "name": "pricePrediction"
            }
          }
        }
      ]
    },
    {
      "name": "drawGame",
      "docs": [
        "Allows players to claim back their stake if the game has timed out",
        "without reaching the price threshold.",
        "",
        "This function:",
        "- Checks if the game is active",
        "- Verifies that the timeout period has elapsed",
        "- Returns the entry amount to both players"
      ],
      "discriminator": [
        251,
        111,
        25,
        96,
        47,
        218,
        220,
        90
      ],
      "accounts": [
        {
          "name": "player",
          "writable": true,
          "signer": true
        },
        {
          "name": "gameState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "initiator"
              },
              {
                "kind": "arg",
                "path": "gameId"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "initiator"
              },
              {
                "kind": "arg",
                "path": "gameId"
              }
            ]
          }
        },
        {
          "name": "initiatorTokenAccount",
          "writable": true
        },
        {
          "name": "challengerTokenAccount",
          "writable": true
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "gameId",
          "type": "u64"
        },
        {
          "name": "initiator",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "joinGame",
      "docs": [
        "Allows a second player (challenger) to join an open game.",
        "",
        "The challenger is automatically assigned the *opposite* prediction to the initiator.",
        "",
        "This function:",
        "- Validates game is joinable",
        "- Ensures challenger is not the same as initiator",
        "- Marks the game as started"
      ],
      "discriminator": [
        107,
        112,
        18,
        38,
        56,
        173,
        60,
        128
      ],
      "accounts": [
        {
          "name": "challenger",
          "writable": true,
          "signer": true
        },
        {
          "name": "challengerTokenAccount",
          "writable": true
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "initiator"
              },
              {
                "kind": "arg",
                "path": "gameId"
              }
            ]
          }
        },
        {
          "name": "gameState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "initiator"
              },
              {
                "kind": "arg",
                "path": "gameId"
              }
            ]
          }
        },
        {
          "name": "chainlinkFeed"
        },
        {
          "name": "chainlinkProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "gameId",
          "type": "u64"
        },
        {
          "name": "initiator",
          "type": "pubkey"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "gameState",
      "discriminator": [
        144,
        94,
        208,
        172,
        248,
        99,
        134,
        120
      ]
    }
  ],
  "events": [
    {
      "name": "gameClosed",
      "discriminator": [
        178,
        203,
        179,
        224,
        43,
        18,
        209,
        4
      ]
    },
    {
      "name": "gameCreated",
      "discriminator": [
        218,
        25,
        150,
        94,
        177,
        112,
        96,
        2
      ]
    },
    {
      "name": "gameJoined",
      "discriminator": [
        111,
        242,
        51,
        235,
        66,
        43,
        140,
        84
      ]
    },
    {
      "name": "priceFetched",
      "discriminator": [
        207,
        104,
        233,
        65,
        92,
        239,
        79,
        86
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "overflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6001,
      "name": "notAuthorized",
      "msg": "Caller is not a participant of the game"
    },
    {
      "code": 6002,
      "name": "notTheWinner",
      "msg": "Only the winner can the game"
    },
    {
      "code": 6003,
      "name": "notInitiator",
      "msg": "Only the initiator can withdraw from this game"
    },
    {
      "code": 6004,
      "name": "stalePriceFeed",
      "msg": "The price feed data is stale or unavailable"
    },
    {
      "code": 6005,
      "name": "invalidTokenAccount",
      "msg": "Invalid token account"
    },
    {
      "code": 6006,
      "name": "invalidTokenMint",
      "msg": "Token mint must be USDC"
    },
    {
      "code": 6007,
      "name": "invalidPriceValue",
      "msg": "Invalid price value received from oracle"
    },
    {
      "code": 6008,
      "name": "invalidPrediction",
      "msg": "Prediction must be 'Increase' or 'Decrease'"
    },
    {
      "code": 6009,
      "name": "invalidPriceFeed",
      "msg": "Invalid price feed"
    },
    {
      "code": 6010,
      "name": "incorrectInitiator",
      "msg": "Incorrect initiator address provided"
    },
    {
      "code": 6011,
      "name": "incorrectGameId",
      "msg": "Incorrect game ID provided"
    },
    {
      "code": 6012,
      "name": "gameNotActive",
      "msg": "Game does not exist or has not been properly initialized"
    },
    {
      "code": 6013,
      "name": "gameAlreadyEnded",
      "msg": "This game has already been completed or cancelled"
    },
    {
      "code": 6014,
      "name": "gameAlreadyFull",
      "msg": "This game already has two players"
    },
    {
      "code": 6015,
      "name": "gameTimeoutNotReached",
      "msg": "Game timeout has not been reached yet"
    },
    {
      "code": 6016,
      "name": "withdrawalBlocked",
      "msg": "Withdrawal not allowed after a challenger has joined"
    },
    {
      "code": 6017,
      "name": "excessivePriceVolatility",
      "msg": "Cannot join - price has moved more than 1% since creation"
    },
    {
      "code": 6018,
      "name": "thresholdNotReached",
      "msg": "Neither price threshold has been reached yet"
    },
    {
      "code": 6019,
      "name": "cannotJoinOwnGame",
      "msg": "Cannot join your own game"
    }
  ],
  "types": [
    {
      "name": "gameClosed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "gameId",
            "type": "u64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "gameStatus"
              }
            }
          },
          {
            "name": "details",
            "type": {
              "defined": {
                "name": "gameStatusDetails"
              }
            }
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "gameCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "gameId",
            "type": "u64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "gameStatus"
              }
            }
          },
          {
            "name": "initiator",
            "type": "pubkey"
          },
          {
            "name": "prediction",
            "type": {
              "defined": {
                "name": "pricePrediction"
              }
            }
          },
          {
            "name": "initialPrice",
            "type": "f64"
          },
          {
            "name": "entryAmount",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "gameJoined",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "gameId",
            "type": "u64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "gameStatus"
              }
            }
          },
          {
            "name": "challenger",
            "type": "pubkey"
          },
          {
            "name": "challengerPrediction",
            "type": {
              "defined": {
                "name": "pricePrediction"
              }
            }
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "gameState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "gameId",
            "type": "u64"
          },
          {
            "name": "initiator",
            "type": "pubkey"
          },
          {
            "name": "initiatorPrediction",
            "type": {
              "defined": {
                "name": "pricePrediction"
              }
            }
          },
          {
            "name": "challenger",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "winningPrediction",
            "type": {
              "option": {
                "defined": {
                  "name": "pricePrediction"
                }
              }
            }
          },
          {
            "name": "entryAmount",
            "type": "u64"
          },
          {
            "name": "initialPrice",
            "type": "f64"
          },
          {
            "name": "finalPrice",
            "type": {
              "option": "f64"
            }
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "startedAt",
            "type": {
              "option": "i64"
            }
          },
          {
            "name": "closedAt",
            "type": {
              "option": "i64"
            }
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "gameStatus"
              }
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "gameStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "active"
          },
          {
            "name": "pending"
          },
          {
            "name": "complete",
            "fields": [
              {
                "defined": {
                  "name": "pricePrediction"
                }
              }
            ]
          },
          {
            "name": "draw"
          },
          {
            "name": "cancelled"
          }
        ]
      }
    },
    {
      "name": "gameStatusDetails",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "complete",
            "fields": [
              {
                "name": "winner",
                "type": "pubkey"
              },
              {
                "name": "winningPrediction",
                "type": {
                  "defined": {
                    "name": "pricePrediction"
                  }
                }
              },
              {
                "name": "priceMovementPercentage",
                "type": "f64"
              },
              {
                "name": "finalPrice",
                "type": "f64"
              },
              {
                "name": "totalPayout",
                "type": "u64"
              }
            ]
          },
          {
            "name": "none"
          }
        ]
      }
    },
    {
      "name": "priceFetched",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "description",
            "type": "string"
          },
          {
            "name": "price",
            "type": "f64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "pricePrediction",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "increase"
          },
          {
            "name": "decrease"
          }
        ]
      }
    }
  ]
};
