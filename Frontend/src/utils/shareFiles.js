export async function shareFiles(files, title, text) {
  if (!navigator.share) {
    throw new Error('Sharing is not supported on this browser. Use the download buttons to share the files manually.');
  }
  
  if (navigator.canShare) {
    if (!navigator.canShare({ files })) {
      throw new Error('File sharing is unavailable on this browser/device. Use the download buttons to share the files manually.');
    }
  }

  try {
    await navigator.share({
      files,
      title,
      text
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      return; // User cancelled, do not throw
    }
    throw err;
  }
}
