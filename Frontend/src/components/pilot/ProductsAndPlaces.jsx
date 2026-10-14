import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { PRODUCTS_TABS, productsTab, productsTabRoute } from '../../utils/workspaceRoutes.js';
import { Button } from './Controls.jsx';
import ProductSettings from './ProductSettings.jsx';
import ReferencesPanel from './SavedReferences.jsx';

const labels = {
  products: ['Products', 'రకాలు'],
  trucks: ['Trucks', 'లారీలు'],
  destinations: ['Destinations', 'గమ్యస్థానాలు'],
};

// Combined Products & places screen. The selected tab comes from the hash (view); every tab change goes through navigate().
export default function ProductsAndPlaces({ view, settings, user, onChanged, navigate, onboarding, onFinishOnboarding }) {
  const { pick } = useLanguage();
  const tab = productsTab(view);
  const stoneRates = settings?.stoneRates || [];
  const counts = {
    products: stoneRates.length,
    trucks: (settings?.savedTrucks || []).length,
    destinations: (settings?.savedDestinations || []).length,
  };
  return <div className="products-places space-y-4 text-sm">
    <header className="references-heading">
      <h1>{pick('Products & places', 'రకాలు మరియు ప్రదేశాలు')}</h1>
      <p>{pick('Products, rates, trucks and destinations used when you fill in a load.', 'లోడ్ నింపేటప్పుడు వాడే రకాలు, ధరలు, లారీలు మరియు గమ్యస్థానాలు.')}</p>
    </header>
    <div role="group" aria-label={pick('Products & places sections', 'రకాలు మరియు ప్రదేశాల విభాగాలు')} className="settings-language-options references-switch">
      {PRODUCTS_TABS.map(key => <button type="button" key={key} aria-pressed={tab === key}
        onClick={() => { if (tab !== key) navigate(productsTabRoute(key)); }}>
        {pick(...labels[key])}<span className="references-count" aria-hidden="true">{counts[key]}</span>
      </button>)}
    </div>
    {tab === 'products'
      ? <ProductSettings settings={settings} onChanged={onChanged} user={user} />
      : <ReferencesPanel key={tab} kind={tab} settings={settings} user={user} onChanged={onChanged} />}
    {onboarding && <div className="action-row flex justify-end border-t border-gray-200 pt-4">
      <Button primary disabled={!stoneRates.length} en="Open workspace" te="వర్క్‌స్పేస్ తెరవండి" onClick={onFinishOnboarding} />
    </div>}
  </div>;
}
