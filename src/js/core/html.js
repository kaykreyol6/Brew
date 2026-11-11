/**
 * Tiny, safe HTML templating.
 *
 *   html`<p>${userText}</p>`      → interpolations are HTML-escaped
 *   html`<ul>${items.map(i => html`<li>${i}</li>`)}</ul>`  → nested templates & arrays compose
 *   raw(trustedMarkup)            → opt out of escaping (icons, pre-built markup)
 *
 * Templates return a SafeHTML object; call String(tpl) or render(el, tpl).
 */

class SafeHTML {
  constructor(value) { this.value = value; }
  toString() { return this.value; }
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function esc(value) {
  return String(value).replace(/[&<>"']/g, (c) => ESC[c]);
}

export function raw(value) {
  return new SafeHTML(String(value ?? ''));
}

function serialize(value) {
  if (value === null || value === undefined || value === false) return '';
  if (value instanceof SafeHTML) return value.value;
  if (Array.isArray(value)) return value.map(serialize).join('');
  return esc(value);
}

export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += serialize(values[i]) + strings[i + 1];
  return new SafeHTML(out);
}

/** Build a class string from a mix of strings and {cls: bool} objects. */
export function cx(...parts) {
  const out = [];
  for (const p of parts) {
    if (!p) continue;
    if (typeof p === 'string') out.push(p);
    else for (const [k, v] of Object.entries(p)) if (v) out.push(k);
  }
  return out.join(' ');
}

export function render(el, tpl) {
  el.innerHTML = serialize(tpl);
}
