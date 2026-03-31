// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  pan?: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

// ─── Documents ────────────────────────────────────────────────────────────────

export type DocumentType = 'form16' | 'form26as' | 'ais' | 'salary_slip' | 'other';
export type DocumentStatus = 'uploaded' | 'parsing' | 'parsed' | 'error';

export interface TaxDocument {
  id: string;
  sessionId: string;
  userId: string;
  fileName: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  documentType: DocumentType;
  status: DocumentStatus;
  parsedData?: ParsedDocumentData;
  errorMessage?: string;
  uploadedAt: string;
  parsedAt?: string;
}

export interface ParsedDocumentData {
  // Form 16
  employerName?: string;
  employerTAN?: string;
  employeePAN?: string;
  assessmentYear?: string;
  grossSalary?: number;
  taxableIncome?: number;
  taxDeducted?: number;
  professionalTax?: number;
  standardDeduction?: number;
  hra?: number;
  lta?: number;
  otherAllowances?: number;

  // Form 26AS / AIS
  tdsEntries?: TDSEntry[];
  totalTDSDeducted?: number;
  advanceTaxPaid?: number;
  selfAssessmentTax?: number;

  // Salary slip
  basicSalary?: number;
  hra2?: number;
  specialAllowance?: number;
  providentFund?: number;

  // Generic
  rawText?: string;
  confidence?: number;
}

export interface TDSEntry {
  deductorName: string;
  deductorTAN: string;
  amount: number;
  tdsDeducted: number;
  quarter: string;
}

// ─── Income & Deductions ──────────────────────────────────────────────────────

export interface IncomeData {
  // Salary income
  grossSalary: number;
  basicSalary?: number;
  hra?: number;
  lta?: number;
  specialAllowance?: number;
  otherAllowances?: number;

  // HRA exemption inputs
  rentPaid?: number;
  isMetroCity?: boolean;

  // Other income
  otherIncome?: number;
  interestIncome?: number;
  rentalIncome?: number;
  capitalGainsSTCG?: number;
  capitalGainsLTCG?: number;
  businessIncome?: number;

  // Taxes already paid
  tdsDeducted?: number;
  advanceTaxPaid?: number;
  selfAssessmentTax?: number;
}

export interface DeductionData {
  // Chapter VI-A
  section80C?: number;     // PF, PPF, ELSS, LIC, etc.
  section80CCC?: number;   // Pension fund
  section80CCD1?: number;  // NPS employee contribution
  section80CCD1B?: number; // NPS additional (50k)
  section80CCD2?: number;  // NPS employer contribution
  section80D?: number;     // Health insurance
  section80DD?: number;    // Disabled dependent
  section80DDB?: number;   // Specified diseases
  section80E?: number;     // Education loan interest
  section80EEA?: number;   // Home loan interest (affordable housing)
  section80G?: number;     // Donations
  section80GG?: number;    // Rent paid (no HRA)
  section80TTA?: number;   // Savings interest (up to 10k)
  section80TTB?: number;   // Senior citizen interest (up to 50k)
  section80U?: number;     // Self disability

  // Housing loan
  homeLoanInterest?: number;  // Section 24(b)

  // Professional tax
  professionalTax?: number;

  // Standard deduction (auto-applied)
  standardDeduction?: number;
}

// ─── Tax Computation ──────────────────────────────────────────────────────────

export interface RegimeSlab {
  from: number;
  to: number | null;
  rate: number;
  taxOnSlab: number;
}

export interface RegimeResult {
  regime: 'old' | 'new';
  grossTotalIncome: number;
  totalDeductions: number;
  taxableIncome: number;
  taxBeforeRebate: number;
  rebate87A: number;
  taxAfterRebate: number;
  surcharge: number;
  educationCess: number;
  totalTax: number;
  totalTaxesPaid: number;
  refundOrPayable: number;
  effectiveRate: number;
  slabs: RegimeSlab[];
}

export interface TaxComparisonResult {
  oldRegime: RegimeResult;
  newRegime: RegimeResult;
  recommendedRegime: 'old' | 'new';
  savings: number;
  savingsPercentage: number;
  reasons: string[];
  aiExplanation?: string;
  missedDeductions?: MissedDeduction[];
}

export interface MissedDeduction {
  section: string;
  description: string;
  maxLimit: number;
  estimatedSaving: number;
  applicableFor: string;
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export type SessionStatus = 'draft' | 'documents_uploaded' | 'computed' | 'filed';

export interface TaxSession {
  id: string;
  userId: string;
  assessmentYear: string;
  status: SessionStatus;
  documents: TaxDocument[];
  incomeData?: IncomeData;
  deductionData?: DeductionData;
  computationResult?: TaxComparisonResult;
  createdAt: string;
  updatedAt: string;
}

// ─── API Responses ────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
  statusCode: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Form Types ───────────────────────────────────────────────────────────────

export interface TaxFormData {
  income: IncomeData;
  deductions: DeductionData;
}

export type ITRFormType = 'ITR-1' | 'ITR-2' | 'ITR-3' | 'ITR-4';

export interface ITRRecommendation {
  formType: ITRFormType;
  reason: string;
  applicableConditions: string[];
}
