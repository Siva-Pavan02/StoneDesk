import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { getMasterSettings } from '../lib/api';
import { createLoadingList, updateLoadingList, fetchLoadingLists } from '../lib/loadingListApi';
import { parseFraction, decimalToFraction } from '../utils/fractionParser';
import FractionChips from './dispatch/FractionChips';
import { generateLoadingListPdf } from '../utils/generateLoadingListPdf';
import { generateLoadingListExcel } from '../utils/generateLoadingListExcel';
import { loadingTotals } from '../utils/loadingListTotals';
import { round2 } from '../utils/loadMath';
import { Button, Card, Field } from './pilot/Controls.jsx';

export default function LoadingListScreen({ onClose, embedded = false, organizationId = 'unit_04' }) {
  const { t, pick } = useLanguage();
  const Content = embedded ? 'div' : 'main';
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
      const ms = await getMasterSettings(organizationId);
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
      sqFt: round2(pLen.numeric * pWid.numeric)
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

  const { required: totalRequired, loaded: totalLoaded, pending: totalPending, excess: totalExcess } = loadingTotals(requirements);

  return (
    <div className={embedded ? 'pilot workspace-utility-screen settings-screen space-y-4' : 'pilot min-h-screen bg-slate-50 pb-24'}>
      {/* Header */}
      {embedded ? (
        <header className="screen-heading flex flex-wrap items-center gap-3">
          <Button en="Back" te="వెనక్కి" onClick={onClose} />
          <h1 className="text-lg font-semibold">{t('loadingList') || 'Loading List'}</h1>
        </header>
      ) : <header className="fixed top-0 inset-x-0 z-50 bg-white border-b border-slate-200 shadow-sm pt-safe">
        <div className="max-w-xl mx-auto w-full px-4 h-14 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <button type="button" aria-label={pick('Go back', 'వెనక్కి వెళ్ళండి')} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100" onClick={onClose}>
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <h1 className="truncate font-bold text-lg text-slate-800">{t('loadingList') || 'Loading List'}</h1>
          </div>
          <div className="flex items-center gap-2">
          <button className="px-4 py-1.5 bg-teal-700 text-white rounded-lg font-semibold text-sm" disabled={saving} onClick={handleSaveList}>
            {t('save') || 'Save'}
          </button></div>
        </div>
      </header>}

      <Content className={embedded ? 'space-y-4' : 'pt-20 px-4 max-w-xl mx-auto space-y-4'}>
        {error && <p role="alert" className="mb-4 rounded-xl border-2 border-red-300 bg-white p-4 text-red-800">{error}</p>}
        <Field en="Saved loading lists" te="సేవ్ చేసిన లోడింగ్ జాబితాలు">
          <select className="input rounded-xl" disabled={saving} value={activeListId || ''} onChange={event => {
            if (!window.confirm(pick('Replace the current form with this loading list?', 'ప్రస్తుత వివరాలను మార్చాలా?'))) return;
            const list = savedLists.find(item => item.id === event.target.value);
            setActiveListId(list?.id || null); setLoadingListNumber(list?.loadingListNumber || '');
            setSupervisor(list?.supervisor || ''); setBuyerDestination(list?.buyerDestination || '');
            setStoneType(list?.stoneType || ''); setFinish(list?.finish || '');
            setRequirements(list ? structuredClone(list.requirements) : []); setEditIndex(null); setActiveCustomIdx(null); setError('');
          }}><option value="">{pick('New loading list', 'కొత్త లోడింగ్ జాబితా')}</option>{savedLists.map(list => <option key={list.id} value={list.id}>{list.loadingListNumber} · {list.buyerDestination}</option>)}</select>
        </Field>
        
        {/* Basic Details */}
        <Card className="gap-4">
          <h2 className="section-heading text-sm font-semibold">{pick('Loading list details', 'లోడింగ్ జాబితా వివరాలు')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field en={t('supervisor')} te={t('supervisor')} type="text" value={supervisor} onChange={(e)=>setSupervisor(e.target.value)} />
            <Field en={t('destination')} te={t('destination')}>
              <select className="input rounded-xl" value={buyerDestination} onChange={(e)=>setBuyerDestination(e.target.value)}>
                <option value="">--</option>
                {settings?.savedDestinations?.map(d => <option key={d}>{d}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field en={t('stoneType')} te={t('stoneType')}>
              <select className="input rounded-xl" value={stoneType} onChange={(e)=>setStoneType(e.target.value)}>
                <option value="">--</option>
                {[...new Set(settings?.stoneRates?.map(sr => sr.stoneType))].map(st => <option key={st}>{st}</option>)}
              </select>
            </Field>
            <Field en={t('finish')} te={t('finish')}>
              <select className="input rounded-xl" value={finish} onChange={(e)=>setFinish(e.target.value)}>
                <option value="">--</option>
                {[...new Set(settings?.stoneRates?.filter(sr => sr.stoneType === stoneType).map(sr => sr.finish))].map(f => <option key={f}>{f}</option>)}
              </select>
            </Field>
          </div>
        </Card>

        {/* Add Requirement */}
        <Card>
          <div className="flex justify-between items-center mb-3">
            <h2 className="section-heading text-sm font-semibold text-slate-800">{editIndex !== null ? (t('editRequirement') || 'Edit Requirement') : (t('addRequirement') || 'Add Requirement')}</h2>
            {editIndex !== null && <Button onClick={handleCancelEdit} en={t('cancel')} te={t('cancel')} />}
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <Field en={t('length')} te={t('length')} type="text" placeholder="e.g. 4 1/2" value={reqLen} onChange={(e)=>setReqLen(e.target.value)} />
              <FractionChips value={reqLen} setValue={setReqLen} />
            </div>
            <div>
              <Field en={t('width')} te={t('width')} type="text" placeholder="e.g. 2" value={reqWid} onChange={(e)=>setReqWid(e.target.value)} />
              <FractionChips value={reqWid} setValue={setReqWid} />
            </div>
          </div>
          <div className="mb-4">
            <Field en={t('pieces')} te={t('pieces')} type="number" placeholder={t('pieces')} value={reqQty} onChange={(e)=>setReqQty(e.target.value)} />
          </div>
          <Button className="w-full" onClick={handleAddRequirement} en={editIndex !== null ? t('updateRequirement') : t('addRequirement')} te={editIndex !== null ? t('updateRequirement') : t('addRequirement')} />
        </Card>

        {/* Requirements List */}
        <section className="mb-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="section-heading text-sm font-semibold text-slate-800">{t('requirements') || 'Requirements'}</h2>
            <span className="text-xs text-gray-600">{requirements.length} {pick('lines', 'వరుసలు')}</span>
          </div>
          
          <div className="space-y-3">
            {requirements.map((req, idx) => (
              <Card key={idx} className={editIndex === idx ? 'ring-2 ring-teal-100' : ''}>
                <div className="action-row flex flex-wrap justify-end gap-2 mb-3">
                  <Button onClick={() => handleEditRequirement(idx)} en="Edit" te="మార్చండి" />
                  <Button onClick={() => handleRemoveRequirement(idx)} en={t('delete')} te={t('delete')} />
                </div>
                
                <div className="flex items-center gap-2 mb-3">
                  <div className="text-lg font-semibold text-slate-800">{req.lengthDisplay || decimalToFraction(req.lengthFt)} <span className="text-slate-400">×</span> {req.widthDisplay || decimalToFraction(req.widthFt)}</div>
                  {req.balance === 0 && <span className="ml-auto bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded">{pick('Complete', 'పూర్తయింది')}</span>}
                  {req.balance < 0 && <span className="ml-auto bg-orange-100 text-orange-800 text-xs font-medium px-2 py-1 rounded">{Math.abs(req.balance)} {pick('Excess', 'అదనపు')}</span>}
                </div>

                <div className="grid grid-cols-3 gap-2 mb-4 bg-slate-50 p-2 rounded-lg">
                  <div className="text-center">
                    <div className="text-xs text-gray-600">{pick('Required', 'అవసరం')}</div>
                    <div className="text-lg font-bold text-slate-700">{req.requiredQuantity}</div>
                  </div>
                  <div className="text-center border-l border-r border-slate-200">
                    <div className="text-xs text-gray-600">{pick('Loaded', 'లోడ్ చేసినవి')}</div>
                    <div className="text-lg font-bold text-teal-700">{req.loadedQuantity}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-600">{pick('Balance', 'మిగిలినవి')}</div>
                    <div className={`text-lg font-bold ${req.balance < 0 ? 'text-orange-600' : 'text-slate-700'}`}>{req.balance > 0 ? req.balance : 0}</div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {activeCustomIdx === idx ? (
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-slate-700">{pick('Custom piece size', 'కస్టమ్ ముక్క సైజు')}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div>
                          <Field en={t('length')} te={t('length')} type="text" value={customLen} onChange={e=>setCustomLen(e.target.value)} />
                          <div className="mt-1"><FractionChips value={customLen} setValue={setCustomLen}/></div>
                        </div>
                        <div>
                          <Field en={t('width')} te={t('width')} type="text" value={customWid} onChange={e=>setCustomWid(e.target.value)} />
                          <div className="mt-1"><FractionChips value={customWid} setValue={setCustomWid}/></div>
                        </div>
                      </div>
                      <div className="action-row flex flex-wrap gap-2">
                        <Button onClick={()=>setActiveCustomIdx(null)} en={t('cancel')} te={t('cancel')} />
                        <Button primary onClick={()=>handleCustomLoad(idx)} en="Load custom" te="కస్టమ్ ముక్క లోడ్ చేయండి" />
                      </div>
                    </div>
                  ) : (
                    <div className="action-row flex flex-wrap gap-2">
                      <Button en="−" te="−" aria-label={pick('Remove last loaded piece', 'చివరిగా లోడ్ చేసిన ముక్క తొలగించండి')} onClick={() => handleRemovePiece(idx)} disabled={req.loadedQuantity === 0} />
                      <Button primary className="flex-1" en="Load piece" te="ముక్క లోడ్ చేయండి" onClick={() => handleLoadPiece(idx)} />
                      <Button en="Custom" te="కస్టమ్" onClick={() => handleOpenCustom(idx)} />
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* Summary Footer */}
        {requirements.length > 0 && (
          <Card>
            <h2 className="section-heading text-sm font-semibold text-slate-800 mb-3">{pick('Loading summary', 'లోడింగ్ సారాంశం')}</h2>
            <div className="flex justify-between items-end">
              <div>
                <div className="text-sm text-gray-600">{pick('Total required', 'మొత్తం అవసరం')}</div>
                <div className="text-xl font-semibold tabular-nums">{totalRequired} {t('pieces')}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-600">{pick('Total loaded', 'మొత్తం లోడ్ చేసినవి')}</div>
                <div className="text-xl font-semibold tabular-nums">{totalLoaded} {t('pieces')}</div>
              </div>
            </div>
            {totalPending > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200 text-sm text-gray-600 flex justify-between">
                <span>{pick('Remaining', 'మిగిలినవి')}:</span>
                <span className="font-semibold text-gray-900 tabular-nums">{totalPending} {t('pieces')}</span>
              </div>
            )}
            {totalExcess > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200 text-sm text-gray-600 flex justify-between">
                <span>{pick('Excess', 'అదనపు')}:</span>
                <span className="font-semibold text-orange-700 tabular-nums">{totalExcess} {t('pieces')}</span>
              </div>
            )}
            
          </Card>
        )}

        {(embedded || requirements.length > 0) && <Card className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="section-heading text-sm font-semibold">{pick('Document actions', 'పత్రం చర్యలు')}</h2>
            {loadingListNumber && <span className="text-sm text-gray-600 break-all">{loadingListNumber}</span>}
          </div>
          <div className="action-row flex flex-wrap gap-2">
            {embedded && <Button primary en={saving ? pick('Saving…', 'సేవ్ అవుతోంది…') : t('save')} te={saving ? pick('Saving…', 'సేవ్ అవుతోంది…') : t('save')} disabled={saving} onClick={handleSaveList} />}
            {requirements.length > 0 && <>
              <Button en="Download PDF" te="PDF డౌన్‌లోడ్" onClick={handleGeneratePdf} />
              <Button en="Download Excel" te="Excel డౌన్‌లోడ్" onClick={handleGenerateExcel} />
            </>}
          </div>
        </Card>}
      </Content>
    </div>
  );
}
