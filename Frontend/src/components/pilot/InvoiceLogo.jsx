import { useState } from 'react';
import { ImageIcon } from '@radix-ui/react-icons';

export default function InvoiceLogo({ src, businessName }) {
  const [failedSource, setFailedSource] = useState(null);
  const hasLogo = Boolean(src) && failedSource !== src;

  return hasLogo ? <div className="invoice-logo" data-logo="saved">
    <img src={src} width={48} height={48} alt={`${businessName || 'Business'} logo`} onError={() => setFailedSource(src)} />
  </div> : <div className="invoice-logo invoice-logo-placeholder" data-logo="placeholder" role="img" aria-label="Business logo placeholder">
    <ImageIcon aria-hidden="true" focusable="false" />
    <span aria-hidden="true">YOUR LOGO</span>
  </div>;
}