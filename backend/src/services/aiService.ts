import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { IncomeData } from "./taxEngine";
import { TaxComparisonResult } from "./taxEngine";
import type { ParsedForm16 } from "./documentParser";

// ─── OpenRouter Client ────────────────────────────────────────────────────────

function createOpenRouterClient(): OpenAI {
  return new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY || "",
    baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": process.env.FRONTEND_URL || "http://localhost:3000",
      "X-Title": "FileTaxAI",
    },
  });
}

const PRIMARY_MODEL = process.env.OPENROUTER_MODEL || "openai/gpt-4o";
const GEMINI_MODEL = process.env.OPENROUTER_GEMINI_MODEL || "google/gemini-2.5-flash-preview";
const FALLBACK_MODEL = process.env.OPENROUTER_FALLBACK_MODEL || "anthropic/claude-3-5-sonnet";

// ─── Generic AI Call with Fallback ───────────────────────────────────────────

async function callAI(
  systemPrompt: string,
  userMessage: string,
  model: string = PRIMARY_MODEL,
  expectJson: boolean = true
): Promise<string> {
  const client = createOpenRouterClient();

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];

  try {
    const response = await client.chat.completions.create({
      model,
      messages,
      response_format: expectJson ? { type: "json_object" } : undefined,
      temperature: 0.1,
      max_tokens: 4096,
    });
    return response.choices[0]?.message?.content || "{}";
  } catch (primaryError) {
    console.warn(`Model ${model} failed: ${(primaryError as Error).message}. Trying fallback.`);
    try {
      const response = await client.chat.completions.create({
        model: FALLBACK_MODEL,
        messages,
        temperature: 0.1,
        max_tokens: 4096,
      });
      return response.choices[0]?.message?.content || "{}";
    } catch (fallbackError) {
      throw new Error(
        `All AI models failed. Primary: ${(primaryError as Error).message}. Fallback: ${(fallbackError as Error).message}`
      );
    }
  }
}

// ─── Indian Tax Expert System Prompt ─────────────────────────────────────────

const INDIAN_TAX_SYSTEM_PROMPT = `You are an expert Indian Chartered Accountant specialising in income tax for FY 2024-25 (AY 2025-26).
You have deep knowledge of Form 16, Form 26AS, AIS, salary slips, and all Indian tax deductions.
Always return valid JSON with exact numeric values extracted from the document. Do not guess or hallucinate numbers.
Return 0 for any field that is not present in the document.
All monetary values must be annual figures in Indian Rupees (no commas, no symbols).`;

// ─── Gemini Direct Client ─────────────────────────────────────────────────────

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");
  return new GoogleGenerativeAI(apiKey);
}

const GEMINI_FLASH_MODEL = "gemini-2.5-flash-preview-04-17";

const FORM16_EXTRACTION_PROMPT = `You are extracting data from an Indian Form 16 (TDS certificate issued by employer) for FY 2024-25.
Form 16 has two parts:
- Part A: TDS details (employer TAN, employee PAN, TDS deducted quarter-wise)
- Part B: Salary breakup (gross salary, allowances, deductions under Chapter VI-A)

Extract ALL fields and return ONLY valid JSON with these exact keys.
Use 0 for missing numbers, "" for missing strings.
Remove all commas from numbers (1,20,000 → 120000).

{
  "employer_name": "",
  "employer_tan": "",
  "employee_name": "",
  "employee_pan": "",
  "assessment_year": "2025-26",
  "financial_year": "2024-25",
  "gross_salary": 0,
  "basic_salary": 0,
  "hra_received": 0,
  "special_allowance": 0,
  "other_allowances": 0,
  "bonus": 0,
  "lta_received": 0,
  "standard_deduction": 0,
  "professional_tax": 0,
  "net_taxable_salary": 0,
  "sec_80c_total": 0,
  "sec_80d_self": 0,
  "sec_80d_parents": 0,
  "nps_80ccd1b": 0,
  "nps_employer_80ccd2": 0,
  "tds_deducted": 0,
  "tds_q1": 0,
  "tds_q2": 0,
  "tds_q3": 0,
  "tds_q4": 0
}

Rules:
- gross_salary = ANNUAL total (all components before deductions)
- tds_deducted = total for full year (should = q1+q2+q3+q4)
- standard_deduction is under Section 16(ia), typically ₹50,000
- All amounts in Indian Rupees, no symbols`;

