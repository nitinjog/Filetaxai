'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowRight,
  Calculator,
  HelpCircle,
  IndianRupee,
  Info,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTaxStore, defaultIncomeData, defaultDeductionData } from '@/store/taxStore';
import { useComputeTax, useDocuments } from '@/hooks/useTaxComputation';
import { DeductionData, IncomeData } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

const incomeSchema = z.object({
  grossSalary: z.number().min(0),
  basicSalary: z.number().min(0).optional(),
  hra: z.number().min(0).optional(),
  lta: z.number().min(0).optional(),
  specialAllowance: z.number().min(0).optional(),
  otherAllowances: z.number().min(0).optional(),
  rentPaid: z.number().min(0).optional(),
  isMetroCity: z.boolean().optional(),
  otherIncome: z.number().min(0).optional(),
  interestIncome: z.number().min(0).optional(),
  rentalIncome: z.number().min(0).optional(),
  tdsDeducted: z.number().min(0).optional(),
  advanceTaxPaid: z.number().min(0).optional(),
  selfAssessmentTax: z.number().min(0).optional(),
});

const deductionSchema = z.object({
  section80C: z.number().min(0).max(150000).optional(),
  section80CCD1B: z.number().min(0).max(50000).optional(),
  section80CCD2: z.number().min(0).optional(),
  section80D: z.number().min(0).max(100000).optional(),
  section80E: z.number().min(0).optional(),
  section80EEA: z.number().min(0).max(150000).optional(),
  section80G: z.number().min(0).optional(),
  section80TTA: z.number().min(0).max(10000).optional(),
  homeLoanInterest: z.number().min(0).max(200000).optional(),
  professionalTax: z.number().min(0).max(2500).optional(),
});

type TaxFormData = {
  income: z.infer<typeof incomeSchema>;
  deductions: z.infer<typeof deductionSchema>;
};

function CurrencyInput({
  label,
  name,
  value,
  onChange,
  tooltip,
  maxLimit,
  placeholder = '0',
}: {
  label: string;
  name: string;
  value: number | undefined;
  onChange: (val: number) => void;
  tooltip?: string;
  maxLimit?: number;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={name} className="text-sm font-medium text-slate-700">
          {label}
        </Label>
        {tooltip && (
          <div className="group relative">
            <HelpCircle className="h-3.5 w-3.5 text-slate-400 cursor-help" />
            <div className="absolute bottom-5 left-0 z-10 hidden w-56 rounded-lg bg-slate-800 p-2.5 text-xs text-white shadow-lg group-hover:block">
              {tooltip}
              {maxLimit && (
                <p className="mt-1 text-slate-300 font-medium">
                  Max: {formatCurrency(maxLimit)}
                </p>
              )}
            </div>
          </div>
        )}
        {maxLimit && (
          <span className="ml-auto text-xs text-slate-400">Max: {formatCurrency(maxLimit)}</span>
        )}
      </div>
      <div className="relative">
        <IndianRupee className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <Input
          id={name}
          type="number"
          min="0"
          placeholder={placeholder}
          value={value || ''}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="pl-8 tabular-nums"
        />
      </div>
    </div>
  );
}

