import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { CheckIcon, CopyIcon, EyeClosedIcon, EyeOpenIcon } from '@radix-ui/react-icons';
import { useLanguage } from '../../i18n/LanguageContext';
import { request } from '../../lib/pilotApi.js';
import { Button, ErrorMessage, FieldError } from './Controls.jsx';
import Invitations from './Invitations.jsx';

const ROLES = [['Admin', 'అడ్మిన్'], ['Yard Manager', 'యార్డ్ మేనేజర్'], ['Dispatcher', 'డిస్పాచర్']];
// Admin is the workspace owner and cannot be edited afterwards, so it is not offered for team members.
const MEMBER_ROLES = ROLES.filter(([en]) => en !== 'Admin');

function PasswordField({ en, te, error, inputRef, ...props }) {
  const { pick } = useLanguage();
  const id = useId();
  const [shown, setShown] = useState(false);
  return <div className="control-field">
    <label className="control-label" htmlFor={id}>{pick(en, te)}</label>
    <div className="password-control">
      <input className="input" {...props} ref={inputRef} id={id} type={shown ? 'text' : 'password'} autoCapitalize="none" spellCheck={false} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} />
      <button type="button" className="password-toggle" aria-controls={id} aria-pressed={shown} aria-label={pick('Show password', 'పాస్‌వర్డ్ చూపించు')} onClick={() => setShown(value => !value)}>
        {shown ? <EyeClosedIcon aria-hidden="true" /> : <EyeOpenIcon aria-hidden="true" />}
      </button>
    </div>
    <FieldError id={`${id}-error`} error={error} />
  </div>;
}

function MemberAccess({ member, disabled, saving, onSave, onDirty }) {
  const { pick } = useLanguage();
  const [role, setRole] = useState(member.role);
  const [active, setActive] = useState(member.active);
  const changed = role !== member.role || active !== member.active;
  useEffect(() => { onDirty?.(`member:${member.id}`, changed); }, [onDirty, member.id, changed]);
  useEffect(() => () => onDirty?.(`member:${member.id}`, false), [onDirty, member.id]);
  function submit(e) {
    e.preventDefault();
    if (member.active && !active && !window.confirm(pick(`Remove workspace access for ${member.name}? They won’t be able to open this workspace.`, `${member.name} కి వర్క్‌స్పేస్ యాక్సెస్ తొలగించాలా? వారు ఈ వర్క్‌స్పేస్ తెరవలేరు.`))) return;
    onSave(member, { role, active });
  }
  return <form className="st-access" onSubmit={submit}>
    <select name="role" className="input st-access-role" aria-label={pick('Role', 'పాత్ర')} value={role} onChange={e => setRole(e.target.value)}>
      {MEMBER_ROLES.map(([en, te]) => <option key={en} value={en}>{pick(en, te)}</option>)}
    </select>
    <label className="st-switch"><input name="active" type="checkbox" role="switch" checked={active} onChange={e => setActive(e.target.checked)} /><span className="st-switch-track" aria-hidden="true" />{pick('Access', 'యాక్సెస్')}</label>
    {changed && <Button type="submit" primary className="st-access-save" disabled={disabled} aria-busy={saving || undefined} en={saving ? 'Saving…' : 'Save access'} te={saving ? 'సేవ్ అవుతోంది…' : 'యాక్సెస్ సేవ్ చేయండి'} />}
  </form>;
}

