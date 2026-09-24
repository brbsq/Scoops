// Optional artwork must never hold the playable game on Loading indefinitely.
// Attach both handlers even after the deadline, so late rejection stays handled.
export function settleWithin(promise, milliseconds) {
  return new Promise(resolve => {
    const timeout = setTimeout(() => resolve({ status: 'timeout' }), milliseconds);
    Promise.resolve(promise).then(
      value => { clearTimeout(timeout); resolve({ status: 'ready', value }); },
      error => { clearTimeout(timeout); resolve({ status: 'failed', error }); },
    );
  });
}
