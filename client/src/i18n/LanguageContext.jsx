import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { translations } from './translations';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    try {
      const stored = localStorage.getItem('granitesync-language');
      if (stored === 'te' || stored === 'en') {
        return stored;
      }
    } catch (e) {
      // localStorage error fallback
    }
    return 'en'; // Deterministic default
  });

  useEffect(() => {
    document.documentElement.lang = language;
    try {
      localStorage.setItem('granitesync-language', language);
    } catch (e) {
      // localStorage error fallback
    }
  }, [language]);

  const t = useCallback((key) => {
    return translations[language][key] || translations['en'][key] || key;
  }, [language]);
  const pick = useCallback((en, te) => language === 'te' ? (te || en) : en, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, pick }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
