import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import path from "path";

// ─── Detect whether Cloudinary is configured ─────────────────────────────────

function isCloudinaryConfigured(): boolean {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

// ─── Cloudinary Configuration ─────────────────────────────────────────────────

if (isCloudinaryConfigured()) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
} else {
  console.warn(
    "[Storage] Cloudinary not configured — using local disk storage at ./uploads/ (dev only)"
  );
}

// ─── Local storage directory ──────────────────────────────────────────────────

const LOCAL_UPLOAD_DIR = path.resolve(process.cwd(), "uploads");

function ensureLocalDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UploadResult {
  public_id: string;
  secure_url: string;
  format: string;
  bytes: number;
  resource_type: string;
  created_at: string;
}

export interface SignedUrlOptions {
  expires_in_seconds?: number;
  transformation?: Record<string, unknown>[];
}

// ─── Upload Document ──────────────────────────────────────────────────────────

export async function uploadDocument(
  buffer: Buffer,
  filename: string,
  sessionId: string,
  documentType: string = "OTHER"
): Promise<UploadResult> {
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const publicId = `filetaxai/${sessionId}/${documentType}/${Date.now()}_${sanitizedFilename}`;

  // ── Local disk fallback ──────────────────────────────────────────────────
  if (!isCloudinaryConfigured()) {
    const localDir = path.join(LOCAL_UPLOAD_DIR, sessionId, documentType);
    ensureLocalDir(localDir);
    const localFilename = `${Date.now()}_${sanitizedFilename}`;
    const localPath = path.join(localDir, localFilename);
    fs.writeFileSync(localPath, buffer);

    const relativeUrl = `/uploads/${sessionId}/${documentType}/${localFilename}`;
    return {
      public_id: localPath,
      secure_url: `http://localhost:${process.env.PORT || 3001}${relativeUrl}`,
      format: path.extname(filename).replace(".", ""),
      bytes: buffer.length,
      resource_type: "raw",
      created_at: new Date().toISOString(),
    };
  }

  // ── Cloudinary upload ────────────────────────────────────────────────────
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        resource_type: "raw",
        folder: `filetaxai/${sessionId}`,
        tags: ["tax_document", documentType, sessionId],
        context: {
          session_id: sessionId,
          document_type: documentType,
          original_filename: filename,
          uploaded_at: new Date().toISOString(),
        },
        overwrite: false,
        unique_filename: true,
        use_filename: true,
      },
      (error, result) => {
        if (error) { reject(new Error(`Cloudinary upload failed: ${error.message}`)); return; }
        if (!result) { reject(new Error("Cloudinary upload returned no result")); return; }
        resolve({
          public_id: result.public_id,
          secure_url: result.secure_url,
          format: result.format,
          bytes: result.bytes,
          resource_type: result.resource_type,
          created_at: result.created_at,
        });
      }
    );
    uploadStream.end(buffer);
  });
}

// ─── Delete Document ──────────────────────────────────────────────────────────

export async function deleteDocument(publicId: string): Promise<boolean> {
  if (!isCloudinaryConfigured()) {
    try { fs.unlinkSync(publicId); return true; } catch { return false; }
  }
  try {
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: "raw", invalidate: true });
    return result.result === "ok";
  } catch (err) {
    throw new Error(`Failed to delete document ${publicId}: ${(err as Error).message}`);
  }
}

// ─── Get Signed URL ───────────────────────────────────────────────────────────

export function getSignedUrl(publicId: string, options: SignedUrlOptions = {}): string {
  if (!isCloudinaryConfigured()) {
    // For local storage, publicId is the full local path — just return a placeholder
    return publicId;
  }
  const expiresAt = Math.floor(Date.now() / 1000) + (options.expires_in_seconds || 3600);
  return cloudinary.url(publicId, {
    resource_type: "raw",
    type: "authenticated",
    sign_url: true,
    expires_at: expiresAt,
    secure: true,
  });
}

// ─── Schedule Document Deletion ───────────────────────────────────────────────

export async function scheduleDocumentDeletion(publicId: string, daysFromNow: number = 30): Promise<void> {
  if (!isCloudinaryConfigured()) return; // no-op for local storage
  const deletionDue = new Date();
  deletionDue.setDate(deletionDue.getDate() + daysFromNow);
  try {
    await cloudinary.uploader.explicit(publicId, {
      type: "upload",
      resource_type: "raw",
      context: { deletion_scheduled: "true", deletion_due: deletionDue.toISOString() },
      tags: ["scheduled_for_deletion"],
    });
  } catch (err) {
    console.error(`Failed to schedule deletion for ${publicId}: ${(err as Error).message}`);
  }
}

// ─── Bulk Delete Documents for a Session ─────────────────────────────────────

export async function deleteSessionDocuments(sessionId: string): Promise<{ deleted: number; failed: number }> {
  if (!isCloudinaryConfigured()) {
    const localDir = path.join(LOCAL_UPLOAD_DIR, sessionId);
    try { fs.rmSync(localDir, { recursive: true, force: true }); return { deleted: 1, failed: 0 }; }
    catch { return { deleted: 0, failed: 1 }; }
  }
  let deleted = 0; let failed = 0;
  try {
    const result = await cloudinary.api.delete_resources_by_prefix(`filetaxai/${sessionId}`, { resource_type: "raw" });
    deleted += Object.keys(result.deleted || {}).length;
  } catch (err) {
    console.error(`Failed to bulk delete session ${sessionId}: ${(err as Error).message}`);
    failed++;
  }
  return { deleted, failed };
}

// ─── Get Document Metadata ────────────────────────────────────────────────────

export async function getDocumentMetadata(publicId: string): Promise<Record<string, unknown> | null> {
  if (!isCloudinaryConfigured()) return null;
  try {
    const result = await cloudinary.api.resource(publicId, { resource_type: "raw" });
    return result as Record<string, unknown>;
  } catch { return null; }
}

// ─── Check Storage Usage ──────────────────────────────────────────────────────

export async function getStorageUsage(): Promise<{ used_bytes: number; limit_bytes: number; usage_percent: number }> {
  if (!isCloudinaryConfigured()) {
    return { used_bytes: 0, limit_bytes: 0, usage_percent: 0 };
  }
  try {
    const usage = await cloudinary.api.usage();
    return {
      used_bytes: (usage as Record<string, number>).storage?.usage || 0,
      limit_bytes: (usage as Record<string, number>).storage?.limit || 0,
      usage_percent: (usage as Record<string, number>).storage?.usage_percent || 0,
    };
  } catch { return { used_bytes: 0, limit_bytes: 0, usage_percent: 0 }; }
}