// ─── Form 16 Extraction with Gemini 2.5 Flash ────────────────────────────────
// Primary: Google native SDK (direct) with PDF vision for best accuracy.
// Extraction chain: Gemini direct (PDF vision) → Gemini direct (text) → OpenRouter → gpt-4o

export async function extractForm16WithGemini(
  rawText: string,
  pdfBuffer?: Buffer
): Promise<ParsedForm16> {
  const GEMINI_MODELS = [GEMINI_FLASH_MODEL, "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
  const fullPrompt = `${FORM16_EXTRACTION_PROMPT}\n\nDocument text:\n${rawText.substring(0, 15000)}`;

  // ── Attempt 1: Gemini direct SDK — PDF vision (best accuracy) ────────────
  if (process.env.GEMINI_API_KEY && pdfBuffer && pdfBuffer.length > 0) {
    try {
      const genAI = getGeminiClient();
      for (const modelName of GEMINI_MODELS) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName });
          const base64Pdf = pdfBuffer.toString("base64");
          const result = await model.generateContent([
            FORM16_EXTRACTION_PROMPT,
            { inlineData: { mimeType: "application/pdf", data: base64Pdf } },
          ]);
          const jsonStr = result.response.text().replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          console.log(`[Gemini Direct PDF] Succeeded with model: ${modelName}`);
          return buildForm16Result(JSON.parse(jsonStr), rawText);
        } catch (modelErr) {
          const msg = (modelErr as Error).message;
          if (msg.includes("404") || msg.includes("not found")) continue;
          if (msg.includes("429") || msg.includes("quota")) { break; }
          throw modelErr;
        }
      }
    } catch (err) {
      console.warn("[Gemini Direct PDF] Failed:", (err as Error).message);
    }
  }

  // ── Attempt 2: Gemini direct SDK — text only ──────────────────────────────
  if (process.env.GEMINI_API_KEY && rawText.length > 50) {
    try {
      const genAI = getGeminiClient();
      for (const modelName of GEMINI_MODELS) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName });
          const result = await model.generateContent([fullPrompt]);
          const jsonStr = result.response.text().replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          console.log(`[Gemini Direct Text] Succeeded with model: ${modelName}`);
          return buildForm16Result(JSON.parse(jsonStr), rawText);
        } catch (modelErr) {
          const msg = (modelErr as Error).message;
          if (msg.includes("404") || msg.includes("not found")) continue;
          if (msg.includes("429") || msg.includes("quota")) { break; }
          throw modelErr;
        }
      }
    } catch (err) {
      console.warn("[Gemini Direct Text] Failed:", (err as Error).message);
    }
  }

  // ── Attempt 3: OpenRouter → Gemini 2.5 Flash ─────────────────────────────
  console.log("[Parse] Gemini direct unavailable, trying OpenRouter → Gemini...");
  try {
    const raw = await callAI(INDIAN_TAX_SYSTEM_PROMPT, fullPrompt, GEMINI_MODEL, true);
    const jsonStr = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return buildForm16Result(JSON.parse(jsonStr), rawText);
  } catch {
    // ── Attempt 4: OpenRouter → gpt-4o ───────────────────────────────────
    console.warn("[Parse] OpenRouter Gemini failed, trying OpenRouter → gpt-4o...");
    const raw = await callAI(INDIAN_TAX_SYSTEM_PROMPT, fullPrompt, PRIMARY_MODEL, true);
    const jsonStr = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return buildForm16Result(JSON.parse(jsonStr), rawText);
  }
}

