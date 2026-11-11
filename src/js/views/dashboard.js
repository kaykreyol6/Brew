import { html, cx } from '../core/html.js';
import { icon } from '../core/icons.js';
import { money, moneyShort, num, pct, fmtDay, toISODate } from '../core/format.js';
import { openModal, toast } from '../core/ui.js';
import { pageHeader, card, kpi, barChart, weatherStrip, eventList, stockMeter } from '../components/widgets.js';
import { lowStockItems, openOrders, cartTotal, salesSummary, wasteSummary, workflowStatus, stockStatus } from '../services/metrics.js';

export const title = 'Dashboard';

export function render({ state, today }) {
  const low = lowStockItems(state);
  const open = openOrders(state);
  const sales = salesSummary(state, today);
  const waste = wasteSummary(state, today);
  const flow = workflowStatus(state, today);
  const cur = state.settings.currency;
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const sorted = [...state.items].sort((a, b) => a.stock / (a.par || 1) - b.stock / (b.par || 1));

  return html`
    ${pageHeader({
      title: `${greet}, ${state.settings.shopName}`,
      subtitle: `Here’s what needs your attention on ${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}.`,
      actions: html`
        <button type="button" class="btn" data-action="log-sales">${icon('chart')}Log sales</button>
        <a class="btn btn-secondary" href="#/inventory/count">${icon('clipboard')}Count stock</a>`,
    })}

    <section class="next-step fade-in" aria-label="Recommended next step">
      <span class="next-step-icon">${icon(flow.next.icon)}</span>
      <div class="next-step-text">
        <div class="eyebrow">${flow.next.eyebrow}</div>
        <h2>${flow.next.title}</h2>
        <p>${flow.next.text}</p>
      </div>
      ${flow.next.action
        ? html`<button type="button" class="btn btn-primary btn-lg" data-action="${flow.next.action}">${flow.next.cta}${icon('arrowRight')}</button>`
        : html`<a class="btn btn-primary btn-lg" href="${flow.next.href}">${flow.next.cta}${icon('arrowRight')}</a>`}
    </section>

    <nav aria-label="Daily workflow">
      <ol class="workflow" role="list">
        ${flow.steps.map((s, i) => html`<li style="display:contents">
          <a class="${cx('wf-step', { 'is-done': s.done && !s.current, 'is-current': s.current })}" href="${s.href}" ${s.current ? html`aria-current="step"` : ''}>
            <span class="wf-num">${s.done && !s.current ? icon('check') : i + 1}</span>
            <span class="wf-title">${s.title}</span>
            <span class="wf-desc">${s.desc}</span>
          </a></li>`)}
      </ol>
    </nav>

    <div class="grid-kpi">
      ${kpi({
        label: 'Low stock', iconName: 'alert', tone: low.length ? 'danger' : 'success',
        value: num(low.length), sub: low.length ? `${low.map((i) => i.name).slice(0, 2).join(', ')}${low.length > 2 ? '…' : ''}` : 'Everything above par',
        trend: low.length ? 'Action needed' : 'All good', trendTone: low.length ? 'danger' : 'success',
        href: '#/inventory?filter=low',
      })}
      ${kpi({
        label: 'Orders', iconName: 'truck', tone: 'info',
        value: num(open.length), sub: `${open.length === 1 ? 'open order' : 'open orders'} · ${state.cart.length} in cart`,
        trend: state.cart.length ? `${money(cartTotal(state), cur)} ready to send` : open.length ? 'Awaiting delivery' : 'Nothing pending',
        href: state.cart.length ? '#/orders' : '#/orders?view=open',
      })}
      ${kpi({
        label: 'Waste this month', iconName: 'leaf', tone: 'success',
        value: moneyShort(waste.current.cost, cur), sub: `≈ ${money(waste.savedThisMonth, cur)} saved vs. ${state.settings.wasteBaselinePct}% baseline`,
        trend: waste.previous.cost ? `${waste.change <= 0 ? '↓' : '↑'} ${pct(Math.abs(waste.change))} vs last month` : '',
        trendTone: waste.change <= 0 ? 'success' : 'danger',
        href: '#/waste',
      })}
      ${kpi({
        label: 'Cups sold (7d)', iconName: 'chart', tone: 'brand',
        value: num(sales.total), sub: sales.today ? `${num(sales.today.cups)} logged today` : 'Today not logged yet',
        trend: sales.prev ? `${sales.change >= 0 ? '↑' : '↓'} ${pct(Math.abs(sales.change))} vs prior week` : '',
        trendTone: sales.change >= 0 ? 'success' : 'danger',
        href: '#/dashboard?panel=sales',
      })}
    </div>

    <div class="grid-2">
      ${card({
        id: 'sales', title: 'Sales — last 7 days', iconName: 'chart', meta: 'Cups sold',
        body: sales.days.length
          ? barChart(sales.days.map((d) => ({ label: fmtDay(d.date), value: d.cups, hi: d.cups >= Math.max(...sales.days.map((x) => x.cups)) * 0.85 })), { label: 'Cups sold per day' })
          : html`<p class="muted small">No sales logged in the last week.</p>`,
        footer: html`<button type="button" class="btn btn-sm" data-action="log-sales">${icon('plus')}Log today’s sales</button>`,
      })}
      ${card({
        title: 'Weather outlook', iconName: 'cloud',
        link: { href: '#/forecast#signals', label: 'How it affects demand' },
        body: html`${weatherStrip(state.weather, today, 7)}
          <p class="xsmall subtle" style="margin-top:12px">${state.weather?.source === 'live' ? `Live forecast for ${state.weather.location}` : 'Demo weather — enable live weather in Settings'}</p>`,
      })}
    </div>

    <div class="grid-2">
      ${card({
        title: 'Stock levels', iconName: 'box',
        link: { href: '#/inventory', label: 'Manage inventory' },
        body: html`<div class="stack">${sorted.slice(0, 8).map((i) => html`
          <div class="meter-row">
            <div class="meter-top">
              <a href="#/inventory/${encodeURIComponent(i.id)}">${i.emoji} ${i.name}</a>
              <span class="num ${stockStatus(i) === 'low' ? 'text-danger' : stockStatus(i) === 'watch' ? 'text-warning' : 'muted'}">${num(i.stock, 1)} / ${num(i.max || i.par * 2)} ${i.unit}</span>
            </div>
            ${stockMeter(i)}
          </div>`)}</div>`,
      })}
      ${card({
        title: 'Upcoming local events', iconName: 'calendar',
        link: { href: '#/settings?section=events', label: 'Manage events' },
        body: eventList(state.events, today, { limit: 5 }),
      })}
    </div>`;
}

export function mount({ route }) {
  if (route.query.panel === 'sales') document.getElementById('sales')?.scrollIntoView({ block: 'start' });
}

export function openSalesModal({ store, today = toISODate() }) {
  const existing = store.get().sales.find((s) => s.date === today);
  openModal({
    title: 'Log daily sales',
    submitLabel: 'Save sales',
    body: html`<div class="form">
      <p class="muted small">Daily cup counts teach the forecast your weekly rhythm and growth trend.</p>
      <div class="form-grid">
        <div class="field"><label for="s-date">Date</label><input class="input" id="s-date" type="date" name="date" value="${today}" max="${today}" required></div>
        <div class="field"><label for="s-cups">Cups sold</label><input class="input" id="s-cups" type="number" name="cups" min="0" step="1" inputmode="numeric" value="${existing?.cups ?? ''}" placeholder="e.g. 210" required></div>
      </div>
    </div>`,
    onSubmit: ({ date, cups }) => {
      store.dispatch('logSales', { date, cups: Number(cups) });
      toast(`Saved ${num(Number(cups))} cups for ${fmtDay(date)}.`);
    },
  });
}

export const actions = {
  'log-sales': (_el, ctx) => openSalesModal(ctx),
};
