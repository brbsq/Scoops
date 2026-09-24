import './build.mjs';
import { mkdir, copyFile, cp, readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
const base = process.env.PAGES_BASE_PATH || '/Scoops/';
if (!/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(base)) throw Error('PAGES_BASE_PATH must be an absolute directory path ending in /.');
const output = 'pages';
await mkdir(output, { recursive: true });
await copyFile('dist/index.html', `${output}/index.html`);
for (const folder of ['src', 'assets', 'fonts']) await cp(`dist/${folder}`, `${output}/${folder}`, { recursive: true });
async function rewrite(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await rewrite(file);
    else if (/\.(html|js|css)$/.test(file)) {
      const text = await readFile(file, 'utf8');
      await writeFile(file, text.replace(/(["'`(])\/(assets|fonts|src)\//g, `$1${base}$2/`));
    }
  }
}
await rewrite(output);
await writeFile(`${output}/src/deployment.js`, 'export const STATIC_ONLY = true;\n');
await writeFile(`${output}/.nojekyll`, '');
console.log(`GitHub Pages build ready in ${output}/ at ${base}`);
