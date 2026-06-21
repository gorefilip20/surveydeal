"use client";

import { ReactNode, useState, useEffect } from "react";
import {
  RainbowKitProvider,
  darkTheme,
  type Theme,
} from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { config } from "@/wagmi.config";

import "@rainbow-me/rainbowkit/styles.css";

if (typeof window !== "undefined") {
  const origError = window.onerror;
  window.onerror = (msg, ...args) => {
    if (typeof msg === "string" && msg.includes("Connection interrupted while trying to subscribe")) return true;
    return origError ? origError(msg, ...args) : false;
  };
  window.addEventListener("unhandledrejection", (e) => {
    if (e.reason?.message?.includes("Connection interrupted")) e.preventDefault();
  });
}

const surveydealTheme: Theme = {
  ...darkTheme({
    accentColor: "#10b981",
    accentColorForeground: "#ffffff",
    borderRadius: "medium",
    fontStack: "system",
    overlayBlur: "small",
  }),
  colors: {
    ...darkTheme().colors,
    accentColor: "#10b981",
    accentColorForeground: "#ffffff",
    connectButtonBackground: "#0a0f1a",
    connectButtonBackgroundError: "#7f1d1d",
    connectButtonInnerBackground: "#111827",
    connectButtonText: "#e2e8f0",
    connectButtonTextError: "#fecaca",
    connectionIndicator: "#34d399",
    downloadBottomCardBackground: "#0a0f1a",
    downloadTopCardBackground: "#111827",
    error: "#ef4444",
    generalBorder: "#1e3a3a",
    generalBorderDim: "#0f2020",
    menuItemBackground: "#111827",
    modalBackdrop: "rgba(0, 0, 0, 0.75)",
    modalBackground: "#0a0f1a",
    modalBorder: "#1e3a3a",
    modalText: "#e2e8f0",
    modalTextDim: "#94a3b8",
    modalTextSecondary: "#64748b",
    profileAction: "#111827",
    profileActionHover: "#1e293b",
    profileForeground: "#0a0f1a",
    selectedOptionBorder: "#10b981",
    standby: "#3b82f6",
  },
  fonts: {
    body: "Inter, system-ui, -apple-system, sans-serif",
  },
  radii: {
    actionButton: "8px",
    connectButton: "10px",
    menuButton: "8px",
    modal: "16px",
    modalMobile: "16px",
  },
  shadows: {
    connectButton: "0 4px 14px rgba(16, 185, 129, 0.15)",
    dialog: "0 8px 32px rgba(0, 0, 0, 0.6)",
    profileDetailsAction: "0 2px 6px rgba(0, 0, 0, 0.3)",
    selectedOption: "0 0 0 2px #10b981",
    selectedWallet: "0 0 0 2px #10b981",
    walletLogo: "0 2px 8px rgba(0, 0, 0, 0.2)",
  },
};

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60,
            gcTime: 1000 * 60 * 5,
            retry: 2,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={surveydealTheme}
          modalSize="compact"
          appInfo={{
            appName: "Surveydeal",
            learnMoreUrl: "https://surveydeal.io/docs",
          }}
          showRecentTransactions={true}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
