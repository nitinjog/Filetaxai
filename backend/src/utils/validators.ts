import { z } from "zod";

// ─── Auth Validators ──────────────────────────────────────────────────────────

export const RegisterSchema = z.object({
  email: z
    .string()
    .email("Invalid email address")
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password too long")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must contain at least one uppercase, lowercase, and number"
    ),
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name too long")
    .trim(),
  pan_last4: z
    .string()
    .length(4, "PAN last 4 characters must be exactly 4")
    .regex(/^\d{4}$/, "PAN last 4 must be digits")
    .optional(),
});

export const LoginSchema = z.object({
  email: z.string().email("Invalid email address").toLowerCase().trim(),
  password: z.string().min(1, "Password is required"),
});

export const RefreshTokenSchema = z.object({
  refresh_token: z.string().min(1, "Refresh token is required"),
});

// ─── Session Validators ───────────────────────────────────────────────────────

export const CreateSessionSchema = z.object({
  tax_year: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Tax year must be in format YYYY-YY (e.g. 2024-25)")
    .default("2024-25"),
});

export const UpdateSessionStatusSchema = z.object({
  status: z.enum([
    "DRAFT",
    "DOCUMENTS_UPLOADED",
    "PARSING_COMPLETE",
    "COMPUTATION_DONE",
    "AI_REVIEWED",
    "FILED",
  ]),
});

// ─── Document Validators ──────────────────────────────────────────────────────

export const DocumentTypeSchema = z.enum([
  "FORM16",
  "FORM26AS",
  "AIS",
  "SALARY_SLIP",
  "OTHER",
]);

export const UploadDocumentSchema = z.object({
  session_id: z.string().uuid("Invalid session ID"),
  document_type: DocumentTypeSchema,
});

// ─── Manual Tax Computation Validator ────────────────────────────────────────

export const ManualIncomeDataSchema = z.object({
  // Employment
  gross_salary: z.number().min(0).default(0),
  basic_salary: z.number().min(0).default(0),
  hra_received: z.number().min(0).default(0),
  city_type: z.enum(["METRO", "NON_METRO"]).default("NON_METRO"),
  rent_paid_annual: z.number().min(0).default(0),
  special_allowance: z.number().min(0).default(0),
  other_allowances: z.number().min(0).default(0),
  bonus: z.number().min(0).default(0),
  lta_received: z.number().min(0).default(0),
  lta_claimed: z.number().min(0).default(0),

  // Other income
  interest_income: z.number().min(0).default(0),
  rental_income: z.number().min(0).default(0),
  capital_gains_short: z.number().min(0).default(0),
  capital_gains_long: z.number().min(0).default(0),
  other_income: z.number().min(0).default(0),

  // Deductions (Old Regime)
  sec_80c: z.number().min(0).max(200000).default(0),
  sec_80d_self: z.number().min(0).max(100000).default(0),
  sec_80d_parents: z.number().min(0).max(100000).default(0),
  sec_80d_parents_senior: z.boolean().default(false),
  sec_80e: z.number().min(0).default(0),
  sec_80g: z.number().min(0).default(0),
  sec_80tta: z.number().min(0).max(100000).default(0),
  nps_80ccd1b: z.number().min(0).max(50000).default(0),
  nps_employer_80ccd2: z.number().min(0).default(0),

  // TDS
  tds_employer: z.number().min(0).default(0),
  tds_other: z.number().min(0).default(0),
  advance_tax: z.number().min(0).default(0),

  // Personal
  age: z.number().min(18).max(120).default(30),
  pan: z.string().optional().default(""),
});

// ─── Parse Route Validators ───────────────────────────────────────────────────

export const ParseDocumentSchema = z.object({
  document_id: z.string().uuid("Invalid document ID"),
});

export const ParseSessionSchema = z.object({
  session_id: z.string().uuid("Invalid session ID"),
});

// ─── AI Review Validators ─────────────────────────────────────────────────────

export const AIReviewSchema = z.object({
  computation_id: z.string().uuid("Invalid computation ID"),
  include_suggestions: z.boolean().default(true),
  include_anomaly_detection: z.boolean().default(true),
});

// ─── Pagination Validators ────────────────────────────────────────────────────

export const PaginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
});

// ─── Type Exports ─────────────────────────────────────────────────────────────

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type CreateSessionInput = z.infer<typeof CreateSessionSchema>;
export type UpdateSessionStatusInput = z.infer<typeof UpdateSessionStatusSchema>;
export type ManualIncomeDataInput = z.infer<typeof ManualIncomeDataSchema>;
export type UploadDocumentInput = z.infer<typeof UploadDocumentSchema>;
export type AIReviewInput = z.infer<typeof AIReviewSchema>;
