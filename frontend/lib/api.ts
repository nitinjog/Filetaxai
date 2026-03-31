import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import {
  ApiResponse,
  AuthResponse,
  DeductionData,
  DocumentStatus,
  DocumentType,
  IncomeData,
  LoginRequest,
  PaginatedResponse,
  RegisterRequest,
  SessionStatus,
  TaxComparisonResult,
  TaxDocument,
  TaxSession,
  User,
} from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ─── Axios Instance ───────────────────────────────────────────────────────────

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// ─── Request Interceptor (JWT) ────────────────────────────────────────────────

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('filetaxai_token');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response Interceptor (401 handling) ─────────────────────────────────────

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('filetaxai_token');
        localStorage.removeItem('filetaxai_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ─── Response Normalisers ─────────────────────────────────────────────────────
// Backend uses snake_case; frontend uses camelCase. These adapt the responses.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeSession(raw: any): TaxSession {
  const s = raw?.session ?? raw;
  return {
    id: s.id,
    userId: s.user_id ?? s.userId ?? '',
    assessmentYear: s.tax_year ?? s.assessmentYear ?? s.taxYear ?? '2024-25',
    status: ((s.status ?? 'DRAFT') as string).toLowerCase() as SessionStatus,
    documents: (s.documents ?? []).map((d: unknown) => normalizeDocument(d, s.id)),
    createdAt: s.created_at ?? s.createdAt ?? new Date().toISOString(),
    updatedAt: s.updated_at ?? s.updatedAt ?? new Date().toISOString(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeDocument(raw: any, sessionId?: string): TaxDocument {
  // Normalize nested parsedData — backend stores snake_case from ParsedForm16,
  // but the compute page reads camelCase fields from ParsedDocumentData.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const normalizeParsedData = (pd: any) => {
    if (!pd) return undefined;
    return {
      // Identity
      employerName: pd.employer_name ?? pd.employerName,
      employerTAN: pd.employer_tan ?? pd.employerTAN,
      employeePAN: pd.employee_pan ?? pd.employeePAN,
      assessmentYear: pd.assessment_year ?? pd.assessmentYear,
      // Salary components
      grossSalary: pd.gross_salary ?? pd.grossSalary ?? 0,
      basicSalary: pd.basic_salary ?? pd.basicSalary ?? 0,
      hra: pd.hra_received ?? pd.hra ?? 0,
      lta: pd.lta_received ?? pd.lta ?? 0,
      specialAllowance: pd.special_allowance ?? pd.specialAllowance ?? 0,
      otherAllowances: pd.other_allowances ?? pd.otherAllowances ?? 0,
      bonus: pd.bonus ?? 0,
      standardDeduction: pd.standard_deduction ?? pd.standardDeduction ?? 0,
      professionalTax: pd.professional_tax ?? pd.professionalTax ?? 0,
      // Computed
      taxableIncome: pd.net_taxable_salary ?? pd.taxableIncome ?? 0,
      taxDeducted: pd.tds_deducted ?? pd.taxDeducted ?? 0,
      // Deductions
      section80C: pd.sec_80c_total ?? pd.section80C ?? 0,
      section80D: (pd.sec_80d_self ?? 0) + (pd.sec_80d_parents ?? 0),
      section80CCD1B: pd.nps_80ccd1b ?? pd.section80CCD1B ?? 0,
      section80CCD2: pd.nps_employer_80ccd2 ?? pd.section80CCD2 ?? 0,
      // Raw text for debugging
      rawText: pd.raw_text ?? pd.rawText,
      confidence: pd.confidence,
    };
  };

  return {
    id: raw.id,
    sessionId: raw.session_id ?? raw.sessionId ?? sessionId ?? '',
    userId: raw.user_id ?? raw.userId ?? '',
    fileName: raw.original_name ?? raw.originalName ?? raw.fileName ?? '',
    originalName: raw.original_name ?? raw.originalName ?? '',
    fileSize: raw.file_size ?? raw.fileSize ?? 0,
    mimeType: raw.mime_type ?? raw.mimeType ?? 'application/pdf',
    documentType: ((raw.type ?? raw.documentType ?? 'other') as string).toLowerCase() as DocumentType,
    status: ((raw.status ?? 'uploaded') as string).toLowerCase() as DocumentStatus,
    parsedData: normalizeParsedData(raw.parsed_data ?? raw.parsedData),
    errorMessage: raw.error_message ?? raw.errorMessage ?? undefined,
    uploadedAt: raw.created_at ?? raw.uploadedAt ?? raw.createdAt ?? new Date().toISOString(),
    parsedAt: raw.parsed_at ?? raw.parsedAt ?? undefined,
  };
}

// ─── Auth API ─────────────────────────────────────────────────────────────────

export const authApi = {
  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const res = await apiClient.post<ApiResponse<AuthResponse>>('/api/auth/login', data);
    const d = res.data.data;
    return {
      token: d.token,
      user: {
        id: d.user.id,
        name: d.user.name,
        email: d.user.email,
        createdAt: (d.user as unknown as Record<string, string>).created_at ?? d.user.createdAt,
        updatedAt: (d.user as unknown as Record<string, string>).updated_at ?? d.user.updatedAt,
      },
    };
  },

  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    const res = await apiClient.post<ApiResponse<AuthResponse>>('/api/auth/register', data);
    const d = res.data.data;
    return {
      token: d.token,
      user: {
        id: d.user.id,
        name: d.user.name,
        email: d.user.email,
        createdAt: (d.user as unknown as Record<string, string>).created_at ?? d.user.createdAt,
        updatedAt: (d.user as unknown as Record<string, string>).updated_at ?? d.user.updatedAt,
      },
    };
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/api/auth/logout');
  },

  me: async (): Promise<User> => {
    const res = await apiClient.get<ApiResponse<User>>('/api/auth/me');
    return res.data.data;
  },

  updateProfile: async (data: Partial<User>): Promise<User> => {
    const res = await apiClient.patch<ApiResponse<User>>('/api/auth/profile', data);
    return res.data.data;
  },
};

