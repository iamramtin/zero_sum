import * as anchor from "@coral-xyz/anchor";

process.env.ANCHOR_PROVIDER_URL =
  process.env.ANCHOR_PROVIDER_URL || "http://localhost:8899";
process.env.ANCHOR_WALLET =
  process.env.ANCHOR_WALLET || `${process.env.HOME}/.config/solana/id.json`;

(async () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const wallet = provider.wallet;
  const publicKey = wallet.publicKey;

  const amountSol = parseFloat(process.argv[2]) || 5; // Default to 5 SOL if no argument is provided
  const amountLamports = amountSol * anchor.web3.LAMPORTS_PER_SOL;

  console.log(`Requesting airdrop for wallet: ${publicKey.toBase58()}`);
  console.log(`Airdrop amount: ${amountSol} SOL`);

  try {
    // Fetch and print the initial balance
    const initialBalance = await provider.connection.getBalance(publicKey);
    console.log(
      `Initial balance: ${initialBalance / anchor.web3.LAMPORTS_PER_SOL} SOL`
    );

    const airdropSignature = await provider.connection.requestAirdrop(
      publicKey,
      amountLamports
    );

    console.log(`Airdrop transaction signature: ${airdropSignature}`);

    // Confirm the transaction using the recommended approach
    const latestBlockhash = await provider.connection.getLatestBlockhash();
    await provider.connection.confirmTransaction({
      signature: airdropSignature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    });

    // Fetch and print the final balance
    const finalBalance = await provider.connection.getBalance(publicKey);
    console.log(
      `Final balance: ${finalBalance / anchor.web3.LAMPORTS_PER_SOL} SOL`
    );
  } catch (error) {
    console.error("Error requesting airdrop:", error);
  }
})();
