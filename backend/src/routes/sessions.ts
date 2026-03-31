import { Router, Request, Response } from "express";
import asyncHandler from "express-async-handler";
import prisma from "../models/db";
import { verifyToken } from "../middleware/auth";
import { Errors } from "../middleware/errorHandler";
import {
  CreateSessionSchema,
  UpdateSessionStatusSchema,
} from "../utils/validators";
import { deleteSessionDocuments } from "../services/storageService";

const router = Router();

// All routes require authentication
router.use(verifyToken);

// ─── POST /api/sessions ───────────────────────────────────────────────────────

router.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const body = CreateSessionSchema.parse(req.body);
    const userId = req.user!.userId;

    // Check if an active session for this tax year already exists
    const existing = await prisma.taxSession.findFirst({
      where: {
        user_id: userId,
        tax_year: body.tax_year,
        status: { notIn: ["FILED"] },
      },
    });

    if (existing) {
      // Return existing session instead of creating a duplicate
      return res.json({
        success: true,
        message: "Returning existing active session for this tax year",
        data: { session: existing },
      });
    }

    const session = await prisma.taxSession.create({
      data: {
        user_id: userId,
        tax_year: body.tax_year,
        status: "DRAFT",
      },
    });

    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: "SESSION_CREATED",
        metadata: { session_id: session.id, tax_year: body.tax_year },
        ip_address: req.ip || req.socket.remoteAddress,
      },
    });

    res.status(201).json({
      success: true,
      message: "Tax session created",
      data: { session },
    });
  })
);

// ─── GET /api/sessions ────────────────────────────────────────────────────────

router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const page = Math.max(1, parseInt((req.query.page as string) || "1"));
    const limit = Math.min(50, Math.max(1, parseInt((req.query.limit as string) || "10")));
    const skip = (page - 1) * limit;

    const [sessions, total] = await Promise.all([
      prisma.taxSession.findMany({
        where: { user_id: userId },
        include: {
          _count: { select: { documents: true } },
          computation: {
            select: {
              id: true,
              recommended_regime: true,
              final_tax_payable: true,
              refund_or_payable: true,
            },
          },
        },
        orderBy: { created_at: "desc" },
        skip,
        take: limit,
      }),
      prisma.taxSession.count({ where: { user_id: userId } }),
    ]);

    res.json({
      success: true,
      data: {
        sessions,
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit),
        },
      },
    });
  })
);

// ─── GET /api/sessions/:id ────────────────────────────────────────────────────

router.get(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const { id } = req.params;

    const session = await prisma.taxSession.findFirst({
      where: { id, user_id: userId },
      include: {
        documents: {
          select: {
            id: true,
            type: true,
            original_name: true,
            status: true,
            created_at: true,
          },
          orderBy: { created_at: "desc" },
        },
        computation: true,
      },
    });

    if (!session) {
      throw Errors.notFound("Session");
    }

    res.json({ success: true, data: { session } });
  })
);

// ─── PUT /api/sessions/:id/status ─────────────────────────────────────────────

router.put(
  "/:id/status",
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const { id } = req.params;

    const body = UpdateSessionStatusSchema.parse(req.body);

    const session = await prisma.taxSession.findFirst({
      where: { id, user_id: userId },
    });

    if (!session) {
      throw Errors.notFound("Session");
    }

    const updated = await prisma.taxSession.update({
      where: { id },
      data: { status: body.status },
    });

    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: "SESSION_STATUS_UPDATED",
        metadata: {
          session_id: id,
          old_status: session.status,
          new_status: body.status,
        },
        ip_address: req.ip || req.socket.remoteAddress,
      },
    });

    res.json({
      success: true,
      message: "Session status updated",
      data: { session: updated },
    });
  })
);

// ─── DELETE /api/sessions/:id ─────────────────────────────────────────────────

router.delete(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const { id } = req.params;

    const session = await prisma.taxSession.findFirst({
      where: { id, user_id: userId },
    });

    if (!session) {
      throw Errors.notFound("Session");
    }

    // Prevent deleting filed sessions
    if (session.status === "FILED") {
      throw Errors.forbidden("Cannot delete a filed tax session");
    }

    // Delete documents from Cloudinary
    try {
      await deleteSessionDocuments(id);
    } catch (err) {
      console.error("Failed to delete Cloudinary documents:", err);
      // Continue with DB deletion even if Cloudinary fails
    }

    // Cascade deletes documents and computation via Prisma schema
    await prisma.taxSession.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: "SESSION_DELETED",
        metadata: { session_id: id, tax_year: session.tax_year },
        ip_address: req.ip || req.socket.remoteAddress,
      },
    });

    res.json({ success: true, message: "Session deleted successfully" });
  })
);

export default router;
