import React, { useState, useEffect, useMemo } from 'react';
import { getAllDispatches } from '../lib/api';

export default function DispatchHistory({ onClose }) {
  const [dispatches, setDispatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadDispatches();
  }, []);

  const loadDispatches = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAllDispatches();
      setDispatches(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  const filteredDispatches = useMemo(() => {
    if (!searchQuery.trim()) return dispatches;
    const lowerQuery = searchQuery.toLowerCase();
    return dispatches.filter(d => {
      const slipMatch = d.dispatchSlipNumber?.toLowerCase().includes(lowerQuery);
      const truckMatch = d.logistics?.truckNumber?.toLowerCase().includes(lowerQuery);
      const destMatch = d.logistics?.buyerDestination?.toLowerCase().includes(lowerQuery);
      return slipMatch || truckMatch || destMatch;
    });
  }, [dispatches, searchQuery]);

  const formatCurrency = (val) => Number(val || 0).toLocaleString('en-IN');
  
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    if (status === 'Draft') return 'bg-amber-100 text-amber-800 border-amber-200';
    if (status === 'Dispatched') return 'bg-green-100 text-green-800 border-green-200';
    if (status === 'Delivered') return 'bg-blue-100 text-blue-800 border-blue-200';
    return 'bg-slate-100 text-slate-800 border-slate-200';
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="fixed top-0 inset-x-0 z-50 bg-white border-b border-slate-200 shadow-sm pt-safe">
        <div className="max-w-xl mx-auto w-full px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button aria-label="Go back" className="w-9 h-9 -ml-1.5 flex items-center justify-center rounded-full text-slate-700 hover:text-teal-700 hover:bg-slate-100 transition-colors" onClick={onClose} type="button">
              <span className="material-symbols-outlined text-[24px]">arrow_back</span>
            </button>
            <h1 className="text-lg font-bold text-slate-900 leading-none">Dispatch History</h1>
          </div>
        </div>
        <div className="max-w-xl mx-auto w-full px-4 pb-3 pt-2">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
            <input 
              type="text" 
              placeholder="Search slip, truck, or destination..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-12 pl-10 pr-4 border border-slate-300 rounded-lg focus:border-teal-700 focus:ring-1 focus:ring-teal-700 outline-none text-slate-800"
            />
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col w-full max-w-xl mx-auto px-4 pt-36 pb-10">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading history...</div>
        ) : error ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex flex-col items-center">
            <p className="mb-4">{error}</p>
            <button onClick={loadDispatches} className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold">Retry</button>
          </div>
        ) : filteredDispatches.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            {searchQuery ? 'No dispatches found matching your search.' : 'No dispatch records available.'}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredDispatches.map(dispatch => (
              <div key={dispatch._id} className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex flex-col gap-3">
                
                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-900 text-lg">{dispatch.dispatchSlipNumber}</span>
                    <span className="text-sm text-slate-500">{formatDate(dispatch.date)}</span>
                  </div>
                  <span className={`px-2 py-1 text-xs font-bold rounded border uppercase tracking-wider ${getStatusColor(dispatch.status)}`}>
                    {dispatch.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-y-2 text-sm border-t border-slate-100 pt-3">
                  <div className="flex flex-col">
                    <span className="text-slate-500 text-xs font-semibold uppercase">Truck</span>
                    <span className="font-semibold text-slate-800">{dispatch.logistics?.truckNumber || '-'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-slate-500 text-xs font-semibold uppercase">Destination</span>
                    <span className="font-semibold text-slate-800">{dispatch.logistics?.buyerDestination || '-'}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center border-t border-slate-100 pt-3">
                  <div className="flex flex-col">
                    <span className="text-slate-500 text-xs font-semibold uppercase">Total Sq.Ft</span>
                    <span className="font-bold text-slate-800">{dispatch.summary?.totalSqFt?.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-slate-500 text-xs font-semibold uppercase">Net Billable</span>
                    <span className="font-bold text-green-700 text-lg">₹{formatCurrency(dispatch.summary?.netPayableAmount)}</span>
                  </div>
                </div>
                
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
