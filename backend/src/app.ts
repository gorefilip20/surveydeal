import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { PrismaClient } from "@prisma/client";
import adminRouter from "./controllers/adminController";
import escrowRouter from "./controllers/escrowController";
import { startBlockchainListener, stopBlockchainListener } from "./services/blockchainListener";

const prisma = new PrismaClient();

const app = express();

const PORT = parseInt(process.env.BACKEND_PORT || "5000", 10);
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const NODE_ENV = process.env.NODE_ENV || "development";

// ──────────────────────────────────────────────
//  CORS CONFIGURATION
// ──────────────────────────────────────────────

const allowedOrigins = [
  FRONTEND_URL,
  "http://localhost:3000",
  "http://localhost:3001",
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

// ──────────────────────────────────────────────
//  GLOBAL MIDDLEWARE
// ──────────────────────────────────────────────

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use(compression());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

// ──────────────────────────────────────────────
//  REQUEST LOGGING (development)
// ──────────────────────────────────────────────

if (NODE_ENV === "development") {
  app.use((req, _res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
    next();
  });
}

// ──────────────────────────────────────────────
//  HEALTH CHECK
// ──────────────────────────────────────────────

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
  } catch (err) {
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      database: "disconnected",
    });
  }
});

// ──────────────────────────────────────────────
//  ROUTE MOUNTING
// ──────────────────────────────────────────────

app.use("/api/admin", adminRouter);
app.use("/api", escrowRouter);

// ──────────────────────────────────────────────
//  404 HANDLER
// ──────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: "The requested endpoint does not exist",
  });
});

// ──────────────────────────────────────────────
//  GLOBAL ERROR HANDLER
// ──────────────────────────────────────────────

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(`[ERROR] ${err.message}`);

  if (err.message.startsWith("CORS:")) {
    res.status(403).json({ error: "CORS policy violation", details: err.message });
    return;
  }

  res.status(500).json({
    error: "Internal Server Error",
    ...(NODE_ENV === "development" && { details: err.message, stack: err.stack }),
  });
});

// ──────────────────────────────────────────────
//  SERVER STARTUP
// ──────────────────────────────────────────────

async function startServer(): Promise<void> {
  try {
    await prisma.$connect();
    console.log("[Surveydeal] Database connection established");

    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log("");
      console.log("══════════════════════════════════════════════");
      console.log("  SURVEYDEAL ADMIN BACKEND");
      console.log("══════════════════════════════════════════════");
      console.log(`  Environment : ${NODE_ENV}`);
      console.log(`  Port        : ${PORT}`);
      console.log(`  Frontend    : ${FRONTEND_URL}`);
      console.log(`  Health      : http://localhost:${PORT}/api/health`);
      console.log(`  Admin API   : http://localhost:${PORT}/api/admin`);
      console.log("══════════════════════════════════════════════");
      console.log("");
    });

    if (process.env.ENABLE_BLOCKCHAIN_LISTENER !== "false") {
      await startBlockchainListener();
      console.log("[Surveydeal] Blockchain event listener started");
    }

    const shutdown = async (signal: string) => {
      console.log(`\n[Surveydeal] ${signal} received. Shutting down gracefully...`);

      server.close(async () => {
        await stopBlockchainListener();
        await prisma.$disconnect();
        console.log("[Surveydeal] Server stopped");
        process.exit(0);
      });

      setTimeout(() => {
        console.error("[Surveydeal] Forceful shutdown after timeout");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (err) {
    console.error("[Surveydeal] Failed to start server:", err);
    await prisma.$disconnect();
    process.exit(1);
  }
}

startServer();

export default app;
