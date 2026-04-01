import "dotenv/config";
import express, { Request, Response } from "express";
import path from "path";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import authRouter from "./routes/auth";
import uploadRouter from "./routes/upload";
import parseRouter from "./routes/parse";
import computeTaxRouter from "./routes/computeTax";
import aiReviewRouter from "./routes/aiReview";
import sessionsRouter from "./routes/sessions";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { disconnectDB } from "./models/db";

// ─── App Initialisation ───────────────────────────────────────────────────────

const app = express();
const PORT = parseInt(process.env.PORT || "3001", 10);

// Trust Render/Netlify reverse proxy for accurate IP detection
app.set("trust proxy", 1);

// ─── Security Middleware ──────────────────────────────────────────────────────

app.use(
  helmet({
    crossOriginEmbedderPolicy: false, // Needed for some PDF/image workflows
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
      },
    },
  })
);

// ─── CORS ─────────────────────────────────────────────────────────────────────

const allowedOrigins = [
  "https://filetaxai.netlify.app",
  process.env.FRONTEND_URL || "http://localhost:3000",
  "http://localhost:3000",
  "http://localhost:3001",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (Postman, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error(`CORS: Origin '${origin}' not allowed`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
    exposedHeaders: ["X-Request-ID"],
  })
);

// ─── General Middleware ───────────────────────────────────────────────────────

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

if (process.env.NODE_ENV !== "test") {
  app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
}

// ─── Request ID Middleware ────────────────────────────────────────────────────

app.use((req: Request, res: Response, next) => {
  const requestId =
    (req.headers["x-request-id"] as string) ||
    `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  res.setHeader("X-Request-ID", requestId);
  next();
});

// ─── Rate Limiting ────────────────────────────────────────────────────────────

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: "Too many requests. Please try again in 15 minutes.",
      code: "RATE_LIMIT_EXCEEDED",
      statusCode: 429,
    },
  },
  skip: (req) => req.path === "/api/health", // Don't rate-limit health checks
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // Stricter limit for auth endpoints
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: "Too many authentication attempts. Please try again in 15 minutes.",
      code: "AUTH_RATE_LIMIT",
      statusCode: 429,
    },
  },
});

app.use(globalLimiter);

// ─── Health Check ─────────────────────────────────────────────────────────────

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    success: true,
    status: "healthy",
    service: "FileTaxAI API",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ─── Static: local upload fallback (dev only, no Cloudinary) ─────────────────

app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use("/api/auth", authLimiter, authRouter);
app.use("/api/documents", uploadRouter);
app.use("/api/parse", parseRouter);
app.use("/api/compute", computeTaxRouter);
app.use("/api/ai-review", aiReviewRouter);
app.use("/api/sessions", sessionsRouter);

// ─── 404 Handler ─────────────────────────────────────────────────────────────

app.use(notFoundHandler);

// ─── Global Error Handler ─────────────────────────────────────────────────────

app.use(errorHandler);

// ─── Server Start ─────────────────────────────────────────────────────────────

const server = app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════╗
║         FileTaxAI Backend Server              ║
╠═══════════════════════════════════════════════╣
║  Status  : Running                            ║
║  Port    : ${PORT.toString().padEnd(36)}║
║  Env     : ${(process.env.NODE_ENV || "development").padEnd(36)}║
║  FY      : 2024-25 (AY 2025-26)              ║
╚═══════════════════════════════════════════════╝
  `);
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`\n${signal} received. Shutting down gracefully...`);

  server.close(async () => {
    console.log("HTTP server closed.");
    try {
      await disconnectDB();
      console.log("Database connection closed.");
      process.exit(0);
    } catch (err) {
      console.error("Error during shutdown:", err);
      process.exit(1);
    }
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error("Forced shutdown after timeout.");
    process.exit(1);
  }, 10000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason: unknown) => {
  console.error("Unhandled Promise Rejection:", reason);
  // Don't exit in production – let the process continue
  if (process.env.NODE_ENV !== "production") {
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on("uncaughtException", (err: Error) => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});

export default app;
