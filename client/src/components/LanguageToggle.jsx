import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';

export default function LanguageToggle() {
  const { language, setLanguage, pick } = useLanguage();
  return <button type="button" className="btn min-h-12 h-12 shrink-0 rounded-xl border-2 border-gray-300 bg-white px-3 text-gray-900 shadow-none"
    aria-label={pick('Switch to Telugu', 'Switch to English')} lang={language === 'en' ? 'te' : 'en'}
    onClick={() => setLanguage(language === 'en' ? 'te' : 'en')}>
    {language === 'en' ? 'తెలుగు' : 'English'}
  </button>;
}
