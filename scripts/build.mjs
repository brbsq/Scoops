import { mkdir, copyFile, cp, writeFile } from 'node:fs/promises';
await mkdir('dist/src', { recursive: true });
await copyFile('index.html', 'dist/index.html');
for (const file of ['main.js', 'scoops.css', 'game.css', 'words.js', 'game-engine.js', 'game-view.js', 'characters.js', 'navigation.js', 'audio-settings.js', 'waves-game.css', 'shop-scene.js', 'shop-scene.css', 'loading.js', 'bowl.js', 'play-layout.js', 'play-layout.css', 'pvp-engine.js', 'pvp-view.js', 'pvp.css', 'experience.js', 'deployment.js']) {
  await copyFile(`src/${file}`, `dist/src/${file}`);
}
await cp('public/assets', 'dist/assets', { recursive: true });
await cp('public/fonts', 'dist/fonts', { recursive: true });
await mkdir('dist/scripts', { recursive: true });
for (const file of ['serve.mjs', 'app-server.mjs', 'pvp-server.mjs']) await copyFile(`scripts/${file}`, `dist/scripts/${file}`);
await writeFile('dist/package.json', JSON.stringify({ name: 'scoops-game', version: '1.0.0', private: true, type: 'module', scripts: { start: 'node scripts/serve.mjs --bundle' }, dependencies: { 'socket.io': '^4.8.1' } }, null, 2) + '\n');
await writeFile('dist/README.md', `# Scoops!!! — complete web game

This folder contains the home screen, Baby, Easy, PRO, same-screen PvP and network PvP, plus all artwork, music and the shop model.

Install Node.js (version 22 or later). In this folder, run:

    npm install
    npm start

Open http://localhost:5173 on the host computer. For other devices on the same Wi-Fi, use the address and room code shown in the PvP lobby. Leave the server running. No separate game service is needed.

Copy this entire folder to move or deploy the game. Network PvP needs the included Node server; opening index.html directly or using static-only hosting will not provide rooms. Room state is temporary and resets when the server restarts. This package is not publicly deployed.
`);
console.log('Built Scoops!!! into dist/ — ready. Use npm start for multiplayer hosting.');
