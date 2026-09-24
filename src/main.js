import { experience } from './experience.js';
import { patienceLabel } from './words.js';
import { initPvp } from './pvp-view.js';
import { initGame } from './game-view.js';
import { isNavigating } from './navigation.js';
import { AUDIO_PROFILES, MusicLevels, trackFill } from './audio-settings.js';

const music = document.querySelector('#bgm');
const slider = document.querySelector('#volume');
const output = document.querySelector('#volume-value');
const panel = document.querySelector('#volume-panel');
const soundButton = document.querySelector('.sound-button');
const muteButton = document.querySelector('.mute');
const dialog = document.querySelector('.coming-soon');
const waves = document.querySelector('.waves');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const landing = document.querySelector('.landing');
const modePage = document.querySelector('.mode-page');
const modeTitle = document.querySelector('#mode-title');
const timerPanel = document.querySelector('#timer-panel');
const timerButton = document.querySelector('.timer-button');
const modeNames = { baby: 'Baby', easy: 'Easy', pro: 'PRO', pvp: 'PvP' };
// null means unlimited patience. This applies to each customer, not the whole game.
const gameSettings = { mode: null, customerWaitSeconds: null, pvpWaitSeconds: null, roundMinutes: null, practice: 'standard', range: '11-20' };
const timerEntry = document.querySelector('.timer-entry');
landing.append(timerEntry);
const rainbow = document.createElement('div');
rainbow.className = 'rainbow-background';
rainbow.setAttribute('aria-hidden', 'true');
rainbow.innerHTML = `<svg viewBox="0 0 1920 1080" preserveAspectRatio="none"><defs><linearGradient id="rainbow-colours" x1="0" y1="0" x2="0.2" y2="1"><stop stop-color="#39d5c5"/><stop offset=".14" stop-color="#4c565a"/><stop offset=".25" stop-color="#efa270"/><stop offset=".33" stop-color="#e147c8"/><stop offset=".4" stop-color="#fcfb80"/><stop offset=".46" stop-color="#7cfff2"/><stop offset=".53" stop-color="#547bee"/><stop offset=".6" stop-color="#df69d7"/><stop offset=".66" stop-color="#6edb69"/><stop offset=".73" stop-color="#655c57"/><stop offset=".83" stop-color="#f6ac67"/><stop offset=".91" stop-color="#93f3d4"/><stop offset="1" stop-color="#8089d9"/></linearGradient><filter id="rainbow-flow" x="-20%" y="-30%" width="140%" height="160%"><feTurbulence type="fractalNoise" baseFrequency=".0017 .0013" numOctaves="2" seed="7" result="flow"/><feDisplacementMap in="SourceGraphic" in2="flow" scale="490" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation="9"/></filter><filter id="rainbow-grain"><feTurbulence type="fractalNoise" baseFrequency=".25" numOctaves="3" stitchTiles="stitch"/></filter></defs><rect x="-300" y="-350" width="2520" height="1780" fill="url(#rainbow-colours)" filter="url(#rainbow-flow)"/><rect width="1920" height="1080" opacity=".12" filter="url(#rainbow-grain)"/></svg>`;
landing.prepend(rainbow);
const levels = new MusicLevels();
let playAttempt = null;

