import { html } from '../core/html.js';
import { icon } from '../core/icons.js';
import { fmtDateTime, uid, toISODate, addDays } from '../core/format.js';
import { openModal, toast, confirmDialog, downloadFile } from '../core/ui.js';
import { pageHeader, card, eventList, weatherStrip } from '../components/widgets.js';
import { AI_MODEL } from '../services/ai.js';

export const title = 'Settings';

const SECTIONS = [
  { key: 'shop', label: 'Shop', icon: 'store' },
  { key: 'ordering', label: 'Ordering', icon: 'truck' },
  { key: 'suppliers', label: 'Suppliers', icon: 'users' },
  { key: 'events', label: 'Events', icon: 'calendar' },
  { key: 'weather', label: 'Weather', icon: 'cloud' },
  { key: 'ai', label: 'Claude AI', icon: 'sparkles' },
  { key: 'appearance', label: 'Appearance', icon: 'sun' },
  { key: 'data', label: 'Data', icon: 'database' },
];

export function render({ state, today, store }) {
  const s = state.settings;
  return html`
    ${pageHeader({ title: 'Settings', subtitle: 'Shop profile, ordering rules, suppliers, local events and integrations.' })}

    <nav class="chips scroll" aria-label="Settings sections">
      ${SECTIONS.map((x) => html`<a class="chip" href="#/settings?section=${x.key}">${icon(x.icon, { size: 14 })}${x.label}</a>`)}
    </nav>

    ${!store.persistent ? html`<div class="callout callout-warning">${icon('alert')}<div><strong>Changes won’t be saved.</strong> Your browser is blocking local storage (private mode?). Export a backup before closing.</div></div>` : ''}

    <form data-form="settings-shop">
      ${card({
        id: 'shop', title: 'Shop profile', iconName: 'store',
        body: html`<div class="form-grid">
          <div class="field"><label for="st-name">Shop name</label><input class="input" id="st-name" name="shopName" value="${s.shopName}" required maxlength="60"></div>
          <div class="field"><label for="st-loc">Location</label><input class="input" id="st-loc" name="location" value="${s.location}" required maxlength="80"><span class="hint">City used for live weather, e.g. “Brooklyn, NY”</span></div>
          <div class="field"><label for="st-cust">Average daily customers</label><input class="input" id="st-cust" type="number" name="customers" min="1" step="1" value="${s.customers}" required><span class="hint">Scales every item’s usage rate</span></div>
          <div class="field"><label for="st-cur">Currency</label><select class="select" id="st-cur" name="currency">${['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'].map((c) => html`<option ${c === s.currency ? 'selected' : ''}>${c}</option>`)}</select></div>
        </div>`,
        footer: html`<button type="submit" class="btn btn-primary">Save profile</button>`,
      })}
    </form>

    <form data-form="settings-ordering">
      ${card({
        id: 'ordering', title: 'Ordering rules', iconName: 'truck',
        body: html`<div class="form-grid">
          <div class="field"><label for="st-lead">Default lead time (days)</label><input class="input" id="st-lead" type="number" name="leadDays" min="0" max="14" step="1" value="${s.leadDays}" required><span class="hint">Used when an item has no supplier</span></div>
          <div class="field"><label for="st-cycle">Order cycle (days)</label><input class="input" id="st-cycle" type="number" name="cycleDays" min="1" max="14" step="1" value="${s.cycleDays}" required><span class="hint">How many days each delivery should cover</span></div>
          <div class="field"><label for="st-safety">Safety buffer (days)</label><input class="input" id="st-safety" type="number" name="safetyDays" min="0" max="7" step="0.5" value="${s.safetyDays}" required><span class="hint">Extra stock for surprise rushes</span></div>
          <div class="field"><label for="st-base">Baseline waste (%)</label><input class="input" id="st-base" type="number" name="wasteBaselinePct" min="0" max="60" step="0.5" value="${s.wasteBaselinePct}" required><span class="hint">Your waste rate before forecasting — used to calculate savings</span></div>
        </div>`,
        footer: html`<button type="submit" class="btn btn-primary">Save rules</button>`,
      })}
    </form>

    ${card({
      id: 'suppliers', title: 'Suppliers', iconName: 'users',
      body: state.suppliers.length ? html`<div class="list">${state.suppliers.map((sup) => {
        const count = state.items.filter((i) => i.supplierId === sup.id).length;
        return html`<div class="list-item">
          <span class="kpi-icon" style="background:var(--info-soft);color:var(--info)">${icon('store', { size: 16 })}</span>
          <div class="li-main"><div class="li-title">${sup.name}</div><div class="li-sub">${sup.leadDays}d lead · ${count} item${count === 1 ? '' : 's'}${sup.email ? ` · ${sup.email}` : ''}</div></div>
          <button type="button" class="btn btn-ghost btn-icon btn-sm" data-action="edit-supplier" data-id="${sup.id}" aria-label="Edit ${sup.name}">${icon('edit')}</button>
          <button type="button" class="btn btn-ghost btn-icon btn-sm" data-action="delete-supplier" data-id="${sup.id}" aria-label="Delete ${sup.name}">${icon('trash')}</button>
        </div>`;
      })}</div>` : html`<p class="muted small">No suppliers yet. Add one so orders can be grouped and emailed.</p>`,
      footer: html`<button type="button" class="btn btn-secondary" data-action="new-supplier">${icon('plus')}Add supplier</button>`,
    })}

    ${card({
      id: 'events', title: 'Local events', iconName: 'calendar',
      body: html`<p class="small muted" style="margin-bottom:12px">Markets, school holidays, games and festivals change footfall. Add them and the forecast adjusts automatically.</p>${eventList(state.events, today, { limit: 50, editable: true })}`,
      footer: html`<button type="button" class="btn btn-secondary" data-action="new-event">${icon('plus')}Add event</button>`,
    })}

    ${card({
      id: 'weather', title: 'Weather', iconName: 'cloud',
      meta: state.weather?.updatedAt ? `Updated ${fmtDateTime(state.weather.updatedAt)}` : '',
      body: html`<div class="stack">
        <label class="switch"><input type="checkbox" data-change="toggle-live-weather" ${s.liveWeather ? 'checked' : ''}> Use live weather from Open-Meteo</label>
        <p class="xsmall subtle">Free, no key needed. Only your city name is sent to look up the forecast. When off or offline, demo weather is used.</p>
        ${weatherStrip(state.weather, today, 7)}
        <p class="small ${state.weather?.source === 'live' ? 'text-success' : 'muted'}">${state.weather?.source === 'live' ? `Live: ${state.weather.location}` : 'Showing demo weather'}</p>
      </div>`,
      footer: html`<button type="button" class="btn" data-action="refresh-weather">${icon('refresh')}Refresh now</button>`,
    })}

    <form data-form="settings-ai">
      ${card({
        id: 'ai', title: 'Claude AI review', iconName: 'sparkles',
        body: html`<div class="stack">
          <p class="small muted">The built-in engine works offline. Optionally, Claude (<code>${AI_MODEL}</code>) can review each forecast against your waste history and explain any adjustments.</p>
          <label class="switch"><input type="checkbox" name="aiEnabled" ${s.aiEnabled ? 'checked' : ''}> Have Claude review forecasts</label>
          <div class="field"><label for="st-key">Anthropic API key</label>
            <input class="input" id="st-key" type="password" name="apiKey" value="${s.apiKey}" autocomplete="off" spellcheck="false" placeholder="sk-ant-…">
            <span class="hint">Get one at console.anthropic.com. Usage is billed to your Anthropic account.</span>
          </div>
          <div class="callout callout-warning">${icon('key')}<div>Your key is stored only in this browser and sent only to Anthropic. Use this on a device you own — don’t enter it on a shared computer. It is never included in exports.</div></div>
        </div>`,
        footer: html`${s.apiKey ? html`<button type="button" class="btn btn-ghost" data-action="clear-key">Remove key</button>` : ''}<button type="submit" class="btn btn-primary">Save AI settings</button>`,
      })}
    </form>

    ${card({
      id: 'appearance', title: 'Appearance', iconName: 'sun',
      body: html`<div class="chips" role="radiogroup" aria-label="Theme">
        ${[['system', 'monitor', 'System'], ['light', 'sun', 'Light'], ['dark', 'moon', 'Dark']].map(([k, ic, label]) => html`<button type="button" class="chip ${s.theme === k ? 'is-active' : ''}" role="radio" aria-checked="${s.theme === k}" data-action="set-theme" data-theme="${k}">${icon(ic, { size: 14 })}${label}</button>`)}
      </div>`,
    })}

    ${card({
      id: 'data', title: 'Data & backup', iconName: 'database',
      body: html`<p class="small muted">Everything is stored locally in this browser. Export a backup to move to another device or keep a copy.</p>`,
      footer: html`
        <button type="button" class="btn btn-danger" data-action="clear-data">${icon('trash')}Start empty</button>
        <button type="button" class="btn" data-action="reset-demo">${icon('refresh')}Reset demo data</button>
        <label class="btn">${icon('upload')}Import backup<input type="file" accept="application/json,.json" data-change="import-data" class="sr-only"></label>
        <button type="button" class="btn btn-primary" data-action="export-data">${icon('download')}Export backup</button>`,
    })}`;
}

