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

export default function SettingsScreen({ onClose }) {
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
      setError(err.message || 'Failed to load settings');
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
      alert(err.message || 'Error adding truck');
    } finally {
      setIsAddingTruck(false);
    }
  };

  const handleRemoveTruck = async (truckNumber) => {
    if (!window.confirm(`Remove truck ${truckNumber}?`)) return;
    try {
      const updated = await removeTruck(quarryId, truckNumber);
      setSettings(updated);
    } catch (err) {
      alert(err.message || 'Error removing truck');
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
      alert(err.message || 'Error adding destination');
    } finally {
      setIsAddingDest(false);
    }
  };

  const handleRemoveDestination = async (destination) => {
    if (!window.confirm(`Remove destination ${destination}?`)) return;
    try {
      const updated = await removeDestination(quarryId, destination);
      setSettings(updated);
    } catch (err) {
      alert(err.message || 'Error removing destination');
    }
  };

  const [newRate, setNewRate] = useState({ stoneType: '', finish: '', defaultRate: '' });
  const [isAddingRate, setIsAddingRate] = useState(false);
  const handleAddRate = async () => {
    if (!newRate.stoneType.trim() || !newRate.finish.trim() || newRate.defaultRate === '') return;
    try {
      setIsAddingRate(true);
      const numRate = Number(newRate.defaultRate);
      if (numRate < 0 || isNaN(numRate)) throw new Error('Rate must be a positive number');
      const updated = await addStoneRate(quarryId, {
        stoneType: newRate.stoneType.trim(),
        finish: newRate.finish.trim(),
        defaultRate: numRate
      });
      setSettings(updated);
      setNewRate({ stoneType: '', finish: '', defaultRate: '' });
    } catch (err) {
      alert(err.message || 'Error adding rate');
    } finally {
      setIsAddingRate(false);
    }
  };

  const handleRemoveRate = async (rateId) => {
    if (!window.confirm(`Remove this stone rate?`)) return;
    try {
      const updated = await removeStoneRate(quarryId, rateId);
      setSettings(updated);
    } catch (err) {
      alert(err.message || 'Error removing rate');
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
      if (numRate < 0 || isNaN(numRate)) throw new Error('Rate must be a positive number');
      
      const updated = await updateStoneRate(quarryId, editingRateId, {
        stoneType: editingRateData.stoneType.trim(),
        finish: editingRateData.finish.trim(),
        defaultRate: numRate
      });
      setSettings(updated);
      setEditingRateId(null);
    } catch (err) {
      alert(err.message || 'Error updating rate');
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
      if (val < 0 || isNaN(val)) throw new Error('Royalty must be a positive number');
      const updated = await updateRoyalty(quarryId, val);
      setSettings(updated);
      alert('Royalty updated successfully');
    } catch (err) {
      alert(err.message || 'Error updating royalty');
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
            <h1 className="text-lg font-bold text-slate-900 leading-none">Master Settings</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col w-full max-w-xl mx-auto px-4 pt-20 pb-10">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading settings...</div>
        ) : error ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex flex-col items-center">
            <p className="mb-4">{error}</p>
            <button onClick={loadSettings} className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold">Retry</button>
          </div>
        ) : settings ? (
          <>
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
              <button onClick={() => setActiveTab('trucks')} className={`px-4 py-2 rounded-full font-bold whitespace-nowrap transition-colors ${activeTab === 'trucks' ? 'bg-teal-700 text-white' : 'bg-slate-200 text-slate-700'}`}>Trucks</button>
              <button onClick={() => setActiveTab('destinations')} className={`px-4 py-2 rounded-full font-bold whitespace-nowrap transition-colors ${activeTab === 'destinations' ? 'bg-teal-700 text-white' : 'bg-slate-200 text-slate-700'}`}>Destinations</button>
              <button onClick={() => setActiveTab('rates')} className={`px-4 py-2 rounded-full font-bold whitespace-nowrap transition-colors ${activeTab === 'rates' ? 'bg-teal-700 text-white' : 'bg-slate-200 text-slate-700'}`}>Stone Rates</button>
              <button onClick={() => setActiveTab('royalty')} className={`px-4 py-2 rounded-full font-bold whitespace-nowrap transition-colors ${activeTab === 'royalty' ? 'bg-teal-700 text-white' : 'bg-slate-200 text-slate-700'}`}>Royalty</button>
            </div>

            {activeTab === 'trucks' && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <h2 className="font-bold text-slate-800 mb-4 flex flex-col">
                  <span>Saved Trucks</span>
                  <span className="text-xs text-slate-500 font-normal">லாரிகள்</span>
                </h2>
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={newTruck}
                    onChange={(e) => setNewTruck(e.target.value)}
                    placeholder="e.g. TN-01-AB-1234"
                    className="flex-1 h-12 px-3 border border-slate-300 rounded-lg focus:border-teal-700 focus:ring-1 focus:ring-teal-700 outline-none"
                  />
                  <button onClick={handleAddTruck} disabled={isAddingTruck} className="px-4 bg-teal-700 text-white rounded-lg font-bold disabled:opacity-50">Add</button>
                </div>
                <div className="space-y-2">
                  {settings.savedTrucks.length === 0 ? <p className="text-slate-500 text-sm">No trucks saved.</p> : null}
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
                  <span>Buyer Destinations</span>
                  <span className="text-xs text-slate-500 font-normal">இலக்குகள்</span>
                </h2>
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={newDestination}
                    onChange={(e) => setNewDestination(e.target.value)}
                    placeholder="e.g. Chennai Port"
                    className="flex-1 h-12 px-3 border border-slate-300 rounded-lg focus:border-teal-700 focus:ring-1 focus:ring-teal-700 outline-none"
                  />
                  <button onClick={handleAddDestination} disabled={isAddingDest} className="px-4 bg-teal-700 text-white rounded-lg font-bold disabled:opacity-50">Add</button>
                </div>
                <div className="space-y-2">
                  {settings.savedDestinations.length === 0 ? <p className="text-slate-500 text-sm">No destinations saved.</p> : null}
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
                  <span>Stone Rates (per Sq.Ft)</span>
                  <span className="text-xs text-slate-500 font-normal">கல் விலைகள்</span>
                </h2>
                <div className="flex flex-col gap-2 mb-6 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                  <input type="text" value={newRate.stoneType} onChange={e => setNewRate({...newRate, stoneType: e.target.value})} placeholder="Stone Type (e.g. Galaxy)" className="w-full h-12 px-3 border border-slate-300 rounded-lg outline-none" />
                  <input type="text" value={newRate.finish} onChange={e => setNewRate({...newRate, finish: e.target.value})} placeholder="Finish (e.g. Rough)" className="w-full h-12 px-3 border border-slate-300 rounded-lg outline-none" />
                  <input type="number" value={newRate.defaultRate} onChange={e => setNewRate({...newRate, defaultRate: e.target.value})} placeholder="Rate (e.g. 100)" className="w-full h-12 px-3 border border-slate-300 rounded-lg outline-none" min="0" />
                  <button onClick={handleAddRate} disabled={isAddingRate} className="w-full h-12 bg-teal-700 text-white rounded-lg font-bold mt-2 disabled:opacity-50">Add Rate</button>
                </div>
                
                <div className="space-y-3">
                  {settings.stoneRates.length === 0 ? <p className="text-slate-500 text-sm">No rates saved.</p> : null}
                  {settings.stoneRates.map(rate => (
                    <div key={rate._id} className="flex flex-col p-3 border border-slate-200 rounded-lg relative">
                      {editingRateId === rate._id ? (
                        <div className="flex flex-col gap-2">
                          <input type="text" value={editingRateData.stoneType} onChange={e => setEditingRateData({...editingRateData, stoneType: e.target.value})} className="w-full h-10 px-2 border border-slate-300 rounded outline-none" />
                          <input type="text" value={editingRateData.finish} onChange={e => setEditingRateData({...editingRateData, finish: e.target.value})} className="w-full h-10 px-2 border border-slate-300 rounded outline-none" />
                          <input type="number" value={editingRateData.defaultRate} onChange={e => setEditingRateData({...editingRateData, defaultRate: e.target.value})} className="w-full h-10 px-2 border border-slate-300 rounded outline-none" min="0" />
                          <div className="flex gap-2 mt-2">
                            <button onClick={handleUpdateRate} disabled={isUpdatingRate} className="flex-1 bg-teal-700 text-white rounded font-bold h-10 disabled:opacity-50">Save</button>
                            <button onClick={() => setEditingRateId(null)} className="flex-1 bg-slate-200 text-slate-700 rounded font-bold h-10">Cancel</button>
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
                  <span>Default Royalty / Loading CESS</span>
                  <span className="text-xs text-slate-500 font-normal">ராயல்டி / ஏற்றுதல்</span>
                </h2>
                <p className="text-sm text-slate-600 mb-4">Note: Changing this only affects future dispatches. Historical dispatches will retain their original values.</p>
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
                  <button onClick={handleUpdateRoyalty} disabled={isUpdatingRoyalty} className="px-6 bg-teal-700 text-white rounded-lg font-bold disabled:opacity-50">Save</button>
                </div>
              </div>
            )}
          </>
        ) : null}
      </main>
    </div>
  );
}
