import React, { useState, useEffect } from 'react';
import {
  getMasterSettings,
  addTruck,
  removeTruck,
  addDestination,
  removeDestination,
  addStoneRate,
  updateStoneRate,
  removeStoneRate,
  updateRoyalty
} from '../lib/api';
import { money } from '../utils/pilotDraft.js';
import { BackButton, Button, Card, Field } from './pilot/Controls.jsx';

const compactPlate = value => value.toUpperCase().replace(/[\s.-]/g, '');
// Indian registration: TN 01 AB 1234, or Bharat series 22 BH 1234 AA. Returns formatted plate or null.
function formatTruckNumber(value) {
  const plate = compactPlate(value);
  const standard = /^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{4})$/.exec(plate);
  if (standard) return [standard[1], standard[2].padStart(2, '0'), standard[3], standard[4]].filter(Boolean).join(' ');
  const bharat = /^(\d{2})BH(\d{4})([A-Z]{1,2})$/.exec(plate);
  return bharat ? `${bharat[1]} BH ${bharat[2]} ${bharat[3]}` : null;
}

const tabLabels = { trucks: 'Trucks', destinations: 'Destinations', rates: 'Stone Rates', royalty: 'Royalty / Loading' };

function truckError(value, items) {
  if (!value.trim()) return '';
  if (!formatTruckNumber(value)) return 'Use a valid number, like TN 01 AB 1234.';
  if (items.some(item => compactPlate(item) === compactPlate(formatTruckNumber(value)))) return 'This truck is already saved.';
  return '';
}

function ReferenceList({ kind, items, value, onValue, onAdd, adding, onRemove }) {
  const truck = kind === 'trucks';
  const [touched, setTouched] = useState(false);
  const error = truck ? truckError(value, items) : '';
  const showError = Boolean(error) && touched;
  const errorId = `${kind}-add-error`;
  return <Card className="references-card">
    <div className="references-card-head">
      <h2>{tabLabels[kind]}</h2>
      <span>{items.length} saved</span>
    </div>
    <form className="references-add" noValidate onSubmit={e => { e.preventDefault(); setTouched(true); if (!error) { onAdd(truck ? formatTruckNumber(value) : value.trim()); setTouched(false); } }}>
      <Field label={truck ? 'Truck Number' : 'Destination'}>
        <input className="input" type="text" autoComplete="off" value={value} maxLength={truck ? 16 : undefined}
          autoCapitalize={truck ? 'characters' : undefined} spellCheck={truck ? false : undefined}
          aria-invalid={showError || undefined} aria-describedby={showError ? errorId : undefined}
          onBlur={() => value.trim() && setTouched(true)}
          onChange={e => onValue(truck ? e.target.value.toUpperCase() : e.target.value)} placeholder={truck ? 'TN 01 AB 1234' : 'Chennai Port'} />
      </Field>
      {showError && <p id={errorId} role="alert" className="references-error">{error}</p>}
      <Button type="submit" primary label="Add New" disabled={adding || !value.trim() || showError} />
    </form>
    {items.length === 0 ? <div className="references-empty">
      <p className="references-empty-title">{truck ? 'No trucks saved yet' : 'No destinations saved yet'}</p>
      <p>{truck ? 'Add a truck number above. It will be suggested when you fill in a new load.' : 'Add a destination above. It will be suggested when you fill in a new load.'}</p>
    </div> : <ul className="references-list">
      {items.map(item => <li key={item}>
        <span className={truck ? 'references-plate' : undefined}>{item}</span>
        <Button variant="danger-quiet" aria-label={`Delete ${item}`} onClick={() => onRemove(item)} label="Delete" />
      </li>)}
    </ul>}
  </Card>;
}

