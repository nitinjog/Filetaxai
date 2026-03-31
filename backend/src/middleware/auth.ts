import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppError } from "./errorHandler";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface JWTPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

// Extend Express Request to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not set");
  }
  return secret;
}

function extractTokenFromHeader(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0]?.toLowerCase() !== "bearer") return null;
  return parts[1] || null;
}

// ─── Generate Token ───────────────────────────────────────────────────────────

export function generateToken(
  userId: string,
  email: string,
  expiresIn: string = process.env.JWT_EXPIRES_IN || "7d"
): string {
  const secret = getJWTSecret();
  const payload: JWTPayload = { userId, email };

  return jwt.sign(payload, secret, {
    expiresIn,
    issuer: "filetaxai",
    audience: "filetaxai-users",
  } as jwt.SignOptions);
}

// ─── Verify Token Middleware ──────────────────────────────────────────────────

export function verifyToken(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const token = extractTokenFromHeader(req);

  if (!token) {
    throw new AppError("No authentication token provided", 401);
  }

  try {
    const secret = getJWTSecret();
    const decoded = jwt.verify(token, secret, {
      issuer: "filetaxai",
      audience: "filetaxai-users",
    }) as JWTPayload;

    req.user = decoded;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError("Token expired. Please login again.", 401);
    }
    if (err instanceof jwt.JsonWebTokenError) {
      throw new AppError("Invalid authentication token", 401);
    }
    throw new AppError("Authentication failed", 401);
  }
}

// ─── Optional Auth Middleware ─────────────────────────────────────────────────
// Attaches user if token is present, but does not block if absent

export function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const token = extractTokenFromHeader(req);

  if (!token) {
    next();
    return;
  }

  try {
    const secret = getJWTSecret();
    const decoded = jwt.verify(token, secret, {
      issuer: "filetaxai",
      audience: "filetaxai-users",
    }) as JWTPayload;

    req.user = decoded;
  } catch {
    // Silently ignore invalid tokens for optional auth
  }

  next();
}

// ─── Decode Token (without verification – for refresh token flows) ────────────

export function decodeToken(token: string): JWTPayload | null {
  try {
    return jwt.decode(token) as JWTPayload;
  } catch {
    return null;
  }
}
