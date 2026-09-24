import test from 'node:test';
import assert from 'node:assert/strict';
import { playLayout, servingOpacity } from '../src/play-layout.js';

test('the complete play surface fits phone, tablet and desktop landscape viewports', () => {
  for (const [width, height] of [[667,375],[844,390],[1024,768],[1280,720],[1920,1080]]) {
    const layout = playLayout(width,height);
    assert.ok(layout.width * layout.scale <= width - 20 + 0.001);
    assert.ok(layout.height * layout.scale <= height - 16 + 0.001);
    assert.ok(layout.scale > 0);
  }
});
test('served contents appear with the reaction, fade early, and stay gone for the remaining reaction', () => {
  assert.equal(servingOpacity(4000),1);
  assert.equal(servingOpacity(3800),1);
  assert.equal(servingOpacity(3200),0.5);
  assert.equal(servingOpacity(2600),0);
  assert.equal(servingOpacity(0),0);
});
