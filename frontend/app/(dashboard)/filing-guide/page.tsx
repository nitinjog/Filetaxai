'use client';

import { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Globe,
  HelpCircle,
  Info,
  List,
  Square,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTaxStore } from '@/store/taxStore';
import { formatCurrency } from '@/lib/utils';

const ITR_FORMS = [
  {
    form: 'ITR-1 (SAHAJ)',
    applicableFor: 'Most salaried employees',
    conditions: [
      'Income from salary or pension',
      'Income from one house property (not loss carry forward)',
      'Income from other sources (FD interest, etc.)',
      'Agricultural income up to ₹5,000',
      'Total income does not exceed ₹50 lakh',
    ],
    notApplicable: [
      'Director in a company',
      'Unlisted equity shares held',
      'Capital gains income',
      'Business or profession income',
      'Foreign income or assets',
    ],
    color: 'border-green-200 bg-green-50',
    badge: 'Most Common',
    badgeVariant: 'success' as const,
  },
  {
    form: 'ITR-2',
    applicableFor: 'Salaried with capital gains or multiple properties',
    conditions: [
      'Income from salary + capital gains (STCG/LTCG)',
      'Income from more than one house property',
      'Foreign assets or income',
      'Total income above ₹50 lakh',
      'Income from horse racing, lottery, etc.',
    ],
    notApplicable: [
      'Income from business or profession',
      'Partner in a partnership firm',
    ],
    color: 'border-blue-200 bg-blue-50',
    badge: 'Capital Gains',
    badgeVariant: 'info' as const,
  },
  {
    form: 'ITR-3',
    applicableFor: 'Business income + salary',
    conditions: [
      'Income from business or profession',
      'Partner in a firm',
      'All types of income',
    ],
    notApplicable: [],
    color: 'border-purple-200 bg-purple-50',
    badge: 'Business Income',
    badgeVariant: 'default' as const,
  },
  {
    form: 'ITR-4 (SUGAM)',
    applicableFor: 'Presumptive income (business/profession)',
    conditions: [
      'Business income under presumptive scheme (44AD)',
      'Profession income under 44ADA',
      'Transport under 44AE',
      'Total income up to ₹50 lakh',
    ],
    notApplicable: ['Not applicable if income > ₹50 lakh'],
    color: 'border-orange-200 bg-orange-50',
    badge: 'Presumptive',
    badgeVariant: 'warning' as const,
  },
];

const FILING_STEPS = [
  {
    step: 1,
    title: 'Register / Login on Income Tax Portal',
    description: 'Visit incometax.gov.in and log in with your PAN as user ID.',
    actions: [
      'Go to incometax.gov.in',
      'Click "Login" and enter PAN, password, and captcha',
      'If new user, register with PAN and mobile number',
    ],
    tip: 'Use PAN card as your User ID. Password was set during registration.',
    link: 'https://www.incometax.gov.in/iec/foportal/',
    linkLabel: 'Go to IT Portal',
  },
  {
    step: 2,
    title: 'Select Assessment Year and ITR Form',
    description: 'Navigate to e-File → File Income Tax Return.',
    actions: [
      'Click e-File → Income Tax Returns → File Income Tax Return',
      'Select Assessment Year: 2024-25',
      'Select Mode: Online',
      'Select ITR Form (usually ITR-1 for salaried)',
      'Select Filing Type: Original Return',
    ],
    tip: 'Assessment Year 2024-25 is for income earned in Financial Year April 2023 – March 2024.',
  },
  {
    step: 3,
    title: 'Validate Pre-filled Data',
    description: 'The portal auto-fills data from Form 16 and Form 26AS.',
    actions: [
      'Review personal information (address, bank account)',
      'Verify income details match your Form 16',
      'Check TDS details match Form 26AS',
      'Cross-verify with our computed values',
    ],
    tip: 'Use the data summary below to cross-check values. Correct any discrepancies.',
  },
  {
    step: 4,
    title: 'Select Tax Regime',
    description: 'Choose Old or New Regime based on our recommendation.',
    actions: [
      'Select preferred tax regime (as recommended by FileTaxAI)',
      'Enter deductions under Chapter VI-A (Old Regime only)',
      'Enter income from other sources if any',
      'Verify total income and tax liability',
    ],
    tip: 'Use the regime comparison from FileTaxAI to choose the regime that minimises your tax.',
  },
  {
    step: 5,
    title: 'Pay Any Outstanding Tax',
    description: 'If tax payable > ₹0, pay before submitting.',
    actions: [
      'If refund due — no payment needed',
      'If tax payable — pay via Challan 280 on the portal',
      'Enter challan details in the return',
      'Wait for tax payment to reflect (can take 2-3 days)',
    ],
    tip: 'Pay self-assessment tax via Challan 280. Payment mode: NEFT/RTGS or net banking.',
  },
  {
    step: 6,
    title: 'Submit and e-Verify',
    description: 'Submit the return and complete e-verification.',
    actions: [
      'Review all details once more',
      'Click Submit',
      'e-Verify using Aadhaar OTP (recommended) or net banking',
      'You will receive an acknowledgment (ITR-V) by email',
    ],
    tip: 'e-Verification via Aadhaar OTP is instant and recommended. Alternatively, send signed ITR-V to CPC Bengaluru.',
  },
];

