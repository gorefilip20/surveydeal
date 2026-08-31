"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Search, Star, Users, ChevronDown } from "lucide-react";
import Nav from "@/components/Nav";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

const CATEGORIES = [
  { value: "", label: "All Categories" },
  { value: "CRYPTO_TRADE", label: "Crypto Trade" },
  { value: "FREELANCE", label: "Freelance" },
  { value: "REAL_ESTATE", label: "Real Estate" },
  { value: "DOMAIN_SALE", label: "Domain Sale" },
  { value: "VEHICLE_SALE", label: "Vehicle Sale" },
  { value: "WHOLESALE", label: "Wholesale" },
  { value: "PARTNERSHIP", label: "Partnership" },
  { value: "INFLUENCER", label: "Influencer" },
  { value: "CUSTOM", label: "Custom" },
];

const CATEGORY_COLORS: Record<string, string> = {
  CRYPTO_TRADE: "bg-accent text-white",
  FREELANCE: "bg-blue-600 text-white",
  REAL_ESTATE: "bg-emerald-600 text-white",
  DOMAIN_SALE: "bg-purple-600 text-white",
  VEHICLE_SALE: "bg-amber-600 text-white",
  WHOLESALE: "bg-teal-600 text-white",
  PARTNERSHIP: "bg-indigo-600 text-white",
  INFLUENCER: "bg-pink-600 text-white",
  CUSTOM: "bg-neutral-600 text-white",
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTemplates();
  }, [category]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      const res = await fetch(`${API}/templates?${params}`);
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch {
      setTemplates([]);
    }
    setLoading(false);
  };

  const upvote = async (id: string) => {
    const token = localStorage.getItem("user_token");
    if (!token) return;
    try {
      await fetch(`${API}/templates/${id}/upvote`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      setTemplates((prev) =>
        prev.map((t) => (t.id === id ? { ...t, upvotes: t.upvotes + 1 } : t))
      );
    } catch {}
  };

  const filtered = templates.filter(
    (t) =>
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-bg text-text">
      <Nav />
      <main className="max-w-[1120px] mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-start justify-between mb-8">
          <div>
            <p className="text-xs uppercase tracking-wider font-semibold text-accent mb-1">
              Marketplace
            </p>
            <h1 className="text-3xl font-heading font-extrabold">
              Escrow Templates
            </h1>
            <p className="text-sm opacity-60 mt-1">
              Pre-built escrow templates for every business vertical
            </p>
          </div>
          <Link href="/escrow/create" className="btn btn-primary">
            <ArrowRight className="w-4 h-4" />
            Create Escrow
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
            <input
              type="text"
              placeholder="Search templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="sd-input pl-10 w-full"
            />
          </div>
          <div className="relative">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="sd-input pr-8 appearance-none"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40 pointer-events-none" />
          </div>
        </div>

        {loading ? (
          <p className="text-neutral-500 py-8">Loading templates...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 border-2 border-divider">
            <p className="text-neutral-600 text-lg mb-2">No templates found</p>
            <p className="text-sm opacity-50">
              Try a different category or search term
            </p>
          </div>
        ) : (
          <div className="bg-divider grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[2px]">
            {filtered.map((t) => (
              <div key={t.id} className="bg-bg p-5 flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`tag ${CATEGORY_COLORS[t.category] || "tag-neutral"}`}
                  >
                    {t.category.replace(/_/g, " ")}
                  </span>
                  {t.isOfficial && (
                    <span className="tag tag-accent">OFFICIAL</span>
                  )}
                </div>
                <h3 className="text-base font-heading font-extrabold mb-1">
                  {t.name}
                </h3>
                <p className="text-sm opacity-60 mb-4 flex-1">
                  {t.description}
                </p>
                <div className="space-y-2 mb-4">
                  <p className="text-xs uppercase tracking-wider opacity-50 font-semibold">
                    Milestones
                  </p>
                  {(
                    (typeof t.milestoneTemplates === "string"
                      ? JSON.parse(t.milestoneTemplates)
                      : t.milestoneTemplates) || []
                  )
                    .slice(0, 4)
                    .map((m: any, i: number) => (
                      <div
                        key={i}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="opacity-70 truncate mr-2">
                          {m.description}
                        </span>
                        <span className="font-semibold shrink-0">
                          {m.percentAmount}%
                        </span>
                      </div>
                    ))}
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-divider">
                  <div className="flex items-center gap-3 text-xs opacity-50">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {t.usageCount || 0} uses
                    </span>
                    {t.defaultDeadlineDays && (
                      <span>{t.defaultDeadlineDays}d deadline</span>
                    )}
                  </div>
                  <button
                    onClick={() => upvote(t.id)}
                    className="flex items-center gap-1 text-sm hover:text-accent transition-colors"
                  >
                    <Star className="w-3.5 h-3.5" />
                    {t.upvotes || 0}
                  </button>
                </div>
                <Link
                  href={`/escrow/create?template=${t.id}`}
                  className="btn btn-secondary mt-3 w-full justify-center"
                >
                  Use Template
                </Link>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
