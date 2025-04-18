/**
 * Seed Script
 *
 * This script creates test charities from different wallets for frontend testing.
 * It uses the Anchor framework and Solana web3.js to interact with your deployed
 * Charity program on a local Solana validator.
 *
 * Usage:
 *   - Run without arguments to create charities and make test donations
 *   - Run with --delete to remove all created charities
 *   - Run with --fund "Charity Name" --amount 2.5 to donate to a specific charity
 *   - Run with --fund "Charity Name" --amount 2.5 --authority <pubkey> to donate to an external charity
 *
 * Example:
 *   - npm run seed                                                            - Create charities and make test donations
 *   - npm run seed -- --delete                                                - Delete all created charities
 *   - npm run seed -- --fund "Charity Name"                                   - Donate 1 SOL to a specific charity
 *   - npm run seed -- --fund "Charity Name" --amount 2.5                      - Donate 2.5 SOL to a specific charity
 *   - npm run seed -- --fund "Charity Name" --amount 2.5 --authority <pubkey> - Donate to an external charity
 */
import * as anchor from "@coral-xyz/anchor";
import { BN } from "bn.js";
import { Program } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  Connection,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

// Configuration constants
const CONFIG = {
  RPC_URL: "http://localhost:8899",
  CHARITY_AIRDROP_AMOUNT: 5,
  DONOR_AIRDROP_AMOUNT: 10,
  WALLET_DIR: path.join(path.dirname("wallets/temp")),
  // Add a delay between airdrop and transaction to ensure funds are available
  AIRDROP_CONFIRMATION_DELAY: 2000, // 2 seconds
};

// Charity configurations
const CHARITIES = [
  {
    name: "Save The Ocean",
    description:
      "Protecting marine ecosystems through grassroots and global campaigns.",
  },
  {
    name: "Books For All",
    description:
      "Providing access to educational resources for underserved communities.",
  },
  {
    name: "Code4Change",
    description:
      "Empowering youth through coding and digital literacy programs.",
  },
  {
    name: "Green Earth Initiative",
    description: "Promoting sustainable living and environmental protection.",
  },
  {
    name: "Health For All",
    description:
      "Providing essential healthcare services to underserved populations.",
  },
  {
    name: "Arts & Culture Fund",
    description: "Supporting local artists and cultural preservation efforts.",
  },
];

// Type definitions
interface CharityData {
  name: string;
  description: string;
}

interface CharityAccount {
  authority: PublicKey;
  name: string;
  description: string;
  donationsInLamports: anchor.BN;
  donationCount: anchor.BN;
  paused: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date;
  withdrawnAt: Date;
  vaultBump: anchor.BN;
}

interface WalletInfo {
  index: number;
  publicKey: string;
  secretKeyFile: string;
}

/**
 * Sleep utility for delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Loads and returns the IDL for the charity program
 */
function loadIDL() {
  try {
    // path from root
    const idlPath = "anchor/target/idl/charity.json";
    const idlContent = fs.readFileSync(idlPath, "utf8");
    return JSON.parse(idlContent);
  } catch (error: any) {
    console.error("Error reading IDL file:", error);
    throw new Error(`Failed to load IDL: ${error.message}`);
  }
}

/**
 * Creates directory if it doesn't exist
 */
function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  }
}

/**
 * Saves a keypair to a JSON file
 */
function saveKeypairToFile(keypair: Keypair, filePath: string): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(Array.from(keypair.secretKey)));
  } catch (error: any) {
    throw new Error(`Failed to save keypair to ${filePath}: ${error.message}`);
  }
}

/**
 * Loads a keypair from a JSON file
 */
function loadKeypairFromFile(filePath: string): Keypair {
  try {
    const keypairData = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return Keypair.fromSecretKey(new Uint8Array(keypairData));
  } catch (error: any) {
    throw new Error(
      `Failed to load keypair from ${filePath}: ${error.message}`
    );
  }
}

/**
 * Request SOL airdrop for a keypair
 */
