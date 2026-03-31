import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { aiReviewApi, computeApi, documentsApi, sessionsApi } from '@/lib/api';
import { DeductionData, IncomeData } from '@/lib/types';
import { useTaxStore } from '@/store/taxStore';
import { useToast } from '@/components/ui/use-toast';

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const queryKeys = {
  sessions: ['sessions'] as const,
  session: (id: string) => ['session', id] as const,
  documents: (sessionId: string) => ['documents', sessionId] as const,
  result: (sessionId: string) => ['result', sessionId] as const,
  aiReview: (sessionId: string) => ['ai-review', sessionId] as const,
  aiExplanation: (sessionId: string) => ['ai-explanation', sessionId] as const,
  aiSuggestions: (sessionId: string) => ['ai-suggestions', sessionId] as const,
};

// ─── Sessions ─────────────────────────────────────────────────────────────────

export function useSessions(page = 1) {
  return useQuery({
    queryKey: [...queryKeys.sessions, page],
    queryFn: () => sessionsApi.list(page),
    staleTime: 1000 * 60 * 5,
  });
}

export function useSession(sessionId: string) {
  return useQuery({
    queryKey: queryKeys.session(sessionId),
    queryFn: () => sessionsApi.get(sessionId),
    enabled: !!sessionId,
  });
}

export function useCreateSession() {
  const queryClient = useQueryClient();
  const { setCurrentSession } = useTaxStore();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (year?: string) => sessionsApi.create(year),
    onSuccess: (session) => {
      setCurrentSession(session);
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions });
      toast({ title: 'Session created', description: `Tax session for ${session.assessmentYear} created.` });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Could not create session.', variant: 'destructive' });
    },
  });
}

// ─── Documents ────────────────────────────────────────────────────────────────

export function useDocuments(sessionId: string) {
  const { setDocuments } = useTaxStore();

  return useQuery({
    queryKey: queryKeys.documents(sessionId),
    queryFn: async () => {
      const docs = await documentsApi.list(sessionId);
      setDocuments(docs);
      return docs;
    },
    enabled: !!sessionId,
    refetchInterval: (query) => {
      // Auto-refetch if any document is in parsing state
      const docs = query.state.data;
      if (docs && docs.some((d) => d.status === 'parsing')) return 2000;
      return false;
    },
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();
  const { addDocument } = useTaxStore();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({
      sessionId,
      file,
      documentType,
      onProgress,
    }: {
      sessionId: string;
      file: File;
      documentType: string;
      onProgress?: (p: number) => void;
    }) => documentsApi.upload(sessionId, file, documentType, onProgress),
    onSuccess: (doc) => {
      addDocument(doc);
      queryClient.invalidateQueries({ queryKey: queryKeys.documents(doc.sessionId) });
      toast({ title: 'Document uploaded', description: `${doc.originalName} uploaded successfully.` });
    },
    onError: () => {
      toast({ title: 'Upload failed', description: 'Could not upload document.', variant: 'destructive' });
    },
  });
}

export function useParseDocuments() {
  const queryClient = useQueryClient();
  const { setIsParsing } = useTaxStore();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (sessionId: string) => documentsApi.parseAll(sessionId),
    onMutate: () => setIsParsing(true),
    onSuccess: (_, sessionId) => {
      // Invalidate so useDocuments re-fetches with parsed_data populated
      queryClient.invalidateQueries({ queryKey: queryKeys.documents(sessionId) });
      toast({ title: 'Parsing started', description: 'Documents are being parsed by AI.' });
    },
    onError: () => {
      toast({ title: 'Parse error', description: 'Could not parse documents.', variant: 'destructive' });
    },
    onSettled: () => setIsParsing(false),
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  const { removeDocument, currentSession } = useTaxStore();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (documentId: string) => documentsApi.delete(documentId),
    onSuccess: (_, documentId) => {
      removeDocument(documentId);
      if (currentSession) {
        queryClient.invalidateQueries({ queryKey: queryKeys.documents(currentSession.id) });
      }
      toast({ title: 'Document removed', description: 'Document deleted successfully.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Could not delete document.', variant: 'destructive' });
    },
  });
}

// ─── Compute ──────────────────────────────────────────────────────────────────

export function useComputeTax() {
  const queryClient = useQueryClient();
  const { setComputationResult, setIsComputing, currentSession } = useTaxStore();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({
      sessionId,
      income,
      deductions,
    }: {
      sessionId: string;
      income?: IncomeData;
      deductions?: DeductionData;
    }) => {
      if (income && deductions) {
        return computeApi.computeManual(sessionId, income, deductions);
      }
      return computeApi.computeFromSession(sessionId);
    },
    onMutate: () => setIsComputing(true),
    onSuccess: (result, { sessionId }) => {
      setComputationResult(result);
      queryClient.setQueryData(queryKeys.result(sessionId), result);
      toast({
        title: 'Computation complete!',
        description: `Recommended: ${result.recommendedRegime === 'new' ? 'New Regime' : 'Old Regime'}. Save ₹${result.savings.toLocaleString('en-IN')}.`,
      });
    },
    onError: () => {
      toast({ title: 'Computation failed', description: 'Could not compute tax.', variant: 'destructive' });
    },
    onSettled: () => setIsComputing(false),
  });
}

export function useTaxResult(sessionId: string) {
  return useQuery({
    queryKey: queryKeys.result(sessionId),
    queryFn: () => computeApi.getResult(sessionId),
    enabled: !!sessionId,
    staleTime: 1000 * 60 * 10,
  });
}

// ─── AI Review ────────────────────────────────────────────────────────────────

export function useAIReview(sessionId: string) {
  return useQuery({
    queryKey: queryKeys.aiReview(sessionId),
    queryFn: () => aiReviewApi.getReview(sessionId),
    enabled: !!sessionId,
    staleTime: 1000 * 60 * 30,
  });
}

export function useAIExplanation(sessionId: string) {
  return useQuery({
    queryKey: queryKeys.aiExplanation(sessionId),
    queryFn: () => aiReviewApi.getExplanation(sessionId),
    enabled: !!sessionId,
    staleTime: 1000 * 60 * 30,
  });
}

export function useAISuggestions(sessionId: string) {
  return useQuery({
    queryKey: queryKeys.aiSuggestions(sessionId),
    queryFn: () => aiReviewApi.getSuggestions(sessionId),
    enabled: !!sessionId,
    staleTime: 1000 * 60 * 30,
  });
}
