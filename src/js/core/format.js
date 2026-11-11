/** Formatting and date helpers. Dates are stored as local ISO days: "YYYY-MM-DD". */

export function money(n, currency = 'USD') {
  const v = Number.isFinite(n) ? n : 0;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(v);
  } catch {
    return `$${v.toFixed(2)}`;
  }
}

export function moneyShort(n, currency = 'USD') {
  const v = Number.isFinite(n) ? n : 0;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: v >= 100 ? 0 : 2, notation: v >= 10000 ? 'compact' : 'standard' }).format(v);
  } catch {
    return `$${Math.round(v)}`;
  }
}

export function num(n, digits = 0) {
  const v = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(v);
}

export function pct(ratio, { signed = false, digits = 0 } = {}) {
  const v = Math.round(ratio * 100 * 10 ** digits) / 10 ** digits;
  return `${signed && v > 0 ? '+' : ''}${v}%`;
}

export function pad(n) { return String(n).padStart(2, '0'); }

export function toISODate(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISODate(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(iso, n) {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function daysBetween(fromIso, toIso) {
  return Math.round((parseISODate(toIso) - parseISODate(fromIso)) / 86400000);
}

export function weekday(iso) { return parseISODate(iso).getDay(); }

export function monthKey(iso) { return String(iso).slice(0, 7); }

export function fmtDate(iso, opts = { weekday: 'short', month: 'short', day: 'numeric' }) {
  if (!iso) return '—';
  return parseISODate(iso).toLocaleDateString(undefined, opts);
}

export function fmtDay(iso) { return parseISODate(iso).toLocaleDateString(undefined, { weekday: 'short' }); }

export function fmtMonth(key, style = 'short') {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: style, year: style === 'long' ? 'numeric' : undefined });
}

export function fmtDateTime(isoTs) {
  if (!isoTs) return '—';
  return new Date(isoTs).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function relDay(iso, today = toISODate()) {
  const diff = daysBetween(today, iso);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff < 7) return fmtDay(iso);
  if (diff < 0 && diff > -7) return `${-diff} days ago`;
  return fmtDate(iso);
}

export function plural(n, one, many = `${one}s`) { return `${num(n)} ${n === 1 ? one : many}`; }

export function uid(prefix = '') {
  const r = Math.random().toString(36).slice(2, 8);
  return `${prefix}${Date.now().toString(36)}${r}`;
}

export function slug(s) {
  return String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'item';
}

export function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }
