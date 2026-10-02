import React, { useState, useEffect } from 'react';
import DispatchHeader from './dispatch/DispatchHeader';
import DispatchDetails from './dispatch/DispatchDetails';
import StoneMeasurementForm from './dispatch/StoneMeasurementForm';
import DispatchSummary from './dispatch/DispatchSummary';
import DispatchActions from './dispatch/DispatchActions';
import { calculatePiece, calculateDispatchTotals } from '../utils/dispatchCalculations';
import { generateBuyerInvoiceExcel } from '../utils/generateBuyerInvoiceExcel';
import { generateBuyerInvoice } from '../utils/generateBuyerInvoice';
import { generateDriverTransitSlip } from '../utils/generateDriverTransitSlip';
import { getMasterSettings, createDispatch, updateDispatch, finalizeDispatch } from '../lib/api';

export default function DispatchTracker({ onOpenSettings, onOpenHistory }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [settings, setSettings] = useState(null);
  const [truckNumber, setTruckNumber] = useState('');
  const [buyerDestination, setBuyerDestination] = useState('');
  const [stoneType, setStoneType] = useState('');
  const [finish, setFinish] = useState('');
  const [ratePerSqFt, setRatePerSqFt] = useState('');
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [pieces, setPieces] = useState([]);
  const [currentDispatch, setCurrentDispatch] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);


  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getMasterSettings('unit_04');
      setSettings(data);
      if (data.stoneRates && data.stoneRates.length > 0) {
        setStoneType(data.stoneRates[0].stoneType);
        setFinish(data.stoneRates[0].finish);
        setRatePerSqFt(data.stoneRates[0].defaultRate.toString());
      }
    } catch (err) {
      setError('Unable to load dispatch configuration. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPiece = () => {
    try {
      const p = calculatePiece(length, width);
      setPieces([...pieces, { stoneType, finish, ratePerSqFt, ...p }]);
      setLength('');
      setWidth('');
    } catch (e) {
      // Invalid dimensions, do not add
    }
  };

  const handleRemovePiece = (index) => {
    setPieces(pieces.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-700"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6 text-center">
        <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4"><span className="material-symbols-outlined">error</span></div>
        <p className="text-slate-700 font-medium mb-4">{error}</p>
        <button onClick={loadSettings} className="px-4 py-2 bg-teal-700 text-white rounded-lg font-semibold shadow-sm active:scale-95 transition-all">Retry</button>
      </div>
    );
  }

  
  const buildPayload = () => {
    const inventoryMap = {};
    pieces.forEach(p => {
      const key = `${p.stoneType}|${p.finish}|${p.ratePerSqFt}`;
      if (!inventoryMap[key]) {
        inventoryMap[key] = {
          stoneType: p.stoneType,
          finish: p.finish,
          ratePerSqFt: Number(p.ratePerSqFt),
          pieces: []
        };
      }
      inventoryMap[key].pieces.push({
        lengthFt: p.lengthFt,
        widthFt: p.widthFt
      });
    });

    return {
      supervisor: 'Supervisor',
      logistics: { truckNumber, buyerDestination },
      inventory: Object.values(inventoryMap)
    };
  };

  const handleSaveDraft = async () => {
    try {
      setIsSaving(true);
      setSaveMessage(null);
      const payload = buildPayload();
      
      let res;
      if (currentDispatch && currentDispatch.status === 'Draft') {
        res = await updateDispatch(currentDispatch._id, payload);
        setSaveMessage('Draft updated');
      } else {
        res = await createDispatch(payload);
        setSaveMessage('Draft created');
      }
      setCurrentDispatch(res);
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      alert(err.message || 'Error saving dispatch');
    } finally {
      setIsSaving(false);
    }
  };

  
  
  
  const handleDownloadExcel = () => {
    try {
      if (!currentDispatch || (currentDispatch.status !== 'Dispatched' && currentDispatch.status !== 'Delivered')) {
        alert('Please finalize the dispatch first.');
        return;
      }
      const { blob, filename } = generateBuyerInvoiceExcel(currentDispatch);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || 'Error generating Excel file');
    }
  };

  const handleDownloadInvoice = async () => {
    try {
      if (!currentDispatch || (currentDispatch.status !== 'Dispatched' && currentDispatch.status !== 'Delivered')) {
        alert('Please finalize the dispatch first.');
        return;
      }
      setIsSaving(true);
      const { blob, filename } = await generateBuyerInvoice(currentDispatch);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || 'Error generating buyer invoice');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadDriverSlip = () => {
    try {
      if (!currentDispatch || (currentDispatch.status !== 'Dispatched' && currentDispatch.status !== 'Delivered')) {
        alert('Please finalize the dispatch first.');
        return;
      }
      const { blob, filename } = generateDriverTransitSlip(currentDispatch);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || 'Error generating transit slip');
    }
  };

  const handleFinalize = async () => {
    try {
      if (!currentDispatch) {
        alert('Please save as draft first before finalizing.');
        return;
      }
      setIsSaving(true);
      setSaveMessage(null);
      
      // Optionally update draft first to ensure latest pieces are caught
      await updateDispatch(currentDispatch._id, buildPayload());
      
      const res = await finalizeDispatch(currentDispatch._id);
      setCurrentDispatch(res);
      setSaveMessage('Dispatch finalized!');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      alert(err.message || 'Error finalizing dispatch');
    } finally {
      setIsSaving(false);
    }
  };

  const groups = pieces.map(p => ({ totalSqFt: p.sqFt, ratePerSqFt: p.ratePerSqFt }));
  const totals = calculateDispatchTotals(groups, settings?.defaultRoyaltyFee || 8500);

  return (
    <>
      <DispatchHeader onOpenSettings={onOpenSettings} onOpenHistory={onOpenHistory} />
      <main className="flex-1 flex flex-col relative w-full max-w-xl mx-auto px-4 pt-24 bg-gray-50">
        <div className="flex flex-col w-full pb-36">
          <DispatchDetails
            truckNumber={truckNumber}
            setTruckNumber={setTruckNumber}
            buyerDestination={buyerDestination}
            setBuyerDestination={setBuyerDestination}
            savedTrucks={settings?.savedTrucks || []}
            savedDestinations={settings?.savedDestinations || []}
          />
          <StoneMeasurementForm
            stoneType={stoneType}
            setStoneType={setStoneType}
            finish={finish}
            setFinish={setFinish}
            length={length}
            setLength={setLength}
            width={width}
            setWidth={setWidth}
            ratePerSqFt={ratePerSqFt}
            setRatePerSqFt={setRatePerSqFt}
            onAddPiece={handleAddPiece}
            pieces={pieces}
            onRemovePiece={handleRemovePiece}
            stoneRates={settings?.stoneRates || []}
          />
          <DispatchSummary totals={totals} />
          <DispatchActions totals={totals} onSaveDraft={handleSaveDraft} onFinalize={handleFinalize} onDownloadSlip={handleDownloadDriverSlip} onDownloadInvoice={handleDownloadInvoice} onDownloadExcel={handleDownloadExcel} isSaving={isSaving} saveMessage={saveMessage} currentDispatch={currentDispatch} />
        </div>
      </main>
    </>
  );
}
