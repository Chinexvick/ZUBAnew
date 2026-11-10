// Sends the alerts waiting in the database to Telegram (if set up) and always logs them.
import { alert, withTx } from '../lib/db.js';

export async function flushAlerts(pool, { telegramToken, telegramChat, log = console } = {}) {
  const { rows } = await pool.query('select id, level, msg, at from stake_alerts where sent = false order by id limit 20');
  for (const a of rows) {
    const line = `[${a.level.toUpperCase()}] ${a.msg}`;
    log.log(`ALERT ${line}`);
    let ok = true;
    if (telegramToken && telegramChat) {
      try {
        const r = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: telegramChat, text: `ZUBA staking\n${line}` }), signal: AbortSignal.timeout(8000) });
        ok = r.ok;
      } catch { ok = false; }
    }
    if (ok) await pool.query('update stake_alerts set sent = true where id = $1', [a.id]);
  }
  return rows.length;
}
export const raise = (pool, level, msg) => withTx(pool, (c) => alert(c, level, msg));
/** Like raise, but the same message is not repeated within `minutes` (so a lasting problem does not flood the phone). */
export async function raiseOnce(pool, level, msg, minutes = 60) {
  const m = String(msg).slice(0, 500);
  const r = await pool.query("select 1 from stake_alerts where msg = $1 and at > now() - make_interval(mins => $2) limit 1", [m, minutes]);
  if (!r.rowCount) await raise(pool, level, m);
}