export default function ComputePage() {
  const router = useRouter();
  const { currentSession, documents, incomeData, deductionData, setIncomeData, setDeductionData } =
    useTaxStore();
  const computeTax = useComputeTax();

  // Fetch latest documents (with parsed_data) when landing on this page
  useDocuments(currentSession?.id || '');

  // Pre-fill from parsed documents
  const parsedDoc = documents.find((d) => d.status === 'parsed' && d.documentType === 'form16');
  const parsedData = parsedDoc?.parsedData;

  const defaultIncome: IncomeData = {
    ...defaultIncomeData,
    ...(incomeData || {}),
    ...(parsedData
      ? {
          grossSalary: parsedData.grossSalary || 0,
          basicSalary: parsedData.basicSalary || 0,
          hra: parsedData.hra || 0,
          lta: parsedData.lta || 0,
          specialAllowance: parsedData.specialAllowance || 0,
          otherAllowances: parsedData.otherAllowances || 0,
          tdsDeducted: parsedData.taxDeducted || 0,
        }
      : {}),
  };

  const defaultDeductions = {
    ...defaultDeductionData,
    ...(deductionData || {}),
    ...(parsedData
      ? {
          ...(parsedData.professionalTax ? { professionalTax: parsedData.professionalTax } : {}),
          ...(parsedData.section80C ? { section80C: parsedData.section80C } : {}),
          ...(parsedData.section80D ? { section80D: parsedData.section80D } : {}),
          ...(parsedData.section80CCD1B ? { section80CCD1B: parsedData.section80CCD1B } : {}),
          ...(parsedData.section80CCD2 ? { section80CCD2: parsedData.section80CCD2 } : {}),
        }
      : {}),
  };

  const {
    register: regIncome,
    handleSubmit: handleIncomeSubmit,
    watch: watchIncome,
    setValue: setIncomeValue,
    reset: resetIncome,
    formState: { errors: incomeErrors },
  } = useForm<IncomeData>({ defaultValues: defaultIncome });

  const {
    register: regDeduction,
    watch: watchDeduction,
    setValue: setDeductionValue,
    reset: resetDeductions,
  } = useForm<DeductionData>({ defaultValues: defaultDeductions });

  // Re-populate form when parsedData arrives asynchronously after mount
  useEffect(() => {
    if (parsedData) {
      resetIncome(defaultIncome);
      resetDeductions(defaultDeductions);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsedDoc?.id]);

  const incomeValues = watchIncome();
  const deductionValues = watchDeduction();

  const totalIncome =
    (incomeValues.grossSalary || 0) +
    (incomeValues.otherIncome || 0) +
    (incomeValues.interestIncome || 0) +
    (incomeValues.rentalIncome || 0);

  const totalDeductions =
    Math.min(incomeValues.grossSalary || 0, 50000) + // standard deduction
    Math.min((deductionValues.section80C || 0) + (deductionValues.section80CCD1B || 0), 200000) +
    (deductionValues.section80D || 0) +
    (deductionValues.homeLoanInterest || 0) +
    (deductionValues.section80E || 0) +
    (deductionValues.section80G || 0) +
    (deductionValues.professionalTax || 0);

  const onSubmit = async () => {
    if (!currentSession) return;

    const income = incomeValues;
    const deductions = deductionValues;

    setIncomeData(income);
    setDeductionData(deductions);

    await computeTax.mutateAsync({
      sessionId: currentSession.id,
      income,
      deductions,
    });

    router.push('/results');
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tax Computation</h1>
          <p className="mt-1 text-slate-600">
            {parsedData
              ? 'Form 16 data pre-filled. Review and add any missing details.'
              : 'Enter your income and deduction details to compute tax.'}
          </p>
        </div>
        {parsedData && (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-700 shrink-0">
            <Info className="h-3.5 w-3.5" />
            Pre-filled from Form 16
          </div>
        )}
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Gross Income', value: totalIncome },
          { label: 'Standard Deduction', value: Math.min(totalIncome, 50000) },
          { label: 'Chapter VI-A', value: totalDeductions - Math.min(totalIncome, 50000) },
          { label: 'Est. Taxable', value: Math.max(0, totalIncome - totalDeductions) },
        ].map((item) => (
          <div key={item.label} className="rounded-lg bg-slate-50 border border-slate-100 p-3">
            <p className="text-xs text-slate-500">{item.label}</p>
            <p className="text-sm font-bold text-slate-800 tabular-nums mt-0.5">
              {formatCurrency(item.value)}
            </p>
          </div>
        ))}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
        <Tabs defaultValue="income" className="space-y-4">
          <TabsList className="w-full md:w-auto">
            <TabsTrigger value="income" className="gap-2">
              <IndianRupee className="h-3.5 w-3.5" />
              Income Details
            </TabsTrigger>
            <TabsTrigger value="deductions" className="gap-2">
              <Calculator className="h-3.5 w-3.5" />
              Deductions
            </TabsTrigger>
          </TabsList>

          {/* Income Tab */}
          <TabsContent value="income">
            <div className="space-y-4">
              {/* Salary Income */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Salary Income</CardTitle>
                  <CardDescription>
                    Enter annual figures (April 2024 – March 2025)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <CurrencyInput
                      label="Gross Salary (CTC)"
                      name="grossSalary"
                      value={incomeValues.grossSalary}
                      onChange={(v) => setIncomeValue('grossSalary', v)}
                      tooltip="Total salary received before any deductions. Found in Form 16 Part B."
                    />
                    <CurrencyInput
                      label="Basic Salary"
                      name="basicSalary"
                      value={incomeValues.basicSalary}
                      onChange={(v) => setIncomeValue('basicSalary', v)}
                      tooltip="Basic component of salary. Used to calculate HRA exemption and PF."
                    />
                    <CurrencyInput
                      label="HRA Received"
                      name="hra"
                      value={incomeValues.hra}
                      onChange={(v) => setIncomeValue('hra', v)}
                      tooltip="House Rent Allowance received from employer."
                    />
                    <CurrencyInput
                      label="Rent Paid (Annual)"
                      name="rentPaid"
                      value={incomeValues.rentPaid}
                      onChange={(v) => setIncomeValue('rentPaid', v)}
                      tooltip="Total rent paid in the financial year. Required for HRA exemption calculation."
                    />
                    <CurrencyInput
                      label="LTA Received"
                      name="lta"
                      value={incomeValues.lta}
                      onChange={(v) => setIncomeValue('lta', v)}
                      tooltip="Leave Travel Allowance received from employer."
                    />
                    <CurrencyInput
                      label="Special Allowance"
                      name="specialAllowance"
                      value={incomeValues.specialAllowance}
                      onChange={(v) => setIncomeValue('specialAllowance', v)}
                      tooltip="Any other special allowances paid by employer."
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Other Income */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Other Income Sources</CardTitle>
                  <CardDescription>Income other than salary</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <CurrencyInput
                      label="Interest Income (FD/Savings)"
                      name="interestIncome"
                      value={incomeValues.interestIncome}
                      onChange={(v) => setIncomeValue('interestIncome', v)}
                      tooltip="Interest from FDs, savings accounts, RDs. Found in Form 26AS/AIS."
                    />
                    <CurrencyInput
                      label="Rental Income"
                      name="rentalIncome"
                      value={incomeValues.rentalIncome}
                      onChange={(v) => setIncomeValue('rentalIncome', v)}
                      tooltip="Net rental income after property tax and 30% standard deduction."
                    />
                    <CurrencyInput
                      label="Other Income"
                      name="otherIncome"
                      value={incomeValues.otherIncome}
                      onChange={(v) => setIncomeValue('otherIncome', v)}
                      tooltip="Any other taxable income not covered above."
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Taxes Paid */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Taxes Already Paid</CardTitle>
                  <CardDescription>TDS and advance tax deducted</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <CurrencyInput
                      label="TDS Deducted by Employer"
                      name="tdsDeducted"
                      value={incomeValues.tdsDeducted}
                      onChange={(v) => setIncomeValue('tdsDeducted', v)}
                      tooltip="Total TDS deducted by employer. Found in Form 16 Part A."
                    />
                    <CurrencyInput
                      label="Advance Tax Paid"
                      name="advanceTaxPaid"
                      value={incomeValues.advanceTaxPaid}
                      onChange={(v) => setIncomeValue('advanceTaxPaid', v)}
                      tooltip="Advance tax paid during the year (if any). Found in Form 26AS."
                    />
                    <CurrencyInput
                      label="Self Assessment Tax"
                      name="selfAssessmentTax"
                      value={incomeValues.selfAssessmentTax}
                      onChange={(v) => setIncomeValue('selfAssessmentTax', v)}
                      tooltip="Tax paid before filing ITR to make up any shortfall."
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Deductions Tab */}
          <TabsContent value="deductions">
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Chapter VI-A Deductions</CardTitle>
                  <CardDescription>
                    These deductions apply only under the Old Tax Regime
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <CurrencyInput
                      label="Section 80C"
                      name="section80C"
                      value={deductionValues.section80C}
                      onChange={(v) => setDeductionValue('section80C', v)}
                      tooltip="PPF, ELSS, LIC premium, NSC, ULIP, EPF, children's tuition fees, home loan principal repayment."
                      maxLimit={150000}
                    />
                    <CurrencyInput
                      label="Section 80CCD(1B) – NPS"
                      name="section80CCD1B"
                      value={deductionValues.section80CCD1B}
                      onChange={(v) => setDeductionValue('section80CCD1B', v)}
                      tooltip="Additional deduction for NPS (National Pension Scheme) contribution over 80C limit."
                      maxLimit={50000}
                    />
                    <CurrencyInput
                      label="Section 80D – Health Insurance"
                      name="section80D"
                      value={deductionValues.section80D}
                      onChange={(v) => setDeductionValue('section80D', v)}
                      tooltip="Health insurance premium for self (₹25,000), parents (₹25,000 extra, or ₹50,000 if senior citizens)."
                      maxLimit={100000}
                    />
                    <CurrencyInput
                      label="Section 80E – Education Loan"
                      name="section80E"
                      value={deductionValues.section80E}
                      onChange={(v) => setDeductionValue('section80E', v)}
                      tooltip="Interest paid on education loan. No upper limit. Available for 8 years."
                    />
                    <CurrencyInput
                      label="Section 80EEA – Home Loan Interest"
                      name="section80EEA"
                      value={deductionValues.section80EEA}
                      onChange={(v) => setDeductionValue('section80EEA', v)}
                      tooltip="Additional home loan interest deduction for affordable housing (stamp value ≤ ₹45L)."
                      maxLimit={150000}
                    />
                    <CurrencyInput
                      label="Section 80G – Donations"
                      name="section80G"
                      value={deductionValues.section80G}
                      onChange={(v) => setDeductionValue('section80G', v)}
                      tooltip="Donations to approved charitable organizations. 50% or 100% deduction based on fund."
                    />
                    <CurrencyInput
                      label="Section 80TTA – Savings Interest"
                      name="section80TTA"
                      value={deductionValues.section80TTA}
                      onChange={(v) => setDeductionValue('section80TTA', v)}
                      tooltip="Interest from savings account (not FDs). For taxpayers below 60 years."
                      maxLimit={10000}
                    />
                    <CurrencyInput
                      label="Employer NPS Contribution (80CCD2)"
                      name="section80CCD2"
                      value={deductionValues.section80CCD2}
                      onChange={(v) => setDeductionValue('section80CCD2', v)}
                      tooltip="Employer's contribution to NPS on behalf of employee. Up to 10% of Basic + DA."
                    />
                  </div>
                </CardContent>
              </Card>

              {/* House property */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">House Property</CardTitle>
                  <CardDescription>Home loan interest deduction under Section 24(b)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <CurrencyInput
                      label="Home Loan Interest (Self-Occupied)"
                      name="homeLoanInterest"
                      value={deductionValues.homeLoanInterest}
                      onChange={(v) => setDeductionValue('homeLoanInterest', v)}
                      tooltip="Interest paid on home loan for self-occupied property. Max ₹2 lakh per year."
                      maxLimit={200000}
                    />
                    <CurrencyInput
                      label="Professional Tax Paid"
                      name="professionalTax"
                      value={deductionValues.professionalTax}
                      onChange={(v) => setDeductionValue('professionalTax', v)}
                      tooltip="Professional tax deducted from salary. Max ₹2,500 per year."
                      maxLimit={2500}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Summary */}
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">
                      Total Deductions (Old Regime)
                    </span>
                    <span className="text-lg font-bold text-primary tabular-nums">
                      {formatCurrency(totalDeductions)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Includes ₹50,000 standard deduction + Chapter VI-A deductions
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <Separator className="my-4" />

        {/* Submit */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-600">
            <p>
              Gross Income:{' '}
              <strong className="text-slate-900">{formatCurrency(totalIncome)}</strong>
            </p>
            <p className="text-xs text-slate-400">
              We&apos;ll compute both Old and New Regime taxes simultaneously
            </p>
          </div>

          <Button
            type="submit"
            size="lg"
            className="gap-2"
            disabled={computeTax.isPending || !currentSession}
          >
            {computeTax.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Computing...
              </>
            ) : (
              <>
                <Calculator className="h-4 w-4" />
                Compute Tax
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>

        {!currentSession && (
          <p className="text-xs text-red-500 flex items-center gap-1">
            <Info className="h-3.5 w-3.5" />
            Please go to Upload page to start a session first.
          </p>
        )}
      </form>
    </div>
  );
}
