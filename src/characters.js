// Artwork paths are optional. Replace with your drawings in public/assets/characters/.
// headAnchor is a percentage of the square artwork canvas, measured from top-left.
export const characters = [
  { id: 'bunny', name: 'Bunny', color: '#f6dbdc', inner: '#eeb7c6', headAnchor: { x: 50, y: 10 }, artwork: { neutral: null, happy: null, sad: null, angry: null } },
  { id: 'bear', name: 'Bear', color: '#d9b08c', inner: '#b98068', headAnchor: { x: 50, y: 20 }, artwork: { neutral: null, happy: null, sad: null, angry: null } },
  { id: 'cat', name: 'Kitten', color: '#f4ce91', inner: '#e99b94', headAnchor: { x: 50, y: 17 }, artwork: { neutral: null, happy: null, sad: null, angry: null } },
];

const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
export function characterMarkup(character, reaction = 'neutral', effect = null) {
  const { id, color, inner, artwork, headAnchor } = character;
  const image = artwork[reaction] || artwork.neutral;
  const ears = id === 'bunny'
    ? `<ellipse cx="94" cy="76" rx="26" ry="62" fill="${color}" transform="rotate(-12 94 76)"/><ellipse cx="206" cy="76" rx="26" ry="62" fill="${color}" transform="rotate(12 206 76)"/><ellipse cx="94" cy="66" rx="12" ry="39" fill="${inner}"/><ellipse cx="206" cy="66" rx="12" ry="39" fill="${inner}"/>`
    : id === 'cat'
      ? `<path d="M61 137 53 50Q55 37 68 48L126 101M174 101 232 48Q245 37 247 50L239 137" fill="${color}"/><path d="m67 66 5 52 34-20m88 0 34 20 5-52" fill="${inner}"/>`
      : `<circle cx="77" cy="102" r="42" fill="${color}"/><circle cx="223" cy="102" r="42" fill="${color}"/><circle cx="77" cy="102" r="24" fill="${inner}"/><circle cx="223" cy="102" r="24" fill="${inner}"/>`;
  const eyes = reaction === 'happy'
    ? '<path d="M97 158q10-16 20 0m66 0q10-16 20 0" fill="none" stroke="#59483c" stroke-width="6" stroke-linecap="round"/>'
    : '<ellipse cx="107" cy="158" rx="6" ry="9" fill="#59483c"/><ellipse cx="193" cy="158" rx="6" ry="9" fill="#59483c"/><circle cx="109" cy="155" r="2" fill="white"/><circle cx="195" cy="155" r="2" fill="white"/>';
  const brows = reaction === 'angry' ? '<path d="m95 134 24 8m62 0 24-8"/>' : reaction === 'sad' ? '<path d="m95 141 24-9m62 0 24 9"/>' : '';
  const mouth = reaction === 'happy' ? '<path d="M134 188q16 32 32 0Z" fill="#a96665"/><path d="M142 198q8-5 16 0" stroke="#efb3b1" stroke-width="5"/>'
    : `<path d="${reaction === 'neutral' ? 'M135 189q15 16 30 0' : 'M137 200q13-14 26 0'}" fill="none" stroke="#59483c" stroke-width="4" stroke-linecap="round"/>`;
  const drawing = `<svg viewBox="0 0 300 300" aria-hidden="true">${ears}<ellipse cx="150" cy="289" rx="82" ry="64" fill="${color}"/><ellipse cx="150" cy="283" rx="48" ry="40" fill="#fff6e5"/><rect x="47" y="84" width="206" height="167" rx="83" fill="${color}"/><ellipse cx="82" cy="183" rx="20" ry="11" fill="#e89caa" opacity=".55"/><ellipse cx="218" cy="183" rx="20" ry="11" fill="#e89caa" opacity=".55"/>${eyes}<g fill="none" stroke="#59483c" stroke-width="4" stroke-linecap="round">${brows}</g><path d="M142 176q8-6 16 0l-8 7Z" fill="#a57570"/>${mouth}<ellipse cx="73" cy="272" rx="30" ry="19" fill="${color}"/><ellipse cx="227" cy="272" rx="30" ry="19" fill="${color}"/></svg>`;
  const effects = effect === 'hearts' ? '<i>♥</i><i>♥</i><i>♥</i>' : effect === 'sparkles' ? '<i>✦</i><i>✧</i><i>✦</i>' : effect === 'frown' ? '<svg viewBox="0 0 100 45"><path d="M15 13q10 16 26 10M59 23q16 6 26-10M24 3q5 8 14 8M62 11q9 0 14-8"/></svg>' : '';
  return `<div class="animal animal--${reaction}" role="img" aria-label="${escape(character.name)} looks ${reaction}">${image ? `<img src="${escape(image)}" alt="" draggable="false">` : drawing}<span class="head-effect ${effect || ''}" style="left:${headAnchor.x}%;top:${headAnchor.y}%" aria-hidden="true">${effects}</span></div>`;
}
