import { useLanguage } from '../../i18n/LanguageContext';
import { billRows } from '../../utils/billData.js';
import InvoiceLogo from './InvoiceLogo.jsx';
import InvoiceTable from './InvoiceTable.jsx';
import LoadSummary from './LoadSummary.jsx';

export default function InvoiceDocument({ record, compact = false, sample = false, children }) {
  const { pick, language } = useLanguage();
  const business = record.businessSnapshot || {};
  const finalized = record.status !== 'Draft';
  const status = record.status === 'Draft' ? pick('Draft', 'డ్రాఫ్ట్') : record.status === 'Delivered' ? pick('Delivered', 'డెలివరీ అయింది') : pick('In transit', 'ప్రయాణంలో');
  const date = new Date(record.date).toLocaleDateString(language === 'te' ? 'te-IN' : 'en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

  return <article className={`invoice-paper ${compact ? 'invoice-paper-compact' : ''} ${sample ? 'mk-invoice' : ''}`} aria-label={sample ? pick('Sample buyer load bill', 'నమూనా కొనుగోలుదారు లోడ్ బిల్లు') : pick('Buyer load bill', 'కొనుగోలుదారు లోడ్ బిల్లు')}>
    <header className="invoice-document-header">
      <div className="invoice-brand">
        <InvoiceLogo src={business.logoDataUrl} businessName={business.businessName} />
        <div className="invoice-business-details">
          <h2 className="invoice-business-name">{business.businessName || 'StoneDesk'}</h2>
          {business.address && <p className="invoice-contact">{business.address}</p>}
          {business.phone && <p className="invoice-contact">{business.phone}</p>}
        </div>
      </div>
      <div className="invoice-reference">
        <p className="invoice-document-kind">{finalized ? pick('Buyer invoice', 'కొనుగోలుదారు బిల్లు') : pick('Draft invoice', 'డ్రాఫ్ట్ బిల్లు')}</p>
        {sample ? <span className="invoice-sample-tag">{pick('SAMPLE DATA', 'నమూనా సమాచారం')}</span> : <span className={`status-tag status-${record.status.toLowerCase()}`}>{status}</span>}
      </div>
    </header>

    <dl className="invoice-metadata">
      <div><dt>{pick('Party name', 'పార్టీ పేరు')}</dt><dd>{record.partyName || pick('Not recorded', 'నమోదు చేయలేదు')}</dd></div>
      <div><dt>{pick('Lorry no.', 'లారీ నం.')}</dt><dd>{record.logistics?.truckNumber || '—'}</dd></div>
      <div><dt>{pick('Destination', 'గమ్యస్థానం')}</dt><dd>{record.logistics?.buyerDestination || '—'}</dd></div>
      <div><dt>{pick('Invoice no.', 'బిల్లు నం.')}</dt><dd className="invoice-number">{record.dispatchSlipNumber || pick('Not assigned', 'కేటాయించలేదు')}</dd></div>
      <div><dt>{pick('Invoice date', 'బిల్లు తేదీ')}</dt><dd>{date}</dd></div>
      <div><dt>{pick('Supervisor', 'సూపర్‌వైజర్')}</dt><dd>{record.supervisor || '—'}</dd></div>
    </dl>

    {children || <InvoiceTable record={record} />}
    <LoadSummary variant="invoice" showGroups={false} rows={billRows(record)} summary={record.summary} />
    {finalized && !sample && <div className="invoice-signatory"><strong>{business.businessName || 'StoneDesk'}</strong><span>{pick('Authorized signatory', 'అధీకృత సంతకం')}</span></div>}
    <footer className="invoice-document-footer">
      <p>{sample ? pick('Demonstration only. Not a real bill. GST is not calculated; payments are not tracked.', 'ఇది నమూనా మాత్రమే. నిజమైన బిల్లు కాదు. GST లెక్కించబడదు; చెల్లింపులు ట్రాక్ చేయబడవు.') : finalized ? pick('Saved quantities, prices and business branding. All amounts in INR.', 'సేవ్ చేసిన కొలతలు, ధరలు మరియు వ్యాపార వివరాలు. అన్ని మొత్తాలు INRలో.') : pick('Draft for review. Quantities and amounts are not yet finalized.', 'తనిఖీ కోసం డ్రాఫ్ట్. కొలతలు మరియు మొత్తాలు ఇంకా ఖరారు కాలేదు.')}</p>
      <span>StoneDesk</span>
    </footer>
  </article>;
}