export function mount({ route }) {
  const id = route.query.section;
  if (id) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ block: 'start' });
      el.animate?.([{ boxShadow: '0 0 0 3px var(--brand)' }, { boxShadow: '0 0 0 0 transparent' }], { duration: 1400 });
    }
  }
}

/* ── Modals ─────────────────────────────────────────────── */
function supplierModal({ store }, sup = null) {
  openModal({
    title: sup ? `Edit ${sup.name}` : 'Add supplier',
    submitLabel: sup ? 'Save supplier' : 'Add supplier',
    body: html`<div class="form-grid">
      <div class="field span-2"><label for="sp-name">Name</label><input class="input" id="sp-name" name="name" value="${sup?.name || ''}" required maxlength="60"></div>
      <div class="field"><label for="sp-email">Order email</label><input class="input" id="sp-email" type="email" name="email" value="${sup?.email || ''}" placeholder="orders@supplier.com"></div>
      <div class="field"><label for="sp-phone">Phone</label><input class="input" id="sp-phone" type="tel" name="phone" value="${sup?.phone || ''}"></div>
      <div class="field"><label for="sp-lead">Lead time (days)</label><input class="input" id="sp-lead" type="number" name="leadDays" min="0" max="30" step="1" value="${sup?.leadDays ?? 1}" required></div>
    </div>`,
    onSubmit: (data) => {
      store.dispatch('saveSupplier', { ...(sup || { id: uid('sup-') }), ...data, leadDays: Number(data.leadDays) });
      toast(sup ? 'Supplier updated.' : `${data.name} added.`);
    },
  });
}

