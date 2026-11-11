/**
 * BrewSmart local forecasting engine — deterministic, offline, explainable.
 *
 * For each item, projected demand over the order window (lead time + cycle) is:
 *
 *   Σ_day  base × weekday[d] × trend × (1 + weather[d, category]) × (1 + events[d, category])
 *
 * where base = item.dailyUse × customers / 100. The order quantity tops stock up to
 * demand + safety buffer, capped by shelf life (no ordering what will spoil) and
 * storage capacity (item.max).
 */
import { CATEGORIES, DEFAULT_WEEKDAY_CUPS, weatherInfo } from '../data/catalog.js';
import { addDays, clamp, toISODate, weekday, daysBetween } from '../core/format.js';

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Relative demand per weekday (index 0 = Sunday), mean = 1. */
export function weekdayFactors(sales = []) {
  const buckets = Array.from({ length: 7 }, () => []);
  for (const s of sales) buckets[weekday(s.date)].push(s.cups);
  const enough = sales.length >= 14 && buckets.every((b) => b.length >= 1);
  const per = enough ? buckets.map(mean) : DEFAULT_WEEKDAY_CUPS;
  const avg = mean(per) || 1;
  return per.map((v) => v / avg);
}

/** Ratio of the last 14 days' sales to the prior 14 days, clamped to a sane range. */
export function salesTrend(sales = [], today = toISODate()) {
  const recent = sales.filter((s) => { const d = daysBetween(s.date, today); return d >= 1 && d <= 14; });
  const prior = sales.filter((s) => { const d = daysBetween(s.date, today); return d >= 15 && d <= 28; });
  if (recent.length < 7 || prior.length < 7) return 1;
  const r = mean(recent.map((s) => s.cups)) / (mean(prior.map((s) => s.cups)) || 1);
  return clamp(r, 0.8, 1.3);
}

/** Day-to-day noise after removing the weekday pattern (coefficient of variation). */
export function salesVolatility(sales = [], wf = weekdayFactors(sales)) {
  if (sales.length < 7) return 0.15;
  const adj = sales.map((s) => s.cups / (wf[weekday(s.date)] || 1));
  const m = mean(adj) || 1;
  const sd = Math.sqrt(mean(adj.map((x) => (x - m) ** 2)));
  return clamp(sd / m, 0, 0.5);
}

export function weatherFactor(day, category) {
  if (!day) return 0;
  const cat = CATEGORIES[category] || CATEGORIES.other;
  const { kind } = weatherInfo(day.code);
  let f = 0;
  if (kind === 'rain') f += cat.rain;
  if (day.tempMax < 55) f += cat.cold;
  if (day.tempMax > 72) f += cat.hot;
  return f;
}

export function eventsOn(date, events = []) {
  return events.filter((e) => e.start <= date && date <= e.end);
}

export function eventFactor(date, events, category) {
  const cat = CATEGORIES[category] || CATEGORIES.other;
  return eventsOn(date, events).reduce((s, e) => s + (Number(e.uplift) / 100) * cat.event, 0);
}

function pctLabel(x) {
  const v = Math.round(x * 100);
  return `${v > 0 ? '+' : ''}${v}%`;
}

/**
 * Run the forecast.
 * @param {object} state  app state
 * @param {{ now?: Date }} [opts]
 */
