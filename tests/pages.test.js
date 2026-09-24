import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

test('Pages edition resolves assets under the repository path and preserves the full server build', async () => {
  execFileSync(process.execPath,['scripts/build-pages.mjs']);
  const html=await readFile('pages/index.html','utf8');
  assert.match(html,/src="\/Scoops\/src\/main.js"/);
  assert.match(html,/href="\/Scoops\/src\/pvp.css"/);
  assert.match(await readFile('pages/src/deployment.js','utf8'),/STATIC_ONLY = true/);
  assert.match(await readFile('dist/src/deployment.js','utf8'),/STATIC_ONLY = false/);
  for(const name of await readdir('pages/src')) {
    const source=await readFile(path.join('pages/src',name),'utf8');
    assert.doesNotMatch(source,/["'`(]\/(assets|fonts|src)\//,name);
    for(const match of source.matchAll(/["'(]\/Scoops\/([^"')`$]+)["')]/g)) {
      assert.ok((await stat(path.join('pages',match[1]))).isFile(),`${name}: ${match[1]}`);
    }
  }
  assert.ok((await stat('pages/.nojekyll')).isFile());
});
