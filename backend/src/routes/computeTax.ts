import { Router, Request, Response } from "express";
import asyncHandler from "express-async-handler";
import { Prisma } from "@prisma/client";
import prisma from "../models/db";
import { verifyToken } from "../middleware/auth";
import { AppError, Errors } from "../middleware/errorHandler";
import { compareTaxRegimes, generateTaxBreakdown, IncomeData } from "../services/taxEngine";
import { buildIncomeData, ParsedDocument } from "../services/documentParser";
import { ManualIncomeDataSchema } from "../utils/validators";
import { TAX_CONFIG } from "../utils/taxConfig";

const router = Router();

router.use(verifyToken);

// ─── Helper: Build income data from session documents ─────────────────────────

async function buildIncomeDataFromSession(
  sessionId: string,
  userId: string,
  userAge: number = 30
): Promise<IncomeData> {
  const session = await prisma.taxSession.findFirst({
    where: { id: sessionId, user_id: userId },
    include: {
      documents: {
        where: { status: "PARSED" },
        select: { type: true, parsed_data: true },
      },
    },
  });

  if (!session) throw Errors.notFound("Session");

  if (session.documents.length === 0) {
    throw new AppError(
      "No parsed documents found. Please upload and parse documents first.",
      400
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parsedDocuments: ParsedDocument[] = (session.documents
    .filter((d) => d.parsed_data !== null)
    .map((doc) => {
      const pd = doc.parsed_data as unknown;
      switch (doc.type) {
        case "FORM16":   return { type: "FORM16" as const, data: pd };
        case "FORM26AS": return { type: "FORM26AS" as const, data: pd };
        case "AIS":      return { type: "AIS" as const, data: pd };
        case "SALARY_SLIP":
          return { type: "SALARY_SLIP" as const, data: Array.isArray(pd) ? pd : [pd] };
        default:
          return { type: "OTHER" as const, data: pd as { raw_text: string } };
      }
    })) as unknown as ParsedDocument[];

  return buildIncomeData(parsedDocuments, userAge);
}

// ─── POST /api/compute-tax/session/:sessionId ─────────────────────────────────

router.post(
  "/session/:sessionId",
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const userId = req.user!.userId;
    const userAge = parseInt((req.body.age as string) || "30") || 30;

    const session = await prisma.taxSession.findFirst({
      where: { id: sessionId, user_id: userId },
    });
    if (!session) throw Errors.notFound("Session");

    if (
      session.status !== "PARSING_COMPLETE" &&
      session.status !== "DOCUMENTS_UPLOADED" &&
      session.status !== "COMPUTATION_DONE"
    ) {
      throw new AppError(
        "Session documents must be parsed before computing tax. Call POST /api/parse/session/:sessionId first.",
        400
      );
    }

    const incomeData = await buildIncomeDataFromSession(sessionId, userId, userAge);
    incomeData.age = userAge;

    const comparison = compareTaxRegimes(incomeData);
    const recommended =
      comparison.recommended_regime === "OLD"
        ? comparison.old_regime
        : comparison.new_regime;

    // Upsert tax computation
    const computation = await prisma.taxComputation.upsert({
      where: { session_id: sessionId },
      create: {
        session_id: sessionId,
        raw_income_data: incomeData as unknown as object,
        old_regime_data: comparison.old_regime as unknown as object,
        new_regime_data: comparison.new_regime as unknown as object,
        recommended_regime: comparison.recommended_regime,
        final_tax_payable: recommended.net_tax_payable,
        tds_deducted: recommended.tds_deducted,
        refund_or_payable: recommended.refund_or_payable,
      },
      update: {
        raw_income_data: incomeData as unknown as object,
        old_regime_data: comparison.old_regime as unknown as object,
        new_regime_data: comparison.new_regime as unknown as object,
        recommended_regime: comparison.recommended_regime,
        final_tax_payable: recommended.net_tax_payable,
        tds_deducted: recommended.tds_deducted,
        refund_or_payable: recommended.refund_or_payable,
        ai_review: Prisma.DbNull, // Reset AI review on recompute
      },
    });

    // Update session status
    await prisma.taxSession.update({
      where: { id: sessionId },
      data: { status: "COMPUTATION_DONE" },
    });

    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: "TAX_COMPUTED",
        metadata: {
          session_id: sessionId,
          computation_id: computation.id,
          recommended_regime: comparison.recommended_regime,
          tax_payable: recommended.net_tax_payable,
          refund_or_payable: recommended.refund_or_payable,
        },
        ip_address: req.ip || req.socket.remoteAddress,
      },
    });

    // Generate UI breakdown
    const oldBreakdown = generateTaxBreakdown(comparison.old_regime);
    const newBreakdown = generateTaxBreakdown(comparison.new_regime);

    res.json({
      success: true,
      message: "Tax computation complete",
      data: {
        computation_id: computation.id,
        tax_year: session.tax_year,
        fy: TAX_CONFIG.FY,
        ay: TAX_CONFIG.AY,
        recommended_regime: comparison.recommended_regime,
        savings_amount: comparison.savings_amount,
        savings_percentage: comparison.savings_percentage,
        recommendation_reason: comparison.recommendation_reason,
        old_regime: {
          ...comparison.old_regime,
          breakdown_display: oldBreakdown,
        },
        new_regime: {
          ...comparison.new_regime,
          breakdown_display: newBreakdown,
        },
        income_data: incomeData,
      },
    });
  })
);

