// Here we export some useful types and functions for interacting with the Anchor program.
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { Cluster, PublicKey } from "@solana/web3.js";
import ZeroSumIDL from "../target/idl/zero_sum.json";
import type { ZeroSum } from "../target/types/zero_sum";

// Re-export the generated IDL and type
export { ZeroSum, ZeroSumIDL };

// The programId is imported from the program IDL.
export const ZERO_SUM_PROGRAM_ID = new PublicKey(ZeroSumIDL.address);

// This is a helper function to get the ZeroSum Anchor program.
export function getZeroSumProgram(
  provider: AnchorProvider,
  address?: PublicKey
) {
  return new Program(
    {
      ...ZeroSumIDL,
      address: address ? address.toBase58() : ZeroSumIDL.address,
    } as ZeroSum,
    provider
  );
}

// This is a helper function to get the program ID for the ZeroSum program depending on the cluster.
export function getZeroSumProgramId(cluster: Cluster) {
  switch (cluster) {
    case "devnet":
    case "testnet":
      // This is the program ID for the ZeroSum program on devnet and testnet.
      return new PublicKey("Cy59cDTqWRNtNF2x7ESkB1vEuSV2uLW85en5Ph7h1LrU");
    case "mainnet-beta":
    default:
      return ZERO_SUM_PROGRAM_ID;
  }
}