async function requestAirdrop(
  connection: Connection,
  pubkey: PublicKey,
  amountInSol: number
): Promise<string> {
  try {
    const signature = await connection.requestAirdrop(
      pubkey,
      amountInSol * LAMPORTS_PER_SOL
    );

    // Wait for confirmation with multiple retries
    let retries = 5;
    let confirmed = false;

    while (retries > 0 && !confirmed) {
      // Get latest blockhash for confirmation
      const latestBlockhash = await connection.getLatestBlockhash();

      try {
        await connection.confirmTransaction(
          { signature, ...latestBlockhash },
          "confirmed"
        );
        confirmed = true;
      } catch (e) {
        retries--;
        await sleep(1000); // Wait a second before retry
        if (retries === 0) throw e;
      }
    }

    // Add delay after confirmation to ensure the network has fully processed it
    await sleep(CONFIG.AIRDROP_CONFIRMATION_DELAY);

    // Verify the balance was actually updated
    const balance = await connection.getBalance(pubkey);
    if (balance < amountInSol * LAMPORTS_PER_SOL) {
      throw new Error(
        `Airdrop confirmed but balance not updated (${
          balance / LAMPORTS_PER_SOL
        } SOL)`
      );
    }

    return signature;
  } catch (error: any) {
    throw new Error(`Airdrop failed: ${error.message}`);
  }
}

/**
 * Ensures a wallet has sufficient funds for an operation
 */
async function ensureWalletFunded(
  connection: Connection,
  keypair: Keypair,
  requiredAmountInSol: number
): Promise<void> {
  const balance = await connection.getBalance(keypair.publicKey);
  const requiredLamports = requiredAmountInSol * LAMPORTS_PER_SOL;

  if (balance < requiredLamports) {
    const fundAmount = requiredLamports - balance + 5 * LAMPORTS_PER_SOL; // Extra cushion
    const signature = await requestAirdrop(
      connection,
      keypair.publicKey,
      fundAmount / LAMPORTS_PER_SOL
    );

    // Double-check balance after airdrop to ensure it worked
    const newBalance = await connection.getBalance(keypair.publicKey);

    Logger.success(
      `Funded wallet ${keypair.publicKey.toString().slice(0, 8)}... with ${
        fundAmount / LAMPORTS_PER_SOL
      } SOL (tx: ${signature.slice(0, 8)}..., balance: ${
        newBalance / LAMPORTS_PER_SOL
      } SOL)`
    );
  } else {
    Logger.info(
      `Wallet ${keypair.publicKey
        .toString()
        .slice(0, 8)}... already has sufficient funds`
    );
  }
}

/**
 * Creates a charity on-chain
 */
async function createCharity(
  connection: Connection,
  program: Program<any>,
  authorityKeypair: Keypair,
  charityData: CharityData
): Promise<{ pda: PublicKey; signature: string }> {
  try {
    // Derive charity PDA
    const [charityPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("charity"),
        authorityKeypair.publicKey.toBuffer(),
        Buffer.from(charityData.name),
      ],
      program.programId
    );

    // Create charity account
    const tx = await (program as any).methods
      .createCharity(charityData.name, charityData.description)
      .accounts({
        authority: authorityKeypair.publicKey,
      })
      .signers([authorityKeypair])
      .rpc();

    return { pda: charityPda, signature: tx };
  } catch (error: any) {
    throw new Error(
      `Failed to create charity "${charityData.name}": ${error.message}`
    );
  }
}

/**
 * Makes a donation to a charity
 */
async function makeDonation(
  connection: Connection,
  program: Program<any>,
  donorKeypair: Keypair,
  charityPda: PublicKey,
  amountInLamports: number | anchor.BN
): Promise<string> {
  try {
    const donationAmount =
      typeof amountInLamports === "number"
        ? new BN(amountInLamports)
        : amountInLamports;

    return await (program as any).methods
      .donateSol(donationAmount)
      .accounts({
        donor: donorKeypair.publicKey,
        charity: charityPda,
      })
      .signers([donorKeypair])
      .rpc();
  } catch (error: any) {
    throw new Error(`Donation failed: ${error.message}`);
  }
}

/**
 * Gets the charity PDA from authority and name
 */
