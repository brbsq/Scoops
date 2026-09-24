import test from 'node:test';
import assert from 'node:assert/strict';
import { CountingGame, orderSet, SCOOP_LIMIT, WAVE_SIZES, patienceTone, FLAVOURS } from '../src/game-engine.js';
import { words, timeLabel, patienceLabel } from '../src/words.js';
import { characterMarkup, characters } from '../src/characters.js';
import { audioVolume, trackFill, DEFAULT_VOLUME_PERCENT, AUDIO_PROFILES, MusicLevels } from '../src/audio-settings.js';

function fixture({ mode = 'baby', patience = null, practice = 'standard', range = '11-20', random = () => .2, roundMinutes = null } = {}) {
  let time = 0;
  const game = new CountingGame({ mode, customerWaitSeconds: patience, practice, range, roundMinutes }, { now: () => time, random });
  game.start();
  return { game, s: game.state, advance(ms) { time += ms; game.tick(); }, elapse(ms) { time += ms; } };
}
function fill(game, id = game.state.selectedId, count = game.state.customers.find(c => c.id === id).target) { for (let i = 0; i < count; i++) game.add(id); }
function complete(f, customers) {
  for (let guard = 0; guard < 1000 && f.s.history.length < customers; guard++) {
    for (const c of f.s.customers) {
      if (c.phase === 'waiting' && f.s.history.length < customers) { fill(f.game, c.id); f.game.submit(c.id); }
    }
    f.advance(2000);
  }
}

test('number words cover orders, singular quantities and long results', () => {
  assert.deepEqual(Array.from({ length: 10 }, (_, i) => words(i + 11)), ['eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty']);
  assert.equal(words(1), 'one'); assert.equal(words(1024), 'one thousand twenty-four');
});
for (const [range, min, max] of [['1-10', 1, 10], ['11-20', 11, 20], ['1-20', 1, 20]]) {
  test(`${range} covers every target once and finishes after every departure`, () => {
    const f = fixture({ range });
    assert.deepEqual(orderSet(range).sort((a, b) => a - b), Array.from({ length: max - min + 1 }, (_, i) => min + i));
    complete(f, max - min + 1); f.advance(4000);
    assert.equal(f.s.phase, 'results'); assert.equal(f.s.results.correct, max - min + 1);
    assert.deepEqual(f.s.history.map(c => c.target).sort((a, b) => a - b), Array.from({ length: max - min + 1 }, (_, i) => min + i));
    assert.equal(f.s.results.missed, 0);
  });
}
for (const mode of ['baby', 'easy', 'pro']) {
  test(`${mode} staggers its wave and never refills an empty place in that wave`, () => {
    const f = fixture({ mode });
    assert.equal(f.s.customers.length, 1);
    f.advance(1999); assert.equal(f.s.customers.length, 1);
    f.advance(1); assert.equal(f.s.customers.length, 2);
    f.advance(2000 * (WAVE_SIZES[mode] - 2));
    assert.equal(f.s.customers.length, WAVE_SIZES[mode]);
    const id = f.s.customers[0].id;
    f.game.submit(id); f.advance(4000);
    assert.equal(f.s.customers.some(c => c.id === id), false);
    assert.equal(f.s.wave, 1); assert.equal(f.s.spawned, WAVE_SIZES[mode]);
  });
  test(`${mode} leaves after a wrong answer with no retry`, () => {
    const f = fixture({ mode }); const first = f.game.selected;
    f.game.submit(first.id); assert.equal(first.outcome, 'low');
    f.game.submit(first.id); f.game.add(first.id);
    assert.equal(f.s.results.missed, 1); assert.equal(first.scoops.length, 0);
    f.advance(4000); assert.ok(!f.s.customers.includes(first));
  });
}

