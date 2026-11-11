# BrewSmart — AI inventory forecasting for coffee shops

BrewSmart helps an independent café order the right amount of milk, pastries and other perishables. It forecasts demand from sales history, weather, local events and day‑of‑week patterns, then takes you through the daily ordering routine:

**Count stock → Run forecast → Build order → Place order → Receive delivery → Log waste**

It's a static web app with no build step and no backend. Data is stored in the browser.

## Run it

```bash
npm start            # http://localhost:5173
```

Any static file server works too, and so does GitHub Pages. Routes are hash-based (`#/orders`), so no server rewrites are needed.

```bash
npm test             # unit tests (node:test, no dependencies)
npm run check        # syntax-check every module + tests (what CI runs)
```

## Features

| Page | What you can do |
| --- | --- |
| **Dashboard** `#/dashboard` | Next-step banner and a 6-step workflow tracker. Clickable KPIs: low stock, orders, waste, sales. Also a 7-day sales chart, weather outlook, stock levels and local events. |
| **Inventory** `#/inventory` | Search, filter by status or category, quick +/- stock, add/edit/delete items, export to CSV, and order every low item in one tap. |
| ↳ Stock count `#/inventory/count` | Enter counts for every item at once. |
| ↳ Item detail `#/inventory/:id` | Days of cover, forecast, stock value, set stock, order history, waste history. |
| **AI Forecast** `#/forecast` | Per-item order quantity with a confidence range and explained drivers (weather, events, busy days, trend). Edit or untick lines, then add the selection to the order. |
| **Orders** `#/orders` | A draft order grouped by supplier, with quantity steppers and undo on remove. Placing it creates one purchase order per supplier. Open and history tabs. |
| ↳ Order detail `#/orders/:id` | Receive the delivery (adjusting any short lines), which adds it to stock. You can also cancel, reorder, email the supplier (pre-filled), download CSV, or print. |
| **Waste & Savings** `#/waste` | Log waste (deducted from stock), monthly trend, most-wasted items, savings against your pre-forecast baseline, CSV export. |
| **Settings** `#/settings` | Shop profile, ordering rules (lead time, cycle, safety buffer), suppliers, local events, live weather, Claude review, theme, and JSON backup, import and reset. |

### How the forecast works

The forecast runs offline in `src/js/services/forecast.js` and is deterministic. For each item:

```
demand = Σ over (lead + cycle) days of
         dailyUse × customers/100 × weekdayFactor × salesTrend × (1 + weather) × (1 + events)
order  = demand + safety buffer − stock on hand
         capped by shelf life (don't order what will spoil) and storage max
```

- **Weekday factors and trend** come from your logged daily sales.
- **Weather and event effects** depend on the item's category (see `src/js/data/catalog.js`).

### Optional: Claude review

In **Settings → Claude AI**, you can paste an Anthropic API key. Claude (`claude-opus-5-5`, via the official `@anthropic-ai/sdk`) then reviews each baseline forecast against your waste history:

- Claude returns adjusted quantities and its reasoning as structured JSON.
- The app clamps those quantities to your storage limits.
- If anything fails, you get the baseline forecast.

The key is kept only in that browser's `localStorage`, is never exported, and is sent only to `api.anthropic.com`. This suits an owner's own device. For a shared deployment, proxy the call through your own server.

Live weather comes from [Open‑Meteo](https://open-meteo.com) (free, no key). Only the city name is sent. If it can't be reached, the app uses demo weather.

## Responsive design

- **Desktop (≥ 1024px):** fixed sidebar with navigation, items needing attention, and today's signals.
- **Tablet and phone:** the sidebar becomes a slide-out drawer, and a bottom tab bar appears (Home, Stock, Forecast, Orders, More). It respects safe-area insets.
- **Phones (< 640px):**
  - Tables become stacked cards and dialogs become bottom sheets.
  - Tap targets are 44px.
  - Inputs use 16px text so iOS doesn't zoom.
  - The workflow tracker scrolls sideways.
- **Theme:** light and dark follow the OS, and you can override them from the topbar or Settings.
- **Accessibility:** skip link, focus management on navigation, ARIA labels, and reduced-motion support.

## Project structure

```
index.html                 App entry (loads CSS + src/js/main.js as an ES module)
public/                    Icon + web manifest (installable on phones)
src/styles/                tokens.css (design tokens, light/dark) · base · layout · components
src/js/main.js             Bootstrap: router → view render → delegated events → store
src/js/core/               html (escaping templates) · store · actions (pure reducers) · router · ui · format · icons
src/js/data/               catalog (categories, weather codes) · seed (demo shop)
src/js/services/           forecast · metrics · weather · ai
src/js/components/         shell (sidebar/topbar/bottom nav) · widgets
src/js/views/              dashboard · inventory · forecast · orders · waste · settings · notfound
tests/                     Unit tests for reducers, forecast engine, store, templating
```

**Adding a page:** create `src/js/views/<name>.js`. It exports `title` and `render(ctx)`, plus optional `mount`, `actions`, `forms`, `changes` and `inputs`. Register it in `VIEWS` in `main.js` and `NAV` in `components/shell.js`. Every state change goes through a pure reducer in `core/actions.js`, so you can unit-test it.
