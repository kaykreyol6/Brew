import { html } from '../core/html.js';
import { icon } from '../core/icons.js';
import { money, num, fmtDateTime, relDay } from '../core/format.js';
import { toast } from '../core/ui.js';
import { WEEKDAYS } from '../data/catalog.js';
import { pageHeader, card, kpi, itemCell, emptyState, urgencyBadge, weatherStrip, eventList, barChart } from '../components/widgets.js';
import { weekdayFactors, salesTrend } from '../services/forecast.js';

export const title = 'AI Forecast';

function signalsCard(state, today) {
  const wf = weekdayFactors(state.sales);
  const trend = salesTrend(state.sales, today);
  return card({
    id: 'signals', title: 'Signals used', iconName: 'cloud',
    meta: state.weather?.source === 'live' ? `Live weather · ${state.weather.location}` : 'Demo weather',
    body: html`<div class="stack">
      <div><h3 class="small muted" style="margin-bottom:8px">Weather</h3>${weatherStrip(state.weather, today, 7)}</div>
      <div class="grid-2">
        <div><h3 class="small muted" style="margin-bottom:8px">Local events</h3>${eventList(state.events, today, { limit: 4 })}</div>
        <div>
          <h3 class="small muted" style="margin-bottom:0">Weekly rhythm <span class="badge ${trend >= 1 ? 'badge-success' : 'badge-warning'}" style="margin-left:6px">Trend ${trend >= 1 ? '+' : ''}${Math.round((trend - 1) * 100)}%</span></h3>
          ${barChart([1, 2, 3, 4, 5, 6, 0].map((d) => ({ label: WEEKDAYS[d], value: Math.round(wf[d] * 100), hi: wf[d] >= 1.2 })), { format: (v) => `${v}%`, label: 'Demand by weekday, percent of average' })}
        </div>
      </div>
    </div>`,
    footer: html`<a class="btn btn-sm btn-ghost" href="#/settings?section=events">${icon('calendar')}Edit events</a><a class="btn btn-sm btn-ghost" href="#/settings?section=weather">${icon('cloud')}Weather settings</a><button type="button" class="btn btn-sm btn-ghost" data-action="log-sales">${icon('chart')}Log sales</button>`,
  });
}