test('bowls retain independent scoop colours and quantities across selection', () => {
  const f = fixture(); const first = f.game.selected;
  fill(f.game, first.id, 7); const colours = [...first.scoops];
  f.advance(2000); const second = f.s.customers[1];
  f.game.select(second.id); fill(f.game, second.id, 3); f.game.select(first.id);
  assert.deepEqual(first.scoops, colours); assert.equal(second.scoops.length, 3);
  assert.deepEqual(new Set(first.scoops), new Set(FLAVOURS));
  f.game.remove(first.id); assert.equal(first.scoops.length, 6); assert.equal(second.scoops.length, 3);
});
test('empty, underfilled, overfilled, exact and full bowls check quantity only', () => {
  for (const [count, outcome] of [[0, 'low'], [5, 'low'], [25, 'high']]) {
    const f = fixture(); const c = f.game.selected;
    fill(f.game, c.id, count); f.game.submit(c.id); assert.equal(c.outcome, outcome);
  }
  const f = fixture(); const c = f.game.selected;
  fill(f.game, c.id, 40); assert.equal(c.scoops.length, SCOOP_LIMIT);
  for (let i = 0; i < 30; i++) f.game.remove(c.id);
  assert.equal(c.scoops.length, 0); fill(f.game, c.id); f.game.submit(c.id);
  assert.equal(c.outcome, 'correct'); assert.equal(c.reaction, 'happy');
});
test('submitting switches to another waiting bowl without freezing that customer', () => {
  const f = fixture({ patience: 30 }); f.advance(4000);
  const [first, second] = f.s.customers; const secondRemaining = second.remainingMs;
  f.game.submit(first.id); assert.equal(f.s.selectedId, second.id);
  f.game.add(second.id); f.advance(1000);
  assert.equal(second.remainingMs, secondRemaining - 1000); assert.equal(second.scoops.length, 1);
  assert.equal(first.feedbackMs, 3000);
});
test('all feedback finishes, then a full two-second break precedes the next wave', () => {
  const f = fixture(); f.advance(4000);
  for (const c of f.s.customers) f.game.submit(c.id);
  f.advance(3999); assert.equal(f.s.wave, 1); assert.equal(f.s.customers.length, 3);
  f.advance(1); assert.equal(f.s.customers.length, 0); assert.equal(f.s.breakMs, 2000);
  f.advance(1999); assert.equal(f.s.wave, 1);
  f.advance(1); assert.equal(f.s.wave, 2); assert.equal(f.s.customers.length, 1);
});
test('final partial wave does not create customers beyond the chosen range', () => {
  const f = fixture(); complete(f, 9);
  for (let i = 0; i < 10 && f.s.wave < 4; i++) f.advance(1000);
  assert.equal(f.s.wave, 4); assert.equal(f.s.waveSize, 1); assert.equal(f.s.spawned, 10);
});
test('endless practice repeats complete shuffled ranges across wave boundaries', () => {
  const f = fixture({ mode: 'pro', practice: 'endless', range: '1-20' });
  complete(f, 40);
  assert.equal(f.s.phase, 'playing');
  for (const start of [0, 20]) assert.equal(new Set(f.s.history.slice(start, start + 20).map(c => c.target)).size, 20);
});
for (const patience of [null, 15, 20, 30, 45, 60]) test(`independent patience deadlines: ${patience}`, () => {
  const f = fixture({ patience }); const first = f.game.selected;
  f.advance(2000); const second = f.s.customers[1];
  if (patience === null) { f.advance(1e6); assert.equal(first.phase, 'waiting'); assert.equal(second.remainingMs, null); return; }
  f.advance(patience * 1000 - 2001); assert.equal(first.phase, 'waiting');
  f.advance(1); assert.equal(first.outcome, 'timeout'); assert.equal(first.reaction, 'sad');
  assert.equal(second.remainingMs, 2000); assert.equal(second.phase, 'waiting');
});
test('patience colours use exact half-time and ten-second thresholds with red priority', () => {
  assert.equal(patienceTone(null, 0), 'off');
  for (const total of [30000, 45000, 60000]) {
    assert.equal(patienceTone(total / 2 + 1, total), 'normal');
    assert.equal(patienceTone(total / 2, total), 'yellow');
    assert.equal(patienceTone(10001, total), 'yellow');
    assert.equal(patienceTone(10000, total), 'red');
    assert.equal(patienceTone(0, total), 'red');
  }
});
test('deadline wins over a simultaneous submission, with no duplicate score', () => {
  const f = fixture({ patience: 30 }); const first = f.game.selected;
  fill(f.game, first.id); f.elapse(30000); f.game.submit(first.id); f.game.submit(first.id);
  assert.equal(first.outcome, 'timeout'); assert.equal(f.s.results.correct, 0); assert.equal(f.s.results.missed, 1);
});
test('submission just before a deadline succeeds', () => {
  const f = fixture({ patience: 30 }); const first = f.game.selected;
  fill(f.game, first.id); f.elapse(29999); f.game.submit(first.id);
  assert.equal(first.outcome, 'correct');
});
test('hidden-page pause freezes arrivals, patience, feedback and wave breaks', () => {
  const f = fixture({ patience: 60 }); f.advance(1000);
  f.game.setPaused(true); f.advance(100000); assert.equal(f.s.spawned, 1); assert.equal(f.game.selected.remainingMs, 59000);
  f.game.setPaused(false); f.advance(3000);
  for (const c of f.s.customers) f.game.submit(c.id);
  f.advance(1000); f.game.setPaused(true); f.advance(100000);
  assert.ok(f.s.customers.every(c => c.feedbackMs === 3000));
  f.game.setPaused(false); f.advance(3000); f.advance(1000); f.game.setPaused(true); f.advance(100000);
  assert.equal(f.s.breakMs, 1000); f.game.setPaused(false); f.advance(1000); assert.equal(f.s.wave, 2);
});
test('large ticks match small ticks across simultaneous scheduling boundaries', () => {
  const a = fixture({ patience: 30, practice: 'endless' }); const b = fixture({ patience: 30, practice: 'endless' });
  a.advance(180000); for (let i = 0; i < 1800; i++) b.advance(100);
  assert.deepEqual(a.s, b.s);
});
test('finish counts only resolved customers, and later ticks cannot alter results', () => {
  const f = fixture(); f.advance(4000); f.game.submit(f.s.customers[0].id); f.game.finish();
  assert.deepEqual(f.s.results, { correct: 0, missed: 1 }); f.advance(100000);
  assert.equal(f.s.phase, 'results'); assert.equal(f.s.history.length, 1);
});
test('both negative expressions and both positive effects remain available', () => {
  for (const [random, expression, effect] of [[() => .1, 'sad', 'hearts'], [() => .9, 'angry', 'sparkles']]) {
    const f = fixture({ random }); const first = f.game.selected;
    f.game.submit(first.id); assert.equal(first.reaction, expression); assert.equal(first.effect, 'frown');
    f.advance(2000); const second = f.game.selected; fill(f.game, second.id); f.game.submit(second.id);
    assert.equal(second.reaction, 'happy'); assert.equal(second.effect, effect);
  }
});
test('replacement art keeps neutral fallbacks and independent effect anchors', () => {
  const character = { ...characters[0], headAnchor: { x: 42, y: 12 }, artwork: { neutral: '/assets/bunny.png', happy: '/assets/happy.png' } };
  assert.match(characterMarkup(character, 'happy', 'hearts'), /src="\/assets\/happy.png"/);
  const fallback = characterMarkup(character, 'sad', 'frown');
  assert.match(fallback, /src="\/assets\/bunny.png"/); assert.match(fallback, /left:42%;top:12%/);
});
test('normalized volume, clamping and thumb-aligned track use the same scale', () => {
  assert.equal(DEFAULT_VOLUME_PERCENT, 60);
  assert.equal(audioVolume(0), 0); assert.equal(audioVolume(60), .3); assert.equal(audioVolume(100), .5);
  assert.equal(audioVolume(200), .5); assert.equal(audioVolume(-10), 0);
  assert.equal(trackFill(0, 221), '10.5px'); assert.equal(trackFill(60, 221), '130.5px'); assert.equal(trackFill(100, 221), '210.5px');
});

