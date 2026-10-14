import React, { useState } from 'react';
import { addTruck, removeTruck, addDestination, removeDestination } from '../../lib/api.js';
import { useLanguage } from '../../i18n/LanguageContext';
import { formatTruckNumber, truckPlateError } from '../../utils/truckPlate.js';
import { Button, Card, ErrorMessage, Field } from './Controls.jsx';

const plateMessages = {
  invalid: ['Use a valid number, like TN 01 AB 1234.', 'సరైన నంబర్ వాడండి, ఉదా: TN 01 AB 1234.'],
  duplicate: ['This truck is already saved.', 'ఈ లారీ ఇప్పటికే సేవ్ అయింది.']
};

// Moved from SettingsScreen.jsx with the same markup and references-* classes.
function ReferenceList({ kind, items, value, onValue, onAdd, adding, onRemove }) {
  const { t, pick } = useLanguage();
  const truck = kind === 'trucks';
  const [touched, setTouched] = useState(false);
  const code = truck ? truckPlateError(value, items) : '';
  const error = code ? pick(...plateMessages[code]) : '';
  const showError = Boolean(error) && touched;
  const errorId = `${kind}-add-error`;
  return <Card className="references-card">
    <div className="references-card-head">
      <h2>{t(kind)}</h2>
      <span>{items.length} {pick('saved', 'సేవ్ అయ్యాయి')}</span>
    </div>
    <form className="references-add" noValidate onSubmit={e => { e.preventDefault(); setTouched(true); if (!error) { onAdd(truck ? formatTruckNumber(value) : value.trim()); setTouched(false); } }}>
      <Field en={t(truck ? 'truckNumber' : 'destination')} te={t(truck ? 'truckNumber' : 'destination')}>
        <input className="input" type="text" autoComplete="off" value={value} maxLength={truck ? 16 : undefined}
          autoCapitalize={truck ? 'characters' : undefined} spellCheck={truck ? false : undefined}
          aria-invalid={showError || undefined} aria-describedby={showError ? errorId : undefined}
          onBlur={() => value.trim() && setTouched(true)}
          onChange={e => onValue(truck ? e.target.value.toUpperCase() : e.target.value)} placeholder={truck ? 'TN 01 AB 1234' : 'Chennai Port'} />
      </Field>
      {showError && <p id={errorId} role="alert" className="references-error">{error}</p>}
      <Button type="submit" primary en={t('addNew')} te={t('addNew')} disabled={adding || !value.trim() || showError} />
    </form>
    {items.length === 0 ? <div className="references-empty">
      <p className="references-empty-title">{truck ? pick('No trucks saved yet', 'ఇంకా లారీలు సేవ్ చేయలేదు') : pick('No destinations saved yet', 'ఇంకా గమ్యస్థానాలు సేవ్ చేయలేదు')}</p>
      <p>{truck ? pick('Add a truck number above. It will be suggested when you fill in a new load.', 'పైన లారీ నంబర్ జోడించండి. కొత్త లోడ్ నింపేటప్పుడు సూచనగా వస్తుంది.') : pick('Add a destination above. It will be suggested when you fill in a new load.', 'పైన గమ్యం జోడించండి. కొత్త లోడ్ నింపేటప్పుడు సూచనగా వస్తుంది.')}</p>
    </div> : <ul className="references-list">
      {items.map(item => <li key={item}>
        <span className={truck ? 'references-plate' : undefined}>{item}</span>
        <button type="button" className="references-remove" aria-label={`${t('delete')} ${item}`} onClick={() => onRemove(item)}>{t('delete')}</button>
      </li>)}
    </ul>}
  </Card>;
}

// Saved trucks or destinations for the Products & places screen. Settings come from PilotApp; every API response goes back through onChanged.
export default function ReferencesPanel({ kind, settings, user, onChanged }) {
  const { t } = useLanguage();
  const truck = kind === 'trucks';
  const orgId = user?.organizationId;
  const items = (truck ? settings?.savedTrucks : settings?.savedDestinations) || [];
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleAdd = async next => {
    if (!next) return;
    setError('');
    setBusy(true);
    try {
      const updated = truck ? await addTruck(orgId, next) : await addDestination(orgId, next);
      onChanged?.(updated);
      setValue('');
    } catch (err) {
      setError(err?.message || t('error'));
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async item => {
    if (!window.confirm(`${t('delete')} ${item}?`)) return;
    setError('');
    try {
      const updated = truck ? await removeTruck(orgId, item) : await removeDestination(orgId, item);
      onChanged?.(updated);
    } catch (err) {
      setError(err?.message || t('error'));
    }
  };

  return <div className="settings-screen">
    <ErrorMessage error={error} />
    <ReferenceList kind={kind} items={items} value={value} onValue={setValue} onAdd={handleAdd} adding={busy} onRemove={handleRemove} />
  </div>;
}
