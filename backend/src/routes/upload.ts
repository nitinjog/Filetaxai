import { Router, Request, Response } from "express";
import asyncHandler from "express-async-handler";
import multer, { FileFilterCallback } from "multer";
import prisma from "../models/db";
import { verifyToken } from "../middleware/auth";
import { AppError, Errors } from "../middleware/errorHandler";
import { uploadDocument, deleteDocument, getSignedUrl } from "../services/storageService";
import { DocumentTypeSchema } from "../utils/validators";

const router = Router();

// ─── Multer Configuration ─────────────────────────────────────────────────────

const MAX_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || "10");
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/tiff",
];

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError(`Unsupported file type: ${file.mimetype}. Allowed: PDF, JPEG, PNG, WEBP, TIFF`, 415));
  }
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: MAX_SIZE_BYTES, files: 1 },
});

// ─── All routes require auth ──────────────────────────────────────────────────

router.use(verifyToken);

// ─── POST /api/documents/upload ───────────────────────────────────────────────
// Frontend sends: file, documentType, sessionId

router.post(
  "/upload",
  upload.single("file"),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw Errors.badRequest("No file uploaded. Use multipart/form-data with field name 'file'");
    }

    // Accept both camelCase (frontend) and snake_case (direct API) field names
    const sessionId = (req.body.sessionId || req.body.session_id) as string;
    const rawDocumentType = (req.body.documentType || req.body.document_type) as string;

    if (!sessionId) {
      throw Errors.badRequest("sessionId is required");
    }

    const documentTypeResult = DocumentTypeSchema.safeParse(rawDocumentType?.toUpperCase());
    if (!documentTypeResult.success) {
      throw Errors.badRequest("Invalid documentType. Must be one of: FORM16, FORM26AS, AIS, SALARY_SLIP, OTHER");
    }
    const documentType = documentTypeResult.data;

    // Verify session belongs to user
    const session = await prisma.taxSession.findFirst({
      where: { id: sessionId, user_id: req.user!.userId },
    });

    if (!session) throw Errors.notFound("Session");
    if (session.status === "FILED") throw Errors.forbidden("Cannot upload documents to a filed session");

    // Upload to storage (Cloudinary or local fallback)
    const uploadResult = await uploadDocument(
      req.file.buffer,
      req.file.originalname,
      sessionId,
      documentType
    );

    // Create document record in DB
    const document = await prisma.document.create({
      data: {
        session_id: sessionId,
        type: documentType,
        original_name: req.file.originalname,
        storage_url: uploadResult.secure_url,
        cloudinary_id: uploadResult.public_id,
        status: "UPLOADED",
      },
    });

    if (session.status === "DRAFT") {
      await prisma.taxSession.update({
        where: { id: sessionId },
        data: { status: "DOCUMENTS_UPLOADED" },
      });
    }

    await prisma.auditLog.create({
      data: {
        user_id: req.user!.userId,
        action: "DOCUMENT_UPLOADED",
        metadata: {
          document_id: document.id,
          document_type: documentType,
          filename: req.file.originalname,
          size_bytes: req.file.size,
          session_id: sessionId,
        },
        ip_address: req.ip || req.socket.remoteAddress,
      },
    });

    res.status(201).json({
      success: true,
      message: "Document uploaded successfully",
      data: {
        id: document.id,
        session_id: document.session_id,
        type: document.type,
        original_name: document.original_name,
        status: document.status,
        created_at: document.created_at,
      },
    });
  })
);

// ─── GET /api/documents?sessionId=... ─────────────────────────────────────────

router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const sessionId = (req.query.sessionId || req.query.session_id) as string;
    const userId = req.user!.userId;

    if (!sessionId) throw Errors.badRequest("sessionId query param is required");

    const session = await prisma.taxSession.findFirst({
      where: { id: sessionId, user_id: userId },
    });
    if (!session) throw Errors.notFound("Session");

    const documents = await prisma.document.findMany({
      where: { session_id: sessionId },
      select: {
        id: true,
        type: true,
        original_name: true,
        status: true,
        parsed_data: true,
        error_message: true,
        created_at: true,
        updated_at: true,
      },
      orderBy: { created_at: "desc" },
    });

    res.json({ success: true, data: documents });
  })
);

// ─── GET /api/documents/session/:sessionId ────────────────────────────────────

router.get(
  "/session/:sessionId",
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const userId = req.user!.userId;

    const session = await prisma.taxSession.findFirst({
      where: { id: sessionId, user_id: userId },
    });
    if (!session) throw Errors.notFound("Session");

    const documents = await prisma.document.findMany({
      where: { session_id: sessionId },
      select: {
        id: true,
        type: true,
        original_name: true,
        status: true,
        parsed_data: true,
        error_message: true,
        created_at: true,
        updated_at: true,
      },
      orderBy: { created_at: "desc" },
    });

    res.json({ success: true, data: documents });
  })
);

// ─── GET /api/documents/:documentId ──────────────────────────────────────────

router.get(
  "/:documentId",
  asyncHandler(async (req: Request, res: Response) => {
    const { documentId } = req.params;
    const userId = req.user!.userId;

    const document = await prisma.document.findFirst({
      where: { id: documentId, session: { user_id: userId } },
      include: { session: { select: { id: true, tax_year: true, status: true } } },
    });

    if (!document) throw Errors.notFound("Document");

    let signedUrl: string | null = null;
    if (document.cloudinary_id) {
      try {
        signedUrl = getSignedUrl(document.cloudinary_id, { expires_in_seconds: 3600 });
      } catch { /* non-fatal */ }
    }

    res.json({
      success: true,
      data: { ...document, storage_url: undefined, download_url: signedUrl },
    });
  })
);

// ─── DELETE /api/documents/:documentId ───────────────────────────────────────

router.delete(
  "/:documentId",
  asyncHandler(async (req: Request, res: Response) => {
    const { documentId } = req.params;
    const userId = req.user!.userId;

    const document = await prisma.document.findFirst({
      where: { id: documentId, session: { user_id: userId } },
      include: { session: { select: { status: true } } },
    });

    if (!document) throw Errors.notFound("Document");
    if (document.session.status === "FILED") throw Errors.forbidden("Cannot delete documents from a filed session");

    if (document.cloudinary_id) {
      try { await deleteDocument(document.cloudinary_id); } catch (err) {
        console.error("Storage deletion failed:", err);
      }
    }

    await prisma.document.delete({ where: { id: documentId } });

    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: "DOCUMENT_DELETED",
        metadata: { document_id: documentId, document_type: document.type },
        ip_address: req.ip || req.socket.remoteAddress,
      },
    });

    res.json({ success: true, message: "Document deleted successfully" });
  })
);

export default router;
