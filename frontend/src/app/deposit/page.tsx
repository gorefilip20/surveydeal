"use client";

import { useEffect, useState } from "react";
import Nav from "@/components/Nav";
import { Copy, ShieldAlert } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

type AddressSet = { bnbBep20Usdt: string; tronTrc20Usdt: string; solana: string };

export default function DepositPage() {
  const [addresses, setAddresses] = useState<AddressSet>({ bnbBep20Usdt: "", tronTrc20Usdt: "", solana: "" });
  const [copied, setCopied] = useState("");

  useEffect(() => {
    fetch(`${API}/deposit-addresses`)
      .then((response) => response.json())
      .then((data) => setAddresses(data.addresses || {}))
      .catch(() => {});
  }, []);

  const copy = async (key: string, value: string) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(""), 1800);
  };

  const cards = [
    { key: "bnbBep20Usdt", name: "Tether USDT", network: "BNB Smart Chain / BEP-20", value: addresses.bnbBep20Usdt, explorer: "https://bscscan.com/address/" },
    { key: "tronTrc20Usdt", name: "Tether USDT", network: "TRON / TRC-20", value: addresses.tronTrc20Usdt, explorer: "https://tronscan.org/#/address/" },
    { key: "solana", name: "Solana", network: "Solana network", value: addresses.solana, explorer: "https://solscan.io/account/" },
  ];

  return (
    <div className="min-h-screen bg-bg text-text">
      <Nav />
      <main className="max-w-[900px] mx-auto px-5 sm:px-6 py-10">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.2em] text-accent font-semibold mb-3">Supported deposits</p>
          <h1 className="text-3xl sm:text-5xl font-heading font-extrabold tracking-tight">Deposit crypto</h1>
          <p className="mt-4 max-w-2xl text-base opacity-70">Choose the exact network shown by your exchange or wallet. Address format alone does not guarantee a successful transfer.</p>
        </div>

        <div className="border-2 border-yellow-700 bg-yellow-50 text-yellow-900 p-4 mb-8 flex gap-3 items-start">
          <ShieldAlert className="w-5 h-5 mt-0.5 shrink-0" />
          <p className="text-sm"><strong>Custody warning:</strong> these are shared receiving addresses, not per-escrow contract addresses. They are display-only until custody monitoring, attribution, reconciliation, sweeping, and recovery controls are enabled. For escrow, use the specific verified contract transaction from your escrow page.</p>
        </div>

        <div className="grid gap-5">
          {cards.map((card) => (
            <section key={card.key} className="border-2 border-divider bg-surface p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div><h2 className="font-heading font-extrabold text-lg">{card.name}</h2><p className="text-sm opacity-60 mt-1">{card.network}</p></div>
                <span className="tag tag-neutral">Display only</span>
              </div>
              <div className="bg-bg border-2 border-divider p-4 break-all font-mono text-sm min-h-14">{card.value || "Not configured"}</div>
              {card.value && <div className="mt-4 flex flex-wrap gap-3"><button onClick={() => copy(card.key, card.value)} className="btn btn-secondary"><Copy className="w-4 h-4" />{copied === card.key ? "Copied" : "Copy address"}</button><a className="btn btn-secondary" target="_blank" rel="noreferrer" href={`${card.explorer}${card.value}`}>View explorer</a></div>}
              <p className="mt-4 text-xs opacity-60">Send only the named asset on the named network. Wrong-network transfers may be permanently unrecoverable.</p>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