export function render({ state, today, ui }) {
  const fc = state.forecast;
  const cur = state.settings.currency;
  const runBtn = html`<button type="button" class="btn ${fc ? '' : 'btn-primary'}" data-action="run-forecast" ${ui.forecastRunning ? 'disabled' : ''}>${icon(fc ? 'refresh' : 'zap')}${fc ? 'Re-run' : 'Run forecast'}</button>`;

  if (ui.forecastRunning) {
    return html`${pageHeader({ title: 'AI Forecast', subtitle: 'Crunching the numbers…' })}
      ${card({ body: html`<div class="empty" aria-live="polite">
        <div class="empty-icon">${icon('sparkles')}</div>
        <h2>Analysing your shop</h2>
        <p>Combining ${num(state.sales.length)} days of sales, the ${state.weather?.days?.length || 0}-day weather outlook, ${state.events.length} local events and your current stock${state.settings.aiEnabled && state.settings.apiKey ? ', then asking Claude to review it' : ''}.</p>
        <div class="loader" style="margin-top:12px"><span></span><span></span><span></span></div>
      </div>` })}
      ${signalsCard(state, today)}`;
  }

  if (!fc) {
    return html`${pageHeader({ title: 'AI Forecast', subtitle: 'Exact order quantities for every perishable, based on demand signals.' })}
      ${card({ body: emptyState({
        iconName: 'sparkles',
        title: 'Ready when you are',
        text: 'Run a forecast to analyse sales history, weather, local events and day-of-week patterns — and get exact order quantities for every ingredient.',
        actions: html`<button type="button" class="btn btn-primary btn-lg" data-action="run-forecast">${icon('zap')}Run forecast</button><a class="btn btn-lg" href="#/inventory/count">Count stock first</a>`,
      }) })}
      ${signalsCard(state, today)}`;
  }

  const toOrder = fc.items.filter((i) => i.qty > 0);
  const urgent = fc.items.filter((i) => i.urgency === 'now');
  const total = toOrder.reduce((s, i) => s + i.qty * i.cost, 0);
  const avgConf = fc.items.length ? Math.round(fc.items.reduce((s, i) => s + i.confidence, 0) / fc.items.length) : 0;
  const stale = fc.today !== today;
  const inCart = new Set(state.cart.map((c) => c.itemId));
  const aiOn = state.settings.aiEnabled && state.settings.apiKey;

  return html`
    ${pageHeader({
      title: 'AI Forecast',
      subtitle: html`Next ${fc.windowDays} days · generated ${fmtDateTime(fc.generatedAt)} · ${fc.source === 'claude' ? html`<span class="badge badge-brand">${icon('sparkles')}Reviewed by Claude</span>` : html`<span class="badge">Local engine</span>`}`,
      actions: html`${runBtn}<button type="submit" form="fc-form" class="btn btn-primary" ${toOrder.length ? '' : 'disabled'}>${icon('cart')}Add selected to order</button>`,
    })}

    ${stale ? html`<div class="callout callout-warning" role="status">${icon('alert')}<div><strong>This forecast is from ${relDay(fc.today, today).toLowerCase()}.</strong> Stock and weather may have changed — re-run it before ordering.</div><button type="button" class="btn btn-sm" data-action="run-forecast">Re-run now</button></div>` : ''}
    ${fc.aiError ? html`<div class="callout callout-warning" role="status">${icon('info')}<div><strong>Claude review unavailable.</strong> ${fc.aiError}</div><a class="btn btn-sm" href="#/settings?section=ai">AI settings</a></div>` : ''}
    ${!aiOn && !fc.aiError ? html`<div class="callout callout-info">${icon('sparkles')}<div>Want a second opinion? Turn on <strong>Claude review</strong> to have Claude check these quantities against your waste history and explain changes.</div><a class="btn btn-sm" href="#/settings?section=ai">Set up</a></div>` : ''}

    <div class="grid-kpi">
      ${kpi({ label: 'Items to order', iconName: 'cart', tone: 'brand', value: num(toOrder.length), sub: `of ${fc.items.length} tracked` })}
      ${kpi({ label: 'Order today', iconName: 'alert', tone: urgent.length ? 'danger' : 'success', value: num(urgent.length), sub: urgent.length ? urgent.map((u) => u.name).slice(0, 2).join(', ') : 'Nothing urgent' })}
      ${kpi({ label: 'Estimated cost', iconName: 'dollar', tone: 'info', value: money(total, cur), sub: 'at current unit costs' })}
      ${kpi({ label: 'Avg confidence', iconName: 'checkCircle', tone: avgConf >= 85 ? 'success' : 'warning', value: `${avgConf}%`, sub: 'range shown per item' })}
    </div>

    <form id="fc-form" data-form="forecast-to-cart">
      ${card({
        title: 'Recommended order', iconName: 'sparkles', flush: true,
        meta: 'Untick or edit before adding',
        body: html`<div class="table-wrap"><table class="table table-responsive">
          <thead><tr>
            <th scope="col" class="col-check"><input type="checkbox" class="checkbox" data-action="toggle-all" aria-label="Select all" ${toOrder.length ? 'checked' : ''}></th>
            <th scope="col">Item</th><th scope="col">Order qty</th><th scope="col">Confidence</th><th scope="col">Key drivers</th><th scope="col">Action</th>
          </tr></thead>
          <tbody>
            ${fc.items.map((i) => html`<tr class="has-check">
              <td class="col-check"><input type="checkbox" class="checkbox" name="pick:${i.itemId}" ${i.qty > 0 ? 'checked' : ''} aria-label="Include ${i.name}"></td>
              <td class="cell-full">${itemCell({ id: i.itemId, name: i.name, emoji: i.emoji }, { meta: html`Now ${num(i.stock, 1)} ${i.unit}${i.daysCover !== null ? ` · ${num(i.daysCover, 1)} days cover` : ''}${inCart.has(i.itemId) ? html` · <span class="text-success">in cart</span>` : ''}` })}</td>
              <td data-label="Order qty">
                <div class="row" style="gap:6px"><input class="input input-sm num" type="number" name="qty:${i.itemId}" value="${i.qty}" min="0" step="any" style="width:80px" aria-label="${i.name} order quantity"><span class="xsmall subtle">${i.unit}</span></div>
                <div class="xsmall subtle" style="margin-top:4px">Range ${num(i.low)}–${num(i.high)}${i.baselineQty !== undefined && i.baselineQty !== i.qty ? ` · baseline ${num(i.baselineQty)}` : ''}</div>
              </td>
              <td data-label="Confidence" style="min-width:120px">
                <div class="meter-top xsmall"><span class="subtle">${i.confidence >= 88 ? 'High' : i.confidence >= 72 ? 'Medium' : 'Low'}</span><span class="strong">${i.confidence}%</span></div>
                <div class="meter ${i.confidence >= 88 ? 'success' : i.confidence >= 72 ? '' : 'warning'}"><span style="width:${i.confidence}%"></span></div>
              </td>
              <td data-label="Key drivers" class="cell-full"><div class="tags">${i.drivers.map((d) => html`<span class="tag tag-${d.type}">${d.label}</span>`)}</div></td>
              <td data-label="Action">${urgencyBadge(i.urgency)}</td>
            </tr>`)}
          </tbody>
        </table></div>`,
        footer: html`<span class="small muted" style="margin-right:auto;align-self:center">Est. ${money(total, cur)} for ${toOrder.length} items</span>
          <button type="submit" class="btn btn-primary" ${toOrder.length ? '' : 'disabled'}>${icon('cart')}Add selected to order</button>`,
      })}
    </form>

    <div class="grid-main-aside">
      ${card({ title: fc.source === 'claude' ? 'Claude’s reasoning' : 'Why these numbers', iconName: 'info', body: html`<p class="reasoning">${fc.reasoning}</p>` })}
      ${card({
        title: 'How the forecast works', iconName: 'chart',
        body: html`<ul class="small muted" style="padding-left:18px;display:grid;gap:6px">
          <li>Demand = daily usage × weekday pattern × sales trend × weather × events.</li>
          <li>Covers ${state.settings.leadDays}d lead time + ${state.settings.cycleDays}d until the next delivery + ${state.settings.safetyDays}d safety buffer.</li>
          <li>Capped by shelf life and storage space so you don’t order what will spoil.</li>
        </ul>`,
        footer: html`<a class="btn btn-sm btn-ghost" href="#/settings?section=ordering">${icon('settings')}Tune ordering rules</a>`,
      })}
    </div>

    ${signalsCard(state, today)}`;
}

export const actions = {
  'toggle-all': (el) => {
    el.closest('form')?.querySelectorAll('input[name^="pick:"]').forEach((c) => { c.checked = el.checked; });
  },
};

export const forms = {
  'forecast-to-cart': (form, data, { store, go }) => {
    const lines = [];
    for (const [k, v] of Object.entries(data)) {
      if (!k.startsWith('pick:')) continue;
      const id = k.slice(5);
      const qty = Number(data[`qty:${id}`]);
      if (v && qty > 0) lines.push({ itemId: id, qty });
    }
    if (!lines.length) { toast('Select at least one item with a quantity above zero.', { type: 'info' }); return; }
    // Forecast quantities replace any existing cart quantity for the same item.
    const state = store.get();
    const keep = state.cart.filter((c) => !lines.some((l) => l.itemId === c.itemId));
    store.dispatch('addToCart', { lines: [...keep, ...lines], replace: true });
    go('#/orders');
    toast(`${lines.length} item${lines.length > 1 ? 's' : ''} added to your order. Review and place it below.`);
  },
};