function getCharityPda(
  programId: PublicKey,
  authority: PublicKey,
  charityName: string
): PublicKey {
  const [charityPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("charity"), authority.toBuffer(), Buffer.from(charityName)],
    programId
  );
  return charityPda;
}

/**
 * Fetch charity account data
 */
async function fetchCharityData(
  program: Program<any>,
  charityPda: PublicKey
): Promise<CharityAccount> {
  try {
    return await (program as any).account.charity.fetch(charityPda);
  } catch (error: any) {
    throw new Error(`Failed to fetch charity data: ${error.message}`);
  }
}

/**
 * Delete a charity
 */
async function deleteCharity(
  program: Program<any>,
  authorityKeypair: Keypair,
  charityPda: PublicKey,
  recipientPubkey: PublicKey
): Promise<string> {
  try {
    return await (program as any).methods
      .deleteCharity()
      .accounts({
        charity: charityPda,
        recipient: recipientPubkey,
      } as any) // Cast to `any` to bypass TypeScript warning
      .signers([authorityKeypair])
      .rpc();
  } catch (error: any) {
    throw new Error(`Failed to delete charity: ${error.message}`);
  }
}

/**
 * Logger utility with color support
 */
const Logger = {
  info: (message: string) => console.log(`\x1b[36m${message}\x1b[0m`),
  success: (message: string) => console.log(`\x1b[32m${message}\x1b[0m`),
  warn: (message: string) => console.log(`\x1b[33m${message}\x1b[0m`),
  error: (message: string) => console.log(`\x1b[31m${message}\x1b[0m`),
};

/**
 * Setup wallets for charities
 */
async function setupWallets(
  connection: Connection,
  charityCount: number
): Promise<Keypair[]> {
  Logger.info(`Setting up ${charityCount} wallets for charities...`);

  ensureDirectoryExists(CONFIG.WALLET_DIR);

  // Generate authority keypairs for each charity
  const authorityKeypairs = Array(charityCount)
    .fill(0)
    .map(() => Keypair.generate());

  // Save wallet information
  const walletInfo: WalletInfo[] = authorityKeypairs.map((keypair, index) => ({
    index,
    publicKey: keypair.publicKey.toString(),
    secretKeyFile: `wallet-${index}.json`,
  }));

  fs.writeFileSync(
    path.join(CONFIG.WALLET_DIR, "wallet-info.json"),
    JSON.stringify(walletInfo, null, 2)
  );

  // Save each keypair to a file
  authorityKeypairs.forEach((keypair, index) => {
    saveKeypairToFile(
      keypair,
      path.join(CONFIG.WALLET_DIR, `wallet-${index}.json`)
    );
  });

  Logger.success(
    `Generated ${authorityKeypairs.length} keypairs and saved to ${CONFIG.WALLET_DIR}`
  );

  // Fund each keypair with SOL
  Logger.info("Funding keypairs with SOL...");

  for (let i = 0; i < authorityKeypairs.length; i++) {
    const keypair = authorityKeypairs[i];
    try {
      await ensureWalletFunded(
        connection,
        keypair,
        CONFIG.CHARITY_AIRDROP_AMOUNT
      );
    } catch (error: any) {
      Logger.error(`Failed to fund wallet ${i}: ${error.message}`);
    }
  }

  return authorityKeypairs;
}

/**
 * Set up donor wallet
 */
async function setupDonorWallet(connection: Connection): Promise<Keypair> {
  Logger.info("Setting up donor wallet...");

  const donorKeypair = Keypair.generate();
  saveKeypairToFile(
    donorKeypair,
    path.join(CONFIG.WALLET_DIR, "donor-wallet.json")
  );

  // Fund donor with SOL
  try {
    await ensureWalletFunded(
      connection,
      donorKeypair,
      CONFIG.DONOR_AIRDROP_AMOUNT
    );
    Logger.success(
      `Funded donor wallet (${donorKeypair.publicKey
        .toString()
        .slice(0, 8)}...) with ${CONFIG.DONOR_AIRDROP_AMOUNT} SOL`
    );
    return donorKeypair;
  } catch (error: any) {
    Logger.error(`Failed to fund donor wallet: ${error.message}`);
    throw error;
  }
}

/**
 * Load existing donor wallet or create a new one
 */