function updateVolumeFill() {
  slider.style.setProperty('--fill', trackFill(slider.value, slider.getBoundingClientRect().width));
}
function setVolume(percent) {
  levels.setPercent(percent);
  const safePercent = levels.percent;
  music.volume = levels.volume;
  slider.value = String(safePercent);
  updateVolumeFill();
  slider.setAttribute('aria-valuetext', `${Math.round(safePercent)} percent`);
  output.value = `${Math.round(safePercent)}%`;
  document.querySelector('.sound-entry').classList.toggle('is-muted', safePercent === 0);
  muteButton.setAttribute('aria-label', safePercent === 0 ? 'Unmute music' : 'Mute music');
  muteButton.setAttribute('aria-pressed', String(safePercent === 0));
}
new ResizeObserver(updateVolumeFill).observe(slider);
async function startMusic() {
  if (!music.paused || playAttempt || document.hidden) return;
  const attempt = {};
  playAttempt = attempt;
  try { await music.play(); }
  catch { /* Retry blocked autoplay during the next real user gesture. */ }
  finally { if (playAttempt === attempt) playAttempt = null; }
}
setVolume(levels.percent);
startMusic();
document.addEventListener('pointerdown', startMusic);
document.addEventListener('keydown', startMusic);
slider.addEventListener('input', () => { setVolume(slider.value); startMusic(); });
muteButton.addEventListener('click', () => {
  levels.toggleMute();
  setVolume(levels.percent);
  startMusic();
});
music.addEventListener('volumechange', () => {
  if (music.volume > AUDIO_PROFILES[levels.profile].maximum) setVolume(100);
});
function switchMusic(profile) {
  if (levels.profile === profile) return;
  music.pause();
  playAttempt = null;
  levels.setProfile(profile);
  music.src = AUDIO_PROFILES[profile].src;
  setVolume(levels.percent);
  music.load();
  startMusic();
}
window.addEventListener('scoops:game-ready', () => { switchMusic('game'); experience.showGame(); });
window.addEventListener('scoops:menu-ready', () => { switchMusic('menu'); experience.showMenu(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) startMusic(); });
panel.addEventListener('toggle', event => {
  const isOpen = event.newState === 'open';
  soundButton.setAttribute('aria-expanded', String(isOpen));
  if (isOpen) { updateVolumeFill(); slider.focus({ preventScroll: true }); }
});
// Delegation also covers buttons created later for customers and settings.
const glowTimers = new WeakMap();
const glow = event => {
  const button = event.target.closest('button');
  if (!button || button.disabled || (event.type === 'pointerover' && button.contains(event.relatedTarget))) return;
  clearTimeout(glowTimers.get(button));
  button.classList.add('is-pulsing');
  glowTimers.set(button, setTimeout(() => button.classList.remove('is-pulsing'), 650));
};
document.addEventListener('pointerover', glow);
document.addEventListener('click', glow);
document.querySelector('.start').addEventListener('click', () => {
  location.hash = 'modes';
});

function renderPage(moveFocus = true) {
  const isModes = location.hash === '#modes';
  if (!/^#(play|results)\//.test(location.hash)) { switchMusic('menu'); experience.showMenu(); }
  const isGame = location.hash === '#pvp' || /^#(quantity|setup|loading|play|results)\/(baby|easy|pro|usual)$/.test(location.hash);
  const wasModes = landing.classList.contains('is-mode-page');
  const isQuantity = /^#(quantity|setup)\//.test(location.hash);
  const isLoading = /^#loading\//.test(location.hash);
  landing.classList.toggle('is-quantity-page', isQuantity);
  landing.classList.toggle('is-loading-page', isLoading);
  timerEntry.hidden = !(isQuantity || isModes);
  timerButton.classList.toggle('timer-nudge', isQuantity || (isModes && ['baby', 'easy', 'pro'].includes(gameSettings.mode)));
  document.querySelector('.sound-entry').hidden = isLoading;
  panel.hidePopover();
  timerPanel.hidePopover();
  if (dialog.open) dialog.close();
  landing.classList.toggle('is-mode-page', isModes);
  landing.classList.toggle('is-game-page', isGame);
  landing.setAttribute('aria-label', isGame ? 'Scoops counting shop' : isModes ? 'Select a Scoops game mode' : 'Scoops main menu');
  document.querySelector('.title-entry').hidden = isModes || isGame;
  document.querySelector('.start-entry').hidden = isModes || isGame;
  modePage.hidden = !isModes;
  document.title = isModes ? 'Select your mode · Scoops!!!' : 'Scoops!!!';
  if (moveFocus && !isGame && wasModes !== isModes) {
    (isModes ? modeTitle : document.querySelector('.start')).focus({ preventScroll: true });
  }
}
document.querySelector('.back-home').addEventListener('click', () => { location.hash = ''; });
window.addEventListener('hashchange', () => renderPage());
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !dialog.open && !document.querySelector(':popover-open') && location.hash === '#modes') {
    location.hash = '';
  }
});

