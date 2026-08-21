import { ethers } from "ethers";
import { prisma } from "../lib/prisma";
import { EVM_CHAIN_IDS } from "../lib/chains";
import { encrypt } from "./cryptoUtils";

const MNEMONIC = process.env.GENERATION_MNEMONIC || process.env.BIP32_MNEMONIC;
const BASE_DERIVATION_PATH = "m/44'/60'/0'/0";

let derivationCounter = -1;

async function getNextDerivationIndex(): Promise<number> {
  if (derivationCounter >= 0) {
    derivationCounter++;
    return derivationCounter;
  }

  const maxEscrow = await prisma.escrow.aggregate({
    _max: { derivationIndex: true },
  });

  derivationCounter = (maxEscrow._max.derivationIndex ?? 0) + 1;
  return derivationCounter;
}

export async function generateDepositWallet(
  chainId: number
): Promise<{
  address: string;
  encryptedPrivateKey: string;
  derivationIndex: number;
}> {
  if (!EVM_CHAIN_IDS.includes(chainId)) {
    throw new Error(
      `Chain ${chainId} is not supported. Only EVM chains are available: ${EVM_CHAIN_IDS.join(", ")}`
    );
  }

  if (!MNEMONIC) {
    throw new Error(
      "GENERATION_MNEMONIC must be set for deposit wallet generation"
    );
  }

  const index = await getNextDerivationIndex();
  const path = `${BASE_DERIVATION_PATH}/${index}`;
  const wallet = ethers.HDNodeWallet.fromMnemonic(
    ethers.Mnemonic.fromPhrase(MNEMONIC),
    path
  );

  const encryptedPrivateKey = encrypt(wallet.privateKey);

  return {
    address: wallet.address,
    encryptedPrivateKey,
    derivationIndex: index,
  };
}

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
