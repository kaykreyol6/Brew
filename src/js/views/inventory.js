import { html } from '../core/html.js';
import { icon } from '../core/icons.js';
import { money, num, fmtDate, relDay, uid, toISODate } from '../core/format.js';
import { openModal, toast, confirmDialog, downloadFile, toCSV } from '../core/ui.js';
import { href } from '../core/router.js';
import { CATEGORIES, UNITS, WASTE_REASONS } from '../data/catalog.js';
import { pageHeader, card, itemCell, statusBadge, stockMeter, emptyState, qtyStepper } from '../components/widgets.js';
import { stockStatus, inventoryValue, lowStockItems } from '../services/metrics.js';

export const title = 'Inventory';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'low', label: 'Low' },
  { key: 'watch', label: 'Watch' },
  { key: 'ok', label: 'Healthy' },
];

/* ── List ───────────────────────────────────────────────── */
export function render(ctx) {
  const { state, route } = ctx;
  if (route.segments[1] === 'count') return renderCount(ctx);
  if (route.segments[1]) return renderDetail(ctx, route.segments[1]);

  const filter = FILTERS.some((f) => f.key === route.query.filter) ? route.query.filter : 'all';
  const cat = CATEGORIES[route.query.category] ? route.query.category : '';
  const q = (route.query.q || '').toLowerCase();
  const counts = Object.fromEntries(FILTERS.map((f) => [f.key, f.key === 'all' ? state.items.length : state.items.filter((i) => stockStatus(i) === f.key).length]));
  const items = state.items
    .filter((i) => filter === 'all' || stockStatus(i) === filter)
    .filter((i) => !cat || i.category === cat)
    .sort((a, b) => a.stock / (a.par || 1) - b.stock / (b.par || 1));
  const supplierName = (id) => state.suppliers.find((s) => s.id === id)?.name || '—';
  const usedCats = [...new Set(state.items.map((i) => i.category))];

  return html`
    ${pageHeader({
      title: 'Inventory',
      subtitle: `${state.items.length} items · ${money(inventoryValue(state), state.settings.currency)} on hand · ${lowStockItems(state).length} below par`,
      actions: html`
        <a class="btn" href="#/inventory/count">${icon('clipboard')}Count stock</a>
        <button type="button" class="btn btn-primary" data-action="new-item">${icon('plus')}Add item</button>`,
    })}

    <div class="toolbar">
      <label class="search">${icon('search')}<span class="sr-only">Search items</span>
        <input class="input" type="search" placeholder="Search items…" value="${route.query.q || ''}" data-input="filter-rows" autocomplete="off">
      </label>
      <nav class="chips scroll" aria-label="Filter by stock status">
        ${FILTERS.map((f) => html`<a class="chip" href="${href('/inventory', { filter: f.key === 'all' ? '' : f.key, category: cat })}" aria-current="${filter === f.key}">${f.label} <span class="count">${counts[f.key]}</span></a>`)}
      </nav>
      <label class="sr-only" for="cat-filter">Category</label>
      <select class="select" id="cat-filter" style="width:auto;min-width:160px" data-change="filter-category">
        <option value="">All categories</option>
        ${usedCats.map((c) => html`<option value="${c}" ${c === cat ? 'selected' : ''}>${CATEGORIES[c]?.label || c}</option>`)}
      </select>
    </div>

    ${card({
      flush: true,
      body: items.length ? html`
        <div class="table-wrap">
          <table class="table table-responsive" id="inv-table">
            <thead><tr>
              <th scope="col">Item</th><th scope="col">Status</th><th scope="col">On hand</th>
              <th scope="col" class="col-num">Par / Max</th><th scope="col" class="col-num">Unit cost</th><th scope="col">Supplier</th>
              <th scope="col" class="col-actions"><span class="sr-only">Actions</span></th>
            </tr></thead>
            <tbody>
              ${items.map((i) => html`<tr data-name="${`${i.name} ${CATEGORIES[i.category]?.label || ''}`.toLowerCase()}" ${q && !`${i.name} ${CATEGORIES[i.category]?.label || ''}`.toLowerCase().includes(q) ? 'hidden' : ''}>
                <td class="cell-full">${itemCell(i, { meta: CATEGORIES[i.category]?.label || i.category })}</td>
                <td data-label="Status">${statusBadge(i)}</td>
                <td data-label="On hand">
                  <div class="row" style="gap:8px">
                    <button type="button" class="btn btn-ghost btn-icon btn-sm" data-action="adjust" data-id="${i.id}" data-delta="-1" aria-label="Remove one ${i.unit} of ${i.name}">${icon('minus')}</button>
                    <span class="num strong" style="min-width:56px;text-align:center">${num(i.stock, 1)} <span class="subtle xsmall">${i.unit}</span></span>
                    <button type="button" class="btn btn-ghost btn-icon btn-sm" data-action="adjust" data-id="${i.id}" data-delta="1" aria-label="Add one ${i.unit} of ${i.name}">${icon('plus')}</button>
                  </div>
                  <div style="margin-top:6px;max-width:180px">${stockMeter(i)}</div>
                </td>
                <td data-label="Par / Max" class="col-num">${num(i.par)} / ${num(i.max)}</td>
                <td data-label="Unit cost" class="col-num">${money(i.cost, state.settings.currency)}</td>
                <td data-label="Supplier">${supplierName(i.supplierId)}</td>
                <td class="col-actions">
                  <button type="button" class="btn btn-sm btn-secondary" data-action="quick-order" data-id="${i.id}">${icon('cart')}Order</button>
                  <button type="button" class="btn btn-sm btn-ghost" data-action="edit-item" data-id="${i.id}" aria-label="Edit ${i.name}">${icon('edit')}<span class="btn-text">Edit</span></button>
                </td>
              </tr>`)}
            </tbody>
          </table>
          <div id="no-match" ${items.some((i) => !q || `${i.name} ${CATEGORIES[i.category]?.label || ''}`.toLowerCase().includes(q)) ? 'hidden' : ''}>
            ${emptyState({ iconName: 'search', title: 'No matching items', text: 'Try a different search term.' })}
          </div>
        </div>`
        : emptyState({
          iconName: 'box',
          title: state.items.length ? 'Nothing matches this filter' : 'No inventory yet',
          text: state.items.length ? 'Try another status or category.' : 'Add the perishables you order regularly to start forecasting.',
          actions: state.items.length ? html`<a class="btn" href="#/inventory">Clear filters</a>` : html`<button type="button" class="btn btn-primary" data-action="new-item">${icon('plus')}Add your first item</button>`,
        }),
      footer: items.length ? html`
        <button type="button" class="btn btn-sm btn-ghost" data-action="export-inventory">${icon('download')}Export CSV</button>
        <button type="button" class="btn btn-sm btn-secondary" data-action="order-low" ${lowStockItems(state).length ? '' : 'disabled'}>${icon('cart')}Order all low items</button>` : '',
    })}`;
}

