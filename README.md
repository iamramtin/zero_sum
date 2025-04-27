# Zero Sum (Price Prediction Game)

A decentralized game on Solana where players predict ETH price movements. Leverage Chainlink oracle price feeds to bet on the future of ETH.

## Game Overview

In Zero Sum, two players compete by predicting whether the ETH price will increase or decrease by 5% first:

- First player creates a game with a 1000 USDC entrance fee and predicts price direction
- Second player joins with 1000 USDC and automatically takes the opposite position
- When ETH price moves 5% in either direction, the winning player can claim both entry fees
- Both players can verify results transparently through Chainlink price oracles

## Key Features

- **Fair Entry System**: Second player can only join if ETH price hasn't moved more than 1% from game creation
- **Withdrawal Protection**: Initiator can withdraw funds only before someone joins
- **Dispute Resolution**: Automatic draw option after 24 hr timeout
- **On-chain Verification**: Winner verification and fund transfers secured by Solana blockchain
- **Real-time Updates**: Live price feeds and game status

## Getting Started

### Prerequisites
- Node.js 16+
- Solana CLI tools
- Anchor framework (for development)
- Solana wallet
- Optionally: Two Solana wallets with SOL for transactions and USDC tokens (for development)

### Docker Setup (Recommended)
```bash
docker build -t zero-sum-app .   
docker run -p 3000:3000 zero-sum-app
```

### Manual Setup
```bash
npm install
npm run build
npm run start # or npm run dev for development
```

### Development Commands

#### Anchor Framework Commands
```bash
# Build the Solana program
anchor build  

# Deploy to devnet
anchor deploy --provider.cluster devnet --provider.wallet [wallet path]

# Run tests
anchor test --skip-deploy --provider.cluster devnet tests/zero_sum.spec.ts

# Redeploy with new program ID
npm run redeploy
```

#### Seed Test Data
```bash
npm run seed
```

This script creates test games with configurable parameters for frontend testing.

**Requirements for seed script:**
- Two wallet key files in the wallets directory (id1.json, id2.json)
- Both wallets need SOL for transaction fees (0.1 SOL minimum)
- Both wallets need USDC tokens from the faucet: https://spl-token-faucet.com/?token-name=USDC
- USDC tokens must be on the mint: Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr

## Technology Stack

- **Frontend**: Next.js, React, TypeScript, Tailwind CSS
- **Blockchain**: Solana, Anchor Framework
- **Price Data**: Chainlink Oracle Feeds
- **Token Standard**: SPL Tokens (USDC)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.