const DOCUMENTS_CHECKLIST = [
  { item: 'PAN Card', required: true, category: 'identity' },
  { item: 'Aadhaar Card (for e-verification)', required: true, category: 'identity' },
  { item: 'Form 16 (Part A + B) from employer', required: true, category: 'income' },
  { item: 'Form 26AS – Annual Tax Statement', required: true, category: 'income' },
  { item: 'Annual Information Statement (AIS)', required: false, category: 'income' },
  { item: 'Salary slips for the year', required: false, category: 'income' },
  { item: 'Bank account details (IFSC, account number)', required: true, category: 'banking' },
  { item: 'FD/RD interest certificates from bank', required: false, category: 'income' },
  { item: 'Home loan interest certificate', required: false, category: 'deductions' },
  { item: 'Rent receipts (for HRA exemption)', required: false, category: 'deductions' },
  { item: 'Section 80C investment proofs (LIC, PPF, ELSS)', required: false, category: 'deductions' },
  { item: 'Health insurance premium receipts (80D)', required: false, category: 'deductions' },
  { item: 'NPS contribution statement (80CCD)', required: false, category: 'deductions' },
  { item: 'Donation receipts (80G)', required: false, category: 'deductions' },
];

export default function FilingGuidePage() {
  const { computationResult, currentSession, incomeData } = useTaxStore();
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [expandedStep, setExpandedStep] = useState<number | null>(1);

  const toggleCheck = (item: string) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  };

  const recommended = computationResult
    ? computationResult.recommendedRegime === 'new'
      ? computationResult.newRegime
      : computationResult.oldRegime
    : null;

  const itrForm = 'ITR-1 (SAHAJ)';

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Step-by-Step ITR Filing Guide</h1>
        <p className="mt-1 text-slate-600">
          How to file your Income Tax Return on the official portal for AY{' '}
          {currentSession?.assessmentYear || '2024-25'}.
        </p>
      </div>

      {/* Alert if no computation */}
      {!computationResult && (
        <div className="flex items-start gap-3 rounded-lg bg-yellow-50 border border-yellow-200 p-4">
          <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-yellow-800">
              Complete tax computation first
            </p>
            <p className="text-xs text-yellow-600 mt-0.5">
              The data summary below will be populated with your actual figures after computation.
            </p>
          </div>
        </div>
      )}

      <Tabs defaultValue="which-form" className="space-y-4">
        <TabsList className="w-full md:w-auto flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="which-form">Which Form?</TabsTrigger>
          <TabsTrigger value="steps">Filing Steps</TabsTrigger>
          <TabsTrigger value="data-summary">Data Summary</TabsTrigger>
          <TabsTrigger value="checklist">Checklist</TabsTrigger>
        </TabsList>

        {/* Which ITR Form */}
        <TabsContent value="which-form">
          <div className="space-y-4">
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 flex items-start gap-3">
              <Info className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  Most salaried employees should file <span className="text-primary">ITR-1 (SAHAJ)</span>
                </p>
                <p className="text-xs text-slate-600 mt-0.5">
                  Applicable if total income is less than ₹50 lakh, income from salary/pension,
                  one house property, and other sources only.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {ITR_FORMS.map((form) => (
                <Card key={form.form} className={`border ${form.color}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-sm font-bold">{form.form}</CardTitle>
                      <Badge variant={form.badgeVariant} className="text-xs">
                        {form.badge}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs">{form.applicableFor}</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs font-medium text-slate-700 mb-2">Applicable when:</p>
                    <ul className="space-y-1">
                      {form.conditions.map((c, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                          {c}
                        </li>
                      ))}
                    </ul>
                    {form.notApplicable.length > 0 && (
                      <>
                        <Separator className="my-2" />
                        <p className="text-xs font-medium text-slate-700 mb-2">Not if:</p>
                        <ul className="space-y-1">
                          {form.notApplicable.map((c, i) => (
                            <li key={i} className="flex items-start gap-1.5 text-xs text-slate-500">
                              <AlertCircle className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
                              {c}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Steps */}
        <TabsContent value="steps">
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-slate-600">6 steps to file your ITR on the official portal</p>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => window.open('https://www.incometax.gov.in/iec/foportal/', '_blank')}
              >
                <Globe className="h-3.5 w-3.5" />
                Open IT Portal
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>

            {FILING_STEPS.map((step) => (
              <Card
                key={step.step}
                className={`border transition-all ${expandedStep === step.step ? 'border-primary/30 shadow-sm' : 'border-slate-200'}`}
              >
                <button
                  className="w-full text-left"
                  onClick={() => setExpandedStep(expandedStep === step.step ? null : step.step)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                          expandedStep === step.step
                            ? 'bg-primary text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {step.step}
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-sm font-semibold text-slate-800">
                          {step.title}
                        </CardTitle>
                        <CardDescription className="text-xs">{step.description}</CardDescription>
                      </div>
                      {expandedStep === step.step ? (
                        <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                      )}
                    </div>
                  </CardHeader>
                </button>

                {expandedStep === step.step && (
                  <CardContent className="pt-0 border-t border-slate-100">
                    <div className="pl-12 space-y-3">
                      <ol className="space-y-2 mt-2">
                        {step.actions.map((action, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-medium text-slate-500">
                              {i + 1}
                            </span>
                            {action}
                          </li>
                        ))}
                      </ol>

                      <div className="rounded-lg bg-saffron-50 border border-saffron-100 p-3">
                        <p className="text-xs text-saffron-700 flex items-start gap-1.5">
                          <span className="shrink-0">💡</span>
                          {step.tip}
                        </p>
                      </div>

                      {step.link && (
                        <a
                          href={step.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                        >
                          {step.linkLabel}
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Data Summary */}
        <TabsContent value="data-summary">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pre-filled Data Summary</CardTitle>
              <CardDescription>
                Copy these values when filling your ITR on the portal
              </CardDescription>
            </CardHeader>
            <CardContent>
              {computationResult && recommended ? (
                <div className="space-y-4">
                  <div className="rounded-lg bg-slate-50 border border-slate-200 overflow-hidden">
                    <div className="bg-navy-700 px-4 py-2">
                      <p className="text-sm font-semibold text-white">
                        Recommended: {computationResult.recommendedRegime === 'new' ? '✨ New Regime' : '🏛️ Old Regime'}
                      </p>
                    </div>
                    <table className="w-full text-sm">
                      <tbody>
                        {[
                          { label: 'Assessment Year', value: currentSession?.assessmentYear || '2024-25' },
                          { label: 'ITR Form', value: itrForm },
                          { label: 'Gross Total Income', value: formatCurrency(recommended.grossTotalIncome) },
                          { label: 'Standard Deduction', value: formatCurrency(50000) },
                          { label: 'Total Deductions (Chapter VI-A)', value: formatCurrency(recommended.totalDeductions) },
                          { label: 'Taxable Income', value: formatCurrency(recommended.taxableIncome) },
                          { label: 'Tax on Total Income', value: formatCurrency(recommended.taxBeforeRebate) },
                          ...(recommended.rebate87A > 0 ? [{ label: 'Rebate u/s 87A', value: formatCurrency(recommended.rebate87A) }] : []),
                          { label: 'Education Cess (4%)', value: formatCurrency(recommended.educationCess) },
                          { label: 'Total Tax Liability', value: formatCurrency(recommended.totalTax) },
                          { label: 'TDS Deducted', value: formatCurrency(recommended.totalTaxesPaid) },
                          {
                            label: recommended.refundOrPayable < 0 ? 'Refund Due' : 'Tax Payable',
                            value: formatCurrency(Math.abs(recommended.refundOrPayable)),
                            highlight: true,
                          },
                        ].map((row, i) => (
                          <tr
                            key={i}
                            className={`border-b last:border-0 ${row.highlight ? 'bg-primary/5 font-semibold' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}
                          >
                            <td className="px-4 py-2.5 text-slate-600">{row.label}</td>
                            <td className={`px-4 py-2.5 text-right font-medium tabular-nums ${row.highlight ? 'text-primary' : 'text-slate-800'}`}>
                              {row.value}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-100 p-3">
                    <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-blue-700">
                      Use these exact figures when entering data on the Income Tax portal.
                      The portal may have pre-filled some values from Form 26AS — verify they match.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center">
                  <FileText className="mx-auto h-10 w-10 text-slate-300 mb-3" />
                  <p className="text-sm text-slate-500">
                    Complete tax computation to see your data summary.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 gap-2"
                    onClick={() => window.location.href = '/compute'}
                  >
                    Compute Tax First
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Checklist */}
        <TabsContent value="checklist">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <List className="h-5 w-5" />
                Documents Checklist
              </CardTitle>
              <CardDescription>
                Collect these documents before starting to file
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {['identity', 'income', 'banking', 'deductions'].map((category) => {
                  const items = DOCUMENTS_CHECKLIST.filter((d) => d.category === category);
                  const categoryLabels: Record<string, string> = {
                    identity: 'Identity Documents',
                    income: 'Income Documents',
                    banking: 'Banking Details',
                    deductions: 'Deduction Proofs',
                  };

                  return (
                    <div key={category}>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                        {categoryLabels[category]}
                      </h4>
                      <div className="space-y-1.5">
                        {items.map((item) => (
                          <button
                            key={item.item}
                            onClick={() => toggleCheck(item.item)}
                            className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-sm text-left transition-all hover:border-primary/30 ${
                              checkedItems.has(item.item)
                                ? 'border-green-200 bg-green-50'
                                : 'border-slate-200 bg-white'
                            }`}
                          >
                            {checkedItems.has(item.item) ? (
                              <CheckSquare className="h-4 w-4 text-green-600 shrink-0" />
                            ) : (
                              <Square className="h-4 w-4 text-slate-300 shrink-0" />
                            )}
                            <span
                              className={`flex-1 ${
                                checkedItems.has(item.item) ? 'text-green-800 line-through' : 'text-slate-700'
                              }`}
                            >
                              {item.item}
                            </span>
                            {item.required ? (
                              <Badge variant="destructive" className="text-xs shrink-0">Required</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs shrink-0">Optional</Badge>
                            )}
                          </button>
                        ))}
                      </div>
                      {category !== 'deductions' && <Separator className="mt-3" />}
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 rounded-lg bg-slate-50 p-3 flex items-center justify-between">
                <p className="text-sm text-slate-600">
                  {checkedItems.size} of {DOCUMENTS_CHECKLIST.length} items collected
                </p>
                <div className="h-2 w-32 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{
                      width: `${(checkedItems.size / DOCUMENTS_CHECKLIST.length) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Footer note */}
      <Card className="border-saffron-200 bg-saffron-50">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <HelpCircle className="h-5 w-5 text-saffron-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-saffron-800">Need Help?</p>
              <p className="text-xs text-saffron-700 mt-0.5">
                The Income Tax Department helpdesk is available at{' '}
                <strong>1800-103-0025</strong> (toll-free) or email{' '}
                <strong>helpdesk@incometax.gov.in</strong>. For complex queries, consult a CA.
              </p>
              <a
                href="https://www.incometax.gov.in/iec/foportal/help/how-to-file-itr-1-sahaj"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs text-saffron-700 hover:text-saffron-900 font-medium"
              >
                Official ITR-1 Filing Guide <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