/* ── Stock count ────────────────────────────────────────── */
function renderCount({ state }) {
  return html`
    ${pageHeader({
      title: 'Stock count',
      subtitle: 'Enter what’s physically on the shelf. Leave a field unchanged to keep the current figure.',
      crumbs: [{ label: 'Inventory', href: '#/inventory' }, { label: 'Count' }],
    })}
    <form data-form="stock-count" class="stack" autocomplete="off">
      ${card({
        flush: true,
        body: state.items.length ? html`<div class="table-wrap"><table class="table table-responsive">
          <thead><tr><th scope="col">Item</th><th scope="col">System figure</th><th scope="col">Counted</th></tr></thead>
          <tbody>${state.items.map((i) => html`<tr>
            <td class="cell-full">${itemCell(i, { link: false, meta: `Par ${num(i.par)} ${i.unit}` })}</td>
            <td data-label="System figure" class="num">${num(i.stock, 1)} ${i.unit}</td>
            <td data-label="Counted">${qtyStepper({ name: `count:${i.id}`, value: i.stock, label: `${i.name} counted (${i.unit})` })}</td>
          </tr>`)}</tbody>
        </table></div>` : emptyState({ iconName: 'box', title: 'No items to count', actions: html`<a class="btn btn-primary" href="#/inventory">Go to inventory</a>` }),
        footer: html`<a class="btn btn-ghost" href="#/inventory">Cancel</a><button type="submit" class="btn btn-primary">${icon('check')}Save count</button>`,
      })}
    </form>`;
}

