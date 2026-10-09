import { useState } from 'react';
import { ImageIcon } from '@radix-ui/react-icons';
import { useLanguage } from '../../i18n/LanguageContext';

export default function InvoiceLogo({ src, businessName }) {
  const { pick } = useLanguage();
  const [failedSource, setFailedSource] = useState(null);
  const hasLogo = Boolean(src) && failedSource !== src;

  return hasLogo ? <div className="invoice-logo" data-logo="saved">
    <img src={src} alt={pick(`${businessName || 'Business'} logo`, `${businessName || 'వ్యాపారం'} లోగో`)} onError={() => setFailedSource(src)} />
  </div> : <div className="invoice-logo invoice-logo-placeholder" data-logo="placeholder" role="img" aria-label={pick('Business logo placeholder', 'వ్యాపార లోగో కోసం స్థలం')}>
    <ImageIcon aria-hidden="true" focusable="false" />
    <span aria-hidden="true">{pick('YOUR LOGO', 'మీ లోగో')}</span>
  </div>;
}