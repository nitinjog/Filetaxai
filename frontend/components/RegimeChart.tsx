'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TaxComparisonResult } from '@/lib/types';
import { formatCurrency, formatLakhCrore } from '@/lib/utils';

interface RegimeChartProps {
  result: TaxComparisonResult;
}

const NAVY = '#1e1b4b';
const SAFFRON = '#f97316';
const GREEN = '#16a34a';
const SLATE = '#94a3b8';

export function RegimeChart({ result }: RegimeChartProps) {
  const { oldRegime, newRegime, recommendedRegime } = result;

  // Main comparison bar chart data
  const comparisonData = [
    {
      name: 'Gross Income',
      'Old Regime': oldRegime.grossTotalIncome,
      'New Regime': newRegime.grossTotalIncome,
    },
    {
      name: 'Deductions',
      'Old Regime': oldRegime.totalDeductions,
      'New Regime': newRegime.totalDeductions,
    },
    {
      name: 'Taxable Income',
      'Old Regime': oldRegime.taxableIncome,
      'New Regime': newRegime.taxableIncome,
    },
    {
      name: 'Total Tax',
      'Old Regime': oldRegime.totalTax,
      'New Regime': newRegime.totalTax,
    },
  ];

  // Breakdown data for stacked bar
  const breakdownData = [
    {
      name: 'Old Regime',
      'Tax on Slabs': oldRegime.taxBeforeRebate - oldRegime.rebate87A,
      Surcharge: oldRegime.surcharge,
      'Edu. Cess': oldRegime.educationCess,
    },
    {
      name: 'New Regime',
      'Tax on Slabs': newRegime.taxBeforeRebate - newRegime.rebate87A,
      Surcharge: newRegime.surcharge,
      'Edu. Cess': newRegime.educationCess,
    },
  ];

  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: Array<{ name: string; value: number; color: string }>;
    label?: string;
  }) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border bg-white p-3 shadow-lg text-sm">
          <p className="font-semibold text-slate-800 mb-2">{label}</p>
          {payload.map((entry) => (
            <div key={entry.name} className="flex items-center gap-2 justify-between">
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: entry.color }}
                />
                <span className="text-slate-600">{entry.name}:</span>
              </span>
              <span className="font-medium tabular-nums ml-4">
                {formatCurrency(entry.value)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Comparison Chart */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-4">
          Old vs New Regime – Key Figures
        </h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={comparisonData}
            margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
            barCategoryGap="25%"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v) => formatLakhCrore(v)}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              width={60}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 12 }}
              formatter={(value) => (
                <span className="text-slate-600">{value}</span>
              )}
            />
            <Bar
              dataKey="Old Regime"
              fill={recommendedRegime === 'old' ? NAVY : SLATE}
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="New Regime"
              fill={recommendedRegime === 'new' ? SAFFRON : SLATE}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tax Breakdown Stacked Chart */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-4">
          Tax Breakdown by Component
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={breakdownData}
            margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
            barCategoryGap="40%"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v) => formatLakhCrore(v)}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              width={60}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Tax on Slabs" stackId="tax" fill={NAVY} />
            <Bar dataKey="Surcharge" stackId="tax" fill="#6366f1" />
            <Bar dataKey="Edu. Cess" stackId="tax" fill={SAFFRON} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Refund/Payable Indicator */}
      <div className="grid grid-cols-2 gap-4">
        <div
          className={`rounded-lg p-3 text-center ${
            oldRegime.refundOrPayable < 0 ? 'bg-green-50' : 'bg-red-50'
          }`}
        >
          <p className="text-xs text-slate-500 mb-1">Old Regime</p>
          <p
            className={`text-lg font-bold ${
              oldRegime.refundOrPayable < 0 ? 'text-green-700' : 'text-red-700'
            }`}
          >
            {oldRegime.refundOrPayable < 0 ? 'Refund' : 'Payable'}
          </p>
          <p
            className={`text-xl font-bold ${
              oldRegime.refundOrPayable < 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {formatCurrency(Math.abs(oldRegime.refundOrPayable))}
          </p>
        </div>
        <div
          className={`rounded-lg p-3 text-center ${
            newRegime.refundOrPayable < 0 ? 'bg-green-50' : 'bg-red-50'
          }`}
        >
          <p className="text-xs text-slate-500 mb-1">New Regime</p>
          <p
            className={`text-lg font-bold ${
              newRegime.refundOrPayable < 0 ? 'text-green-700' : 'text-red-700'
            }`}
          >
            {newRegime.refundOrPayable < 0 ? 'Refund' : 'Payable'}
          </p>
          <p
            className={`text-xl font-bold ${
              newRegime.refundOrPayable < 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {formatCurrency(Math.abs(newRegime.refundOrPayable))}
          </p>
        </div>
      </div>
    </div>
  );
}
