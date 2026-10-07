import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';

export default function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  
  return (
    <div className="flex items-center gap-3 ml-auto mr-4 text-[14px] font-semibold">
      <button 
        type="button"
        className={`transition-colors py-2 px-1 ${language === 'en' ? 'text-teal-700' : 'text-gray-500 hover:text-gray-900'}`}
        onClick={() => setLanguage('en')}
      >
        English
      </button>
      <span className="text-gray-300 select-none" aria-hidden="true">|</span>
      <button 
        type="button"
        className={`transition-colors py-2 px-1 ${language === 'te' ? 'text-teal-700' : 'text-gray-500 hover:text-gray-900'}`}
        onClick={() => setLanguage('te')}
      >
        తెలుగు
      </button>
    </div>
  );
}