// ─── Shared: build ParsedForm16 from AI response ──────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildForm16Result(parsed: Record<string, any>, rawText: string): ParsedForm16 {
  const NUM_FIELDS = [
    "gross_salary","basic_salary","hra_received","special_allowance","other_allowances",
    "bonus","lta_received","standard_deduction","professional_tax","net_taxable_salary",
    "sec_80c_total","sec_80d_self","sec_80d_parents","nps_80ccd1b","nps_employer_80ccd2",
    "tds_deducted","tds_q1","tds_q2","tds_q3","tds_q4",
  ];

  const result: ParsedForm16 = {
    employer_name: String(parsed.employer_name || ""),
    employer_tan: String(parsed.employer_tan || ""),
    employee_name: String(parsed.employee_name || ""),
    employee_pan: String(parsed.employee_pan || ""),
    assessment_year: String(parsed.assessment_year || "2025-26"),
    financial_year: String(parsed.financial_year || "2024-25"),
    gross_salary: 0, basic_salary: 0, hra_received: 0,
    special_allowance: 0, other_allowances: 0, bonus: 0,
    lta_received: 0, standard_deduction: 0, professional_tax: 0,
    net_taxable_salary: 0, sec_80c_details: {}, sec_80c_total: 0,
    sec_80d_self: 0, sec_80d_parents: 0, nps_80ccd1b: 0,
    tds_deducted: 0, tds_q1: 0, tds_q2: 0, tds_q3: 0, tds_q4: 0,
    raw_text: rawText,
  };

  for (const field of NUM_FIELDS) {
    const val = parsed[field];
    if (val !== undefined && val !== null && val !== "") {
      (result as unknown as Record<string, unknown>)[field] = Number(String(val).replace(/,/g, "")) || 0;
    }
  }

  // If total TDS not set but quarters are, sum them
  if (result.tds_deducted === 0 && (result.tds_q1 + result.tds_q2 + result.tds_q3 + result.tds_q4) > 0) {
    result.tds_deducted = result.tds_q1 + result.tds_q2 + result.tds_q3 + result.tds_q4;
  }

  console.log(`[AI Form16] gross_salary=${result.gross_salary}, tds=${result.tds_deducted}, employer=${result.employer_name}`);
  return result;
}

// ─── Generic Document Extraction (other doc types) ───────────────────────────

export interface ExtractedDocumentData {
  document_type: string;
  extracted_fields: Record<string, string | number | boolean | null>;
  confidence: number;
  warnings: string[];
  raw_analysis: string;
}

export async function extractStructuredData(
  rawText: string,
  documentType: string
): Promise<ExtractedDocumentData> {
  const schema = getDocumentExtractionSchema(documentType);

  const userMessage = `Extract structured data from the following ${documentType} document.
Return a JSON object with exactly these fields: ${JSON.stringify(schema, null, 2)}

Document text:
${rawText.substring(0, 8000)}

Rules:
- Return 0 for missing numeric fields, empty string for missing text fields
- Remove commas from all numbers (1,00,000 → 100000)
- All figures should be annual amounts in Indian Rupees
- confidence: 0-1 score of how complete/clear the extraction was`;

  try {
    const raw = await callAI(INDIAN_TAX_SYSTEM_PROMPT, userMessage, PRIMARY_MODEL, true);
    const result = JSON.parse(raw);
    return {
      document_type: documentType,
      extracted_fields: result.extracted_fields || result,
      confidence: Number(result.confidence) || 0.8,
      warnings: result.warnings || [],
      raw_analysis: result.raw_analysis || "",
    };
  } catch (err) {
    console.error("[extractStructuredData] Failed:", err);
    return {
      document_type: documentType,
      extracted_fields: {},
      confidence: 0,
      warnings: [`Extraction failed: ${(err as Error).message}`],
      raw_analysis: "",
    };
  }
}

function getDocumentExtractionSchema(documentType: string): Record<string, unknown> {
  switch (documentType.toUpperCase()) {
    case "FORM26AS":
      return {
        pan: "", name: "", assessment_year: "",
        total_tds: 0, advance_tax: 0, self_assessment_tax: 0,
        tds_entries: [], confidence: 0, warnings: [],
      };
    case "AIS":
      return {
        pan: "", assessment_year: "",
        salary_reported: 0, interest_income: 0, dividend_income: 0,
        rent_received: 0, sale_of_securities: 0, confidence: 0, warnings: [],
      };
    default:
      return {
        gross_salary: 0, basic_salary: 0, tds_deducted: 0,
        confidence: 0, warnings: [],
      };
  }
}

// ─── Review Tax Computation ───────────────────────────────────────────────────

