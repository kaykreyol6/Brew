import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSeed } from '../src/js/data/seed.js';
import { reduce } from '../src/js/core/actions.js';

const NOW = new Date(2026, 10, 11, 9, 0, 0);
const seed = () => createSeed(NOW);

test('adjustStock never goes negative', () => {
  const s = reduce(seed(), 'adjustStock', { id: 'cream', delta: -50, today: '2026-11-11' });
  assert.equal(s.items.find((i) => i.id === 'cream').stock, 0);
  assert.equal(s.meta.lastCountDate, '2026-11-11');
});

test('addToCart merges lines; replace overwrites', () => {
  let s = reduce(seed(), 'addToCart', { lines: [{ itemId: 'milk', qty: 5 }, { itemId: 'nope', qty: 2 }] });
  s = reduce(s, 'addToCart', { lines: [{ itemId: 'milk', qty: 3 }] });
  assert.deepEqual(s.cart, [{ itemId: 'milk', qty: 8 }]);
  s = reduce(s, 'addToCart', { lines: [{ itemId: 'oat', qty: 2 }], replace: true });
  assert.deepEqual(s.cart, [{ itemId: 'oat', qty: 2 }]);
  s = reduce(s, 'setCartQty', { itemId: 'oat', qty: 0 });
  assert.equal(s.cart.length, 0);
});

test('placeOrder splits by supplier, numbers sequentially and clears cart', () => {
  let s = reduce(seed(), 'addToCart', { lines: [{ itemId: 'milk', qty: 10 }, { itemId: 'oat', qty: 4 }, { itemId: 'crois', qty: 24 }] });
  s = reduce(s, 'placeOrder', { now: NOW, note: 'Back door' });
  assert.equal(s.cart.length, 0);
  const placed = s.orders.filter((o) => o.status === 'placed');
  assert.equal(placed.length, 2, 'dairy + bakery');
  assert.deepEqual(placed.map((o) => o.number).sort(), ['PO-1002', 'PO-1003']);
  const dairy = placed.find((o) => o.supplierId === 'sup-dairy');
  assert.equal(dairy.total, 10 * 1.2 + 4 * 2.1);
  assert.equal(dairy.expectedDate, '2026-11-12');
  assert.equal(s.nextOrderNumber, 1004);
});

test('receiveOrder adds received quantities to stock once', () => {
  let s = reduce(seed(), 'addToCart', { lines: [{ itemId: 'milk', qty: 10 }] });
  s = reduce(s, 'placeOrder', { now: NOW });
  const id = s.orders[0].id;
  const before = s.items.find((i) => i.id === 'milk').stock;
  s = reduce(s, 'receiveOrder', { id, received: { milk: 8 }, now: NOW });
  assert.equal(s.items.find((i) => i.id === 'milk').stock, before + 8);
  assert.equal(s.orders[0].status, 'received');
  const again = reduce(s, 'receiveOrder', { id, now: NOW });
  assert.equal(again, s, 'receiving twice is a no-op');
});

test('cancelOrder only cancels placed orders', () => {
  let s = reduce(seed(), 'cancelOrder', { id: 'po-seed-1001' });
  assert.equal(s.orders[0].status, 'received');
  s = reduce(reduce(s, 'addToCart', { lines: [{ itemId: 'milk', qty: 1 }] }), 'placeOrder', { now: NOW });
  s = reduce(s, 'cancelOrder', { id: s.orders[0].id });
  assert.equal(s.orders[0].status, 'cancelled');
});

test('logWaste records cost and deducts stock', () => {
  const s = reduce(seed(), 'logWaste', { id: 'w1', date: '2026-11-11', itemId: 'crois', qty: 3, reason: 'Expired' });
  assert.equal(s.waste[0].id, 'w1');
  assert.equal(s.waste[0].cost, 5.4);
  assert.equal(s.items.find((i) => i.id === 'crois').stock, 5);
});

test('saveItem creates unique ids and keeps max >= par', () => {
  let s = reduce(seed(), 'saveItem', { name: 'Whole Milk', par: 10, max: 4, stock: 1, cost: 1, dailyUse: 1, shelfLifeDays: 3 });
  const created = s.items[s.items.length - 1];
  assert.notEqual(created.id, 'milk');
  assert.equal(created.max, 10);
  s = reduce(s, 'deleteItem', { id: created.id });
  assert.ok(!s.items.some((i) => i.id === created.id));
});

test('deleteSupplier unassigns its items', () => {
  const s = reduce(seed(), 'deleteSupplier', { id: 'sup-dairy' });
  assert.ok(s.items.filter((i) => i.category === 'dairy').every((i) => i.supplierId === null));
});

test('logSales upserts by date', () => {
  let s = reduce(seed(), 'logSales', { date: '2026-11-11', cups: 200 });
  s = reduce(s, 'logSales', { date: '2026-11-11', cups: 250 });
  assert.equal(s.sales.filter((x) => x.date === '2026-11-11').length, 1);
  assert.equal(s.sales.at(-1).cups, 250);
});

test('unknown action throws', () => {
  assert.throws(() => reduce(seed(), 'nope'));
});
