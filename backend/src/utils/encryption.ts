import crypto from "crypto";

// ─── Constants ────────────────────────────────────────────────────────────────

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;    // 128-bit IV for GCM
const TAG_LENGTH = 16;   // 128-bit auth tag
const KEY_LENGTH = 32;   // 256-bit key

// ─── Key Derivation ───────────────────────────────────────────────────────────

function getEncryptionKey(): Buffer {
  const rawKey = process.env.ENCRYPTION_KEY || "";
  if (!rawKey) {
    throw new Error("ENCRYPTION_KEY environment variable is not set");
  }

  // If provided as hex string, decode it; otherwise derive via SHA-256
  if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
    return Buffer.from(rawKey, "hex");
  }

  // Derive 32-byte key from any string using SHA-256
  return crypto.createHash("sha256").update(rawKey).digest();
}

// ─── Encrypt ─────────────────────────────────────────────────────────────────

export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv) as crypto.CipherGCM;

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:ciphertext (all hex encoded)
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

// ─── Decrypt ──────────────────────────────────────────────────────────────────

export function decrypt(ciphertext: string): string {
  const key = getEncryptionKey();
  const parts = ciphertext.split(":");

  if (parts.length !== 3) {
    throw new Error("Invalid ciphertext format");
  }

  const [ivHex, tagHex, encrypted] = parts;

  if (!ivHex || !tagHex || !encrypted) {
    throw new Error("Invalid ciphertext: missing components");
  }

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(tagHex, "hex");

  if (iv.length !== IV_LENGTH) {
    throw new Error("Invalid IV length");
  }
  if (authTag.length !== TAG_LENGTH) {
    throw new Error("Invalid auth tag length");
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    iv
  ) as crypto.DecipherGCM;
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

// ─── PAN Masking ──────────────────────────────────────────────────────────────

/**
 * Mask PAN for display: ABCDE1234F → ABCDE****F
 * Stores only the masked version in DB; never the full PAN.
 */
export function maskPAN(pan: string): string {
  if (!pan || pan.length !== 10) return "XXXXXXXXXX";
  const upper = pan.toUpperCase().trim();
  // Show first 5 chars and last char, mask middle 4 digits
  return `${upper.substring(0, 5)}****${upper.charAt(9)}`;
}

/**
 * Validate PAN format: 5 letters + 4 digits + 1 letter
 */
export function isValidPAN(pan: string): boolean {
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan.toUpperCase().trim());
}

// ─── Hash (for password verification tokens, etc.) ────────────────────────────

export function hashData(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

// ─── HMAC for document integrity ─────────────────────────────────────────────

export function computeHMAC(data: string): string {
  const key = getEncryptionKey();
  return crypto.createHmac("sha256", key).update(data).digest("hex");
}

export function verifyHMAC(data: string, hmac: string): boolean {
  const expected = computeHMAC(data);
  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(hmac, "hex")
  );
}

// ─── Generate Secure Random Token ─────────────────────────────────────────────

export function generateSecureToken(byteLength: number = 32): string {
  return crypto.randomBytes(byteLength).toString("hex");
}