function eventModal({ store, today }, ev = null) {
  const start = ev?.start || addDays(today, 1);
  openModal({
    title: ev ? `Edit ${ev.name}` : 'Add local event',
    submitLabel: ev ? 'Save event' : 'Add event',
    body: html`<div class="form-grid">
      <div class="field span-2"><label for="ev-name">Event</label><input class="input" id="ev-name" name="name" value="${ev?.name || ''}" required maxlength="60" placeholder="e.g. Street festival"></div>
      <div class="field"><label for="ev-start">Starts</label><input class="input" id="ev-start" type="date" name="start" value="${start}" required></div>
      <div class="field"><label for="ev-end">Ends</label><input class="input" id="ev-end" type="date" name="end" value="${ev?.end || start}" required></div>
      <div class="field span-2"><label for="ev-up">Expected footfall change (%)</label><input class="input" id="ev-up" type="number" name="uplift" min="-90" max="300" step="1" value="${ev?.uplift ?? 20}" required><span class="hint">Use a negative number for events that keep customers away (e.g. road closures).</span></div>
    </div>`,
    onSubmit: (data) => {
      store.dispatch('saveEvent', { ...(ev || { id: uid('ev-') }), ...data, uplift: Number(data.uplift) });
      toast(ev ? 'Event updated.' : `${data.name} added — re-run the forecast to include it.`, { href: '#/forecast', actionLabel: 'Forecast' });
    },
  });
}

