const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getEncryptionKey() {
    const secret = process.env.ENCRYPTION_SECRET || 'fallback-secret-key-32-chars-long!!';
    return crypto.createHash('sha256').update(secret).digest();
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

module.exports = { decrypt };