/* ── Detail ─────────────────────────────────────────────── */
function renderDetail({ state, today }, id) {
  const item = state.items.find((i) => i.id === id);
  if (!item) {
    return html`${pageHeader({ title: 'Item not found', crumbs: [{ label: 'Inventory', href: '#/inventory' }, { label: 'Not found' }] })}
      ${card({ body: emptyState({ iconName: 'search', title: 'This item no longer exists', text: 'It may have been deleted.', actions: html`<a class="btn btn-primary" href="#/inventory">Back to inventory</a>` }) })}`;
  }
  const cur = state.settings.currency;
  const supplier = state.suppliers.find((s) => s.id === item.supplierId);
  const daily = item.dailyUse * (state.settings.customers / 100);
  const cover = daily ? item.stock / daily : null;
  const fc = state.forecast?.items.find((f) => f.itemId === item.id);
  const wasteLog = state.waste.filter((w) => w.itemId === item.id).slice(0, 6);
  const orders = state.orders.filter((o) => o.lines.some((l) => l.itemId === item.id)).slice(0, 6);
  const inCart = state.cart.find((c) => c.itemId === item.id);

  return html`
    ${pageHeader({
      title: html`<span class="row" style="gap:12px"><span aria-hidden="true">${item.emoji}</span>${item.name}</span>`,
      subtitle: html`${CATEGORIES[item.category]?.label || item.category} · ${supplier ? html`<a href="#/settings?section=suppliers">${supplier.name}</a>` : 'No supplier'}`,
      crumbs: [{ label: 'Inventory', href: '#/inventory' }, { label: item.name }],
      actions: html`
        <button type="button" class="btn" data-action="edit-item" data-id="${item.id}">${icon('edit')}Edit</button>
        <button type="button" class="btn" data-action="log-waste-item" data-id="${item.id}">${icon('leaf')}Log waste</button>
        <button type="button" class="btn btn-primary" data-action="quick-order" data-id="${item.id}">${icon('cart')}${inCart ? `In cart (${num(inCart.qty)})` : 'Add to order'}</button>`,
    })}

    <div class="grid-kpi">
      <div class="kpi tone-${stockStatus(item) === 'low' ? 'danger' : 'success'}">
        <span class="kpi-label"><span class="kpi-icon">${icon('box', { size: 16 })}</span>On hand</span>
        <span class="kpi-value">${num(item.stock, 1)} <span class="small subtle">${item.unit}</span></span>
        ${statusBadge(item)}
      </div>
      <div class="kpi tone-info">
        <span class="kpi-label"><span class="kpi-icon">${icon('calendar', { size: 16 })}</span>Days of cover</span>
        <span class="kpi-value">${cover === null ? '—' : num(cover, 1)}</span>
        <span class="kpi-sub">at ~${num(daily, 1)} ${item.unit}/day</span>
      </div>
      <div class="kpi tone-brand">
        <span class="kpi-label"><span class="kpi-icon">${icon('sparkles', { size: 16 })}</span>Forecast order</span>
        <span class="kpi-value">${fc ? num(fc.qty) : '—'}</span>
        <span class="kpi-sub">${fc ? `${fc.confidence}% confidence · ${relDay(state.forecast.today, today)}` : html`<a href="#/forecast">Run a forecast</a>`}</span>
      </div>
      <div class="kpi tone-warning">
        <span class="kpi-label"><span class="kpi-icon">${icon('dollar', { size: 16 })}</span>Stock value</span>
        <span class="kpi-value">${money(item.stock * item.cost, cur)}</span>
        <span class="kpi-sub">${money(item.cost, cur)} per ${item.unit.replace(/s$/, '')}</span>
      </div>
    </div>

    <div class="grid-main-aside">
      <div class="stack">
        ${card({
          title: 'Adjust stock', iconName: 'refresh',
          body: html`<form class="row-wrap" data-form="set-stock" data-id="${item.id}" style="gap:12px">
            ${qtyStepper({ name: 'stock', value: item.stock, label: `${item.name} on hand` })}
            <span class="muted small">${item.unit}</span>
            <span class="spacer"></span>
            <button type="submit" class="btn btn-primary">${icon('check')}Update stock</button>
          </form>
          <div style="margin-top:16px">${stockMeter(item)}</div>
          <div class="row" style="justify-content:space-between;margin-top:6px"><span class="xsmall subtle">0</span><span class="xsmall subtle">Par ${num(item.par)}</span><span class="xsmall subtle">Max ${num(item.max)}</span></div>`,
        })}
        ${card({
          title: 'Order history', iconName: 'history',
          link: { href: '#/orders?view=history', label: 'All orders' },
          body: orders.length ? html`<div class="list">${orders.map((o) => {
            const l = o.lines.find((x) => x.itemId === item.id);
            return html`<a class="list-item" href="#/orders/${o.id}">
              <div class="li-main"><div class="li-title">${o.number}</div><div class="li-sub">${fmtDate(o.createdAt.slice(0, 10))} · ${o.status}</div></div>
              <span class="num strong">${num(l.qty)} ${item.unit}</span>${icon('chevronRight', { size: 16 })}
            </a>`;
          })}</div>` : html`<p class="muted small">No orders for this item yet.</p>`,
        })}
      </div>
      <div class="stack">
        ${card({
          title: 'Details', iconName: 'info',
          body: html`<dl class="dl">
            <dt>Par level</dt><dd>${num(item.par)} ${item.unit}</dd>
            <dt>Max storage</dt><dd>${num(item.max)} ${item.unit}</dd>
            <dt>Use / 100 customers</dt><dd>${num(item.dailyUse, 2)} ${item.unit}</dd>
            <dt>Shelf life</dt><dd>${num(item.shelfLifeDays)} days</dd>
            <dt>Lead time</dt><dd>${supplier ? `${supplier.leadDays} day${supplier.leadDays === 1 ? '' : 's'}` : '—'}</dd>
          </dl>`,
        })}
        ${card({
          title: 'Recent waste', iconName: 'leaf',
          link: { href: '#/waste', label: 'Waste log' },
          body: wasteLog.length ? html`<div class="list">${wasteLog.map((w) => html`<div class="list-item">
            <div class="li-main"><div class="li-title">${num(w.qty)} ${item.unit} · ${w.reason}</div><div class="li-sub">${relDay(w.date, today)}</div></div>
            <span class="num text-danger">−${money(w.cost, cur)}</span></div>`)}</div>` : html`<p class="muted small">No waste recorded. 🎉</p>`,
        })}
        <button type="button" class="btn btn-danger" data-action="delete-item" data-id="${item.id}">${icon('trash')}Delete item</button>
      </div>
    </div>`;
}