// ─── POST /api/compute-tax/manual ─────────────────────────────────────────────

router.post(
  "/manual",
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;

    // Accept both nested camelCase (frontend) and flat snake_case (direct API)
    let rawData: Record<string, unknown>;
    if (req.body.income || req.body.deductions) {
      const inc = (req.body.income as Record<string, unknown>) || {};
      const ded = (req.body.deductions as Record<string, unknown>) || {};
      rawData = {
        gross_salary: inc.grossSalary ?? 0,
        basic_salary: inc.basicSalary ?? inc.grossSalary ?? 0,
        hra_received: inc.hra ?? 0,
        city_type: inc.isMetroCity ? "METRO" : "NON_METRO",
        rent_paid_annual: inc.rentPaid ?? 0,
        special_allowance: inc.specialAllowance ?? 0,
        other_allowances: inc.otherAllowances ?? 0,
        bonus: inc.bonus ?? 0,
        lta_received: inc.lta ?? 0,
        lta_claimed: inc.lta ?? 0,
        interest_income: inc.interestIncome ?? 0,
        rental_income: inc.rentalIncome ?? 0,
        capital_gains_short: inc.capitalGainsSTCG ?? 0,
        capital_gains_long: inc.capitalGainsLTCG ?? 0,
        other_income: inc.otherIncome ?? 0,
        sec_80c: ded.section80C ?? 0,
        sec_80d_self: ded.section80D ?? 0,
        sec_80d_parents: 0,
        sec_80d_parents_senior: false,
        sec_80e: ded.section80E ?? 0,
        sec_80g: ded.section80G ?? 0,
        sec_80tta: ded.section80TTA ?? 0,
        nps_80ccd1b: ded.section80CCD1B ?? 0,
        nps_employer_80ccd2: ded.section80CCD2 ?? 0,
        tds_employer: inc.tdsDeducted ?? 0,
        tds_other: 0,
        advance_tax: inc.advanceTaxPaid ?? 0,
        age: inc.age ?? 30,
        pan: inc.pan ?? "",
      };
    } else {
      rawData = req.body;
    }

    const incomeData = ManualIncomeDataSchema.parse(rawData) as IncomeData;

    const comparison = compareTaxRegimes(incomeData);
    const recommended =
      comparison.recommended_regime === "OLD"
        ? comparison.old_regime
        : comparison.new_regime;

    // Use provided sessionId if it belongs to the user, otherwise create a new session
    const providedSessionId = req.body.sessionId as string | undefined;
    let session;
    if (providedSessionId) {
      session = await prisma.taxSession.findFirst({
        where: { id: providedSessionId, user_id: userId },
      });
    }
    if (!session) {
      session = await prisma.taxSession.create({
        data: {
          user_id: userId,
          tax_year: TAX_CONFIG.FY,
          status: "COMPUTATION_DONE",
        },
      });
    }

    const computationData = {
      raw_income_data: incomeData as unknown as object,
      old_regime_data: comparison.old_regime as unknown as object,
      new_regime_data: comparison.new_regime as unknown as object,
      recommended_regime: comparison.recommended_regime,
      final_tax_payable: recommended.net_tax_payable,
      tds_deducted: recommended.tds_deducted,
      refund_or_payable: recommended.refund_or_payable,
    };
    const computation = await prisma.taxComputation.upsert({
      where: { session_id: session.id },
      create: { session_id: session.id, ...computationData },
      update: { ...computationData, ai_review: Prisma.DbNull },
    });

    await prisma.taxSession.update({
      where: { id: session.id },
      data: { status: "COMPUTATION_DONE" },
    });

    const oldBreakdown = generateTaxBreakdown(comparison.old_regime);
    const newBreakdown = generateTaxBreakdown(comparison.new_regime);

    res.status(201).json({
      success: true,
      message: "Manual tax computation complete",
      data: {
        computation_id: computation.id,
        session_id: session.id,
        tax_year: TAX_CONFIG.FY,
        fy: TAX_CONFIG.FY,
        ay: TAX_CONFIG.AY,
        recommended_regime: comparison.recommended_regime,
        savings_amount: comparison.savings_amount,
        savings_percentage: comparison.savings_percentage,
        recommendation_reason: comparison.recommendation_reason,
        old_regime: {
          ...comparison.old_regime,
          breakdown_display: oldBreakdown,
        },
        new_regime: {
          ...comparison.new_regime,
          breakdown_display: newBreakdown,
        },
      },
    });
  })
);

// ─── GET /api/compute/result/:sessionId ──────────────────────────────────────
// Lookup computation by session ID (used by frontend)

