#!/usr/bin/env node

/**
 * Script to check for program ID mismatches between deployed program and IDL
 *
 * Usage:
 *   node check-program-id.js [--url <cluster-url>] [--idl <path-to-idl>] [--update]
 *
 * Options:
 *   --url      RPC URL or shorthand (localhost, devnet, mainnet-beta). Default: localhost
 *   --idl      Path to IDL file. Default: ./target/idl/zero_sum.json
 *   --update   If specified, will update the IDL with the correct program ID
 */

import fs from "fs";
import { execSync } from "child_process";

// Parse command line arguments
const args = process.argv.slice(2);
let url = "localhost";
let idlPath = "./anchor/target/idl/zero_sum.json";
let shouldUpdate = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--url" && args[i + 1]) {
    url = args[i + 1];
    i++;
  } else if (args[i] === "--idl" && args[i + 1]) {
    idlPath = args[i + 1];
    i++;
  } else if (args[i] === "--update") {
    shouldUpdate = true;
  }
}

// Convert shorthand names to URLs
function getClusterUrl(cluster: string): string {
  switch (cluster) {
    case "localhost":
      return "http://127.0.0.1:8899";
    case "devnet":
      return "https://api.devnet.solana.com";
    case "mainnet-beta":
      return "https://api.mainnet-beta.solana.com";
    default:
      return cluster; // Assume it's already a URL
  }
}

// Function to check if program is deployed
async function checkProgramId() {
  try {
    // Read IDL file
    if (!fs.existsSync(idlPath)) {
      console.error(`IDL file not found at ${idlPath}`);
      process.exit(1);
    }

    const idlContent = fs.readFileSync(idlPath, "utf8");
    const idl = JSON.parse(idlContent);

    // Get program ID from IDL
    const idlProgramId = idl?.address;
    if (!idlProgramId) {
      console.error(
        `No program ID found in IDL metadata. This IDL may be incomplete.`
      );
      process.exit(1);
    }

    console.log(`IDL Program ID: ${idlProgramId}`);

    // Get keypair path from the deployment keypair
    const keypairPath = "./anchor/target/deploy/zero_sum-keypair.json";
    if (!fs.existsSync(keypairPath)) {
      console.error(
        `Program keypair file not found at ${keypairPath}. Did you run 'anchor build'?`
      );
      process.exit(1);
    }

    try {
      // Get program ID from keypair
      const programIdCmd = `solana address -k ${keypairPath}`;
      const keypairProgramId = execSync(programIdCmd).toString().trim();
      console.log(`Keypair Program ID: ${keypairProgramId}`);

      // Check if program is deployed
      const clusterUrl = getClusterUrl(url);
      const checkDeployedCmd = `solana program show ${keypairProgramId} --url ${clusterUrl}`;

      try {
        execSync(checkDeployedCmd, { stdio: "pipe" });
        console.log(`Program is deployed at: ${keypairProgramId}`);

        // Check for mismatch
        if (idlProgramId !== keypairProgramId) {
          console.error(
            `⚠️ MISMATCH DETECTED: IDL program ID doesn't match keypair program ID`
          );

          if (shouldUpdate) {
            // Update IDL with correct program ID
            idl.metadata.address = keypairProgramId;
            fs.writeFileSync(idlPath, JSON.stringify(idl, null, 2));
            console.log(
              `✅ Updated IDL with correct program ID: ${keypairProgramId}`
            );

            // If IDL in public directory exists, update that too
            const publicIdlPath = "./public/zero_sum.json";
            if (fs.existsSync(publicIdlPath)) {
              fs.writeFileSync(publicIdlPath, JSON.stringify(idl, null, 2));
              console.log(`✅ Updated public IDL at ${publicIdlPath}`);
            }

            console.log(
              `\nRemember to update your program ID in code as well, if hardcoded!`
            );
          } else {
            console.log(
              `\nRun with --update to update the IDL with the correct program ID.`
            );
          }
          return false;
        } else {
          console.log(`✅ Program IDs match!`);
          return true;
        }
      } catch (error: any) {
        console.error(
          `Program is not deployed at ${keypairProgramId} on ${url}`
        );
        console.log(
          `You may need to deploy your program first: anchor deploy --provider.cluster ${url}`
        );
        return false;
      }
    } catch (error: any) {
      console.error(`Error checking program ID: ${error.message}`);
      return false;
    }
  } catch (error: any) {
    console.error(`Unexpected error: ${error.message}`);
    return false;
  }
}

// Run the main function
checkProgramId();
