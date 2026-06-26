import { ethers } from "ethers";
import * as bip39 from "bip39";
import { HDKey } from "@scure/bip32";
import * as nacl from "tweetnacl";
import bs58 from "bs58";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

const MASTER_SEED_KEY = "HD_MASTER_SEED";

type NetworkType = "EVM" | "SOLANA" | "TRON";

interface GeneratedWallet {
  address: string;
  privateKey: string;
  derivationPath: string;
  derivationIndex: number;
  network: NetworkType;
}

function getNetworkType(chainId: number): NetworkType {
  const SOLANA_CHAIN_IDS = [900, 901];
  const TRON_CHAIN_IDS = [728126428, 2494104990];

  if (SOLANA_CHAIN_IDS.includes(chainId)) return "SOLANA";
  if (TRON_CHAIN_IDS.includes(chainId)) return "TRON";
  return "EVM";
}

function getCoinType(network: NetworkType): number {
  switch (network) {
    case "EVM": return 60;
    case "SOLANA": return 501;
    case "TRON": return 195;
  }
}

async function getOrCreateMasterSeed(): Promise<string> {
  let config = await prisma.protocolConfig.findUnique({
    where: { key: MASTER_SEED_KEY },
  });

  if (!config) {
    const mnemonic = bip39.generateMnemonic(256);
    config = await prisma.protocolConfig.create({
      data: {
        key: MASTER_SEED_KEY,
        value: mnemonic,
        description: "HD wallet master seed for deposit address derivation. KEEP SECRET.",
      },
    });
  }

  return config.value;
}

async function getNextDerivationIndex(): Promise<number> {
  const key = "DERIVATION_INDEX_COUNTER";

  const result = await prisma.$transaction(async (tx) => {
    let config = await tx.protocolConfig.findUnique({ where: { key } });

    if (!config) {
      config = await tx.protocolConfig.create({
        data: {
          key,
          value: "0",
          description: "Global derivation index counter for HD wallet generation",
        },
      });
    }

    const currentIndex = parseInt(config.value, 10);
    const nextIndex = currentIndex + 1;

    await tx.protocolConfig.update({
      where: { key },
      data: { value: nextIndex.toString() },
    });

    return currentIndex;
  });

  return result;
}

function deriveEvmWallet(seed: Buffer, index: number): { address: string; privateKey: string; path: string } {
  const path = `m/44'/60'/0'/0/${index}`;
  const master = HDKey.fromMasterSeed(seed);
  const child = master.derive(path);

  if (!child.privateKey) {
    throw new Error(`Failed to derive EVM private key at ${path}`);
  }

  const wallet = new ethers.Wallet(Buffer.from(child.privateKey).toString("hex"));
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    path,
  };
}

function deriveSolanaWallet(seed: Buffer, index: number): { address: string; privateKey: string; path: string } {
  const path = `m/44'/501'/${index}'/0'`;
  const master = HDKey.fromMasterSeed(seed);
  const child = master.derive(path);

  if (!child.privateKey) {
    throw new Error(`Failed to derive Solana private key at ${path}`);
  }

  const keypair = nacl.sign.keyPair.fromSeed(child.privateKey);
  const address = bs58.encode(keypair.publicKey);
  const privateKey = bs58.encode(keypair.secretKey);

  return { address, privateKey, path };
}

function deriveTronWallet(seed: Buffer, index: number): { address: string; privateKey: string; path: string } {
  const path = `m/44'/195'/0'/0/${index}`;
  const master = HDKey.fromMasterSeed(seed);
  const child = master.derive(path);

  if (!child.privateKey) {
    throw new Error(`Failed to derive TRON private key at ${path}`);
  }

  const privKeyHex = Buffer.from(child.privateKey).toString("hex");
  const wallet = new ethers.Wallet(privKeyHex);
  const evmAddress = wallet.address;

  const addressBytes = Buffer.from(evmAddress.slice(2), "hex");
  const tronPrefix = Buffer.from([0x41]);
  const rawAddress = Buffer.concat([tronPrefix, addressBytes]);

  const hash1 = crypto.createHash("sha256").update(rawAddress).digest();
  const hash2 = crypto.createHash("sha256").update(hash1).digest();
  const checksum = hash2.subarray(0, 4);

  const fullAddress = Buffer.concat([rawAddress, checksum]);
  const tronAddress = bs58.encode(fullAddress);

  return {
    address: tronAddress,
    privateKey: privKeyHex,
    path,
  };
}

export async function generateDepositWallet(chainId: number): Promise<GeneratedWallet> {
  const mnemonic = await getOrCreateMasterSeed();
  const seed = await bip39.mnemonicToSeed(mnemonic);
  const seedBuffer = Buffer.from(seed);
  const network = getNetworkType(chainId);
  const index = await getNextDerivationIndex();

  let result: { address: string; privateKey: string; path: string };

  switch (network) {
    case "EVM":
      result = deriveEvmWallet(seedBuffer, index);
      break;
    case "SOLANA":
      result = deriveSolanaWallet(seedBuffer, index);
      break;
    case "TRON":
      result = deriveTronWallet(seedBuffer, index);
      break;
  }

  return {
    address: result.address,
    privateKey: result.privateKey,
    derivationPath: result.path,
    derivationIndex: index,
    network,
  };
}

export async function recoverWallet(chainId: number, derivationIndex: number): Promise<GeneratedWallet> {
  const mnemonic = await getOrCreateMasterSeed();
  const seed = await bip39.mnemonicToSeed(mnemonic);
  const seedBuffer = Buffer.from(seed);
  const network = getNetworkType(chainId);

  let result: { address: string; privateKey: string; path: string };

  switch (network) {
    case "EVM":
      result = deriveEvmWallet(seedBuffer, derivationIndex);
      break;
    case "SOLANA":
      result = deriveSolanaWallet(seedBuffer, derivationIndex);
      break;
    case "TRON":
      result = deriveTronWallet(seedBuffer, derivationIndex);
      break;
  }

  return {
    address: result.address,
    privateKey: result.privateKey,
    derivationPath: result.path,
    derivationIndex,
    network,
  };
}

export { getNetworkType, NetworkType };
