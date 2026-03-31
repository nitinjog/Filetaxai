'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { CheckCircle2, FileText, Loader2, Upload, X } from 'lucide-react';
import { cn, formatFileSize } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';

interface FileUploadProps {
  documentType: string;
  label: string;
  description?: string;
  accept?: Record<string, string[]>;
  maxSize?: number;
  onUpload: (file: File, onProgress: (pct: number) => void) => Promise<void>;
  isUploading?: boolean;
  isUploaded?: boolean;
  uploadedFileName?: string;
  onRemove?: () => void;
  disabled?: boolean;
}

export function FileUpload({
  documentType,
  label,
  description,
  accept = {
    'application/pdf': ['.pdf'],
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
  },
  maxSize = 10 * 1024 * 1024, // 10 MB
  onUpload,
  isUploading = false,
  isUploaded = false,
  uploadedFileName,
  onRemove,
  disabled = false,
}: FileUploadProps) {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [localFile, setLocalFile] = useState<File | null>(null);

  const onDrop = useCallback(
    async (acceptedFiles: File[], rejectedFiles: unknown[]) => {
      const rejected = rejectedFiles as Array<{ errors: Array<{ code: string }> }>;
      if (rejected.length > 0) {
        const errCode = rejected[0].errors[0]?.code;
        if (errCode === 'file-too-large') {
          setError(`File too large. Max size is ${formatFileSize(maxSize)}.`);
        } else if (errCode === 'file-invalid-type') {
          setError('Invalid file type. Please upload PDF or image files.');
        } else {
          setError('File rejected. Please try again.');
        }
        return;
      }

      const file = acceptedFiles[0];
      if (!file) return;

      setLocalFile(file);
      setError(null);
      setUploadProgress(0);

      try {
        await onUpload(file, (pct) => setUploadProgress(pct));
        setUploadProgress(100);
      } catch {
        setError('Upload failed. Please try again.');
        setLocalFile(null);
        setUploadProgress(0);
      }
    },
    [onUpload, maxSize]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxSize,
    maxFiles: 1,
    disabled: disabled || isUploading || isUploaded,
  });

  const handleRemove = () => {
    setLocalFile(null);
    setUploadProgress(0);
    setError(null);
    onRemove?.();
  };

  // Uploaded state
  if (isUploaded && uploadedFileName) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-green-800">{label}</p>
              <p className="text-xs text-green-600 truncate max-w-[200px]">{uploadedFileName}</p>
            </div>
          </div>
          {onRemove && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-green-600 hover:bg-green-100 hover:text-red-500"
              onClick={handleRemove}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Uploading state
  if (isUploading || (localFile && uploadProgress > 0 && uploadProgress < 100)) {
    return (
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
            <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-800">{label}</p>
            <p className="text-xs text-blue-600">{localFile?.name || 'Uploading...'}</p>
          </div>
          <span className="text-sm font-medium text-blue-700">{uploadProgress}%</span>
        </div>
        <Progress value={uploadProgress} className="h-1.5 bg-blue-200 [&>div]:bg-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        {...getRootProps()}
        className={cn(
          'relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 text-center transition-all cursor-pointer',
          isDragActive
            ? 'border-primary bg-primary/5 scale-[1.01]'
            : disabled
            ? 'border-slate-200 bg-slate-50 cursor-not-allowed opacity-60'
            : 'border-slate-300 bg-white hover:border-primary hover:bg-primary/5',
          error && 'border-red-300 bg-red-50'
        )}
      >
        <input {...getInputProps()} />
        <div
          className={cn(
            'mb-3 flex h-12 w-12 items-center justify-center rounded-xl',
            isDragActive ? 'bg-primary/10' : 'bg-slate-100'
          )}
        >
          {isDragActive ? (
            <Upload className="h-6 w-6 text-primary animate-bounce" />
          ) : (
            <FileText className="h-6 w-6 text-slate-400" />
          )}
        </div>

        <p className="text-sm font-medium text-slate-800">
          {isDragActive ? 'Drop it here!' : label}
        </p>

        {description && (
          <p className="mt-1 text-xs text-slate-500">{description}</p>
        )}

        <p className="mt-3 text-xs text-slate-400">
          Drag & drop or{' '}
          <span className="text-primary font-medium">browse files</span>
          <br />
          PDF, JPG, PNG up to {formatFileSize(maxSize)}
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2">
          <X className="h-3.5 w-3.5 text-red-500 shrink-0" />
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}
    </div>
  );
}
