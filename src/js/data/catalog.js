/** Static domain reference data shared by the engine, views and seed. */

/**
 * Category demand sensitivities, as fractional uplift (0.18 = +18%).
 *  rain  – precipitation days (hot drinks & comfort food up)
 *  cold  – max temp below 55°F
 *  hot   – max temp above 72°F (iced drinks / fruit up, hot dairy down)
 *  event – multiplier applied to a local event's footfall uplift
 */
export const CATEGORIES = {
  dairy:   { label: 'Dairy & milk',  rain: 0.18,  cold: 0.10, hot: -0.06, event: 0.8 },
  bakery:  { label: 'Bakery',        rain: 0.06,  cold: 0.04, hot: -0.04, event: 1.0 },
  food:    { label: 'Food',          rain: -0.04, cold: 0.03, hot: 0.00,  event: 1.0 },
  produce: { label: 'Produce',       rain: -0.05, cold: -0.03, hot: 0.08, event: 0.9 },
  syrup:   { label: 'Syrups & extras', rain: 0.05, cold: 0.05, hot: 0.06, event: 0.7 },
  other:   { label: 'Other',         rain: 0,     cold: 0,    hot: 0,     event: 0.5 },
};

export const UNITS = ['litres', 'units', 'bottles', 'kg', 'bags', 'packs', 'boxes'];

export const WASTE_REASONS = ['Expired', 'Spoiled', 'Overproduced', 'Damaged', 'Other'];

/** WMO weather interpretation codes → display + demand class. */
export function weatherInfo(code) {
  const c = Number(code);
  if (c === 0) return { icon: '☀️', label: 'Sunny', kind: 'clear' };
  if (c === 1 || c === 2) return { icon: '⛅', label: 'Partly cloudy', kind: 'cloudy' };
  if (c === 3) return { icon: '☁️', label: 'Cloudy', kind: 'cloudy' };
  if (c === 45 || c === 48) return { icon: '🌫️', label: 'Fog', kind: 'cloudy' };
  if (c >= 51 && c <= 57) return { icon: '🌦️', label: 'Drizzle', kind: 'rain' };
  if ((c >= 61 && c <= 67) || (c >= 80 && c <= 82)) return { icon: '🌧️', label: 'Rain', kind: 'rain' };
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return { icon: '🌨️', label: 'Snow', kind: 'rain' };
  if (c >= 95) return { icon: '⛈️', label: 'Storms', kind: 'rain' };
  return { icon: '🌤️', label: 'Fair', kind: 'cloudy' };
}

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Typical café weekday shape (index 0 = Sunday), used before enough sales history exists. */
export const DEFAULT_WEEKDAY_CUPS = [285, 155, 162, 178, 190, 245, 310];
