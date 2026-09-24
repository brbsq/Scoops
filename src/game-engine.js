export const MODES = ['baby', 'easy', 'pro'];
export const WAVE_SIZES = { baby: 3, easy: 4, pro: 5 };
export const RANGES = { '1-10': [1, 10], '11-20': [11, 20], '1-20': [1, 20] };
export const SCOOP_LIMIT = 25;
export const FEEDBACK_MS = 4000;
export const ARRIVAL_MS = 2000;
export const BREAK_MS = 2000;
export const FLAVOURS = ['strawberry', 'vanilla', 'mint', 'blueberry', 'mango'];

export function orderSet(range = '11-20', random = Math.random) {
  const [min, max] = RANGES[range] || RANGES['11-20'];
  const orders = Array.from({ length: max - min + 1 }, (_, index) => index + min);
  for (let i = orders.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [orders[i], orders[j]] = [orders[j], orders[i]];
  }
  return orders;
}
export function patienceTone(remainingMs, totalMs) {
  if (remainingMs === null) return 'off';
  if (remainingMs <= 10000) return 'red';
  return remainingMs <= totalMs / 2 ? 'yellow' : 'normal';
}

export class CountingGame {
  constructor({ mode, range = '11-20', practice = 'standard', customerWaitSeconds = null, roundMinutes = null }, { now = () => performance.now(), random = Math.random } = {}) {
    if (mode === 'usual') mode = 'pro';
    if (!MODES.includes(mode)) throw new Error('Unknown game mode');
    this.now = now;
    this.random = random;
    this.state = {
      phase: 'setup', mode, range: RANGES[range] ? range : '11-20',
      practice: practice === 'endless' ? 'endless' : 'standard',
      customerWaitSeconds: [15, 20, 30, 45, 60].includes(customerWaitSeconds) ? customerWaitSeconds : null,
      roundRemainingMs: [1, 2, 3, 4, 5].includes(roundMinutes) ? roundMinutes * 60000 : null,
      endReason: null,
      customers: [], selectedId: null, wave: 0, waveSize: 0, spawned: 0,
      arrivalsLeft: 0, arrivalMs: null, breakMs: null, paused: false,
      results: { correct: 0, missed: 0 }, history: [],
    };
    const [min, max] = RANGES[this.state.range];
    this.total = max - min + 1;
    this.queue = [];
    this.lastTime = now();
  }
  start() {
    if (this.state.phase !== 'setup') return;
    this.state.phase = 'playing';
    this.beginWave();
    this.lastTime = this.now();
  }
  beginWave() {
    const s = this.state;
    const available = s.practice === 'endless' ? Infinity : this.total - s.spawned;
    if (!available) { s.phase = 'results'; return; }
    s.wave++;
    s.waveSize = Math.min(WAVE_SIZES[s.mode], available);
    s.arrivalsLeft = s.waveSize;
    s.breakMs = null;
    this.arrive();
  }
  arrive() {
    const s = this.state;
    if (!this.queue.length) this.queue = orderSet(s.range, this.random);
    const customer = {
      id: ++s.spawned, target: this.queue.shift(), scoops: [], phase: 'waiting',
      remainingMs: s.customerWaitSeconds === null ? null : s.customerWaitSeconds * 1000,
      feedbackMs: null, reaction: 'neutral', effect: null, outcome: null,
    };
    s.customers.push(customer);
    s.arrivalsLeft--;
    s.arrivalMs = s.arrivalsLeft > 0 ? ARRIVAL_MS : null;
    if (!this.selected || this.selected.phase !== 'waiting') s.selectedId = customer.id;
  }
  get selected() { return this.state.customers.find(customer => customer.id === this.state.selectedId); }
  // Advance to each event boundary, so background throttling cannot reorder arrivals,
  // deadlines or departures. Visibility pausing freezes the entire simulation clock.
  tick(time = this.now()) {
    let elapsed = Math.max(0, time - this.lastTime);
    this.lastTime = time;
    const s = this.state;
    if (s.paused || s.phase !== 'playing') return;
    while (elapsed > 0 && s.phase === 'playing') {
      const clocks = [s.roundRemainingMs, s.arrivalMs, s.breakMs, ...s.customers.map(c => c.phase === 'waiting' ? c.remainingMs : c.feedbackMs)].filter(v => v !== null);
      const step = Math.min(elapsed, ...clocks);
      if (s.roundRemainingMs !== null) s.roundRemainingMs -= step;
      if (s.arrivalMs !== null) s.arrivalMs -= step;
      if (s.breakMs !== null) s.breakMs -= step;
      for (const c of s.customers) {
        if (c.phase === 'waiting' && c.remainingMs !== null) c.remainingMs -= step;
        if (c.phase === 'feedback') c.feedbackMs -= step;
      }
      elapsed -= step;
      // A round deadline wins over same-instant submissions and customer timeouts.
      // Unresolved bowls are excluded, just as when the player selects Finish.
      if (s.roundRemainingMs === 0) { s.phase = 'results'; s.endReason = 'round-time'; break; }
      for (const c of s.customers) {
        if (c.phase === 'waiting' && c.remainingMs === 0) this.resolve(c, 'timeout');
      }
      s.customers = s.customers.filter(c => c.feedbackMs !== 0);
      if (s.arrivalMs === 0) this.arrive();
      if (s.breakMs === 0) this.beginWave();
      if (!this.selected) this.selectWaiting();
      if (!s.customers.length && !s.arrivalsLeft && s.breakMs === null) {
        if (s.practice === 'standard' && s.spawned === this.total) s.phase = 'results';
        else s.breakMs = BREAK_MS;
      }
    }
  }
  selectWaiting() { this.state.selectedId = this.state.customers.find(c => c.phase === 'waiting')?.id ?? null; }
  select(id) { this.tick(); if (this.state.customers.some(c => c.id === id)) this.state.selectedId = id; }
  editable(id) { return !this.state.paused && this.state.phase === 'playing' ? this.state.customers.find(c => c.id === id && c.phase === 'waiting') : null; }
  add(id = this.state.selectedId) {
    this.tick();
    const c = this.editable(id);
    if (c && c.scoops.length < SCOOP_LIMIT) c.scoops.push(FLAVOURS[(c.scoops.length + c.id - 1) % FLAVOURS.length]);
  }
  remove(id = this.state.selectedId) { this.tick(); this.editable(id)?.scoops.pop(); }
  submit(id = this.state.selectedId) {
    this.tick();
    const c = this.editable(id);
    if (c) this.resolve(c, c.scoops.length === c.target ? 'correct' : c.scoops.length < c.target ? 'low' : 'high');
  }
  resolve(c, outcome) {
    if (c.phase !== 'waiting') return;
    Object.assign(c, {
      phase: 'feedback', outcome, feedbackMs: FEEDBACK_MS,
      reaction: outcome === 'correct' ? 'happy' : outcome === 'timeout' ? 'sad' : this.random() < .5 ? 'sad' : 'angry',
      effect: outcome === 'correct' ? this.random() < .5 ? 'hearts' : 'sparkles' : 'frown',
    });
    this.state.results[outcome === 'correct' ? 'correct' : 'missed']++;
    this.state.history.push({ id: c.id, target: c.target, served: c.scoops.length, outcome });
    if (this.state.selectedId === c.id) this.selectWaiting();
  }
  setPaused(paused) { this.tick(); this.state.paused = paused; }
  finish() { this.tick(); if (this.state.phase === 'playing') this.state.phase = 'results'; }
}