timerPanel.addEventListener('toggle', event => {
  const isOpen = event.newState === 'open';
  timerButton.setAttribute('aria-expanded', String(isOpen));
  if (isOpen) timerPanel.querySelector('[aria-pressed="true"]').focus({ preventScroll: true });
});
window.addEventListener('scoops:settingschange', () => {
  for (const [attribute, key] of [['pvpDuration', 'pvpWaitSeconds'], ['roundMinutes', 'roundMinutes']]) {
    for (const button of timerPanel.querySelectorAll('button')) if (attribute in button.dataset) {
      button.setAttribute('aria-pressed', String(Number(button.dataset[attribute]) === (gameSettings[key] || 0)));
    }
  }
});
let patienceDuration = 30;
function setPatience(seconds) {
    if (seconds) patienceDuration = seconds;
    timerPanel.querySelector('.patience-durations').hidden = !seconds;
    for (const option of timerPanel.querySelectorAll('[data-patience-enabled]')) option.setAttribute('aria-pressed', String((option.dataset.patienceEnabled === 'true') === Boolean(seconds)));
    gameSettings.customerWaitSeconds = seconds || null;
    for (const option of timerPanel.querySelectorAll('[data-duration]')) {
      option.setAttribute('aria-pressed', String(Number(option.dataset.duration) === patienceDuration));
    }
    const badge = document.querySelector('.timer-badge');
    badge.hidden = seconds === 0;
    badge.textContent = patienceLabel(seconds);
    timerButton.setAttribute('aria-label', `Set customer wait time, currently ${patienceLabel(seconds)}`);
    document.querySelector('#timer-help').textContent = seconds
      ? `Each customer will wait up to ${patienceLabel(seconds)} after arriving.`
      : 'Off means customers wait without a time limit.';
    window.dispatchEvent(new CustomEvent('scoops:settingschange', { detail: { ...gameSettings } }));
}
for (const button of document.querySelectorAll('[data-patience-enabled]')) {
  button.addEventListener('click', () => setPatience(button.dataset.patienceEnabled === 'true' ? patienceDuration : 0));
}
for (const [attribute, key] of [['pvpDuration', 'pvpWaitSeconds'], ['roundMinutes', 'roundMinutes']]) {
  const buttons = [...timerPanel.querySelectorAll('button')].filter(button => attribute in button.dataset);
  for (const button of buttons) button.addEventListener('click', () => {
    gameSettings[key] = Number(button.dataset[attribute]) || null;
    for (const option of buttons) option.setAttribute('aria-pressed', String(option === button));
    window.dispatchEvent(new CustomEvent('scoops:settingschange', { detail: { ...gameSettings } }));
  });
}
for (const button of document.querySelectorAll('[data-duration]')) {
  button.addEventListener('click', () => setPatience(Number(button.dataset.duration)));
}

for (const button of document.querySelectorAll('[data-mode]')) {
  button.addEventListener('click', event => {
    if (isNavigating()) return;
    panel.hidePopover();
    timerPanel.hidePopover();
    gameSettings.mode = button.dataset.mode;
    timerButton.classList.toggle('timer-nudge', ['baby', 'easy', 'pro'].includes(gameSettings.mode));
    for (const option of document.querySelectorAll('[data-mode]')) {
      option.setAttribute('aria-pressed', String(option === button));
    }
    const name = modeNames[gameSettings.mode];
    document.querySelector('#selection-status').textContent = `${name} mode selected.`;
    // Each game mode handles its own start event.
    const startEvent = new CustomEvent('scoops:start', { cancelable: true, detail: { ...gameSettings } });
    if (window.dispatchEvent(startEvent)) {
      dialog.querySelector('.eyebrow').textContent = `${name.toUpperCase()} MODE SELECTED`;
      document.querySelector('#coming-description').textContent = gameSettings.pvpWaitSeconds
        ? `The game is on its way. Your PvP customers will wait up to ${patienceLabel(gameSettings.pvpWaitSeconds)} each.`
        : 'The game is on its way. Your customers will wait without a time limit.';
      dialog.querySelector('.back-button').textContent = 'Back to modes';
      dialog.showModal();
    }
  });
}
for (const option of document.querySelectorAll('[data-practice]')) {
  option.addEventListener('click', () => {
    gameSettings.practice = option.dataset.practice;
    for (const item of document.querySelectorAll('[data-practice]')) item.setAttribute('aria-pressed', String(item === option));
    window.dispatchEvent(new CustomEvent('scoops:settingschange', { detail: { ...gameSettings } }));
  });
}
renderPage(false);
initGame({ settings: gameSettings });
initPvp({ settings: gameSettings });
dialog.addEventListener('click', event => {
  const rect = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
});
function updateMotion() {
  if (reducedMotion.matches || document.hidden) waves.pauseAnimations();
  else waves.unpauseAnimations();
}
reducedMotion.addEventListener('change', updateMotion);
document.addEventListener('visibilitychange', updateMotion);
updateMotion();
