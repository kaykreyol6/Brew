import { html } from '../core/html.js';
import { icon } from '../core/icons.js';
import { money, num, fmtDate, relDay, addDays, toISODate } from '../core/format.js';
import { openModal, toast, confirmDialog, downloadFile, toCSV } from '../core/ui.js';
import { href } from '../core/router.js';
import { pageHeader, card, itemCell, emptyState, qtyStepper, orderStatusBadge } from '../components/widgets.js';
import { cartLines, cartTotal, openOrders, lowStockItems } from '../services/metrics.js';
import { forecastToCartLines } from '../services/forecast.js';

export const title = 'Orders';

const supplierOf = (state, id) => state.suppliers.find((s) => s.id === id) || null;

export function render(ctx) {
  const { state, route } = ctx;
  if (route.segments[1]) return renderDetail(ctx, route.segments[1]);

  const open = openOrders(state);
  const view = ['cart', 'open', 'history'].includes(route.query.view)
    ? route.query.view
    : state.cart.length ? 'cart' : open.length ? 'open' : 'cart';

  const tabs = [
    { key: 'cart', label: 'Draft order', count: state.cart.length },
    { key: 'open', label: 'Open', count: open.length },
    { key: 'history', label: 'History', count: state.orders.length - open.length },
  ];

  return html`
    ${pageHeader({
      title: 'Orders',
      subtitle: 'Build an order from the forecast, send it to suppliers, and receive deliveries into stock.',
      actions: html`<a class="btn" href="#/forecast">${icon('sparkles')}From forecast</a><a class="btn" href="#/inventory">${icon('plus')}Add items</a>`,
    })}
    <nav class="chips" aria-label="Order views">
      ${tabs.map((t) => html`<a class="chip" href="${href('/orders', { view: t.key })}" aria-current="${view === t.key}">${t.label} <span class="count">${t.count}</span></a>`)}
    </nav>
    ${view === 'cart' ? renderCart(ctx) : renderList(ctx, view === 'open' ? open : state.orders.filter((o) => o.status !== 'placed'), view)}`;
}

/* ── Draft order (cart) ─────────────────────────────────── */
function renderCart({ state, today }) {
  const cur = state.settings.currency;
  const lines = cartLines(state);
  if (!lines.length) {
    const low = lowStockItems(state).length;
    return card({ body: emptyState({
      iconName: 'cart',
      title: 'Your draft order is empty',
      text: state.forecast ? 'Add the forecast’s recommendations, or pick items from inventory.' : 'Run a forecast to get recommended quantities, or add items manually from inventory.',
      actions: html`
        ${state.forecast
          ? html`<button type="button" class="btn btn-primary" data-action="cart-from-forecast">${icon('sparkles')}Add forecast recommendations</button>`
          : html`<button type="button" class="btn btn-primary" data-action="run-forecast">${icon('zap')}Run forecast</button>`}
        ${low ? html`<button type="button" class="btn" data-action="order-low">${icon('alert')}Add ${low} low-stock item${low > 1 ? 's' : ''}</button>` : ''}
        <a class="btn" href="#/inventory">Browse inventory</a>`,
    }) });
  }

  // Group lines by supplier — each becomes its own purchase order.
  const groups = new Map();
  for (const l of lines) {
    const key = l.item.supplierId || 'none';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(l);
  }
  const total = cartTotal(state);

  return html`<div class="grid-main-aside">
    <div class="stack">
      ${[...groups].map(([sid, ls]) => {
        const sup = supplierOf(state, sid);
        const lead = sup?.leadDays ?? state.settings.leadDays;
        const sub = ls.reduce((s, l) => s + l.total, 0);
        return card({
          title: sup ? sup.name : 'No supplier assigned', iconName: 'truck',
          meta: `Arrives ${relDay(addDays(today, lead), today).toLowerCase()} · ${money(sub, cur)}`,
          flush: true,
          body: html`<div class="table-wrap"><table class="table table-responsive">
            <thead><tr><th scope="col">Item</th><th scope="col">Quantity</th><th scope="col" class="col-num">Unit cost</th><th scope="col" class="col-num">Line total</th><th scope="col" class="col-actions"><span class="sr-only">Remove</span></th></tr></thead>
            <tbody>${ls.map((l) => html`<tr>
              <td class="cell-full">${itemCell(l.item)}</td>
              <td data-label="Quantity"><div class="row" style="gap:8px">${qtyStepper({ name: `cart:${l.itemId}`, value: l.qty, label: `${l.item.name} quantity`, action: 'cart-qty' })}<span class="xsmall subtle">${l.item.unit}</span></div></td>
              <td data-label="Unit cost" class="col-num">${money(l.item.cost, cur)}</td>
              <td data-label="Line total" class="col-num strong">${money(l.total, cur)}</td>
              <td class="col-actions"><button type="button" class="btn btn-ghost btn-sm" data-action="cart-remove" data-id="${l.itemId}" aria-label="Remove ${l.item.name}">${icon('trash')}<span>Remove</span></button></td>
            </tr>`)}</tbody>
          </table></div>`,
        });
      })}
    </div>
    <div class="stack aside-sticky">
      ${card({
        title: 'Order summary', iconName: 'clipboard',
        body: html`<div class="totals">
          <div class="t-row"><span class="muted">Lines</span><span>${lines.length}</span></div>
          <div class="t-row"><span class="muted">Purchase orders</span><span>${groups.size} supplier${groups.size > 1 ? 's' : ''}</span></div>
          <div class="t-row"><span class="muted">Earliest delivery</span><span>${relDay(addDays(today, Math.min(...[...groups.keys()].map((k) => supplierOf(state, k)?.leadDays ?? state.settings.leadDays))), today)}</span></div>
          <div class="t-row t-total"><span>Estimated total</span><span class="num">${money(total, cur)}</span></div>
        </div>`,
        footer: html`
          <button type="button" class="btn btn-ghost" data-action="cart-clear">Clear</button>
          <button type="button" class="btn btn-primary" data-action="place-order">${icon('truck')}Place order</button>`,
      })}
      <div class="callout">${icon('info')}<div>Placing creates one purchase order per supplier. You can email each supplier from the order page.</div></div>
    </div>
  </div>`;
}

