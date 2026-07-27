"use client";

import { ReactNode, useState } from "react";
import {
  RainbowKitProvider,
  lightTheme,
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
  ...lightTheme({
    accentColor: "#ec3013",
    accentColorForeground: "#ffffff",
    borderRadius: "none",
    fontStack: "system",
    overlayBlur: "small",
  }),
  colors: {
    ...lightTheme().colors,
    accentColor: "#ec3013",
    accentColorForeground: "#ffffff",
    connectButtonBackground: "#f3f2f2",
    connectButtonBackgroundError: "#fde5e0",
    connectButtonInnerBackground: "#eae9e8",
    connectButtonText: "#201e1d",
    connectButtonTextError: "#b22610",
    connectionIndicator: "#ec3013",
    downloadBottomCardBackground: "#f3f2f2",
    downloadTopCardBackground: "#eae9e8",
    error: "#b22610",
    generalBorder: "#d4d2d1",
    generalBorderDim: "#eae9e8",
    menuItemBackground: "#eae9e8",
    modalBackdrop: "rgba(32, 30, 29, 0.5)",
    modalBackground: "#f3f2f2",
    modalBorder: "#d4d2d1",
    modalText: "#201e1d",
    modalTextDim: "#7e7b79",
    modalTextSecondary: "#94918f",
    profileAction: "#eae9e8",
    profileActionHover: "#d4d2d1",
    profileForeground: "#f3f2f2",
    selectedOptionBorder: "#ec3013",
    standby: "#ec3013",
  },
  fonts: {
    body: "Archivo, system-ui, -apple-system, sans-serif",
  },
  radii: {
    actionButton: "0px",
    connectButton: "0px",
    menuButton: "0px",
    modal: "0px",
    modalMobile: "0px",
  },
  shadows: {
    connectButton: "none",
    dialog: "0 8px 32px rgba(32, 30, 29, 0.15)",
    profileDetailsAction: "none",
    selectedOption: "0 0 0 2px #ec3013",
    selectedWallet: "0 0 0 2px #ec3013",
    walletLogo: "none",
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
            appName: "SurveyDeal",
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
