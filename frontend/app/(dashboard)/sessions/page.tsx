'use client';

import { useRouter } from 'next/navigation';
import { Calendar, ChevronRight, Clock, FileText, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useSessions, useCreateSession } from '@/hooks/useTaxComputation';
import { useTaxStore } from '@/store/taxStore';
import { TaxSession } from '@/lib/types';
import { cn, formatCurrency } from '@/lib/utils';

const statusConfig: Record<string, { label: string; variant: 'secondary' | 'destructive' | 'default' | 'outline' | 'success' | 'info' | 'warning' }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  documents_uploaded: { label: 'Docs Uploaded', variant: 'info' },
  parsing_complete: { label: 'Parsed', variant: 'info' },
  computation_done: { label: 'Computed', variant: 'success' },
  ai_reviewed: { label: 'AI Reviewed', variant: 'success' },
  filed: { label: 'Filed', variant: 'default' },
};

export default function SessionsPage() {
  const router = useRouter();
  const { data: sessionsData, isLoading } = useSessions();
  const createSession = useCreateSession();
  const { setCurrentSession, clearSession } = useTaxStore();

  const sessions = sessionsData?.items || [];

  const handleOpenSession = (session: TaxSession) => {
    setCurrentSession(session);
    router.push('/upload');
  };

  const handleNewSession = async () => {
    clearSession();
    await createSession.mutateAsync(undefined);
    router.push('/upload');
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sessions History</h1>
          <p className="mt-1 text-slate-600">All your past tax computations.</p>
        </div>
        <Button onClick={handleNewSession} className="gap-2" disabled={createSession.isPending}>
          <Plus className="h-4 w-4" />
          New Session
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-lg shimmer-bg" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200">
          <CardContent className="py-12 text-center">
            <FileText className="mx-auto h-10 w-10 text-slate-300 mb-3" />
            <h3 className="font-semibold text-slate-700">No sessions yet</h3>
            <p className="mt-2 text-sm text-slate-500">
              Start your first tax computation session.
            </p>
            <Button onClick={handleNewSession} className="mt-4 gap-2">
              <Plus className="h-4 w-4" />
              Start Now
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => {
            const config = statusConfig[session.status] ?? { label: session.status, variant: 'secondary' as const };
            const result = session.computationResult;

            return (
              <Card
                key={session.id}
                className="border-slate-200 hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer"
                onClick={() => handleOpenSession(session)}
              >
                <CardContent className="py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Calendar className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800">
                            AY {session.assessmentYear}
                          </span>
                          <Badge variant={config.variant} className="text-xs">
                            {config.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {session.documents?.length || 0} documents
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(session.updatedAt).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {result && (
                        <div className="hidden sm:block text-right">
                          <p className="text-xs text-slate-500">Recommended</p>
                          <p className="text-sm font-semibold text-slate-800 capitalize">
                            {result.recommendedRegime === 'new' ? '✨ New' : '🏛️ Old'} Regime
                          </p>
                          {result.savings > 0 && (
                            <p className="text-xs text-green-600">
                              Save {formatCurrency(result.savings)}
                            </p>
                          )}
                        </div>
                      )}
                      <ChevronRight className="h-5 w-5 text-slate-300 shrink-0" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
