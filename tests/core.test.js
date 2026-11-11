import { test } from 'node:test';
import assert from 'node:assert/strict';
import { html, raw, esc } from '../src/js/core/html.js';
import { parseHash, href } from '../src/js/core/router.js';
import { createStore, STORAGE_KEY } from '../src/js/core/store.js';
import { mergeReview } from '../src/js/services/ai.js';
import { runLocalForecast } from '../src/js/services/forecast.js';
import { workflowStatus, wasteSummary } from '../src/js/services/metrics.js';
import { createSeed } from '../src/js/data/seed.js';

const NOW = new Date(2026, 10, 11, 9, 0, 0);

test('html escapes interpolations but composes nested templates', () => {
  const evil = '<img src=x onerror=alert(1)>';
  const out = String(html`<p title="${evil}">${evil}${html`<b>${'&'}</b>`}${[1, 2]}${raw('<i></i>')}${null}${false}</p>`);
  assert.equal(out, `<p title="${esc(evil)}">${esc(evil)}<b>&amp;</b>12<i></i></p>`);
});

test('router parses paths and queries', () => {
  assert.deepEqual(parseHash('').segments, ['dashboard']);
  const r = parseHash('#/orders/po-1?view=open');
  assert.equal(r.path, '/orders/po-1');
  assert.deepEqual(r.segments, ['orders', 'po-1']);
  assert.equal(r.query.view, 'open');
  assert.equal(href('/inventory', { filter: 'low', q: '' }), '#/inventory?filter=low');
});

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), _m: m };
}

test('store persists, reloads, and exports without the API key', () => {
  const storage = memoryStorage();
  const a = createStore({ storage, now: () => NOW });
  a.dispatch('updateSettings', { shopName: 'Bean There', apiKey: 'sk-secret' });
  const b = createStore({ storage, now: () => NOW });
  assert.equal(b.get().settings.shopName, 'Bean There');
  const exported = b.exportJSON();
  assert.ok(!exported.includes('sk-secret'));
  const c = createStore({ storage: memoryStorage(), now: () => NOW });
  c.importJSON(exported);
  assert.equal(c.get().settings.shopName, 'Bean There');
  assert.throws(() => c.importJSON('{"hello":1}'));
});

test('store survives corrupt storage and blocked storage', () => {
  const storage = memoryStorage();
  storage.setItem(STORAGE_KEY, '{not json');
  assert.equal(createStore({ storage, now: () => NOW }).get().items.length, 8);
  const blocked = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  const s = createStore({ storage: blocked, now: () => NOW });
  assert.equal(s.persistent, false);
  s.dispatch('adjustStock', { id: 'milk', delta: 1 });
  assert.equal(s.get().items[0].stock, 13);
});

test('Claude review is clamped to storage and merged by id', () => {
  const state = createSeed(NOW);
  const base = runLocalForecast(state, { now: NOW });
  const merged = mergeReview(state, base, {
    reasoning: 'Rain ahead.',
    items: [{ id: 'milk', qty: 9999, confidence: 150, note: 'Rainy week' }, { id: 'ghost', qty: 5, confidence: 50, note: '' }],
  });
  const milk = merged.items.find((i) => i.itemId === 'milk');
  assert.equal(milk.qty, 30 - 12, 'capped at max storage minus stock');
  assert.equal(milk.confidence, 100);
  assert.equal(milk.drivers[0].type, 'ai');
  assert.equal(merged.items.length, base.items.length);
  assert.equal(merged.source, 'claude');
});

test('workflow suggests counting first, then forecasting', () => {
  const state = createSeed(NOW);
  const today = '2026-11-11';
  assert.equal(workflowStatus(state, today).next.key, 'count');
  state.meta.lastCountDate = today;
  assert.equal(workflowStatus(state, today).next.key, 'forecast');
  state.forecast = runLocalForecast(state, { now: NOW });
  assert.equal(workflowStatus(state, today).next.key, 'build');
});

test('waste summary has six months and non-negative savings', () => {
  const s = wasteSummary(createSeed(NOW), '2026-11-11');
  assert.equal(s.months.length, 6);
  assert.ok(s.savedThisMonth >= 0 && s.savedTotal >= s.savedThisMonth);
});
