import { useEffect, useMemo, useState } from 'react';
import { cachedLogoDataUrl, hydrateRecordLogo, logoReference, withLogoDataUrl } from '../../utils/logoHydration.js';

// Resolves a finalized bill's logo reference into businessSnapshot.logoDataUrl before the bill
// is rendered or exported. `pending` stays true until the fetch settles (bounded wait), so
// Print / Download can be disabled meanwhile. The returned record keeps a stable identity across
// renders, because BillView effects (pagination, history preview) depend on it.
export default function useLogoHydration(record) {
  const sha = logoReference(record?.businessSnapshot);
  const key = sha ? `${record.id}:${record.updatedAt || ''}:${sha}` : '';
  const [settled, setSettled] = useState(null);
  const current = sha && settled?.key === key && settled.source === record ? settled.record : null;
  const cached = sha && !current ? cachedLogoDataUrl(sha) : undefined;
  const fromCache = useMemo(() => cached ? withLogoDataUrl(record, cached) : null, [record, cached]);
  useEffect(() => {
    if (!sha || cached) return undefined;
    let live = true;
    hydrateRecordLogo(record).then(result => { if (live) setSettled({ key, source: record, record: result }); });
    return () => { live = false; };
  }, [record, sha, key, cached]);
  if (!sha) return { record, pending: false };
  if (current) return { record: current, pending: false };
  if (fromCache) return { record: fromCache, pending: false };
  return { record, pending: true };
}
