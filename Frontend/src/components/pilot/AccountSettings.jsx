import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { CheckIcon, CopyIcon, EyeClosedIcon, EyeOpenIcon } from '@radix-ui/react-icons';
import { request } from '../../lib/pilotApi.js';
import { Button, ErrorMessage, FieldError } from './Controls.jsx';
import Invitations from './Invitations.jsx';
import { roleLabel, roleTone } from '../../utils/roles.js';

const ROLES = ['Admin', 'Yard Manager', 'Dispatcher'];
// Admin is the workspace owner and cannot be edited afterwards, so it is not offered for team members.
const MEMBER_ROLES = ROLES.filter(role => role !== 'Admin');

function PasswordField({ label, error, inputRef, ...props }) {
  const id = useId();
  const [shown, setShown] = useState(false);
  return <div className="control-field">
    <label className="control-label" htmlFor={id}>{label}</label>
    <div className="password-control">
      <input className="input" {...props} ref={inputRef} id={id} type={shown ? 'text' : 'password'} autoCapitalize="none" spellCheck={false} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} />
      <button type="button" className="password-toggle" aria-controls={id} aria-pressed={shown} aria-label="Show password" onClick={() => setShown(value => !value)}>
        {shown ? <EyeClosedIcon aria-hidden="true" /> : <EyeOpenIcon aria-hidden="true" />}
      </button>
    </div>
    <FieldError id={`${id}-error`} error={error} />
  </div>;
}

function MemberAccess({ member, disabled, saving, onSave, onDirty }) {
  const [role, setRole] = useState(member.role);
  const [active, setActive] = useState(member.active);
  const changed = role !== member.role || active !== member.active;
  useEffect(() => { onDirty?.(`member:${member.id}`, changed); }, [onDirty, member.id, changed]);
  useEffect(() => () => onDirty?.(`member:${member.id}`, false), [onDirty, member.id]);
  function submit(e) {
    e.preventDefault();
    if (member.active && !active && !window.confirm(`Remove workspace access for ${member.name}? They won’t be able to open this workspace.`)) return;
    onSave(member, { role, active });
  }
  return <form className="st-access" onSubmit={submit}>
    <select name="role" className="input st-access-role" aria-label="Role" value={role} onChange={e => setRole(e.target.value)}>
      {MEMBER_ROLES.map(role => <option key={role} value={role}>{roleLabel(role)}</option>)}
    </select>
    <label className="st-switch"><input name="active" type="checkbox" role="switch" checked={active} onChange={e => setActive(e.target.checked)} /><span className="st-switch-track" aria-hidden="true" />Access</label>
    {changed && <Button type="submit" primary className="st-access-save" disabled={disabled} aria-busy={saving || undefined} label={saving ? 'Saving…' : 'Save access'} />}
  </form>;
}

function DeleteAccount({ user, onDeleted }) {
  const owner = user.role === 'Admin';
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputId = useId();
  const matches = confirm.trim().toLowerCase() === user.email.toLowerCase();
  async function submit(e) {
    e.preventDefault(); if (busy || !matches) return; setBusy(true); setError('');
    try { await request('/auth/account', { method: 'DELETE', body: { confirm } }); onDeleted?.(); }
    catch (err) { setError(err.message); setBusy(false); }
  }
  const title = owner ? 'Delete account and business' : 'Delete account';
  const detail = owner
    ? 'Permanently removes your business, every bill, load and setting, and all team accounts. This cannot be undone.'
    : 'Permanently removes your sign-in. Bills you made stay with the business.';
  return <div className="st-card st-danger">
    <div className="st-danger-row">
      <div><strong>{title}</strong><p>{detail}</p></div>
      {!open && <Button variant="danger-quiet" onClick={() => setOpen(true)} label="Delete…" />}
    </div>
    {open && <form className="st-danger-confirm" onSubmit={submit}>
      <label htmlFor={inputId}>Type your email to confirm: <b translate="no">{user.email}</b></label>
      <input id={inputId} name="confirmEmail" type="email" inputMode="email" className="input" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={254} value={confirm} onChange={e => setConfirm(e.target.value)} autoFocus />
      <ErrorMessage error={error} />
      <div className="st-danger-actions">
        <Button variant="ghost" disabled={busy} onClick={() => { setOpen(false); setConfirm(''); setError(''); }} label="Cancel" />
        <Button type="submit" variant="danger" disabled={!matches || busy} aria-busy={busy || undefined} label={busy ? 'Deleting…' : 'Delete permanently'} />
      </div>
    </form>}
  </div>;
}

