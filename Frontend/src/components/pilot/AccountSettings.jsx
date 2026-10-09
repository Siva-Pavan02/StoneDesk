import { useEffect, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { request } from '../../lib/pilotApi.js';
import { Button, Card, ErrorMessage, Field } from './Controls.jsx';

export default function AccountSettings({ settings, user, section, navigate, onLogout, onLegacySettings, onLanding }) {
  const { pick, language, setLanguage } = useLanguage();
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const admin = user.role === 'Admin';
  const sections = [['general', 'General', 'సాధారణ'], ...(admin ? [['business', 'Business', 'వ్యాపారం'], ['team', 'Team & access', 'బృందం మరియు యాక్సెస్']] : []), ['account', 'Account & security', 'ఖాతా మరియు భద్రత']];
  const activeSection = sections.some(([key]) => key === section) ? section : 'general';
  async function copyCode() {
    try { await navigator.clipboard.writeText(settings.organizationId); setNotice(pick('Organization ID copied', 'సంస్థ ఐడీ కాపీ అయింది')); }
    catch { setNotice(pick('Select and copy the organization ID below.', 'క్రింద సంస్థ ఐడీని ఎంచుకుని కాపీ చేయండి.')); }
  }
  async function refresh() {
    try { setUsers(await request('/auth/users')); } catch (err) { setError(err.message); }
  }
  useEffect(() => { if (admin && activeSection === 'team') request('/auth/users').then(setUsers).catch(err => setError(err.message)); }, [admin, activeSection]);
  async function saveUser(e, member) {
    e.preventDefault(); if (busy) return; setBusy(true); setError('');
    const data = new FormData(e.currentTarget);
    try { await request(`/auth/users/${member.id}`, { method: 'PATCH', body: { role: data.get('role'), active: data.get('active') === 'on' } }); await refresh(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function changePassword(e) {
    e.preventDefault(); if (busy) return; setBusy(true); setError(''); setNotice('');
    try { await request('/auth/password', { method: 'POST', body: Object.fromEntries(new FormData(e.currentTarget)) }); e.target.reset(); setNotice(pick('Password updated. Other sessions have been signed out.', 'పాస్‌వర్డ్ మార్చబడింది. ఇతర పరికరాలలో లాగ్ అవుట్ అయింది.')); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <div className="settings-screen">
    <h1 className="text-2xl font-bold">{pick('Settings', 'సెట్టింగ్స్')}</h1><ErrorMessage error={error} />
    <div className="settings-tabs" role="tablist" aria-label={pick('Settings sections', 'సెట్టింగ్స్ విభాగాలు')}>{sections.map(([key, en, te], index) => <button type="button" key={key} id={`settings-tab-${key}`} role="tab" tabIndex={activeSection === key ? 0 : -1} aria-selected={activeSection === key} aria-controls="settings-panel" onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? sections.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + sections.length) % sections.length;
      navigate(`settings/${sections[next][0]}`); document.getElementById(`settings-tab-${sections[next][0]}`)?.focus();
    }} onClick={() => { setNotice(''); navigate(`settings/${key}`); }}>{pick(en, te)}</button>)}</div>
    {notice && <p role="status" className="success-message">{notice}</p>}
    <div id="settings-panel" className="settings-panel" role="tabpanel" tabIndex={0} aria-labelledby={`settings-tab-${activeSection}`}>
    {activeSection === 'general' && <>
    <Card className="settings-language">
      <div className="settings-summary"><h2>{pick('Language', 'భాష')}</h2><p>{pick('Choose the language used on this device.', 'ఈ పరికరంలో ఉపయోగించే భాషను ఎంచుకోండి.')}</p></div>
      <div className="settings-language-options" role="group" aria-label={pick('Language', 'భాష')}>
        {[['en', 'English'], ['te', 'తెలుగు']].map(([value, label]) => <button type="button" key={value} lang={value} aria-pressed={language === value} onClick={() => setLanguage(value)}>{label}</button>)}
      </div>
    </Card>
    <Card className="settings-organization">
      <div className="settings-summary"><h2>{pick('Your organization', 'మీ సంస్థ')}</h2><p className="settings-business-name">{settings?.businessName}</p></div>
      <div className="settings-organization-code">
        <label htmlFor="settings-organization-id">{pick('Organization ID', 'సంస్థ ఐడీ')}</label>
        <div className="settings-code-control"><input id="settings-organization-id" readOnly value={settings?.organizationId || ''} /><Button en="Copy organization ID" te="సంస్థ ఐడీ కాపీ చేయండి" disabled={!settings?.organizationId} onClick={copyCode} /></div>
      </div>
      <p className="settings-help">{pick('Share this ID only with your team. They can choose Join organization when creating an account. This ID is reusable and does not expire.', 'ఈ ఐడీని మీ బృందంతో మాత్రమే పంచుకోండి. ఖాతా సృష్టించేటప్పుడు సంస్థలో చేరండి ఎంచుకోవచ్చు. ఈ ఐడీని మళ్ళీ ఉపయోగించవచ్చు; గడువు లేదు.')}</p>
    </Card>
    <Card className="settings-links gap-3"><h2 className="font-bold">{pick('Workspace', 'వర్క్‌స్పేస్')}</h2><Button en="View welcome page" te="స్వాగత పేజీ చూడండి" onClick={onLanding} /><p className="text-sm text-gray-700">{pick('Measurements: feet and square feet. Currency: INR. GST is not calculated.', 'కొలతలు: అడుగులు మరియు చదరపు అడుగులు. కరెన్సీ: INR. GST లెక్కించబడదు.')}</p></Card>
    </>}
    {activeSection === 'business' && admin && <Card className="settings-links gap-3"><h2 className="font-bold">{pick('Business', 'వ్యాపారం')}</h2><Button en="Business profile & default charges" te="వ్యాపార వివరాలు మరియు డిఫాల్ట్ ఛార్జీలు" onClick={() => navigate('profile')} /><Button en="Products & rates" te="రకాలు మరియు ధరలు" onClick={() => navigate('products')} /><Button en="Saved trucks & destinations" te="లారీలు మరియు గమ్యస్థానాలు" onClick={onLegacySettings} /></Card>}
    {activeSection === 'team' && admin && <section className="space-y-3"><div className="flex items-center justify-between"><h2 className="font-bold text-lg">{pick('Team & access', 'బృందం మరియు యాక్సెస్')}</h2><button className="text-button" onClick={refresh}>{pick('Refresh', 'రిఫ్రెష్')}</button></div><p className="text-sm text-gray-700">{pick('Manage access for people who belong to this business. Yard Managers can prepare loads; Dispatchers can also finalize and mark deliveries.', 'ఈ వ్యాపారానికి చెందిన వ్యక్తులను మాత్రమే ఆమోదించండి. యార్డ్ మేనేజర్లు లోడ్లు సిద్ధం చేస్తారు; డిస్పాచర్లు ఖరారు చేసి డెలివరీ నమోదు చేయవచ్చు.')}</p>
      {users.map(member => <Card key={member.id} className="gap-3"><strong>{member.name}</strong><p className="break-all text-sm">{member.email}</p>{member.isOwner || member.id === user.id ? <p className="text-sm text-gray-700">{member.isOwner ? pick('Business owner · Admin', 'వ్యాపార యజమాని · అడ్మిన్') : member.role}</p> : <form onSubmit={e => saveUser(e, member)} className="space-y-3"><Field en="Role" te="పాత్ర"><select name="role" className="input rounded-xl" defaultValue={member.role}>{[['Admin', 'అడ్మిన్'], ['Yard Manager', 'యార్డ్ మేనేజర్'], ['Dispatcher', 'డిస్పాచర్']].map(([en, te]) => <option key={en} value={en}>{pick(en, te)}</option>)}</select></Field><label className="flex min-h-12 items-center gap-3"><input name="active" type="checkbox" className="h-5 w-5 accent-teal-800" defaultChecked={member.active} />{pick('Allow workspace access', 'వర్క్‌స్పేస్ యాక్సెస్ అనుమతించండి')}</label><Button type="submit" className="w-full" disabled={busy} en="Save access" te="యాక్సెస్ సేవ్ చేయండి" /></form>}</Card>)}
    </section>}
    {activeSection === 'account' && <>
    <Card className="gap-2"><h2 className="font-bold text-lg break-words">{user.name}</h2><p className="break-all text-gray-700">{user.email}</p><p className="text-sm font-semibold">{pick(user.role, user.role === 'Admin' ? 'అడ్మిన్' : user.role === 'Yard Manager' ? 'యార్డ్ మేనేజర్' : 'డిస్పాచర్')}</p></Card>
    <form onSubmit={changePassword}><Card className="gap-4"><h2 className="font-bold">{pick('Change password', 'పాస్‌వర్డ్ మార్చండి')}</h2><Field name="currentPassword" en="Current password" te="ప్రస్తుత పాస్‌వర్డ్" type="password" autoComplete="current-password" maxLength={128} required /><Field name="password" en="New password (12+ characters)" te="కొత్త పాస్‌వర్డ్ (12+ అక్షరాలు)" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /><Button type="submit" disabled={busy} en="Update password" te="పాస్‌వర్డ్ మార్చండి" /></Card></form>
    <Button en="Log out" te="లాగ్ అవుట్" onClick={onLogout} />
    </>}
    </div>
  </div>;
}
