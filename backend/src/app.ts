import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { prisma } from "./lib/prisma";
import { SUPPORTED_CHAINS } from "./lib/chains";
import adminRouter from "./controllers/adminController";
import escrowRouter from "./controllers/escrowController";
import dexscreenerRouter from "./controllers/dexscreenerController";
import chatRouter from "./controllers/chatController";
import transferRouter from "./controllers/transferController";
import templateRouter from "./controllers/templateController";
import publicFeedRouter from "./controllers/publicFeedController";
import oneLinkRouter from "./controllers/oneLinkController";
import userFeaturesRouter from "./controllers/userFeaturesController";
import { startBlockchainListener, stopBlockchainListener } from "./services/blockchainListener";
import { apiLimiter } from "./middleware/rateLimiter";
const app = express();

const PORT = parseInt(process.env.BACKEND_PORT || "5000", 10);
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const NODE_ENV = process.env.NODE_ENV || "development";

// ── Trust Proxy (required behind nginx for rate limiting & IP detection) ──
app.set("trust proxy", 1);

// ── CORS Configuration ───────────────────────────────
const allowedOrigins = [FRONTEND_URL];
if (NODE_ENV === "development") {
  allowedOrigins.push(
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000"
  );
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"],
  credentials: true,
  maxAge: 86400,
}));

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: { maxAge: 31536000, includeSubDomains: true },
}));
app.use(compression());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));
app.use(apiLimiter);

// ── Request Logging ─────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  const timestamp = new Date().toISOString();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 500 ? "ERROR" : res.statusCode >= 400 ? "WARN" : "INFO";
    console.log(
      `[${timestamp}] ${logLevel} ${req.method} ${req.path} ${res.statusCode} ${duration}ms ${req.ip || "-"}`
    );
  });

  next();
});

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
  res.json({ chains: SUPPORTED_CHAINS });
});

// ── API Routes ───────────────────────────────────────
app.use("/api/admin", adminRouter);
app.use("/api/admin", transferRouter);
app.use("/api", escrowRouter);
app.use("/api/dexscreener", dexscreenerRouter);
app.use("/api/chat", chatRouter);

// ── Feature Routes ──────────────────────────────────
app.use("/api/templates", templateRouter);
app.use("/api/feed", publicFeedRouter);
app.use("/api/deal", oneLinkRouter);
app.use("/api/user", userFeaturesRouter);

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
