import bcrypt from 'bcrypt';
import crypto from 'crypto';
const SALT_ROUNDS = 10;
export async function hashSecret(secret) {
    return bcrypt.hash(secret, SALT_ROUNDS);
}
export function hashSecretSync(secret) {
    return bcrypt.hashSync(secret, SALT_ROUNDS);
}
export async function verifySecret(secret, hashed) {
    if (!hashed)
        return false;
    // Backward compatibility check for SHA-256 legacy hashes
    if (hashed.length === 64 && !hashed.startsWith('$2')) {
        const legacyHash = crypto.createHash('sha256').update(secret).digest('hex');
        return legacyHash === hashed;
    }
    return bcrypt.compare(secret, hashed);
}
