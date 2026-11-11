/**
 * Live 7-day weather from Open-Meteo (free, no API key). Falls back to demo data.
 * Only the shop's city name is sent, to look up coordinates.
 */
import { demoWeather } from '../data/seed.js';
import { toISODate } from '../core/format.js';

const GEO = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST = 'https://api.open-meteo.com/v1/forecast';

async function getJSON(url, signal) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchWeather(location, { timeoutMs = 8000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const city = String(location || '').split(',')[0].trim();
    if (!city) throw new Error('No location set');
    const geo = await getJSON(`${GEO}?name=${encodeURIComponent(city)}&count=1&language=en&format=json`, ctrl.signal);
    const place = geo?.results?.[0];
    if (!place) throw new Error(`Couldn't find “${city}”`);
    const params = new URLSearchParams({
      latitude: place.latitude,
      longitude: place.longitude,
      daily: 'weather_code,temperature_2m_max,precipitation_probability_max',
      temperature_unit: 'fahrenheit',
      timezone: 'auto',
      forecast_days: '7',
    });
    const fc = await getJSON(`${FORECAST}?${params}`, ctrl.signal);
    const d = fc?.daily;
    if (!d?.time?.length) throw new Error('No forecast returned');
    return {
      source: 'live',
      location: [place.name, place.admin1, place.country_code].filter(Boolean).join(', '),
      updatedAt: new Date().toISOString(),
      days: d.time.map((date, i) => ({
        date,
        code: d.weather_code[i],
        tempMax: Math.round(d.temperature_2m_max[i]),
        precip: d.precipitation_probability_max?.[i] ?? null,
      })),
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Demo weather re-anchored to today (so stale demo data never shows past dates). */
export function freshDemoWeather(now = new Date()) {
  return demoWeather(toISODate(now));
}

export function isStale(weather, now = new Date()) {
  if (!weather?.days?.length) return true;
  const today = toISODate(now);
  if (weather.days[0].date !== today) return true;
  return now - new Date(weather.updatedAt) > 3 * 3600 * 1000;
}
