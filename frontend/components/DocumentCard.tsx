'use client';

import { AlertCircle, CheckCircle2, Clock, FileText, Loader2, Trash2 } from 'lucide-react';
import { TaxDocument } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, formatFileSize, getDocumentTypeLabel } from '@/lib/utils';

interface DocumentCardProps {
  document: TaxDocument;
  onDelete?: (id: string) => void;
  isDeleting?: boolean;
}

const statusConfig = {
  uploaded: {
    label: 'Uploaded',
    icon: Clock,
    badgeVariant: 'info' as const,
    iconColor: 'text-blue-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-100',
  },
  parsing: {
    label: 'Parsing...',
    icon: Loader2,
    badgeVariant: 'warning' as const,
    iconColor: 'text-yellow-500',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-100',
  },
  parsed: {
    label: 'Parsed',
    icon: CheckCircle2,
    badgeVariant: 'success' as const,
    iconColor: 'text-green-500',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-100',
  },
  error: {
    label: 'Error',
    icon: AlertCircle,
    badgeVariant: 'destructive' as const,
    iconColor: 'text-red-500',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-100',
  },
  failed: {
    label: 'Failed',
    icon: AlertCircle,
    badgeVariant: 'destructive' as const,
    iconColor: 'text-red-500',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-100',
  },
};

export function DocumentCard({ document, onDelete, isDeleting }: DocumentCardProps) {
  const config = statusConfig[document.status] ?? statusConfig.error;
  const StatusIcon = config.icon;

  return (
    <div
      className={cn(
        'flex items-start gap-4 rounded-lg border p-4 transition-all',
        config.bgColor,
        config.borderColor
      )}
    >
      {/* File icon */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm">
        <FileText className="h-5 w-5 text-slate-600" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-sm font-semibold text-slate-800">
            {getDocumentTypeLabel(document.documentType)}
          </span>
          <Badge variant={config.badgeVariant} className="text-xs">
            <StatusIcon
              className={cn('mr-1 h-3 w-3', config.iconColor, document.status === 'parsing' && 'animate-spin')}
            />
            {config.label}
          </Badge>
        </div>

        <p className="text-xs text-slate-600 truncate">{document.originalName}</p>
        <p className="mt-0.5 text-xs text-slate-400">
          {formatFileSize(document.fileSize)} ·{' '}
          {new Date(document.uploadedAt).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </p>

        {/* Parsed data preview */}
        {document.status === 'parsed' && document.parsedData && (
          <div className="mt-2 flex flex-wrap gap-2">
            {document.parsedData.grossSalary !== undefined && (
              <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
                Gross: ₹{document.parsedData.grossSalary.toLocaleString('en-IN')}
              </span>
            )}
            {document.parsedData.taxDeducted !== undefined && (
              <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                TDS: ₹{document.parsedData.taxDeducted.toLocaleString('en-IN')}
              </span>
            )}
            {document.parsedData.employerName && (
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                {document.parsedData.employerName}
              </span>
            )}
          </div>
        )}

        {/* Error message */}
        {document.status === 'error' && document.errorMessage && (
          <p className="mt-1 text-xs text-red-600">{document.errorMessage}</p>
        )}
      </div>

      {/* Delete button */}
      {onDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-slate-400 hover:bg-red-50 hover:text-red-500"
          onClick={() => onDelete(document.id)}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </Button>
      )}
    </div>
  );
}
