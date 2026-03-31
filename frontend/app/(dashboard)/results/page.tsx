'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bot,
  Download,
  ExternalLink,
  IndianRupee,
  Loader2,
  RefreshCw,
  Star,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TaxComparison } from '@/components/TaxComparison';
import { TaxBreakdownTable } from '@/components/TaxBreakdownTable';
import { RegimeChart } from '@/components/RegimeChart';
import { AIExplanation } from '@/components/AIExplanation';
import { useTaxStore } from '@/store/taxStore';
import { useAIExplanation, useAISuggestions } from '@/hooks/useTaxComputation';
import { formatCurrency } from '@/lib/utils';

export default function ResultsPage() {
  const router = useRouter();
  const { computationResult, currentSession, incomeData } = useTaxStore();
  const printRef = useRef<HTMLDivElement>(null);

  const sessionId = currentSession?.id || '';
  const { data: aiExplanationData, isLoading: aiLoading } = useAIExplanation(
    computationResult ? sessionId : ''
  );
  const { data: aiSuggestionsData } = useAISuggestions(computationResult ? sessionId : '');

  const handlePrint = () => {
    window.print();
  };

  if (!computationResult) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <Card className="border-dashed border-2 border-slate-200">
          <CardContent className="py-16 text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100">
              <IndianRupee className="h-10 w-10 text-slate-300" />
            </div>
            <h2 className="text-xl font-semibold text-slate-700">No Results Yet</h2>
            <p className="mt-3 text-slate-500 max-w-sm mx-auto">
              Complete the tax computation to see your Old vs New Regime comparison and
              recommended tax plan.
            </p>
            <div className="mt-8 flex justify-center gap-3">
              <Button variant="outline" onClick={() => router.push('/upload')} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Upload Documents
              </Button>
              <Button onClick={() => router.push('/compute')} className="gap-2">
                Compute Tax
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { oldRegime, newRegime, recommendedRegime, savings } = computationResult;
  const recommended = recommendedRegime === 'new' ? newRegime : oldRegime;
  const isRefund = recommended.refundOrPayable < 0;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6" ref={printRef}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-slate-900">Tax Computation Results</h1>
            <Badge variant="success" className="text-xs">
              AY {currentSession?.assessmentYear || '2024-25'}
            </Badge>
          </div>
          <p className="text-slate-600">
            Complete analysis for {incomeData?.grossSalary ? `income of ${formatCurrency(incomeData.grossSalary)}` : 'your income'}
          </p>
        </div>
        <div className="flex gap-2 no-print">
          <Button variant="outline" size="sm" className="gap-2" onClick={handlePrint}>
            <Download className="h-4 w-4" />
            Download PDF
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => router.push('/compute')}>
            <RefreshCw className="h-4 w-4" />
            Recompute
          </Button>
        </div>
      </div>

      {/* Hero result card */}
      <div
        className={`rounded-2xl p-6 text-white ${
          isRefund
            ? 'bg-gradient-to-br from-green-600 to-green-700'
            : 'bg-gradient-to-br from-navy-700 to-navy-900'
        }`}
      >
        <div className="grid gap-6 md:grid-cols-3 items-center">
          {/* Recommended regime */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-2">
              <Star className="h-5 w-5 text-saffron-400 fill-current" />
              <span className="text-sm font-medium text-white/80">
                Recommended for You
              </span>
            </div>
            <h2 className="text-3xl font-bold">
              {recommendedRegime === 'new' ? '✨ New Tax Regime' : '🏛️ Old Tax Regime'}
            </h2>
            <p className="mt-2 text-white/70 text-sm">
              {computationResult.reasons?.[0] || 'Based on your income and deduction profile.'}
            </p>
            {savings > 0 && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2">
                <TrendingDown className="h-4 w-4 text-green-300" />
                <span className="text-sm font-medium">
                  Save {formatCurrency(savings)} compared to {recommendedRegime === 'new' ? 'Old' : 'New'} Regime
                </span>
              </div>
            )}
          </div>

          {/* Refund / payable */}
          <div className="text-center md:text-right">
            <p className="text-sm text-white/70 mb-1">
              {isRefund ? 'Income Tax Refund' : 'Tax Still Payable'}
            </p>
            <p className="text-5xl font-bold tracking-tight">
              {formatCurrency(Math.abs(recommended.refundOrPayable))}
            </p>
            <p className="mt-1 text-xs text-white/60">
              {isRefund
                ? 'Refund after accounting for TDS paid'
                : 'Pay before filing to avoid interest'}
            </p>
            <div className="mt-3 flex items-center justify-center md:justify-end gap-1 text-xs text-white/60">
              <IndianRupee className="h-3 w-3" />
              <span>Total tax: {formatCurrency(recommended.totalTax)}</span>
              <span>·</span>
              <span>{recommended.effectiveRate.toFixed(1)}% effective rate</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main content tabs */}
      <Tabs defaultValue="comparison" className="space-y-4">
        <TabsList className="w-full md:w-auto flex flex-wrap gap-1 h-auto p-1">
          <TabsTrigger value="comparison">Comparison</TabsTrigger>
          <TabsTrigger value="chart">Chart</TabsTrigger>
          <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
          <TabsTrigger value="ai">
            <Bot className="mr-1.5 h-3.5 w-3.5" />
            AI Insights
          </TabsTrigger>
        </TabsList>

        {/* Comparison Tab */}
        <TabsContent value="comparison">
          <TaxComparison result={computationResult} />
        </TabsContent>

        {/* Chart Tab */}
        <TabsContent value="chart">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Visual Comparison</CardTitle>
              <CardDescription>
                Old vs New Regime – income, deductions, taxable income, and tax
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RegimeChart result={computationResult} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Breakdown Tab */}
        <TabsContent value="breakdown">
          <div className="space-y-4">
            <TaxBreakdownTable
              regime={oldRegime}
              label="Old Regime – Detailed Breakdown"
            />
            <TaxBreakdownTable
              regime={newRegime}
              label="New Regime – Detailed Breakdown"
            />
          </div>
        </TabsContent>

        {/* AI Tab */}
        <TabsContent value="ai">
          <AIExplanation
            explanation={aiExplanationData?.explanation}
            highlights={aiExplanationData?.highlights}
            missedDeductions={computationResult.missedDeductions || aiSuggestionsData?.suggestions?.map(s => ({
              section: s.section,
              description: s.description,
              maxLimit: 0,
              estimatedSaving: s.saving,
              applicableFor: 'Old Regime',
            }))}
            isLoading={aiLoading}
          />
        </TabsContent>
      </Tabs>

      {/* Key summary strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: 'Old Regime Tax',
            value: oldRegime.totalTax,
            sub: `${oldRegime.effectiveRate.toFixed(1)}% effective`,
            color: 'text-slate-700',
            bg: 'bg-slate-50',
          },
          {
            label: 'New Regime Tax',
            value: newRegime.totalTax,
            sub: `${newRegime.effectiveRate.toFixed(1)}% effective`,
            color: 'text-slate-700',
            bg: 'bg-slate-50',
          },
          {
            label: 'Savings by Choosing Best',
            value: savings,
            sub: `${computationResult.savingsPercentage.toFixed(1)}% reduction`,
            color: 'text-green-700',
            bg: 'bg-green-50',
          },
          {
            label: isRefund ? 'Your Refund' : 'Tax to Pay',
            value: Math.abs(recommended.refundOrPayable),
            sub: isRefund ? 'Expected refund' : 'Pay via Challan 280',
            color: isRefund ? 'text-green-700' : 'text-red-700',
            bg: isRefund ? 'bg-green-50' : 'bg-red-50',
          },
        ].map((item) => (
          <div key={item.label} className={`rounded-xl border p-4 ${item.bg}`}>
            <p className="text-xs text-slate-500">{item.label}</p>
            <p className={`mt-1 text-xl font-bold tabular-nums ${item.color}`}>
              {formatCurrency(item.value)}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">{item.sub}</p>
          </div>
        ))}
      </div>

      {/* CTA section */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-semibold text-slate-800">Ready to File Your ITR?</h3>
              <p className="text-sm text-slate-600 mt-0.5">
                Follow our step-by-step guide to file on the Income Tax portal.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => router.push('/filing-guide')}
              >
                <BookOpen className="h-4 w-4" />
                Filing Guide
              </Button>
              <Button
                className="gap-2"
                onClick={() => window.open('https://www.incometax.gov.in/iec/foportal/', '_blank')}
              >
                File on Portal
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Disclaimer */}
      <p className="text-xs text-slate-400 text-center border-t pt-4">
        This computation is for informational purposes only and is based on the data provided.
        Verify all figures before filing. Consult a Chartered Accountant for complex tax matters.
        Tax rules as per Income Tax Act applicable for AY {currentSession?.assessmentYear || '2024-25'}.
      </p>
    </div>
  );
}
