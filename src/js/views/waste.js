import { html } from '../core/html.js';
import { icon } from '../core/icons.js';
import { money, moneyShort, num, pct, fmtMonth, relDay, monthKey, toISODate } from '../core/format.js';
import { toast, confirmDialog, downloadFile, toCSV } from '../core/ui.js';
import { href } from '../core/router.js';
import { pageHeader, card, kpi, barChart, emptyState } from '../components/widgets.js';
import { wasteSummary, wasteByItem } from '../services/metrics.js';
import { openWasteModal } from './inventory.js';

export const title = 'Waste & Savings';

export function render({ state, today, route }) {
  const cur = state.settings.currency;
  const s = wasteSummary(state, today);
  const monthStart = `${monthKey(today)}-01`;
  const topItems = wasteByItem(state, monthStart);
  const range = route.query.range === 'all' ? 'all' : 'month';
  const log = state.waste.filter((w) => range === 'all' || w.date >= monthStart);
  const maxItemCost = Math.max(1, ...topItems.map((t) => t.cost));

  return html`
    ${pageHeader({
      title: 'Waste & Savings',
      subtitle: 'Track spoilage, see what you’re over-ordering, and measure savings against your pre-forecast baseline.',
      actions: html`<button type="button" class="btn btn-primary" data-action="log-waste">${icon('plus')}Log waste</button>`,
    })}

    <div class="grid-kpi">
      ${kpi({ label: 'Waste this month', iconName: 'leaf', tone: s.change <= 0 ? 'success' : 'danger', value: money(s.current.cost, cur), sub: `${num(s.current.count)} entries · ${pct(s.wasteRate, { digits: 1 })} of purchases`, trend: s.previous.cost ? `${s.change <= 0 ? '↓' : '↑'} ${pct(Math.abs(s.change))} vs ${fmtMonth(s.previous.key)}` : '', trendTone: s.change <= 0 ? 'success' : 'danger' })}
      ${kpi({ label: 'Saved this month', iconName: 'dollar', tone: 'success', value: money(s.savedThisMonth, cur), sub: `vs ${state.settings.wasteBaselinePct}% baseline waste` })}
      ${kpi({ label: 'Saved (6 months)', iconName: 'trendUp', tone: 'brand', value: moneyShort(s.savedTotal, cur), sub: `≈ ${moneyShort(s.savedTotal * 2, cur)} / year at this pace` })}
      ${kpi({ label: 'Monthly purchases', iconName: 'cart', tone: 'info', value: moneyShort(s.purchases, cur), sub: 'estimated from usage', href: '#/settings?section=ordering' })}
    </div>

    <div class="grid-2">
      ${card({
        title: 'Waste cost by month', iconName: 'chart', meta: `Baseline ${moneyShort(s.baseline, cur)}/mo`,
        body: barChart(s.months.map((m) => ({ label: fmtMonth(m.key), value: m.cost, hi: m.cost > s.baseline }))
          , { format: (v) => moneyShort(v, cur), label: 'Waste cost per month' }),
        footer: html`<span class="xsmall subtle" style="margin-right:auto;align-self:center">Darker bars exceed the baseline.</span><a class="btn btn-sm btn-ghost" href="#/settings?section=ordering">Change baseline</a>`,
      })}
      ${card({
        title: 'Most wasted this month', iconName: 'alert',
        body: topItems.length ? html`<div class="stack">${topItems.slice(0, 6).map((t) => html`
          <div class="meter-row">
            <div class="meter-top">
              ${t.item ? html`<a href="#/inventory/${encodeURIComponent(t.itemId)}">${t.item.emoji} ${t.item.name}</a>` : html`<span>${t.itemId} (deleted)</span>`}
              <span class="num text-danger">${money(t.cost, cur)} <span class="subtle xsmall">· ${num(t.qty, 1)} ${t.item?.unit || ''}</span></span>
            </div>
            <div class="meter danger"><span style="width:${((t.cost / maxItemCost) * 100).toFixed(1)}%"></span></div>
          </div>`)}
          <div class="callout callout-brand">${icon('sparkles')}<div>Tip: if an item tops this list every month, lower its <strong>shelf life</strong> or <strong>use rate</strong> so the forecast orders less.</div></div>
        </div>` : emptyState({ iconName: 'leaf', title: 'No waste logged this month', text: 'Great work — or remember to log end-of-day spoilage.' }),
      })}
    </div>

    ${card({
      title: 'Waste log', iconName: 'history', flush: true,
      meta: html`<nav class="chips" aria-label="Range"><a class="chip" href="${href('/waste')}" aria-current="${range === 'month'}">This month</a><a class="chip" href="${href('/waste', { range: 'all' })}" aria-current="${range === 'all'}">All time</a></nav>`,
      body: log.length ? html`<div class="table-wrap"><table class="table table-responsive">
        <thead><tr><th scope="col">Date</th><th scope="col">Item</th><th scope="col" class="col-num">Quantity</th><th scope="col">Reason</th><th scope="col" class="col-num">Cost</th><th scope="col" class="col-actions"><span class="sr-only">Actions</span></th></tr></thead>
        <tbody>${log.slice(0, 100).map((w) => {
          const it = state.items.find((i) => i.id === w.itemId);
          return html`<tr>
            <td data-label="Date">${relDay(w.date, today)}</td>
            <td data-label="Item">${it ? html`<a href="#/inventory/${encodeURIComponent(it.id)}">${it.emoji} ${it.name}</a>` : html`<span class="subtle">Deleted item</span>`}</td>
            <td data-label="Quantity" class="col-num">${num(w.qty, 2)} ${it?.unit || ''}</td>
            <td data-label="Reason"><span class="badge">${w.reason}</span></td>
            <td data-label="Cost" class="col-num text-danger">${money(w.cost, cur)}</td>
            <td class="col-actions"><button type="button" class="btn btn-ghost btn-sm" data-action="delete-waste" data-id="${w.id}" aria-label="Delete entry">${icon('trash')}<span>Delete</span></button></td>
          </tr>`;
        })}</tbody>
      </table></div>
      ${log.length > 100 ? html`<p class="xsmall subtle" style="padding:12px 20px">Showing the latest 100 of ${log.length} entries. Export for the full log.</p>` : ''}`
        : emptyState({ iconName: 'leaf', title: 'Nothing logged yet', text: 'Record spoiled, expired or over-produced items at the end of each day.', actions: html`<button type="button" class="btn btn-primary" data-action="log-waste">${icon('plus')}Log waste</button>` }),
      footer: log.length ? html`<button type="button" class="btn btn-sm btn-ghost" data-action="export-waste">${icon('download')}Export CSV</button>` : '',
    })}`;
}

export function mount(ctx) {
  if (ctx.route.query.log === '1') {
    ctx.go(href('/waste', { range: ctx.route.query.range }), { replace: true });
    openWasteModal(ctx);
  }
}

export const actions = {
  'delete-waste': async (el, { store }) => {
    if (!(await confirmDialog({ title: 'Delete this entry?', message: 'It will be removed from the log and savings figures. Stock is not changed.', confirmLabel: 'Delete', danger: true }))) return;
    store.dispatch('deleteWaste', { id: el.dataset.id });
    toast('Waste entry deleted.', { type: 'info' });
  },
  'export-waste': (_el, { store }) => {
    const s = store.get();
    const rows = [['Date', 'Item', 'Quantity', 'Unit', 'Reason', 'Cost'],
      ...s.waste.map((w) => { const it = s.items.find((i) => i.id === w.itemId); return [w.date, it?.name || w.itemId, w.qty, it?.unit || '', w.reason, w.cost]; })];
    downloadFile(`waste-log-${toISODate()}.csv`, toCSV(rows), 'text/csv');
  },
};
