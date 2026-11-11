/** Reusable presentational pieces shared across views. */
import { html, cx } from '../core/html.js';
import { icon } from '../core/icons.js';
import { num, fmtDay, relDay } from '../core/format.js';
import { weatherInfo } from '../data/catalog.js';
import { STATUS_META, stockStatus } from '../services/metrics.js';

export function pageHeader({ title, subtitle, actions, crumbs }) {
  return html`
    <header class="page-header">
      <div class="ph-text">
        ${crumbs ? html`<nav class="breadcrumb" aria-label="Breadcrumb">${crumbs.map((c, i) => html`${i ? icon('chevronRight', { size: 14 }) : ''}${c.href ? html`<a href="${c.href}">${c.label}</a>` : html`<span aria-current="page">${c.label}</span>`}`)}</nav>` : ''}
        <h1 tabindex="-1" data-page-title>${title}</h1>
        ${subtitle ? html`<p>${subtitle}</p>` : ''}
      </div>
      ${actions ? html`<div class="page-actions">${actions}</div>` : ''}
    </header>`;
}

export function card({ title, iconName, meta, link, body, footer, flush = false, id, cls = '' }) {
  return html`
    <section class="card ${cls}" ${id && title ? html`id="${id}" aria-labelledby="${id}-h"` : id ? html`id="${id}"` : ''}>
      ${title ? html`<div class="card-header">
        <h2 ${id ? html`id="${id}-h"` : ''}>${iconName ? icon(iconName) : ''}${title}</h2>
        ${link ? html`<a class="card-link" href="${link.href}">${link.label}${icon('chevronRight')}</a>` : meta ? html`<span class="meta">${meta}</span>` : ''}
      </div>` : ''}
      <div class="card-body ${flush ? 'flush' : ''}">${body}</div>
      ${footer ? html`<div class="card-footer">${footer}</div>` : ''}
    </section>`;
}

export function kpi({ label, value, sub, trend, trendTone, tone = 'brand', iconName, href }) {
  const inner = html`
    <span class="kpi-label"><span class="kpi-icon">${icon(iconName, { size: 16 })}</span>${label}</span>
    <span class="kpi-value">${value}</span>
    ${sub ? html`<span class="kpi-sub">${sub}</span>` : ''}
    ${trend ? html`<span class="kpi-trend ${trendTone ? `text-${trendTone}` : ''}">${trend}</span>` : ''}
    ${href ? icon('arrowUpRight', { cls: 'kpi-go' }) : ''}`;
  return href ? html`<a class="kpi tone-${tone}" href="${href}">${inner}</a>` : html`<div class="kpi tone-${tone}">${inner}</div>`;
}

export function emptyState({ iconName = 'info', title, text, actions }) {
  return html`
    <div class="empty">
      <div class="empty-icon">${icon(iconName)}</div>
      <h2>${title}</h2>
      ${text ? html`<p>${text}</p>` : ''}
      ${actions ? html`<div class="row-wrap">${actions}</div>` : ''}
    </div>`;
}

export function statusBadge(item) {
  const st = stockStatus(item);
  const m = STATUS_META[st];
  return html`<span class="badge ${m.badge}"><span class="dot ${m.dot}"></span>${m.label}</span>`;
}

export function stockMeter(item) {
  const st = stockStatus(item);
  const ceiling = item.max || item.par * 2 || 1;
  const pct = Math.max(2, Math.min(100, (item.stock / ceiling) * 100));
  return html`<div class="meter ${STATUS_META[st].meter}" role="meter" aria-valuemin="0" aria-valuemax="${ceiling}" aria-valuenow="${item.stock}" aria-label="${item.name} stock"><span style="width:${pct.toFixed(1)}%"></span></div>`;
}

export function itemCell(item, { link = true, meta } = {}) {
  return html`<div class="item-cell">
    <span class="item-avatar" aria-hidden="true">${item.emoji || '📦'}</span>
    <div style="min-width:0">
      ${link ? html`<a class="item-name" href="#/inventory/${encodeURIComponent(item.id)}">${item.name}</a>` : html`<span class="item-name">${item.name}</span>`}
      <div class="item-meta">${meta ?? html`${num(item.stock, 1)} ${item.unit} on hand · par ${num(item.par)}`}</div>
    </div>
  </div>`;
}

