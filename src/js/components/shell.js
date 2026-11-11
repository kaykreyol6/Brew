/** App chrome: sidebar (drawer on mobile), sticky topbar, bottom tab bar. */
import { html, cx } from '../core/html.js';
import { icon, BRAND_MARK } from '../core/icons.js';
import { num, fmtDay, addDays } from '../core/format.js';
import { weatherInfo } from '../data/catalog.js';
import { lowStockItems, openOrders, salesSummary } from '../services/metrics.js';
import { eventsOn } from '../services/forecast.js';

export const NAV = [
  { key: 'dashboard', label: 'Dashboard', short: 'Home', icon: 'home', href: '#/dashboard' },
  { key: 'inventory', label: 'Inventory', short: 'Stock', icon: 'box', href: '#/inventory' },
  { key: 'forecast', label: 'AI Forecast', short: 'Forecast', icon: 'sparkles', href: '#/forecast' },
  { key: 'orders', label: 'Orders', short: 'Orders', icon: 'cart', href: '#/orders' },
  { key: 'waste', label: 'Waste & Savings', short: 'Waste', icon: 'leaf', href: '#/waste' },
  { key: 'settings', label: 'Settings', short: 'Settings', icon: 'settings', href: '#/settings' },
];

const BOTTOM = ['dashboard', 'inventory', 'forecast', 'orders'];

export function shellSkeleton() {
  return html`
    <aside class="sidebar" id="sidebar" aria-label="Main navigation"></aside>
    <div class="backdrop" data-action="close-drawer" aria-hidden="true"></div>
    <div class="main-col">
      <header class="topbar" id="topbar"></header>
      <main class="main" id="main" tabindex="-1"></main>
    </div>
    <nav class="bottom-nav" id="bottom-nav" aria-label="Primary"></nav>`;
}

function badges(state) {
  const low = lowStockItems(state).length;
  const cart = state.cart.length;
  const open = openOrders(state).length;
  return { inventory: low, orders: cart + open };
}

export function sidebar(state, { section, today }) {
  const b = badges(state);
  const low = lowStockItems(state);
  const wxToday = state.weather?.days?.find((d) => d.date === today);
  const wx = wxToday ? weatherInfo(wxToday.code) : null;
  const evNow = state.events.filter((e) => e.end >= today && e.start <= addDays(today, 7));
  const sales = salesSummary(state, today);
  return html`
    <a class="brand" href="#/dashboard" aria-label="BrewSmart home">
      ${BRAND_MARK}
      <span><span class="brand-name">BrewSmart</span><span class="brand-tag">AI inventory forecasting</span></span>
    </a>
    <button type="button" class="btn btn-ghost btn-icon sidebar-close" data-action="close-drawer" aria-label="Close menu" style="position:absolute;top:calc(16px + env(safe-area-inset-top));right:12px">${icon('x')}</button>

    <nav aria-label="Sections">
      <ul class="nav-list" role="list">
        ${NAV.map((n) => html`<li><a class="nav-link" href="${n.href}" ${section === n.key ? html`aria-current="page"` : ''}>
          ${icon(n.icon)}<span>${n.label}</span>
          ${b[n.key] ? html`<span class="badge ${n.key === 'inventory' ? 'badge-danger' : 'badge-brand'}" aria-label="${b[n.key]} need attention">${b[n.key]}</span>` : ''}
        </a></li>`)}
      </ul>
    </nav>

    ${low.length ? html`<div>
      <div class="nav-section-title">Needs attention</div>
      <div class="quick-list">
        ${low.slice(0, 5).map((i) => html`<a class="quick-item" href="#/inventory/${encodeURIComponent(i.id)}">
          <span aria-hidden="true">${i.emoji}</span><span class="q-name">${i.name}</span>
          <span class="q-meta">${num(i.stock, 1)}/${num(i.par)}</span><span class="dot dot-danger"></span>
        </a>`)}
        ${low.length > 5 ? html`<a class="quick-item" href="#/inventory?filter=low"><span class="q-name subtle">View all ${low.length}…</span></a>` : ''}
      </div>
    </div>` : ''}

    <div>
      <div class="nav-section-title">Today's signals</div>
      <dl class="signal-list">
        <div class="signal-row"><dt>Day</dt><dd>${fmtDay(today)}</dd></div>
        <div class="signal-row"><dt>Weather</dt><dd>${wx ? `${wx.icon} ${wxToday.tempMax}°F` : '—'}</dd></div>
        <div class="signal-row"><dt>Events (7d)</dt><dd><a href="#/settings?section=events">${evNow.length}</a></dd></div>
        <div class="signal-row"><dt>Sales trend</dt><dd class="${sales.change >= 0 ? 'text-success' : 'text-danger'}">${sales.change >= 0 ? '↑' : '↓'} ${Math.abs(Math.round(sales.change * 100))}%</dd></div>
        <div class="signal-row"><dt>Today's events</dt><dd>${eventsOn(today, state.events).map((e) => e.name).join(', ') || 'None'}</dd></div>
      </dl>
    </div>

    <a class="sidebar-footer" href="#/settings" style="text-decoration:none">
      <strong>${state.settings.shopName}</strong>
      ${state.settings.location} · ~${num(state.settings.customers)} customers/day
    </a>`;
}

export function topbar(state, { title, today, forecastRunning, theme }) {
  const wxToday = state.weather?.days?.find((d) => d.date === today);
  const wx = wxToday ? weatherInfo(wxToday.code) : null;
  const themeIcon = theme === 'dark' ? 'moon' : theme === 'light' ? 'sun' : 'monitor';
  return html`
    <button type="button" class="btn btn-ghost btn-icon topbar-menu" data-action="open-drawer" aria-label="Open menu" aria-controls="sidebar">${icon('menu')}</button>
    <a class="brand topbar-brand" href="#/dashboard" aria-label="BrewSmart home">${BRAND_MARK}<span class="brand-name">BrewSmart</span></a>
    <span class="topbar-crumb">${state.settings.shopName} · ${title}</span>
    <div class="topbar-actions">
      ${wx ? html`<a class="chip" href="#/forecast#signals" title="Weather drives the forecast">${wx.icon} ${wxToday.tempMax}°<span class="sr-only"> ${wx.label} today</span></a>` : ''}
      <button type="button" class="btn btn-ghost btn-icon" data-action="cycle-theme" aria-label="Theme: ${theme}. Change theme">${icon(themeIcon)}</button>
      <button type="button" class="${cx('btn btn-primary', { 'is-loading': forecastRunning })}" data-action="run-forecast" aria-label="${forecastRunning ? 'Analysing forecast' : 'Run forecast'}" ${forecastRunning ? html`aria-busy="true"` : ''}>
        ${icon(forecastRunning ? 'refresh' : 'zap')}<span class="btn-label">${forecastRunning ? 'Analysing…' : 'Run forecast'}</span>
      </button>
    </div>`;
}

export function bottomNav(state, { section }) {
  const b = badges(state);
  const moreActive = !BOTTOM.includes(section);
  return html`
    ${NAV.filter((n) => BOTTOM.includes(n.key)).map((n) => html`
      <a class="bn-item" href="${n.href}" ${section === n.key ? html`aria-current="page"` : ''}>
        ${icon(n.icon)}<span>${n.short}</span>
        ${b[n.key] ? html`<span class="bn-badge" aria-label="${b[n.key]} need attention">${b[n.key]}</span>` : ''}
      </a>`)}
    <button type="button" class="bn-item" data-action="open-drawer" aria-controls="sidebar" ${moreActive ? html`aria-current="page"` : ''}>
      ${icon('more')}<span>More</span>
    </button>`;
}