function DeleteAccount({ user, onDeleted }) {
  const { pick } = useLanguage();
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
  const title = owner ? pick('Delete account and business', 'ఖాతా మరియు వ్యాపారాన్ని తొలగించండి') : pick('Delete account', 'ఖాతా తొలగించండి');
  const detail = owner
    ? pick('Permanently removes your business, every bill, load and setting, and all team accounts. This cannot be undone.', 'మీ వ్యాపారం, అన్ని బిల్లులు, లోడ్లు, సెట్టింగ్స్ మరియు బృందం ఖాతాలు శాశ్వతంగా తొలగిపోతాయి. తిరిగి తేలేరు.')
    : pick('Permanently removes your sign-in. Bills you made stay with the business.', 'మీ లాగిన్ శాశ్వతంగా తొలగిపోతుంది. మీరు చేసిన బిల్లులు వ్యాపారంలోనే ఉంటాయి.');
  return <div className="st-card st-danger">
    <div className="st-danger-row">
      <div><strong>{title}</strong><p>{detail}</p></div>
      {!open && <button type="button" className="st-danger-button" onClick={() => setOpen(true)}>{pick('Delete…', 'తొలగించు…')}</button>}
    </div>
    {open && <form className="st-danger-confirm" onSubmit={submit}>
      <label htmlFor={inputId}>{pick('Type your email to confirm:', 'నిర్ధారించడానికి మీ ఇమెయిల్ టైప్ చేయండి:')} <b translate="no">{user.email}</b></label>
      <input id={inputId} name="confirmEmail" type="email" inputMode="email" className="input" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={254} value={confirm} onChange={e => setConfirm(e.target.value)} autoFocus />
      <ErrorMessage error={error} />
      <div className="st-danger-actions">
        <button type="button" className="st-link" disabled={busy} onClick={() => { setOpen(false); setConfirm(''); setError(''); }}>{pick('Cancel', 'రద్దు')}</button>
        <button type="submit" className="st-danger-button st-danger-submit" disabled={!matches || busy} aria-busy={busy || undefined}>{busy ? pick('Deleting…', 'తొలగిస్తోంది…') : pick('Delete permanently', 'శాశ్వతంగా తొలగించు')}</button>
      </div>
    </form>}
  </div>;
}

