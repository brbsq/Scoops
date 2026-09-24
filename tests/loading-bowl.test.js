import test from 'node:test';
import assert from 'node:assert/strict';
import { settleWithin } from '../src/loading.js';
import { SCOOP_WIDTH, SCOOP_HEIGHT, SCOOP_POSITIONS, BOWL_PATH, scoopMarkup, bowlMarkup } from '../src/bowl.js';

test('stalled scenery releases loading at the deadline, and late rejection remains handled', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let reject;
  const scenery = new Promise((resolve, rejectPromise) => { reject = rejectPromise; });
  const ready = settleWithin(scenery, 8000);
  t.mock.timers.tick(7999);
  let completed = false; ready.then(() => { completed = true; });
  await Promise.resolve(); assert.equal(completed, false);
  t.mock.timers.tick(1); assert.deepEqual(await ready, { status: 'timeout' });
  reject(new Error('A late graphics failure'));
  await Promise.resolve();
});
test('ready and failed assets settle immediately without waiting for the fallback deadline', async () => {
  assert.deepEqual(await settleWithin(Promise.resolve('artwork'), 8000), { status: 'ready', value: 'artwork' });
  const error = new Error('Missing artwork');
  assert.deepEqual(await settleWithin(Promise.reject(error), 8000), { status: 'failed', error });
});
test('scoops are fifty percent larger, fill from the centre and have twenty-five distinct slots', () => {
  assert.equal(SCOOP_WIDTH, 44 * 1.5); assert.equal(SCOOP_HEIGHT, 37 * 1.5);
  assert.deepEqual(SCOOP_POSITIONS[0], { x: 220, y: 272 });
  assert.equal(SCOOP_POSITIONS.length, 25);
  assert.equal(new Set(SCOOP_POSITIONS.map(p => `${p.x},${p.y}`)).size, 25);
  for (const { x, y } of SCOOP_POSITIONS) {
    assert.ok(x - SCOOP_WIDTH / 2 > 12 && x + SCOOP_WIDTH / 2 < 428);
    assert.ok(y - SCOOP_HEIGHT / 2 >= 28 && y + SCOOP_HEIGHT / 2 < 302);
  }
  for (let n = 0; n <= 25; n++) {
    assert.equal((scoopMarkup(Array(n).fill('mint')).match(/class="bowl-scoop"/g) || []).length, n);
  }
});
test('the glass and clipping mask share one bowl outline, preventing overflow', () => {
  const bowl = bowlMarkup();
  assert.ok(bowl.includes(`<clipPath id="bowl-interior"><path d="${BOWL_PATH}"/></clipPath>`));
  assert.ok(bowl.includes('class="scoop-pile" clip-path="url(#bowl-interior)"'));
  assert.equal((bowl.match(new RegExp(BOWL_PATH, 'g')) || []).length, 3);
});