/* ── Order list ─────────────────────────────────────────── */
function renderList({ state, today }, orders, view) {
  const cur = state.settings.currency;
  if (!orders.length) {
    return card({ body: emptyState({
      iconName: view === 'open' ? 'truck' : 'history',
      title: view === 'open' ? 'No deliveries pending' : 'No past orders yet',
      text: view === 'open' ? 'Orders you place appear here until you receive them.' : 'Received and cancelled orders are kept here for reference.',
      actions: html`<a class="btn btn-primary" href="${href('/orders', { view: 'cart' })}">Go to draft order</a>`,
    }) });
  }
  return card({
    flush: true,
    body: html`<div class="table-wrap"><table class="table table-responsive">
      <thead><tr><th scope="col">Order</th><th scope="col">Supplier</th><th scope="col">Placed</th><th scope="col">${view === 'open' ? 'Expected' : 'Received'}</th><th scope="col" class="col-num">Total</th><th scope="col">Status</th><th scope="col" class="col-actions"><span class="sr-only">Actions</span></th></tr></thead>
      <tbody>${orders.map((o) => html`<tr>
        <td class="cell-full"><a class="item-name" href="#/orders/${o.id}">${o.number}</a><div class="item-meta">${o.lines.length} line${o.lines.length > 1 ? 's' : ''} · ${o.lines.slice(0, 3).map((l) => l.emoji).join(' ')}</div></td>
        <td data-label="Supplier">${supplierOf(state, o.supplierId)?.name || 'Multiple / none'}</td>
        <td data-label="Placed">${fmtDate(toISODate(new Date(o.createdAt)))}</td>
        <td data-label="${view === 'open' ? 'Expected' : 'Received'}">${view === 'open' ? relDay(o.expectedDate, today) : o.receivedAt ? fmtDate(toISODate(new Date(o.receivedAt))) : '—'}</td>
        <td data-label="Total" class="col-num strong">${money(o.total, cur)}</td>
        <td data-label="Status">${orderStatusBadge(o, today)}</td>
        <td class="col-actions">
          ${o.status === 'placed' ? html`<button type="button" class="btn btn-sm btn-primary" data-action="receive-order" data-id="${o.id}">${icon('check')}Receive</button>` : html`<button type="button" class="btn btn-sm" data-action="reorder" data-id="${o.id}">${icon('refresh')}Reorder</button>`}
          <a class="btn btn-sm btn-ghost" href="#/orders/${o.id}">View${icon('chevronRight')}</a>
        </td>
      </tr>`)}</tbody>
    </table></div>`,
  });
}