router.get(
  "/result/:sessionId",
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const userId = req.user!.userId;

    const computation = await prisma.taxComputation.findFirst({
      where: { session_id: sessionId, session: { user_id: userId } },
      include: { session: { select: { id: true, tax_year: true, status: true } } },
    });

    if (!computation) throw Errors.notFound("Computation for this session");

    const oldRegime = computation.old_regime_data as unknown as import("../services/taxEngine").RegimeResult;
    const newRegime = computation.new_regime_data as unknown as import("../services/taxEngine").RegimeResult;

    res.json({
      success: true,
      data: {
        computation: {
          id: computation.id,
          session_id: computation.session_id,
          tax_year: computation.session.tax_year,
          fy: TAX_CONFIG.FY,
          ay: TAX_CONFIG.AY,
          recommended_regime: computation.recommended_regime,
          final_tax_payable: computation.final_tax_payable,
          tds_deducted: computation.tds_deducted,
          refund_or_payable: computation.refund_or_payable,
          old_regime: oldRegime,
          new_regime: newRegime,
          income_data: computation.raw_income_data,
          ai_review: computation.ai_review,
          created_at: computation.created_at,
          updated_at: computation.updated_at,
        },
        session: computation.session,
      },
    });
  })
);

// ─── GET /api/compute/:computationId ─────────────────────────────────────────

router.get(
  "/:computationId",
  asyncHandler(async (req: Request, res: Response) => {
    const { computationId } = req.params;
    const userId = req.user!.userId;

    const computation = await prisma.taxComputation.findFirst({
      where: {
        id: computationId,
        session: { user_id: userId },
      },
      include: {
        session: {
          select: { id: true, tax_year: true, status: true },
        },
      },
    });

    if (!computation) throw Errors.notFound("Computation");

    // Cast stored JSON back to RegimeResult shape
    const oldRegime = computation.old_regime_data as unknown as import("../services/taxEngine").RegimeResult;
    const newRegime = computation.new_regime_data as unknown as import("../services/taxEngine").RegimeResult;

    res.json({
      success: true,
      data: {
        computation: {
          id: computation.id,
          session_id: computation.session_id,
          tax_year: computation.session.tax_year,
          fy: TAX_CONFIG.FY,
          ay: TAX_CONFIG.AY,
          recommended_regime: computation.recommended_regime,
          final_tax_payable: computation.final_tax_payable,
          tds_deducted: computation.tds_deducted,
          refund_or_payable: computation.refund_or_payable,
          old_regime: oldRegime,
          new_regime: newRegime,
          income_data: computation.raw_income_data,
          ai_review: computation.ai_review,
          created_at: computation.created_at,
          updated_at: computation.updated_at,
        },
        session: computation.session,
      },
    });
  })
);

// ─── GET /api/compute-tax/:computationId/pdf ──────────────────────────────────
// Returns a structured computation sheet (JSON-based, frontend renders to PDF)

router.get(
  "/:computationId/pdf",
  asyncHandler(async (req: Request, res: Response) => {
    const { computationId } = req.params;
    const userId = req.user!.userId;

    const computation = await prisma.taxComputation.findFirst({
      where: {
        id: computationId,
        session: { user_id: userId },
      },
      include: {
        session: { select: { tax_year: true } },
      },
    });

    if (!computation) throw Errors.notFound("Computation");

    const incomeData = computation.raw_income_data as unknown as IncomeData;
    type RegimeJson = import("../services/taxEngine").RegimeResult;
    const recommended = (
      computation.recommended_regime === "OLD"
        ? computation.old_regime_data
        : computation.new_regime_data
    ) as unknown as RegimeJson;

    // Build structured computation sheet for PDF rendering
    const sheet = {
      title: `Income Tax Computation – FY ${TAX_CONFIG.FY} (AY ${TAX_CONFIG.AY})`,
      generated_at: new Date().toISOString(),
      taxpayer: {
        name: "Taxpayer",
        pan_masked: incomeData.pan || "Not provided",
        age: incomeData.age,
        assessment_year: TAX_CONFIG.AY,
        financial_year: TAX_CONFIG.FY,
      },
      recommended_regime: computation.recommended_regime,
      summary: {
        gross_income: recommended.gross_income,
        total_deductions: Object.values(recommended.deductions || {}).reduce(
          (a: number, b: number) => a + b,
          0
        ),
        taxable_income: recommended.taxable_income,
        tax_on_income: recommended.tax_on_income,
        rebate_87a: recommended.rebate_87a,
        surcharge: recommended.surcharge,
        cess: recommended.cess,
        total_tax: computation.final_tax_payable,
        tds_deducted: computation.tds_deducted,
        refund_or_payable: computation.refund_or_payable,
      },
      old_regime: computation.old_regime_data,
      new_regime: computation.new_regime_data,
      income_details: incomeData,
      ai_review: computation.ai_review,
      disclaimer:
        "This computation is for informational purposes only. Please verify with a qualified Chartered Accountant before filing. FileTaxAI is not liable for any errors.",
    };

    res.json({
      success: true,
      data: { computation_sheet: sheet },
    });
  })
);

export default router;
