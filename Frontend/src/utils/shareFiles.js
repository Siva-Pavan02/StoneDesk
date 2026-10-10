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