async function getOrCreateDonorWallet(
  connection: Connection,
  requiredFunds: number
): Promise<Keypair> {
  const donorWalletPath = path.join(CONFIG.WALLET_DIR, "donor-wallet.json");

  if (fs.existsSync(donorWalletPath)) {
    try {
      const donorKeypair = loadKeypairFromFile(donorWalletPath);
      Logger.info(
        `Loaded existing donor wallet: ${donorKeypair.publicKey
          .toString()
          .slice(0, 8)}...`
      );

      // Ensure it has enough funds
      await ensureWalletFunded(connection, donorKeypair, requiredFunds);
      return donorKeypair;
    } catch (error) {
      Logger.warn(`Failed to load donor wallet, creating a new one: ${error}`);
    }
  }

  // Create and fund a new donor wallet
  const donorKeypair = Keypair.generate();
  saveKeypairToFile(donorKeypair, donorWalletPath);

  await ensureWalletFunded(connection, donorKeypair, requiredFunds);
  Logger.success(
    `Created new donor wallet: ${donorKeypair.publicKey
      .toString()
      .slice(0, 8)}...`
  );

  return donorKeypair;
}

/**
 * Create all charities and log results
 */
async function createAllCharities(
  connection: Connection,
  program: Program<any>,
  authorityKeypairs: Keypair[],
  charities: CharityData[]
): Promise<Map<string, PublicKey>> {
  Logger.info("\nCreating charities...");

  const charityPdas = new Map<string, PublicKey>();

  for (let i = 0; i < charities.length; i++) {
    const charity = charities[i];
    const authorityKeypair = authorityKeypairs[i];

    try {
      const { pda, signature } = await createCharity(
        connection,
        program,
        authorityKeypair,
        charity
      );

      charityPdas.set(charity.name, pda);

      Logger.success(
        `Created charity ${i}: "${charity.name}" (PDA: ${pda
          .toString()
          .slice(0, 8)}...)`
      );
      Logger.info(`  Transaction: ${signature}`);
      Logger.info(
        `  Authority: ${authorityKeypair.publicKey.toString().slice(0, 8)}...`
      );
    } catch (error: any) {
      Logger.error(
        `Failed to create charity ${i} "${charity.name}": ${error.message}`
      );
    }
  }

  return charityPdas;
}

/**
 * Make test donations to charities
 */
async function makeTestDonations(
  connection: Connection,
  program: Program<any>,
  donorKeypair: Keypair,
  charityPdas: Map<string, PublicKey>,
  charities: CharityData[]
): Promise<void> {
  Logger.info("\nMaking test donations...");

  for (let i = 0; i < charities.length; i++) {
    const charity = charities[i];
    const charityPda = charityPdas.get(charity.name);

    if (!charityPda) {
      Logger.warn(`Skipping donation to "${charity.name}" - PDA not found`);
      continue;
    }

    try {
      // Generate a random donation amount between 0.1 and 5 SOL
      const donationAmount = Math.floor(
        Math.random() * 4 * LAMPORTS_PER_SOL + 0.1 * LAMPORTS_PER_SOL
      );

      const tx = await makeDonation(
        connection,
        program,
        donorKeypair,
        charityPda,
        donationAmount
      );

      Logger.success(`Made donation to charity ${i}: "${charity.name}"`);
      Logger.info(`  Amount: ${donationAmount / LAMPORTS_PER_SOL} SOL`);
      Logger.info(`  Transaction: ${tx}`);

      // Fetch updated charity info
      const updatedCharity = await fetchCharityData(program, charityPda);
      Logger.info(
        `  New total: ${
          updatedCharity.donationsInLamports.toNumber() / LAMPORTS_PER_SOL
        } SOL`
      );
    } catch (error: any) {
      Logger.error(
        `Failed to donate to charity ${i} "${charity.name}": ${error.message}`
      );
    }
  }
}

/**
 * Fund a specific charity by name
 */
