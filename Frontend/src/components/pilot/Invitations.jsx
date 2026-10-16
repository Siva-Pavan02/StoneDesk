import { useEffect, useState } from 'react';
import { request } from '../../lib/pilotApi.js';
import { Button, Field, ErrorMessage } from './Controls.jsx';
import { roleLabel, roleTone } from '../../utils/roles.js';

export default function Invitations() {
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
    if (!window.confirm(`Revoke the invitation for ${item.email}? The code will stop working.`)) return;
    setBusy(item.id); setError('');
    try { await request(`/auth/invitations/${item.id}`, { method: 'DELETE' }); setItems(rows => rows.filter(row => row.id !== item.id)); if (issued?.id === item.id) setIssued(null); }
    catch (err) { setError(err.message); } finally { setBusy(''); }
  }
  return <div className="st-card st-invite">
    <h3 className="st-invite-title">Invite a team member</h3>
    <p className="st-invite-hint">One use, valid for 7 days and only for the entered email. Share the code privately; it is shown once.</p>
    <ErrorMessage error={error} />
    <form onSubmit={create} className="st-invite-form">
      <Field name="email" type="email" required maxLength={254} autoComplete="off" autoCapitalize="none" spellCheck={false} error={emailError} onInput={() => setEmailError('')} label="Member email" />
      <Field label="Role"><select name="role" className="input"><option value="Dispatcher">Dispatcher</option><option value="YardManager">Manager</option></select></Field>
      <Button type="submit" primary disabled={!!busy} aria-busy={busy === 'create' || undefined} label={busy === 'create' ? 'Creating…' : 'Create invitation'} />
    </form>
    {issued && <>
      <p role="status" className="sr-only">{`Invitation created for ${issued.email}. Copy the code below.`}</p>
      <Field label="Invitation code — copy and share privately" value={issued.token} readOnly spellCheck={false} translate="no" onFocus={e => e.target.select()} />
    </>}
    {items.length > 0 && <ul className="st-rows st-invite-list">
      {items.map(item => <li key={item.id} className="st-row st-invite-row">
        <span className="st-invite-email" translate="no">{item.email}</span>
        <span className="st-invite-meta"><span className="mn-tag" data-tone={roleTone(item.role)}>{roleLabel(item.role)}</span><span className="mn-tag" data-tone="pending">Pending</span></span>
        <Button variant="ghost" disabled={!!busy} onClick={() => revoke(item)} aria-label={`Revoke invitation for ${item.email}`} label="Revoke invitation" />
      </li>)}
    </ul>}
  </div>;
}
