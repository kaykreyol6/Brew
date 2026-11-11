import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSeed } from '../src/js/data/seed.js';
import { runLocalForecast, weekdayFactors, salesTrend, weatherFactor, forecastToCartLines } from '../src/js/services/forecast.js';
import { addDays, toISODate } from '../src/js/core/format.js';

const NOW = new Date(2026, 10, 11, 9, 0, 0); // Wed 11 Nov 2026
const TODAY = toISODate(NOW);

test('weekday factors average to 1 and fall back without history', () => {
  const wf = weekdayFactors([]);
  assert.equal(wf.length, 7);
  const avg = wf.reduce((a, b) => a + b, 0) / 7;
  assert.ok(Math.abs(avg - 1) < 1e-9);
  assert.ok(wf[6] > wf[1], 'Saturday busier than Monday by default');
});

test('sales trend is neutral without enough data and clamped otherwise', () => {
  assert.equal(salesTrend([], TODAY), 1);
  const sales = [];
  for (let i = 1; i <= 28; i++) sales.push({ date: addDays(TODAY, -i), cups: i <= 14 ? 1000 : 100 });
  assert.equal(salesTrend(sales, TODAY), 1.3);
});

test('rain lifts dairy demand but not produce', () => {
  assert.ok(weatherFactor({ code: 61, tempMax: 60 }, 'dairy') > 0);
  assert.ok(weatherFactor({ code: 61, tempMax: 60 }, 'produce') < 0);
  assert.equal(weatherFactor({ code: 0, tempMax: 65 }, 'dairy'), 0);
});

test('forecast covers every item with sane, bounded quantities', () => {
  const state = createSeed(NOW);
  const fc = runLocalForecast(state, { now: NOW });
  assert.equal(fc.items.length, state.items.length);
  assert.equal(fc.windowDays, state.settings.leadDays + state.settings.cycleDays);
  for (const f of fc.items) {
    const item = state.items.find((i) => i.id === f.itemId);
    assert.ok(Number.isInteger(f.qty) && f.qty >= 0, `${f.name} qty is a non-negative integer`);
    assert.ok(item.stock + f.qty <= item.max + 1, `${f.name} respects storage max`);
    assert.ok(f.low <= f.qty && f.qty <= f.high);
    assert.ok(f.confidence >= 55 && f.confidence <= 97);
    assert.ok(f.drivers.length >= 1 && f.drivers.length <= 3);
  }
  assert.ok(fc.reasoning.length > 20);
});

test('items below par are flagged "order today"', () => {
  const state = createSeed(NOW);
  const fc = runLocalForecast(state, { now: NOW });
  const oat = fc.items.find((i) => i.itemId === 'oat'); // seed: 4 on hand, par 6
  assert.equal(oat.urgency, 'now');
  assert.ok(oat.qty > 0);
  assert.equal(fc.items[0].urgency, 'now', 'urgent items sort first');
});

test('short shelf life caps the order', () => {
  const state = createSeed(NOW);
  state.settings.cycleDays = 10;
  const fc = runLocalForecast(state, { now: NOW });
  const crois = fc.items.find((i) => i.itemId === 'crois'); // 2-day shelf life
  assert.ok(crois.stock + crois.qty <= crois.avgDaily * 2 + crois.avgDaily * 2 + 2, 'no more than ~shelf life of demand');
});

test('events and rain increase projected demand', () => {
  const base = createSeed(NOW);
  base.events = [];
  base.weather.days = base.weather.days.map((d) => ({ ...d, code: 0, tempMax: 65 }));
  const calm = runLocalForecast(base, { now: NOW }).items.find((i) => i.itemId === 'milk');

  const busy = structuredClone(base);
  busy.events = [{ id: 'e', name: 'Fair', start: TODAY, end: addDays(TODAY, 10), uplift: 50 }];
  busy.weather.days = busy.weather.days.map((d) => ({ ...d, code: 63, tempMax: 50 }));
  const hot = runLocalForecast(busy, { now: NOW }).items.find((i) => i.itemId === 'milk');

  assert.ok(hot.demand > calm.demand * 1.3);
  assert.ok(hot.drivers.some((d) => d.type === 'ev'));
});

test('forecastToCartLines skips zero quantities', () => {
  const lines = forecastToCartLines({ items: [{ itemId: 'a', qty: 0, urgency: 'now' }, { itemId: 'b', qty: 3, urgency: 'ok' }] });
  assert.deepEqual(lines, [{ itemId: 'b', qty: 3 }]);
  assert.deepEqual(forecastToCartLines(null), []);
});
