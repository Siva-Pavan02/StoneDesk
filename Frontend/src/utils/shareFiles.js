// Resolves to 'shared', 'cancelled' or 'unsupported' (no file sharing here, or the browser refused it).
export async function shareFiles(files, title, text) {
  if (!navigator.share || (navigator.canShare && !navigator.canShare({ files }))) return 'unsupported';
  try {
    await navigator.share({ files, title, text });
    return 'shared';
  } catch (err) {
    if (err.name === 'AbortError') return 'cancelled';
    if (err.name === 'NotAllowedError' || err.name === 'TypeError') return 'unsupported';
    throw err;
  }
}

// Shares one exported document and applies the outcome:
// - 'shared'      → nothing else to do
// - 'cancelled'   → user dismissed the sheet: silent no-op (no download, no notice)
// - 'unsupported' → download instead; the caller shows the "downloaded instead" notice
// Other errors from the share call propagate to the caller.
export async function shareOrDownload(output, { title, text, download, share = shareFiles }) {
  const file = new File([output.blob], output.filename, { type: output.blob.type });
  const outcome = await share([file], title, text);
  if (outcome === 'unsupported') download(output);
  return outcome;
}

// Runs `task` only when no other export/share/print holds `lock` (a ref-like { current }).
// Returns undefined without running when locked; always releases the lock afterwards.
export async function runExclusive(lock, task) {
  if (lock.current) return undefined;
  lock.current = true;
  try { return await task(); } finally { lock.current = false; }
}