// ─── Sessions API ─────────────────────────────────────────────────────────────

export const sessionsApi = {
  create: async (assessmentYear?: string): Promise<TaxSession> => {
    const year = assessmentYear || process.env.NEXT_PUBLIC_TAX_YEAR || '2024-25';
    // Backend expects { tax_year }
    const res = await apiClient.post('/api/sessions', { tax_year: year });
    return normalizeSession(res.data.data);
  },

  list: async (page = 1, limit = 10): Promise<PaginatedResponse<TaxSession>> => {
    const res = await apiClient.get(`/api/sessions?page=${page}&limit=${limit}`);
    const d = res.data.data;
    // Backend may return { sessions, total, page, limit } or paginated shape
    const items = (d.sessions ?? d.items ?? []).map(normalizeSession);
    return {
      items,
      total: d.total ?? items.length,
      page: d.page ?? page,
      limit: d.limit ?? limit,
      totalPages: d.totalPages ?? d.total_pages ?? Math.ceil((d.total ?? items.length) / limit),
    };
  },

  get: async (sessionId: string): Promise<TaxSession> => {
    const res = await apiClient.get(`/api/sessions/${sessionId}`);
    return normalizeSession(res.data.data);
  },

  delete: async (sessionId: string): Promise<void> => {
    await apiClient.delete(`/api/sessions/${sessionId}`);
  },
};

// ─── Documents API ────────────────────────────────────────────────────────────

export const documentsApi = {
  upload: async (
    sessionId: string,
    file: File,
    documentType: string,
    onProgress?: (progress: number) => void
  ): Promise<TaxDocument> => {
    const formData = new FormData();
    formData.append('file', file);
    // Backend accepts both camelCase and snake_case field names
    formData.append('documentType', documentType);
    formData.append('sessionId', sessionId);

    const res = await apiClient.post(
      '/api/documents/upload',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total && onProgress) {
            const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(pct);
          }
        },
      }
    );
    return normalizeDocument(res.data.data, sessionId);
  },

  list: async (sessionId: string): Promise<TaxDocument[]> => {
    const res = await apiClient.get(`/api/documents?sessionId=${sessionId}`);
    const raw = res.data.data;
    const docs = Array.isArray(raw) ? raw : (raw.documents ?? []);
    return docs.map((d: unknown) => normalizeDocument(d, sessionId));
  },

  delete: async (documentId: string): Promise<void> => {
    await apiClient.delete(`/api/documents/${documentId}`);
  },

  // Parse routes live at /api/parse/...
  parse: async (documentId: string): Promise<TaxDocument> => {
    const res = await apiClient.post(`/api/parse/${documentId}`);
    return normalizeDocument(res.data.data);
  },

  parseAll: async (sessionId: string): Promise<TaxDocument[]> => {
    const res = await apiClient.post(`/api/parse/session/${sessionId}`);
    const raw = res.data.data;
    const docs = Array.isArray(raw) ? raw : (raw.documents ?? []);
    return docs.map((d: unknown) => normalizeDocument(d, sessionId));
  },
};

