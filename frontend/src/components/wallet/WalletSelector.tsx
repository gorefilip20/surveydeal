"use client";

import React, { useState, useEffect } from "react";

const CHAINS = [
  { id: "ETHEREUM", name: "Ethereum", icon: "🔷", chainId: 1, nativeCurrency: "ETH", color: "#627EEA" },
  { id: "BNB_CHAIN", name: "BNB Chain", icon: "🟡", chainId: 56, nativeCurrency: "BNB", color: "#F0B90B" },
  { id: "POLYGON", name: "Polygon", icon: "🟣", chainId: 137, nativeCurrency: "MATIC", color: "#8247E5" },
  { id: "ARBITRUM", name: "Arbitrum", icon: "🔵", chainId: 42161, nativeCurrency: "ETH", color: "#28A0F0" },
  { id: "BASE", name: "Base", icon: "🔷", chainId: 8453, nativeCurrency: "ETH", color: "#0052FF" },
  { id: "AVALANCHE", name: "Avalanche", icon: "🔺", chainId: 43114, nativeCurrency: "AVAX", color: "#E84142" },
  { id: "OPTIMISM", name: "Optimism", icon: "🔴", chainId: 10, nativeCurrency: "ETH", color: "#FF0420" },
  { id: "FANTOM", name: "Fantom", icon: "👻", chainId: 250, nativeCurrency: "FTM", color: "#1969FF" },
];

interface Wallet {
  id: string;
  address: string;
  network: string;
  label?: string;
  isPreferred: boolean;
}

interface Props {
  wallets: Wallet[];
  onSelect: (chain: typeof CHAINS[0], wallet?: Wallet) => void;
  selectedChain?: string;
}

export default function WalletSelector({ wallets, onSelect, selectedChain }: Props) {
  const [showAddWallet, setShowAddWallet] = useState(false);
  const [newAddress, setNewAddress] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [selectedChainForNew, setSelectedChainForNew] = useState(CHAINS[0].id);

  const getWalletsForChain = (chainId: string) =>
    wallets.filter((w) => w.network === chainId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Select Network</h3>
        <button
          onClick={() => setShowAddWallet(!showAddWallet)}
          className="text-sm text-blue-400 hover:text-blue-300 transition"
        >
          + Add Wallet
        </button>
      </div>

      {/* Chain Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {CHAINS.map((chain) => {
          const chainWallets = getWalletsForChain(chain.id);
          const isSelected = selectedChain === chain.id;
          return (
            <button
              key={chain.id}
              onClick={() => onSelect(chain, chainWallets[0])}
              className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 ${
                isSelected
                  ? "border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20"
                  : "border-gray-700 bg-gray-800/50 hover:border-gray-500 hover:bg-gray-800"
              }`}
            >
              <span className="text-2xl">{chain.icon}</span>
              <span className="text-sm font-medium text-white">{chain.name}</span>
              <span className="text-xs text-gray-400">{chain.nativeCurrency}</span>
              {chainWallets.length > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-green-400 rounded-full" />
              )}
              {chainWallets.length > 1 && (
                <span className="text-xs text-gray-500">{chainWallets.length} wallets</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Wallet List for Selected Chain */}
      {selectedChain && (
        <div className="mt-4 p-4 bg-gray-800/30 rounded-xl border border-gray-700">
          <h4 className="text-sm font-medium text-gray-300 mb-3">
            Wallets on {CHAINS.find((c) => c.id === selectedChain)?.name}
          </h4>
          {getWalletsForChain(selectedChain).length === 0 ? (
            <p className="text-sm text-gray-500">No wallets added for this network yet.</p>
          ) : (
            <div className="space-y-2">
              {getWalletsForChain(selectedChain).map((w) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg border border-gray-700"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-xs text-blue-400">
                      {w.address.slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm text-white font-mono">
                        {w.address.slice(0, 6)}...{w.address.slice(-4)}
                      </p>
                      {w.label && (
                        <p className="text-xs text-gray-400">{w.label}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {w.isPreferred && (
                      <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">
                        Preferred
                      </span>
                    )}
                    <button className="text-xs text-gray-400 hover:text-white transition">
                      Select
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Wallet Form */}
      {showAddWallet && (
        <div className="mt-4 p-4 bg-gray-800/30 rounded-xl border border-gray-700">
          <h4 className="text-sm font-medium text-gray-300 mb-3">Add New Wallet</h4>
          <div className="space-y-3">
            <select
              value={selectedChainForNew}
              onChange={(e) => setSelectedChainForNew(e.target.value)}
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
            >
              {CHAINS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name} ({c.nativeCurrency})
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Wallet address (0x...)"
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm font-mono"
            />
            <input
              type="text"
              placeholder="Label (optional, e.g. 'Trading Wallet')"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (newAddress) {
                    // TODO: Call API to add wallet
                    setNewAddress("");
                    setNewLabel("");
                    setShowAddWallet(false);
                  }
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 rounded-lg transition"
              >
                Add Wallet
              </button>
              <button
                onClick={() => setShowAddWallet(false)}
                className="px-4 bg-gray-700 hover:bg-gray-600 text-white text-sm py-2 rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
