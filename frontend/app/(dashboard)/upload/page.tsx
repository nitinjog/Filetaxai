'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowRight, Bot, CheckCircle2, FileText, Loader2, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { FileUpload } from '@/components/FileUpload';
import { DocumentCard } from '@/components/DocumentCard';
import { useAuthStore } from '@/store/authStore';
import { useTaxStore } from '@/store/taxStore';
import { useCreateSession, useDeleteDocument, useDocuments, useParseDocuments, useUploadDocument } from '@/hooks/useTaxComputation';
import { DocumentType } from '@/lib/types';

const DOCUMENT_TYPES: Array<{
  type: DocumentType;
  label: string;
  description: string;
  priority: 'required' | 'recommended' | 'optional';
  tip: string;
}> = [
  {
    type: 'form16',
    label: 'Form 16',
    description: 'TDS certificate from employer — Part A & Part B',
    priority: 'required',
    tip: 'Your employer provides Form 16 at the end of the financial year. It contains salary details and TDS deducted.',
  },
  {
    type: 'form26as',
    label: 'Form 26AS',
    description: 'Annual Tax Statement from Income Tax portal',
    priority: 'recommended',
    tip: 'Download from incometax.gov.in. It shows all TDS deducted and advance tax paid.',
  },
  {
    type: 'ais',
    label: 'Annual Information Statement (AIS)',
    description: 'Comprehensive income details from IT portal',
    priority: 'recommended',
    tip: 'Download from incometax.gov.in → Services → AIS. Contains interest income, dividend, etc.',
  },
  {
    type: 'salary_slip',
    label: 'Salary Slip (Latest)',
    description: 'Last month salary slip for verification',
    priority: 'optional',
    tip: 'Used to verify components like HRA, PF, etc. Last month of financial year preferred.',
  },
];

