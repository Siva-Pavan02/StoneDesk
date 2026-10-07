import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { getMasterSettings } from '../lib/api';
import { createLoadingList, updateLoadingList, fetchLoadingLists } from '../lib/loadingListApi';
import { parseFraction, decimalToFraction } from '../utils/fractionParser';
import FractionChips from './dispatch/FractionChips';
import { generateLoadingListPdf } from '../utils/generateLoadingListPdf';
import { generateLoadingListExcel } from '../utils/generateLoadingListExcel';

export default function LoadingListScreen({ onClose }) {
  const { t, pick } = useLanguage();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const savingLock = useRef(false);
  const [settings, setSettings] = useState(null);
  
  // Active Form State
  const [loadingListNumber, setLoadingListNumber] = useState('');
  const [supervisor, setSupervisor] = useState('');
  const [buyerDestination, setBuyerDestination] = useState('');
  const [stoneType, setStoneType] = useState('');
  const [finish, setFinish] = useState('');
  
  const [requirements, setRequirements] = useState([]);

  // Requirement Entry State
  const [reqLen, setReqLen] = useState('');
  const [reqWid, setReqWid] = useState('');
  const [reqQty, setReqQty] = useState('');
  const [editIndex, setEditIndex] = useState(null);

  // Custom Load State
  const [activeCustomIdx, setActiveCustomIdx] = useState(null);
  const [customLen, setCustomLen] = useState('');
  const [customWid, setCustomWid] = useState('');

  // Loaded lists from DB
  const [savedLists, setSavedLists] = useState([]);
  const [activeListId, setActiveListId] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const ms = await getMasterSettings('unit_04');
      setSettings(ms);
      const lists = await fetchLoadingLists();
      setSavedLists(lists);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleAddRequirement = () => {
    const pLen = parseFraction(reqLen);
    const pWid = parseFraction(reqWid);
    const qty = Number(reqQty);

    if (!pLen || !pWid || !Number.isSafeInteger(qty) || qty <= 0) {
      alert(t('invalid') || 'Invalid input');
      return;
    }

    if (editIndex !== null) {
      const updated = [...requirements];
      const existing = updated[editIndex];
      existing.lengthDisplay = pLen.display;
      existing.widthDisplay = pWid.display;
      existing.lengthFt = pLen.numeric;
      existing.widthFt = pWid.numeric;
      existing.requiredQuantity = qty;
      existing.balance = qty - existing.loadedQuantity;
      
      setRequirements(updated);
      setEditIndex(null);
    } else {
      setRequirements([...requirements, {
        lengthDisplay: pLen.display,
        widthDisplay: pWid.display,
        lengthFt: pLen.numeric,
        widthFt: pWid.numeric,
        requiredQuantity: qty,
        loadedQuantity: 0,
        balance: qty,
        loadedPieces: []
      }]);
    }

    setReqLen('');
    setReqWid('');
    setReqQty('');
  };

  const handleEditRequirement = (index) => {
    const req = requirements[index];
    setReqLen(req.lengthDisplay || decimalToFraction(req.lengthFt));
    setReqWid(req.widthDisplay || decimalToFraction(req.widthFt));
    setReqQty(req.requiredQuantity);
    setEditIndex(index);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditIndex(null);
    setReqLen('');
    setReqWid('');
    setReqQty('');
  };

  const handleRemoveRequirement = (index) => {
    const updated = [...requirements];
    updated.splice(index, 1);
    setRequirements(updated);
  };

  const handleLoadPiece = (index, overrideLenDisplay = null, overrideWidDisplay = null) => {
    const updated = [...requirements];
    const req = updated[index];
    
    let lDisplay = overrideLenDisplay || req.lengthDisplay || decimalToFraction(req.lengthFt);
    let wDisplay = overrideWidDisplay || req.widthDisplay || decimalToFraction(req.widthFt);
    let pLen = parseFraction(lDisplay);
    let pWid = parseFraction(wDisplay);
    
    if (!pLen || !pWid) {
      alert("Invalid custom dimension.");
      return;
    }

    const newPiece = {
      lengthDisplay: pLen.display,
      widthDisplay: pWid.display,
      lengthFt: pLen.numeric,
      widthFt: pWid.numeric,
      sqFt: pLen.numeric * pWid.numeric
    };

    req.loadedPieces.push(newPiece);
    req.loadedQuantity += 1;
    req.balance = req.requiredQuantity - req.loadedQuantity;

    setRequirements(updated);
  };

  const handleRemovePiece = (index) => {
    const updated = [...requirements];
    const req = updated[index];
    if (req.loadedQuantity > 0) {
      req.loadedPieces.pop();
      req.loadedQuantity -= 1;
      req.balance = req.requiredQuantity - req.loadedQuantity;
      setRequirements(updated);
    }
  };

  const handleOpenCustom = (index) => {
    const req = requirements[index];
    setCustomLen(req.lengthDisplay || decimalToFraction(req.lengthFt));
    setCustomWid(req.widthDisplay || decimalToFraction(req.widthFt));
    setActiveCustomIdx(index);
  };

  const handleCustomLoad = (index) => {
    handleLoadPiece(index, customLen, customWid);
    setActiveCustomIdx(null);
  };

  const handleSaveList = async () => {
    if (savingLock.current) return;
    if (!supervisor || !buyerDestination || !stoneType || !finish) {
      alert('Please fill out all basic details');
      return;
    }

    const payload = {
      loadingListNumber: loadingListNumber || `LL-${Date.now()}`,
      supervisor,
      buyerDestination,
      stoneType,
      finish,
      requirements,
      status: 'Loading'
    };

    savingLock.current = true; setSaving(true); setError('');
    try {
      if (activeListId) {
        await updateLoadingList(activeListId, payload);
      } else {
        const created = await createLoadingList(payload);
        setActiveListId(created.id);
        setLoadingListNumber(created.loadingListNumber);
      }
      alert('Saved Loading List');
      loadData();
    } catch (e) {
      setError(e.message);
    } finally { savingLock.current = false; setSaving(false); }
  };

  const handleGeneratePdf = () => {
    const listData = {
      loadingListNumber: loadingListNumber || `LL-${Date.now()}`,
      date: new Date().toLocaleDateString(),
      supervisor,
      buyerDestination,
      stoneType,
      finish,
      requirements
    };
    generateLoadingListPdf(listData);
  };

  const handleGenerateExcel = () => {
    const listData = {
      loadingListNumber: loadingListNumber || `LL-${Date.now()}`,
      date: new Date().toLocaleDateString(),
      supervisor,
      buyerDestination,
      stoneType,
      finish,
      requirements
    };
    generateLoadingListExcel(listData);
  };

  const totalRequired = requirements.reduce((sum, r) => sum + r.requiredQuantity, 0);
  const totalLoaded = requirements.reduce((sum, r) => sum + r.loadedQuantity, 0);
  const totalBalance = requirements.reduce((sum, r) => sum + r.balance, 0);

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <header className="fixed top-0 inset-x-0 z-50 bg-white border-b border-slate-200 shadow-sm pt-safe">
        <div className="max-w-xl mx-auto w-full px-4 h-14 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <button className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100" onClick={onClose}>
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <h1 className="truncate font-bold text-lg text-slate-800">{t('loadingList') || 'Loading List'}</h1>
          </div>
          <div className="flex items-center gap-2">
          <button className="px-4 py-1.5 bg-teal-700 text-white rounded-lg font-semibold text-sm" disabled={saving} onClick={handleSaveList}>
            {t('save') || 'Save'}
          </button></div>
        </div>
      </header>

      <main className="pt-20 px-4 max-w-xl mx-auto">
        {error && <p role="alert" className="mb-4 rounded-xl border-2 border-red-300 bg-white p-4 text-red-800">{error}</p>}
        <label className="mb-4 flex flex-col gap-2 font-semibold">{pick('Saved loading lists', 'సేవ్ చేసిన లోడింగ్ జాబితాలు')}
          <select aria-label="Saved loading lists" className="min-h-12 rounded-lg border-2 border-gray-300 bg-white p-2" disabled={saving} value={activeListId || ''} onChange={event => {
            if (!window.confirm(pick('Replace the current form with this loading list?', 'ప్రస్తుత వివరాలను మార్చాలా?'))) return;
            const list = savedLists.find(item => item.id === event.target.value);
            setActiveListId(list?.id || null); setLoadingListNumber(list?.loadingListNumber || '');
            setSupervisor(list?.supervisor || ''); setBuyerDestination(list?.buyerDestination || '');
            setStoneType(list?.stoneType || ''); setFinish(list?.finish || '');
            setRequirements(list ? structuredClone(list.requirements) : []); setEditIndex(null); setActiveCustomIdx(null); setError('');
          }}><option value="">{pick('New loading list', 'కొత్త లోడింగ్ జాబితా')}</option>{savedLists.map(list => <option key={list.id} value={list.id}>{list.loadingListNumber} · {list.buyerDestination}</option>)}</select>
        </label>
        
        {/* Basic Details */}
        <section className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-4">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">{t('supervisor')}</label>
              <input type="text" className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm" value={supervisor} onChange={(e)=>setSupervisor(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">{t('destination')}</label>
              <select className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm" value={buyerDestination} onChange={(e)=>setBuyerDestination(e.target.value)}>
                <option value="">--</option>
                {settings?.savedDestinations?.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">{t('stoneType')}</label>
              <select className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm" value={stoneType} onChange={(e)=>setStoneType(e.target.value)}>
                <option value="">--</option>
                {[...new Set(settings?.stoneRates?.map(sr => sr.stoneType))].map(st => <option key={st}>{st}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">{t('finish')}</label>
              <select className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm" value={finish} onChange={(e)=>setFinish(e.target.value)}>
                <option value="">--</option>
                {[...new Set(settings?.stoneRates?.filter(sr => sr.stoneType === stoneType).map(sr => sr.finish))].map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
          </div>
        </section>

        {/* Add Requirement */}
        <section className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-sm font-bold text-slate-800">{editIndex !== null ? (t('editRequirement') || 'Edit Requirement') : (t('addRequirement') || 'Add Requirement')}</h2>
            {editIndex !== null && <button onClick={handleCancelEdit} className="text-xs text-slate-500 underline">Cancel</button>}
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">{t('length')}</label>
              <input type="text" placeholder="e.g. 4 1/2" className="w-full h-12 px-3 bg-slate-50 border border-slate-300 rounded-lg text-center font-bold text-lg" value={reqLen} onChange={(e)=>setReqLen(e.target.value)} />
              <FractionChips value={reqLen} setValue={setReqLen} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">{t('width')}</label>
              <input type="text" placeholder="e.g. 2" className="w-full h-12 px-3 bg-slate-50 border border-slate-300 rounded-lg text-center font-bold text-lg" value={reqWid} onChange={(e)=>setReqWid(e.target.value)} />
              <FractionChips value={reqWid} setValue={setReqWid} />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-500 mb-1">{t('pieces')}</label>
            <input type="number" placeholder="Qty" className="w-full h-12 px-3 bg-slate-50 border border-slate-300 rounded-lg text-center font-bold text-lg" value={reqQty} onChange={(e)=>setReqQty(e.target.value)} />
          </div>
          <button className="w-full h-12 bg-teal-50 text-teal-700 font-bold rounded-lg border border-teal-200 flex items-center justify-center gap-2" onClick={handleAddRequirement}>
            <span className="material-symbols-outlined">{editIndex !== null ? 'check' : 'add'}</span> {editIndex !== null ? (t('updateRequirement') || 'Update Requirement') : (t('addRequirement') || 'Add Requirement')}
          </button>
        </section>

        {/* Requirements List */}
        <section className="mb-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-sm font-bold text-slate-800">{t('requirements') || 'Requirements'}</h2>
            <span className="text-xs bg-slate-200 px-2 py-1 rounded-full font-bold">{requirements.length} lines</span>
          </div>
          
          <div className="space-y-3">
            {requirements.map((req, idx) => (
              <div key={idx} className={`bg-white border ${editIndex === idx ? 'border-teal-400 ring-2 ring-teal-100' : 'border-slate-200'} rounded-xl p-4 shadow-sm relative overflow-hidden`}>
                <div className="absolute top-2 right-2 flex gap-1">
                  <button onClick={() => handleEditRequirement(idx)} className="text-slate-400 hover:text-teal-600 p-1">
                    <span className="material-symbols-outlined text-lg">edit</span>
                  </button>
                  <button onClick={() => handleRemoveRequirement(idx)} className="text-slate-400 hover:text-red-500 p-1">
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                </div>
                
                <div className="flex items-center gap-2 mb-3">
                  <div className="text-2xl font-black text-slate-800">{req.lengthDisplay || decimalToFraction(req.lengthFt)} <span className="text-slate-400 text-lg">×</span> {req.widthDisplay || decimalToFraction(req.widthFt)}</div>
                  {req.balance === 0 && <span className="ml-auto bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded">Complete</span>}
                  {req.balance < 0 && <span className="ml-auto bg-orange-100 text-orange-800 text-xs font-bold px-2 py-1 rounded">{Math.abs(req.balance)} Excess</span>}
                </div>

                <div className="grid grid-cols-3 gap-2 mb-4 bg-slate-50 p-2 rounded-lg">
                  <div className="text-center">
                    <div className="text-[10px] uppercase font-bold text-slate-400">Required</div>
                    <div className="text-lg font-bold text-slate-700">{req.requiredQuantity}</div>
                  </div>
                  <div className="text-center border-l border-r border-slate-200">
                    <div className="text-[10px] uppercase font-bold text-teal-600">Loaded</div>
                    <div className="text-lg font-bold text-teal-700">{req.loadedQuantity}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] uppercase font-bold text-slate-400">Balance</div>
                    <div className={`text-lg font-bold ${req.balance < 0 ? 'text-orange-600' : 'text-slate-700'}`}>{req.balance > 0 ? req.balance : 0}</div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {activeCustomIdx === idx ? (
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-slate-500 uppercase">Custom Piece Size</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">Length</label>
                          <input type="text" className="w-full h-10 px-2 bg-white border border-slate-300 rounded text-center font-bold" value={customLen} onChange={e=>setCustomLen(e.target.value)} />
                          <div className="mt-1"><FractionChips value={customLen} setValue={setCustomLen}/></div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">Width</label>
                          <input type="text" className="w-full h-10 px-2 bg-white border border-slate-300 rounded text-center font-bold" value={customWid} onChange={e=>setCustomWid(e.target.value)} />
                          <div className="mt-1"><FractionChips value={customWid} setValue={setCustomWid}/></div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button className="flex-1 h-10 bg-white border border-slate-300 text-slate-600 font-bold rounded-lg" onClick={()=>setActiveCustomIdx(null)}>Cancel</button>
                        <button className="flex-[2] h-10 bg-teal-700 text-white font-bold rounded-lg" onClick={()=>handleCustomLoad(idx)}>Load Custom</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button className="h-12 w-12 bg-slate-100 text-slate-700 font-bold rounded-lg border border-slate-200 flex items-center justify-center disabled:opacity-50" onClick={() => handleRemovePiece(idx)} disabled={req.loadedQuantity === 0}>
                        <span className="material-symbols-outlined">remove</span>
                      </button>
                      <button className="flex-[2] h-12 bg-teal-700 text-white font-bold rounded-lg shadow-sm flex items-center justify-center active:bg-teal-800" onClick={() => handleLoadPiece(idx)}>
                        <span className="material-symbols-outlined mr-1">add</span> Load Piece
                      </button>
                      <button className="h-12 px-3 bg-slate-100 text-slate-700 font-bold rounded-lg border border-slate-200 flex items-center justify-center" onClick={() => handleOpenCustom(idx)}>
                        Custom
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Summary Footer */}
        {requirements.length > 0 && (
          <section className="bg-slate-800 text-white p-4 rounded-xl shadow-lg mb-8">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Loading Summary</h3>
            <div className="flex justify-between items-end">
              <div>
                <div className="text-sm text-slate-300">Total Required</div>
                <div className="text-2xl font-bold">{totalRequired} pcs</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-teal-400">Total Loaded</div>
                <div className="text-3xl font-black text-teal-400">{totalLoaded} pcs</div>
              </div>
            </div>
            {totalBalance > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-700 text-sm font-medium text-slate-300 flex justify-between">
                <span>Remaining:</span>
                <span className="text-white font-bold">{totalBalance} pcs</span>
              </div>
            )}
            
            <div className="mt-4 flex gap-2">
              <button className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-semibold flex items-center justify-center gap-1 transition-colors" onClick={handleGeneratePdf}>
                 <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span> PDF
              </button>
              <button className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-semibold flex items-center justify-center gap-1 transition-colors" onClick={handleGenerateExcel}>
                 <span className="material-symbols-outlined text-[18px]">table_chart</span> Excel
              </button>
            </div>
          </section>
        )}

      </main>
    </div>
  );
}