/* ── Modals ─────────────────────────────────────────────── */
export function openItemModal({ store }, item = null) {
  const state = store.get();
  const v = item || { emoji: '📦', name: '', category: 'dairy', unit: 'units', stock: 0, par: 5, max: 20, cost: 1, dailyUse: 1, shelfLifeDays: 7, supplierId: state.suppliers[0]?.id || '' };
  openModal({
    title: item ? `Edit ${item.name}` : 'Add inventory item',
    submitLabel: item ? 'Save changes' : 'Add item',
    size: 'lg',
    body: html`<div class="form-grid">
      <div class="field"><label for="f-name">Name</label><input class="input" id="f-name" name="name" value="${v.name}" required maxlength="60" placeholder="e.g. Almond milk"></div>
      <div class="field"><label for="f-emoji">Icon</label><input class="input" id="f-emoji" name="emoji" value="${v.emoji}" maxlength="4" placeholder="📦"><span class="hint">Any emoji</span></div>
      <div class="field"><label for="f-cat">Category</label><select class="select" id="f-cat" name="category">${Object.entries(CATEGORIES).map(([k, c]) => html`<option value="${k}" ${k === v.category ? 'selected' : ''}>${c.label}</option>`)}</select><span class="hint">Sets how weather & events affect demand</span></div>
      <div class="field"><label for="f-unit">Unit</label><select class="select" id="f-unit" name="unit">${[...new Set([v.unit, ...UNITS])].map((u) => html`<option ${u === v.unit ? 'selected' : ''}>${u}</option>`)}</select></div>
      <div class="field"><label for="f-stock">On hand</label><input class="input" id="f-stock" type="number" name="stock" min="0" step="any" value="${v.stock}" required></div>
      <div class="field"><label for="f-cost">Unit cost (${state.settings.currency})</label><input class="input" id="f-cost" type="number" name="cost" min="0" step="0.01" value="${v.cost}" required></div>
      <div class="field"><label for="f-par">Par level</label><input class="input" id="f-par" type="number" name="par" min="0" step="any" value="${v.par}" required><span class="hint">Minimum to keep on the shelf</span></div>
      <div class="field"><label for="f-max">Max storage</label><input class="input" id="f-max" type="number" name="max" min="0" step="any" value="${v.max}" required><span class="hint">Fridge / shelf capacity</span></div>
      <div class="field"><label for="f-use">Use per 100 customers / day</label><input class="input" id="f-use" type="number" name="dailyUse" min="0" step="any" value="${v.dailyUse}" required></div>
      <div class="field"><label for="f-shelf">Shelf life (days)</label><input class="input" id="f-shelf" type="number" name="shelfLifeDays" min="1" step="1" value="${v.shelfLifeDays}" required></div>
      <div class="field span-2"><label for="f-sup">Supplier</label><select class="select" id="f-sup" name="supplierId">
        <option value="">No supplier</option>
        ${state.suppliers.map((s) => html`<option value="${s.id}" ${s.id === v.supplierId ? 'selected' : ''}>${s.name} (${s.leadDays}d lead)</option>`)}
      </select></div>
    </div>`,
    onSubmit: (data) => {
      const payload = { ...(item || {}), ...data, supplierId: data.supplierId || null };
      ['stock', 'cost', 'par', 'max', 'dailyUse', 'shelfLifeDays'].forEach((k) => { payload[k] = Number(data[k]); });
      store.dispatch('saveItem', payload);
      toast(item ? `${payload.name} updated.` : `${payload.name} added to inventory.`);
    },
  });
}

