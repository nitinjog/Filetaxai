'use client';

import { RegimeResult } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { cn, formatCurrency } from '@/lib/utils';

interface TaxBreakdownTableProps {
  regime: RegimeResult;
  label: string;
}

export function TaxBreakdownTable({ regime, label }: TaxBreakdownTableProps) {
  const rows: Array<{
    label: string;
    value: number;
    type: 'income' | 'deduction' | 'total' | 'tax' | 'refund' | 'paid';
    indent?: boolean;
  }> = [
    { label: 'Gross Total Income', value: regime.grossTotalIncome, type: 'income' },
    {
      label: 'Total Deductions',
      value: regime.totalDeductions,
      type: 'deduction',
      indent: true,
    },
    { label: 'Taxable Income', value: regime.taxableIncome, type: 'total' },
    { label: 'Income Tax on Slabs', value: regime.taxBeforeRebate, type: 'tax', indent: true },
    ...(regime.rebate87A > 0
      ? [{ label: 'Less: Rebate u/s 87A', value: regime.rebate87A, type: 'deduction' as const, indent: true }]
      : []),
    ...(regime.surcharge > 0
      ? [{ label: 'Add: Surcharge', value: regime.surcharge, type: 'tax' as const, indent: true }]
      : []),
    {
      label: 'Add: Education Cess @ 4%',
      value: regime.educationCess,
      type: 'tax',
      indent: true,
    },
    { label: 'Total Tax Liability', value: regime.totalTax, type: 'total' },
    ...(regime.totalTaxesPaid > 0
      ? [{ label: 'Less: TDS / Advance Tax Paid', value: regime.totalTaxesPaid, type: 'paid' as const, indent: true }]
      : []),
    {
      label: regime.refundOrPayable < 0 ? 'Refund Due' : 'Net Tax Payable',
      value: Math.abs(regime.refundOrPayable),
      type: 'refund',
    },
  ];

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <div className="flex items-center justify-between bg-navy-700 px-4 py-3">
        <h3 className="text-sm font-semibold text-white">{label}</h3>
        <Badge className="bg-white/10 text-white border-0 text-xs">
          {(regime.effectiveRate ?? 0).toFixed(2)}% effective rate
        </Badge>
      </div>

      <table className="w-full text-sm">
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={idx}
              className={cn(
                'border-b last:border-0 transition-colors',
                row.type === 'total' ? 'bg-slate-50' : 'bg-white hover:bg-slate-50/50',
                row.type === 'refund' &&
                  (regime.refundOrPayable < 0 ? 'bg-green-50' : 'bg-red-50')
              )}
            >
              <td className={cn('px-4 py-2.5 text-slate-600', row.indent && 'pl-8')}>
                {row.indent && <span className="text-slate-300 mr-1">—</span>}
                {row.label}
              </td>
              <td
                className={cn(
                  'px-4 py-2.5 text-right tabular-nums font-medium',
                  row.type === 'deduction' || row.type === 'paid'
                    ? 'text-green-700'
                    : row.type === 'total'
                    ? 'text-slate-900 font-semibold'
                    : row.type === 'refund'
                    ? regime.refundOrPayable < 0
                      ? 'text-green-700 font-bold'
                      : 'text-red-700 font-bold'
                    : 'text-slate-700'
                )}
              >
                {row.type === 'deduction' || row.type === 'paid' ? (
                  <span>({formatCurrency(row.value)})</span>
                ) : (
                  formatCurrency(row.value)
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Slab breakdown */}
      {regime.slabs && regime.slabs.length > 0 && (
        <details className="border-t">
          <summary className="cursor-pointer px-4 py-2.5 text-xs font-medium text-primary bg-primary/5 hover:bg-primary/10 transition-colors">
            View Slab-wise Breakdown
          </summary>
          <table className="w-full text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Income Range</th>
                <th className="px-4 py-2 text-right font-medium text-slate-600">Rate</th>
                <th className="px-4 py-2 text-right font-medium text-slate-600">Tax</th>
              </tr>
            </thead>
            <tbody>
              {regime.slabs
                .filter((s) => s.taxOnSlab > 0)
                .map((slab, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="px-4 py-2 text-slate-600">
                      {formatCurrency(slab.from)} –{' '}
                      {slab.to ? formatCurrency(slab.to) : 'Above'}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-600">{slab.rate}%</td>
                    <td className="px-4 py-2 text-right font-medium text-slate-700">
                      {formatCurrency(slab.taxOnSlab)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}
