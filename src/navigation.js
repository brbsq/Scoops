const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let generation = 0;
let expectedHash = '';
let active = false;
const overlay = document.createElement('div');
overlay.className = 'dissolve-transition';
overlay.setAttribute('aria-hidden', 'true');
document.body.append(overlay);
export const isNavigating = () => active;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
export function cancelNavigation() {
  generation++;
  active = false;
  overlay.className = 'dissolve-transition';
  const landing = document.querySelector('.landing');
  landing.inert = false;
  landing.classList.remove('is-dissolving');
}
window.addEventListener('hashchange', () => {
  if (active && location.hash !== expectedHash) cancelNavigation();
});
export async function dissolveNavigate(route, { replace = false } = {}) {
  if (active) return false;
  const token = ++generation;
  active = true;
  expectedHash = `#${route}`;
  const landing = document.querySelector('.landing');
  landing.inert = true;
  const duration = reducedMotion.matches ? 100 : 450;
  landing.style.setProperty('--dissolve-duration', `${duration}ms`);
  overlay.className = 'dissolve-transition is-running';
  landing.classList.add('is-dissolving');
  await delay(duration);
  if (token !== generation) return false;
  if (replace) location.replace(expectedHash);
  else location.hash = route;
  // Let route handlers render the next screen before dissolving it back in.
  await delay(30);
  if (token !== generation) return false;
  landing.classList.remove('is-dissolving');
  await delay(duration);
  if (token !== generation) return false;
  active = false;
  overlay.className = 'dissolve-transition';
  landing.inert = false;
  document.querySelector('.game-page:not([hidden]) h1, .pvp-page:not([hidden]) h1, .mode-page:not([hidden]) h2')?.focus({ preventScroll: true });
  return true;
}