test('legacy Usual configuration maps to PRO with five customers', () => {
  const f = fixture({ mode: 'usual' });
  assert.equal(f.s.mode, 'pro'); assert.equal(f.s.waveSize, 5);
});
for (const roundMinutes of [1, 2, 3, 4, 5]) test(`${roundMinutes}-minute round ends exactly at its deadline`, () => {
  const f = fixture({ roundMinutes, practice: 'endless' });
  const first = f.game.selected; fill(f.game, first.id); f.game.submit(first.id);
  f.advance(roundMinutes * 60000 - 1);
  assert.equal(f.s.phase, 'playing'); assert.equal(f.s.roundRemainingMs, 1);
  f.advance(1);
  assert.equal(f.s.phase, 'results'); assert.equal(f.s.endReason, 'round-time');
  assert.deepEqual(f.s.results, { correct: 1, missed: 0 });
  f.game.submit(); f.advance(100000);
  assert.equal(f.s.history.length, 1);
});
test('round clock starts on game reveal and pauses while away', () => {
  let time = 0;
  const game = new CountingGame({ mode: 'baby', roundMinutes: 1 }, { now: () => time });
  time = 100000; game.tick(); assert.equal(game.state.roundRemainingMs, 60000);
  game.start(); time += 1000; game.tick(); assert.equal(game.state.roundRemainingMs, 59000);
  game.setPaused(true); time += 999999; game.tick(); assert.equal(game.state.roundRemainingMs, 59000);
  game.setPaused(false); time += 1000; game.tick(); assert.equal(game.state.roundRemainingMs, 58000);
});
test('round expiry wins a submission and excludes simultaneous unresolved timeouts', () => {
  const f = fixture({ roundMinutes: 1, patience: 60 }); const first = f.game.selected;
  fill(f.game, first.id); f.elapse(60000); f.game.submit(first.id);
  assert.equal(f.s.phase, 'results'); assert.deepEqual(f.s.results, { correct: 0, missed: 0 });
  assert.equal(f.s.history.length, 0);
  const before = fixture({ roundMinutes: 1 }); fill(before.game); before.elapse(59999); before.game.submit();
  before.advance(1); assert.equal(before.s.results.correct, 1);
});
test('no round limit preserves unlimited practice; unsupported limits are ignored', () => {
  for (const roundMinutes of [null, 0, -1, 6, 1.5]) {
    const f = fixture({ roundMinutes, practice: 'endless' }); f.advance(1e6);
    assert.equal(f.s.roundRemainingMs, null); assert.equal(f.s.phase, 'playing');
  }
});
test('round and PvP timer labels use English words', () => {
  assert.equal(timeLabel(60000), 'one minute');
  assert.equal(timeLabel(61999), 'one minute and two seconds');
  assert.equal(timeLabel(1), 'one second'); assert.equal(timeLabel(0), 'zero seconds');
  assert.equal(timeLabel(300000), 'five minutes');
  assert.equal(patienceLabel(10), 'ten seconds'); assert.equal(patienceLabel(20), 'twenty seconds');
});
test('game audio defaults to thirty percent of its seventy-percent cap', () => {
  assert.equal(AUDIO_PROFILES.game.defaultPercent, 30);
  assert.equal(audioVolume(0, 'game'), 0); assert.equal(audioVolume(100, 'game'), .7);
  assert.ok(Math.abs(audioVolume(30, 'game') - .21) < 1e-10);
  assert.equal(audioVolume(900, 'game'), .7); assert.equal(audioVolume(-1, 'game'), 0);
  assert.equal(trackFill(30, 221), '70.5px');
});
test('music profile changes preserve levels and mute without changing the caps', () => {
  const music = new MusicLevels(); assert.equal(music.volume, .3);
  music.setPercent(80); music.setProfile('game'); assert.equal(music.percent, 30);
  assert.ok(Math.abs(music.volume - .21) < 1e-10);
  music.setPercent(100); assert.equal(music.volume, .7);
  music.toggleMute(); assert.equal(music.volume, 0);
  music.setProfile('menu'); assert.equal(music.percent, 0);
  music.toggleMute(); assert.equal(music.percent, 80); assert.equal(music.volume, .4);
  music.setProfile('game'); assert.equal(music.percent, 100);
  music.setPercent(0); music.toggleMute(); assert.equal(music.volume, .7);
});

