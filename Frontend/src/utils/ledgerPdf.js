// The legacy ledger PDF layout was retired: buyer and driver copies now come from the A4 engine
// (a4InvoicePdf.js). Only the shared download filename helper remains.
export function billFilename(dispatch, kind, ext) {
  const party = String(dispatch.partyName || '').trim().replace(/[^\p{L}\p{M}\p{N}-]+/gu, '_').replace(/^_+|_+$/g, '').slice(0, 60);
  const time = new Date(dispatch.date);
  const date = Number.isNaN(time.getTime()) ? 'undated' : time.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).replace(/\s+/g, '-');
  return `${party ? `${party}-` : ''}${kind}-${date}.${ext}`;
}