export default function AccountSettings({ settings, user, section, onDeleted, onUserChange }) {
  const [users, setUsers] = useState([]);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState('');
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef(0);
  const [loadingTeam, setLoadingTeam] = useState(user.role === 'Admin');
  const [refreshing, setRefreshing] = useState(false);
  const admin = user.role === 'Admin';
  const showError = (key, err) => setMessage({ section: key, error: err.message });
  const showNotice = (key, text) => setMessage({ section: key, notice: text });
  // Typed passwords and unsaved member access edits are lost on reload; warn while any exist.
  const [dirty, setDirty] = useState(() => new Set());
  const markDirty = useCallback((key, on) => setDirty(current => {
    if (current.has(key) === on) return current;
    const next = new Set(current);
    if (on) next.add(key); else next.delete(key);
    return next;
  }), []);
  useEffect(() => {
    if (!dirty.size) return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  // Password errors are shown under the field they concern.
  const [passwordError, setPasswordError] = useState(null);
  const currentPasswordInput = useRef(null), newPasswordInput = useRef(null);

  useEffect(() => {
    if (admin) request('/auth/users').then(setUsers).catch(err => setMessage({ section: 'team', error: err.message })).finally(() => setLoadingTeam(false));
  }, [admin]);

  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  useEffect(() => {
    if (section) document.getElementById(`settings-${section}`)?.scrollIntoView({ block: 'start' });
  }, [section]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(settings.organizationId);
      setCopied(true); clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 2000);
    }
    catch { showNotice('general', 'Select and copy the organization ID above.'); }
  }
  async function refreshTeam() {
    if (refreshing) return; setRefreshing(true); setMessage(null);
    try { setUsers(await request('/auth/users')); showNotice('team', 'Team list updated'); }
    catch (err) { showError('team', err); } finally { setRefreshing(false); }
  }
  function accessNotice(before, after) {
    const name = after.name || before.name;
    if (before.active && !after.active) return `Access removed. ${name} has been signed out.`;
    if (!before.active && after.active) return `Access restored. ${name} can sign in as ${roleLabel(after.role)}.`;
    return `${name} is now a ${roleLabel(after.role)}. They’ll sign in again to continue.`;
  }
  async function saveUser(member, body) {
    if (busy) return; setBusy(`member:${member.id}`); setMessage(null);
    try {
      const updated = await request(`/auth/users/${member.id}`, { method: 'PATCH', body });
      setUsers(list => list.map(u => u.id === member.id ? { ...u, ...updated } : u));
      setMessage({ section: 'team', member: member.id, notice: accessNotice(member, updated) });
    }
    catch (err) { setMessage({ section: 'team', member: member.id, error: err.message }); }
    finally { setBusy(''); }
  }
  const passwordFree = user.hasPassword === false; // undefined (older API) falls back to the safe "Change password" form.
  async function savePassword(e) {
    e.preventDefault(); if (busy) return; setBusy('password'); setMessage(null); setPasswordError(null);
    try {
      await request('/auth/password', { method: 'POST', body: Object.fromEntries(new FormData(e.currentTarget)) });
      e.target.reset();
      markDirty('password', false);
      showNotice('account', passwordFree
        ? 'Password set. You can now also log in with email and password.'
        : 'Password updated. Other sessions have been signed out.');
      // The server confirmed success; fall back to local state if the refresh read fails.
      request('/auth/me').then(d => onUserChange?.(d.user)).catch(() => onUserChange?.({ ...user, hasPassword: true }));
    }
    catch (err) {
      // "Current password" problems belong to that field; everything else to the new password.
      const field = !passwordFree && /current/i.test(err.message || '') ? 'currentPassword' : 'password';
      setPasswordError({ field, message: err.message });
      requestAnimationFrame(() => (field === 'currentPassword' ? currentPasswordInput : newPasswordInput).current?.focus());
    } finally { setBusy(''); }
  }
  async function sendResetLink() {
    if (busy) return; setBusy('reset-link'); setMessage(null);
    try {
      await request('/auth/forgot-password', { method: 'POST', body: { email: user.email } });
      showNotice('account', 'If that email exists, we sent a link');
    }
    catch (err) { showError('account', err); } finally { setBusy(''); }
  }

  const feedback = (key, member) => message?.section === key && message.member === member && (message.error
    ? <ErrorMessage error={message.error} />
    : <p role="status" className="success-message">{message.notice}</p>);
  const head = (key, title, description, extra) => <header className="st-head">
    <div>
      <h2 id={`settings-${key}-heading`} tabIndex={-1}>{title}</h2>
      {description && <p>{description}</p>}
    </div>
    {extra}
  </header>;

  return <div className="st-page">
    <h1 className="st-title">Settings</h1>

    <section id="settings-general" className="st-section" aria-labelledby="settings-general-heading">
      {head('general', 'Organization', 'This ID identifies your business. New members need a private invitation from an administrator.')}
      <div className="st-card">
      <dl className="st-rows">
        <div className="st-row">
          <dt>Business name</dt>
          <dd>{settings?.businessName || '—'}</dd>
        </div>
        <div className="st-row">
          <dt><label htmlFor="settings-organization-id">Organization ID</label></dt>
          <dd className="st-code">
            <input id="settings-organization-id" readOnly spellCheck={false} size={14} value={settings?.organizationId || ''} onFocus={e => e.target.select()} />
            <button type="button" className="text-button settings-copy-button" data-copied={copied || undefined} disabled={!settings?.organizationId} onClick={copyCode}>{copied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}<span>{copied ? 'Copied' : 'Copy organization ID'}</span></button>
            <span className="sr-only" role="status">{copied ? 'Organization ID copied' : ''}</span>
          </dd>
        </div>
      </dl>
      </div>
      {feedback('general')}
    </section>

    {admin && <section id="settings-team" className="st-section" aria-labelledby="settings-team-heading">
      {head('team', 'Team', 'Managers prepare loads and add products. Dispatchers can also finalize and mark deliveries.',
        <button type="button" className="text-button" disabled={refreshing} aria-busy={refreshing || undefined} onClick={refreshTeam}>{refreshing ? 'Refreshing…' : 'Refresh'}</button>)}
      <Invitations />
      {loadingTeam && users.length === 0 && <p role="status" className="st-muted">Loading team…</p>}
      {users.length > 0 && <ul className="st-rows st-card">
        {users.map(member => <li key={member.id} className="st-row st-member">
          <div className="st-person">
            <span className="st-avatar" aria-hidden="true">{member.name?.[0]?.toUpperCase()}</span>
            <div><strong>{member.name}{!member.active && <span className="mn-tag st-member-off" data-tone="off">No access</span>}</strong><small translate="no">{member.email}</small></div>
          </div>
          {member.isOwner || member.id === user.id
            ? <span className="mn-tag st-role" data-tone={roleTone(member.role)}>{member.isOwner ? 'Owner · Admin' : roleLabel(member.role)}</span>
            : <MemberAccess member={member} disabled={!!busy} saving={busy === `member:${member.id}`} onSave={saveUser} onDirty={markDirty} />}
          {message?.member === member.id && <div className="st-member-status">{feedback('team', member.id)}</div>}
        </li>)}
      </ul>}
      {feedback('team')}
    </section>}

    <section id="settings-account" className="st-section" aria-labelledby="settings-account-heading">
      {head('account', 'Your account', <>{user.name} · <span translate="no">{user.email}</span> · {roleLabel(user.role)}</>)}
      {passwordFree
        ? <form key="set" className="st-password st-card" onSubmit={savePassword} onInput={() => { markDirty('password', true); setPasswordError(null); }}>
            <h3 className="st-password-heading">Set a password</h3>
            <p>You sign in with Google. Add a password to also log in with your email.</p>
            <input type="text" autoComplete="username" value={user.email || ''} readOnly hidden />
            <PasswordField name="password" inputRef={newPasswordInput} error={passwordError?.field === 'password' ? passwordError.message : ''} label="New password (12+ characters)" autoComplete="new-password" minLength={12} maxLength={128} required />
            <div><Button type="submit" primary disabled={!!busy} label={busy === 'password' ? 'Setting…' : 'Set password'} /></div>
          </form>
        : <form key="change" className="st-password st-card" onSubmit={savePassword} onInput={() => { markDirty('password', true); setPasswordError(null); }}>
            <input type="text" autoComplete="username" value={user.email || ''} readOnly hidden />
            <PasswordField name="currentPassword" inputRef={currentPasswordInput} error={passwordError?.field === 'currentPassword' ? passwordError.message : ''} label="Current password" autoComplete="current-password" maxLength={128} required />
            <PasswordField name="password" inputRef={newPasswordInput} error={passwordError?.field === 'password' ? passwordError.message : ''} label="New password (12+ characters)" autoComplete="new-password" minLength={12} maxLength={128} required />
            <div><Button type="submit" primary disabled={!!busy} label={busy === 'password' ? 'Updating…' : 'Update password'} /></div>
            {user.hasGoogle === true && <div className="st-password-reset">
              <p>Signed up with Google and never chose a password? Email yourself a reset link to set one.</p>
              <button type="button" className="text-button" disabled={!!busy} aria-busy={busy === 'reset-link' || undefined} onClick={sendResetLink}>
                {busy === 'reset-link' ? 'Sending…' : 'Email me a reset link'}
              </button>
            </div>}
          </form>}
      {feedback('account')}
    </section>

    <section id="settings-delete" className="st-section" aria-labelledby="settings-delete-heading">
      {head('delete', 'Danger zone', admin ? 'Close StoneDesk for your whole business.' : 'Leave this business.')}
      <DeleteAccount user={user} onDeleted={onDeleted} />
    </section>
  </div>;
}
