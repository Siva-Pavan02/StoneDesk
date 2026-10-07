import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';

export default function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  
  return (
    <button type="button" role="switch" aria-checked={language === 'te'}
      aria-label="Telugu language / తెలుగు" title={language === 'te' ? 'Switch to English' : 'తెలుగుకు మార్చండి'}
      className="language-switch" onClick={() => setLanguage(language === 'te' ? 'en' : 'te')}>
      <span lang="en">EN</span><span className="language-switch-track" aria-hidden="true"><span /></span><span lang="te">తెలుగు</span>
    </button>
  );
}
