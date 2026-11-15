// Tiny hash router: six screens, no dependency.
export type Route = 'garden' | 'plant' | 'water' | 'catalogue' | 'basket' | 'settings';
const ROUTES: Route[] = ['garden', 'plant', 'water', 'catalogue', 'basket', 'settings'];

function parse(): Route {
  const h = location.hash.replace(/^#\/?/, '').split('?')[0] as Route;
  return ROUTES.includes(h) ? h : 'garden';
}

export const router = $state({ route: parse() });

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    router.route = parse();
    window.scrollTo(0, 0);
  });
}

export function go(route: Route): void {
  const hash = route === 'garden' ? '#/' : `#/${route}`;
  if (location.hash !== hash) location.hash = hash;
  else router.route = route;
}