export function openOrderItemModal({ store }, itemId) {
  const state = store.get();
  const item = state.items.find((i) => i.id === itemId);
  if (!item) return;
  const fc = state.forecast?.items.find((f) => f.itemId === itemId);
  const suggested = fc?.qty || Math.max(1, Math.ceil((item.max || item.par * 2) - item.stock));
  openModal({
    title: `Order ${item.name}`,
    submitLabel: 'Add to cart',
    body: html`<div class="form">
      <div class="callout callout-brand">${icon('sparkles')}<div>Suggested: <strong>${num(suggested)} ${item.unit}</strong> ${fc ? `(from today’s forecast, ${fc.confidence}% confidence)` : '(tops you up to max storage)'}.</div></div>
      <div class="field"><span class="field-label" id="oq-l">Quantity (${item.unit})</span>${qtyStepper({ name: 'qty', value: suggested, label: 'Order quantity', min: 1 })}</div>
      <p class="small muted">Estimated cost: ${money(suggested * item.cost, state.settings.currency)} at ${money(item.cost, state.settings.currency)} each.</p>
    </div>`,
    onSubmit: ({ qty }) => {
      store.dispatch('addToCart', { lines: [{ itemId, qty: Number(qty) }] });
      toast(`Added ${num(Number(qty))} ${item.unit} of ${item.name} to the order.`, { href: '#/orders', actionLabel: 'View cart' });
    },
  });
}

export function openWasteModal({ store, today = toISODate() }, presetItemId) {
  const state = store.get();
  if (!state.items.length) { toast('Add inventory items first.', { type: 'info' }); return; }
  openModal({
    title: 'Log waste',
    submitLabel: 'Log waste',
    body: html`<div class="form-grid">
      <div class="field span-2"><label for="w-item">Item</label><select class="select" id="w-item" name="itemId" required>
        ${state.items.map((i) => html`<option value="${i.id}" ${i.id === presetItemId ? 'selected' : ''}>${i.emoji} ${i.name} (${num(i.stock, 1)} ${i.unit} on hand)</option>`)}
      </select></div>
      <div class="field"><label for="w-qty">Quantity</label><input class="input" id="w-qty" type="number" name="qty" min="0.01" step="any" inputmode="decimal" required placeholder="e.g. 3"></div>
      <div class="field"><label for="w-date">Date</label><input class="input" id="w-date" type="date" name="date" value="${today}" max="${today}" required></div>
      <div class="field span-2"><span class="field-label">Reason</span>
        <div class="chips" role="radiogroup" aria-label="Reason">
          ${WASTE_REASONS.map((r, idx) => html`<label class="chip"><input type="radio" name="reason" value="${r}" ${idx === 0 ? 'checked' : ''} style="accent-color:var(--brand)"> ${r}</label>`)}
        </div>
      </div>
      <p class="span-2 xsmall subtle">Logged waste is deducted from stock on hand.</p>
    </div>`,
    onSubmit: ({ itemId, qty, date, reason }) => {
      const it = state.items.find((i) => i.id === itemId);
      store.dispatch('logWaste', { id: uid('w-'), itemId, qty: Number(qty), date, reason });
      toast(`Logged ${num(Number(qty), 2)} ${it?.unit || ''} of ${it?.name || 'item'} as waste.`, { href: '#/waste', actionLabel: 'View log' });
    },
  });
}

