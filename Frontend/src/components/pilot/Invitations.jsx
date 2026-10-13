import { useEffect, useState } from 'react';
import { request } from '../../lib/pilotApi.js';
import { useLanguage } from '../../i18n/LanguageContext';
import { Button, Field, ErrorMessage } from './Controls.jsx';

export default function Invitations() {
  const { pick } = useLanguage();
  const [items, setItems] = useState([]);
  const [issued, setIssued] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { let active = true; request('/auth/invitations').then(data => { if (active) setItems(data); }).catch(err => { if (active) setError(err.message); }); return () => { active = false; }; }, []);
  async function create(e) {
    e.preventDefault(); if (busy) return;
    const form = e.currentTarget; setBusy(true); setError(''); setIssued(null);
    try {
      const item = await request('/auth/invitations', { method: 'POST', body: Object.fromEntries(new FormData(form)) });
      setIssued(item); setItems(rows => [item, ...rows].slice(0, 50)); form.reset();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function revoke(id) {
    if (busy) return; setBusy(true); setError('');
    try { await request(`/auth/invitations/${id}`, { method: 'DELETE' }); setItems(rows => rows.filter(row => row.id !== id)); if (issued?.id === id) setIssued(null); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <div className="st-card space-y-3 p-4">
    <h3>{pick('Invite a team member', 'బృంద సభ్యుడిని ఆహ్వానించండి')}</h3>
    <p>{pick('One use, valid for 7 days and only for the entered email. Share the code privately; it is shown once.', 'ఒక్కసారి మాత్రమే, నమోదు చేసిన ఇమెయిల్‌కు 7 రోజులు చెల్లుతుంది. కోడ్ ఒక్కసారే కనిపిస్తుంది; వ్యక్తిగతంగా పంచుకోండి.')}</p>
    <ErrorMessage error={error} />
    <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
      <Field name="email" type="email" required maxLength={254} en="Member email" te="సభ్యుని ఇమెయిల్" />
      <Field en="Role" te="పాత్ర"><select name="role" className="input"><option value="Dispatcher">{pick('Dispatcher', 'డిస్పాచర్')}</option><option value="YardManager">{pick('Yard Manager', 'యార్డ్ మేనేజర్')}</option></select></Field>
      <Button type="submit" disabled={busy} en="Create invitation" te="ఆహ్వానం సృష్టించండి" />
    </form>
    {issued && <Field en="Invitation code — copy and share privately" te="ఆహ్వాన కోడ్ — కాపీ చేసి వ్యక్తిగతంగా పంచుకోండి" value={issued.token} readOnly onFocus={e => e.target.select()} />}
    {items.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2"><span className="break-all">{item.email}</span><Button disabled={busy} onClick={() => revoke(item.id)} en="Revoke invitation" te="ఆహ్వానం రద్దు చేయండి" /></div>)}
  </div>;
}