async function fundSpecificCharity(
  connection: Connection,
  program: Program<any>,
  charityName: string,
  amountInSol: number
): Promise<void> {
  Logger.info(
    `Attempting to fund charity "${charityName}" with ${amountInSol} SOL...`
  );

  const walletInfoPath = path.join(CONFIG.WALLET_DIR, "wallet-info.json");
  if (!fs.existsSync(walletInfoPath)) {
    throw new Error(
      "Wallet information not found. Run the seed script first to create charities."
    );
  }

  // Read wallet information
  const walletInfo: WalletInfo[] = JSON.parse(
    fs.readFileSync(walletInfoPath, "utf8")
  );

  // Find charity in our list
  const charityIndex = CHARITIES.findIndex((c) => c.name === charityName);
  if (charityIndex === -1) {
    throw new Error(
      `Charity "${charityName}" not found in the list of known charities`
    );
  }

  if (charityIndex >= walletInfo.length) {
    throw new Error("Authority wallet not found for this charity");
  }

  // Get donor wallet with sufficient funds
  const donorKeypair = await getOrCreateDonorWallet(
    connection,
    amountInSol + 0.1 // Extra for fees
  );

  // Load the authority keypair
  const authorityKeypair = loadKeypairFromFile(
    path.join(CONFIG.WALLET_DIR, `wallet-${charityIndex}.json`)
  );

  // Get the charity PDA
  const charityPda = getCharityPda(
    program.programId,
    authorityKeypair.publicKey,
    charityName
  );

  try {
    // Verify the charity exists
    const charity = await fetchCharityData(program, charityPda);
    Logger.info("Found charity:");
    Logger.info(`  Name: ${charity.name}`);
    Logger.info(`  Authority: ${charity.authority.toString().slice(0, 8)}...`);
    Logger.info(
      `  Current donations: ${
        charity.donationsInLamports.toNumber() / LAMPORTS_PER_SOL
      } SOL`
    );

    // Make the donation
    const tx = await makeDonation(
      connection,
      program,
      donorKeypair,
      charityPda,
      amountInSol * LAMPORTS_PER_SOL
    );

    Logger.success(`Made donation to charity "${charityName}"`);
    Logger.info(`  Amount: ${amountInSol} SOL`);
    Logger.info(`  Transaction: ${tx}`);

    // Fetch updated charity info
    const updatedCharity = await fetchCharityData(program, charityPda);
    Logger.info(
      `  New total: ${
        updatedCharity.donationsInLamports.toNumber() / LAMPORTS_PER_SOL
      } SOL`
    );
  } catch (error: any) {
    throw new Error(
      `Failed to fund charity "${charityName}": ${error.message}`
    );
  }
}

/**
 * Fund an external charity (one created outside this script)
 */
async function fundExternalCharity(
  connection: Connection,
  program: Program<any>,
  charityName: string,
  amountInSol: number,
  authorityPubkeyStr: string
): Promise<void> {
  Logger.info(
    `Attempting to fund external charity "${charityName}" with ${amountInSol} SOL...`
  );

  let authorityPubkey: PublicKey;
  try {
    authorityPubkey = new PublicKey(authorityPubkeyStr);
  } catch (error) {
    throw new Error(`Invalid authority public key: ${error}`);
  }

  ensureDirectoryExists(CONFIG.WALLET_DIR);

  // Get donor wallet with sufficient funds
  const donorKeypair = await getOrCreateDonorWallet(
    connection,
    amountInSol + 0.1 // Extra for fees
  );

  // Get the charity PDA
  const charityPda = getCharityPda(
    program.programId,
    authorityPubkey,
    charityName
  );

  try {
    // Verify the charity exists
    const charity = await fetchCharityData(program, charityPda);

    // Ensure we found the right charity
    if (charity.name !== charityName) {
      throw new Error(
        `Found charity with different name: "${charity.name}" vs "${charityName}"`
      );
    }

    Logger.info("Found external charity:");
    Logger.info(`  Name: ${charity.name}`);
    Logger.info(`  Authority: ${charity.authority.toString().slice(0, 8)}...`);
    Logger.info(
      `  Current donations: ${
        charity.donationsInLamports.toNumber() / LAMPORTS_PER_SOL
      } SOL`
    );

    // Make the donation
    const tx = await makeDonation(
      connection,
      program,
      donorKeypair,
      charityPda,
      amountInSol * LAMPORTS_PER_SOL
    );

    Logger.success(`Made donation to charity "${charityName}"`);
    Logger.info(`  Amount: ${amountInSol} SOL`);
    Logger.info(`  Transaction: ${tx}`);

    // Fetch updated charity info
    const updatedCharity = await fetchCharityData(program, charityPda);
    Logger.info(
      `  New total: ${
        updatedCharity.donationsInLamports.toNumber() / LAMPORTS_PER_SOL
      } SOL`
    );
  } catch (error: any) {
    throw new Error(
      `Failed to fund external charity "${charityName}": ${error.message}`
    );
  }
}

