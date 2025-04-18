/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/zero_sum.json`.
 */
export type ZeroSum = {
  address: "Cy59cDTqWRNtNF2x7ESkB1vEuSV2uLW85en5Ph7h1LrU";
  metadata: {
    name: "zeroSum";
    version: "0.1.0";
    spec: "0.1.0";
    description: "Created with Anchor";
  };
  instructions: [
    {
      name: "priceFeed";
      discriminator: [146, 197, 37, 70, 210, 196, 173, 100];
      accounts: [
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "priceUpdate";
        }
      ];
      args: [];
    },
    {
      name: "send";
      discriminator: [102, 251, 20, 187, 65, 75, 12, 69];
      accounts: [
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "destination";
          docs: ["CHECK : Just a destination"];
          writable: true;
        },
        {
          name: "priceUpdate";
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        }
      ];
      args: [
        {
          name: "amountInUsd";
          type: "u64";
        }
      ];
    },
    {
      name: "sendUsingTwap";
      discriminator: [24, 255, 70, 199, 23, 25, 63, 114];
      accounts: [
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "destination";
          docs: ["CHECK : Just a destination"];
          writable: true;
        },
        {
          name: "twapUpdate";
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        }
      ];
      args: [
        {
          name: "amountInUsd";
          type: "u64";
        },
        {
          name: "twapWindowSeconds";
          type: "u64";
        }
      ];
    }
  ];
  accounts: [
    {
      name: "priceUpdateV2";
      discriminator: [34, 241, 35, 99, 157, 126, 244, 205];
    },
    {
      name: "twapUpdate";
      discriminator: [104, 192, 188, 72, 246, 166, 12, 81];
    }
  ];
  events: [
    {
      name: "priceFetched";
      discriminator: [207, 104, 233, 65, 92, 239, 79, 86];
    },
    {
      name: "transferExecuted";
      discriminator: [8, 128, 224, 132, 112, 216, 192, 35];
    }
  ];
  errors: [
    {
      code: 6000;
      name: "invalidPriceFeed";
      msg: "The Pyth price feed account is invalid.";
    },
    {
      code: 6001;
      name: "stalePriceFeed";
      msg: "The Pyth price feed is stale.";
    },
    {
      code: 6002;
      name: "mathOverflow";
      msg: "Arithmetic overflow occurred during a calculation.";
    },
    {
      code: 6003;
      name: "invalidPriceValue";
      msg: "Invalid price value conversion.";
    },
    {
      code: 6004;
      name: "unsupportedPositiveExponent";
      msg: "Positive exponent values are not supported.";
    }
  ];
  types: [
    {
      name: "priceFeedMessage";
      repr: {
        kind: "c";
      };
      type: {
        kind: "struct";
        fields: [
          {
            name: "feedId";
            docs: [
              "`FeedId` but avoid the type alias because of compatibility issues with Anchor's `idl-build` feature."
            ];
            type: {
              array: ["u8", 32];
            };
          },
          {
            name: "price";
            type: "i64";
          },
          {
            name: "conf";
            type: "u64";
          },
          {
            name: "exponent";
            type: "i32";
          },
          {
            name: "publishTime";
            docs: ["The timestamp of this price update in seconds"];
            type: "i64";
          },
          {
            name: "prevPublishTime";
            docs: [
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
            ];
            type: "i64";
          },
          {
            name: "emaPrice";
            type: "i64";
          },
          {
            name: "emaConf";
            type: "u64";
          }
        ];
      };
    },
    {
      name: "priceFetched";
      docs: ["* EVENTS"];
      type: {
        kind: "struct";
        fields: [
          {
            name: "price";
            type: "i64";
          },
          {
            name: "conf";
            type: "u64";
          },
          {
            name: "exponent";
            type: "i32";
          }
        ];
      };
    },
    {
      name: "priceUpdateV2";
      docs: [
        "A price update account. This account is used by the Pyth Receiver program to store a verified price update from a Pyth price feed.",
        "It contains:",
        "- `write_authority`: The write authority for this account. This authority can close this account to reclaim rent or update the account to contain a different price update.",
        "- `verification_level`: The [`VerificationLevel`] of this price update. This represents how many Wormhole guardian signatures have been verified for this price update.",
        "- `price_message`: The actual price update.",
        "- `posted_slot`: The slot at which this price update was posted."
      ];
      type: {
        kind: "struct";
        fields: [
          {
            name: "writeAuthority";
            type: "pubkey";
          },
          {
            name: "verificationLevel";
            type: {
              defined: {
                name: "verificationLevel";
              };
            };
          },
          {
            name: "priceMessage";
            type: {
              defined: {
                name: "priceFeedMessage";
              };
            };
          },
          {
            name: "postedSlot";
            type: "u64";
          }
        ];
      };
    },
    {
      name: "transferExecuted";
      type: {
        kind: "struct";
        fields: [
          {
            name: "amountInLamports";
            type: "u64";
          },
          {
            name: "to";
            type: "pubkey";
          }
        ];
      };
    },
    {
      name: "twapPrice";
      docs: [
        "The time weighted average price & conf for a feed over the window [start_time, end_time].",
        "This type is used to persist the calculated TWAP in TwapUpdate accounts on Solana."
      ];
      type: {
        kind: "struct";
        fields: [
          {
            name: "feedId";
            type: {
              array: ["u8", 32];
            };
          },
          {
            name: "startTime";
            type: "i64";
          },
          {
            name: "endTime";
            type: "i64";
          },
          {
            name: "price";
            type: "i64";
          },
          {
            name: "conf";
            type: "u64";
          },
          {
            name: "exponent";
            type: "i32";
          },
          {
            name: "downSlotsRatio";
            docs: [
              "Ratio out of 1_000_000, where a value of 1_000_000 represents",
              "all slots were missed and 0 represents no slots were missed."
            ];
            type: "u32";
          }
        ];
      };
    },
    {
      name: "twapUpdate";
      docs: [
        "A time weighted average price account.",
        "This account is used by the Pyth Receiver program to store a TWAP update from a Pyth price feed.",
        "TwapUpdates can only be created after the client has verified the VAAs via the Wormhole contract.",
        "Check out `target_chains/solana/cli/src/main.rs` for an example of how to do this.",
        "",
        "It contains:",
        "- `write_authority`: The write authority for this account. This authority can close this account to reclaim rent or update the account to contain a different TWAP update.",
        "- `twap`: The actual TWAP update."
      ];
      type: {
        kind: "struct";
        fields: [
          {
            name: "writeAuthority";
            type: "pubkey";
          },
          {
            name: "twap";
            type: {
              defined: {
                name: "twapPrice";
              };
            };
          }
        ];
      };
    },
    {
      name: "verificationLevel";
      docs: [
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
      ];
      type: {
        kind: "enum";
        variants: [
          {
            name: "partial";
            fields: [
              {
                name: "numSignatures";
                type: "u8";
              }
            ];
          },
          {
            name: "full";
          }
        ];
      };
    }
  ];
};