export default function SettingsScreen({ user, onClose, embedded = false, referenceOnly = false, initialSettings = null, onChanged }) {
  const [settings, storeSettings] = useState(initialSettings);
  const [loading, setLoading] = useState(!initialSettings);
  // Keep the parent's copy in sync so it never needs to refetch settings.
  const setSettings = data => { storeSettings(data); onChanged?.(data); };
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('trucks'); // trucks, destinations, rates, royalty

  const quarryId = user?.organizationId || 'unit_04';
  const referencesOnly = embedded || referenceOnly;
  const tabs = referencesOnly ? ['trucks', 'destinations'] : ['trucks', 'destinations', 'rates', 'royalty'];
  const visibleTab = tabs.includes(activeTab) ? activeTab : 'trucks';
  const Content = embedded ? 'div' : 'main';

  useEffect(() => {
    if (!initialSettings) loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getMasterSettings(quarryId);
      setSettings(data);
    } catch (err) {
      setError(err.message || 'Error');
    } finally {
      setLoading(false);
    }
  };

  const [newTruck, setNewTruck] = useState('');
  const [isAddingTruck, setIsAddingTruck] = useState(false);
  const handleAddTruck = async (truckNumber) => {
    if (!truckNumber) return;
    try {
      setIsAddingTruck(true);
      const updated = await addTruck(quarryId, truckNumber);
      setSettings(updated);
      setNewTruck('');
    } catch (err) {
      alert(err.message || 'Error');
    } finally {
      setIsAddingTruck(false);
    }
  };

  const handleRemoveTruck = async (truckNumber) => {
    if (!window.confirm(`Delete ${truckNumber}?`)) return;
    try {
      const updated = await removeTruck(quarryId, truckNumber);
      setSettings(updated);
    } catch (err) {
      alert(err.message || 'Error');
    }
  };

  const [newDestination, setNewDestination] = useState('');
  const [isAddingDest, setIsAddingDest] = useState(false);
  const handleAddDestination = async () => {
    if (!newDestination.trim()) return;
    try {
      setIsAddingDest(true);
      const updated = await addDestination(quarryId, newDestination.trim());
      setSettings(updated);
      setNewDestination('');
    } catch (err) {
      alert(err.message || 'Error');
    } finally {
      setIsAddingDest(false);
    }
  };

  const handleRemoveDestination = async (destination) => {
    if (!window.confirm(`Delete ${destination}?`)) return;
    try {
      const updated = await removeDestination(quarryId, destination);
      setSettings(updated);
    } catch (err) {
      alert(err.message || 'Error');
    }
  };

  const [newRate, setNewRate] = useState({ stoneType: '', finish: '', defaultRate: '' });
  const [isAddingRate, setIsAddingRate] = useState(false);
  const handleAddRate = async () => {
    if (!newRate.stoneType.trim() || !newRate.finish.trim() || newRate.defaultRate === '') return;
    try {
      setIsAddingRate(true);
      const numRate = Number(newRate.defaultRate);
      if (numRate < 0 || isNaN(numRate)) throw new Error('Invalid rate');
      const updated = await addStoneRate(quarryId, {
        stoneType: newRate.stoneType.trim(),
        finish: newRate.finish.trim(),
        defaultRate: numRate
      });
      setSettings(updated);
      setNewRate({ stoneType: '', finish: '', defaultRate: '' });
    } catch (err) {
      alert(err.message || 'Error');
    } finally {
      setIsAddingRate(false);
    }
  };

  const handleRemoveRate = async (rateId) => {
    if (!window.confirm('Confirm')) return;
    try {
      const updated = await removeStoneRate(quarryId, rateId);
      setSettings(updated);
    } catch (err) {
      alert(err.message || 'Error');
    }
  };

  const [editingRateId, setEditingRateId] = useState(null);
  const [editingRateData, setEditingRateData] = useState({ stoneType: '', finish: '', defaultRate: '' });
  const [isUpdatingRate, setIsUpdatingRate] = useState(false);

  const startEditRate = (rate) => {
    setEditingRateId(rate.id);
    setEditingRateData({ stoneType: rate.stoneType, finish: rate.finish, defaultRate: rate.defaultRate });
  };

  const handleUpdateRate = async () => {
    if (!editingRateData.stoneType.trim() || !editingRateData.finish.trim() || editingRateData.defaultRate === '') return;
    try {
      setIsUpdatingRate(true);
      const numRate = Number(editingRateData.defaultRate);
      if (numRate < 0 || isNaN(numRate)) throw new Error('Invalid rate');

      const updated = await updateStoneRate(quarryId, editingRateId, {
        stoneType: editingRateData.stoneType.trim(),
        finish: editingRateData.finish.trim(),
        defaultRate: numRate
      });
      setSettings(updated);
      setEditingRateId(null);
    } catch (err) {
      alert(err.message || 'Error');
    } finally {
      setIsUpdatingRate(false);
    }
  };

  const [royaltyInput, setRoyaltyInput] = useState('');
  const [isUpdatingRoyalty, setIsUpdatingRoyalty] = useState(false);
  useEffect(() => {
    if (settings) {
      setRoyaltyInput(settings.defaultRoyaltyFee.toString());
    }
  }, [settings]);

  const handleUpdateRoyalty = async () => {
    try {
      setIsUpdatingRoyalty(true);
      const val = Number(royaltyInput);
      if (val < 0 || isNaN(val)) throw new Error('Invalid royalty');
      const updated = await updateRoyalty(quarryId, val);
      setSettings(updated);
    } catch (err) {
      alert(err.message || 'Error');
    } finally {
      setIsUpdatingRoyalty(false);
    }
  };

  return (
    <div className={embedded ? 'pilot workspace-utility-screen settings-screen space-y-4' : 'pilot min-h-screen bg-surface flex flex-col'}>
      {embedded ? <header className="references-heading">
        {onClose && <BackButton label="Back" onClick={onClose} />}
        <h1>{'Trucks & destinations'}</h1>
        <p>Saved here once, suggested every time you fill in a new load.</p>
      </header> : <header className="fixed top-0 inset-x-0 z-50 bg-white border-b border-outline-variant shadow-sm pt-safe">
        <div className="max-w-xl mx-auto w-full px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button aria-label="Go back" className="w-9 h-9 -ml-1.5 flex items-center justify-center rounded-full text-on-surface hover:text-primary hover:bg-surface-container transition-colors" onClick={onClose} type="button">
              <span className="material-symbols-outlined text-[24px]" aria-hidden="true">arrow_back</span>
            </button>
            <h1 className="text-lg font-bold text-on-surface leading-none">Settings</h1>
          </div>

        </div>
      </header>}

      <Content className={embedded ? 'space-y-4' : 'flex-1 flex flex-col w-full max-w-xl mx-auto px-4 pt-20 pb-10'}>
        {loading ? (
          <div className="p-8 text-center text-on-surface-variant">Loading...</div>
        ) : error ? (
          <div role="alert" className="p-4 bg-error-container border border-error-container rounded-xl text-error flex flex-col items-center">
            <p className="mb-4">{error}</p>
            <Button onClick={loadSettings} label="Retry" />
          </div>
        ) : settings ? (
          <>
            <div role={embedded ? 'group' : undefined} aria-label={embedded ? 'Saved lists' : 'Settings'} className={embedded ? 'settings-language-options references-switch' : 'flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide relative'}>
              {tabs.map((tab) => embedded ? <button type="button" key={tab} aria-pressed={visibleTab === tab} onClick={() => setActiveTab(tab)}>{tabLabels[tab]}<span className="references-count" aria-hidden="true">{(tab === 'trucks' ? settings.savedTrucks : settings.savedDestinations).length}</span></button> : (
                <button
                  key={tab}
                  type="button"
                  aria-pressed={visibleTab === tab}
                  onClick={() => setActiveTab(tab)}
                  className={`relative px-4 py-2 rounded-full font-bold whitespace-nowrap transition-colors duration-200 ${visibleTab === tab ? 'bg-primary text-white shadow-sm' : 'bg-surface-container-high text-on-surface hover:bg-slate-300'}`}
                >
                  <span className="relative z-10">{tabLabels[tab]}</span>
                </button>
              ))}
            </div>

            {visibleTab === 'trucks' && <ReferenceList kind="trucks" items={settings.savedTrucks} value={newTruck} onValue={setNewTruck} onAdd={handleAddTruck} adding={isAddingTruck} onRemove={handleRemoveTruck} />}

            {visibleTab === 'destinations' && <ReferenceList kind="destinations" items={settings.savedDestinations} value={newDestination} onValue={setNewDestination} onAdd={handleAddDestination} adding={isAddingDest} onRemove={handleRemoveDestination} />}

            {!referencesOnly && visibleTab === 'rates' && (
              <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-4">
                <h2 className="font-bold text-on-surface mb-4 flex flex-col">
                  <span>Stone Rates ({'Rate'} / {'sq ft'})</span>
                </h2>
                <div className="flex flex-col gap-2 mb-6 p-4 bg-surface border border-outline-variant rounded-lg">
                  <input type="text" value={newRate.stoneType} onChange={e => setNewRate({...newRate, stoneType: e.target.value})} placeholder="Stone Type" aria-label="Stone Type" autoComplete="off" className="w-full h-12 px-3 border border-outline-variant rounded-lg outline-none" />
                  <input type="text" value={newRate.finish} onChange={e => setNewRate({...newRate, finish: e.target.value})} placeholder="Finish" aria-label="Finish" autoComplete="off" className="w-full h-12 px-3 border border-outline-variant rounded-lg outline-none" />
                  <input type="number" inputMode="decimal" value={newRate.defaultRate} onChange={e => setNewRate({...newRate, defaultRate: e.target.value})} placeholder="Rate" aria-label="Rate" autoComplete="off" className="w-full h-12 px-3 border border-outline-variant rounded-lg outline-none" min="0" />
                  <button type="button" onClick={handleAddRate} disabled={isAddingRate} className="w-full h-12 bg-primary text-white rounded-lg font-bold mt-2 disabled:opacity-50">Add New</button>
                </div>

                <div className="space-y-3">
                  {settings.stoneRates.length === 0 ? <p className="text-on-surface-variant text-sm">Empty.</p> : null}
                  {settings.stoneRates.map(rate => (
                    <div key={rate.id} className="flex flex-col p-3 border border-outline-variant rounded-lg relative">
                      {editingRateId === rate.id ? (
                        <div className="flex flex-col gap-2">
                          <input type="text" value={editingRateData.stoneType} onChange={e => setEditingRateData({...editingRateData, stoneType: e.target.value})} placeholder="Stone Type" aria-label="Stone Type" autoComplete="off" className="w-full h-10 px-2 border border-outline-variant rounded outline-none" />
                          <input type="text" value={editingRateData.finish} onChange={e => setEditingRateData({...editingRateData, finish: e.target.value})} placeholder="Finish" aria-label="Finish" autoComplete="off" className="w-full h-10 px-2 border border-outline-variant rounded outline-none" />
                          <input type="number" inputMode="decimal" value={editingRateData.defaultRate} onChange={e => setEditingRateData({...editingRateData, defaultRate: e.target.value})} placeholder="Rate" aria-label="Rate" autoComplete="off" className="w-full h-10 px-2 border border-outline-variant rounded outline-none" min="0" />
                          <div className="flex gap-2 mt-2">
                            <button onClick={handleUpdateRate} disabled={isUpdatingRate} className="flex-1 bg-primary text-white rounded font-bold h-10 disabled:opacity-50">Save</button>
                            <button onClick={() => setEditingRateId(null)} className="flex-1 bg-surface-container-high text-on-surface rounded font-bold h-10">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between pr-14">
                            <span className="font-bold text-on-surface">{rate.stoneType}</span>
                            <span className="font-bold text-success tabular-nums">{money(rate.defaultRate)}</span>
                          </div>
                          <span className="text-sm text-on-surface-variant">{rate.finish}</span>
                          <div className="absolute top-2 right-2 flex gap-1">
                            <button type="button" aria-label={`Edit ${rate.stoneType} ${rate.finish}`} onClick={() => startEditRate(rate)} className="text-on-surface-variant p-1 hover:bg-surface-container rounded"><span className="material-symbols-outlined text-[20px]" aria-hidden="true">edit</span></button>
                            <button type="button" aria-label={`Delete ${rate.stoneType} ${rate.finish}`} onClick={() => handleRemoveRate(rate.id)} className="text-error p-1 hover:bg-error-container rounded"><span className="material-symbols-outlined text-[20px]" aria-hidden="true">delete</span></button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!referencesOnly && visibleTab === 'royalty' && (
              <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-4">
                <h2 className="font-bold text-on-surface mb-4 flex flex-col">
                  <span>Royalty / Loading</span>
                </h2>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant font-bold">₹</span>
                    <input
                      type="number"
                      value={royaltyInput}
                      onChange={(e) => setRoyaltyInput(e.target.value)}
                      className="w-full h-12 pl-8 pr-3 border border-outline-variant rounded-lg focus:border-teal-700 outline-none"
                      min="0"
                    />
                  </div>
                  <button onClick={handleUpdateRoyalty} disabled={isUpdatingRoyalty} className="px-6 bg-primary text-white rounded-lg font-bold disabled:opacity-50">Save</button>
                </div>
              </div>
            )}
          </>
        ) : null}
      </Content>
    </div>
  );
}
