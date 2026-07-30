"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Wallet, Loader2, CheckCircle } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

interface WalletLoginProps {
  onAuthenticated: (token: string) => void;
}

export default function WalletLogin({ onAuthenticated }: WalletLoginProps) {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [status, setStatus] = useState<"idle" | "signing" | "verifying" | "done" | "error">("idle");
  const [error, setError] = useState("");

  const authenticate = useCallback(async () => {
    if (!address || !isConnected) return;

    setStatus("signing");
    setError("");

    try {
      const nonceRes = await fetch(`${API}/auth/nonce/${address}`);
      const nonceData = await nonceRes.json();
      if (!nonceRes.ok) throw new Error(nonceData.error || "Failed to get nonce");

      const message = `Sign this message to authenticate with SurveyDeal.\n\nWallet: ${address}\nNonce: ${nonceData.nonce}`;

      const signature = await signMessageAsync({ message });

      setStatus("verifying");

      const loginRes = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: address, signature, message }),
      });

      const loginData = await loginRes.json();
      if (!loginRes.ok) throw new Error(loginData.error || "Login failed");

      localStorage.setItem("user_token", loginData.token);
      setStatus("done");
      onAuthenticated(loginData.token);
    } catch (err: any) {
      setStatus("error");
      if (err.message?.includes("User rejected") || err.message?.includes("denied")) {
        setError("Signature rejected. Please try again.");
      } else {
        setError(err.message || "Authentication failed");
      }
    }
  }, [address, isConnected, signMessageAsync, onAuthenticated]);

  useEffect(() => {
    const stored = localStorage.getItem("user_token");
    if (stored && isConnected) {
      onAuthenticated(stored);
    }
  }, [isConnected, onAuthenticated]);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="w-16 h-16 bg-accent flex items-center justify-center mx-auto mb-6">
            <Wallet className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-heading font-extrabold text-text mb-2">Connect Your Wallet</h2>
          <p className="text-sm opacity-60 mb-8">
            Connect your EVM wallet to access the SurveyDeal escrow platform.
          </p>
          <ConnectButton />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-6">
        <div className="w-16 h-16 bg-accent flex items-center justify-center mx-auto mb-6">
          {status === "done" ? (
            <CheckCircle className="w-8 h-8 text-white" />
          ) : status === "signing" || status === "verifying" ? (
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          ) : (
            <Wallet className="w-8 h-8 text-white" />
          )}
        </div>

        <h2 className="text-2xl font-heading font-extrabold text-text mb-2">
          {status === "signing" ? "Sign Message" : status === "verifying" ? "Verifying..." : status === "done" ? "Authenticated" : "Authenticate"}
        </h2>

        <p className="text-sm opacity-60 mb-2">
          Wallet: {address?.slice(0, 6)}...{address?.slice(-4)}
        </p>

        {status === "signing" && (
          <p className="text-sm opacity-60 mb-6">
            Please sign the message in your wallet to verify ownership.
          </p>
        )}

        {status === "verifying" && (
          <p className="text-sm opacity-60 mb-6">Verifying signature...</p>
        )}

        {error && (
          <div className="border-2 border-accent bg-accent/5 text-accent px-4 py-3 mb-6 text-sm">
            {error}
          </div>
        )}

        {(status === "idle" || status === "error") && (
          <button onClick={authenticate} className="btn btn-primary mt-4">
            Sign to Authenticate
          </button>
        )}
      </div>
    </div>
  );
}
