import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  TaxSession,
  TaxDocument,
  IncomeData,
  DeductionData,
  TaxComparisonResult,
} from '@/lib/types';

interface TaxState {
  currentSession: TaxSession | null;
  documents: TaxDocument[];
  incomeData: IncomeData | null;
  deductionData: DeductionData | null;
  computationResult: TaxComparisonResult | null;
  isComputing: boolean;
  isParsing: boolean;
}

interface TaxActions {
  setCurrentSession: (session: TaxSession | null) => void;
  setDocuments: (documents: TaxDocument[]) => void;
  addDocument: (document: TaxDocument) => void;
  updateDocument: (documentId: string, updates: Partial<TaxDocument>) => void;
  removeDocument: (documentId: string) => void;
  setIncomeData: (income: IncomeData) => void;
  setDeductionData: (deductions: DeductionData) => void;
  setComputationResult: (result: TaxComparisonResult | null) => void;
  setIsComputing: (computing: boolean) => void;
  setIsParsing: (parsing: boolean) => void;
  clearSession: () => void;
}

type TaxStore = TaxState & TaxActions;

const defaultIncomeData: IncomeData = {
  grossSalary: 0,
  basicSalary: 0,
  hra: 0,
  lta: 0,
  specialAllowance: 0,
  otherAllowances: 0,
  rentPaid: 0,
  isMetroCity: false,
  otherIncome: 0,
  interestIncome: 0,
  rentalIncome: 0,
  capitalGainsSTCG: 0,
  capitalGainsLTCG: 0,
  tdsDeducted: 0,
  advanceTaxPaid: 0,
  selfAssessmentTax: 0,
};

const defaultDeductionData: DeductionData = {
  section80C: 0,
  section80CCD1B: 0,
  section80CCD2: 0,
  section80D: 0,
  section80E: 0,
  section80EEA: 0,
  section80G: 0,
  section80TTA: 0,
  homeLoanInterest: 0,
  professionalTax: 0,
};

export const useTaxStore = create<TaxStore>()(
  persist(
    (set) => ({
      // State
      currentSession: null,
      documents: [],
      incomeData: null,
      deductionData: null,
      computationResult: null,
      isComputing: false,
      isParsing: false,

      // Actions
      setCurrentSession: (session) => set({ currentSession: session }),

      setDocuments: (documents) => set({ documents }),

      addDocument: (document) =>
        set((state) => ({
          documents: [...state.documents.filter((d) => d.id !== document.id), document],
        })),

      updateDocument: (documentId, updates) =>
        set((state) => ({
          documents: state.documents.map((d) =>
            d.id === documentId ? { ...d, ...updates } : d
          ),
        })),

      removeDocument: (documentId) =>
        set((state) => ({
          documents: state.documents.filter((d) => d.id !== documentId),
        })),

      setIncomeData: (income) => set({ incomeData: income }),

      setDeductionData: (deductions) => set({ deductionData: deductions }),

      setComputationResult: (result) => set({ computationResult: result }),

      setIsComputing: (computing) => set({ isComputing: computing }),

      setIsParsing: (parsing) => set({ isParsing: parsing }),

      clearSession: () =>
        set({
          currentSession: null,
          documents: [],
          incomeData: null,
          deductionData: null,
          computationResult: null,
          isComputing: false,
          isParsing: false,
        }),
    }),
    {
      name: 'filetaxai_tax',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined'
          ? sessionStorage
          : { getItem: () => null, setItem: () => {}, removeItem: () => {} }
      ),
      partialize: (state) => ({
        currentSession: state.currentSession,
        documents: state.documents,
        incomeData: state.incomeData,
        deductionData: state.deductionData,
        computationResult: state.computationResult,
      }),
    }
  )
);

export { defaultIncomeData, defaultDeductionData };
