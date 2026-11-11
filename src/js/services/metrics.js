/** Derived, read-only metrics computed from state. Pure functions. */
import { addDays, daysBetween, monthKey, toISODate } from '../core/format.js';

export function stockStatus(item) {
  if (item.stock < item.par) return 'low';
  if (item.stock < item.par * 1.5) return 'watch';
  return 'ok';
}

export const STATUS_META = {
  low: { label: 'Low', badge: 'badge-danger', dot: 'dot-danger', meter: 'danger' },
  watch: { label: 'Watch', badge: 'badge-warning', dot: 'dot-warning', meter: 'warning' },
  ok: { label: 'Healthy', badge: 'badge-success', dot: 'dot-success', meter: 'success' },
};

export function lowStockItems(state) {
  return state.items.filter((i) => stockStatus(i) === 'low');
}

export function cartLines(state) {
  return state.cart
    .map((c) => {
      const item = state.items.find((i) => i.id === c.itemId);
      return item ? { ...c, item, total: c.qty * item.cost } : null;
    })
    .filter(Boolean);
}

export function cartTotal(state) {
  return cartLines(state).reduce((s, l) => s + l.total, 0);
}

export function openOrders(state) {
  return state.orders.filter((o) => o.status === 'placed');
}

export function inventoryValue(state) {
  return state.items.reduce((s, i) => s + i.stock * i.cost, 0);
}

export function salesWindow(state, today, days = 7, offset = 0) {
  const from = addDays(today, -(days + offset));
  const to = addDays(today, -(1 + offset));
  return state.sales.filter((s) => s.date >= from && s.date <= to);
}

export function salesSummary(state, today = toISODate()) {
  const last7 = salesWindow(state, today, 7, 0);
  const prev7 = salesWindow(state, today, 7, 7);
  const total = last7.reduce((s, x) => s + x.cups, 0);
  const prev = prev7.reduce((s, x) => s + x.cups, 0);
  return { total, prev, change: prev ? total / prev - 1 : 0, days: last7, today: state.sales.find((s) => s.date === today) || null };
}

export function wasteByMonth(state, today = toISODate(), months = 6) {
  const keys = [];
  const [y, m] = today.split('-').map(Number);
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const totals = Object.fromEntries(keys.map((k) => [k, { key: k, cost: 0, qty: 0, count: 0 }]));
  for (const w of state.waste) {
    const k = monthKey(w.date);
    if (totals[k]) {
      totals[k].cost += w.cost;
      totals[k].qty += w.qty;
      totals[k].count += 1;
    }
  }
  return keys.map((k) => ({ ...totals[k], cost: Math.round(totals[k].cost * 100) / 100 }));
}

export function wasteByItem(state, fromIso) {
  const map = new Map();
  for (const w of state.waste) {
    if (fromIso && w.date < fromIso) continue;
    const cur = map.get(w.itemId) || { itemId: w.itemId, qty: 0, cost: 0, count: 0 };
    cur.qty += w.qty;
    cur.cost += w.cost;
    cur.count += 1;
    map.set(w.itemId, cur);
  }
  return [...map.values()]
    .map((r) => ({ ...r, item: state.items.find((i) => i.id === r.itemId) }))
    .sort((a, b) => b.cost - a.cost);
}

/** Monthly purchase estimate from expected usage — the baseline that waste % applies to. */
export function monthlyPurchaseEstimate(state) {
  const scale = (Number(state.settings.customers) || 100) / 100;
  return state.items.reduce((s, i) => s + i.dailyUse * scale * i.cost * 30, 0);
}

export function wasteSummary(state, today = toISODate()) {
  const months = wasteByMonth(state, today, 6);
  const current = months[months.length - 1];
  const previous = months[months.length - 2];
  const purchases = monthlyPurchaseEstimate(state);
  const baseline = purchases * ((Number(state.settings.wasteBaselinePct) || 0) / 100);
  // Pro-rate the baseline for the part of the current month that has elapsed.
  const dayOfMonth = Number(today.slice(8, 10));
  const daysInMonth = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0).getDate();
  const baselineToDate = baseline * (dayOfMonth / daysInMonth);
  const savedThisMonth = Math.max(0, baselineToDate - current.cost);
  const savedTotal = months.slice(0, -1).reduce((s, m) => s + Math.max(0, baseline - m.cost), 0) + savedThisMonth;
  return {
    months,
    current,
    previous,
    change: previous.cost ? current.cost / previous.cost - 1 : 0,
    baseline,
    purchases,
    savedThisMonth,
    savedTotal,
    wasteRate: purchases ? (current.cost / (purchases * (dayOfMonth / daysInMonth))) : 0,
  };
}

