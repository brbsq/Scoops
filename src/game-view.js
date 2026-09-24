import { experience } from './experience.js';
import { CountingGame, MODES, SCOOP_LIMIT, WAVE_SIZES, patienceTone } from './game-engine.js';
import { playLayout, servingOpacity } from './play-layout.js';
import { settleWithin } from './loading.js';
import { bowlMarkup, scoopMarkup } from './bowl.js';
import { words, timeLabel } from './words.js';
import { characters, characterMarkup } from './characters.js';
import { dissolveNavigate, isNavigating } from './navigation.js';

const modeNames = { baby: 'Baby', easy: 'Easy', pro: 'PRO' };
const messages = { correct: 'Thank you', low: 'Too few scoops!', high: 'Too many scoops!', timeout: 'Time’s up!' };
const quantityAssets = ['title', 'orb-one', 'orb-two', 'orb-three', '1-10', '11-20', '1-20', 'control-disc', 'timer', 'volume'].map(name => `/assets/quantity/${name}.png`);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const order = c => `I want ${words(c.target)} ${c.target === 1 ? 'scoop' : 'scoops'}, please.`;
const characterFor = c => characters[(c.id - 1) % characters.length];

async function preload() {
  const custom = characters.flatMap(character => Object.values(character.artwork)).filter(Boolean);
  await Promise.allSettled([
    document.fonts.load('48px Modak'), document.fonts.load('20px "Days One"'),
    ...[...quantityAssets, ...custom].map(async src => {
      const image = new Image();
      image.src = src;
      try { await image.decode(); }
      catch {
        // A missing expression drawing falls back to neutral art or the SVG placeholder.
        for (const character of characters) for (const key of Object.keys(character.artwork)) if (character.artwork[key] === src) character.artwork[key] = null;
      }
    }),
  ]);
}