export default function AccountSettings({ settings, user, section, onDeleted, onUserChange }) {
  const { pick } = useLanguage();
  const [users, setUsers] = useState([]);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState('');
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef(0);
  const [loadingTeam, setLoadingTeam] = useState(user.role === 'Admin');
  const [refreshing, setRefreshing] = useState(false);
  const admin = user.role === 'Admin';
  const roleLabel = role => pick(role, ROLES.find(([en]) => en === role)?.[1] || role);
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
    catch { showNotice('general', pick('Select and copy the organization ID above.', 'పైన ఉన్న సంస్థ ఐడీని ఎంచుకుని కాపీ చేయండి.')); }
  }
  async function refreshTeam() {
    if (refreshing) return; setRefreshing(true); setMessage(null);
    try { setUsers(await request('/auth/users')); showNotice('team', pick('Team list updated', 'బృందం జాబితా నవీకరించబడింది')); }
    catch (err) { showError('team', err); } finally { setRefreshing(false); }
  }
  function accessNotice(before, after) {
    const name = after.name || before.name;
    if (before.active && !after.active) return pick(`Access removed. ${name} has been signed out.`, `యాక్సెస్ తొలగించబడింది. ${name} లాగ్ అవుట్ అయ్యారు.`);
    if (!before.active && after.active) return pick(`Access restored. ${name} can sign in as ${after.role}.`, `యాక్సెస్ పునరుద్ధరించబడింది. ${name} ${roleLabel(after.role)} గా లాగిన్ అవ్వచ్చు.`);
    return pick(`${name} is now a ${after.role}. They’ll sign in again to continue.`, `${name} ఇప్పుడు ${roleLabel(after.role)}. కొనసాగడానికి మళ్ళీ లాగిన్ అవ్వాలి.`);
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
        ? pick('Password set. You can now also log in with email and password.', 'పాస్‌వర్డ్ సెట్ అయింది. ఇప్పుడు ఇమెయిల్ మరియు పాస్‌వర్డ్‌తో కూడా లాగిన్ అవ్వచ్చు.')
        : pick('Password updated. Other sessions have been signed out.', 'పాస్‌వర్డ్ మార్చబడింది. ఇతర పరికరాలలో లాగ్ అవుట్ అయింది.'));
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
      showNotice('account', pick('If that email exists, we sent a link', 'ఆ ఇమెయిల్ ఉంటే, మేము లింక్ పంపాము'));
    }
    catch (err) { showError('account', err); } finally { setBusy(''); }
  }

  const feedback = (key, member) => message?.section === key && message.member === member && (message.error
    ? <ErrorMessage error={message.error} />
    : <p role="status" className="success-message">{message.notice}</p>);
  const head = (key, en, te, den, dte, extra) => <header className="st-head">
    <div>
      <h2 id={`settings-${key}-heading`} tabIndex={-1}>{pick(en, te)}</h2>
      {den && <p>{typeof den === 'string' ? pick(den, dte) : den}</p>}
    </div>
    {extra}
  </header>;

  return <div className="st-page">
    <h1 className="st-title">{pick('Settings', 'సెట్టింగ్స్')}</h1>

    <section id="settings-general" className="st-section" aria-labelledby="settings-general-heading">
      {head('general', 'Organization', 'సంస్థ', 'This ID identifies your business. New members need a private invitation from an administrator.', 'ఈ ఐడీ మీ వ్యాపారాన్ని గుర్తిస్తుంది. కొత్త సభ్యులకు అడ్మిన్ నుండి వ్యక్తిగత ఆహ్వానం అవసరం.')}
      <div className="st-card">
      <dl className="st-rows">
        <div className="st-row">
          <dt>{pick('Business name', 'వ్యాపారం పేరు')}</dt>
          <dd>{settings?.businessName || '—'}</dd>
        </div>
        <div className="st-row">
          <dt><label htmlFor="settings-organization-id">{pick('Organization ID', 'సంస్థ ఐడీ')}</label></dt>
          <dd className="st-code">
            <input id="settings-organization-id" readOnly spellCheck={false} size={14} value={settings?.organizationId || ''} onFocus={e => e.target.select()} />
            <button type="button" className="st-link settings-copy-button" data-copied={copied || undefined} disabled={!settings?.organizationId} onClick={copyCode}>{copied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}<span>{copied ? pick('Copied', 'కాపీ అయింది') : pick('Copy organization ID', 'సంస్థ ఐడీ కాపీ చేయండి')}</span></button>
            <span className="sr-only" role="status">{copied ? pick('Organization ID copied', 'సంస్థ ఐడీ కాపీ అయింది') : ''}</span>
          </dd>
        </div>
      </dl>
      </div>
      {feedback('general')}
    </section>

    {admin && <section id="settings-team" className="st-section" aria-labelledby="settings-team-heading">
      {head('team', 'Team', 'బృందం', 'Yard Managers prepare loads. Dispatchers can also finalize and mark deliveries.', 'యార్డ్ మేనేజర్లు లోడ్లు సిద్ధం చేస్తారు. డిస్పాచర్లు ఖరారు చేసి డెలివరీ నమోదు చేయవచ్చు.',
        <button type="button" className="st-link" disabled={refreshing} aria-busy={refreshing || undefined} onClick={refreshTeam}>{refreshing ? pick('Refreshing…', 'రిఫ్రెష్ అవుతోంది…') : pick('Refresh', 'రిఫ్రెష్')}</button>)}
      <Invitations />
      {loadingTeam && users.length === 0 && <p role="status" className="st-muted">{pick('Loading team…', 'బృందం లోడ్ అవుతోంది…')}</p>}
      {users.length > 0 && <ul className="st-rows st-card">
        {users.map(member => <li key={member.id} className="st-row st-member">
          <div className="st-person">
            <span className="st-avatar" aria-hidden="true">{member.name?.[0]?.toUpperCase()}</span>
            <div><strong>{member.name}{!member.active && <span className="st-member-off">{pick('No access', 'యాక్సెస్ లేదు')}</span>}</strong><small translate="no">{member.email}</small></div>
          </div>
          {member.isOwner || member.id === user.id
            ? <span className="st-muted">{member.isOwner ? pick('Owner · Admin', 'యజమాని · అడ్మిన్') : roleLabel(member.role)}</span>
            : <MemberAccess member={member} disabled={!!busy} saving={busy === `member:${member.id}`} onSave={saveUser} onDirty={markDirty} />}
          {message?.member === member.id && <div className="st-member-status">{feedback('team', member.id)}</div>}
        </li>)}
      </ul>}
      {feedback('team')}
    </section>}

    <section id="settings-account" className="st-section" aria-labelledby="settings-account-heading">
      {head('account', 'Your account', 'మీ ఖాతా', <>{user.name} · <span translate="no">{user.email}</span> · {roleLabel(user.role)}</>)}
      {passwordFree
        ? <form key="set" className="st-password st-card" onSubmit={savePassword} onInput={() => { markDirty('password', true); setPasswordError(null); }}>
            <h3 className="st-password-heading">{pick('Set a password', 'పాస్‌వర్డ్ సెట్ చేయండి')}</h3>
            <p>{pick('You sign in with Google. Add a password to also log in with your email.', 'మీరు Googleతో లాగిన్ అవుతారు. ఇమెయిల్‌తో కూడా లాగిన్ అవ్వడానికి పాస్‌వర్డ్ జోడించండి.')}</p>
            <input type="text" autoComplete="username" value={user.email || ''} readOnly hidden />
            <PasswordField name="password" inputRef={newPasswordInput} error={passwordError?.field === 'password' ? passwordError.message : ''} en="New password (12+ characters)" te="కొత్త పాస్‌వర్డ్ (12+ అక్షరాలు)" autoComplete="new-password" minLength={12} maxLength={128} required />
            <div><Button type="submit" disabled={!!busy} en={busy === 'password' ? 'Setting…' : 'Set password'} te={busy === 'password' ? 'సెట్ చేస్తోంది…' : 'పాస్‌వర్డ్ సెట్ చేయండి'} /></div>
          </form>
        : <form key="change" className="st-password st-card" onSubmit={savePassword} onInput={() => { markDirty('password', true); setPasswordError(null); }}>
            <input type="text" autoComplete="username" value={user.email || ''} readOnly hidden />
            <PasswordField name="currentPassword" inputRef={currentPasswordInput} error={passwordError?.field === 'currentPassword' ? passwordError.message : ''} en="Current password" te="ప్రస్తుత పాస్‌వర్డ్" autoComplete="current-password" maxLength={128} required />
            <PasswordField name="password" inputRef={newPasswordInput} error={passwordError?.field === 'password' ? passwordError.message : ''} en="New password (12+ characters)" te="కొత్త పాస్‌వర్డ్ (12+ అక్షరాలు)" autoComplete="new-password" minLength={12} maxLength={128} required />
            <div><Button type="submit" disabled={!!busy} en={busy === 'password' ? 'Updating…' : 'Update password'} te={busy === 'password' ? 'మారుస్తోంది…' : 'పాస్‌వర్డ్ మార్చండి'} /></div>
            {user.hasGoogle === true && <div className="st-password-reset">
              <p>{pick('Signed up with Google and never chose a password? Email yourself a reset link to set one.', 'Googleతో నమోదు చేసి ఎప్పుడూ పాస్‌వర్డ్ ఎంచుకోలేదా? పాస్‌వర్డ్ సెట్ చేయడానికి రీసెట్ లింక్‌ను మీ ఇమెయిల్‌కు పంపుకోండి.')}</p>
              <button type="button" className="st-link" disabled={!!busy} aria-busy={busy === 'reset-link' || undefined} onClick={sendResetLink}>
                {busy === 'reset-link' ? pick('Sending…', 'పంపుతోంది…') : pick('Email me a reset link', 'నాకు రీసెట్ లింక్ పంపండి')}
              </button>
            </div>}
          </form>}
      {feedback('account')}
    </section>

    <section id="settings-delete" className="st-section" aria-labelledby="settings-delete-heading">
      {head('delete', 'Danger zone', 'ప్రమాద ప్రాంతం', admin ? 'Close StoneDesk for your whole business.' : 'Leave this business.', admin ? 'మీ వ్యాపారానికి StoneDesk మూసివేయండి.' : 'ఈ వ్యాపారం నుండి వెళ్లండి.')}
      <DeleteAccount user={user} onDeleted={onDeleted} />
    </section>
  </div>;
}
