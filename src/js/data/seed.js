import { addDays, toISODate, weekday } from '../core/format.js';
import { DEFAULT_WEEKDAY_CUPS, WASTE_REASONS } from './catalog.js';

export const SCHEMA_VERSION = 1;

export const DEFAULT_SETTINGS = {
  shopName: 'The Corner Brew',
  location: 'Brooklyn, NY',
  customers: 180,
  currency: 'USD',
  leadDays: 1,       // days from placing an order to delivery
  cycleDays: 3,      // days each delivery should cover
  safetyDays: 1,     // buffer stock, in days of average demand
  wasteBaselinePct: 12, // typical waste % of purchases before forecasting
  theme: 'system',
  liveWeather: true,
  aiEnabled: false,
  apiKey: '',
};

/** Deterministic PRNG so demo data (and tests) are stable. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SUPPLIERS = [
  { id: 'sup-dairy', name: 'Hudson Valley Dairy', email: 'orders@hudsondairy.example', phone: '(555) 201-4410', leadDays: 1 },
  { id: 'sup-bakery', name: 'Sunrise Bakery', email: 'wholesale@sunrisebakery.example', phone: '(555) 201-7720', leadDays: 1 },
  { id: 'sup-produce', name: 'Greenline Produce', email: 'hello@greenline.example', phone: '(555) 201-3398', leadDays: 2 },
  { id: 'sup-barista', name: 'Barista Supply Co.', email: 'support@baristasupply.example', phone: '(555) 201-9001', leadDays: 3 },
];

// dailyUse is per 100 customers; scaled by settings.customers in the forecast.
const ITEMS = [
  { id: 'milk',   emoji: '🥛', name: 'Whole Milk',     category: 'dairy',   unit: 'litres',  stock: 12, par: 8,  max: 30, cost: 1.2, dailyUse: 3.5,  shelfLifeDays: 7,  supplierId: 'sup-dairy' },
  { id: 'oat',    emoji: '🌾', name: 'Oat Milk',       category: 'dairy',   unit: 'litres',  stock: 4,  par: 6,  max: 20, cost: 2.1, dailyUse: 1.4,  shelfLifeDays: 10, supplierId: 'sup-dairy' },
  { id: 'cream',  emoji: '🍦', name: 'Heavy Cream',    category: 'dairy',   unit: 'litres',  stock: 2,  par: 3,  max: 10, cost: 3.5, dailyUse: 0.6,  shelfLifeDays: 7,  supplierId: 'sup-dairy' },
  { id: 'crois',  emoji: '🥐', name: 'Croissants',     category: 'bakery',  unit: 'units',   stock: 8,  par: 12, max: 48, cost: 1.8, dailyUse: 8,    shelfLifeDays: 2,  supplierId: 'sup-bakery' },
  { id: 'muffin', emoji: '🧁', name: 'Muffins',        category: 'bakery',  unit: 'units',   stock: 6,  par: 8,  max: 32, cost: 2.2, dailyUse: 5,    shelfLifeDays: 3,  supplierId: 'sup-bakery' },
  { id: 'sand',   emoji: '🥪', name: 'Sandwiches',     category: 'food',    unit: 'units',   stock: 4,  par: 10, max: 24, cost: 3.8, dailyUse: 4.5,  shelfLifeDays: 2,  supplierId: 'sup-bakery' },
  { id: 'banana', emoji: '🍌', name: 'Bananas',        category: 'produce', unit: 'units',   stock: 10, par: 6,  max: 20, cost: 0.3, dailyUse: 2,    shelfLifeDays: 5,  supplierId: 'sup-produce' },
  { id: 'syrup',  emoji: '🍯', name: 'Flavour Syrups', category: 'syrup',   unit: 'bottles', stock: 3,  par: 2,  max: 8,  cost: 8.5, dailyUse: 0.25, shelfLifeDays: 90, supplierId: 'sup-barista' },
];

function nextWeekday(fromIso, dow, minAhead = 1) {
  let d = addDays(fromIso, minAhead);
  while (weekday(d) !== dow) d = addDays(d, 1);
  return d;
}

export function demoWeather(today) {
  const codes = [3, 61, 0, 2, 63, 0, 3];
  const temps = [58, 52, 68, 63, 55, 66, 60];
  const precip = [20, 85, 5, 15, 70, 5, 25];
  return {
    source: 'demo',
    location: null,
    updatedAt: new Date().toISOString(),
    days: codes.map((code, i) => ({ date: addDays(today, i), code, tempMax: temps[i], precip: precip[i] })),
  };
}

export function createSeed(now = new Date()) {
  const today = toISODate(now);
  const rnd = mulberry32(42);

  // 6 weeks of sales with a gentle upward trend.
  const sales = [];
  for (let i = 41; i >= 1; i--) {
    const date = addDays(today, -i);
    const base = DEFAULT_WEEKDAY_CUPS[weekday(date)];
    const trend = 0.9 + 0.14 * ((41 - i) / 41);
    sales.push({ date, cups: Math.round(base * trend * (0.94 + rnd() * 0.12)) });
  }

  // ~5 months of waste history, shrinking as forecasting "took hold".
  const waste = [];
  for (let m = 5; m >= 0; m--) {
    const entries = 4 + m * 2;
    for (let k = 0; k < entries; k++) {
      const date = addDays(today, -(m * 30 + Math.floor(rnd() * 28) + (m === 0 ? 0 : 1)));
      if (date > today) continue;
      const item = ITEMS[Math.floor(rnd() * ITEMS.length)];
      const qty = item.unit === 'bottles' ? 1 : 1 + Math.floor(rnd() * (item.category === 'bakery' ? 6 : 3));
      waste.push({
        id: `w-seed-${m}-${k}`,
        date,
        itemId: item.id,
        qty,
        reason: WASTE_REASONS[Math.floor(rnd() * 4)],
        cost: +(qty * item.cost).toFixed(2),
      });
    }
  }
  waste.sort((a, b) => (a.date < b.date ? 1 : -1));

  const lastOrderDate = addDays(today, -3);
  const pastLines = [
    { itemId: 'milk', qty: 20 }, { itemId: 'oat', qty: 10 }, { itemId: 'crois', qty: 36 }, { itemId: 'muffin', qty: 24 },
  ].map((l) => {
    const it = ITEMS.find((i) => i.id === l.itemId);
    return { ...l, name: it.name, emoji: it.emoji, unit: it.unit, cost: it.cost, received: l.qty };
  });

  return {
    version: SCHEMA_VERSION,
    settings: { ...DEFAULT_SETTINGS },
    suppliers: SUPPLIERS.map((s) => ({ ...s })),
    items: ITEMS.map((i) => ({ ...i })),
    events: [
      { id: 'ev-market', name: 'Farmers Market', start: nextWeekday(today, 6), end: nextWeekday(today, 6), uplift: 35 },
      { id: 'ev-school', name: 'School Holiday Week', start: nextWeekday(today, 1), end: addDays(nextWeekday(today, 1), 4), uplift: 20 },
      { id: 'ev-marathon', name: 'Marathon Nearby', start: nextWeekday(today, 0, 7), end: nextWeekday(today, 0, 7), uplift: 45 },
    ],
    weather: demoWeather(today),
    sales,
    waste,
    cart: [],
    orders: [
      {
        id: 'po-seed-1001',
        number: 'PO-1001',
        supplierId: null,
        createdAt: new Date(`${lastOrderDate}T08:15:00`).toISOString(),
        expectedDate: addDays(lastOrderDate, 1),
        receivedAt: new Date(`${addDays(lastOrderDate, 1)}T06:45:00`).toISOString(),
        status: 'received',
        lines: pastLines,
        total: +pastLines.reduce((s, l) => s + l.qty * l.cost, 0).toFixed(2),
        note: '',
      },
    ],
    nextOrderNumber: 1002,
    forecast: null,
    meta: { lastCountDate: null, createdAt: now.toISOString() },
  };
}
