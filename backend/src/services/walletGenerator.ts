import { ethers } from "ethers";
import * as crypto from "crypto";

// ── Configuration ────────────────────────────────────
const MNEMONIC = process.env.GENERATION_MNEMONIC || process.env.BIP32_MNEMONIC;
const BASE_DERIVATION_PATH = "m/44'/60'/0'/0"; // BIP44 for ETH/compatible chains
let derivationCounter = 0;

// ── Supported Networks ───────────────────────────────
export type NetworkType = "evm" | "svm" | "tvm";

export function getNetworkType(chainId: number): NetworkType {
  // EVM chains
  const evmChains = [1, 56, 137, 42161, 8453, 43114, 10, 250, 25243];
  if (evmChains.includes(chainId)) return "evm";
  // Solana
  if (chainId === 999999) return "svm"; // placeholder
  // TRON
  if (chainId === 728126428) return "tvm"; // placeholder
  return "evm"; // default
}

// ── EVM Wallet Generation ───────────────────────────

function generateEVMDepositWallet(): { address: string; privateKey: string; mnemonic?: string; derivationIndex: number } {
  if (MNEMONIC) {
    derivationCounter++;
    const path = `${BASE_DERIVATION_PATH}/${derivationCounter}`;
    const wallet = ethers.HDNodeWallet.fromMnemonic(
      ethers.Mnemonic.fromPhrase(MNEMONIC),
      path
    );
    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
      derivationIndex: derivationCounter,
    };
  }

  // Random wallet generation (less secure — no backup)
  const wallet = ethers.Wallet.createRandom();
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    derivationIndex: 0,
  };
}

// ── Solana Wallet Generation (placeholder) ───────────

function generateSolanaDepositWallet(): { address: string; privateKey: string; derivationIndex: number } {
  // Solana uses ed25519 — need @solana/web3.js in production
  // For now, generate a random keypair placeholder
  const randomBytes = crypto.randomBytes(32);
  return {
    address: `solana-placeholder-${randomBytes.toString("hex").slice(0, 16)}`,
    privateKey: randomBytes.toString("hex"),
    derivationIndex: 0,
  };
}

// ── TRON Wallet Generation (placeholder) ─────────────

function generateTronDepositWallet(): { address: string; privateKey: string; derivationIndex: number } {
  // TRON uses secp256k1 like ETH but with base58check addresses
  // Need tronweb in production
  const randomBytes = crypto.randomBytes(32);
  return {
    address: `tron-placeholder-${randomBytes.toString("hex").slice(0, 16)}`,
    privateKey: randomBytes.toString("hex"),
    derivationIndex: 0,
  };
}

// ── Main Export ──────────────────────────────────────

/**
 * Generate a deposit wallet for the given chain.
 * Returns address, private key, and derivation info.
 * Private key should be encrypted before storage in production.
 */
export async function generateDepositWallet(
  chainId: number
): Promise<{
  address: string;
  privateKey: string;
  network: NetworkType;
  derivationIndex: number;
}> {
  const network = getNetworkType(chainId);

  switch (network) {
    case "evm": {
      const wallet = generateEVMDepositWallet();
      return {
        address: wallet.address,
        privateKey: wallet.privateKey,
        network: "evm",
        derivationIndex: wallet.derivationIndex,
      };
    }
    case "svm": {
      const wallet = generateSolanaDepositWallet();
      return {
        address: wallet.address,
        privateKey: wallet.privateKey,
        network: "svm",
        derivationIndex: wallet.derivationIndex,
      };
    }
    case "tvm": {
      const wallet = generateTronDepositWallet();
      return {
        address: wallet.address,
        privateKey: wallet.privateKey,
        network: "tvm",
        derivationIndex: wallet.derivationIndex,
      };
    }
    default:
      throw new Error(`Unsupported network type for chain ${chainId}`);
  }
}

/**
 * Derive an EVM address from an index using the HD wallet.
 * Useful for generating a unique deposit address per escrow.
 */
export function deriveAddressFromIndex(index: number): string {
  if (!MNEMONIC) {
    throw new Error("MNEMONIC required for deterministic derivation");
  }
  const path = `${BASE_DERIVATION_PATH}/${index}`;
  const wallet = ethers.HDNodeWallet.fromMnemonic(
    ethers.Mnemonic.fromPhrase(MNEMONIC),
    path
  );
  return wallet.address;
}

/**
 * Get the next derivation index.
 * In production, query the database for the highest used index.
 */
export function getNextDerivationIndex(): number {
  derivationCounter++;
  return derivationCounter;
}
