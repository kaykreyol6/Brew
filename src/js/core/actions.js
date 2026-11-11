/**
 * Pure state transitions: (state, payload) => nextState.
 * No DOM, no storage, no clock reads (time is passed in) — fully unit-testable.
 */
import { clamp, slug, toISODate, addDays } from './format.js';

const round2 = (n) => Math.round(n * 100) / 100;
const nonNeg = (n) => Math.max(0, Number(n) || 0);
const byId = (list, id) => list.find((x) => x.id === id);

export const reducers = {
  updateSettings(state, patch) {
    return { ...state, settings: { ...state.settings, ...patch } };
  },

  /* ── Items ─────────────────────────────────────────── */
  saveItem(state, item) {
    const clean = {
      emoji: '📦',
      category: 'other',
      unit: 'units',
      supplierId: null,
      shelfLifeDays: 7,
      ...item,
      name: String(item.name || '').trim() || 'Untitled item',
      stock: nonNeg(item.stock),
      par: nonNeg(item.par),
      max: nonNeg(item.max),
      cost: round2(nonNeg(item.cost)),
      dailyUse: nonNeg(item.dailyUse),
      shelfLifeDays: Math.max(1, Number(item.shelfLifeDays) || 1),
    };
    if (clean.max && clean.max < clean.par) clean.max = clean.par;
    if (!clean.id) {
      let id = slug(clean.name);
      while (byId(state.items, id)) id += '-2';
      clean.id = id;
      return { ...state, items: [...state.items, clean] };
    }
    const exists = byId(state.items, clean.id);
    return {
      ...state,
      items: exists ? state.items.map((i) => (i.id === clean.id ? { ...i, ...clean } : i)) : [...state.items, clean],
    };
  },

  deleteItem(state, { id }) {
    return {
      ...state,
      items: state.items.filter((i) => i.id !== id),
      cart: state.cart.filter((c) => c.itemId !== id),
      forecast: state.forecast ? { ...state.forecast, items: state.forecast.items.filter((f) => f.itemId !== id) } : null,
    };
  },

  adjustStock(state, { id, delta, today }) {
    return {
      ...state,
      items: state.items.map((i) => (i.id === id ? { ...i, stock: round2(nonNeg(i.stock + Number(delta))) } : i)),
      meta: { ...state.meta, lastCountDate: today ?? state.meta?.lastCountDate ?? null },
    };
  },

  /** Bulk stock count: counts = { itemId: qty }. */
  setStockCounts(state, { counts, today }) {
    return {
      ...state,
      items: state.items.map((i) => (counts[i.id] === undefined || counts[i.id] === '' ? i : { ...i, stock: round2(nonNeg(counts[i.id])) })),
      meta: { ...state.meta, lastCountDate: today },
    };
  },

  /* ── Cart ──────────────────────────────────────────── */
  addToCart(state, { lines, replace = false }) {
    const cart = replace ? [] : state.cart.map((c) => ({ ...c }));
    for (const { itemId, qty } of lines) {
      const q = Math.round(nonNeg(qty) * 100) / 100;
      if (!q || !byId(state.items, itemId)) continue;
      const existing = cart.find((c) => c.itemId === itemId);
      if (existing) existing.qty = replace ? q : round2(existing.qty + q);
      else cart.push({ itemId, qty: q });
    }
    return { ...state, cart };
  },

  setCartQty(state, { itemId, qty }) {
    const q = round2(nonNeg(qty));
    return {
      ...state,
      cart: q ? state.cart.map((c) => (c.itemId === itemId ? { ...c, qty: q } : c)) : state.cart.filter((c) => c.itemId !== itemId),
    };
  },

  removeFromCart(state, { itemId }) {
    return { ...state, cart: state.cart.filter((c) => c.itemId !== itemId) };
  },

  clearCart(state) {
    return { ...state, cart: [] };
  },

  /**
   * Turn the cart into purchase orders — one per supplier.
   * payload: { now: Date, note? }
   */
  placeOrder(state, { now, note = '' }) {
    if (!state.cart.length) return state;
    const today = toISODate(now);
    const groups = new Map();
    for (const line of state.cart) {
      const item = byId(state.items, line.itemId);
      if (!item) continue;
      const key = item.supplierId || 'none';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ itemId: item.id, name: item.name, emoji: item.emoji, unit: item.unit, cost: item.cost, qty: line.qty });
    }
    let n = state.nextOrderNumber || 1001;
    const created = [];
    for (const [supplierId, lines] of groups) {
      const supplier = byId(state.suppliers, supplierId);
      const lead = supplier?.leadDays ?? state.settings.leadDays ?? 1;
      created.push({
        id: `po-${now.getTime().toString(36)}-${n}`,
        number: `PO-${n}`,
        supplierId: supplier ? supplier.id : null,
        createdAt: now.toISOString(),
        expectedDate: addDays(today, lead),
        receivedAt: null,
        status: 'placed',
        lines,
        total: round2(lines.reduce((s, l) => s + l.qty * l.cost, 0)),
        note,
      });
      n++;
    }
    return { ...state, orders: [...created, ...state.orders], cart: [], nextOrderNumber: n, lastPlaced: created.map((o) => o.id) };
  },

  /** Mark an order received. received = { itemId: qty } (defaults to ordered qty). */
  receiveOrder(state, { id, received = {}, now }) {
    const order = byId(state.orders, id);
    if (!order || order.status !== 'placed') return state;
    const lines = order.lines.map((l) => ({ ...l, received: received[l.itemId] !== undefined ? nonNeg(received[l.itemId]) : l.qty }));
    const add = Object.fromEntries(lines.map((l) => [l.itemId, l.received]));
    return {
      ...state,
      items: state.items.map((i) => (add[i.id] ? { ...i, stock: round2(i.stock + add[i.id]) } : i)),
      orders: state.orders.map((o) => (o.id === id ? { ...o, lines, status: 'received', receivedAt: now.toISOString() } : o)),
    };
  },

  cancelOrder(state, { id }) {
    return {
      ...state,
      orders: state.orders.map((o) => (o.id === id && o.status === 'placed' ? { ...o, status: 'cancelled' } : o)),
    };
  },

  /** Put a past order's lines back into the cart. */
  reorder(state, { id }) {
    const order = byId(state.orders, id);
    if (!order) return state;
    return reducers.addToCart(state, { lines: order.lines.map((l) => ({ itemId: l.itemId, qty: l.qty })) });
  },

  /* ── Waste ─────────────────────────────────────────── */
  logWaste(state, { id, date, itemId, qty, reason }) {
    const item = byId(state.items, itemId);
    if (!item) return state;
    const q = nonNeg(qty);
    if (!q) return state;
    const entry = { id, date, itemId, qty: q, reason: reason || 'Other', cost: round2(q * item.cost) };
    return {
      ...state,
      waste: [entry, ...state.waste].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
      items: state.items.map((i) => (i.id === itemId ? { ...i, stock: round2(nonNeg(i.stock - q)) } : i)),
    };
  },

  deleteWaste(state, { id }) {
    return { ...state, waste: state.waste.filter((w) => w.id !== id) };
  },

  /* ── Sales ─────────────────────────────────────────── */
  logSales(state, { date, cups }) {
    const c = Math.round(nonNeg(cups));
    const others = state.sales.filter((s) => s.date !== date);
    return { ...state, sales: [...others, { date, cups: c }].sort((a, b) => (a.date < b.date ? -1 : 1)) };
  },

  /* ── Events & suppliers ────────────────────────────── */
  saveEvent(state, ev) {
    const clean = { ...ev, name: String(ev.name || '').trim() || 'Local event', uplift: clamp(Number(ev.uplift) || 0, -90, 300) };
    if (clean.end < clean.start) clean.end = clean.start;
    const exists = byId(state.events, clean.id);
    const events = exists ? state.events.map((e) => (e.id === clean.id ? clean : e)) : [...state.events, clean];
    return { ...state, events: events.sort((a, b) => (a.start < b.start ? -1 : 1)) };
  },

  deleteEvent(state, { id }) {
    return { ...state, events: state.events.filter((e) => e.id !== id) };
  },

  saveSupplier(state, sup) {
    const clean = { ...sup, name: String(sup.name || '').trim() || 'Supplier', leadDays: clamp(Math.round(Number(sup.leadDays) || 1), 0, 30) };
    const exists = byId(state.suppliers, clean.id);
    return { ...state, suppliers: exists ? state.suppliers.map((s) => (s.id === clean.id ? clean : s)) : [...state.suppliers, clean] };
  },

  deleteSupplier(state, { id }) {
    return {
      ...state,
      suppliers: state.suppliers.filter((s) => s.id !== id),
      items: state.items.map((i) => (i.supplierId === id ? { ...i, supplierId: null } : i)),
    };
  },

  /* ── Forecast & weather ────────────────────────────── */
  setForecast(state, forecast) {
    return { ...state, forecast };
  },

  setWeather(state, weather) {
    return { ...state, weather };
  },
};

export function reduce(state, type, payload) {
  const fn = reducers[type];
  if (!fn) throw new Error(`Unknown action: ${type}`);
  return fn(state, payload ?? {});
}
