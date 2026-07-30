import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { PrismaClient } from "@prisma/client";
import adminRouter from "./controllers/adminController";
import escrowRouter from "./controllers/escrowController";
import dexscreenerRouter from "./controllers/dexscreenerController";
import chatRouter from "./controllers/chatController";
import transferRouter from "./controllers/transferController";
import { startBlockchainListener, stopBlockchainListener } from "./services/blockchainListener";
import { apiLimiter } from "./middleware/rateLimiter";

const prisma = new PrismaClient();
const app = express();

const PORT = parseInt(process.env.BACKEND_PORT || "5000", 10);
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const NODE_ENV = process.env.NODE_ENV || "development";

// ── CORS Configuration ───────────────────────────────
const allowedOrigins = [
  FRONTEND_URL,
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  maxAge: 86400,
}));

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(compression());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));
app.use(apiLimiter);

// ── Request Logging (development) ────────────────────
if (NODE_ENV === "development") {
  app.use((req, _res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
    next();
  });
}

// ── Health Check ─────────────────────────────────────
app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      environment: NODE_ENV,
      database: "connected",
      uptime: process.uptime(),
    });
  } catch {
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      database: "disconnected",
    });
  }
});

// ── Supported Chains (public) ────────────────────────
app.get("/api/chains", (_req, res) => {
  res.json({
    chains: [
      { id: "ETHEREUM", name: "Ethereum", chainId: 1, type: "evm", nativeCurrency: "ETH", blockExplorer: "https://etherscan.io" },
      { id: "BNB_CHAIN", name: "BNB Chain", chainId: 56, type: "evm", nativeCurrency: "BNB", blockExplorer: "https://bscscan.com" },
      { id: "POLYGON", name: "Polygon", chainId: 137, type: "evm", nativeCurrency: "MATIC", blockExplorer: "https://polygonscan.com" },
      { id: "ARBITRUM", name: "Arbitrum One", chainId: 42161, type: "evm", nativeCurrency: "ETH", blockExplorer: "https://arbiscan.io" },
      { id: "BASE", name: "Base", chainId: 8453, type: "evm", nativeCurrency: "ETH", blockExplorer: "https://basescan.org" },
      { id: "AVALANCHE", name: "Avalanche C-Chain", chainId: 43114, type: "evm", nativeCurrency: "AVAX", blockExplorer: "https://snowtrace.io" },
      { id: "OPTIMISM", name: "Optimism", chainId: 10, type: "evm", nativeCurrency: "ETH", blockExplorer: "https://optimistic.etherscan.io" },
      { id: "FANTOM", name: "Fantom", chainId: 250, type: "evm", nativeCurrency: "FTM", blockExplorer: "https://ftmscan.com" },
    ],
  });
});

// ── API Routes ───────────────────────────────────────
app.use("/api/admin", adminRouter);
app.use("/api/admin", transferRouter);
app.use("/api", escrowRouter);
app.use("/api/dexscreener", dexscreenerRouter);
app.use("/api/chat", chatRouter);

// ── 404 Handler ──────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: "The requested endpoint does not exist",
  });
});

// ── Global Error Handler ─────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(`[ERROR] ${err.message}`);

  if (err.message.startsWith("CORS:")) {
    res.status(403).json({ error: "CORS policy violation", details: err.message });
    return;
  }

  res.status(500).json({
    error: "Internal Server Error",
    ...(NODE_ENV === "development" && { details: err.message }),
  });
});

// ── Server Startup ───────────────────────────────────
async function startServer(): Promise<void> {
  try {
    await prisma.$connect();
    console.log("[SurveyDeal] Database connection established");

    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log("");
      console.log("═══════════════════════════════════════════");
      console.log("  SURVEYDEAL MULTI-CHAIN ESCROW API");
      console.log("═══════════════════════════════════════════");
      console.log(`  Environment : ${NODE_ENV}`);
      console.log(`  Port        : ${PORT}`);
      console.log(`  Frontend    : ${FRONTEND_URL}`);
      console.log(`  Health      : http://localhost:${PORT}/api/health`);
      console.log("═══════════════════════════════════════════");
      console.log("");
    });

    if (process.env.ENABLE_BLOCKCHAIN_LISTENER !== "false") {
      await startBlockchainListener();
      console.log("[SurveyDeal] Multi-chain blockchain listener started");
    }

    const shutdown = async (signal: string) => {
      console.log(`\n[SurveyDeal] ${signal} received. Shutting down gracefully...`);
      server.close(async () => {
        await stopBlockchainListener();
        await prisma.$disconnect();
        console.log("[SurveyDeal] Server stopped");
        process.exit(0);
      });

      setTimeout(() => {
        console.error("[SurveyDeal] Forced shutdown after timeout");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

  } catch (err) {
    console.error("[SurveyDeal] Failed to start server:", err);
    await prisma.$disconnect();
    process.exit(1);
  }
}

startServer();

export default app;
