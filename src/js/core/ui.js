/** UI primitives: toasts, modal dialogs (bottom sheets on phones), confirm, file download. */
import { html, render } from './html.js';
import { icon } from './icons.js';

/* ── Toasts ─────────────────────────────────────────────── */
export function toast(message, { type = 'success', href, actionLabel, onAction, duration = 4200 } = {}) {
  const region = document.getElementById('toasts');
  if (!region) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  const ic = type === 'error' ? 'alert' : type === 'info' ? 'info' : 'checkCircle';
  render(el, html`${icon(ic)}<div class="toast-msg">${message}</div>
    ${href ? html`<a href="${href}">${actionLabel || 'View'}</a>` : ''}
    ${onAction && !href ? html`<button type="button">${actionLabel || 'Undo'}</button>` : ''}`);
  const dismiss = () => {
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 220);
  };
  el.querySelector('a')?.addEventListener('click', dismiss);
  el.querySelector('button')?.addEventListener('click', () => { onAction?.(); dismiss(); });
  region.appendChild(el);
  while (region.children.length > 3) region.firstElementChild.remove();
  setTimeout(dismiss, duration);
}

/* ── Modal ──────────────────────────────────────────────── */
/**
 * openModal({ title, body, submitLabel, onSubmit(data, form) => false|void|Promise, size, danger, secondary })
 * The body is placed inside a <form>; native validation runs before onSubmit.
 * Return false from onSubmit to keep the dialog open.
 */
export function openModal({ title, body, submitLabel = 'Save', cancelLabel = 'Cancel', onSubmit, onOpen, size = '', danger = false, hideSubmit = false }) {
  const dlg = document.createElement('dialog');
  dlg.className = `modal ${size === 'lg' ? 'modal-lg' : ''}`;
  dlg.setAttribute('aria-labelledby', 'modal-title');
  render(dlg, html`
    <form method="dialog">
      <div class="modal-header">
        <h2 id="modal-title">${title}</h2>
        <button type="button" class="btn btn-ghost btn-icon btn-sm" data-close aria-label="Close">${icon('x')}</button>
      </div>
      <div class="modal-body">${body}</div>
      <div class="modal-footer">
        <button type="button" class="btn btn-ghost" data-close>${cancelLabel}</button>
        ${hideSubmit ? '' : html`<button type="submit" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" value="submit">${submitLabel}</button>`}
      </div>
    </form>`);
  document.body.appendChild(dlg);
  const form = dlg.querySelector('form');

  const close = () => { if (dlg.open) dlg.close(); };
  dlg.addEventListener('close', () => dlg.remove());
  dlg.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) close();
    else if (e.target === dlg) close(); // click on backdrop
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type="submit"]');
    const data = Object.fromEntries(new FormData(form));
    try {
      btn?.classList.add('is-loading');
      const result = await onSubmit?.(data, form);
      if (result !== false) close();
    } catch (err) {
      toast(err.message || 'Something went wrong', { type: 'error' });
    } finally {
      btn?.classList.remove('is-loading');
    }
  });

  dlg.showModal();
  const first = form.querySelector('.modal-body input:not([type=hidden]):not([type=checkbox]), .modal-body select, .modal-body textarea');
  if (first && window.matchMedia('(pointer: fine)').matches) first.focus();
  onOpen?.(dlg, form);
  return { close, dialog: dlg, form };
}

export function confirmDialog({ title = 'Are you sure?', message = '', confirmLabel = 'Confirm', danger = false } = {}) {
  return new Promise((resolve) => {
    let ok = false;
    const { dialog } = openModal({
      title,
      body: html`<p class="muted">${message}</p>`,
      submitLabel: confirmLabel,
      danger,
      onSubmit: () => { ok = true; },
    });
    dialog.addEventListener('close', () => resolve(ok));
  });
}

/* ── Files ──────────────────────────────────────────────── */
export function downloadFile(filename, text, mime = 'application/json') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function toCSV(rows) {
  return rows.map((r) => r.map((v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');
}
