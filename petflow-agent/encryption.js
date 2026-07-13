const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

/**
 * Gets a derived 32-byte key buffer from the ENCRYPTION_SECRET environment variable.
 * Throws if the secret is not configured — never falls back to a hardcoded key.
 */
function getEncryptionKey() {
    const secret = process.env.ENCRYPTION_SECRET;
    if (!secret) {
        throw new Error(
            '[SECURITY] ENCRYPTION_SECRET environment variable is not set. ' +
            'This is required to encrypt/decrypt sensitive data. ' +
            'Generate a strong random secret (e.g. openssl rand -hex 32) and set it in your .env file.'
        );
    }
    return crypto.createHash('sha256').update(secret).digest();
}

function encrypt(text) {
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
        console.error('[Encryption error] Failed to encrypt:', error.message);
        throw error; // Never silently fail on encryption
    }
}

function decrypt(encryptedText) {
    if (!encryptedText) return null;

    // If the text is not in our encrypted format (no colons), treat as plaintext
    if (!encryptedText.includes(':')) {
        return encryptedText;
    }

    try {
        const parts = encryptedText.split(':');
        if (parts.length !== 3) {
            return encryptedText;
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
        console.error('[Decryption error] Failed to decrypt, returning raw:', error.message);
        return encryptedText;
    }
}

module.exports = { encrypt, decrypt };

