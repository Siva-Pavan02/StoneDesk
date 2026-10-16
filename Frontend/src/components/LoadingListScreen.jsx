import React, { useState, useEffect, useRef } from 'react';
import { getMasterSettings } from '../lib/api';
import { createLoadingList, updateLoadingList, fetchLoadingLists, fetchLoadingList } from '../lib/loadingListApi';
import { parseFraction, decimalToFraction } from '../utils/fractionParser';
import FractionChips from './dispatch/FractionChips';
import { generateLoadingListPdf } from '../utils/generateLoadingListPdf';
import { generateLoadingListExcel } from '../utils/generateLoadingListExcel';
import { loadingTotals } from '../utils/loadingListTotals';
import { round2 } from '../utils/loadMath';
import { BackButton, Button, Card, Field } from './pilot/Controls.jsx';

// Exported files use the same DD/MM/YYYY India date as invoices, whatever the browser locale.
const exportDate = () => new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());

export default function LoadingListScreen({ onClose, organizationId = 'unit_04', settings: providedSettings = null }) {
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const savingLock = useRef(false);
  const [settings, setSettings] = useState(providedSettings);
  
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

  // Inline validation and save feedback (no blocking alert()).
  const [reqErrors, setReqErrors] = useState({});
  const [notice, setNotice] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(null);
  const snapshot = JSON.stringify({ supervisor, buyerDestination, stoneType, finish, requirements });
  const [savedSnapshot, setSavedSnapshot] = useState(snapshot);
  const dirty = snapshot !== savedSnapshot;
  useEffect(() => {
    if (!dirty) return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  function leave() {
    if (dirty && !window.confirm('Leave without saving this loading list?')) return;
    onClose();
  }
  const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const [historySearch, setHistorySearch] = useState('');
  const [historyQuery, setHistoryQuery] = useState('');
  const [nextCursor, setNextCursor] = useState(null);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  const historyTicket = useRef(0);
  const detailTicket = useRef(0);
  useEffect(() => {
    let active = true;
    if (providedSettings) setSettings(providedSettings);
    else getMasterSettings(organizationId).then(data => { if (active) setSettings(data); }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [organizationId, providedSettings]);
  useEffect(() => { const timer = setTimeout(() => setHistoryQuery(historySearch.trim()), 300); return () => clearTimeout(timer); }, [historySearch]);
  useEffect(() => {
    const ticket = ++historyTicket.current; setHistoryBusy(true);
    fetchLoadingLists(historyQuery ? { q: historyQuery } : {}).then(result => {
      if (ticket === historyTicket.current) { setSavedLists(result.data); setNextCursor(result.nextCursor); }
    }).catch(e => { if (ticket === historyTicket.current) setError(e.message); }).finally(() => { if (ticket === historyTicket.current) setHistoryBusy(false); });
    return () => { historyTicket.current++; };
  }, [historyQuery]);
  useEffect(() => () => { detailTicket.current++; }, []);
  async function moreLists() {
    if (historyBusy || !nextCursor) return;
    const ticket = ++historyTicket.current; setHistoryBusy(true);
    try { const result = await fetchLoadingLists({ ...(historyQuery ? { q: historyQuery } : {}), cursor: nextCursor });
      if (ticket === historyTicket.current) { setSavedLists(rows => [...rows, ...result.data]); setNextCursor(result.nextCursor); }
    } catch(e) { if (ticket === historyTicket.current) setError(e.message); }
    finally { if (ticket === historyTicket.current) setHistoryBusy(false); }
  }

  const handleAddRequirement = () => {
    const pLen = parseFraction(reqLen);
    const pWid = parseFraction(reqWid);
    const qty = Number(reqQty);

    const errors = {
      ...(!pLen && { length: 'Enter a length like 4 1/2' }),
      ...(!pWid && { width: 'Enter a width like 2' }),
      ...((!Number.isSafeInteger(qty) || qty <= 0) && { quantity: 'Enter a whole number of pieces, like 10' }),
    };
    setReqErrors(errors);
    const firstInvalid = ['length', 'width', 'quantity'].find(key => errors[key]);
    if (firstInvalid) {
      document.getElementById(`requirement-${firstInvalid}`)?.focus();
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
    setReqErrors({});
    window.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' });
    document.getElementById('requirement-length')?.focus({ preventScroll: true });
  };

  const handleCancelEdit = () => {
    setEditIndex(null);
    setReqErrors({});
    setReqLen('');
    setReqWid('');
    setReqQty('');
  };

  const handleRemoveRequirement = (index) => {
    const updated = [...requirements];
    updated.splice(index, 1);
    setRequirements(updated);
    setConfirmRemove(null);
    // Editing indexes shift after a removal; leave edit mode rather than edit the wrong line.
    if (editIndex !== null) handleCancelEdit();
  };

  const handleLoadPiece = (index, overrideLenDisplay = null, overrideWidDisplay = null) => {
    const updated = [...requirements];
    const req = updated[index];
    
    let lDisplay = overrideLenDisplay || req.lengthDisplay || decimalToFraction(req.lengthFt);
    let wDisplay = overrideWidDisplay || req.widthDisplay || decimalToFraction(req.widthFt);
    let pLen = parseFraction(lDisplay);
    let pWid = parseFraction(wDisplay);
    
    if (!pLen || !pWid) {
      setError('Enter the custom length and width like 4 1/2, then load the piece.');
      return false;
    }
    setError('');

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
    if (handleLoadPiece(index, customLen, customWid) === false) return;
    setActiveCustomIdx(null);
  };

  const handleSaveList = async () => {
    if (savingLock.current || opening) return;
    const missing = [['supervisor', supervisor], ['destination', buyerDestination], ['stone-type', stoneType], ['finish', finish]].find(([, value]) => !value);
    if (missing) {
      setNotice('');
      setError('Fill manager, destination, stone type and finish before saving.');
      document.getElementById(`loading-list-${missing[0]}`)?.focus();
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

    savingLock.current = true; setSaving(true); setError(''); setNotice('');
    const savingSnapshot = snapshot;
    try {
      // Both endpoints return the saved list, so update it locally instead of refetching everything.
      if (activeListId) {
        const updated = await updateLoadingList(activeListId, payload);
        setSavedLists(lists => lists.map(list => list.id === updated.id ? updated : list));
      } else {
        const created = await createLoadingList(payload);
        setActiveListId(created.id);
        setLoadingListNumber(created.loadingListNumber);
        setSavedLists(lists => [created, ...lists]);
      }
      setSavedSnapshot(savingSnapshot);
      setNotice('Loading list saved.');
    } catch (e) {
      setError(e.message);
    } finally { savingLock.current = false; setSaving(false); }
  };

  const handleGeneratePdf = () => {
    if (opening) return;
    const listData = {
      loadingListNumber: loadingListNumber || `LL-${Date.now()}`,
      date: exportDate(),
      supervisor,
      buyerDestination,
      stoneType,
      finish,
      requirements
    };
    generateLoadingListPdf(listData);
  };

  const handleGenerateExcel = () => {
    if (opening) return;
    const listData = {
      loadingListNumber: loadingListNumber || `LL-${Date.now()}`,
      date: exportDate(),
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
    <div className="pilot workspace-utility-screen settings-screen space-y-4">
      <header className="screen-heading">
        <BackButton label="Back" onClick={leave} />
        <h1>Loading List</h1>
      </header>

      <div className="space-y-4">
        {error && <p role="alert" className="control-error">{error}</p>}
        {opening && <p role="status">Opening loading list…</p>}
        <fieldset disabled={opening} className="space-y-4 min-w-0">
        <Field label="Search loading lists" type="search" name="q" autoComplete="off" spellCheck={false} maxLength={120} value={historySearch} onChange={e => setHistorySearch(e.target.value)} />
        <Field label="Saved loading lists">
          <select className="input" disabled={saving || opening || historyBusy} value={activeListId || ''} onChange={async event => {
            if (!window.confirm('Replace the current form with this loading list?')) return;
            const id = event.target.value;
            const ticket = ++detailTicket.current; setOpening(true);
            try {
            const list = id ? await fetchLoadingList(id) : null;
            if (ticket !== detailTicket.current) return;
            setActiveListId(list?.id || null); setLoadingListNumber(list?.loadingListNumber || '');
            setSupervisor(list?.supervisor || ''); setBuyerDestination(list?.buyerDestination || '');
            setStoneType(list?.stoneType || ''); setFinish(list?.finish || '');
            const opened = list ? structuredClone(list.requirements) : [];
            setRequirements(opened); setEditIndex(null); setActiveCustomIdx(null); setError(''); setNotice(''); setReqErrors({}); setConfirmRemove(null);
            setSavedSnapshot(JSON.stringify({ supervisor: list?.supervisor || '', buyerDestination: list?.buyerDestination || '', stoneType: list?.stoneType || '', finish: list?.finish || '', requirements: opened }));
            } catch(e) { if (ticket === detailTicket.current) setError(e.message); }
            finally { if (ticket === detailTicket.current) setOpening(false); }
          }}><option value="">New loading list</option>{savedLists.map(list => <option key={list.id} value={list.id}>{list.loadingListNumber} · {list.buyerDestination}</option>)}</select>
        </Field>
        
        {historyBusy && <p role="status">Loading lists…</p>}
        {nextCursor && <Button onClick={moreLists} disabled={historyBusy} label="Load more lists" />}
        {!historyBusy && savedLists.length === 0 && <p>No saved lists match.</p>}
        {/* Basic Details */}
        <Card className="gap-4">
          <h2 className="section-heading">Loading list details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Manager" type="text" id="loading-list-supervisor" name="supervisor" autoComplete="off" value={supervisor} onChange={(e)=>setSupervisor(e.target.value)} />
            <Field label="Destination">
              <select id="loading-list-destination" name="buyerDestination" className="input" value={buyerDestination} onChange={(e)=>setBuyerDestination(e.target.value)}>
                <option value="">--</option>
                {settings?.savedDestinations?.map(d => <option key={d}>{d}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Stone Type">
              <select id="loading-list-stone-type" name="stoneType" className="input" value={stoneType} onChange={(e)=>setStoneType(e.target.value)}>
                <option value="">--</option>
                {[...new Set(settings?.stoneRates?.map(sr => sr.stoneType))].map(st => <option key={st}>{st}</option>)}
              </select>
            </Field>
            <Field label="Finish">
              <select id="loading-list-finish" name="finish" className="input" value={finish} onChange={(e)=>setFinish(e.target.value)}>
                <option value="">--</option>
                {[...new Set(settings?.stoneRates?.filter(sr => sr.stoneType === stoneType).map(sr => sr.finish))].map(f => <option key={f}>{f}</option>)}
              </select>
            </Field>
          </div>
        </Card>

        {/* Add Requirement */}
        <Card>
          <div className="flex justify-between items-center mb-3">
            <h2 className="section-heading text-sm font-semibold text-on-surface">{editIndex !== null ? 'Edit requirement' : 'Add Requirement'}</h2>
            {editIndex !== null && <Button onClick={handleCancelEdit} label="Cancel" />}
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <Field label="Length (ft)" type="text" id="requirement-length" name="length" autoComplete="off" spellCheck={false} placeholder="e.g. 4 1/2…" error={reqErrors.length} value={reqLen} onChange={(e)=>setReqLen(e.target.value)} />
              <FractionChips value={reqLen} setValue={setReqLen} label="Length (ft)" />
            </div>
            <div>
              <Field label="Width (ft)" type="text" id="requirement-width" name="width" autoComplete="off" spellCheck={false} placeholder="e.g. 2…" error={reqErrors.width} value={reqWid} onChange={(e)=>setReqWid(e.target.value)} />
              <FractionChips value={reqWid} setValue={setReqWid} label="Width (ft)" />
            </div>
          </div>
          <div className="mb-4">
            <Field label="Pieces" type="number" id="requirement-quantity" name="quantity" placeholder="e.g. 10…" error={reqErrors.quantity} value={reqQty} onChange={(e)=>setReqQty(e.target.value)} />
          </div>
          <Button className="w-full" onClick={handleAddRequirement} label={editIndex !== null ? 'Update requirement' : 'Add Requirement'} />
        </Card>

        {/* Requirements List */}
        <section className="mb-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="section-heading text-sm font-semibold text-on-surface">Requirements</h2>
            <span className="text-xs text-on-surface-variant">{requirements.length} lines</span>
          </div>
          
          <div className="space-y-3">
            {requirements.map((req, idx) => {
              const size = `${req.lengthDisplay || decimalToFraction(req.lengthFt)} × ${req.widthDisplay || decimalToFraction(req.widthFt)}`;
              return (
              <Card key={idx} className={editIndex === idx ? 'ring-2 ring-primary-container' : ''}>
                {confirmRemove === idx ? (
                  <div className="load-delete mb-3" data-state="confirming">
                    <span className="load-delete-question" role="status">{`Delete requirement ${size}?`}</span>
                    <Button variant="danger" className="load-delete-confirm" onClick={() => handleRemoveRequirement(idx)} label="Yes, delete" />
                    <Button className="load-delete-cancel" data-requirement-cancel={idx} onClick={() => { setConfirmRemove(null); requestAnimationFrame(() => document.querySelector(`[data-requirement-delete="${idx}"]`)?.focus()); }} label="Cancel" />
                  </div>
                ) : <div className="action-row flex flex-wrap justify-end gap-2 mb-3">
                  <Button onClick={() => handleEditRequirement(idx)} label="Edit" aria-label={`Edit ${size}`} />
                  <Button variant="danger-quiet" onClick={() => { setConfirmRemove(idx); requestAnimationFrame(() => document.querySelector(`[data-requirement-cancel="${idx}"]`)?.focus()); }} data-requirement-delete={idx} label="Delete" aria-label={`Delete ${size}`} />
                </div>}
                
                <div className="flex items-center gap-2 mb-3">
                  <div className="text-lg font-semibold text-on-surface">{req.lengthDisplay || decimalToFraction(req.lengthFt)} <span className="text-on-surface-variant">×</span> {req.widthDisplay || decimalToFraction(req.widthFt)}</div>
                  {req.balance === 0 && <span className="ml-auto bg-success-container text-success text-xs font-medium px-2 py-1 rounded">Complete</span>}
                  {req.balance < 0 && <span className="ml-auto bg-warning-container text-warning text-xs font-medium px-2 py-1 rounded">{Math.abs(req.balance)} Excess</span>}
                </div>

                <div className="grid grid-cols-3 gap-2 mb-4 bg-surface p-2 rounded-lg">
                  <div className="text-center">
                    <div className="text-xs text-on-surface-variant">Required</div>
                    <div className="text-lg font-bold text-on-surface tabular-nums">{req.requiredQuantity}</div>
                  </div>
                  <div className="text-center border-l border-r border-outline-variant">
                    <div className="text-xs text-on-surface-variant">Loaded</div>
                    <div className="text-lg font-bold text-primary tabular-nums">{req.loadedQuantity}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-on-surface-variant">Balance</div>
                    <div className={`text-lg font-bold tabular-nums ${req.balance < 0 ? 'text-warning' : 'text-on-surface'}`}>{req.balance > 0 ? req.balance : 0}</div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {activeCustomIdx === idx ? (
                    <div className="bg-surface p-3 rounded-lg border border-outline-variant">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-on-surface">Custom piece size</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div>
                          <Field label="Length (ft)" type="text" name="customLength" autoComplete="off" spellCheck={false} value={customLen} onChange={e=>setCustomLen(e.target.value)} />
                          <div className="mt-1"><FractionChips value={customLen} setValue={setCustomLen} label="Length (ft)" /></div>
                        </div>
                        <div>
                          <Field label="Width (ft)" type="text" name="customWidth" autoComplete="off" spellCheck={false} value={customWid} onChange={e=>setCustomWid(e.target.value)} />
                          <div className="mt-1"><FractionChips value={customWid} setValue={setCustomWid} label="Width (ft)" /></div>
                        </div>
                      </div>
                      <div className="action-row flex flex-wrap gap-2">
                        <Button onClick={()=>setActiveCustomIdx(null)} label="Cancel" />
                        <Button primary onClick={()=>handleCustomLoad(idx)} label="Load custom" />
                      </div>
                    </div>
                  ) : (
                    <div className="action-row flex flex-wrap gap-2">
                      <Button label="−" aria-label="Remove last loaded piece" onClick={() => handleRemovePiece(idx)} disabled={req.loadedQuantity === 0} />
                      <Button primary className="flex-1" label="Load piece" onClick={() => handleLoadPiece(idx)} />
                      <Button label="Custom" aria-label={`Custom piece for ${size}`} onClick={() => handleOpenCustom(idx)} />
                    </div>
                  )}
                </div>
              </Card>
              );
            })}
          </div>
        </section>

        {/* Summary Footer */}
        {requirements.length > 0 && (
          <Card>
            <h2 className="section-heading text-sm font-semibold text-on-surface mb-3">Loading summary</h2>
            <div className="flex justify-between items-end">
              <div>
                <div className="text-sm text-on-surface-variant">Total required</div>
                <div className="text-xl font-semibold tabular-nums">{totalRequired} Pieces</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-on-surface-variant">Total loaded</div>
                <div className="text-xl font-semibold tabular-nums">{totalLoaded} Pieces</div>
              </div>
            </div>
            {totalPending > 0 && (
              <div className="mt-3 pt-3 border-t border-outline-variant text-sm text-on-surface-variant flex justify-between">
                <span>Remaining:</span>
                <span className="font-semibold text-on-surface tabular-nums">{totalPending} Pieces</span>
              </div>
            )}
            {totalExcess > 0 && (
              <div className="mt-3 pt-3 border-t border-outline-variant text-sm text-on-surface-variant flex justify-between">
                <span>Excess:</span>
                <span className="font-semibold text-warning tabular-nums">{totalExcess} Pieces</span>
              </div>
            )}
            
          </Card>
        )}

        <Card className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="section-heading">Document actions</h2>
            {loadingListNumber && <span className="text-sm text-on-surface-variant break-all">{loadingListNumber}</span>}
          </div>
          <div className="action-row flex flex-wrap gap-2">
            {notice && <p role="status" className="basis-full text-sm text-primary">{notice}</p>}
            <Button primary label={saving ? 'Saving…' : 'Save'} disabled={saving || opening} onClick={handleSaveList} />
            {requirements.length > 0 && <>
              <Button label="Download PDF" onClick={handleGeneratePdf} />
              <Button label="Download Excel" onClick={handleGenerateExcel} />
            </>}
          </div>
        </Card>
        </fieldset>
      </div>
    </div>
  );
}