/* ── Order detail ───────────────────────────────────────── */
function renderDetail({ state, today }, id) {
  const o = state.orders.find((x) => x.id === id);
  if (!o) {
    return html`${pageHeader({ title: 'Order not found', crumbs: [{ label: 'Orders', href: '#/orders' }, { label: 'Not found' }] })}
      ${card({ body: emptyState({ iconName: 'search', title: 'We couldn’t find that order', actions: html`<a class="btn btn-primary" href="#/orders?view=history">All orders</a>` }) })}`;
  }
  const cur = state.settings.currency;
  const sup = supplierOf(state, o.supplierId);
  const received = o.status === 'received';

  return html`
    ${pageHeader({
      title: html`${o.number} ${orderStatusBadge(o, today)}`,
      subtitle: `Placed ${fmtDate(toISODate(new Date(o.createdAt)))} · ${sup ? sup.name : 'Multiple / no supplier'}`,
      crumbs: [{ label: 'Orders', href: `#/orders?view=${o.status === 'placed' ? 'open' : 'history'}` }, { label: o.number }],
      actions: html`
        ${sup?.email ? html`<a class="btn" href="${mailto(state, o, sup)}">${icon('upload')}Email supplier</a>` : ''}
        <button type="button" class="btn" data-action="download-order" data-id="${o.id}">${icon('download')}CSV</button>
        <button type="button" class="btn" data-action="print">${icon('printer')}Print</button>
        ${o.status === 'placed'
          ? html`<button type="button" class="btn btn-danger" data-action="cancel-order" data-id="${o.id}">Cancel</button><button type="button" class="btn btn-primary" data-action="receive-order" data-id="${o.id}">${icon('check')}Receive delivery</button>`
          : html`<button type="button" class="btn btn-primary" data-action="reorder" data-id="${o.id}">${icon('refresh')}Reorder</button>`}`,
    })}

    <div class="grid-main-aside">
      ${card({
        title: 'Line items', iconName: 'box', flush: true,
        body: html`<div class="table-wrap"><table class="table table-responsive">
          <thead><tr><th scope="col">Item</th><th scope="col" class="col-num">Ordered</th>${received ? html`<th scope="col" class="col-num">Received</th>` : ''}<th scope="col" class="col-num">Unit cost</th><th scope="col" class="col-num">Total</th></tr></thead>
          <tbody>${o.lines.map((l) => html`<tr>
            <td class="cell-full">${itemCell({ id: l.itemId, name: l.name, emoji: l.emoji }, { link: state.items.some((i) => i.id === l.itemId), meta: l.unit })}</td>
            <td data-label="Ordered" class="col-num">${num(l.qty)}</td>
            ${received ? html`<td data-label="Received" class="col-num ${l.received < l.qty ? 'text-warning' : ''}">${num(l.received ?? l.qty)}</td>` : ''}
            <td data-label="Unit cost" class="col-num">${money(l.cost, cur)}</td>
            <td data-label="Total" class="col-num strong">${money(l.qty * l.cost, cur)}</td>
          </tr>`)}</tbody>
          <tfoot><tr><td colspan="${received ? 4 : 3}">Total</td><td class="col-num">${money(o.total, cur)}</td></tr></tfoot>
        </table></div>`,
      })}
      <div class="stack">
        ${card({
          title: 'Delivery', iconName: 'truck',
          body: html`<dl class="dl">
            <dt>Status</dt><dd>${o.status[0].toUpperCase() + o.status.slice(1)}</dd>
            <dt>Expected</dt><dd>${fmtDate(o.expectedDate)}</dd>
            <dt>Received</dt><dd>${o.receivedAt ? fmtDate(toISODate(new Date(o.receivedAt))) : '—'}</dd>
            ${o.note ? html`<dt>Note</dt><dd>${o.note}</dd>` : ''}
          </dl>`,
        })}
        ${sup ? card({
          title: 'Supplier', iconName: 'store',
          body: html`<div class="stack-sm small">
            <strong>${sup.name}</strong>
            ${sup.email ? html`<a href="mailto:${sup.email}">${sup.email}</a>` : ''}
            ${sup.phone ? html`<a href="tel:${sup.phone.replace(/[^\d+]/g, '')}">${sup.phone}</a>` : ''}
            <span class="muted">Lead time ${sup.leadDays} day${sup.leadDays === 1 ? '' : 's'}</span>
          </div>`,
          footer: html`<a class="btn btn-sm btn-ghost" href="#/settings?section=suppliers">Manage suppliers</a>`,
        }) : ''}
      </div>
    </div>`;
}

function orderText(state, o, sup) {
  const lines = o.lines.map((l) => `- ${l.name}: ${num(l.qty)} ${l.unit}`).join('\n');
  return `Hello ${sup?.name || ''},\n\nPlease supply the following for ${state.settings.shopName} (${state.settings.location}):\n\n${lines}\n\nOrder reference: ${o.number}\nRequested delivery: ${fmtDate(o.expectedDate)}\n\nThank you!`;
}

function mailto(state, o, sup) {
  return `mailto:${encodeURIComponent(sup.email)}?subject=${encodeURIComponent(`${o.number} — ${state.settings.shopName}`)}&body=${encodeURIComponent(orderText(state, o, sup))}`;
}

/* ── Actions ────────────────────────────────────────────── */
function openReceiveModal({ store }, id) {
  const state = store.get();
  const o = state.orders.find((x) => x.id === id);
  if (!o) return;
  openModal({
    title: `Receive ${o.number}`,
    submitLabel: 'Confirm & add to stock',
    body: html`<div class="stack">
      <p class="small muted">Check the delivery against the order. Adjust any short or extra quantities — stock will update to match.</p>
      <div class="list">${o.lines.map((l) => html`<div class="list-item" style="flex-wrap:wrap">
        <span class="item-avatar" aria-hidden="true">${l.emoji}</span>
        <div class="li-main"><div class="li-title">${l.name}</div><div class="li-sub">Ordered ${num(l.qty)} ${l.unit}</div></div>
        ${qtyStepper({ name: `rcv:${l.itemId}`, value: l.qty, label: `${l.name} received` })}
      </div>`)}</div>
    </div>`,
    onSubmit: (data) => {
      const received = {};
      for (const [k, v] of Object.entries(data)) if (k.startsWith('rcv:')) received[k.slice(4)] = Number(v);
      store.dispatch('receiveOrder', { id, received, now: new Date() });
      const short = o.lines.filter((l) => received[l.itemId] < l.qty).length;
      toast(short ? `${o.number} received with ${short} short line${short > 1 ? 's' : ''}. Stock updated.` : `${o.number} received. Stock updated.`, { href: '#/inventory', actionLabel: 'View stock' });
    },
  });
}

export const actions = {
  'cart-remove': (el, { store }) => {
    const prev = store.get().cart.find((c) => c.itemId === el.dataset.id);
    store.dispatch('removeFromCart', { itemId: el.dataset.id });
    if (prev) toast('Removed from order.', { type: 'info', actionLabel: 'Undo', onAction: () => store.dispatch('addToCart', { lines: [prev] }) });
  },
  'cart-clear': async (_el, { store }) => {
    if (await confirmDialog({ title: 'Clear the draft order?', message: 'All lines will be removed. This doesn’t affect placed orders.', confirmLabel: 'Clear order', danger: true })) {
      store.dispatch('clearCart');
      toast('Draft order cleared.', { type: 'info' });
    }
  },
  'cart-from-forecast': (_el, { store }) => {
    const lines = forecastToCartLines(store.get().forecast);
    if (!lines.length) { toast('The forecast doesn’t recommend ordering anything right now.', { type: 'info' }); return; }
    store.dispatch('addToCart', { lines, replace: true });
    toast(`Added ${lines.length} recommended items.`);
  },
  'place-order': (_el, { store, go }) => {
    const state = store.get();
    const total = cartTotal(state);
    openModal({
      title: 'Place order',
      submitLabel: `Place order · ${money(total, state.settings.currency)}`,
      body: html`<div class="form">
        <p class="muted small">This creates purchase orders for ${cartLines(state).length} lines. Received stock is added when you confirm each delivery.</p>
        <div class="field"><label for="o-note">Note for suppliers (optional)</label><textarea class="textarea" id="o-note" name="note" maxlength="280" placeholder="e.g. Please deliver before 7am, use the side door."></textarea></div>
      </div>`,
      onSubmit: ({ note }) => {
        const next = store.dispatch('placeOrder', { now: new Date(), note: note.trim() });
        const created = next.orders.filter((o) => next.lastPlaced?.includes(o.id));
        go(created.length === 1 ? `#/orders/${created[0].id}` : '#/orders?view=open');
        toast(`${created.length} purchase order${created.length > 1 ? 's' : ''} placed: ${created.map((o) => o.number).join(', ')}.`);
      },
    });
  },
  'receive-order': (el, ctx) => openReceiveModal(ctx, el.dataset.id),
  'cancel-order': async (el, { store }) => {
    const o = store.get().orders.find((x) => x.id === el.dataset.id);
    if (await confirmDialog({ title: `Cancel ${o.number}?`, message: 'Let your supplier know too. Stock is not affected.', confirmLabel: 'Cancel order', danger: true })) {
      store.dispatch('cancelOrder', { id: o.id });
      toast(`${o.number} cancelled.`, { type: 'info' });
    }
  },
  reorder: (el, { store, go }) => {
    store.dispatch('reorder', { id: el.dataset.id });
    go('#/orders?view=cart');
    toast('Items added to your draft order.');
  },
  'download-order': (el, { store }) => {
    const s = store.get();
    const o = s.orders.find((x) => x.id === el.dataset.id);
    const rows = [['Order', 'Item', 'Unit', 'Quantity', 'Received', 'Unit cost', 'Line total'],
      ...o.lines.map((l) => [o.number, l.name, l.unit, l.qty, l.received ?? '', l.cost, (l.qty * l.cost).toFixed(2)])];
    downloadFile(`${o.number}.csv`, toCSV(rows), 'text/csv');
  },
  print: () => window.print(),
};

export const changes = {
  'cart-qty': (el, { store }) => {
    const itemId = el.name.replace(/^cart:/, '');
    store.dispatch('setCartQty', { itemId, qty: Number(el.value) });
  },
};
