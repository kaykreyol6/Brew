/**
 * Optional Claude review of the local forecast.
 *
 * The deterministic engine always produces the baseline. When the owner enables
 * AI in Settings and supplies their own Anthropic API key, Claude reviews the
 * baseline with the same signals and may adjust quantities and explain why.
 * Any failure (network, refusal, malformed output) falls back to the baseline.
 *
 * Security note: the key is stored only in this browser's localStorage and sent
 * only to api.anthropic.com. Suitable for a single-owner device; for a shared or
 * public deployment, route requests through your own backend instead.
 */
import { weatherInfo } from '../data/catalog.js';
import { clamp } from '../core/format.js';

const SDK_URL = 'https://esm.sh/@anthropic-ai/sdk@1.2.0';
export const AI_MODEL = 'claude-opus-5-5';

let sdkPromise;
function loadSDK() {
  sdkPromise ??= import(/* @vite-ignore */ SDK_URL).catch((e) => {
    sdkPromise = undefined;
    throw new Error(`Couldn't load the Anthropic SDK (${e.message}).`);
  });
  return sdkPromise;
}

function buildSchema(ids) {
  return {
    type: 'object',
    properties: {
      reasoning: { type: 'string', description: '2-4 short sentences on the main drivers this week.' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', enum: ids },
            qty: { type: 'integer', description: 'Recommended order quantity in the item unit.' },
            confidence: { type: 'integer', description: '0-100.' },
            note: { type: 'string', description: 'One short phrase explaining any change from the baseline, or empty.' },
          },
          required: ['id', 'qty', 'confidence', 'note'],
          additionalProperties: false,
        },
      },
    },
    required: ['reasoning', 'items'],
    additionalProperties: false,
  };
}

function buildContext(state, baseline) {
  const s = state.settings;
  return {
    shop: { name: s.shopName, location: s.location, avgDailyCustomers: Number(s.customers) },
    ordering: { leadDays: s.leadDays, cycleDays: s.cycleDays, safetyDays: s.safetyDays, windowDays: baseline.windowDays },
    weather: (state.weather?.days || []).map((d) => ({ date: d.date, conditions: weatherInfo(d.code).label, maxTempF: d.tempMax, precipChance: d.precip })),
    events: state.events.map((e) => ({ name: e.name, start: e.start, end: e.end, footfallUpliftPct: e.uplift })),
    recentDailyCupSales: state.sales.slice(-28),
    items: baseline.items.map((f) => {
      const it = state.items.find((i) => i.id === f.itemId) || {};
      return {
        id: f.itemId, name: f.name, category: f.category, unit: f.unit, onHand: f.stock, par: f.par,
        maxStorage: it.max, shelfLifeDays: it.shelfLifeDays, unitCost: f.cost,
        baselineProjectedDemand: f.demand, baselineQty: f.qty, baselineConfidence: f.confidence,
      };
    }),
    recentWaste: state.waste.slice(0, 20).map((w) => ({ date: w.date, id: w.itemId, qty: w.qty, reason: w.reason })),
  };
}

const SYSTEM = `You are the inventory planner for an independent coffee shop. You review a statistical baseline order and adjust it only where the signals justify it.
Rules:
- Order quantity covers projected demand for the window plus the safety buffer, minus stock on hand.
- Never recommend more than can be sold before the item's shelf life ends, nor more than maxStorage minus onHand.
- Use the waste history: if an item is often wasted, lean lower.
- Keep quantities whole numbers. Include every item exactly once.
- Keep notes under 8 words. Leave a note empty when you keep the baseline.`;

export async function reviewForecastWithClaude(state, baseline) {
  const apiKey = state.settings.apiKey?.trim();
  if (!apiKey) throw new Error('Add your Anthropic API key in Settings to use Claude.');
  const { default: Anthropic } = await loadSDK();
  // The key belongs to the device owner and is only sent to Anthropic.
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1, timeout: 90_000 });

  const ids = baseline.items.map((i) => i.itemId);
  const response = await client.beta.messages.create({
    model: AI_MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: buildSchema(ids) } },
    system: SYSTEM,
    messages: [{ role: 'user', content: `Review this baseline and return adjusted order quantities.\n\n${JSON.stringify(buildContext(state, baseline))}` }],
  });

  if (response.stop_reason === 'refusal') throw new Error('Claude declined this request; showing the baseline forecast.');
  if (response.stop_reason === 'max_tokens') throw new Error('Claude’s response was cut off; showing the baseline forecast.');

  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('Claude returned an unreadable response; showing the baseline forecast.'); }

  return mergeReview(state, baseline, parsed);
}

/** Merge Claude's review onto the baseline, enforcing hard limits. Exported for tests. */
export function mergeReview(state, baseline, review) {
  const byId = new Map((review?.items || []).map((r) => [r.id, r]));
  const items = baseline.items.map((f) => {
    const r = byId.get(f.itemId);
    if (!r || !Number.isFinite(r.qty)) return f;
    const it = state.items.find((i) => i.id === f.itemId) || {};
    const cap = it.max ? Math.max(0, it.max - f.stock) : Math.max(f.high * 2, f.qty * 3, 1);
    const qty = clamp(Math.round(r.qty), 0, cap);
    const confidence = clamp(Math.round(Number(r.confidence) || f.confidence), 0, 100);
    const spread = Math.ceil(Math.max(qty, f.avgDaily) * ((100 - confidence) / 100) * 1.5);
    const note = String(r.note || '').slice(0, 80);
    const drivers = note ? [{ type: 'ai', label: `✨ ${note}` }, ...f.drivers].slice(0, 3) : f.drivers;
    return { ...f, qty, confidence, low: Math.max(0, qty - spread), high: qty + spread, note, drivers, baselineQty: f.qty };
  });
  return {
    ...baseline,
    source: 'claude',
    model: AI_MODEL,
    reasoning: String(review?.reasoning || baseline.reasoning).slice(0, 1200),
    items,
  };
}
