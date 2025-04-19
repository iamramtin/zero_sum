/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/zero_sum.json`.
 */
export type ZeroSum = {
  "address": "Cy59cDTqWRNtNF2x7ESkB1vEuSV2uLW85en5Ph7h1LrU",
  "metadata": {
    "name": "zeroSum",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "checkPriceMovement",
      "discriminator": [
        254,
        59,
        192,
        234,
        11,
        116,
        117,
        203
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "priceUpdate"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "basePrice",
          "type": "i64"
        },
        {
          "name": "baseExponent",
          "type": "i32"
        },
        {
          "name": "percentage",
          "type": "f64"
        }
      ]
    },
    {
      "name": "closeGame",
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
          "name": "twapUpdate"
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
          "name": "priceUpdate"
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
      "name": "startGame",
      "discriminator": [
        249,
        47,
        252,
        172,
        184,
        162,
        245,
        14
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
          "name": "priceUpdate"
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
      "args": []
    },
    {
      "name": "withdraw",
      "discriminator": [
        183,
        18,
        70,
        156,
        148,
        109,
        161,
        34
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
                "kind": "account",
                "path": "game_state.game_id",
                "account": "gameState"
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
                "kind": "account",
                "path": "game_state.game_id",
                "account": "gameState"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
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
    },
    {
      "name": "priceUpdateV2",
      "discriminator": [
        34,
        241,
        35,
        99,
        157,
        126,
        244,
        205
      ]
    },
    {
      "name": "twapUpdate",
      "discriminator": [
        104,
        192,
        188,
        72,
        246,
        166,
        12,
        81
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
      "name": "gameStarted",
      "discriminator": [
        222,
        247,
        78,
        255,
        61,
        184,
        156,
        41
      ]
    },
    {
      "name": "gameWithdraw",
      "discriminator": [
        22,
        161,
        222,
        68,
        51,
        239,
        167,
        132
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
    },
    {
      "name": "priceMovementChecked",
      "discriminator": [
        98,
        233,
        23,
        26,
        198,
        1,
        5,
        63
      ]
    },
    {
      "name": "transferExecuted",
      "discriminator": [
        8,
        128,
        224,
        132,
        112,
        216,
        192,
        35
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
      "name": "notInitiator",
      "msg": "Only the initiator can withdraw from this game"
    },
    {
      "code": 6002,
      "name": "stalePriceFeed",
      "msg": "The price feed data is stale or unavailable"
    },
    {
      "code": 6003,
      "name": "invalidTokenAccount",
      "msg": "Invalid token account"
    },
    {
      "code": 6004,
      "name": "invalidTokenMint",
      "msg": "Token mint must be USDC"
    },
    {
      "code": 6005,
      "name": "invalidPriceValue",
      "msg": "Invalid price value received from oracle"
    },
    {
      "code": 6006,
      "name": "invalidPrediction",
      "msg": "Prediction must be 'Increase' or 'Decrease'"
    },
    {
      "code": 6007,
      "name": "incorrectInitiator",
      "msg": "Incorrect initiator address provided"
    },
    {
      "code": 6008,
      "name": "incorrectGameId",
      "msg": "Incorrect game ID provided"
    },
    {
      "code": 6009,
      "name": "gameNotActive",
      "msg": "Game does not exist or has not been properly initialized"
    },
    {
      "code": 6010,
      "name": "gameAlreadyEnded",
      "msg": "This game has already been completed or cancelled"
    },
    {
      "code": 6011,
      "name": "gameAlreadyFull",
      "msg": "This game already has two players"
    },
    {
      "code": 6012,
      "name": "withdrawalBlocked",
      "msg": "Withdrawal not allowed after a challenger has joined"
    },
    {
      "code": 6013,
      "name": "excessivePriceVolatility",
      "msg": "Cannot join - price has moved more than 1% since creation"
    },
    {
      "code": 6014,
      "name": "thresholdNotReached",
      "msg": "Neither price threshold has been reached yet"
    },
    {
      "code": 6015,
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
            "name": "winner",
            "type": "pubkey"
          },
          {
            "name": "finalPrice",
            "type": "i64"
          },
          {
            "name": "formattedFinalPrice",
            "type": "f64"
          },
          {
            "name": "priceMovementPercentage",
            "type": "f64"
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
            "name": "totalPayout",
            "type": "u64"
          },
          {
            "name": "gameId",
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
      "name": "gameCreated",
      "type": {
        "kind": "struct",
        "fields": [
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
            "type": "i64"
          },
          {
            "name": "formattedPrice",
            "type": "f64"
          },
          {
            "name": "exponent",
            "type": "i32"
          },
          {
            "name": "entryAmount",
            "type": "u64"
          },
          {
            "name": "gameId",
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
      "name": "gameStarted",
      "type": {
        "kind": "struct",
        "fields": [
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
            "name": "gameId",
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
      "name": "gameState",
      "docs": [
        "* ACCOUNTS"
      ],
      "type": {
        "kind": "struct",
        "fields": [
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
            "name": "entryAmount",
            "type": "u64"
          },
          {
            "name": "initialPrice",
            "type": "i64"
          },
          {
            "name": "priceExponent",
            "type": "i32"
          },
          {
            "name": "creationTimestamp",
            "type": "i64"
          },
          {
            "name": "startTimestamp",
            "type": {
              "option": "i64"
            }
          },
          {
            "name": "endTimestamp",
            "type": {
              "option": "i64"
            }
          },
          {
            "name": "cancelledTimestamp",
            "type": {
              "option": "i64"
            }
          },
          {
            "name": "gameId",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "gameWithdraw",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "endTimestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "priceFeedMessage",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "feedId",
            "docs": [
              "`FeedId` but avoid the type alias because of compatibility issues with Anchor's `idl-build` feature."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "price",
            "type": "i64"
          },
          {
            "name": "conf",
            "type": "u64"
          },
          {
            "name": "exponent",
            "type": "i32"
          },
          {
            "name": "publishTime",
            "docs": [
              "The timestamp of this price update in seconds"
            ],
            "type": "i64"
          },
          {
            "name": "prevPublishTime",
            "docs": [
              "The timestamp of the previous price update. This field is intended to allow users to",
              "identify the single unique price update for any moment in time:",
              "for any time t, the unique update is the one such that prev_publish_time < t <= publish_time.",
              "",
              "Note that there may not be such an update while we are migrating to the new message-sending logic,",
              "as some price updates on pythnet may not be sent to other chains (because the message-sending",
              "logic may not have triggered). We can solve this problem by making the message-sending mandatory",
              "(which we can do once publishers have migrated over).",
              "",
              "Additionally, this field may be equal to publish_time if the message is sent on a slot where",
              "where the aggregation was unsuccesful. This problem will go away once all publishers have",
              "migrated over to a recent version of pyth-agent."
            ],
            "type": "i64"
          },
          {
            "name": "emaPrice",
            "type": "i64"
          },
          {
            "name": "emaConf",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "priceFetched",
      "docs": [
        "* EVENTS"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "price",
            "type": "i64"
          },
          {
            "name": "conf",
            "type": "u64"
          },
          {
            "name": "exponent",
            "type": "i32"
          },
          {
            "name": "formattedPrice",
            "type": "f64"
          }
        ]
      }
    },
    {
      "name": "priceMovementChecked",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "basePrice",
            "type": "i64"
          },
          {
            "name": "currentPrice",
            "type": "i64"
          },
          {
            "name": "exponent",
            "type": "i32"
          },
          {
            "name": "percentage",
            "type": "f64"
          },
          {
            "name": "increased",
            "type": "bool"
          },
          {
            "name": "decreased",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "pricePrediction",
      "docs": [
        "* ENUM"
      ],
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
    },
    {
      "name": "priceUpdateV2",
      "docs": [
        "A price update account. This account is used by the Pyth Receiver program to store a verified price update from a Pyth price feed.",
        "It contains:",
        "- `write_authority`: The write authority for this account. This authority can close this account to reclaim rent or update the account to contain a different price update.",
        "- `verification_level`: The [`VerificationLevel`] of this price update. This represents how many Wormhole guardian signatures have been verified for this price update.",
        "- `price_message`: The actual price update.",
        "- `posted_slot`: The slot at which this price update was posted."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "writeAuthority",
            "type": "pubkey"
          },
          {
            "name": "verificationLevel",
            "type": {
              "defined": {
                "name": "verificationLevel"
              }
            }
          },
          {
            "name": "priceMessage",
            "type": {
              "defined": {
                "name": "priceFeedMessage"
              }
            }
          },
          {
            "name": "postedSlot",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "transferExecuted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "amountInLamports",
            "type": "u64"
          },
          {
            "name": "to",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "twapPrice",
      "docs": [
        "The time weighted average price & conf for a feed over the window [start_time, end_time].",
        "This type is used to persist the calculated TWAP in TwapUpdate accounts on Solana."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "feedId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "startTime",
            "type": "i64"
          },
          {
            "name": "endTime",
            "type": "i64"
          },
          {
            "name": "price",
            "type": "i64"
          },
          {
            "name": "conf",
            "type": "u64"
          },
          {
            "name": "exponent",
            "type": "i32"
          },
          {
            "name": "downSlotsRatio",
            "docs": [
              "Ratio out of 1_000_000, where a value of 1_000_000 represents",
              "all slots were missed and 0 represents no slots were missed."
            ],
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "twapUpdate",
      "docs": [
        "A time weighted average price account.",
        "This account is used by the Pyth Receiver program to store a TWAP update from a Pyth price feed.",
        "TwapUpdates can only be created after the client has verified the VAAs via the Wormhole contract.",
        "Check out `target_chains/solana/cli/src/main.rs` for an example of how to do this.",
        "",
        "It contains:",
        "- `write_authority`: The write authority for this account. This authority can close this account to reclaim rent or update the account to contain a different TWAP update.",
        "- `twap`: The actual TWAP update."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "writeAuthority",
            "type": "pubkey"
          },
          {
            "name": "twap",
            "type": {
              "defined": {
                "name": "twapPrice"
              }
            }
          }
        ]
      }
    },
    {
      "name": "verificationLevel",
      "docs": [
        "Pyth price updates are bridged to all blockchains via Wormhole.",
        "Using the price updates on another chain requires verifying the signatures of the Wormhole guardians.",
        "The usual process is to check the signatures for two thirds of the total number of guardians, but this can be cumbersome on Solana because of the transaction size limits,",
        "so we also allow for partial verification.",
        "",
        "This enum represents how much a price update has been verified:",
        "- If `Full`, we have verified the signatures for two thirds of the current guardians.",
        "- If `Partial`, only `num_signatures` guardian signatures have been checked.",
        "",
        "# Warning",
        "Using partially verified price updates is dangerous, as it lowers the threshold of guardians that need to collude to produce a malicious price update."
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "partial",
            "fields": [
              {
                "name": "numSignatures",
                "type": "u8"
              }
            ]
          },
          {
            "name": "full"
          }
        ]
      }
    }
  ]
};