/* ── Actions ────────────────────────────────────────────── */
export const actions = {
  'new-item': (_el, ctx) => openItemModal(ctx),
  'edit-item': (el, ctx) => openItemModal(ctx, ctx.store.get().items.find((i) => i.id === el.dataset.id)),
  'quick-order': (el, ctx) => openOrderItemModal(ctx, el.dataset.id),
  'log-waste-item': (el, ctx) => openWasteModal(ctx, el.dataset.id),
  adjust: (el, { store, today }) => store.dispatch('adjustStock', { id: el.dataset.id, delta: Number(el.dataset.delta), today }),
  'delete-item': async (el, { store, go }) => {
    const item = store.get().items.find((i) => i.id === el.dataset.id);
    if (!item) return;
    const ok = await confirmDialog({ title: `Delete ${item.name}?`, message: 'It will be removed from inventory, the cart and the current forecast. Past orders and waste records are kept.', confirmLabel: 'Delete item', danger: true });
    if (!ok) return;
    store.dispatch('deleteItem', { id: item.id });
    go('#/inventory');
    toast(`${item.name} deleted.`);
  },
  'order-low': (_el, { store }) => {
    const state = store.get();
    const lines = lowStockItems(state).map((i) => {
      const fc = state.forecast?.items.find((f) => f.itemId === i.id);
      return { itemId: i.id, qty: fc?.qty || Math.max(1, Math.ceil((i.max || i.par * 2) - i.stock)) };
    });
    store.dispatch('addToCart', { lines });
    toast(`Added ${lines.length} low-stock item${lines.length > 1 ? 's' : ''} to the order.`, { href: '#/orders', actionLabel: 'Review' });
  },
  'export-inventory': (_el, { store }) => {
    const s = store.get();
    const rows = [['Item', 'Category', 'Unit', 'On hand', 'Par', 'Max', 'Unit cost', 'Status', 'Supplier'],
      ...s.items.map((i) => [i.name, CATEGORIES[i.category]?.label || i.category, i.unit, i.stock, i.par, i.max, i.cost, stockStatus(i), s.suppliers.find((x) => x.id === i.supplierId)?.name || ''])];
    downloadFile(`inventory-${toISODate()}.csv`, toCSV(rows), 'text/csv');
  },
};

export const changes = {
  'filter-category': (el, { route, go }) => go(href('/inventory', { ...route.query, category: el.value, q: '' }), { replace: true }),
};

export const inputs = {
  'filter-rows': (el) => {
    const q = el.value.trim().toLowerCase();
    const rows = document.querySelectorAll('#inv-table tbody tr');
    let shown = 0;
    rows.forEach((r) => { const hit = !q || r.dataset.name.includes(q); r.hidden = !hit; if (hit) shown++; });
    const none = document.getElementById('no-match');
    if (none) none.hidden = shown > 0;
    const url = new URL(window.location.href);
    const [path, qs = ''] = url.hash.split('?');
    const params = new URLSearchParams(qs);
    if (q) params.set('q', el.value.trim()); else params.delete('q');
    history.replaceState(null, '', `${path}${params.toString() ? `?${params}` : ''}`);
  },
};

export const forms = {
  'stock-count': (form, data, { store, today, go }) => {
    const counts = {};
    for (const [k, v] of Object.entries(data)) if (k.startsWith('count:')) counts[k.slice(6)] = v === '' ? '' : Number(v);
    const before = store.get().items;
    const changed = before.filter((i) => counts[i.id] !== '' && counts[i.id] !== undefined && Number(counts[i.id]) !== i.stock).length;
    store.dispatch('setStockCounts', { counts, today });
    go('#/dashboard');
    toast(changed ? `Stock count saved — ${changed} item${changed > 1 ? 's' : ''} updated.` : 'Stock count saved — no changes.', { href: '#/forecast', actionLabel: 'Run forecast' });
  },
  'set-stock': (form, data, { store, today }) => {
    const id = form.dataset.id;
    const item = store.get().items.find((i) => i.id === id);
    store.dispatch('setStockCounts', { counts: { [id]: Number(data.stock) }, today });
    toast(`${item.name} set to ${num(Number(data.stock), 1)} ${item.unit}.`);
  },
};

