/**
 * BrewSmart — app bootstrap.
 * Routing → view render → delegated events → store dispatch → re-render.
 */
import { html, render as renderInto } from './core/html.js';
import { createStore } from './core/store.js';
import { createRouter } from './core/router.js';
import { toast } from './core/ui.js';
import { toISODate } from './core/format.js';
import { shellSkeleton, sidebar, topbar, bottomNav } from './components/shell.js';
import { runLocalForecast } from './services/forecast.js';
import { reviewForecastWithClaude } from './services/ai.js';
import { fetchWeather, freshDemoWeather, isStale } from './services/weather.js';

import * as dashboard from './views/dashboard.js';
import * as inventory from './views/inventory.js';
import * as forecastView from './views/forecast.js';
import * as orders from './views/orders.js';
import * as waste from './views/waste.js';
import * as settings from './views/settings.js';
import * as notfound from './views/notfound.js';

const VIEWS = { dashboard, inventory, forecast: forecastView, orders, waste, settings };

const store = createStore();
const ui = { forecastRunning: false };
const appEl = document.getElementById('app');
let route = null;
let view = notfound;
let lastPath = null;

/* ── Theme ──────────────────────────────────────────────── */
function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
  else delete root.dataset.theme;
}

/* ── Context passed to every view & handler ─────────────── */
function ctx() {
  return { state: store.get(), store, route, today: toISODate(), ui, go: router.go, refreshWeather };
}

/* ── Rendering ──────────────────────────────────────────── */
function renderShell() {
  const c = ctx();
  const section = VIEWS[route.segments[0]] ? route.segments[0] : null;
  renderInto(document.getElementById('sidebar'), sidebar(c.state, { section, today: c.today }));
  renderInto(document.getElementById('topbar'), topbar(c.state, { title: view.title, today: c.today, forecastRunning: ui.forecastRunning, theme: c.state.settings.theme }));
  renderInto(document.getElementById('bottom-nav'), bottomNav(c.state, { section }));
}

function renderView({ focus = false } = {}) {
  const main = document.getElementById('main');
  const c = ctx();
  // Preserve focus & caret for in-place re-renders (e.g. typing in a stepper).
  const active = document.activeElement;
  const keep = main.contains(active) && active.name ? { name: active.name, start: active.selectionStart } : null;

  renderInto(main, view.render(c));
  document.title = `${view.title} · ${c.state.settings.shopName} · BrewSmart`;
  view.mount?.(c);

  if (focus) {
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    main.querySelector('[data-page-title]')?.focus({ preventScroll: true });
  } else if (keep) {
    const el = main.querySelector(`[name="${CSS.escape(keep.name)}"]`);
    if (el) { el.focus({ preventScroll: true }); try { el.setSelectionRange?.(keep.start, keep.start); } catch { /* number inputs */ } }
  }
}

function renderAll(opts) {
  renderShell();
  renderView(opts);
}

/* ── Router ─────────────────────────────────────────────── */
const router = createRouter((r) => {
  route = r;
  view = VIEWS[r.segments[0]] || notfound;
  closeDrawer();
  const navigated = r.path !== lastPath;
  lastPath = r.path;
  renderAll({ focus: navigated });
});

/* ── Drawer ─────────────────────────────────────────────── */
function openDrawer() {
  appEl.classList.add('drawer-open');
  document.getElementById('sidebar')?.querySelector('a, button')?.focus();
}
function closeDrawer() {
  if (!appEl.classList.contains('drawer-open')) return;
  appEl.classList.remove('drawer-open');
}

/* ── Forecast run ───────────────────────────────────────── */
async function runForecast() {
  if (ui.forecastRunning) return;
  ui.forecastRunning = true;
  if (route.segments[0] !== 'forecast') router.go('#/forecast');
  else renderAll();

  try {
    if (store.get().settings.liveWeather && isStale(store.get().weather)) await refreshWeather({ quiet: true });
    const state = store.get();
    let fc = runLocalForecast(state, { now: new Date() });
    if (state.settings.aiEnabled && state.settings.apiKey) {
      try {
        fc = await reviewForecastWithClaude(state, fc);
      } catch (e) {
        fc = { ...fc, aiError: e.message || 'Request failed.' };
      }
    }
    ui.forecastRunning = false;
    store.dispatch('setForecast', fc);
    const n = fc.items.filter((i) => i.qty > 0).length;
    toast(n ? `Forecast ready — ${n} item${n > 1 ? 's' : ''} to order.` : 'Forecast ready — you’re well stocked.');
  } catch (e) {
    ui.forecastRunning = false;
    renderAll();
    toast(`Forecast failed: ${e.message}`, { type: 'error' });
  }
}

