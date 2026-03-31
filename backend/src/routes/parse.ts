import { Router, Request, Response } from "express";
import asyncHandler from "express-async-handler";
import https from "https";
import http from "http";
import prisma from "../models/db";
import { verifyToken } from "../middleware/auth";
import { AppError, Errors } from "../middleware/errorHandler";
import {
  parseForm16,
  parseForm26AS,
  parseAIS,
  parseSalarySlip,
  buildIncomeData,
  ParsedDocument,
  extractText,
} from "../services/documentParser";
import { extractForm16WithGemini, extractStructuredData } from "../services/aiService";

const router = Router();

router.use(verifyToken);

// ─── Helper: Download document buffer from URL ────────────────────────────────

async function downloadBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    const chunks: Buffer[] = [];

    const request = protocol.get(url, { headers: { "User-Agent": "FileTaxAI/1.0" } }, (res) => {
      // Follow redirects (up to 5)
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadBuffer(res.headers.location).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode && res.statusCode !== 200) {
        reject(new Error(`Failed to download document: HTTP ${res.statusCode}`));
        return;
      }

      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    });

    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error("Document download timed out after 30s"));
    });

    request.on("error", reject);
  });
}

// ─── Helper: Detect MIME type from URL ───────────────────────────────────────

function guessMimeType(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes(".pdf")) return "application/pdf";
  if (lower.includes(".jpg") || lower.includes(".jpeg")) return "image/jpeg";
  if (lower.includes(".png")) return "image/png";
  if (lower.includes(".tiff") || lower.includes(".tif")) return "image/tiff";
  return "application/pdf"; // Default for tax documents
}

// ─── Helper: Parse a single document ─────────────────────────────────────────

async function parseDocument(
  documentId: string,
  userId: string
): Promise<ParsedDocument> {
  const document = await prisma.document.findFirst({
    where: { id: documentId, session: { user_id: userId } },
  });

  if (!document) throw Errors.notFound("Document");

  // Mark as parsing
  await prisma.document.update({
    where: { id: documentId },
    data: { status: "PARSING" },
  });

  try {
    const buffer = await downloadBuffer(document.storage_url);
    const mimeType = guessMimeType(document.storage_url);

    let parsed: ParsedDocument;

    switch (document.type) {
      case "FORM16": {
        // Step 1: Extract raw text from PDF
        const rawText = await extractText(buffer, mimeType);

        let form16Data;

        // Step 2: Try Gemini 2.5 Flash as PRIMARY extractor
        // Pass both raw text AND the PDF buffer so Gemini can use vision if available
        try {
          console.log("[Parse] Using Gemini 2.5 Flash for Form 16 extraction...");
          form16Data = await extractForm16WithGemini(
            rawText,
            mimeType === "application/pdf" ? buffer : undefined
          );
          console.log(`[Parse] Gemini extracted gross_salary=${form16Data.gross_salary}, tds=${form16Data.tds_deducted}`);
        } catch (geminiErr) {
          console.warn("[Parse] Gemini extraction failed, falling back to regex:", geminiErr);
          // Step 3: Fall back to regex parser
          form16Data = await parseForm16(buffer, mimeType);
        }

        // Step 4: If both gave zeros for critical fields, try extractStructuredData
        if (!form16Data.gross_salary && !form16Data.tds_deducted) {
          console.warn("[Parse] Both Gemini and regex returned zeros, trying generic AI extraction...");
          try {
            const aiData = await extractStructuredData(rawText, "FORM16");
            const f = aiData.extracted_fields;
            if (f.gross_salary) form16Data.gross_salary = Number(f.gross_salary);
            if (f.tds_deducted) form16Data.tds_deducted = Number(f.tds_deducted);
            if (f.basic_salary) form16Data.basic_salary = Number(f.basic_salary);
          } catch { /* best effort */ }
        }

        parsed = { type: "FORM16", data: form16Data };
        break;
      }

      case "FORM26AS": {
        const form26Data = await parseForm26AS(buffer, mimeType);
        parsed = { type: "FORM26AS", data: form26Data };
        break;
      }

      case "AIS": {
        const aisData = await parseAIS(buffer, mimeType);
        parsed = { type: "AIS", data: aisData };
        break;
      }

      case "SALARY_SLIP": {
        const slipData = await parseSalarySlip(buffer, mimeType);
        parsed = { type: "SALARY_SLIP", data: slipData };
        break;
      }

      default: {
        parsed = { type: "OTHER", data: { raw_text: "" } };
      }
    }

    // Save parsed data and mark complete
    await prisma.document.update({
      where: { id: documentId },
      data: {
        parsed_data: parsed.data as object,
        status: "PARSED",
      },
    });

    return parsed;
  } catch (err) {
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: "FAILED",
        error_message: (err as Error).message,
      },
    });
    throw err;
  }
}