export function initGame({ settings }) {
  const root = document.createElement('section');
  root.className = 'game-page';
  root.hidden = true;
  document.querySelector('.landing').append(root);
  let mode = 'baby';
  let range = '11-20';
  let game = null;
  let screen = '';
  let loadGeneration = 0;
  let boardKey = '';
  let bowlKey = '';
  let revealPending = false;
  let loadingGate = Promise.resolve(true);
  let lastSubmissionAt = -Infinity;
  const actionTargets = new WeakMap();
  const exitDialog = document.createElement('dialog');
  exitDialog.className = 'exit-dialog glass';
  exitDialog.setAttribute('aria-labelledby', 'exit-title');
  exitDialog.setAttribute('aria-describedby', 'exit-description');
  exitDialog.innerHTML = `<span class="exit-symbol" aria-hidden="true">♡</span><h2 id="exit-title">Exit game?</h2><p id="exit-description"></p><div class="exit-actions"><button class="shop-button" data-exit="cancel" autofocus>Cancel</button><button class="shop-button primary" data-exit="confirm">Exit game</button></div>`;
  document.body.append(exitDialog);
  let exitIntent = null;
  let exitTrigger = null;
  let acceptedExit = false;
  const landscape = matchMedia('(orientation: landscape)');
  const orientationGuard = document.createElement('section');
  orientationGuard.className = 'orientation-guard';
  orientationGuard.hidden = true;
  orientationGuard.setAttribute('aria-labelledby', 'orientation-title');
  orientationGuard.innerHTML = `<div class="rotate-device" aria-hidden="true">↻<span></span></div><h2 id="orientation-title">Turn your device sideways</h2><p>Play in landscape. Your game waits while you rotate.</p><button class="shop-button" data-orientation-exit>Exit game</button>`;
  document.body.append(orientationGuard);
  function fitPlay() {
    const active = screen === 'play';
    root.classList.toggle('fitted-play', active);
    document.body.classList.toggle('playing-fitted', active);
    if (!active) return;
    const layout = playLayout(innerWidth, innerHeight);
    root.classList.toggle('compact-play', layout.compact);
    root.style.setProperty('--play-width', `${layout.width}px`);
    root.style.setProperty('--play-height', `${layout.height}px`);
    root.style.setProperty('--play-scale', layout.scale);
  }
  window.addEventListener('resize', fitPlay);
  function updateOrientationUI() {
    fitPlay();
    const blocked = screen === 'play' && !landscape.matches;
    orientationGuard.hidden = !blocked;
    document.body.classList.toggle('has-orientation-guard', blocked);
    root.inert = blocked;
    root.classList.toggle('portrait-blocked', blocked);
  }
  function syncGamePause() {
    updateOrientationUI();
    if (!game) return;
    const paused = document.hidden || exitDialog.open || revealPending || !landscape.matches;
    if (game.state.phase === 'setup' && screen === 'play' && !paused) {
      game.start();
      window.dispatchEvent(new CustomEvent('scoops:game-ready'));
    }
    game.setPaused(paused);
  }
  orientationGuard.querySelector('button').addEventListener('click', event => requestExit('exit', event.currentTarget));
  landscape.addEventListener('change', () => { syncGamePause(); render(); });
  function requestExit(intent, trigger) {
    if (exitDialog.open || !game) return;
    game.setPaused(true);
    render();
    exitIntent = intent;
    exitTrigger = trigger;
    acceptedExit = false;
    const finish = intent === 'finish';
    exitDialog.querySelector('#exit-title').textContent = finish ? 'Finish this round?' : 'Exit game?';
    exitDialog.querySelector('#exit-description').textContent = finish
      ? 'See your results now? Waiting customers will not be counted.'
      : screen === 'results' ? 'Return to the mode menu? These results are for this game only.' : 'Return to the mode menu? Your game is paused while you decide.';
    exitDialog.querySelector('[data-exit="confirm"]').textContent = finish ? 'Finish round' : 'Exit game';
    exitDialog.showModal();
    exitDialog.querySelector('[data-exit="cancel"]').focus();
  }
  exitDialog.addEventListener('close', () => {
    if (!acceptedExit) syncGamePause();
    if (exitTrigger?.isConnected && !acceptedExit) exitTrigger.focus({ preventScroll: true });
    exitIntent = null;
    render();
  });
  exitDialog.addEventListener('click', event => {
    const action = event.target.closest('[data-exit]')?.dataset.exit;
    if (!action) return;
    if (action === 'cancel') { exitDialog.close(); return; }
    acceptedExit = true;
    if (exitIntent === 'finish') { game?.finish(); exitDialog.close(); render(); }
    else { loadGeneration++; game = null; exitDialog.close(); dissolveNavigate('modes'); }
  });
  const button = (action, label, style = '') => `<button type="button" class="shop-button ${style}" data-action="${action}">${label}</button>`;
  const header = subtitle => `<header class="shop-header">${button('back', '‹ <span>Exit game</span>', 'quiet')}<div class="shop-brand"><img src="/assets/scoops.png" alt="Scoops!!!"><span>${subtitle}</span></div><span class="header-spacer" aria-hidden="true"></span></header>`;
  const focusHeading = () => { if (!isNavigating()) root.querySelector('h1')?.focus({ preventScroll: true }); };

  function quantity() {
    screen = 'quantity';
    fitPlay();
    root.innerHTML = `<button class="back-home" data-action="back" aria-label="Back to modes">‹ <span>Back</span></button><h1 class="quantity-title" tabindex="-1"><img src="/assets/quantity/title.png" alt="Select your toppings."></h1><div class="quantity-options" role="group" aria-label="Choose the number range">${[['1-10', 'one', 'One through ten'], ['11-20', 'two', 'Eleven through twenty'], ['1-20', 'three', 'One through twenty']].map(([value, orb, label], index) => `<button class="quantity-button interactive" data-action="range" data-range="${value}" aria-label="${label}" style="--entry-order:${index}"><img class="quantity-orb" src="/assets/quantity/orb-${orb}.png" alt=""><img class="quantity-label" src="/assets/quantity/${value}.png" alt="" aria-hidden="true"></button>`).join('')}</div>`;
    focusHeading();
  }
  async function loading(token) {
    screen = 'loading';
    fitPlay();
    root.innerHTML = `<button class="back-home loading-back" data-action="back" aria-label="Back to modes">‹ <span>Back</span></button><h1 class="loading-title" tabindex="-1" aria-label="Loading"><span>Loading</span><span class="loading-dots" aria-hidden="true"><i>●</i><i>●</i><i>●</i></span></h1><p class="sr-only" role="status">Preparing the ice cream shop.</p>`;
    focusHeading();
    const assetsReady = settleWithin(Promise.all([preload(), experience.prepare()]), 8000);
    await loadingGate;
    // Count the minimum display time only once the dissolve has revealed Loading.
    await Promise.all([assetsReady, wait(1000)]);
    if (token !== loadGeneration || screen !== 'loading') return;
    game = new CountingGame({ mode, range, practice: settings.practice, customerWaitSeconds: settings.customerWaitSeconds, roundMinutes: settings.roundMinutes });
    revealPending = true;
    const revealed = await dissolveNavigate(`play/${mode}`, { replace: true });
    if (!revealed || token !== loadGeneration || !game) return;
    revealPending = false;
    syncGamePause();
    render();
  }
  function showPlay() {
    screen = 'play';
    boardKey = '';
    bowlKey = '';
    root.innerHTML = ` <header class="shop-header">${button('back', '‹ <span>Exit game</span>', 'quiet')}<div class="shop-brand"><img src="/assets/scoops.png" alt="Scoops!!!"><span>${modeNames[mode].toUpperCase()} MODE</span></div><div class="session-strip"><h1 class="wave-title" tabindex="-1">The shop is opening.</h1><p class="round-clock" aria-label="Round time remaining" hidden></p>${button('finish', 'Finish', 'quiet')}</div></header>
      <section class="customer-wave" aria-label="Waiting customers"><div class="customer-grid" style="--wave-size:${WAVE_SIZES[mode]}"></div><p class="wave-message" role="status"></p></section>
      <section class="bowl-station glass" aria-label="Ice cream preparation"><div class="bowl-info"><p class="selected-order"></p><h2 class="bowl-owner">Your glass bowl</h2><span class="bowl-reaction" role="status"></span></div><div class="bowl-workspace"><div class="served-popup" role="status" aria-live="polite" hidden></div><div class="glass-bowl-display" role="img" aria-label="Ice cream in a transparent bowl">${bowlMarkup()}</div><svg class="serving-overlay" viewBox="0 0 440 330" aria-hidden="true" hidden></svg></div><div class="bowl-controls"><div class="scoop-actions">${button('remove', '<span aria-hidden="true">−</span><span class="sr-only">Remove a scoop</span>', 'remove-scoop')}${button('add', '<span aria-hidden="true">+</span><span class="sr-only">Add a scoop</span>', 'add-scoop')}</div>${button('submit', 'Here you are! <span aria-hidden="true">♡</span>', 'primary wide serve-button')}</div></section><p class="sr-only" id="shop-announcement" role="status" aria-live="polite"></p>`;
    focusHeading();
  }
  function showResults() {
    const s = game.state;
    screen = 'results';
    fitPlay();
    root.innerHTML = `${header('A LITTLE MORE CONFIDENT')}<div class="results-layout"><div class="results-animal">${characterMarkup(characters[1], 'happy', 'hearts')}</div><span class="shop-kicker">${s.endReason === 'round-time' ? 'Round complete — time for a little break' : 'The shop is taking a little break'}</span><h1 tabindex="-1">Lovely scooping!</h1><p>You finished serving ${words(s.results.correct + s.results.missed)} customers.</p><div class="results-cards"><div class="glass"><strong>${words(s.results.correct)}</strong><span>Served just right</span></div><div class="glass"><strong>${words(s.results.missed)}</strong><span>To practise next time</span></div></div><p class="results-encouragement">Every scoop is a little more practice.</p><div class="results-actions">${button('again', 'Play again', 'primary')}${button('back', 'Exit game', 'quiet')}</div></div>`;
    focusHeading();
  }
  function customerCard(c) {
    const character = characterFor(c);
    return `<button type="button" class="customer-tile" style="--dialog-colour:${['#ffe2eb', '#e0efff', '#fff0c5', '#e4defa', '#d7f3df'][(c.id - 1) % 5]}" data-customer="${c.id}" aria-pressed="false" aria-label="${character.name}, customer ${words(c.id)}"><span class="customer-order">“${order(c)}”</span><span class="customer-portrait"><span class="ring-position" style="--head-x:${character.headAnchor.x}%;--head-y:${character.headAnchor.y}%"><span class="patience-ring" role="progressbar" aria-label="${character.name}’s patience" aria-valuemin="0" aria-valuemax="100"><svg viewBox="0 0 44 44" aria-hidden="true"><circle class="ring-track" cx="22" cy="22" r="18"/><circle class="ring-fill" cx="22" cy="22" r="18" pathLength="100"/></svg><span aria-hidden="true">♡</span></span></span><span class="portrait-art"></span></span><span class="tile-counter"><span class="customer-name">${character.name}</span><span class="tile-status"></span></span></button>`;
  }
  function updatePlay() {
    const s = game.state;
    root.classList.toggle('is-paused', s.paused);
    const grid = root.querySelector('.customer-grid');
    const roundClock = root.querySelector('.round-clock');
    roundClock.hidden = s.roundRemainingMs === null;
    if (s.roundRemainingMs !== null) roundClock.textContent = `${timeLabel(s.roundRemainingMs)} left`;
    root.querySelector('.wave-title').textContent = s.wave ? `Wave ${words(s.wave)}` : 'The shop is opening.';
    const ids = s.customers.map(c => c.id).join(':');
    if (boardKey !== ids) {
      const activeId = document.activeElement?.dataset.customer;
      for (const tile of grid.querySelectorAll('[data-customer]')) if (!s.customers.some(c => String(c.id) === tile.dataset.customer)) tile.remove();
      for (const c of s.customers) if (!grid.querySelector(`[data-customer="${c.id}"]`)) grid.insertAdjacentHTML('beforeend', customerCard(c));
      boardKey = ids;
      if (activeId && !s.customers.some(c => String(c.id) === activeId)) grid.querySelector(`[data-customer="${s.selectedId}"]`)?.focus({ preventScroll: true });
    }
    for (const c of s.customers) {
      const tile = grid.querySelector(`[data-customer="${c.id}"]`);
      tile.setAttribute('aria-pressed', String(c.id === s.selectedId));
      tile.classList.toggle('is-feedback', c.phase === 'feedback');
      tile.classList.toggle('is-happy', c.outcome === 'correct');
      tile.classList.toggle('is-departing', c.phase === 'feedback' && c.feedbackMs <= 650);
      const art = tile.querySelector('.portrait-art');
      const artKey = `${c.reaction}:${c.effect}`;
      if (art.dataset.key !== artKey) { art.innerHTML = characterMarkup(characterFor(c), c.reaction, c.effect); art.dataset.key = artKey; }
      const status = c.phase === 'feedback' ? messages[c.outcome] : c.id === s.selectedId ? 'Your customer' : 'Waiting';
      if (tile.querySelector('.tile-status').textContent !== status) tile.querySelector('.tile-status').textContent = status;
      const ring = tile.querySelector('.patience-ring');
      ring.hidden = c.remainingMs === null;
      if (c.remainingMs !== null) {
        const percent = c.remainingMs / (s.customerWaitSeconds * 1000) * 100;
        ring.className = `patience-ring tone-${patienceTone(c.remainingMs, s.customerWaitSeconds * 1000)}`;
        ring.querySelector('.ring-fill').style.strokeDashoffset = String(100 - percent);
        ring.setAttribute('aria-valuenow', String(Math.round(percent)));
        ring.setAttribute('aria-valuetext', `${words(Math.ceil(c.remainingMs / 1000))} seconds remaining`);
      }
    }
    const waitingMessage = s.breakMs !== null ? 'A fresh wave is on its way…' : !s.customers.length ? 'Welcome to the shop.' : '';
    root.querySelector('.wave-message').textContent = waitingMessage;
    root.querySelector('.wave-message').hidden = !waitingMessage;
    const c = game.selected;
    const key = `${c?.id}:${c?.phase}:${c?.scoops.join(',')}:${c?.outcome}`;
    if (bowlKey !== key) {
      bowlKey = key;
      root.querySelector('.bowl-owner').textContent = c ? `${characterFor(c).name}’s bowl` : 'Your glass bowl';
      root.querySelector('.selected-order').textContent = c ? `“${order(c)}”` : 'More smiles are on their way.';
      root.querySelector('.bowl-reaction').textContent = c?.outcome ? messages[c.outcome] : '';
      root.querySelector('.scoop-pile').innerHTML = scoopMarkup(c?.phase === 'waiting' ? c.scoops : []);
      root.querySelector('.glass-bowl-display').classList.toggle('is-empty', !c);
    }
    for (const action of ['add', 'remove', 'submit']) root.querySelector(`[data-action="${action}"]`).disabled = !c || c.phase !== 'waiting' || s.phase !== 'playing' || (action === 'add' && c.scoops.length === SCOOP_LIMIT) || (action === 'remove' && !c.scoops.length);
    const lastServed = s.history.findLast(entry => entry.outcome !== 'timeout');
    const served = s.customers.find(customer => customer.id === lastServed?.id && customer.phase === 'feedback');
    const overlay = root.querySelector('.serving-overlay');
    overlay.toggleAttribute('hidden', !served || servingOpacity(served.feedbackMs) === 0);
    if (served) {
      if (overlay.dataset.customer !== String(served.id)) {
        overlay.dataset.customer = String(served.id);
        overlay.innerHTML = `<g clip-path="url(#bowl-interior)">${scoopMarkup(served.scoops)}</g>`;
      }
      overlay.style.opacity = servingOpacity(served.feedbackMs);
    }
    const popup = root.querySelector('.served-popup');
    popup.hidden = !served;
    if (served) {
      const label = `${characterFor(served).name}: ${words(served.scoops.length)} ${served.scoops.length === 1 ? 'scoop' : 'scoops'}`;
      if (popup.textContent !== label) popup.textContent = label;
    }
    const last = s.history.at(-1);
    const announcement = last ? `${characterFor(last).name}: ${messages[last.outcome]}` : '';
    if (root.querySelector('#shop-announcement').textContent !== announcement) root.querySelector('#shop-announcement').textContent = announcement;
  }
  function render() {
    updateOrientationUI();
    if (!game || root.hidden) return;
    if (game.state.phase === 'results') {
      if (location.hash !== `#results/${mode}`) location.replace(`#results/${mode}`);
      if (screen !== 'results') { location.replace(`#results/${mode}`); showResults(); }
    } else {
      if (screen !== 'play') showPlay();
      updatePlay();
    }
  }
  function route() {
    if (exitDialog.open) { acceptedExit = true; exitDialog.close(); }
    const match = location.hash.match(/^#(quantity|setup|loading|play|results)\/(baby|easy|pro|usual)$/);
    root.hidden = !match;
    if (!match) { loadGeneration++; game = null; screen = ''; revealPending = false; fitPlay(); return; }
    if (match[2] === 'usual') { location.replace(`#${match[1]}/pro`); return; }
    mode = match[2];
    settings.mode = mode;
    document.title = `${modeNames[mode]} mode · Scoops!!!`;
    const page = match[1];
    if (page === 'quantity' || page === 'setup') {
      loadGeneration++; game = null; revealPending = false;
      if (page === 'setup') { location.replace(`#quantity/${mode}`); return; }
      quantity();
    } else if (page === 'loading' && screen === 'quantity') {
      loading(++loadGeneration);
    } else if (game && game.state.mode === mode && (page === 'play' || page === 'results')) {
      if (page === 'play' && !revealPending && game.state.phase === 'setup') { location.replace(`#quantity/${mode}`); return; }
      if (page === 'results' && game.state.phase !== 'results') { loadGeneration++; game = null; location.replace(`#quantity/${mode}`); return; }
      render();
    } else { loadGeneration++; game = null; location.replace(`#quantity/${mode}`); }
  }
  // Capture the intended customer at press time, before a deadline can auto-select another.
  const captureTarget = event => {
    if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
    const control = event.target.closest('button[data-action]');
    if (!control || !['add', 'remove', 'submit'].includes(control.dataset.action)) return;
    if (event.repeat) { event.preventDefault(); return; }
    actionTargets.set(control, game?.state.selectedId ?? null);
  };
  root.addEventListener('pointerdown', captureTarget);
  root.addEventListener('keydown', captureTarget);
  root.addEventListener('click', event => {
    if (isNavigating()) return;
    const tile = event.target.closest('[data-customer]');
    if (tile && game) { game.select(Number(tile.dataset.customer)); render(); return; }
    const control = event.target.closest('button[data-action]');
    if (!control || control.disabled) return;
    const { action } = control.dataset;
    if (action === 'back') {
      if (game && ['play', 'results'].includes(screen)) requestExit('exit', control);
      else { loadGeneration++; game = null; dissolveNavigate('modes'); }
    }
    if (action === 'range') { range = control.dataset.range; settings.range = range; window.dispatchEvent(new CustomEvent('scoops:settingschange', { detail: { ...settings } })); loadingGate = dissolveNavigate(`loading/${mode}`); }
    if (action === 'again') { dissolveNavigate(`quantity/${mode}`); }
    if (['add', 'remove', 'submit'].includes(action) && game) {
      // A double-click must not accidentally submit the next auto-selected bowl.
      if (action === 'submit' && performance.now() - lastSubmissionAt < 350) return;
      if (action === 'submit') lastSubmissionAt = performance.now();
      const customerId = actionTargets.has(control) ? actionTargets.get(control) : game.state.selectedId;
      actionTargets.delete(control);
      game[action](customerId); render();
    }
    if (action === 'finish' && game) requestExit('finish', control);
  });
  window.addEventListener('scoops:start', event => {
    if (!MODES.includes(event.detail.mode)) return;
    event.preventDefault();
    if (!isNavigating()) dissolveNavigate(`quantity/${event.detail.mode}`);
  });
  const handleRoute = () => { route(); syncGamePause(); render(); };
  window.addEventListener('hashchange', handleRoute);
  document.addEventListener('visibilitychange', () => { syncGamePause(); render(); });
  setInterval(() => { if (game && !root.hidden && !document.hidden && !revealPending) { game.tick(); render(); } }, 100);
  handleRoute();
}
