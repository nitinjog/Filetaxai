import { Router, Request, Response } from "express";
import asyncHandler from "express-async-handler";
import prisma from "../models/db";
import { verifyToken } from "../middleware/auth";
import { Errors } from "../middleware/errorHandler";
import {
  reviewTaxComputation,
  suggestMissingDeductions,
  explainInSimpleTerms,
  detectAnomalies,
} from "../services/aiService";
import { IncomeData, TaxComparisonResult } from "../services/taxEngine";
import { TAX_CONFIG } from "../utils/taxConfig";

const router = Router();

router.use(verifyToken);

// ─── Helper: Load and validate computation ────────────────────────────────────
// Accepts either a computationId (UUID of TaxComputation) or a sessionId —
// the frontend always sends sessionId, so we try session lookup first.

async function loadComputation(idParam: string, userId: string) {
  // Try by session_id first (frontend passes sessionId)
  let computation = await prisma.taxComputation.findFirst({
    where: {
      session_id: idParam,
      session: { user_id: userId },
    },
    include: {
      session: {
        include: {
          documents: {
            where: { status: "PARSED" },
            select: { type: true, parsed_data: true },
          },
        },
      },
    },
  });

  // Fall back to computation id lookup (direct API use)
  if (!computation) {
    computation = await prisma.taxComputation.findFirst({
      where: {
        id: idParam,
        session: { user_id: userId },
      },
      include: {
        session: {
          include: {
            documents: {
              where: { status: "PARSED" },
              select: { type: true, parsed_data: true },
            },
          },
        },
      },
    });
  }

  if (!computation) throw Errors.notFound("Computation");

  const incomeData = computation.raw_income_data as unknown as IncomeData;
  const comparisonResult: TaxComparisonResult = {
    old_regime: computation.old_regime_data as unknown as TaxComparisonResult["old_regime"],
    new_regime: computation.new_regime_data as unknown as TaxComparisonResult["new_regime"],
    recommended_regime: computation.recommended_regime as "OLD" | "NEW",
    savings_amount: Math.abs(
      (computation.old_regime_data as { net_tax_payable: number }).net_tax_payable -
      (computation.new_regime_data as { net_tax_payable: number }).net_tax_payable
    ),
    savings_percentage: 0,
    recommendation_reason: "",
  };

  return { computation, incomeData, comparisonResult };
}

// ─── POST /api/ai-review/:computationId ───────────────────────────────────────

router.post(
  "/:computationId",
  asyncHandler(async (req: Request, res: Response) => {
    const { computationId } = req.params;
    const userId = req.user!.userId;

    const { computation, incomeData, comparisonResult } = await loadComputation(
      computationId,
      userId
    );

    // Perform comprehensive AI review
    const [review, suggestions, explanation] = await Promise.allSettled([
      reviewTaxComputation(incomeData, comparisonResult),
      suggestMissingDeductions(incomeData),
      explainInSimpleTerms(comparisonResult, incomeData),
    ]);

    const aiReviewData = {
      review: review.status === "fulfilled" ? review.value : null,
      suggestions: suggestions.status === "fulfilled" ? suggestions.value : [],
      explanation: explanation.status === "fulfilled" ? explanation.value : null,
      generated_at: new Date().toISOString(),
      fy: TAX_CONFIG.FY,
      ay: TAX_CONFIG.AY,
    };

    // Save AI review to computation
    await prisma.taxComputation.update({
      where: { id: computation.id },
      data: { ai_review: aiReviewData as unknown as object },
    });

    // Update session status
    await prisma.taxSession.update({
      where: { id: computation.session_id },
      data: { status: "AI_REVIEWED" },
    });

    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: "AI_REVIEW_GENERATED",
        metadata: {
          computation_id: computationId,
          review_status: review.status,
          suggestions_count:
            suggestions.status === "fulfilled" ? suggestions.value.length : 0,
        },
        ip_address: req.ip || req.socket.remoteAddress,
      },
    });

    res.json({
      success: true,
      message: "AI review completed",
      data: aiReviewData,
    });
  })
);

// ─── GET /api/ai-review/:computationId/explanation ───────────────────────────

router.get(
  "/:computationId/explanation",
  asyncHandler(async (req: Request, res: Response) => {
    const { computationId } = req.params;
    const userId = req.user!.userId;

    const { computation, incomeData, comparisonResult } = await loadComputation(
      computationId,
      userId
    );

    // Check if cached
    const cached = computation.ai_review as Record<string, unknown> | null;
    if (cached?.explanation) {
      return res.json({
        success: true,
        data: { explanation: cached.explanation, cached: true },
      });
    }

    // Generate fresh explanation
    const explanation = await explainInSimpleTerms(comparisonResult, incomeData);

    // Cache it
    const updatedReview = { ...(cached || {}), explanation };
    await prisma.taxComputation.update({
      where: { id: computation.id },
      data: { ai_review: updatedReview as unknown as object },
    });

    res.json({
      success: true,
      data: { explanation, cached: false },
    });
  })
);

// ─── GET /api/ai-review/:computationId/suggestions ───────────────────────────

router.get(
  "/:computationId/suggestions",
  asyncHandler(async (req: Request, res: Response) => {
    const { computationId } = req.params;
    const userId = req.user!.userId;

    const { computation, incomeData } = await loadComputation(
      computationId,
      userId
    );

    // Check if cached
    const cached = computation.ai_review as Record<string, unknown> | null;
    if (cached?.suggestions && Array.isArray(cached.suggestions) && cached.suggestions.length > 0) {
      return res.json({
        success: true,
        data: { suggestions: cached.suggestions, cached: true },
      });
    }

    // Generate fresh suggestions
    const suggestions = await suggestMissingDeductions(incomeData);

    // Cache it
    const updatedReview = { ...(cached || {}), suggestions };
    await prisma.taxComputation.update({
      where: { id: computation.id },
      data: { ai_review: updatedReview as unknown as object },
    });

    res.json({
      success: true,
      data: { suggestions, cached: false },
    });
  })
);

// ─── GET /api/ai-review/:computationId/anomalies ─────────────────────────────

router.get(
  "/:computationId/anomalies",
  asyncHandler(async (req: Request, res: Response) => {
    const { computationId } = req.params;
    const userId = req.user!.userId;

    const { computation, incomeData } = await loadComputation(
      computationId,
      userId
    );

    // Check if cached
    const cached = computation.ai_review as Record<string, unknown> | null;
    if (cached?.anomalies) {
      return res.json({
        success: true,
        data: { anomalies: cached.anomalies, cached: true },
      });
    }

    // Build document summaries for anomaly detection
    const documentSummaries = computation.session.documents
      .filter((d) => d.parsed_data)
      .map((doc) => {
        const data = doc.parsed_data as Record<string, number>;
        return {
          type: doc.type,
          key_values: {
            gross_salary: data.gross_salary || 0,
            tds_deducted: data.tds_deducted || data.total_tds || 0,
            basic_salary: data.basic_salary || 0,
          },
        };
      });

    const anomalies = await detectAnomalies(incomeData, documentSummaries);

    // Cache it
    const updatedReview = { ...(cached || {}), anomalies };
    await prisma.taxComputation.update({
      where: { id: computation.id },
      data: { ai_review: updatedReview as unknown as object },
    });

    res.json({
      success: true,
      data: {
        anomalies,
        total: anomalies.length,
        high_severity: anomalies.filter((a) => a.severity === "HIGH").length,
        cached: false,
      },
    });
  })
);

export default router;
