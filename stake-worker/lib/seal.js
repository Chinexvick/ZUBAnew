// Sealed secrets. The website can only LOCK a secret (it holds the public key);
// only the worker can open it (it alone holds the private key). So even a fully
// hacked website cannot read anyone's two-factor secret out of the database.
import crypto from 'node:crypto';

const OAEP = { padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' };

export function seal(publicPem, plain) {
  return 'r1.' + crypto.publicEncrypt({ key: publicPem, ...OAEP }, Buffer.from(plain, 'utf8')).toString('base64');
}
export function open(privatePem, sealed) {
  if (typeof sealed !== 'string' || !sealed.startsWith('r1.') || sealed.length > 2000) throw new Error('bad sealed value');
  return crypto.privateDecrypt({ key: privatePem, ...OAEP }, Buffer.from(sealed.slice(3), 'base64')).toString('utf8');
}
/** Keys travel in environment variables as base64 of the PEM text. */
export const pemFromEnv = (v) => Buffer.from(String(v || ''), 'base64').toString('utf8');
export function newKeyPair() {
  return crypto.generateKeyPairSync('rsa', { modulusLength: 3072, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
}

// ---- signed statements: the worker signs, anyone with the public key can check, nobody else can forge ----
const PSS = { padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 };
export const signText = (privatePem, text) => crypto.sign('sha256', Buffer.from(text, 'utf8'), { key: privatePem, ...PSS }).toString('base64');
export function verifyText(publicPem, text, sig) {
  try { return crypto.verify('sha256', Buffer.from(text, 'utf8'), { key: publicPem, ...PSS }, Buffer.from(String(sig), 'base64')); } catch { return false; }
}
/** The exact words that are signed for a withdrawal's deposit check. Changing any field breaks the signature. */
export const proofText = (w, result, atMs) => ['zuba-withdrawal-proof', w.id, String(w.user_id).toLowerCase(), String(w.to_address).toLowerCase(), String(w.amount), result, atMs].join('|');