export function qtyStepper({ name, value, min = 0, step = 1, label, action, id }) {
  return html`<div class="qty" role="group" aria-label="${label}">
    <button type="button" data-action="qty-step" data-step="${-step}" aria-label="Decrease ${label}">${icon('minus')}</button>
    <input type="number" inputmode="decimal" name="${name}" value="${value}" min="${min}" step="any" aria-label="${label}" ${id ? html`id="${id}"` : ''} ${action ? html`data-change="${action}"` : ''}>
    <button type="button" data-action="qty-step" data-step="${step}" aria-label="Increase ${label}">${icon('plus')}</button>
  </div>`;
}

export function barChart(data, { format = (v) => num(v), label = 'Chart' } = {}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return html`<div class="bars" role="img" aria-label="${label}: ${data.map((d) => `${d.label} ${format(d.value)}`).join(', ')}">
    ${data.map((d) => html`<div class="bar">
      <div class="${cx('bar-col', { 'is-hi': d.hi })}" style="height:${Math.max(2, (d.value / max) * 100).toFixed(1)}%" title="${d.title || `${d.label}: ${format(d.value)}`}">
        <span class="bar-val">${format(d.value)}</span>
      </div>
      <span class="bar-lbl">${d.label}</span>
    </div>`)}
  </div>`;
}

export function weatherStrip(weather, today, limit = 7) {
  const days = (weather?.days || []).filter((d) => d.date >= today).slice(0, limit);
  if (!days.length) return html`<p class="muted small">No weather data. Refresh it in Settings.</p>`;
  return html`<div class="wx-strip">${days.map((d) => {
    const w = weatherInfo(d.code);
    return html`<div class="${cx('wx-day', { 'is-today': d.date === today })}">
      <span class="wx-name">${d.date === today ? 'Today' : fmtDay(d.date)}</span>
      <span class="wx-icon" aria-hidden="true">${w.icon}</span>
      <span class="wx-temp">${d.tempMax}°</span>
      <span class="wx-desc">${w.label}</span>
    </div>`;
  })}</div>`;
}

export function eventList(events, today, { limit = 5, editable = false } = {}) {
  const upcoming = events.filter((e) => e.end >= today).slice(0, limit);
  if (!upcoming.length) return html`<p class="muted small">No upcoming events. <a href="#/settings?section=events">Add one</a> to factor it into forecasts.</p>`;
  return html`<div class="list">${upcoming.map((e) => html`
    <div class="list-item">
      <span class="kpi-icon" style="background:var(--success-soft);color:var(--success)">${icon('calendar', { size: 16 })}</span>
      <div class="li-main">
        <div class="li-title">${e.name}</div>
        <div class="li-sub">${relDay(e.start, today)}${e.end !== e.start ? html` – ${relDay(e.end, today)}` : ''}</div>
      </div>
      <span class="badge ${e.uplift >= 0 ? 'badge-success' : 'badge-warning'}">${e.uplift >= 0 ? '+' : ''}${e.uplift}%</span>
      ${editable ? html`
        <button type="button" class="btn btn-ghost btn-icon btn-sm" data-action="edit-event" data-id="${e.id}" aria-label="Edit ${e.name}">${icon('edit')}</button>
        <button type="button" class="btn btn-ghost btn-icon btn-sm" data-action="delete-event" data-id="${e.id}" aria-label="Delete ${e.name}">${icon('trash')}</button>` : ''}
    </div>`)}</div>`;
}

export function urgencyBadge(urgency) {
  if (urgency === 'now') return html`<span class="badge badge-danger">${icon('alert')}Order today</span>`;
  if (urgency === 'soon') return html`<span class="badge badge-warning">${icon('calendar')}Order soon</span>`;
  return html`<span class="badge badge-success">${icon('check')}Stocked</span>`;
}

export function orderStatusBadge(order, today) {
  if (order.status === 'received') return html`<span class="badge badge-success">${icon('check')}Received</span>`;
  if (order.status === 'cancelled') return html`<span class="badge">Cancelled</span>`;
  if (order.expectedDate < today) return html`<span class="badge badge-danger">${icon('alert')}Overdue</span>`;
  if (order.expectedDate === today) return html`<span class="badge badge-warning">${icon('truck')}Due today</span>`;
  return html`<span class="badge badge-info">${icon('truck')}On the way</span>`;
}
