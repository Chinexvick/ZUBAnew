// The public staking rules, for showing estimates. The worker enforces the real ones.
// 5,000,000,000 ZUBA over one year (365 days).
export const YEAR_POOLS = [5_000_000_000n];
export const TOTAL_BUDGET = 5_000_000_000n;
export const DAYS_PER_YEAR = 365;
export const PROGRAM_DAYS = DAYS_PER_YEAR * YEAR_POOLS.length;
export const LOCKS: Record<number, number> = { 0: 10000, 30: 12500, 90: 15000, 180: 20000 }; // weight in basis points
export const MAX_APY_BP = 4000;

export function dailyPool(day: number, unit: bigint) {
  if (!Number.isInteger(day) || day < 0 || day >= PROGRAM_DAYS) return 0n;
  return (YEAR_POOLS[Math.floor(day / DAYS_PER_YEAR)] * unit) / BigInt(DAYS_PER_YEAR);
}
/** Estimated yearly return in % if the day's pool is shared by totalWeighted (sum of amount x weight). */
export function estimateApy(day: number, totalWeighted: bigint, weightBp: number, unit: bigint) {
  if (totalWeighted <= 0n) return MAX_APY_BP / 100;
  const yearly = Number((dailyPool(day, unit) * BigInt(weightBp) * BigInt(DAYS_PER_YEAR) * 10000n) / totalWeighted); // basis points, rounded down
  return Math.min(yearly, MAX_APY_BP) / 100;
}
export function parseAmount(s: unknown, decimals: number): bigint | null {
  if (typeof s !== "string" || !/^\d{1,30}(\.\d{1,18})?$/.test(s)) return null;
  const [w, f = ""] = s.split(".");
  if (f.length > decimals) return null;
  return BigInt(w) * 10n ** BigInt(decimals) + BigInt(f.padEnd(decimals, "0") || "0");
}
export function formatAmount(v: bigint | string | number, decimals: number) {
  const a = BigInt(v);
  const w = a / 10n ** BigInt(decimals);
  const f = (a % 10n ** BigInt(decimals)).toString().padStart(decimals, "0").replace(/0+$/, "");
  return w.toString() + (f ? "." + f : "");
}
