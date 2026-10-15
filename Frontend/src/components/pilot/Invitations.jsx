import { useEffect, useState } from 'react';
import { request } from '../../lib/pilotApi.js';
import { useLanguage } from '../../i18n/LanguageContext';
import { Button, Field, ErrorMessage } from './Controls.jsx';

export default function Invitations() {
  const { pick } = useLanguage();
  const [items, setItems] = useState([]);
  const [issued, setIssued] = useState(null);
  // '' when idle, 'create' while creating, or the id being revoked.
  const [busy, setBusy] = useState('');
  // error: loading and revoking. emailError: creating, shown under the email field.
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  useEffect(() => { let active = true; request('/auth/invitations').then(data => { if (active) setItems(data); }).catch(err => { if (active) setError(err.message); }); return () => { active = false; }; }, []);
  async function create(e) {
    e.preventDefault(); if (busy) return;
    const form = e.currentTarget; setBusy('create'); setError(''); setEmailError(''); setIssued(null);
    try {
      const item = await request('/auth/invitations', { method: 'POST', body: Object.fromEntries(new FormData(form)) });
      setIssued(item); setItems(rows => [item, ...rows].slice(0, 50)); form.reset();
    } catch (err) {
      setEmailError(err.message);
      requestAnimationFrame(() => form.elements.namedItem('email')?.focus());
    } finally { setBusy(''); }
  }
  async function revoke(item) {
    if (busy) return;
    if (!window.confirm(pick(`Revoke the invitation for ${item.email}? The code will stop working.`, `${item.email} కోసం ఆహ్వానాన్ని రద్దు చేయాలా? కోడ్ పని చేయదు.`))) return;
    setBusy(item.id); setError('');
    try { await request(`/auth/invitations/${item.id}`, { method: 'DELETE' }); setItems(rows => rows.filter(row => row.id !== item.id)); if (issued?.id === item.id) setIssued(null); }
    catch (err) { setError(err.message); } finally { setBusy(''); }
  }
  return <div className="st-card space-y-3 p-4">
    <h3>{pick('Invite a team member', 'బృంద సభ్యుడిని ఆహ్వానించండి')}</h3>
    <p>{pick('One use, valid for 7 days and only for the entered email. Share the code privately; it is shown once.', 'ఒక్కసారి మాత్రమే, నమోదు చేసిన ఇమెయిల్‌కు 7 రోజులు చెల్లుతుంది. కోడ్ ఒక్కసారే కనిపిస్తుంది; వ్యక్తిగతంగా పంచుకోండి.')}</p>
    <ErrorMessage error={error} />
    <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
      <Field name="email" type="email" required maxLength={254} autoComplete="off" autoCapitalize="none" spellCheck={false} error={emailError} onInput={() => setEmailError('')} en="Member email" te="సభ్యుని ఇమెయిల్" />
      <Field en="Role" te="పాత్ర"><select name="role" className="input"><option value="Dispatcher">{pick('Dispatcher', 'డిస్పాచర్')}</option><option value="YardManager">{pick('Yard Manager', 'యార్డ్ మేనేజర్')}</option></select></Field>
      <Button type="submit" disabled={!!busy} aria-busy={busy === 'create' || undefined} en={busy === 'create' ? 'Creating…' : 'Create invitation'} te={busy === 'create' ? 'సృష్టిస్తోంది…' : 'ఆహ్వానం సృష్టించండి'} />
    </form>
    {issued && <>
      <p role="status" className="sr-only">{pick(`Invitation created for ${issued.email}. Copy the code below.`, `${issued.email} కోసం ఆహ్వానం సృష్టించబడింది. క్రింద ఉన్న కోడ్ కాపీ చేయండి.`)}</p>
      <Field en="Invitation code — copy and share privately" te="ఆహ్వాన కోడ్ — కాపీ చేసి వ్యక్తిగతంగా పంచుకోండి" value={issued.token} readOnly spellCheck={false} translate="no" onFocus={e => e.target.select()} />
    </>}
    {items.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2"><span className="break-all" translate="no">{item.email}</span><Button disabled={!!busy} onClick={() => revoke(item)} aria-label={pick(`Revoke invitation for ${item.email}`, `${item.email} ఆహ్వానం రద్దు చేయండి`)} en="Revoke invitation" te="ఆహ్వానం రద్దు చేయండి" /></div>)}
  </div>;
}
