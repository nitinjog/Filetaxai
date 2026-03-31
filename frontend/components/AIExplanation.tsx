'use client';

import { useState } from 'react';
import { Bot, ChevronDown, ChevronUp, IndianRupee, Lightbulb, Sparkles } from 'lucide-react';
import { MissedDeduction } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn, formatCurrency } from '@/lib/utils';

interface AIExplanationProps {
  explanation?: string;
  highlights?: string[];
  missedDeductions?: MissedDeduction[];
  isLoading?: boolean;
}

export function AIExplanation({
  explanation,
  highlights = [],
  missedDeductions = [],
  isLoading = false,
}: AIExplanationProps) {
  const [showFullExplanation, setShowFullExplanation] = useState(false);
  const [expandedDeduction, setExpandedDeduction] = useState<string | null>(null);

  if (isLoading) {
    return (
      <Card className="border-purple-100">
        <CardContent className="py-8">
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">
              <Sparkles className="h-6 w-6 text-purple-600 animate-pulse" />
            </div>
            <p className="text-sm text-slate-600">AI is analyzing your tax situation...</p>
            <div className="w-48 h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full w-1/2 bg-purple-500 rounded-full animate-shimmer shimmer-bg" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const words = explanation?.split(' ') || [];
  const shortExplanation = words.slice(0, 50).join(' ') + (words.length > 50 ? '...' : '');

  return (
    <div className="space-y-4">
      {/* AI Explanation */}
      {explanation && (
        <Card className="border-purple-100 bg-gradient-to-br from-purple-50/50 to-white">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-purple-800">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-purple-100">
                <Bot className="h-4 w-4 text-purple-600" />
              </div>
              AI Explanation (Plain English)
              <Badge className="ml-auto bg-purple-100 text-purple-700 border-0 text-xs">
                AI Generated
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-700 leading-relaxed">
              {showFullExplanation ? explanation : shortExplanation}
            </p>
            {words.length > 50 && (
              <button
                onClick={() => setShowFullExplanation(!showFullExplanation)}
                className="mt-2 flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 font-medium"
              >
                {showFullExplanation ? (
                  <>Show less <ChevronUp className="h-3 w-3" /></>
                ) : (
                  <>Read more <ChevronDown className="h-3 w-3" /></>
                )}
              </button>
            )}

            {/* Highlights */}
            {highlights.length > 0 && (
              <>
                <Separator className="my-3" />
                <div className="space-y-2">
                  {highlights.map((highlight, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Sparkles className="h-4 w-4 text-purple-500 mt-0.5 shrink-0" />
                      <p className="text-xs text-slate-600">{highlight}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Missed Deductions */}
      {missedDeductions.length > 0 && (
        <Card className="border-saffron-200 bg-gradient-to-br from-saffron-50/50 to-white">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-saffron-800">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-saffron-100">
                <Lightbulb className="h-4 w-4 text-saffron-600" />
              </div>
              Deductions You May Have Missed
              <Badge className="ml-auto bg-saffron-100 text-saffron-700 border-0 text-xs">
                {missedDeductions.length} suggestions
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500 mb-3">
              These deductions could reduce your taxable income under the Old Regime:
            </p>
            <div className="space-y-2">
              {missedDeductions.map((deduction) => (
                <div
                  key={deduction.section}
                  className="rounded-lg border border-saffron-100 bg-white overflow-hidden"
                >
                  <button
                    onClick={() =>
                      setExpandedDeduction(
                        expandedDeduction === deduction.section ? null : deduction.section
                      )
                    }
                    className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-saffron-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-saffron-100">
                        <IndianRupee className="h-4 w-4 text-saffron-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{deduction.section}</p>
                        <p className="text-xs text-slate-500 truncate max-w-[200px]">
                          {deduction.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Potential saving</p>
                        <p className="text-sm font-bold text-green-600">
                          {formatCurrency(deduction.estimatedSaving)}
                        </p>
                      </div>
                      {expandedDeduction === deduction.section ? (
                        <ChevronUp className="h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      )}
                    </div>
                  </button>

                  {expandedDeduction === deduction.section && (
                    <div className="border-t border-saffron-100 px-4 py-3 bg-saffron-50/50">
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <p className="text-slate-500">Max Limit</p>
                          <p className="font-semibold text-slate-700">
                            {formatCurrency(deduction.maxLimit)}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500">Applicable For</p>
                          <p className="font-semibold text-slate-700">{deduction.applicableFor}</p>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-slate-600">{deduction.description}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-lg bg-saffron-50 border border-saffron-100 p-3">
              <p className="text-xs text-saffron-700">
                <strong>Note:</strong> These deductions apply only under the Old Tax Regime. Switching to
                the Old Regime with these deductions may reduce your tax liability further. Consult a
                Chartered Accountant for personalised advice.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No suggestions */}
      {!explanation && missedDeductions.length === 0 && !isLoading && (
        <Card className="border-slate-200">
          <CardContent className="py-6 text-center">
            <Bot className="mx-auto h-8 w-8 text-slate-300 mb-2" />
            <p className="text-sm text-slate-500">
              No AI explanation available yet. Compute your tax to get AI insights.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
