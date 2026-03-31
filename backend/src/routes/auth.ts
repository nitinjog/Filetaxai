import { Router, Request, Response } from "express";
import asyncHandler from "express-async-handler";
import bcrypt from "bcryptjs";
import prisma from "../models/db";
import { verifyToken, generateToken, decodeToken } from "../middleware/auth";
import { AppError, Errors } from "../middleware/errorHandler";
import {
  RegisterSchema,
  LoginSchema,
} from "../utils/validators";
import { maskPAN, isValidPAN } from "../utils/encryption";

const router = Router();

// ─── POST /api/auth/register ──────────────────────────────────────────────────

router.post(
  "/register",
  asyncHandler(async (req: Request, res: Response) => {
    const body = RegisterSchema.parse(req.body);

    // Check if email already exists
    const existing = await prisma.user.findUnique({
      where: { email: body.email },
    });
    if (existing) {
      throw new AppError("An account with this email already exists", 409, "EMAIL_EXISTS");
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(body.password, saltRounds);

    // Mask PAN if provided
    let panMasked: string | null = null;
    if (body.pan_last4) {
      // pan_last4 is just used as a hint – we don't store full PAN
      panMasked = `*****${body.pan_last4.substring(0, 4)}*`;
    }

    const user = await prisma.user.create({
      data: {
        email: body.email,
        name: body.name,
        password_hash: passwordHash,
        pan_masked: panMasked,
      },
      select: {
        id: true,
        email: true,
        name: true,
        pan_masked: true,
        created_at: true,
      },
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        user_id: user.id,
        action: "USER_REGISTERED",
        metadata: { email: user.email },
        ip_address: req.ip || req.socket.remoteAddress,
      },
    });

    const token = generateToken(user.id, user.email);

    res.status(201).json({
      success: true,
      message: "Account created successfully",
      data: {
        user,
        token,
        expires_in: process.env.JWT_EXPIRES_IN || "7d",
      },
    });
  })
);

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

router.post(
  "/login",
  asyncHandler(async (req: Request, res: Response) => {
    const body = LoginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: body.email },
    });

    if (!user) {
      // Use generic message to prevent user enumeration
      throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
    }

    const isPasswordValid = await bcrypt.compare(body.password, user.password_hash);
    if (!isPasswordValid) {
      // Log failed attempt
      await prisma.auditLog.create({
        data: {
          user_id: user.id,
          action: "LOGIN_FAILED",
          metadata: { reason: "invalid_password" },
          ip_address: req.ip || req.socket.remoteAddress,
        },
      });
      throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
    }

    const token = generateToken(user.id, user.email);

    // Log successful login
    await prisma.auditLog.create({
      data: {
        user_id: user.id,
        action: "LOGIN_SUCCESS",
        metadata: { email: user.email },
        ip_address: req.ip || req.socket.remoteAddress,
      },
    });

    res.json({
      success: true,
      message: "Login successful",
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          pan_masked: user.pan_masked,
          created_at: user.created_at,
        },
        token,
        expires_in: process.env.JWT_EXPIRES_IN || "7d",
      },
    });
  })
);

// ─── POST /api/auth/logout ────────────────────────────────────────────────────

router.post(
  "/logout",
  verifyToken,
  asyncHandler(async (req: Request, res: Response) => {
    // JWT is stateless – client deletes token.
    // We log the logout event for audit purposes.
    await prisma.auditLog.create({
      data: {
        user_id: req.user!.userId,
        action: "LOGOUT",
        ip_address: req.ip || req.socket.remoteAddress,
      },
    });

    res.json({ success: true, message: "Logged out successfully" });
  })
);

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

router.get(
  "/me",
  verifyToken,
  asyncHandler(async (req: Request, res: Response) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        email: true,
        name: true,
        pan_masked: true,
        created_at: true,
        updated_at: true,
        _count: {
          select: { sessions: true },
        },
      },
    });

    if (!user) {
      throw Errors.notFound("User");
    }

    res.json({
      success: true,
      data: { user },
    });
  })
);

// ─── POST /api/auth/refresh-token ─────────────────────────────────────────────

router.post(
  "/refresh-token",
  asyncHandler(async (req: Request, res: Response) => {
    const { token: oldToken } = req.body;

    if (!oldToken || typeof oldToken !== "string") {
      throw Errors.badRequest("Token is required");
    }

    // Decode without verifying (expired tokens can still be decoded)
    const decoded = decodeToken(oldToken);

    if (!decoded?.userId || !decoded?.email) {
      throw new AppError("Invalid token", 401, "INVALID_TOKEN");
    }

    // Verify user still exists
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      throw new AppError("User no longer exists", 401, "USER_NOT_FOUND");
    }

    // Issue new token
    const newToken = generateToken(user.id, user.email);

    res.json({
      success: true,
      data: {
        token: newToken,
        expires_in: process.env.JWT_EXPIRES_IN || "7d",
      },
    });
  })
);

// ─── PATCH /api/auth/profile ──────────────────────────────────────────────────

router.patch(
  "/profile",
  verifyToken,
  asyncHandler(async (req: Request, res: Response) => {
    const { name, pan } = req.body as { name?: string; pan?: string };

    const updateData: { name?: string; pan_masked?: string } = {};

    if (name && typeof name === "string" && name.trim().length >= 2) {
      updateData.name = name.trim();
    }

    if (pan && typeof pan === "string") {
      const upper = pan.toUpperCase().trim();
      if (!isValidPAN(upper)) {
        throw Errors.badRequest("Invalid PAN format");
      }
      updateData.pan_masked = maskPAN(upper);
    }

    if (Object.keys(updateData).length === 0) {
      throw Errors.badRequest("No valid fields to update");
    }

    const updated = await prisma.user.update({
      where: { id: req.user!.userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        pan_masked: true,
        updated_at: true,
      },
    });

    res.json({ success: true, data: { user: updated } });
  })
);

export default router;