// ─── POST /api/parse/:documentId ─────────────────────────────────────────────

router.post(
  "/:documentId",
  asyncHandler(async (req: Request, res: Response) => {
    const { documentId } = req.params;
    const userId = req.user!.userId;

    const parsed = await parseDocument(documentId, userId);

    res.json({
      success: true,
      message: "Document parsed successfully",
      data: { parsed },
    });
  })
);

// ─── POST /api/parse/session/:sessionId ──────────────────────────────────────

router.post(
  "/session/:sessionId",
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const userId = req.user!.userId;

    // Verify session ownership
    const session = await prisma.taxSession.findFirst({
      where: { id: sessionId, user_id: userId },
      include: { documents: true },
    });

    if (!session) throw Errors.notFound("Session");

    if (session.documents.length === 0) {
      throw new AppError(
        "No documents found in this session. Please upload documents first.",
        400
      );
    }

    const results: { document_id: string; status: string; error?: string }[] = [];

    // Parse each document sequentially to avoid overloading AI service
    for (const doc of session.documents) {
      if (doc.status === "PARSED") {
        results.push({ document_id: doc.id, status: "already_parsed" });
        continue;
      }

      try {
        await parseDocument(doc.id, userId);
        results.push({ document_id: doc.id, status: "success" });
      } catch (err) {
        results.push({
          document_id: doc.id,
          status: "failed",
          error: (err as Error).message,
        });
      }
    }

    // Update session status
    const allParsed = results.every(
      (r) => r.status === "success" || r.status === "already_parsed"
    );
    if (allParsed) {
      await prisma.taxSession.update({
        where: { id: sessionId },
        data: { status: "PARSING_COMPLETE" },
      });
    }

    res.json({
      success: true,
      message: "Session parsing complete",
      data: {
        results,
        all_parsed: allParsed,
        session_status: allParsed ? "PARSING_COMPLETE" : "DOCUMENTS_UPLOADED",
      },
    });
  })
);

// ─── GET /api/parse/:documentId/status ───────────────────────────────────────

router.get(
  "/:documentId/status",
  asyncHandler(async (req: Request, res: Response) => {
    const { documentId } = req.params;
    const userId = req.user!.userId;

    const document = await prisma.document.findFirst({
      where: { id: documentId, session: { user_id: userId } },
      select: {
        id: true,
        type: true,
        status: true,
        error_message: true,
        updated_at: true,
      },
    });

    if (!document) throw Errors.notFound("Document");

    res.json({
      success: true,
      data: { document },
    });
  })
);

// ─── GET /api/parse/session/:sessionId/combined ───────────────────────────────

router.get(
  "/session/:sessionId/combined",
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const userId = req.user!.userId;

    const session = await prisma.taxSession.findFirst({
      where: { id: sessionId, user_id: userId },
      include: {
        documents: {
          where: { status: "PARSED" },
          select: {
            id: true,
            type: true,
            parsed_data: true,
            original_name: true,
          },
        },
      },
    });

    if (!session) throw Errors.notFound("Session");

    if (session.documents.length === 0) {
      throw new AppError(
        "No parsed documents found. Parse documents first.",
        400
      );
    }

    // Build ParsedDocument array from DB records
    const parsedDocuments: ParsedDocument[] = session.documents
      .map((doc) => {
        if (!doc.parsed_data) return null;
        switch (doc.type) {
          case "FORM16":
            return { type: "FORM16" as const, data: doc.parsed_data };
          case "FORM26AS":
            return { type: "FORM26AS" as const, data: doc.parsed_data };
          case "AIS":
            return { type: "AIS" as const, data: doc.parsed_data };
          case "SALARY_SLIP":
            return { type: "SALARY_SLIP" as const, data: [doc.parsed_data] };
          default:
            return { type: "OTHER" as const, data: doc.parsed_data as { raw_text: string } };
        }
      })
      .filter((d): d is ParsedDocument => d !== null);

    // Get user age (default 30 if not available)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pan_masked: true },
    });

    const combinedIncomeData = buildIncomeData(parsedDocuments, 30, user?.pan_masked || "");

    res.json({
      success: true,
      data: {
        income_data: combinedIncomeData,
        document_count: parsedDocuments.length,
        documents_used: session.documents.map((d) => ({
          id: d.id,
          type: d.type,
          name: d.original_name,
        })),
      },
    });
  })
);

export default router;
