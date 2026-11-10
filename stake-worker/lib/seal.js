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
