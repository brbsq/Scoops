# Scoops!!!

An English counting game with animal customers, colourful ice cream and transparent glass bowls.

## Run and build

Install dependencies with `npm install` on a fresh checkout, then run **`npm start`** and open [Scoops](http://localhost:5173). This one command builds and serves the complete game, including solo and multiplayer. Use `npm run dev` while editing. `npm test` builds and checks the game rules, multiplayer and the packaged server.

`npm run build` produces a **self-contained `dist/` application**: game code, artwork, fonts, music, 3D model, multiplayer server and its own package.json. To move the game to another computer, copy the whole `dist` folder, run `npm install` there, then `npm start`. Its README contains the launch instructions. Do not open index.html directly for network play.

## Play

**Start → Mode → Quantity → Loading → Game.** The quantity page uses the supplied separate PNG elements and an independently animated rainbow background. Soft dissolve transitions connect the screens. Reduced motion shortens the fade.

Choose **1–10**, **11–20**, or **1–20**. The timer icon glows softly after choosing a main mode and opens these settings:

- **Full range:** every number in the range once, shuffled (ten or twenty customers).
- **Endless practice:** repeated shuffled sets until Finish.
- **Customer patience:** Off (default) or On. Turning it on restores the last duration, initially thirty seconds. Duration choices are fifteen, twenty, thirty or forty-five seconds, or one minute.
- **PvP customer timer:** Off, ten, twenty, thirty seconds or one minute. This independent setting supplies the default for PvP setup.
- **Round time limit:** Off (default) or one through five minutes, independent of customer patience. Active rounds show the remaining time in words and end automatically. Unresolved customers are excluded from results.

Baby has three customers per wave, Easy four, and PRO five. The first customer arrives immediately; later arrivals are two seconds apart. When everyone in a wave has left, a two-second break precedes the next group. The last full-range wave may be smaller.

Select an animal to work on its bowl. Each animal retains its own scoops when you switch customers. Use the circular plus and minus buttons, side by side, to add and remove one at a time, up to twenty-five. Scoop artwork is fifty percent larger and fills fixed positions from the centre, starting at the middle of the bowl. All twenty-five positions stay inside a shared SVG bowl outline and clipping mask. The whole bowl scales to the available screen width. Scoops cycle through strawberry, vanilla, mint, blueberry and mango colours; answers depend only on quantity. There is no running count or next-number hint. Only after submitting, a small popup above the bowl shows the served amount in words, labelled with that customer’s name, for the four-second feedback interval.

Press **“Here you are!”** to submit. An empty bowl can be submitted too. Correct answers show a happy animal with hearts or sparkles and “Thank you”. Incorrect answers randomly show a gentle sad/angry expression with frowning lines and “Too few scoops!” or “Too many scoops!”. All animals leave four seconds after an answer, in every mode. There are no retries. Other waiting customers remain playable during reactions.

Each customer has an independent floating patience ring. It glows yellow at half time and red at ten seconds or less. Red takes priority. Timed-out animals show a sad face, frown marks and “Time’s up!”, then gently fade away after four seconds. With patience Off, rings are hidden. Switching away freezes all game clocks, including arrivals, feedback, wave breaks and the round clock.

Results show correctly served and missed customers in words. Finish excludes unresolved customers but preserves submitted answers and timeouts. **Exit game** opens a confirmation on both gameplay and results. **Finish** also asks before ending the round. All patience, round, arrival, feedback and wave-break clocks pause while confirmation is open; Cancel or Escape resumes them only if the page is visible. Sessions are not saved; reloading gameplay returns safely to quantity selection. PvP is available from the mode menu; see Multiplayer below.

## Volume and numbers

The volume slider displays zero to one hundred percent **of the allowed output**. Menu music defaults to **60%** of its fifty-percent cap (thirty-percent actual output). After gameplay is visible, the supplied **Coconut Mall** track starts at **30%** of its seventy-percent cap (**twenty-one-percent actual output**). At **100%**, game audio is seventy percent. Returning to menus restores the original track and its previous level. Each track remembers its slider setting for this page session; mute carries across track changes. The fill aligns with the thumb, and unmute restores the selected track’s previous level. Only the numeric percentage, slider and mute icon are visible; accessible labels remain available.

Orders and results use written number words. Range artwork and the volume percentage use digits. There is no spoken dialogue; menu and game music use separate tracks. Autoplay may require a first click or keypress.

## Three-dimensional shop

The supplied `public/assets/models/gelato-shop.glb` is loaded locally during the loading screen. `src/shop-scene.js` places the camera in the staff aisle behind the original display (`z = -1.05`), facing its customer side (`z > 1.10`). The original model is preserved, with a simple courtyard and canopy completing its open front. Transparent animal UI stands across the counter; the bowl and controls sit on the staff side. Gameplay requires landscape orientation. Portrait shows a rotate-device screen and pauses all clocks and controls; an unopened game starts only once landscape is visible. Menus remain usable in either orientation. Short landscape screens use customers and preparation side by side.

Artwork readiness has an eight-second deadline, so stalled downloads or decoding cannot leave the game on Loading indefinitely. Shader preparation uses synchronous compilation rather than waiting on a graphics-driver completion promise. A Back button remains available during loading. The model, embedded textures and a locally bundled Three.js runtime ship with the production build; no CDN is required. Rendering happens only on load, resize and returning to the visible page. Pixel density is capped for mobile performance. If WebGL or model loading fails, the original background remains playable. Adjust `SHOP_CAMERA` in `src/shop-scene.js` to reframe the view. Vendor sources are from the installed Three.js version, with its licence included in `public/assets/vendor/three/`.

## Replace animal artwork

Configure animals in `src/characters.js`. Put transparent PNG, WebP or SVG drawings in `public/assets/characters/`, then use matching square canvases for each expression:

```js
artwork: {
  neutral: '/assets/characters/bunny.png',
  happy: '/assets/characters/bunny-happy.png',
  sad: '/assets/characters/bunny-sad.png',
  angry: '/assets/characters/bunny-angry.png',
},
headAnchor: { x: 50, y: 10 },
```

The anchor is a percentage of the square canvas measured from its top-left. Hearts, sparkles and frowning lines attach to that anchor; the patience ring sits above it. Leave room around the head. Missing expression drawings fall back to neutral art; missing or failed neutral art falls back to the original SVG placeholder. Supply expression drawings for the face itself to change. Effects always remain separate from the drawings.

## Implementation

- `src/game-engine.js`: independent customers and bowls, full-range order bags, event-boundary wave scheduling, deadlines and results. The clock and random generator can be injected for tests.
- `src/game-view.js`: quantity/loading/shop/results screens, asset readiness, selection and scoped customer actions.
- `src/navigation.js`: cancellable dissolve transitions, input locking and reduced-motion fallback.
- `src/audio-settings.js`: normalized volume mapping and thumb-aligned track fill.
- `src/characters.js`: replaceable character definitions and independent reactions.
- `src/bowl.js`: enlarged centre-first scoop layout and matching bowl/clipping paths.
- `src/loading.js`: bounded artwork readiness with handled late failures.
- `src/shop-scene.js` and `src/shop-scene.css`: supplied GLB scenery, staff-side camera, responsive overlay layout and confirmation styling.
- `src/main.js`: common menu, shared settings/audio, rainbow background and delegated button glow.
- `src/experience.js`: one scenery owner for every mode, including safe late loading and return to menus.
- `scripts/app-server.mjs`: one HTTP and Socket.IO server for all game modes and assets.
- `src/waves-game.css`: new screen, bowl, wave, transition and control styling.

`scoops:start` remains cancelable. Settings include `mode`, `customerWaitSeconds`, `pvpWaitSeconds`, `roundMinutes`, `practice` (`standard` or `endless`) and `range` (`1-10`, `11-20`, `1-20`). `scoops:settingschange` announces timer and practice changes. `scoops:game-ready` switches audio only after the gameplay reveal. The main game handles Baby/Easy/PRO; PvP has its own room flow, match engine and customer timer setting. Add/remove/submit operations target a customer ID, preventing late or duplicate submissions from scoring the wrong record.

Routes are `#modes`, `#quantity/baby`, `#loading/baby`, `#play/baby` and `#results/baby` (also easy/pro). Legacy `#setup/…` routes redirect to quantity, and `usual` URLs redirect to `pro`. Direct or refreshed loading/play/results links without an active session return to quantity. A generation guard cancels stale loading work when navigation changes. Customers' clocks begin only after the game reveal completes.

The separate Little Trolley application and legacy trolley files are not part of Scoops.


## Multiplayer

Choose **PvP** from the mode menu. No account is needed; players use a nickname.

- **Same screen:** two independent counters with touch/mouse controls. Keyboard: A adds, S removes, D serves for the left player; J/K/L do the same for the right. Both play in landscape. Hiding the page, rotating to portrait or opening an exit/finish confirmation pauses both players.
- **Host a room:** choose “I will play too” or “Leaderboard only”. Share the six-digit code and the address shown in the lobby. At least two participating players are needed; the host can start, finish or replay a match. Rooms support up to eight players, plus a spectator host.
- **Join friends:** on each other device, open the host’s address, select PvP, enter a nickname and room code. Join before the host starts. The host’s range and timers apply to everyone.

Each player receives the same shuffled sequence, covering the selected range once. Each correct answer earns one mark, with no speed bonuses or negative marks. Every submission ends the customer’s visit; reactions last four seconds while the served scoops fade. The HUD shows each player’s marks and completed-order progress. A spectator host gets a live leaderboard sorted by marks. Finishing all orders or reaching the round limit ends the match; unresolved orders are not scored. Tied highest scores share the win.

PvP patience choices are Off, ten, twenty or thirty seconds, or one minute. Round time is Off or one to five minutes. Off means finish all orders. Online timers belong to the server and continue when a connected player hides their page or rotates their device. Exit/Finish confirmation explains that a live match continues while deciding. Losing a connection pauses the whole room for up to one minute; reloading the same tab restores its player and bowl using a per-tab reconnect token. If a player fails to return, the match ends with recorded marks. A host that fails to return closes the room. Leaving explicitly ends the match; a host leaving closes the room. Rooms expire after four hours and disappear when the server restarts.

### Play on separate devices

Run `npm run dev` on the host computer and leave it running. Connect the other devices to the **same Wi-Fi/network**, then use the local-network address displayed in the room lobby (for example, `http://192.168.x.x:5173/#pvp`). `localhost` works only on the host computer. The server listens on all interfaces by default; `HOST=127.0.0.1 npm run dev` restricts it to local-only testing. If the operating system asks, allow Node to accept local-network connections. Guest Wi-Fi with client isolation may prevent devices from reaching each other.

For production, run `npm start` (it builds automatically). Multiplayer requires this Node server and Socket.IO; uploading only `dist` to a static host does not provide multiplayer rooms. Internet play requires deploying the Node application to a reachable host, with WebSocket support. This implementation has not been publicly deployed.

`src/pvp-engine.js` is the shared local/server match engine. `src/pvp-view.js` and `src/pvp.css` implement setup, split-screen play, rooms, leaderboard and results. `scripts/pvp-server.mjs` owns rooms, reconnect tokens, host permissions, action sequence validation and authoritative scoring. It attaches to the Scoops server in `scripts/serve.mjs`; the separate Little Trolley server is unchanged. `tests/pvp.test.js` exercises game rules and real separate Socket.IO clients.

All modes now share the same shop scenery and music. PvP range and round-time changes carry back to the common settings, while solo and PvP customer patience remain independent. Main-mode selection, PvP selection and returns to the menu use the same dissolve navigation.

## GitHub Pages

`npm run build:pages` produces a separate static edition in `pages/`, with asset URLs rooted at `/Scoops/`. The `.github/workflows/pages.yml` workflow tests, builds and deploys this edition on pushes to `main`. Enable **GitHub Actions** as the Pages source in the repository settings.

GitHub Pages supports Baby, Easy, PRO and same-screen PvP. Online rooms require the full Node server and are clearly unavailable in the static edition. All multiplayer server code remains in the repository and the normal `dist/` build. The static deployment does not publish server files, local-network addresses or room credentials.