/** Where the shop is in the ordering workflow — powers the dashboard stepper & next-step CTA. */
export function workflowStatus(state, today = toISODate()) {
  const forecastToday = state.forecast && state.forecast.today === today;
  const placedToday = state.orders.some((o) => o.createdAt && toISODate(new Date(o.createdAt)) === today && o.status !== 'cancelled');
  const open = openOrders(state);
  const due = open.filter((o) => daysBetween(o.expectedDate, today) >= 0);
  const wasteToday = state.waste.some((w) => w.date === today);
  const counted = state.meta?.lastCountDate === today;

  const steps = [
    { key: 'count', title: 'Count stock', desc: counted ? 'Counted today' : 'Update on-hand levels', href: '#/inventory/count', icon: 'clipboard', done: counted },
    { key: 'forecast', title: 'Run forecast', desc: forecastToday ? 'Up to date' : 'Predict demand', href: '#/forecast', icon: 'sparkles', done: !!forecastToday },
    { key: 'build', title: 'Build order', desc: state.cart.length ? `${state.cart.length} lines in cart` : 'Add forecast to cart', href: '#/orders', icon: 'cart', done: state.cart.length > 0 || placedToday },
    { key: 'place', title: 'Place order', desc: placedToday ? 'Sent today' : 'Send to suppliers', href: '#/orders', icon: 'truck', done: placedToday },
    { key: 'receive', title: 'Receive', desc: open.length ? `${open.length} open order${open.length > 1 ? 's' : ''}` : 'Nothing pending', href: '#/orders?view=open', icon: 'box', done: open.length === 0 },
    { key: 'waste', title: 'Log waste', desc: wasteToday ? 'Logged today' : 'End-of-day check', href: '#/waste?log=1', icon: 'leaf', done: wasteToday },
  ];

  let next;
  if (due.length) {
    next = { key: 'receive', eyebrow: 'Delivery due', title: `Receive ${due[0].number}`, text: `Confirm what arrived so stock levels stay accurate.`, href: `#/orders/${due[0].id}`, cta: 'Receive delivery', icon: 'truck' };
  } else if (!counted && !forecastToday) {
    next = { key: 'count', eyebrow: 'Start your day', title: 'Count your stock', text: 'A quick count keeps the forecast accurate. Takes about two minutes.', href: '#/inventory/count', cta: 'Start stock count', icon: 'clipboard' };
  } else if (!forecastToday) {
    next = { key: 'forecast', eyebrow: 'Next step', title: 'Run today’s forecast', text: 'Combine sales history, weather and local events into exact order quantities.', action: 'run-forecast', cta: 'Run forecast', icon: 'sparkles' };
  } else if (state.cart.length) {
    next = { key: 'place', eyebrow: 'Ready to send', title: `Review and place your order`, text: `${state.cart.length} line${state.cart.length > 1 ? 's' : ''} waiting in the cart.`, href: '#/orders', cta: 'Review order', icon: 'cart' };
  } else if (!placedToday && state.forecast.items.some((i) => i.qty > 0 && i.urgency !== 'ok')) {
    next = { key: 'build', eyebrow: 'Next step', title: 'Turn the forecast into an order', text: 'Add the recommended quantities to your cart in one tap.', href: '#/forecast', cta: 'Review forecast', icon: 'sparkles' };
  } else if (!wasteToday) {
    next = { key: 'waste', eyebrow: 'End of day', title: 'Log today’s waste', text: 'Recording spoilage helps the forecast learn what you over-order.', href: '#/waste?log=1', cta: 'Log waste', icon: 'leaf' };
  } else {
    next = { key: 'done', eyebrow: 'All caught up', title: 'Today’s workflow is complete', text: 'Nice work. Check back tomorrow morning for a fresh forecast.', href: '#/waste', cta: 'View savings', icon: 'checkCircle' };
  }

  const currentIdx = steps.findIndex((s) => s.key === next.key);
  return { steps: steps.map((s, i) => ({ ...s, current: i === currentIdx })), next };
}
