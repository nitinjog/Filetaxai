'use client';

import { ArrowDown, ArrowUp, CheckCircle2, Star } from 'lucide-react';
import { TaxComparisonResult } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn, formatCurrency } from '@/lib/utils';

interface TaxComparisonProps {
  result: TaxComparisonResult;
}

export function TaxComparison({ result }: TaxComparisonProps) {
  const { oldRegime, newRegime, recommendedRegime, savings } = result;
  const isNewRecommended = recommendedRegime === 'new';

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Old Regime Card */}
      <RegimeCard
        regime="old"
        result={oldRegime}
        isRecommended={!isNewRecommended}
        otherTax={newRegime.totalTax}
      />

      {/* New Regime Card */}
      <RegimeCard
        regime="new"
        result={newRegime}
        isRecommended={isNewRecommended}
        otherTax={oldRegime.totalTax}
      />

      {/* Savings Banner */}
      <div className="md:col-span-2">
        <div
          className={cn(
            'flex items-center justify-between rounded-xl p-4 border',
            savings > 0
              ? 'bg-green-50 border-green-200'
              : 'bg-blue-50 border-blue-200'
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-full', savings > 0 ? 'bg-green-100' : 'bg-blue-100')}>
              <CheckCircle2 className={cn('h-5 w-5', savings > 0 ? 'text-green-600' : 'text-blue-600')} />
            </div>
            <div>
              <p className={cn('font-semibold text-sm', savings > 0 ? 'text-green-800' : 'text-blue-800')}>
                {isNewRecommended ? 'New Regime Recommended' : 'Old Regime Recommended'}
              </p>
              <p className={cn('text-xs', savings > 0 ? 'text-green-600' : 'text-blue-600')}>
                {savings > 0
                  ? `Save ${formatCurrency(savings)} (${result.savingsPercentage.toFixed(1)}% less tax) by choosing ${isNewRecommended ? 'New' : 'Old'} Regime`
                  : 'Both regimes result in the same tax liability'}
              </p>
            </div>
          </div>
          {savings > 0 && (
            <div className="text-right hidden sm:block">
              <p className="text-2xl font-bold text-green-700">{formatCurrency(savings)}</p>
              <p className="text-xs text-green-600">Annual Savings</p>
            </div>
          )}
        </div>
      </div>

      {/* Reasons */}
      {result.reasons && result.reasons.length > 0 && (
        <div className="md:col-span-2">
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Star className="h-4 w-4 text-saffron-500" />
                Why we recommend the {isNewRecommended ? 'New' : 'Old'} Regime
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {result.reasons.map((reason, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    {reason}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

interface RegimeCardProps {
  regime: 'old' | 'new';
  result: {
    grossTotalIncome: number;
    totalDeductions: number;
    taxableIncome: number;
    taxBeforeRebate: number;
    rebate87A: number;
    surcharge: number;
    educationCess: number;
    totalTax: number;
    totalTaxesPaid: number;
    refundOrPayable: number;
    effectiveRate: number;
  };
  isRecommended: boolean;
  otherTax: number;
}

function RegimeCard({ regime, result, isRecommended, otherTax }: RegimeCardProps) {
  const diff = result.totalTax - otherTax;
  const isHigher = diff > 0;

  return (
    <Card
      className={cn(
        'relative transition-all',
        isRecommended
          ? 'border-2 border-primary shadow-md'
          : 'border border-slate-200'
      )}
    >
      {isRecommended && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-primary text-white text-xs px-3 shadow-sm">
            <Star className="mr-1 h-3 w-3 fill-current" />
            Recommended
          </Badge>
        </div>
      )}

      <CardHeader className={cn('pb-3', isRecommended ? 'pt-6' : '')}>
        <CardTitle className="text-base">
          {regime === 'old' ? '🏛️ Old Tax Regime' : '✨ New Tax Regime'}
        </CardTitle>
        <p className="text-xs text-slate-500">
          {regime === 'old'
            ? 'Higher deductions, higher tax slabs'
            : 'Lower slabs, minimal deductions'}
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Key figure */}
        <div className={cn('rounded-lg p-4 text-center', isRecommended ? 'bg-primary/5' : 'bg-slate-50')}>
          <p className="text-xs text-slate-500 mb-1">Total Tax Payable</p>
          <p className={cn('text-3xl font-bold', isRecommended ? 'text-primary' : 'text-slate-800')}>
            {formatCurrency(result.totalTax)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Effective rate: {result.effectiveRate.toFixed(2)}%
          </p>
        </div>

        {/* Comparison with other regime */}
        {diff !== 0 && (
          <div className={cn('flex items-center gap-2 rounded-md px-3 py-1.5 text-xs', isHigher ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700')}>
            {isHigher ? (
              <ArrowUp className="h-3 w-3" />
            ) : (
              <ArrowDown className="h-3 w-3" />
            )}
            <span>
              {formatCurrency(Math.abs(diff))} {isHigher ? 'more' : 'less'} than{' '}
              {regime === 'old' ? 'New' : 'Old'} Regime
            </span>
          </div>
        )}

        <Separator />

        {/* Breakdown */}
        <div className="space-y-1.5 text-sm">
          <LineItem label="Gross Total Income" value={result.grossTotalIncome} />
          <LineItem
            label="Total Deductions"
            value={-result.totalDeductions}
            className="text-green-600"
          />
          <LineItem label="Taxable Income" value={result.taxableIncome} bold />
          <Separator className="my-2" />
          <LineItem label="Tax on Income" value={result.taxBeforeRebate} />
          {result.rebate87A > 0 && (
            <LineItem label="Rebate u/s 87A" value={-result.rebate87A} className="text-green-600" />
          )}
          {result.surcharge > 0 && (
            <LineItem label="Surcharge" value={result.surcharge} />
          )}
          <LineItem label="Education Cess (4%)" value={result.educationCess} />
          <Separator className="my-2" />
          <LineItem label="Total Tax" value={result.totalTax} bold />
          {result.totalTaxesPaid > 0 && (
            <LineItem
              label="Tax Already Paid (TDS)"
              value={-result.totalTaxesPaid}
              className="text-green-600"
            />
          )}
          <Separator className="my-2" />
          <div
            className={cn(
              'flex items-center justify-between rounded-md px-2 py-1.5 font-semibold',
              result.refundOrPayable < 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            )}
          >
            <span>{result.refundOrPayable < 0 ? 'Refund' : 'Tax Payable'}</span>
            <span>{formatCurrency(Math.abs(result.refundOrPayable))}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LineItem({
  label,
  value,
  bold = false,
  className,
}: {
  label: string;
  value: number;
  bold?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center justify-between', bold && 'font-semibold')}>
      <span className="text-slate-600">{label}</span>
      <span className={cn('tabular-nums', value < 0 ? 'text-green-600' : '', className)}>
        {value < 0 ? `(${formatCurrency(Math.abs(value))})` : formatCurrency(value)}
      </span>
    </div>
  );
}
