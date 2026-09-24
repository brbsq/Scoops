import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('shop model is self-contained and its camera is behind the original serving counter', async () => {
  const bytes = await readFile(new URL('../public/assets/models/gelato-shop.glb', import.meta.url));
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  assert.equal(json.asset.version, '2.0');
  assert.ok(json.images.length > 0);
  assert.ok(json.images.every(image => image.bufferView !== undefined));
  const bounds = name => {
    const node = json.nodes.find(node => node.name.includes(name));
    return json.meshes[node.mesh].primitives.map(p => json.accessors[p.attributes.POSITION]);
  };
  const back = bounds('Back preparation counter'), front = bounds('Display glass');
  const aisleBack = Math.max(...back.map(a => a.max[2]));
  const counterBack = Math.min(...front.map(a => a.min[2]));
  const source = await readFile(new URL('../src/shop-scene.js', import.meta.url), 'utf8');
  const camera = source.match(/position: \[([\d., -]+)\], target: \[([\d., -]+)\]/);
  const position = camera[1].split(',').map(Number), target = camera[2].split(',').map(Number);
  assert.ok(position[2] > aisleBack && position[2] < counterBack);
  assert.ok(position[1] > Math.max(...front.map(a => a.max[1])));
  assert.ok(target[2] > Math.max(...front.map(a => a.max[2])));
});
test('local GLTF runtime imports resolve without a CDN or package server', async () => {
  const root = new URL('../public/assets/vendor/three/', import.meta.url);
  for (const file of ['three.module.js', 'three.core.js', 'addons/loaders/GLTFLoader.js', 'addons/utils/BufferGeometryUtils.js']) {
    const source = (await readFile(new URL(file, root), 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
    for (const match of source.matchAll(/^import[\s\S]*?from ['"]([^'"]+)['"]/gm)) {
      assert.ok(match[1].startsWith('.'), `Unexpected external import in ${file}: ${match[1]}`);
      await readFile(new URL(match[1], new URL(file, root)));
    }
  }
  assert.match(await readFile(new URL('LICENSE.txt', root), 'utf8'), /MIT/);
});
