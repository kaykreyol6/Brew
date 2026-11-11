/**
 * Observable app store with localStorage persistence.
 * All mutations go through dispatch(type, payload) → reducers in actions.js.
 */
import { reduce } from './actions.js';
import { createSeed, SCHEMA_VERSION, DEFAULT_SETTINGS } from '../data/seed.js';

export const STORAGE_KEY = 'brewsmart:v1';

function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // storage blocked (private mode, sandboxed iframe…)
  }
}

/** Validate & normalise a state object loaded from storage or an import file. */
export function hydrate(candidate, now = new Date()) {
  if (!candidate || typeof candidate !== 'object' || candidate.version !== SCHEMA_VERSION) return null;
  if (!Array.isArray(candidate.items) || !Array.isArray(candidate.orders)) return null;
  const seed = createSeed(now);
  return {
    ...seed,
    ...candidate,
    settings: { ...DEFAULT_SETTINGS, ...candidate.settings },
    meta: { ...seed.meta, ...candidate.meta },
    cart: Array.isArray(candidate.cart) ? candidate.cart : [],
    waste: Array.isArray(candidate.waste) ? candidate.waste : [],
    sales: Array.isArray(candidate.sales) ? candidate.sales : [],
    events: Array.isArray(candidate.events) ? candidate.events : [],
    suppliers: Array.isArray(candidate.suppliers) ? candidate.suppliers : [],
  };
}

export function createStore({ storage = defaultStorage(), now = () => new Date() } = {}) {
  const subscribers = new Set();
  let persistOk = true;

  function load() {
    try {
      const raw = storage?.getItem(STORAGE_KEY);
      return raw ? hydrate(JSON.parse(raw), now()) : null;
    } catch {
      return null;
    }
  }

  let state = load() ?? createSeed(now());

  function persist() {
    if (!storage) { persistOk = false; return; }
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(state));
      persistOk = true;
    } catch {
      persistOk = false;
    }
  }

  function emit(type) {
    for (const fn of subscribers) fn(state, type);
  }

  persist();

  return {
    get: () => state,
    get persistent() { return persistOk; },

    dispatch(type, payload) {
      const next = reduce(state, type, payload);
      if (next === state) return state;
      state = next;
      persist();
      emit(type);
      return state;
    },

    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },

    reset() {
      state = createSeed(now());
      persist();
      emit('reset');
    },

    clearAll() {
      const seed = createSeed(now());
      state = { ...seed, items: [], orders: [], waste: [], sales: [], events: [], suppliers: [], cart: [], forecast: null, nextOrderNumber: 1001 };
      persist();
      emit('clear');
    },

    exportJSON() {
      const { apiKey, ...settings } = state.settings; // never export the API key
      return JSON.stringify({ ...state, settings: { ...settings, apiKey: '' }, exportedAt: now().toISOString() }, null, 2);
    },

    importJSON(text) {
      const parsed = hydrate(JSON.parse(text), now());
      if (!parsed) throw new Error('This file is not a BrewSmart backup.');
      parsed.settings.apiKey = state.settings.apiKey; // keep the local key
      state = parsed;
      persist();
      emit('import');
    },
  };
}