/**
 * Delete all charities created by the seed script
 */
async function deleteAllCharities(
  connection: Connection,
  program: Program<any>
): Promise<void> {
  Logger.info("Deleting all charities...");

  if (!fs.existsSync(CONFIG.WALLET_DIR)) {
    throw new Error(
      "Wallet directory not found. Run the seed script first to create charities."
    );
  }

  // Keep track of successfully deleted charities
  let deleteCount = 0;

  // Create recipient for any remaining funds
  const recipientKeypair = Keypair.generate();

  // Try to find all wallet files in the directory
  const walletFiles = fs
    .readdirSync(CONFIG.WALLET_DIR)
    .filter(
      (file) =>
        file.startsWith("wallet-") &&
        file.endsWith(".json") &&
        !isNaN(parseInt(file.split("-")[1].split(".")[0]))
    );

  // Sort wallet files numerically
  walletFiles.sort((a, b) => {
    const numA = parseInt(a.split("-")[1].split(".")[0]);
    const numB = parseInt(b.split("-")[1].split(".")[0]);
    return numA - numB;
  });

  Logger.info(`Found ${walletFiles.length} wallet files`);

  // Load all the charity authorities
  const authorityKeypairs: Keypair[] = [];
  for (const walletFile of walletFiles) {
    try {
      const keypair = loadKeypairFromFile(
        path.join(CONFIG.WALLET_DIR, walletFile)
      );
      authorityKeypairs.push(keypair);
    } catch (error) {
      Logger.error(`Failed to load ${walletFile}: ${error}`);
    }
  }

  Logger.info(`Loaded ${authorityKeypairs.length} authority keypairs`);

  // Create a list of all possible charity names
  const allCharityNames = CHARITIES.map((c) => c.name);

  // For each authority keypair, try all charity names
  for (let i = 0; i < authorityKeypairs.length; i++) {
    const authorityKeypair = authorityKeypairs[i];

    for (const charityName of allCharityNames) {
      try {
        // Get charity PDA
        const charityPda = getCharityPda(
          program.programId,
          authorityKeypair.publicKey,
          charityName
        );

        // Check if charity exists
        await fetchCharityData(program, charityPda);

        // Delete charity
        const tx = await deleteCharity(
          program,
          authorityKeypair,
          charityPda,
          recipientKeypair.publicKey
        );

        Logger.success(
          `Deleted charity: "${charityName}" (Authority: ${authorityKeypair.publicKey
            .toString()
            .slice(0, 8)}...)`
        );
        Logger.info(`  Transaction: ${tx}`);
        deleteCount++;
      } catch (error: any) {
        // Skip logging for charities that don't exist
        if (!error.message.includes("Failed to fetch charity data")) {
          Logger.warn(
            `Couldn't delete "${charityName}" for authority ${authorityKeypair.publicKey
              .toString()
              .slice(0, 8)}...: ${error.message}`
          );
        }
      }
    }
  }

  Logger.success(`\nDeleted ${deleteCount} charities successfully`);

  // Check balance of recipient
  try {
    const recipientAccount = await connection.getAccountInfo(
      recipientKeypair.publicKey
    );
    if (recipientAccount) {
      Logger.info(
        `Recipient received a total of ${
          recipientAccount.lamports / LAMPORTS_PER_SOL
        } SOL from deleted charities`
      );
    }
  } catch (error) {
    Logger.error(`Failed to check recipient balance: ${error}`);
  }
}

/**
 * Parse command line arguments and execute the appropriate function
 */