test('confirmation pause preserves the bowl, deadlines and feedback until cancelled', () => {
  const f = fixture({ patience: 30, roundMinutes: 2 });
  f.advance(4000);
  const first = f.s.customers[0];
  fill(f.game, first.id, 3); f.game.submit(first.id);
  const second = f.game.selected; fill(f.game, second.id, 2);
  f.game.setPaused(true);
  const snapshot = structuredClone(f.s);
  f.advance(100000); f.game.add(second.id); f.game.remove(second.id); f.game.submit(second.id);
  assert.deepEqual(f.s, snapshot);
  f.game.setPaused(false); f.advance(1000);
  assert.equal(first.feedbackMs, 3000);
  assert.equal(f.s.roundRemainingMs, snapshot.roundRemainingMs - 1000);
  assert.equal(second.scoops.length, 2);
});
test('timeouts keep a sad face and frown for the full departure feedback', () => {
  const f = fixture({ patience: 30 }); const first = f.game.selected;
  f.advance(30000);
  assert.equal(first.reaction, 'sad'); assert.equal(first.effect, 'frown');
  f.advance(3999); assert.ok(f.s.customers.includes(first));
  assert.equal(first.reaction, 'sad'); assert.equal(first.effect, 'frown');
  f.advance(1); assert.ok(!f.s.customers.includes(first));
});


test('short patience settings keep red priority and removed two-minute patience is rejected', () => {
  for (const patience of [15, 20]) {
    assert.equal(patienceTone(10001, patience * 1000), 'normal');
    assert.equal(patienceTone(10000, patience * 1000), 'red');
    assert.equal(patienceTone(patience * 500, patience * 1000), 'red');
  }
  assert.equal(fixture({ patience: 120 }).s.customerWaitSeconds, null);
  assert.equal(patienceLabel(15), 'fifteen seconds');
  assert.equal(patienceLabel(45), 'forty-five seconds');
});
