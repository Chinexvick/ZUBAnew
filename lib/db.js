// Database access. Production uses Neon's HTTP driver; tests use node-postgres.
// Every query is a tagged template, so values are always sent as parameters.
import { neon } from '@neondatabase/serverless';

let impl = null;
export function useDb(fn) {
  impl = fn;
}

export function sql(strings, ...values) {
  if (!impl) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL missing');
    impl = neon(process.env.DATABASE_URL);
  }
  return impl(strings, ...values);
}
