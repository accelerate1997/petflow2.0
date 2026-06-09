import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // AES-GCM standard IV length
const AUTH_TAG_LENGTH = 16;

/**
 * Gets a derived 32-byte key buffer from the ENCRYPTION_SECRET environment variable.
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET || 'fallback-secret-key-32-chars-long!!';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts a plaintext string into a serialized 'iv:ciphertext:authTag' format.
 */
export function encrypt(text: string | null | undefined): string | null {
  if (!text) return null;

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');

    return `${iv.toString('hex')}:${encrypted}:${authTag}`;
  } catch (error) {
    console.error('Encryption failed:', error);
    return text; // Return raw text as safety fallback
  }
}

/**
 * Decrypts a serialized 'iv:ciphertext:authTag' format back to plaintext.
 * Safely returns plaintext directly if format does not match (backward compatibility).
 */
export function decrypt(encryptedText: string | null | undefined): string | null {
  if (!encryptedText) return null;

  // If the text is not in our encrypted format (no colons), treat as plaintext (backward compatibility)
  if (!encryptedText.includes(':')) {
    return encryptedText;
  }

  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      return encryptedText; // Fallback
    }

    const [ivHex, encryptedHex, authTagHex] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted);
    const finalBuffer = decipher.final();

    return Buffer.concat([decrypted, finalBuffer]).toString('utf8');
  } catch (error) {
    console.error('Decryption failed, returning raw/plaintext:', error);
    return encryptedText; // Fallback to raw if decryption fails
  }
}