// ─── Compute API ──────────────────────────────────────────────────────────────

export const computeApi = {
  computeFromSession: async (sessionId: string): Promise<TaxComparisonResult> => {
    const res = await apiClient.post(`/api/compute/session/${sessionId}`);
    return normalizeComputationResult(res.data.data);
  },

  computeManual: async (
    sessionId: string,
    income: IncomeData,
    deductions: DeductionData
  ): Promise<TaxComparisonResult> => {
    const res = await apiClient.post('/api/compute/manual', { sessionId, income, deductions });
    return normalizeComputationResult(res.data.data);
  },

  getResult: async (sessionId: string): Promise<TaxComparisonResult> => {
    const res = await apiClient.get(`/api/compute/result/${sessionId}`);
    return normalizeComputationResult(res.data.data?.computation ?? res.data.data);
  },
};

// ─── Computation Result Normaliser ────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeComputationResult(raw: any): TaxComparisonResult {
  if (!raw) throw new Error('Empty computation result');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const normalizeRegime = (r: any, regime: 'old' | 'new') => ({
    regime,
    grossTotalIncome: r.gross_income ?? r.grossTotalIncome ?? 0,
    totalDeductions: Object.values(r.deductions ?? {}).reduce((a: number, v) => a + (v as number), 0),
    taxableIncome: r.taxable_income ?? r.taxableIncome ?? 0,
    taxBeforeRebate: r.tax_on_income ?? r.taxBeforeRebate ?? 0,
    rebate87A: r.rebate_87a ?? r.rebate87A ?? 0,
    taxAfterRebate: (r.tax_on_income ?? 0) - (r.rebate_87a ?? 0),
    surcharge: r.surcharge ?? 0,
    educationCess: r.cess ?? r.educationCess ?? 0,
    totalTax: r.net_tax_payable ?? r.totalTax ?? 0,
    totalTaxesPaid: r.tds_deducted ?? r.totalTaxesPaid ?? 0,
    refundOrPayable: r.refund_or_payable ?? r.refundOrPayable ?? 0,
    effectiveRate: r.effective_rate ?? r.effectiveRate ?? 0,
    slabs: (r.breakdown ?? r.slabs ?? []).map((s: Record<string, unknown>) => ({
      from: s.min ?? s.from ?? 0,
      to: s.max === Infinity ? null : (s.max ?? s.to ?? null),
      rate: s.rate ?? 0,
      taxOnSlab: s.tax ?? s.taxOnSlab ?? 0,
    })),
  });

  const oldRegime = normalizeRegime(raw.old_regime ?? raw.oldRegime ?? {}, 'old');
  const newRegime = normalizeRegime(raw.new_regime ?? raw.newRegime ?? {}, 'new');
  const recommended = ((raw.recommended_regime ?? raw.recommendedRegime ?? 'NEW') as string).toLowerCase() as 'old' | 'new';

  return {
    oldRegime,
    newRegime,
    recommendedRegime: recommended,
    savings: Math.abs(raw.savings_amount ?? raw.savings ?? (oldRegime.totalTax - newRegime.totalTax)),
    savingsPercentage: raw.savings_percentage ?? raw.savingsPercentage ?? 0,
    reasons: raw.reasons ?? (raw.recommendation_reason ? [raw.recommendation_reason] : []),
    aiExplanation: raw.ai_explanation ?? raw.aiExplanation,
    missedDeductions: raw.missed_deductions ?? raw.missedDeductions,
  };
}

// ─── AI Review API ────────────────────────────────────────────────────────────

export const aiReviewApi = {
  getReview: async (sessionId: string): Promise<{ review: string; score: number }> => {
    const res = await apiClient.get(`/api/ai-review/${sessionId}`);
    return res.data.data;
  },

  getExplanation: async (sessionId: string): Promise<{ explanation: string; highlights: string[] }> => {
    const res = await apiClient.get(`/api/ai-review/${sessionId}/explanation`);
    return res.data.data;
  },

  getSuggestions: async (
    sessionId: string
  ): Promise<{ suggestions: Array<{ section: string; description: string; saving: number }> }> => {
    const res = await apiClient.get(`/api/ai-review/${sessionId}/suggestions`);
    return res.data.data;
  },
};

export default apiClient;