/* ── Actions ────────────────────────────────────────────── */
export const actions = {
  'new-supplier': (_el, ctx) => supplierModal(ctx),
  'edit-supplier': (el, ctx) => supplierModal(ctx, ctx.store.get().suppliers.find((s) => s.id === el.dataset.id)),
  'delete-supplier': async (el, { store }) => {
    const sup = store.get().suppliers.find((s) => s.id === el.dataset.id);
    if (await confirmDialog({ title: `Delete ${sup.name}?`, message: 'Items from this supplier will be unassigned. Past orders are kept.', confirmLabel: 'Delete', danger: true })) {
      store.dispatch('deleteSupplier', { id: sup.id });
      toast('Supplier deleted.', { type: 'info' });
    }
  },
  'new-event': (_el, ctx) => eventModal(ctx),
  'edit-event': (el, ctx) => eventModal(ctx, ctx.store.get().events.find((e) => e.id === el.dataset.id)),
  'delete-event': async (el, { store }) => {
    const ev = store.get().events.find((e) => e.id === el.dataset.id);
    if (await confirmDialog({ title: `Delete ${ev.name}?`, confirmLabel: 'Delete', danger: true })) {
      store.dispatch('deleteEvent', { id: ev.id });
      toast('Event deleted.', { type: 'info' });
    }
  },
  'clear-key': (_el, { store }) => {
    store.dispatch('updateSettings', { apiKey: '', aiEnabled: false });
    toast('API key removed from this browser.', { type: 'info' });
  },
  'export-data': (_el, { store }) => {
    downloadFile(`brewsmart-backup-${toISODate()}.json`, store.exportJSON());
    toast('Backup downloaded.');
  },
  'reset-demo': async (_el, { store }) => {
    if (await confirmDialog({ title: 'Reset to demo data?', message: 'All your items, orders, waste and settings will be replaced with the sample coffee shop.', confirmLabel: 'Reset', danger: true })) {
      store.reset();
      toast('Demo data restored.', { type: 'info' });
    }
  },
  'clear-data': async (_el, { store, go }) => {
    if (await confirmDialog({ title: 'Start with an empty shop?', message: 'This deletes all items, suppliers, orders, waste and sales history in this browser. Export a backup first if you might need it.', confirmLabel: 'Delete everything', danger: true })) {
      store.clearAll();
      go('#/inventory');
      toast('All data cleared. Add your first item to get started.', { type: 'info' });
    }
  },
};

export const changes = {
  'import-data': async (el, { store }) => {
    const file = el.files?.[0];
    if (!file) return;
    try {
      store.importJSON(await file.text());
      toast('Backup imported.');
    } catch (e) {
      toast(e.message || 'Import failed.', { type: 'error' });
    } finally {
      el.value = '';
    }
  },
};

export const forms = {
  'settings-shop': (_f, data, { store, refreshWeather }) => {
    const prevLoc = store.get().settings.location;
    store.dispatch('updateSettings', { shopName: data.shopName.trim(), location: data.location.trim(), customers: Number(data.customers), currency: data.currency });
    toast('Shop profile saved.');
    if (prevLoc !== data.location.trim()) refreshWeather({ announce: true });
  },
  'settings-ordering': (_f, data, { store }) => {
    store.dispatch('updateSettings', {
      leadDays: Number(data.leadDays), cycleDays: Number(data.cycleDays), safetyDays: Number(data.safetyDays), wasteBaselinePct: Number(data.wasteBaselinePct),
    });
    toast('Ordering rules saved — re-run the forecast to apply them.', { href: '#/forecast', actionLabel: 'Forecast' });
  },
  'settings-ai': (_f, data, { store }) => {
    const apiKey = (data.apiKey || '').trim();
    const aiEnabled = data.aiEnabled === 'on';
    if (aiEnabled && !apiKey) { toast('Add an API key to enable Claude review.', { type: 'error' }); return; }
    store.dispatch('updateSettings', { apiKey, aiEnabled });
    toast(aiEnabled ? 'Claude review enabled for the next forecast.' : 'AI settings saved.');
  },
};
