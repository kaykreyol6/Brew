import { html } from '../core/html.js';
import { pageHeader, card, emptyState } from '../components/widgets.js';

export const title = 'Page not found';

export function render({ route }) {
  return html`
    ${pageHeader({ title: 'Page not found' })}
    ${card({ body: emptyState({
      iconName: 'search',
      title: `There’s nothing at “${route.path}”`,
      text: 'The link may be out of date. Pick a section from the menu, or head back to the dashboard.',
      actions: html`<a class="btn btn-primary" href="#/dashboard">Go to dashboard</a><a class="btn" href="#/inventory">Inventory</a>`,
    }) })}`;
}
