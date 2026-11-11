/**
 * Hash router: "#/orders/po-123?view=open" → { path, segments, query }.
 * Hash routing keeps the app deployable as static files (GitHub Pages, S3, file server).
 */

export function parseHash(hash = '') {
  const h = String(hash).replace(/^#/, '');
  const [pathPart = '', queryPart = ''] = h.split('?');
  const clean = pathPart.replace(/^\/+|\/+$/g, '');
  const segments = clean ? clean.split('/').map(decodeURIComponent) : ['dashboard'];
  return {
    path: `/${segments.join('/')}`,
    segments,
    query: Object.fromEntries(new URLSearchParams(queryPart)),
    hash: `#/${segments.join('/')}${queryPart ? `?${queryPart}` : ''}`,
  };
}

/** Build "#/a/b?x=1" from a base path and a query object (empty values dropped). */
export function href(path, query = {}) {
  const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString();
  return `#${path.startsWith('/') ? path : `/${path}`}${qs ? `?${qs}` : ''}`;
}

export function createRouter(onRoute) {
  const emit = () => onRoute(parseHash(window.location.hash));
  window.addEventListener('hashchange', emit);
  return {
    start() {
      if (!window.location.hash || window.location.hash === '#' || window.location.hash === '#/') {
        history.replaceState(null, '', '#/dashboard');
      }
      emit();
    },
    go(target, { replace = false } = {}) {
      if (replace) {
        history.replaceState(null, '', target);
        emit();
      } else if (window.location.hash === target) {
        emit();
      } else {
        window.location.hash = target;
      }
    },
    current: () => parseHash(window.location.hash),
  };
}
