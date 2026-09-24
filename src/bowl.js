// A fixed centre-out packing keeps earlier scoops in place as the bowl fills.
// Previous artwork was 44 × 37; these scoops are exactly 50% larger.
export const SCOOP_WIDTH = 66;
export const SCOOP_HEIGHT = 55.5;
export const BOWL_WIDTH = 440;
export const BOWL_HEIGHT = 330;
export const BOWL_PATH = 'M12 30 Q220 0 428 30 L407 170 Q390 287 296 302 Q220 324 144 302 Q50 287 33 170 Z';
const rows = [
  { y: 272, xs: [220, 154, 286] },
  { y: 218, xs: [220, 154, 286, 88, 352] },
  { y: 164, xs: [220, 154, 286, 88, 352] },
  { y: 110, xs: [188, 253, 123, 318, 58, 383] },
  { y: 56, xs: [188, 253, 123, 318, 58, 383] },
];
export const SCOOP_POSITIONS = rows.flatMap(row => row.xs.map(x => ({ x, y: row.y })));
const colours = {
  strawberry: ['#ffe2eb', '#efabc3', '#cf86a3'], vanilla: ['#fffef6', '#f6e3ab', '#d9c188'],
  mint: ['#dcffec', '#92d8b6', '#65bca0'], blueberry: ['#ede4ff', '#b6a1e2', '#8d79c0'],
  mango: ['#fff0c4', '#f4bf77', '#d89b55'],
};
export function scoopMarkup(scoops) {
  return scoops.slice(0, SCOOP_POSITIONS.length).map((flavour, index) => {
    const { x, y } = SCOOP_POSITIONS[index];
    const colour = colours[flavour] ? flavour : 'vanilla';
    return `<g class="bowl-scoop" aria-hidden="true"><ellipse cx="${x}" cy="${y}" rx="${SCOOP_WIDTH / 2}" ry="${SCOOP_HEIGHT / 2}" fill="url(#bowl-${colour})" stroke="#fff8" stroke-width="2"/><path d="M${x - 18} ${y - 10}q9-9 19-8" fill="none" stroke="#ffffff80" stroke-width="4" stroke-linecap="round"/></g>`;
  }).join('');
}
export function bowlMarkup() {
  return `<svg class="bowl-art" viewBox="0 0 ${BOWL_WIDTH} ${BOWL_HEIGHT}" aria-hidden="true"><defs>
    <clipPath id="bowl-interior"><path d="${BOWL_PATH}"/></clipPath>
    <linearGradient id="bowl-glass"><stop stop-color="#ffffff66"/><stop offset=".22" stop-color="#e5fff610"/><stop offset=".75" stop-color="#b4dfd510"/><stop offset="1" stop-color="#ffffff77"/></linearGradient>
    ${Object.entries(colours).map(([name, stops]) => `<radialGradient id="bowl-${name}" cx=".3" cy=".22" r=".85"><stop stop-color="${stops[0]}"/><stop offset=".7" stop-color="${stops[1]}"/><stop offset="1" stop-color="${stops[2]}"/></radialGradient>`).join('')}
    </defs><ellipse cx="220" cy="318" rx="100" ry="8" fill="#effff666" stroke="#fff9" stroke-width="2"/>
    <path d="${BOWL_PATH}" fill="#e5fff628" stroke="#f6ffffb0" stroke-width="3"/>
    <g class="scoop-pile" clip-path="url(#bowl-interior)"></g>
    <path d="${BOWL_PATH}" fill="url(#bowl-glass)" stroke="#f6ffffb0" stroke-width="3"/>
    <path d="M35 63q3 91 30 145M400 65q-2 55-14 90" stroke="#ffffffa0" stroke-width="8" fill="none" stroke-linecap="round"/>
    <ellipse cx="220" cy="30" rx="208" ry="16" fill="none" stroke="#faffffde" stroke-width="4"/>
    </svg>`;
}