export function runLocalForecast(state, { now = new Date() } = {}) {
  const today = toISODate(now);
  const s = state.settings;
  const lead = Math.max(0, Number(s.leadDays) || 0);
  const cycle = Math.max(1, Number(s.cycleDays) || 1);
  const windowDays = lead + cycle;
  const dates = Array.from({ length: windowDays }, (_, i) => addDays(today, i));
  const wf = weekdayFactors(state.sales);
  const trend = salesTrend(state.sales, today);
  const vol = salesVolatility(state.sales, wf);
  const scale = Math.max(1, Number(s.customers) || 100) / 100;
  const wxByDate = Object.fromEntries((state.weather?.days || []).map((d) => [d.date, d]));
  const windowEvents = state.events.filter((e) => e.end >= dates[0] && e.start <= dates[dates.length - 1]);

  const items = state.items.map((item) => {
    const base = (Number(item.dailyUse) || 0) * scale;
    let demand = 0, noWx = 0, noEv = 0, flatDay = 0, wxSum = 0, evSum = 0;

    for (const date of dates) {
      const w = wf[weekday(date)];
      const wx = weatherFactor(wxByDate[date], item.category);
      const ev = eventFactor(date, state.events, item.category);
      wxSum += wx;
      evSum += ev;
      demand += base * w * trend * (1 + wx) * (1 + ev);
      noWx += base * w * trend * (1 + ev);
      noEv += base * w * trend * (1 + wx);
      flatDay += base * trend * (1 + wx) * (1 + ev);
    }

    const avgDaily = demand / windowDays;
    const safety = base * (Number(s.safetyDays) || 0);
    // Don't order more than can be sold before it spoils.
    const shelfCap = avgDaily * Math.max(1, item.shelfLifeDays || 1) + safety;
    let target = Math.min(demand + safety, shelfCap);
    target = Math.max(target, item.par || 0);
    if (item.max) target = Math.min(target, item.max);
    const qty = Math.max(0, Math.ceil(target - item.stock));

    const daysCover = avgDaily > 0 ? item.stock / avgDaily : Infinity;
    const urgency = item.stock < item.par || daysCover < lead + 0.5 ? 'now' : daysCover < windowDays ? 'soon' : 'ok';

    const cat = CATEGORIES[item.category] || CATEGORIES.other;
    const wxSensitivity = Math.abs(cat.rain) + Math.abs(cat.hot);
    const confidence = Math.round(clamp(
      96 - windowDays * 1.2 - vol * 45 - windowEvents.length * 2.5 - wxSensitivity * 12 - (item.shelfLifeDays <= 2 ? 3 : 0),
      55, 97,
    ));
    const spread = Math.ceil(Math.max(qty, avgDaily) * ((100 - confidence) / 100) * 1.5);

    // Explainable drivers: how much each signal moved this window's demand.
    const drivers = [];
    if (item.stock < item.par) drivers.push({ type: 'stock', label: '📊 Below par', impact: 1 });
    const wxImpact = noWx ? demand / noWx - 1 : 0;
    if (Math.abs(wxImpact) >= 0.02) {
      const rainy = dates.some((d) => wxByDate[d] && weatherInfo(wxByDate[d].code).kind === 'rain');
      drivers.push({ type: 'wx', label: `${rainy ? '🌧' : '☀️'} Weather ${pctLabel(wxImpact)}`, impact: Math.abs(wxImpact) });
    }
    const evImpact = noEv ? demand / noEv - 1 : 0;
    if (Math.abs(evImpact) >= 0.02) {
      const names = windowEvents.map((e) => e.name);
      const label = names.length === 1 ? names[0] : `${names.length} events`;
      drivers.push({ type: 'ev', label: `🎉 ${label} ${pctLabel(evImpact)}`, impact: Math.abs(evImpact) });
    }
    const dayImpact = flatDay ? demand / flatDay - 1 : 0;
    if (Math.abs(dayImpact) >= 0.03) {
      drivers.push({ type: 'day', label: `📅 ${dayImpact > 0 ? 'Busy days' : 'Quiet days'} ${pctLabel(dayImpact)}`, impact: Math.abs(dayImpact) });
    }
    if (Math.abs(trend - 1) >= 0.03) {
      drivers.push({ type: 'trend', label: `📈 Sales trend ${pctLabel(trend - 1)}`, impact: Math.abs(trend - 1) });
    }
    if (!drivers.length) drivers.push({ type: 'hist', label: '📊 Steady demand', impact: 0 });
    drivers.sort((a, b) => b.impact - a.impact);

    return {
      itemId: item.id,
      name: item.name,
      emoji: item.emoji,
      unit: item.unit,
      category: item.category,
      supplierId: item.supplierId,
      stock: item.stock,
      par: item.par,
      cost: item.cost,
      avgDaily: Math.round(avgDaily * 10) / 10,
      demand: Math.round(demand * 10) / 10,
      daysCover: Number.isFinite(daysCover) ? Math.round(daysCover * 10) / 10 : null,
      qty,
      low: Math.max(0, qty - spread),
      high: qty + spread,
      confidence,
      urgency,
      drivers: drivers.slice(0, 3).map(({ type, label }) => ({ type, label })),
      note: '',
    };
  });

  const order = { now: 0, soon: 1, ok: 2 };
  items.sort((a, b) => order[a.urgency] - order[b.urgency] || b.qty * b.cost - a.qty * a.cost);

  return {
    generatedAt: now.toISOString(),
    today,
    windowDays,
    source: 'local',
    reasoning: buildReasoning({ items, dates, wxByDate, windowEvents, trend, state }),
    items,
  };
}

function buildReasoning({ items, dates, wxByDate, windowEvents, trend, state }) {
  const lines = [];
  const rainy = dates.filter((d) => wxByDate[d] && weatherInfo(wxByDate[d].code).kind === 'rain');
  const cold = dates.filter((d) => wxByDate[d] && wxByDate[d].tempMax < 55);
  if (rainy.length) lines.push(`${rainy.length} wet day${rainy.length > 1 ? 's' : ''} in the next ${dates.length} will lift hot-drink demand, so milk-based stock is weighted up.`);
  else if (cold.length) lines.push(`Cool temperatures favour hot drinks over the next ${dates.length} days.`);
  else lines.push(`Weather looks mild over the next ${dates.length} days with little effect on demand.`);
  if (windowEvents.length) {
    lines.push(`Local events in the window — ${windowEvents.map((e) => `${e.name} (+${e.uplift}%)`).join(', ')} — add footfall, mostly for bakery and food.`);
  }
  if (Math.abs(trend - 1) >= 0.03) lines.push(`Sales are trending ${trend > 1 ? 'up' : 'down'} ${Math.abs(Math.round((trend - 1) * 100))}% versus the prior fortnight.`);
  const urgent = items.filter((i) => i.urgency === 'now');
  if (urgent.length) lines.push(`${urgent.map((i) => i.name).join(', ')} ${urgent.length > 1 ? 'are' : 'is'} below par or will run out before the next delivery — order today.`);
  const perishables = items.filter((i) => (state.items.find((x) => x.id === i.itemId)?.shelfLifeDays ?? 9) <= 2 && i.qty > 0);
  if (perishables.length) lines.push(`Short-life items (${perishables.map((i) => i.name).join(', ')}) are capped to what sells before spoiling, to keep waste down.`);
  return lines.join('\n');
}

/** Order lines for items the forecast says to buy. */
export function forecastToCartLines(forecast, { onlyUrgent = false } = {}) {
  return (forecast?.items || [])
    .filter((i) => i.qty > 0 && (!onlyUrgent || i.urgency !== 'ok'))
    .map((i) => ({ itemId: i.itemId, qty: i.qty }));
}