/* ── Weather ────────────────────────────────────────────── */
async function refreshWeather({ quiet = false, announce = false } = {}) {
  const s = store.get().settings;
  if (!s.liveWeather) {
    store.dispatch('setWeather', freshDemoWeather());
    if (!quiet) toast('Using demo weather.', { type: 'info' });
    return;
  }
  try {
    const w = await fetchWeather(s.location);
    store.dispatch('setWeather', w);
    if (!quiet || announce) toast(`Live weather updated for ${w.location}.`);
  } catch (e) {
    if (isStale(store.get().weather)) store.dispatch('setWeather', freshDemoWeather());
    if (!quiet) toast(`Live weather unavailable (${e.message}). Using demo data.`, { type: 'error' });
  }
}

/* ── Global actions (available on every page) ───────────── */
const THEMES = ['system', 'light', 'dark'];
const globalActions = {
  'open-drawer': () => openDrawer(),
  'close-drawer': () => closeDrawer(),
  'run-forecast': () => runForecast(),
  'log-sales': (_el, c) => dashboard.openSalesModal(c),
  'log-waste': (_el, c) => inventory.openWasteModal(c),
  'quick-order': inventory.actions['quick-order'],
  'order-low': inventory.actions['order-low'],
  'refresh-weather': () => refreshWeather(),
  'cycle-theme': (_el, c) => {
    const next = THEMES[(THEMES.indexOf(c.state.settings.theme) + 1) % THEMES.length];
    store.dispatch('updateSettings', { theme: next });
    toast(`Theme: ${next}`, { type: 'info', duration: 1600 });
  },
  'set-theme': (el) => store.dispatch('updateSettings', { theme: el.dataset.theme }),
  'qty-step': (el) => {
    const input = el.closest('.qty')?.querySelector('input');
    if (!input) return;
    const step = Number(el.dataset.step) || 1;
    const min = input.min === '' ? -Infinity : Number(input.min);
    const next = Math.max(min, Math.round(((Number(input.value) || 0) + step) * 100) / 100);
    input.value = next;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  },
};

const globalChanges = {
  'toggle-live-weather': async (el) => {
    store.dispatch('updateSettings', { liveWeather: el.checked });
    await refreshWeather();
  },
};

function findHandler(kind, name) {
  const fromView = view[kind]?.[name];
  if (fromView) return fromView;
  if (kind === 'actions') return globalActions[name];
  if (kind === 'changes') return globalChanges[name];
  return null;
}

/* ── Delegated DOM events ───────────────────────────────── */
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const fn = findHandler('actions', el.dataset.action);
  if (!fn) return;
  if (el.tagName === 'A') e.preventDefault();
  fn(el, ctx(), e);
});

document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-change]');
  if (!el) return;
  findHandler('changes', el.dataset.change)?.(el, ctx(), e);
});

document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-input]');
  if (!el) return;
  findHandler('inputs', el.dataset.input)?.(el, ctx(), e);
});

document.addEventListener('submit', (e) => {
  const form = e.target.closest('form[data-form]');
  if (!form) return;
  e.preventDefault();
  const fn = view.forms?.[form.dataset.form];
  if (!fn) return;
  const data = Object.fromEntries(new FormData(form));
  // Unchecked checkboxes are absent from FormData; mark them explicitly.
  form.querySelectorAll('input[type=checkbox][name]').forEach((c) => { if (!c.checked) delete data[c.name]; });
  fn(form, data, ctx(), e);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && appEl.classList.contains('drawer-open')) closeDrawer();
});

// Close the drawer when the viewport grows to desktop.
window.matchMedia('(min-width: 1024px)').addEventListener?.('change', (m) => { if (m.matches) closeDrawer(); });

/* ── Store → UI ─────────────────────────────────────────── */
let pending = false;
store.subscribe((state, type) => {
  if (type === 'updateSettings') applyTheme(state.settings.theme);
  if (pending) return;
  pending = true;
  queueMicrotask(() => { pending = false; renderAll(); });
});

/* ── Boot ───────────────────────────────────────────────── */
applyTheme(store.get().settings.theme);
renderInto(appEl, html`${shellSkeleton()}`);
router.start();

if (!store.persistent) toast('Storage is blocked — changes will be lost when you close this tab.', { type: 'error', duration: 8000 });

// Keep weather fresh: live if enabled, otherwise re-anchor demo data to today.
if (isStale(store.get().weather)) refreshWeather({ quiet: true });

// Re-render at midnight-ish / when returning to the tab so "today" stays correct.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    if (isStale(store.get().weather)) refreshWeather({ quiet: true });
    renderAll();
  }
});