export default function UploadPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { currentSession, documents } = useTaxStore();
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  const createSession = useCreateSession();
  const uploadDocument = useUploadDocument();
  const deleteDocument = useDeleteDocument();
  const parseDocuments = useParseDocuments();
  const { data: sessionDocuments, isLoading: docsLoading } = useDocuments(currentSession?.id || '');

  // Auto-create session if none exists
  useEffect(() => {
    if (!currentSession && user) {
      createSession.mutate();
    }
  }, [currentSession, user]);

  const displayDocs = sessionDocuments || documents;

  const uploadedTypes = new Set(displayDocs.map((d) => d.documentType));
  const parsedDocs = displayDocs.filter((d) => d.status === 'parsed');
  const parsingDocs = displayDocs.filter((d) => d.status === 'parsing');
  const errorDocs = displayDocs.filter((d) => d.status === 'error');
  const allParsed = displayDocs.length > 0 && parsingDocs.length === 0 && errorDocs.length === 0;

  const handleUpload = async (
    file: File,
    documentType: string,
    onProgress: (pct: number) => void
  ) => {
    const sessionId = currentSession?.id ?? (await createSession.mutateAsync()).id;
    await uploadDocument.mutateAsync({ sessionId, file, documentType, onProgress });
    // Auto-parse immediately after upload so compute page is always pre-filled
    parseDocuments.mutate(sessionId);
  };

  const handleParseAll = () => {
    if (currentSession) {
      parseDocuments.mutate(currentSession.id);
    }
  };

  const handleComputeTax = () => {
    router.push('/compute');
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Upload Documents</h1>
        <p className="mt-1 text-slate-600">
          Upload your tax documents and let AI parse them automatically.
        </p>
      </div>

      {/* Session info */}
      {currentSession && (
        <div className="flex items-center gap-2 text-sm text-slate-600 rounded-lg bg-slate-50 border px-4 py-2">
          <FileText className="h-4 w-4 text-slate-400" />
          <span>Session: <strong className="text-slate-800">{currentSession.assessmentYear}</strong></span>
          <span className="text-slate-300">·</span>
          <span>{displayDocs.length} document{displayDocs.length !== 1 ? 's' : ''} uploaded</span>
        </div>
      )}

      {/* Progress tracker */}
      {displayDocs.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Uploaded', count: displayDocs.length, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Parsed', count: parsedDocs.length, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Errors', count: errorDocs.length, color: 'text-red-600', bg: 'bg-red-50' },
          ].map((item) => (
            <div key={item.label} className={`rounded-lg ${item.bg} p-3 text-center`}>
              <p className={`text-2xl font-bold ${item.color}`}>{item.count}</p>
              <p className="text-xs text-slate-600">{item.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Upload zones */}
      <div className="grid gap-4 md:grid-cols-2">
        {DOCUMENT_TYPES.map((docType) => {
          const existingDoc = displayDocs.find((d) => d.documentType === docType.type);
          const isUploaded = !!existingDoc;
          const isUploading = uploadDocument.isPending;

          return (
            <Card key={docType.type} className="border-slate-200">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm flex items-center gap-2">
                      {docType.label}
                      <Badge
                        variant={
                          docType.priority === 'required'
                            ? 'destructive'
                            : docType.priority === 'recommended'
                            ? 'warning'
                            : 'secondary'
                        }
                        className="text-xs"
                      >
                        {docType.priority}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">{docType.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {existingDoc ? (
                  <DocumentCard
                    document={existingDoc}
                    onDelete={() => deleteDocument.mutate(existingDoc.id)}
                    isDeleting={deleteDocument.isPending}
                  />
                ) : (
                  <FileUpload
                    documentType={docType.type}
                    label={`Upload ${docType.label}`}
                    description={docType.description}
                    onUpload={(file, onProgress) =>
                      handleUpload(file, docType.type, onProgress)
                    }
                    isUploading={isUploading}
                    disabled={!currentSession && createSession.isPending}
                  />
                )}
                <p className="text-xs text-slate-500 flex items-start gap-1.5">
                  <span className="text-blue-400 shrink-0">💡</span>
                  {docType.tip}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* No documents yet */}
      {displayDocs.length === 0 && !docsLoading && (
        <Card className="border-dashed border-2 border-slate-200">
          <CardContent className="py-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
              <FileText className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="font-semibold text-slate-700">No documents uploaded yet</h3>
            <p className="mt-2 text-sm text-slate-500">
              Start by uploading your Form 16 — it's the most important document.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Uploaded docs list */}
      {displayDocs.length > 0 && (
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-700">
              Uploaded Documents ({displayDocs.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {displayDocs.map((doc) => (
              <DocumentCard
                key={doc.id}
                document={doc}
                onDelete={() => deleteDocument.mutate(doc.id)}
                isDeleting={deleteDocument.isPending}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Action buttons */}
      {displayDocs.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div>
            {allParsed ? (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-semibold">All documents parsed successfully!</span>
              </div>
            ) : parsingDocs.length > 0 ? (
              <div className="flex items-center gap-2 text-blue-600">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="font-semibold">
                  Parsing {parsingDocs.length} document{parsingDocs.length > 1 ? 's' : ''}...
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-slate-600">
                <Bot className="h-5 w-5 text-purple-500" />
                <span className="text-sm">
                  {displayDocs.length} document{displayDocs.length > 1 ? 's' : ''} ready to parse
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            {!allParsed && parsingDocs.length === 0 && (
              <Button
                variant="outline"
                onClick={handleParseAll}
                disabled={parseDocuments.isPending || parsingDocs.length > 0}
                className="gap-2"
              >
                {parseDocuments.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Bot className="h-4 w-4" />
                )}
                Parse All Documents
              </Button>
            )}

            <Button
              onClick={handleComputeTax}
              className="gap-2"
              disabled={displayDocs.length === 0}
            >
              Compute Tax
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Manual entry option */}
      <div className="text-center">
        <p className="text-sm text-slate-500">
          Don&apos;t have documents right now?{' '}
          <button
            onClick={handleComputeTax}
            className="text-primary font-medium hover:underline"
          >
            Enter income details manually
          </button>
        </p>
      </div>
    </div>
  );
}
