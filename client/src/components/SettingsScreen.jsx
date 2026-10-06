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
import { useLanguage } from '../i18n/LanguageContext';
import LanguageToggle from './LanguageToggle.jsx';

export default function SettingsScreen({ onClose }) {
  const { t } = useLanguage();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('trucks'); // trucks, destinations, rates, royalty

  const quarryId = 'unit_04';

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getMasterSettings(quarryId);
      setSettings(data);
    } catch (err) {
      setError(err.message || t('error'));
    } finally {
      setLoading(false);
    }
  };

  const [newTruck, setNewTruck] = useState('');
  const [isAddingTruck, setIsAddingTruck] = useState(false);
  const handleAddTruck = async () => {
    if (!newTruck.trim()) return;
    try {
      setIsAddingTruck(true);
      const updated = await addTruck(quarryId, newTruck.trim());
      setSettings(updated);
      setNewTruck('');
    } catch (err) {
      alert(err.message || t('error'));
    } finally {
      setIsAddingTruck(false);
    }
  };

  const handleRemoveTruck = async (truckNumber) => {
    if (!window.confirm(`${t('delete')} ${truckNumber}?`)) return;
    try {
      const updated = await removeTruck(quarryId, truckNumber);
      setSettings(updated);
    } catch (err) {
      alert(err.message || t('error'));
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
      alert(err.message || t('error'));
    } finally {
      setIsAddingDest(false);
    }
  };

  const handleRemoveDestination = async (destination) => {
    if (!window.confirm(`${t('delete')} ${destination}?`)) return;
    try {
      const updated = await removeDestination(quarryId, destination);
      setSettings(updated);
    } catch (err) {
      alert(err.message || t('error'));
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
      alert(err.message || t('error'));
    } finally {
      setIsAddingRate(false);
    }
  };

  const handleRemoveRate = async (rateId) => {
    if (!window.confirm(t('confirm'))) return;
    try {
      const updated = await removeStoneRate(quarryId, rateId);
      setSettings(updated);
    } catch (err) {
      alert(err.message || t('error'));
    }
  };

  const [editingRateId, setEditingRateId] = useState(null);
  const [editingRateData, setEditingRateData] = useState({ stoneType: '', finish: '', defaultRate: '' });
  const [isUpdatingRate, setIsUpdatingRate] = useState(false);

  const startEditRate = (rate) => {
    setEditingRateId(rate._id);
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
      alert(err.message || t('error'));
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
      alert(err.message || t('error'));
    } finally {
      setIsUpdatingRoyalty(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="fixed top-0 inset-x-0 z-50 bg-white border-b border-slate-200 shadow-sm pt-safe">
        <div className="max-w-xl mx-auto w-full px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button aria-label="Go back" className="w-9 h-9 -ml-1.5 flex items-center justify-center rounded-full text-slate-700 hover:text-teal-700 hover:bg-slate-100 transition-colors" onClick={onClose} type="button">
              <span className="material-symbols-outlined text-[24px]">arrow_back</span>
            </button>
            <h1 className="text-lg font-bold text-slate-900 leading-none">{t('settings')}</h1>
          </div>
          <LanguageToggle />
        </div>
      </header>

      <main className="flex-1 flex flex-col w-full max-w-xl mx-auto px-4 pt-20 pb-10">
        {loading ? (
          <div className="p-8 text-center text-slate-500">{t('loading')}</div>
        ) : error ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex flex-col items-center">
            <p className="mb-4">{error}</p>
            <button onClick={loadSettings} className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold">{t('retry')}</button>
          </div>
        ) : settings ? (
          <>
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
              <button onClick={() => setActiveTab('trucks')} className={`px-4 py-2 rounded-full font-bold whitespace-nowrap transition-colors ${activeTab === 'trucks' ? 'bg-teal-700 text-white' : 'bg-slate-200 text-slate-700'}`}>{t('trucks')}</button>
              <button onClick={() => setActiveTab('destinations')} className={`px-4 py-2 rounded-full font-bold whitespace-nowrap transition-colors ${activeTab === 'destinations' ? 'bg-teal-700 text-white' : 'bg-slate-200 text-slate-700'}`}>{t('destinations')}</button>
              <button onClick={() => setActiveTab('rates')} className={`px-4 py-2 rounded-full font-bold whitespace-nowrap transition-colors ${activeTab === 'rates' ? 'bg-teal-700 text-white' : 'bg-slate-200 text-slate-700'}`}>{t('stoneRates')}</button>
              <button onClick={() => setActiveTab('royalty')} className={`px-4 py-2 rounded-full font-bold whitespace-nowrap transition-colors ${activeTab === 'royalty' ? 'bg-teal-700 text-white' : 'bg-slate-200 text-slate-700'}`}>{t('royaltyLoading')}</button>
            </div>

            {activeTab === 'trucks' && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <h2 className="font-bold text-slate-800 mb-4 flex flex-col">
                  <span>{t('trucks')}</span>
                </h2>
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={newTruck}
                    onChange={(e) => setNewTruck(e.target.value)}
                    placeholder="e.g. TN-01-AB-1234"
                    className="flex-1 h-12 px-3 border border-slate-300 rounded-lg focus:border-teal-700 focus:ring-1 focus:ring-teal-700 outline-none"
                  />
                  <button onClick={handleAddTruck} disabled={isAddingTruck} className="px-4 bg-teal-700 text-white rounded-lg font-bold disabled:opacity-50">{t('addNew')}</button>
                </div>
                <div className="space-y-2">
                  {settings.savedTrucks.length === 0 ? <p className="text-slate-500 text-sm">Empty.</p> : null}
                  {settings.savedTrucks.map(truck => (
                    <div key={truck} className="flex justify-between items-center p-3 border border-slate-100 bg-slate-50 rounded-lg">
                      <span className="font-semibold text-slate-800">{truck}</span>
                      <button onClick={() => handleRemoveTruck(truck)} className="text-red-500 p-1 hover:bg-red-50 rounded"><span className="material-symbols-outlined text-[20px]">delete</span></button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'destinations' && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <h2 className="font-bold text-slate-800 mb-4 flex flex-col">
                  <span>{t('destinations')}</span>
                </h2>
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={newDestination}
                    onChange={(e) => setNewDestination(e.target.value)}
                    placeholder="e.g. Chennai Port"
                    className="flex-1 h-12 px-3 border border-slate-300 rounded-lg focus:border-teal-700 focus:ring-1 focus:ring-teal-700 outline-none"
                  />
                  <button onClick={handleAddDestination} disabled={isAddingDest} className="px-4 bg-teal-700 text-white rounded-lg font-bold disabled:opacity-50">{t('addNew')}</button>
                </div>
                <div className="space-y-2">
                  {settings.savedDestinations.length === 0 ? <p className="text-slate-500 text-sm">Empty.</p> : null}
                  {settings.savedDestinations.map(dest => (
                    <div key={dest} className="flex justify-between items-center p-3 border border-slate-100 bg-slate-50 rounded-lg">
                      <span className="font-semibold text-slate-800">{dest}</span>
                      <button onClick={() => handleRemoveDestination(dest)} className="text-red-500 p-1 hover:bg-red-50 rounded"><span className="material-symbols-outlined text-[20px]">delete</span></button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'rates' && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <h2 className="font-bold text-slate-800 mb-4 flex flex-col">
                  <span>{t('stoneRates')} ({t('rate')} / {t('sqFt')})</span>
                </h2>
                <div className="flex flex-col gap-2 mb-6 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                  <input type="text" value={newRate.stoneType} onChange={e => setNewRate({...newRate, stoneType: e.target.value})} placeholder={t('stoneType')} className="w-full h-12 px-3 border border-slate-300 rounded-lg outline-none" />
                  <input type="text" value={newRate.finish} onChange={e => setNewRate({...newRate, finish: e.target.value})} placeholder={t('finish')} className="w-full h-12 px-3 border border-slate-300 rounded-lg outline-none" />
                  <input type="number" value={newRate.defaultRate} onChange={e => setNewRate({...newRate, defaultRate: e.target.value})} placeholder={t('rate')} className="w-full h-12 px-3 border border-slate-300 rounded-lg outline-none" min="0" />
                  <button onClick={handleAddRate} disabled={isAddingRate} className="w-full h-12 bg-teal-700 text-white rounded-lg font-bold mt-2 disabled:opacity-50">{t('addNew')}</button>
                </div>
                
                <div className="space-y-3">
                  {settings.stoneRates.length === 0 ? <p className="text-slate-500 text-sm">Empty.</p> : null}
                  {settings.stoneRates.map(rate => (
                    <div key={rate._id} className="flex flex-col p-3 border border-slate-200 rounded-lg relative">
                      {editingRateId === rate._id ? (
                        <div className="flex flex-col gap-2">
                          <input type="text" value={editingRateData.stoneType} onChange={e => setEditingRateData({...editingRateData, stoneType: e.target.value})} placeholder={t('stoneType')} className="w-full h-10 px-2 border border-slate-300 rounded outline-none" />
                          <input type="text" value={editingRateData.finish} onChange={e => setEditingRateData({...editingRateData, finish: e.target.value})} placeholder={t('finish')} className="w-full h-10 px-2 border border-slate-300 rounded outline-none" />
                          <input type="number" value={editingRateData.defaultRate} onChange={e => setEditingRateData({...editingRateData, defaultRate: e.target.value})} placeholder={t('rate')} className="w-full h-10 px-2 border border-slate-300 rounded outline-none" min="0" />
                          <div className="flex gap-2 mt-2">
                            <button onClick={handleUpdateRate} disabled={isUpdatingRate} className="flex-1 bg-teal-700 text-white rounded font-bold h-10 disabled:opacity-50">{t('save')}</button>
                            <button onClick={() => setEditingRateId(null)} className="flex-1 bg-slate-200 text-slate-700 rounded font-bold h-10">{t('cancel')}</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between pr-14">
                            <span className="font-bold text-slate-800">{rate.stoneType}</span>
                            <span className="font-bold text-green-700">₹{rate.defaultRate}</span>
                          </div>
                          <span className="text-sm text-slate-600">{rate.finish}</span>
                          <div className="absolute top-2 right-2 flex gap-1">
                            <button onClick={() => startEditRate(rate)} className="text-slate-500 p-1 hover:bg-slate-100 rounded"><span className="material-symbols-outlined text-[20px]">edit</span></button>
                            <button onClick={() => handleRemoveRate(rate._id)} className="text-red-500 p-1 hover:bg-red-50 rounded"><span className="material-symbols-outlined text-[20px]">delete</span></button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'royalty' && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <h2 className="font-bold text-slate-800 mb-4 flex flex-col">
                  <span>{t('royaltyLoading')}</span>
                </h2>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₹</span>
                    <input
                      type="number"
                      value={royaltyInput}
                      onChange={(e) => setRoyaltyInput(e.target.value)}
                      className="w-full h-12 pl-8 pr-3 border border-slate-300 rounded-lg focus:border-teal-700 outline-none"
                      min="0"
                    />
                  </div>
                  <button onClick={handleUpdateRoyalty} disabled={isUpdatingRoyalty} className="px-6 bg-teal-700 text-white rounded-lg font-bold disabled:opacity-50">{t('save')}</button>
                </div>
              </div>
            )}
          </>
        ) : null}
      </main>
    </div>
  );
}
