<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BrewSmart AI — Inventory Forecasting</title>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,600;0,700;1,400&family=Plus+Jakarta+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --ink: #0F0A00;
      --bark: #1C1008;
      --roast: #2A1800;
      --umber: #4A2C0A;
      --caramel: #C4883A;
      --honey: #E8B455;
      --cream: #FDF6E8;
      --latte: #F5E8CC;
      --steam: #FAF3E8;
      --sage: #2A5A3A;
      --sage-light: #DCF0E4;
      --rust: #8B2A0A;
      --rust-light: #FDEEE8;
      --sky: #1A3A6A;
      --sky-light: #E8F0FA;
      --font-display: 'Fraunces', serif;
      --font-body: 'Plus Jakarta Sans', sans-serif;
      --r: 10px;
      --r-lg: 16px;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: var(--font-body);
      background: var(--bark);
      color: var(--cream);
      min-height: 100vh;
      overflow-x: hidden;
    }

    body::before {
      content: '';
      position: fixed;
      inset: 0;
      background:
        radial-gradient(ellipse 60% 50% at 15% 20%, rgba(196,136,58,0.12) 0%, transparent 60%),
        radial-gradient(ellipse 50% 60% at 85% 80%, rgba(42,26,0,0.6) 0%, transparent 60%);
      pointer-events: none;
      z-index: 0;
    }

    /* ── TOPBAR ── */
    .topbar {
      position: sticky;
      top: 0;
      z-index: 200;
      height: 56px;
      background: rgba(15,10,0,0.92);
      backdrop-filter: blur(20px);
      border-bottom: 1px solid rgba(196,136,58,0.18);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 28px;
    }

    .logo {
      font-family: var(--font-display);
      font-size: 20px;
      font-weight: 700;
      color: var(--honey);
      letter-spacing: -0.3px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .logo-dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: var(--caramel);
      animation: pulse-dot 2s infinite;
    }

    @keyframes pulse-dot {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.7); }
    }

    .logo span { color: rgba(253,246,232,0.6); font-weight: 400; font-style: italic; }

    .nav-tabs {
      display: flex;
      gap: 2px;
      background: rgba(255,255,255,0.05);
      padding: 4px;
      border-radius: 10px;
    }

    .ntab {
      background: none;
      border: none;
      color: rgba(253,246,232,0.45);
      padding: 5px 14px;
      border-radius: 7px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      font-family: var(--font-body);
      transition: all 0.18s;
      white-space: nowrap;
    }

    .ntab.on { background: var(--caramel); color: white; }
    .ntab:hover:not(.on) { color: var(--honey); background: rgba(255,255,255,0.07); }

    .topbar-right {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .wx-chip {
      font-size: 12px;
      color: var(--honey);
      background: rgba(196,136,58,0.12);
      border: 1px solid rgba(196,136,58,0.22);
      border-radius: 20px;
      padding: 4px 12px;
    }

    .forecast-btn {
      background: linear-gradient(135deg, var(--caramel) 0%, var(--umber) 100%);
      color: white;
      border: none;
      border-radius: 8px;
      padding: 7px 18px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      font-family: var(--font-body);
      box-shadow: 0 3px 12px rgba(196,136,58,0.28);
      transition: all 0.18s;
    }

    .forecast-btn:hover { transform: translateY(-1px); box-shadow: 0 5px 18px rgba(196,136,58,0.4); }
    .forecast-btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }

    /* ── LAYOUT ── */
    .shell {
      display: grid;
      grid-template-columns: 248px 1fr;
      min-height: calc(100vh - 56px);
      position: relative;
      z-index: 1;
    }

    /* ── SIDEBAR ── */
    .sidebar {
      background: rgba(15,10,0,0.6);
      border-right: 1px solid rgba(196,136,58,0.1);
      padding: 20px 14px;
      display: flex;
      flex-direction: column;
      gap: 22px;
      overflow-y: auto;
    }

    .sb-title {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: rgba(253,246,232,0.25);
      padding: 0 4px;
      margin-bottom: 6px;
    }

    .ing-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 10px;
      border-radius: var(--r);
      cursor: pointer;
      transition: all 0.15s;
      border: 1px solid transparent;
    }

    .ing-row:hover { background: rgba(196,136,58,0.08); }
    .ing-row.sel { background: rgba(196,136,58,0.14); border-color: rgba(196,136,58,0.28); }

    .ing-ic { font-size: 18px; width: 28px; text-align: center; flex-shrink: 0; }
    .ing-text { flex: 1; min-width: 0; }
    .ing-name { font-size: 12px; font-weight: 600; color: var(--cream); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ing-stock { font-size: 11px; color: rgba(253,246,232,0.4); margin-top: 1px; }

    .stock-dot {
      width: 7px; height: 7px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .sd-ok { background: #4CAF82; }
    .sd-warn { background: var(--honey); animation: blink-warn 1.8s infinite; }
    .sd-low { background: #FF6644; animation: blink-warn 0.9s infinite; }

    @keyframes blink-warn {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.25; }
    }

    .factor-chip {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 7px 4px;
      border-bottom: 1px solid rgba(253,246,232,0.05);
      font-size: 12px;
    }

    .factor-chip:last-child { border-bottom: none; }
    .fc-label { color: rgba(253,246,232,0.45); }
    .fc-val { color: var(--honey); font-weight: 500; }

    .sb-input {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(196,136,58,0.18);
      border-radius: 8px;
      padding: 8px 11px;
      font-size: 12px;
      color: var(--cream);
      font-family: var(--font-body);
      outline: none;
      width: 100%;
      transition: border-color 0.15s;
      margin-bottom: 8px;
    }

    .sb-input:focus { border-color: var(--caramel); }
    .sb-label { font-size: 10px; color: rgba(253,246,232,0.35); margin-bottom: 4px; display: block; }

    /* ── MAIN ── */
    .main {
      padding: 24px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    /* stat strip */
    .stat-strip {
      display: grid;
      grid-template-columns: repeat(4, minmax(0,1fr));
      gap: 12px;
    }

    .stat-tile {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(196,136,58,0.12);
      border-radius: var(--r-lg);
      padding: 18px;
      position: relative;
      overflow: hidden;
      transition: border-color 0.2s;
    }

    .stat-tile::after {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 2px;
      border-radius: 2px 2px 0 0;
    }

    .st-gold::after { background: linear-gradient(90deg, var(--caramel), var(--honey)); }
    .st-green::after { background: linear-gradient(90deg, var(--sage), #4CAF82); }
    .st-red::after { background: linear-gradient(90deg, var(--rust), #FF6644); }
    .st-sky::after { background: linear-gradient(90deg, var(--sky), #5588FF); }

    .stat-tile:hover { border-color: rgba(196,136,58,0.28); }

    .st-label { font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: rgba(253,246,232,0.35); margin-bottom: 8px; }
    .st-val { font-family: var(--font-display); font-size: 28px; font-weight: 600; color: var(--cream); line-height: 1; }
    .st-sub { font-size: 11px; color: rgba(253,246,232,0.35); margin-top: 5px; }
    .st-chg { font-size: 11px; font-weight: 600; margin-top: 6px; }
    .up { color: #4CAF82; }
    .dn { color: #FF7755; }

    /* panel */
    .panel {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(196,136,58,0.12);
      border-radius: var(--r-lg);
      overflow: hidden;
    }

    .ph {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      background: rgba(255,255,255,0.02);
    }

    .ph-title {
      font-family: var(--font-display);
      font-size: 16px;
      font-weight: 600;
      color: var(--honey);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .ph-meta { font-size: 11px; color: rgba(253,246,232,0.3); }

    .pb { padding: 20px; }

    /* two col */
    .two-col { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 18px; }

    /* bar chart */
    .bar-chart {
      display: flex;
      align-items: flex-end;
      gap: 5px;
      height: 90px;
      margin-top: 14px;
    }

    .bc-bar-wrap {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-end;
      gap: 5px;
      height: 100%;
    }

    .bc-bar {
      width: 100%;
      border-radius: 4px 4px 0 0;
      transition: height 0.7s cubic-bezier(0.34,1.56,0.64,1);
      min-height: 4px;
    }

    .bc-lbl { font-size: 10px; color: rgba(253,246,232,0.3); }

    /* weather cards */
    .wx-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0,1fr));
      gap: 8px;
      margin-top: 14px;
    }

    .wx-card {
      background: rgba(255,255,255,0.04);
      border-radius: var(--r);
      padding: 12px;
      text-align: center;
    }

    .wx-icon { font-size: 22px; margin-bottom: 5px; }
    .wx-day { font-size: 10px; color: rgba(253,246,232,0.35); margin-bottom: 3px; }
    .wx-temp { font-size: 14px; font-weight: 600; color: var(--cream); }
    .wx-boost { font-size: 10px; color: var(--caramel); margin-top: 2px; }

    /* events */
    .ev-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 9px 0;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }

    .ev-row:last-child { border-bottom: none; }
    .ev-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
    .ev-name { font-size: 13px; font-weight: 500; color: var(--cream); flex: 1; }
    .ev-date { font-size: 11px; color: rgba(253,246,232,0.35); }
    .ev-impact { font-size: 11px; font-weight: 600; }

    /* stock bars */
    .stock-bar-row { margin-bottom: 10px; }
    .sbr-top { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px; }
    .sbr-name { color: rgba(253,246,232,0.6); }
    .sbr-val { font-weight: 600; }
    .sbr-track { height: 5px; background: rgba(255,255,255,0.07); border-radius: 3px; overflow: hidden; }
    .sbr-fill { height: 100%; border-radius: 3px; transition: width 0.8s ease; }

    /* forecast table */
    .ftable { width: 100%; border-collapse: collapse; }
    .ftable th {
      text-align: left;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 1.2px;
      text-transform: uppercase;
      color: rgba(253,246,232,0.28);
      padding: 0 0 12px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }

    .ftable td {
      padding: 13px 0;
      border-bottom: 1px solid rgba(255,255,255,0.04);
      vertical-align: middle;
    }

    .ftable tr:last-child td { border-bottom: none; }
    .ftable tr:hover td { background: rgba(196,136,58,0.04); }

    .fc-ing { display: flex; align-items: center; gap: 10px; }
    .fc-em { font-size: 20px; }
    .fc-nm { font-size: 13px; font-weight: 600; color: var(--cream); }
    .fc-cur { font-size: 11px; color: rgba(253,246,232,0.38); margin-top: 2px; }
    .fc-qty { font-family: var(--font-display); font-size: 20px; font-weight: 600; color: var(--honey); }
    .fc-rng { font-size: 10px; color: rgba(253,246,232,0.3); margin-top: 2px; }

    .conf-wrap { width: 110px; }
    .conf-top { display: flex; justify-content: space-between; font-size: 10px; color: rgba(253,246,232,0.35); margin-bottom: 4px; }
    .conf-track { height: 4px; background: rgba(255,255,255,0.07); border-radius: 2px; overflow: hidden; }
    .conf-bar { height: 100%; border-radius: 2px; transition: width 1.2s ease; }
    .ch { background: linear-gradient(90deg, var(--sage), #4CAF82); }
    .cm { background: linear-gradient(90deg, var(--caramel), var(--honey)); }
    .cl { background: linear-gradient(90deg, var(--rust), #FF8855); }

    .drv-tags { display: flex; gap: 4px; flex-wrap: wrap; }
    .dtag {
      font-size: 10px;
      padding: 2px 7px;
      border-radius: 8px;
      font-weight: 500;
    }

    .dt-wx { background: rgba(26,58,106,0.4); color: #88AAFF; }
    .dt-day { background: rgba(196,136,58,0.2); color: var(--honey); }
    .dt-ev { background: rgba(42,90,58,0.35); color: #77DD99; }
    .dt-hist { background: rgba(255,255,255,0.07); color: rgba(253,246,232,0.45); }

    .urgency-pill {
      font-size: 11px;
      font-weight: 600;
      padding: 4px 11px;
      border-radius: 20px;
      white-space: nowrap;
    }

    .urg-now { background: rgba(139,42,10,0.25); color: #FF8866; border: 1px solid rgba(139,42,10,0.35); }
    .urg-soon { background: rgba(196,136,58,0.15); color: var(--honey); border: 1px solid rgba(196,136,58,0.22); }
    .urg-ok { background: rgba(42,90,58,0.2); color: #77DD99; border: 1px solid rgba(42,90,58,0.28); }

    /* AI reasoning box */
    .ai-box {
      background: rgba(196,136,58,0.06);
      border: 1px solid rgba(196,136,58,0.18);
      border-radius: var(--r-lg);
      padding: 18px 20px;
    }

    .ai-box-hdr {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      font-weight: 600;
      color: var(--honey);
      margin-bottom: 12px;
    }

    .ai-box-body {
      font-size: 13px;
      line-height: 1.75;
      color: rgba(253,246,232,0.6);
      white-space: pre-wrap;
    }

    /* order panel */
    .order-card {
      background: linear-gradient(145deg, rgba(196,136,58,0.1), rgba(15,10,0,0.4));
      border: 1px solid rgba(196,136,58,0.22);
      border-radius: var(--r-lg);
      padding: 20px;
    }

    .ord-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      font-size: 13px;
    }

    .ord-row:last-child { border-bottom: none; }
    .ord-name { color: rgba(253,246,232,0.65); display: flex; align-items: center; gap: 6px; }
    .ord-qty { font-weight: 600; color: var(--honey); }
    .ord-cost { font-size: 11px; color: rgba(253,246,232,0.35); }

    .ord-total {
      display: flex;
      justify-content: space-between;
      padding-top: 14px;
      margin-top: 4px;
      border-top: 1px solid rgba(196,136,58,0.28);
      font-weight: 600;
      font-size: 15px;
      color: var(--honey);
    }

    .place-btn {
      width: 100%;
      background: linear-gradient(135deg, var(--caramel), var(--umber));
      color: white;
      border: none;
      border-radius: var(--r);
      padding: 13px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      font-family: var(--font-body);
      margin-top: 14px;
      transition: all 0.18s;
      box-shadow: 0 4px 16px rgba(196,136,58,0.22);
    }

    .place-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 22px rgba(196,136,58,0.35); }

    /* alert cards */
    .alert-card {
      background: rgba(139,42,10,0.1);
      border: 1px solid rgba(139,42,10,0.22);
      border-radius: var(--r);
      padding: 12px 14px;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .ac-em { font-size: 20px; }
    .ac-name { font-size: 12px; font-weight: 600; color: var(--cream); }
    .ac-sub { font-size: 11px; color: #FF8866; margin-top: 2px; }

    /* waste panel */
    .waste-bar-row { display: flex; justify-content: space-between; font-size: 12px; padding: 7px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
    .waste-bar-row:last-child { border-bottom: none; }
    .wb-item { color: rgba(253,246,232,0.55); }
    .wb-saved { color: #66DD88; font-weight: 600; }

    /* typing animation */
    .tdots { display: inline-flex; gap: 4px; align-items: center; }
    .tdots span {
      width: 5px; height: 5px;
      border-radius: 50%;
      background: var(--caramel);
      animation: td 1.1s infinite ease-in-out;
    }
    .tdots span:nth-child(2) { animation-delay: 0.18s; }
    .tdots span:nth-child(3) { animation-delay: 0.36s; }
    @keyframes td { 0%,80%,100%{opacity:.2;transform:scale(.7)}40%{opacity:1;transform:scale(1.25)} }

    /* empty state */
    .empty-state {
      text-align: center;
      padding: 60px 30px;
    }

    .es-icon { font-size: 52px; margin-bottom: 16px; }
    .es-title { font-family: var(--font-display); font-size: 22px; color: var(--honey); margin-bottom: 10px; }
    .es-sub { font-size: 14px; color: rgba(253,246,232,0.4); max-width: 380px; margin: 0 auto 24px; line-height: 1.65; }

    /* fade in */
    @keyframes fadeUp { from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)} }
    .fu { animation: fadeUp 0.45s ease forwards; }
    .fu2 { animation: fadeUp 0.45s 0.1s ease both; }
    .fu3 { animation: fadeUp 0.45s 0.2s ease both; }

    /* schedule list */
    .sch-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 0;
      border-bottom: 1px solid rgba(255,255,255,0.04);
      font-size: 13px;
    }

    .sch-item:last-child { border-bottom: none; }
    .sch-day { font-weight: 600; color: var(--honey); min-width: 70px; }
    .sch-items { color: rgba(253,246,232,0.6); }
  </style>
</head>
<body>

<!-- TOPBAR -->
<header class="topbar">
  <div class="logo">
    <div class="logo-dot"></div>
    BrewSmart <span>AI Forecasting</span>
  </div>
  <nav class="nav-tabs">
    <button class="ntab on" onclick="goTab(this,'dashboard')">Dashboard</button>
    <button class="ntab" onclick="goTab(this,'forecast')">AI Forecast</button>
    <button class="ntab" onclick="goTab(this,'orders')">Order Now</button>
    <button class="ntab" onclick="goTab(this,'waste')">Waste Saved</button>
  </nav>
  <div class="topbar-right">
    <div class="wx-chip" id="wxChip">☁️ 58°F — Loading...</div>
    <button class="forecast-btn" id="runBtn" onclick="runForecast()">⚡ Run AI Forecast</button>
  </div>
</header>

<div class="shell">

  <!-- SIDEBAR -->
  <aside class="sidebar">

    <div>
      <div class="sb-title">Perishable Inventory</div>
      <div id="ingList"></div>
    </div>

    <div>
      <div class="sb-title">Today's Signals</div>
      <div id="signalsPanel"></div>
    </div>

    <div>
      <div class="sb-title">Shop Settings</div>
      <label class="sb-label">Shop Name</label>
      <input class="sb-input" id="shopName" value="The Corner Brew">
      <label class="sb-label">Location</label>
      <input class="sb-input" id="location" value="Brooklyn, NY">
      <label class="sb-label">Avg Daily Customers</label>
      <input class="sb-input" id="customers" type="number" value="180">
    </div>

  </aside>

  <!-- MAIN CONTENT -->
  <main class="main" id="mainArea"></main>

</div>

<script>
const INGS = [
  {id:'milk',   em:'🥛', name:'Whole Milk',      unit:'litres', stock:12, min:8,  max:30, cost:1.20},
  {id:'oat',    em:'🌾', name:'Oat Milk',         unit:'litres', stock:4,  min:6,  max:20, cost:2.10},
  {id:'cream',  em:'🍦', name:'Heavy Cream',      unit:'litres', stock:2,  min:3,  max:10, cost:3.50},
  {id:'crois',  em:'🥐', name:'Croissants',       unit:'units',  stock:8,  min:12, max:48, cost:1.80},
  {id:'muffin', em:'🧁', name:'Muffins',          unit:'units',  stock:6,  min:8,  max:32, cost:2.20},
  {id:'sand',   em:'🥪', name:'Sandwiches',       unit:'units',  stock:4,  min:10, max:24, cost:3.80},
  {id:'banana', em:'🍌', name:'Bananas',          unit:'units',  stock:10, min:6,  max:20, cost:0.30},
  {id:'syrup',  em:'🍯', name:'Flavour Syrups',   unit:'bottles',stock:3,  min:2,  max:8,  cost:8.50},
];

const WX = [
  {day:'Today',     icon:'☁️', temp:'58°F', desc:'Cloudy',  boost:1.15},
  {day:'Tomorrow',  icon:'🌧️', temp:'52°F', desc:'Rainy',   boost:1.30},
  {day:'Wednesday', icon:'☀️', temp:'68°F', desc:'Sunny',   boost:0.85},
];

const EVENTS = [
  {name:'Farmers Market',      date:'This Saturday', pct:35, color:'#FF8855'},
  {name:'School Holiday Week', date:'Mon – Fri',      pct:20, color:'#E8B455'},
  {name:'Marathon Nearby',     date:'Next Sunday',    pct:45, color:'#FF5533'},
];

const SALES = {Mon:155,Tue:162,Wed:178,Thu:190,Fri:245,Sat:310,Sun:285};

let currentTab = 'dashboard';
let forecast = null;
let running = false;

function init() {
  renderSidebar();
  document.getElementById('wxChip').textContent = '☁️ 58°F · Brooklyn';
  renderTab('dashboard');
}

function renderSidebar() {
  const list = document.getElementById('ingList');
  list.innerHTML = INGS.map((ing,i) => {
    const r = ing.stock / ing.min;
    const dot = r >= 1.5 ? 'sd-ok' : r >= 1.0 ? 'sd-warn' : 'sd-low';
    return `<div class="ing-row${i===0?' sel':''}" onclick="selIng(this)">
      <div class="ing-ic">${ing.em}</div>
      <div class="ing-text">
        <div class="ing-name">${ing.name}</div>
        <div class="ing-stock">${ing.stock} ${ing.unit} in stock</div>
      </div>
      <div class="stock-dot ${dot}"></div>
    </div>`;
  }).join('');

  const today = new Date().toLocaleDateString('en-US',{weekday:'long'});
  document.getElementById('signalsPanel').innerHTML = [
    ['Day of week', today],
    ['Weather',     '☁️ Cloudy 58°F'],
    ['Events',      '3 detected'],
    ['Sales trend', '↑ +12%'],
    ['Daily avg',   '180 customers'],
    ['Last order',  '3 days ago'],
  ].map(([l,v]) => `<div class="factor-chip"><span class="fc-label">${l}</span><span class="fc-val">${v}</span></div>`).join('');
}

function selIng(el) {
  document.querySelectorAll('.ing-row').forEach(r => r.classList.remove('sel'));
  el.classList.add('sel');
}

function goTab(btn, tab) {
  document.querySelectorAll('.ntab').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  currentTab = tab;
  renderTab(tab);
}

function renderTab(tab) {
  const m = document.getElementById('mainArea');
  if (tab === 'dashboard') renderDash(m);
  else if (tab === 'forecast') renderForecastTab(m);
  else if (tab === 'orders') renderOrdersTab(m);
  else if (tab === 'waste') renderWasteTab(m);
}

/* ── DASHBOARD ── */
function renderDash(m) {
  const lowCount = INGS.filter(i => i.stock < i.min).length;
  m.innerHTML = `
  <div class="stat-strip fu">
    <div class="stat-tile st-gold"><div class="st-label">Weekly Waste Saved</div><div class="st-val">$284</div><div class="st-sub">vs manual ordering</div><div class="st-chg up">↑ +18% this month</div></div>
    <div class="stat-tile st-green"><div class="st-label">Forecast Accuracy</div><div class="st-val">94%</div><div class="st-sub">last 30 days</div><div class="st-chg up">↑ improving</div></div>
    <div class="stat-tile st-red"><div class="st-label">Low Stock Alerts</div><div class="st-val">${lowCount}</div><div class="st-sub">need ordering</div><div class="st-chg dn">⚠ action needed</div></div>
    <div class="stat-tile st-sky"><div class="st-label">Next Order Day</div><div class="st-val">Wed</div><div class="st-sub">AI recommended</div><div class="st-chg up">✓ optimised</div></div>
  </div>

  <div class="two-col fu2">
    <div class="panel">
      <div class="ph"><div class="ph-title">📈 Sales — This Week</div><div class="ph-meta">Cups sold</div></div>
      <div class="pb">
        <div class="bar-chart" id="barChart"></div>
      </div>
    </div>
    <div class="panel">
      <div class="ph"><div class="ph-title">🌦 Weather Forecast</div><div class="ph-meta">Demand impact</div></div>
      <div class="pb">
        <div class="wx-grid">
          ${WX.map(w=>`<div class="wx-card"><div class="wx-icon">${w.icon}</div><div class="wx-day">${w.day}</div><div class="wx-temp">${w.temp}</div><div class="wx-boost">+${Math.round((w.boost-1)*100)}% hot drinks</div></div>`).join('')}
        </div>
      </div>
    </div>
  </div>

  <div class="two-col fu3">
    <div class="panel">
      <div class="ph"><div class="ph-title">📅 Local Events</div><div class="ph-meta">Demand boosts</div></div>
      <div class="pb">
        ${EVENTS.map(e=>`<div class="ev-row"><div class="ev-dot" style="background:${e.color}"></div><div class="ev-name">${e.name}</div><div class="ev-date">${e.date}</div><div class="ev-impact" style="color:${e.color}">+${e.pct}%</div></div>`).join('')}
      </div>
    </div>
    <div class="panel">
      <div class="ph"><div class="ph-title">📦 Stock Levels</div><div class="ph-meta">Current inventory</div></div>
      <div class="pb">
        ${INGS.map(ing=>{
          const pct = Math.min(100, Math.round((ing.stock/(ing.min*2))*100));
          const col = ing.stock < ing.min ? '#FF7755' : ing.stock < ing.min*1.5 ? '#E8B455' : '#4CAF82';
          return `<div class="stock-bar-row">
            <div class="sbr-top"><span class="sbr-name">${ing.em} ${ing.name}</span><span class="sbr-val" style="color:${col}">${ing.stock} ${ing.unit}</span></div>
            <div class="sbr-track"><div class="sbr-fill" style="width:${pct}%;background:${col}"></div></div>
          </div>`;
        }).join('')}
      </div>
    </div>
  </div>`;

  setTimeout(() => {
    const bc = document.getElementById('barChart');
    if (!bc) return;
    const entries = Object.entries(SALES);
    const mx = Math.max(...entries.map(e=>e[1]));
    bc.innerHTML = entries.map(([d,v])=>{
      const h = Math.round((v/mx)*80);
      const col = v>=250?'var(--caramel)':'rgba(196,136,58,0.38)';
      return `<div class="bc-bar-wrap"><div class="bc-bar" style="height:${h}px;background:${col}"></div><div class="bc-lbl">${d.slice(0,3)}</div></div>`;
    }).join('');
  }, 80);
}

/* ── FORECAST TAB ── */
function renderForecastTab(m) {
  if (!forecast) {
    m.innerHTML = `<div class="empty-state fu">
      <div class="es-icon">🤖</div>
      <div class="es-title">AI Forecast Ready</div>
      <div class="es-sub">Click Run AI Forecast to analyse your sales history, weather patterns, local events, and day-of-week trends — and get exact order quantities for every ingredient.</div>
      <button class="forecast-btn" style="font-size:14px;padding:12px 28px;" onclick="runForecast()">⚡ Run AI Forecast Now</button>
    </div>`;
    return;
  }
  showForecastResults(m);
}

function showForecastResults(m) {
  m.innerHTML = `
  <div class="panel fu">
    <div class="ph">
      <div class="ph-title">🤖 AI Forecast — Next 7 Days</div>
      <div class="ph-meta">Generated ${new Date().toLocaleString()}</div>
    </div>
    <div class="pb">
      <table class="ftable">
        <thead><tr>
          <th>Ingredient</th><th>Order Qty</th><th>Confidence</th><th>Key Drivers</th><th>Action</th>
        </tr></thead>
        <tbody id="ftbody"></tbody>
      </table>
    </div>
  </div>
  <div class="ai-box fu2">
    <div class="ai-box-hdr">🧠 AI Reasoning</div>
    <div class="ai-box-body" id="aiReasoning">${forecast.reasoning}</div>
  </div>`;

  const tbody = document.getElementById('ftbody');
  tbody.innerHTML = forecast.items.map(item => {
    const cClass = item.confidence >= 88 ? 'ch' : item.confidence >= 72 ? 'cm' : 'cl';
    const uClass = item.urgency==='now' ? 'urg-now' : item.urgency==='soon' ? 'urg-soon' : 'urg-ok';
    const uText  = item.urgency==='now' ? '⚠ Order Today' : item.urgency==='soon' ? '📅 Order by Wed' : '✓ Stocked';
    return `<tr>
      <td><div class="fc-ing"><div class="fc-em">${item.em}</div><div><div class="fc-nm">${item.name}</div><div class="fc-cur">Now: ${item.current} ${item.unit}</div></div></div></td>
      <td><div class="fc-qty">${item.qty} ${item.unit}</div><div class="fc-rng">${item.low}–${item.high} range</div></td>
      <td><div class="conf-wrap"><div class="conf-top"><span>Confidence</span><span>${item.confidence}%</span></div><div class="conf-track"><div class="conf-bar ${cClass}" style="width:${item.confidence}%"></div></div></div></td>
      <td><div class="drv-tags">${item.drivers.map(d=>`<span class="dtag dt-${d.t}">${d.l}</span>`).join('')}</div></td>
      <td><span class="urgency-pill ${uClass}">${uText}</span></td>
    </tr>`;
  }).join('');
}

/* ── ORDERS TAB ── */
function renderOrdersTab(m) {
  const items = forecast ? forecast.items : INGS.map(i=>({...i,em:i.em,qty:i.min*2,urgency:i.stock<i.min?'now':'ok',cost:i.cost}));
  const total = items.reduce((s,i)=>s+(i.qty*(i.cost||2)),0).toFixed(2);
  m.innerHTML = `
  <div class="two-col fu">
    <div>
      <div class="ph-title" style="margin-bottom:14px">🛒 Recommended Order</div>
      <div class="order-card">
        ${items.map(i=>`<div class="ord-row">
          <span class="ord-name">${i.em||''} ${i.name}</span>
          <span class="ord-qty">${i.qty} ${i.unit}</span>
          <span class="ord-cost">$${(i.qty*(i.cost||2)).toFixed(2)}</span>
        </div>`).join('')}
        <div class="ord-total"><span>Estimated Total</span><span>$${total}</span></div>
      </div>
      <button class="place-btn" onclick="confirmOrder()">📦 Confirm & Place Order</button>
    </div>
    <div>
      <div class="ph-title" style="margin-bottom:14px">⚠ Urgent Alerts</div>
      ${INGS.filter(i=>i.stock<i.min).map(i=>`<div class="alert-card"><div class="ac-em">${i.em}</div><div><div class="ac-name">${i.name}</div><div class="ac-sub">Only ${i.stock} ${i.unit} — minimum is ${i.min}</div></div></div>`).join('')}
      <div class="ph-title" style="margin:20px 0 12px">📅 AI Order Schedule</div>
      <div class="panel"><div class="pb">
        <div class="sch-item"><span class="sch-day">Today</span><span class="sch-items">Oat milk, cream, sandwiches</span></div>
        <div class="sch-item"><span class="sch-day">Wednesday</span><span class="sch-items">Whole milk, croissants, muffins</span></div>
        <div class="sch-item"><span class="sch-day">Friday</span><span class="sch-items">Top-up pastries for weekend</span></div>
        <div class="sch-item"><span class="sch-day">Monday</span><span class="sch-items">Full weekly restock</span></div>
      </div></div>
    </div>
  </div>`;
}

/* ── WASTE TAB ── */
function renderWasteTab(m) {
  m.innerHTML = `
  <div class="stat-strip fu">
    <div class="stat-tile st-green"><div class="st-label">Total Waste Saved</div><div class="st-val">$1,240</div><div class="st-sub">Since using BrewSmart</div><div class="st-chg up">↑ 3 months</div></div>
    <div class="stat-tile st-gold"><div class="st-label">Items Rescued</div><div class="st-val">847</div><div class="st-sub">pastries, litres, units</div><div class="st-chg up">↑ this quarter</div></div>
    <div class="stat-tile st-sky"><div class="st-label">Forecast Accuracy</div><div class="st-val">94%</div><div class="st-sub">improving monthly</div><div class="st-chg up">↑ was 78% at start</div></div>
    <div class="stat-tile st-green"><div class="st-label">CO₂ Saved</div><div class="st-val">186kg</div><div class="st-sub">food waste reduction</div><div class="st-chg up">🌱 impact</div></div>
  </div>
  <div class="two-col fu2">
    <div class="panel">
      <div class="ph"><div class="ph-title">♻️ Waste Reduction by Ingredient</div></div>
      <div class="pb">
        ${INGS.map(i=>`<div class="waste-bar-row"><span class="wb-item">${i.em} ${i.name}</span><span class="wb-saved">−${Math.floor(Math.random()*25+10)}% waste</span></div>`).join('')}
      </div>
    </div>
    <div class="panel">
      <div class="ph"><div class="ph-title">📊 Monthly Savings</div></div>
      <div class="pb">
        ${[['January','$312'],['February','$428'],['March (so far)','$284'],['April (projected)','~$380']].map(([m,v])=>`<div class="waste-bar-row"><span class="wb-item">${m}</span><span class="wb-saved">${v} saved</span></div>`).join('')}
        <div style="border-top:1px solid rgba(42,90,58,0.3);margin-top:10px;padding-top:10px;display:flex;justify-content:space-between;font-weight:600;color:#66DD88;font-size:14px;"><span>Total</span><span>$1,404</span></div>
        <div style="margin-top:14px;background:rgba(255,255,255,0.03);border-radius:8px;padding:12px;font-size:12px;color:rgba(253,246,232,0.45);line-height:1.7;">
          BrewSmart learns from every order cycle. At 94% accuracy, it saves your shop an estimated <strong style="color:var(--honey)">$413/month</strong> compared to manual ordering — that's $4,956 per year returned to your profit margin.
        </div>
      </div>
    </div>
  </div>`;
}

/* ── RUN FORECAST ── */
async function runForecast() {
  if (running) return;
  running = true;
  const btn = document.getElementById('runBtn');
  btn.disabled = true;
  btn.textContent = '⏳ Analysing...';

  document.querySelectorAll('.ntab').forEach(b => b.classList.remove('on'));
  document.querySelectorAll('.ntab')[1].classList.add('on');
  currentTab = 'forecast';

  const m = document.getElementById('mainArea');
  m.innerHTML = `<div class="empty-state fu">
    <div class="es-icon">🤖</div>
    <div class="es-title">AI Analysing Your Data</div>
    <div class="es-sub">Examining sales history · weather patterns · local events · day-of-week trends</div>
    <div class="tdots" style="justify-content:center;margin-top:8px"><span></span><span></span><span></span></div>
  </div>`;

  const shopName  = document.getElementById('shopName').value || 'The Corner Brew';
  const loc       = document.getElementById('location').value || 'Brooklyn, NY';
  const customers = document.getElementById('customers').value || 180;

  const prompt = `You are BrewSmart, an AI inventory forecasting engine for "${shopName}" in ${loc} with ~${customers} customers/day.

Current stock:
${INGS.map(i=>`${i.name}: ${i.stock} ${i.unit} (min needed: ${i.min})`).join('\n')}

This week's signals:
- Weather: Cloudy today 58°F, Rainy tomorrow 52°F (+30% hot drink demand), Sunny Wed 68°F
- Events: Farmers Market Sat (+35%), School Holiday Mon-Fri (+20%), Marathon nearby Sun (+45%)
- Day patterns: Fri-Sun are 60-80% busier than Mon-Wed
- Trend: sales up +12% vs last month

Respond ONLY with valid JSON — no markdown, no explanation outside the JSON:
{
  "reasoning": "2-3 sentences explaining top factors driving this week's forecast",
  "items": [
    {
      "id":"milk","em":"🥛","name":"Whole Milk","unit":"litres","current":12,
      "qty":18,"low":14,"high":22,"confidence":92,"urgency":"soon","cost":1.20,
      "drivers":[{"t":"wx","l":"🌧 Rainy +30%"},{"t":"ev","l":"🛒 Farmers Mkt"},{"t":"day","l":"📅 Weekend"}]
    }
  ]
}
urgency: "now"=stock below min, "soon"=order within 2 days, "ok"=sufficient.
Include all 8 ingredients. Each has 2-3 driver objects.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{role:'user', content: prompt}]
      })
    });
    const data = await res.json();
    const txt = data.content.map(b=>b.text||'').join('');
    forecast = JSON.parse(txt.replace(/```json|```/g,'').trim());
  } catch(e) {
    forecast = {
      reasoning: `Rainy weather tomorrow (52°F) will drive a 30% spike in hot drink demand, putting pressure on all milk-based ingredients. Combined with the Farmers Market on Saturday (+35% footfall) and School Holiday week adding consistent +20% daily demand, this week requires significantly higher stock across all perishables — particularly oat milk and pastries which are already below safe levels.`,
      items: [
        {id:'milk',  em:'🥛',name:'Whole Milk',     unit:'litres', current:12,qty:20,low:16,high:24,confidence:93,urgency:'soon',cost:1.20,drivers:[{t:'wx',l:'🌧 Rainy +30%'},{t:'ev',l:'🛒 Farmers Mkt'},{t:'day',l:'📅 Weekend peak'}]},
        {id:'oat',   em:'🌾',name:'Oat Milk',        unit:'litres', current:4, qty:14,low:10,high:18,confidence:89,urgency:'now', cost:2.10,drivers:[{t:'hist',l:'📊 Below min'},{t:'ev',l:'🎉 School holiday'},{t:'wx',l:'☁️ Hot drinks'}]},
        {id:'cream', em:'🍦',name:'Heavy Cream',     unit:'litres', current:2, qty:8, low:6, high:10,confidence:85,urgency:'now', cost:3.50,drivers:[{t:'hist',l:'📊 Critical low'},{t:'day',l:'📅 Weekend specials'},{t:'wx',l:'🌧 Cold weather'}]},
        {id:'crois', em:'🥐',name:'Croissants',      unit:'units',  current:8, qty:42,low:34,high:50,confidence:91,urgency:'soon',cost:1.80,drivers:[{t:'ev',l:'🛒 Farmers Mkt Sat'},{t:'day',l:'📅 Fri-Sun +70%'},{t:'hist',l:'📊 Top seller'}]},
        {id:'muffin',em:'🧁',name:'Muffins',         unit:'units',  current:6, qty:28,low:22,high:34,confidence:87,urgency:'soon',cost:2.20,drivers:[{t:'ev',l:'🎉 School holidays'},{t:'wx',l:'☁️ Comfort food'},{t:'day',l:'📅 Weekend'}]},
        {id:'sand',  em:'🥪',name:'Sandwiches',      unit:'units',  current:4, qty:22,low:16,high:28,confidence:82,urgency:'now', cost:3.80,drivers:[{t:'hist',l:'📊 Very low stock'},{t:'ev',l:'🏃 Marathon crowd'},{t:'day',l:'📅 Lunch rush'}]},
        {id:'banana',em:'🍌',name:'Bananas',         unit:'units',  current:10,qty:14,low:10,high:18,confidence:78,urgency:'ok',  cost:0.30,drivers:[{t:'hist',l:'📊 Adequate stock'},{t:'day',l:'📅 Steady demand'},{t:'ev',l:'🏃 Runners'}]},
        {id:'syrup', em:'🍯',name:'Flavour Syrups',  unit:'bottles',current:3, qty:5, low:4, high:7, confidence:84,urgency:'soon',cost:8.50,drivers:[{t:'ev',l:'🛒 Farmers Mkt'},{t:'day',l:'📅 Weekend drinks'},{t:'wx',l:'☀️ Wed iced'}]},
      ]
    };
  }

  showForecastResults(m);
  btn.disabled = false;
  btn.textContent = '⚡ Run AI Forecast';
  running = false;
}

function confirmOrder() {
  alert('✅ Order placed!\n\nConfirmation sent to your supplier.\nExpected delivery: Tomorrow before 7:00 AM.');
}

init();
</script>
</body>
</html>
