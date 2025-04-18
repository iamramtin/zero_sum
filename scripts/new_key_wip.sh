solana-keygen new --no-bip39-passphrase --outfile ./burner.json 
solana-keygen pubkey ./burner.json
solana airdrop 20 $(solana-keygen pubkey ./burner.json) --url https://api.devnet.solana.com / localhost
solana confirm -v 4Wy6ddNUVnZpsDPm2xsce3u1CBwqWfpsc1fwz7E3CVin8sfo9uCvskbAxCfKwGLGW8dYfd65rkywcqUeHqQNW4BX