async function parseCommandLineArgs(): Promise<void> {
  const args = process.argv.slice(2);

  // Configure the connection to the local Solana validator
  const connection = new Connection(CONFIG.RPC_URL, "confirmed");

  // Load IDL
  const idl = loadIDL();

  // Create default provider with a dummy wallet (will be replaced when needed)
  const dummyKeypair = Keypair.generate();
  console.log(`Authority public key: ${dummyKeypair.publicKey.toString()}`);

  // 4. Request an airdrop for the authority
  console.log("Requesting airdrop for authority...");
  // Wait for confirmation
  const latestBlockhash = await connection.getLatestBlockhash();

  const airdropSignature = await connection.requestAirdrop(
    dummyKeypair.publicKey,
    5 * LAMPORTS_PER_SOL
  );

  await connection.confirmTransaction(
    { signature: airdropSignature, ...latestBlockhash },
    "confirmed"
  );

  console.log("Airdrop confirmed");

  // Additional delay to ensure the transaction is fully processed
  await sleep(2000);

  // 5. Check the balance to confirm
  const balance = await connection.getBalance(dummyKeypair.publicKey);
  console.log(`Authority balance: ${balance / LAMPORTS_PER_SOL} SOL`);

  if (balance < 1 * LAMPORTS_PER_SOL) {
    throw new Error("Airdrop failed - insufficient balance");
  }

  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(dummyKeypair),
    { commitment: "confirmed" }
  );

  // Initialize program with IDL
  const program = new Program(idl as any, provider) as Program<any>;

  // Check for command line flags
  if (args.includes("--delete")) {
    await deleteAllCharities(connection, program);
    return;
  }

  if (args.includes("--fund")) {
    const charityNameIndex = args.indexOf("--fund") + 1;
    const amountIndex = args.indexOf("--amount") + 1;
    const authorityIndex = args.indexOf("--authority") + 1;

    if (
      charityNameIndex >= args.length ||
      args[charityNameIndex].startsWith("--")
    ) {
      throw new Error("Please specify a charity name after --fund");
    }

    const charityName = args[charityNameIndex];
    let amount = 1.0; // Default to 1 SOL

    if (
      amountIndex > 0 &&
      amountIndex < args.length &&
      !args[amountIndex].startsWith("--")
    ) {
      amount = parseFloat(args[amountIndex]);
      if (isNaN(amount)) {
        throw new Error("Invalid amount specified");
      }
    }

    // Check if authority is provided (for external charities)
    if (
      authorityIndex > 0 &&
      authorityIndex < args.length &&
      !args[authorityIndex].startsWith("--")
    ) {
      const authorityPubkey = args[authorityIndex];
      await fundExternalCharity(
        connection,
        program,
        charityName,
        amount,
        authorityPubkey
      );
    } else {
      await fundSpecificCharity(connection, program, charityName, amount);
    }
    return;
  }

  // If no command line flags, run the main seed script
  await runSeedScript(connection, program);
}

/**
 * Main entry point for the script
 */
async function main(): Promise<void> {
  try {
    await parseCommandLineArgs();
    process.exit(0);
  } catch (error: any) {
    Logger.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();

/**
 * Main seed script function
 */
async function runSeedScript(
  connection: Connection,
  program: Program<any>
): Promise<void> {
  try {
    // Display header
    Logger.info("=".repeat(70));
    Logger.info(
      " SOLANA CHARITY SEED SCRIPT ".padStart(45, "=").padEnd(70, "=")
    );
    Logger.info("=".repeat(70));

    // Setup authority keypairs for each charity
    const authorityKeypairs = await setupWallets(connection, CHARITIES.length);

    // Create all charities
    const charityPdas = await createAllCharities(
      connection,
      program,
      authorityKeypairs,
      CHARITIES
    );

    // Setup donor wallet
    const donorKeypair = await setupDonorWallet(connection);

    // Make test donations
    await makeTestDonations(
      connection,
      program,
      donorKeypair,
      charityPdas,
      CHARITIES
    );

    Logger.success("\nSeed script completed successfully!");
  } catch (error: any) {
    Logger.error(`Seed script failed: ${error.message}`);
    process.exit(1);
  }
}
