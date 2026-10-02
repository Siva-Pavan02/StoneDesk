import React from 'react';

export default function DispatchHeader({ onOpenSettings, onOpenHistory }) {
  return (
    <>
      <header className="fixed top-0 inset-x-0 z-50 bg-white border-b border-slate-200 shadow-sm pt-safe">
        <div className="max-w-xl mx-auto w-full px-gutter">
          <div className="h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button aria-label="Go back" className="w-9 h-9 -ml-1.5 flex items-center justify-center rounded-full text-on-surface hover:text-primary hover:bg-slate-100 transition-colors focus:outline-none" onClick={() => console.log("clicked")} data-original-onclick="history.back()" type="button"><span className="material-symbols-outlined text-[24px]">arrow_back</span></button>
              <h1 className="font-title-lg text-title-lg tracking-tight text-on-surface leading-none font-bold">GraniteSync</h1>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="flex items-center p-0.5 bg-slate-100 border border-slate-200 rounded-full text-xs font-semibold">
                <button className="px-2 py-0.5 rounded-full bg-primary text-white shadow-xs font-bold leading-tight" type="button">EN</button>
                <button className="px-2 py-0.5 rounded-full text-slate-500 hover:text-slate-800 leading-tight transition-colors" type="button">TE</button>
              </div>
              <button onClick={onOpenHistory} aria-label="History" className="w-8 h-8 rounded-full flex items-center justify-center text-slate-600 hover:text-primary hover:bg-slate-100 transition-colors" type="button"><span className="material-symbols-outlined text-[20px]">history</span></button>
              <button onClick={onOpenSettings} aria-label="Settings" className="w-8 h-8 rounded-full flex items-center justify-center text-slate-600 hover:text-primary hover:bg-slate-100 transition-colors" type="button"><span className="material-symbols-outlined text-[20px]">settings</span></button>
              <div aria-label="Operator Avatar" className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-sm"><span className="material-symbols-outlined text-on-primary text-[18px]">person</span></div>
            </div>
          </div>
          <div className="pb-2 px-1 flex items-center justify-between border-t border-slate-100 pt-1">
            <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">Dispatch Tracker Form • 24 Oct 2024</span>
          </div>
        </div>
      </header>
    </>
  );
}
