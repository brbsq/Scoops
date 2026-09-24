const small = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
export function words(value) {
  const n = Math.max(0, Math.floor(value));
  if (n < 20) return small[n];
  if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? `-${small[n % 10]}` : '');
  for (const [size, name] of [[1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million'], [1000, 'thousand'], [100, 'hundred']]) {
    if (n >= size) return `${words(Math.floor(n / size))} ${name}${n % size ? ` ${words(n % size)}` : ''}`;
  }
}
export const patienceLabel = seconds => ({ 10: 'ten seconds', 15: 'fifteen seconds', 20: 'twenty seconds', 30: 'thirty seconds', 45: 'forty-five seconds', 60: 'one minute' })[seconds] || 'Off';

export function timeLabel(milliseconds) {
  const seconds = Math.ceil(Math.max(0, milliseconds) / 1000);
  const minutes = Math.floor(seconds / 60);
  const parts = [];
  if (minutes) parts.push(`${words(minutes)} ${minutes === 1 ? 'minute' : 'minutes'}`);
  if (seconds % 60 || !minutes) parts.push(`${words(seconds % 60)} ${seconds % 60 === 1 ? 'second' : 'seconds'}`);
  return parts.join(' and ');
}