export async function reviewTaxComputation(
  incomeData: IncomeData,
  computationResult: TaxComparisonResult
): Promise<{
  is_valid: boolean;
  anomalies: string[];
  suggestions: string[];
  explanation: string;
  confidence: number;
}> {
  const userMessage = `Review this Indian income tax computation for FY 2024-25.

Income Data:
${JSON.stringify(incomeData, null, 2)}

Computation Result:
- Old Regime Tax: ₹${computationResult.old_regime.net_tax_payable.toLocaleString("en-IN")}
- New Regime Tax: ₹${computationResult.new_regime.net_tax_payable.toLocaleString("en-IN")}
- Recommended: ${computationResult.recommended_regime}
- Savings: ₹${computationResult.savings_amount.toLocaleString("en-IN")}

Return JSON with:
{
  "is_valid": true/false,
  "anomalies": ["list of data inconsistencies or suspicious values"],
  "suggestions": ["list of potential deductions the user might have missed"],
  "explanation": "plain English explanation of the tax computation result for a non-expert",
  "confidence": 0.0-1.0
}`;

  try {
    const raw = await callAI(INDIAN_TAX_SYSTEM_PROMPT, userMessage, PRIMARY_MODEL, true);
    return JSON.parse(raw);
  } catch {
    return {
      is_valid: true,
      anomalies: [],
      suggestions: [],
      explanation: `Based on your income, the ${computationResult.recommended_regime} regime saves you ₹${computationResult.savings_amount.toLocaleString("en-IN")}.`,
      confidence: 0.5,
    };
  }
}

// ─── Suggest Missing Deductions ───────────────────────────────────────────────

export async function suggestMissingDeductions(
  incomeData: IncomeData
): Promise<Array<{ section: string; description: string; max_limit: number; estimated_saving: number }>> {
  const userMessage = `Given this income profile for FY 2024-25, suggest deductions the taxpayer might be missing.
${JSON.stringify(incomeData, null, 2)}

Return a JSON object with key "suggestions" containing an array of applicable but unclaimed deductions:
{ "suggestions": [{ "section": "80D", "description": "Health insurance premium for self and family", "max_limit": 25000, "estimated_saving": 7500 }] }
Only include deductions that are currently 0 but likely applicable. If none, return { "suggestions": [] }.`;

  try {
    const raw = await callAI(INDIAN_TAX_SYSTEM_PROMPT, userMessage, PRIMARY_MODEL, true);
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : (parsed.suggestions || []);
  } catch {
    return [];
  }
}

// ─── Explain in Simple Terms ──────────────────────────────────────────────────

export async function explainInSimpleTerms(
  computationResult: TaxComparisonResult,
  recommendedRegime: "OLD" | "NEW"
): Promise<string> {
  const msg = `Explain this Indian tax computation in very simple terms for someone with no finance background.
Recommended regime: ${recommendedRegime}
Tax under Old Regime: ₹${computationResult.old_regime.net_tax_payable.toLocaleString("en-IN")}
Tax under New Regime: ₹${computationResult.new_regime.net_tax_payable.toLocaleString("en-IN")}
Savings by choosing ${recommendedRegime}: ₹${computationResult.savings_amount.toLocaleString("en-IN")}

Return JSON: { "explanation": "2-3 sentence plain English explanation" }`;

  try {
    const raw = await callAI(INDIAN_TAX_SYSTEM_PROMPT, msg, PRIMARY_MODEL, true);
    const parsed = JSON.parse(raw);
    return parsed.explanation || "";
  } catch {
    return `You should file under the ${recommendedRegime} Regime to save ₹${computationResult.savings_amount.toLocaleString("en-IN")}.`;
  }
}

// ─── Detect Anomalies ─────────────────────────────────────────────────────────

export async function detectAnomalies(
  incomeData: IncomeData
): Promise<string[]> {
  const msg = `Check this income data for anomalies or inconsistencies in the context of Indian tax filing.
${JSON.stringify(incomeData, null, 2)}
Return JSON: { "anomalies": ["list of issues"] }`;

  try {
    const raw = await callAI(INDIAN_TAX_SYSTEM_PROMPT, msg, PRIMARY_MODEL, true);
    return JSON.parse(raw).anomalies || [];
  } catch {
    return [];
  }
}
