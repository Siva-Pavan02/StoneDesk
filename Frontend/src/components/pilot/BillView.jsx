import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { BackButton, Button, ErrorMessage } from './Controls.jsx';
import { deleteDispatch, request } from '../../lib/pilotApi.js';
import { runExclusive, shareOrDownload } from '../../utils/shareFiles.js';
import { billFilename } from '../../utils/ledgerPdf.js';
import { a4InvoiceFromDispatch, projectCopy } from '../../utils/a4InvoiceModel.js';
import { planA4CopyMeasured } from '../../utils/a4InvoiceMeasure.js';
import { renderA4Invoice } from '../../utils/a4InvoiceRender.js';
import { startPrint, printToWindow, printCopyHtml } from '../../utils/printInvoice.js';
import invoiceCss from '../../styles/a4Invoice.css?raw';
import Icon from './Icon.jsx';
import PaymentSection from './PaymentSection.jsx';
import useLogoHydration from './useLogoHydration.js';

// An unreadable saved logo prints as the placeholder instead of a broken image.
async function withReadableLogo(model) {
  if (!model.seller.logo) return model;
  const image = new Image();
  image.src = model.seller.logo;
  try {
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('Image has no pixels.');
    return model;
  } catch { return { ...model, seller: { ...model.seller, logo: null } }; }
}

// The two copies the bill screen offers; buyer is selected when the screen opens.
const COPY_OPTIONS = [
  ['buyer', 'Buyer invoice PDF', 'Approved A4 layout', ''],
  ['driver', 'Driver slip PDF', 'Same A4 layout, measurements only', 'No prices'],
];
const COPY_FILE_KIND = { buyer: 'Invoice', driver: 'Driver-slip' };
// One measured page plan per copy, taken at real A4 print geometry in an
// offscreen host and shared by the preview, print and the PDF, so all three
// break pages identically whatever the screen size.
async function planCopy(model, copy) {
  const copyModel = projectCopy(model, copy);
  return { model: copyModel, pages: await planA4CopyMeasured(copyModel, copy) };
}
async function planPreview(model) {
  const printable = await withReadableLogo(model);
  return { model: printable, copies: { buyer: await planCopy(printable, 'buyer'), driver: await planCopy(printable, 'driver') } };
}
export default function BillView({ record, onBack, onResume, onEdit, onChanged, onDeleted, canFinalize = true, admin = false }) {
  const [busy, setBusy] = useState(false);
  const [copy, setCopy] = useState('buyer');
  const [confirming, setConfirming] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [exportError, setExportError] = useState('');
  const [exportNotice, setExportNotice] = useState('');
  const [exportWarnings, setExportWarnings] = useState([]);
  const [printFallback, setPrintFallback] = useState(false);
  const [invoiceState, setInvoiceState] = useState(null);
  // Bills that reference their logo (businessSnapshot.logo) get it fetched and embedded as
  // logoDataUrl first; legacy bills with an embedded logo pass through unchanged.
  const { record: billRecord, pending: logoPending } = useLogoHydration(record);
  const previewId = useId();
  const historyPreviewId = `${previewId}-history`;
  // Version history: keyed by record identity so a revised/other record resets the selection.
  const historyKey = `${record.id}:${record.updatedAt || ''}`;
  const [historySelection, setHistorySelection] = useState(null);
  const [historyState, setHistoryState] = useState(null);
  const lock = useRef(false);
  const finalized = record.status !== 'Draft';
  const invoiceKey = `${record.id}:${record.status}`;
  const currentInvoice = invoiceState?.key === invoiceKey ? invoiceState : null;
  // PilotApp only passes complete records (GET by id or a save/finalize/status
  // response), so the bill never needs to be fetched again here.
  const invoiceSource = finalized && !logoPending ? billRecord : null;
  const preview = currentInvoice?.preview;
  const previewIssue = currentInvoice?.issue || '';
  const destination = record.logistics?.buyerDestination;
  // Both copies are planned up front, so changing the selection swaps the preview synchronously.
  const invoiceHtml = useMemo(() => preview ? renderA4Invoice(preview.copies[copy].model, preview.copies[copy].pages, copy, previewId) : '', [preview, copy, previewId]);
  const showHistory = admin && finalized && Array.isArray(record.revisions) && record.revisions.length > 0;
  // Most recent first; keep the stored index so keys/selection stay stable.
  const versions = useMemo(() => !showHistory ? [] : record.revisions
    .map((snapshot, index) => ({ snapshot, index, time: Date.parse(snapshot?.revisedAt) }))
    .sort((a, b) => (Number.isFinite(b.time) ? b.time : -Infinity) - (Number.isFinite(a.time) ? a.time : -Infinity) || b.index - a.index),
  [showHistory, record.revisions]);
  const versionTime = useMemo(() => {
    const format = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });
    return value => { const time = Date.parse(value); return Number.isFinite(time) ? format.format(time) : 'Unknown time'; };
  }, []);
  const selectedVersion = showHistory && historySelection?.key === historyKey ? versions.find(version => version.index === historySelection.index) || null : null;
  const selectedVersionKey = selectedVersion ? `${historyKey}:${selectedVersion.index}` : '';
  const historyCurrent = historyState?.key === selectedVersionKey ? historyState : null;
  const historyHtml = useMemo(() => historyCurrent?.preview ? renderA4Invoice(historyCurrent.preview.copies[copy].model, historyCurrent.preview.copies[copy].pages, copy, historyPreviewId) : '', [historyCurrent, copy, historyPreviewId]);
  useEffect(() => {
    if (!selectedVersion) return;
    let live = true;
    // Prior versions render from the stored snapshot; slip number, id and status never change across revisions.
    // Branding never changes on revise, so newer revisions carry no businessSnapshot: use the bill's own (hydrated) one.
    const source = { ...selectedVersion.snapshot, businessSnapshot: selectedVersion.snapshot?.businessSnapshot ?? billRecord.businessSnapshot, id: record.id, dispatchSlipNumber: record.dispatchSlipNumber, status: record.status };
    Promise.resolve().then(() => a4InvoiceFromDispatch(source)).then(planPreview)
      .then(result => { if (live) setHistoryState({ key: selectedVersionKey, preview: result, issue: '' }); })
      .catch(err => { if (live) setHistoryState({ key: selectedVersionKey, preview: null, issue: err?.message || String(err) }); });
    return () => { live = false; };
  }, [selectedVersion, selectedVersionKey, record.id, record.dispatchSlipNumber, record.status, billRecord.businessSnapshot]);
  // Confirm steps swap the clicked button; keep keyboard focus on the matching control.
  const focusSoon = selector => requestAnimationFrame(() => document.querySelector(`.bill-screen ${selector}`)?.focus());
  const previewProblem = detail => `The A4 preview couldn’t be prepared. Reload the page or download the PDF. (${detail})`;
  useEffect(() => {
    if (!invoiceSource) return;
    let live = true;
    Promise.resolve().then(() => a4InvoiceFromDispatch(invoiceSource)).then(planPreview)
      .then(result => {
        if (live) setInvoiceState({ key: invoiceKey, preview: result, issue: '' });
        // Warm the export chunk and its fonts so Download/Share start immediately.
        import('../../utils/a4InvoicePdf.js').then(module => module.preloadA4PdfAssets()).catch(() => {});
      }).catch(err => {
        if (live) setInvoiceState({ key: invoiceKey, preview: null, issue: err.message });
      });
    return () => { live = false; };
  }, [invoiceSource, invoiceKey]);
  function download(output) {
    const url = URL.createObjectURL(output.blob);
    const a = document.createElement('a'); a.href = url; a.download = output.filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  function resetExportFeedback() { setExportError(''); setExportNotice(''); setExportWarnings([]); setPrintFallback(false); }
  // Print/PDF: everything up to window.open runs synchronously in the click
  // handler (no await before it) so popup blockers treat it as user-initiated.
  async function printInvoice() {
    if (lock.current) return;
    lock.current = true; setBusy(true); resetExportFeedback();
    let printWindow = null;
    try {
      let start;
      try {
        start = startPrint({ record: billRecord, buildModel: a4InvoiceFromDispatch, openWindow: () => window.open('', '_blank'), copy });
      } catch (err) {
        setExportError(`The invoice could not be prepared for printing. ${err?.message || ''}`.trim());
        return;
      }
      if (start.status === 'warnings') { setExportWarnings(start.warnings); return; }
      if (start.status === 'blocked') {
        setExportError(`The browser blocked the print window. Allow pop-ups for this site and try again, or download the ${copy === 'driver' ? 'driver slip' : 'buyer invoice'} PDF and print it.`);
        setPrintFallback(true);
        return;
      }
      printWindow = start.printWindow;
      // The preview's measured plan when it is ready, otherwise measured now;
      // planPreview already replaces an unreadable logo with the placeholder.
      const planned = currentInvoice?.preview || await planPreview(start.model);
      const html = printCopyHtml(planned.model, start.copy, invoiceCss, planned.copies[start.copy].pages);
      await printToWindow(printWindow, html);
      setExportNotice('In the print dialog, choose A4, 100% scale, background graphics on and browser headers/footers off. Choose Save as PDF if needed.');
    } catch (err) {
      try { if (printWindow && !printWindow.closed) printWindow.close(); } catch { /* window already gone */ }
      const detail = err?.message ? ` (${err.message})` : '';
      setExportError(`Printing did not complete. Your invoice is unchanged; you can try again.${detail}`);
    } finally { lock.current = false; setBusy(false); }
  }
  // Download or share one document. The in-flight lock blocks a second
  // concurrent export/share/print. Share outcomes: 'shared' → done,
  // 'cancelled' → silent no-op, 'unsupported' → download + notice.
  function exportFile(kind, share = false) {
    return runExclusive(lock, async () => {
      setBusy(true); resetExportFeedback();
      try {
        if (!COPY_FILE_KIND[kind]) throw new Error(`Unknown bill copy: ${kind}`);
        const data = billRecord;
        // Same prepared model, copy projection and page plan as the A4 preview, drawn as a vector PDF.
        // Warnings pause both copies: nothing is built or saved and the bill stays unchanged.
        const model = a4InvoiceFromDispatch(data);
        if (model.warnings.length) { setExportWarnings(model.warnings); return; }
        const planned = currentInvoice?.preview || await planPreview(model);
        const { model: copyModel, pages } = planned.copies[kind];
        // jsPDF and the drawing code load on first export only; the preview effect
        // preloads them so Share stays inside the browser's user-activation window.
        const { a4InvoicePdf } = await import('../../utils/a4InvoicePdf.js');
        // The PDF is fully built before anything is saved, so a failure leaves no partial file.
        const output = await a4InvoicePdf(copyModel, pages, kind, billFilename(data, COPY_FILE_KIND[kind], 'pdf'));
        if (!share) { download(output); return; }
        const title = record.businessSnapshot?.businessName || 'Load bill';
        const outcome = await shareOrDownload(output, { title, text: 'Load bill', download });
        if (outcome === 'unsupported') setExportNotice('Sharing isn’t available in this browser, so the document was downloaded instead. Attach it from your downloads.');
      } catch (err) {
        const detail = err?.message ? ` (${err.message})` : '';
        setExportError(share
          ? `The document could not be shared. The download did not complete and no file was saved. Your invoice is unchanged; you can try again.${detail}`
          : `The download did not complete and no file was saved. Your invoice is unchanged; you can try again.${detail}`);
      } finally { setBusy(false); }
    });
  }
  // Status errors are shown inside the delivery bar, next to the action that failed.
  const statusProblem = err => err?.status === 403 ? 'Only an admin can change a delivered load.'
    : err?.status === 409 || err?.status === 400 ? 'This load was updated elsewhere. Refresh the page and try again.'
      : err?.status === 404 ? 'This load no longer exists.'
        : 'Couldn’t save. Check your connection and try again.';
  async function delivered() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setStatusError('');
    try {
      onChanged(await request(`/dispatches/${record.id}/status`, { method: 'PATCH', body: { status: 'Delivered', updatedAt: record.updatedAt } })); setConfirming(false);
      if (admin) focusSoon('[data-delivery-reopen]');
    }
    catch (err) {
      setStatusError(statusProblem(err));
      setConfirming(false);
      focusSoon('[data-delivery-trigger]');
    } finally { lock.current = false; setBusy(false); }
  }
  // Admin-only (the API enforces it too): moves a Delivered load back to In transit.
  async function reopenDelivery() {
    if (!admin || lock.current) return;
    lock.current = true; setBusy(true); setStatusError('');
    try {
      onChanged(await request(`/dispatches/${record.id}/status`, { method: 'PATCH', body: { status: 'Dispatched', updatedAt: record.updatedAt } }));
      setConfirming(false);
      focusSoon('[data-delivery-trigger]');
    } catch (err) {
      setStatusError(statusProblem(err));
      setConfirming(false);
      focusSoon('[data-delivery-reopen]');
    } finally { lock.current = false; setBusy(false); }
  }
  // Admin-only; the API enforces the role too. Only runs after the explicit confirm step.
  async function removeInvoice() {
    if (!admin || lock.current) return;
    lock.current = true; setBusy(true); setDeleteError('');
    try {
      await deleteDispatch(record.id);
      setConfirmingDelete(false);
      onDeleted?.(record.id);
    } catch (err) {
      // The admin delete removes any payments with the invoice, and returns 404 when it is already gone.
      setDeleteError(err.status === 404
        ? 'This invoice was already deleted. Go back to the dashboard.'
        : err.status === 403
          ? 'You are not permitted to delete this invoice.'
          : `The invoice wasn’t deleted. Try again.${err?.message ? ` (${err.message})` : ''}`);
      setConfirmingDelete(false);
      focusSoon('[data-delete-trigger]');
    } finally { lock.current = false; setBusy(false); }
  }
  // Any role may delete an unfinished draft; the API re-checks it is still a Draft.
  async function removeDraft() {
    if (finalized || lock.current) return;
    lock.current = true; setBusy(true); setDeleteError('');
    try {
      await deleteDispatch(record.id);
      setConfirmingDelete(false);
      onDeleted?.(record.id);
    } catch (err) {
      setDeleteError(err.status === 409
        ? 'This draft was finalized or changed. Go back to the dashboard and try again.'
        : err.status === 403
          ? 'You are not permitted to delete this draft.'
          : `The draft wasn’t deleted. Try again.${err?.message ? ` (${err.message})` : ''}`);
      setConfirmingDelete(false);
      focusSoon('[data-delete-trigger]');
    } finally { lock.current = false; setBusy(false); }
  }
  return <div className="bill-screen space-y-6">
    <div className="screen-heading invoice-screen-heading"><BackButton disabled={busy} onClick={onBack} label="Back to dashboard" /><div><h1>{finalized ? 'Load bill' : 'Saved draft'}</h1><p className="truncate">{finalized ? 'Check the totals, then download or share.' : 'Not final yet. Continue to finish this bill.'}</p></div></div>
    {record.status === 'Dispatched' && <section className="delivery-bar" data-state={confirming ? 'confirming' : 'transit'} aria-label="Delivery status">
      <span className="delivery-bar-dot" aria-hidden="true" />
      <div className="delivery-bar-text" aria-live="polite">
        <strong>{confirming ? 'Has this load reached its destination?' : 'In transit'}</strong>
        <span>{confirming ? (admin ? 'Admins can change this later.' : 'This can’t be undone.') : destination ? `On the way to ${destination}` : 'Waiting for delivery confirmation'}</span>
      </div>
      {canFinalize && <div className="delivery-bar-actions">
        {confirming
          ? <><Button disabled={busy} data-delivery-cancel="" label="Not yet" onClick={() => { setConfirming(false); focusSoon('[data-delivery-trigger]'); }} /><Button primary disabled={busy} label={busy ? 'Saving…' : 'Yes, delivered'} onClick={delivered} /></>
          : <Button disabled={busy} data-delivery-trigger="" label="Mark delivered" onClick={() => { setStatusError(''); setConfirming(true); focusSoon('[data-delivery-cancel]'); }} />}
      </div>}
      {statusError && <p className="delivery-bar-error" role="alert">{statusError}</p>}
    </section>}
    {record.status === 'Delivered' && <section className="delivery-bar" data-state={admin && confirming ? 'confirming' : 'delivered'} aria-label="Delivery status">
      <span className="delivery-bar-dot" aria-hidden="true" />
      <div className="delivery-bar-text" aria-live="polite">
        <strong>{admin && confirming ? 'Move this load back to In transit?' : 'Delivered'}</strong>
        {admin && confirming ? <span>You can mark it delivered again afterwards.</span> : destination && <span>{`Reached ${destination}`}</span>}
      </div>
      {admin && <div className="delivery-bar-actions">
        {confirming
          ? <><Button disabled={busy} data-delivery-cancel="" label="Keep delivered" onClick={() => { setConfirming(false); focusSoon('[data-delivery-reopen]'); }} /><Button primary disabled={busy} label={busy ? 'Saving…' : 'Yes, move back'} onClick={reopenDelivery} /></>
          : <button type="button" className="text-button" disabled={busy} data-delivery-reopen="" aria-label="Change delivery status" onClick={() => { setStatusError(''); setConfirming(true); focusSoon('[data-delivery-cancel]'); }}>Change</button>}
      </div>}
      {statusError && <p className="delivery-bar-error" role="alert">{statusError}</p>}
    </section>}
    {finalized && <PaymentSection dispatchId={record.id} canRecordPayment={canFinalize} />}
    <div className="invoice-paper-shell a4-preview-shell">
      {!finalized ? <p className="a4-preview-feedback" role="status">Complete this draft to see the final A4 invoice. Missing data is never replaced with sample values.</p>
        : previewIssue ? <p className="a4-preview-feedback" role="alert">{previewProblem(previewIssue)}</p>
          : preview ? <>{preview.model.warnings.length > 0 && <div className="a4-preview-feedback" role="alert"><strong>Saved invoice values need review before export.</strong><ul>{preview.model.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></div>}<div dangerouslySetInnerHTML={{ __html: invoiceHtml }} /></>
            : <p className="a4-preview-feedback" role="status">Preparing the saved A4 invoice…</p>}
    </div>
    {finalized ? <>
      <section className="invoice-export-panel" aria-labelledby="invoice-export-title">
        <header className="invoice-export-intro"><h2 id="invoice-export-title">{'Export & share'}</h2><p>Pick a copy, then share or download it.</p></header>
        <fieldset className="invoice-export-options" disabled={busy}>
          <legend className="sr-only">Document</legend>
          {COPY_OPTIONS.map(([value, title, meta, tag]) => (
            <label key={value} className="invoice-export-option">
              <input type="radio" name="invoice-export-document" value={value === 'buyer' ? 'invoice' : value} checked={copy === value} onChange={() => { setCopy(value); resetExportFeedback(); }} />
              <span className="export-option-text"><span className="export-option-title">{title}{tag && <span className="export-option-tag">{tag}</span>}</span><span className="export-option-meta">{meta}</span></span>
              <span className="export-option-format">PDF</span>
            </label>
          ))}
        </fieldset>
        <footer className="invoice-export-footer">
          <p className="invoice-export-help">The preview, Print / PDF, Download and Share all use the selected copy in the same A4 layout.</p>
          <div className="invoice-export-feedback" aria-live="polite">
            {exportWarnings.length > 0 && <div role="alert" className="control-error"><strong>Export is paused. Review these invoice values first:</strong><ul>{exportWarnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></div>}
            {exportError ? <ErrorMessage error={exportError} /> : exportNotice && <p className="invoice-export-notice">{exportNotice}</p>}
            {printFallback && <div className="action-row"><Button disabled={busy || logoPending} label={copy === 'driver' ? 'Download driver slip PDF' : 'Download buyer invoice PDF'} onClick={() => exportFile(copy)} /></div>}
          </div>
          <div className="action-row"><Button disabled={busy || logoPending} label="Print / PDF" onClick={printInvoice} /><Button disabled={busy || logoPending} label="Download" onClick={() => exportFile(copy)} /><Button primary disabled={busy || logoPending} label={busy ? 'Preparing…' : 'Share document'} onClick={() => exportFile(copy, true)}><Icon name="arrow" /></Button></div>
        </footer>
      </section>
      {admin && <div className="invoice-admin-panel">
      <p className="invoice-admin-eyebrow">Admin</p>
      {onEdit && <section className="invoice-admin-row" aria-labelledby="invoice-edit-title">
        <div className="invoice-admin-copy">
          <h2 id="invoice-edit-title">Edit invoice</h2>
          <p>Admins only. Correct measurements, prices or details. The slip number stays the same and the current version is kept in history.</p>
        </div>
        <div className="action-row shrink-0"><Button disabled={busy} label="Edit invoice" onClick={() => onEdit(record)} /></div>
      </section>}
      {showHistory && <section className="invoice-admin-row invoice-admin-history" aria-labelledby="invoice-history-title">
        <div className="invoice-admin-copy">
          <h2 id="invoice-history-title">Version history</h2>
          <p>Admins only. Earlier versions of this invoice, most recent first. They are read-only.</p>
        </div>
        <ul className="invoice-admin-versions">
          {versions.map(version => {
            const active = selectedVersion?.index === version.index;
            return <li key={version.index} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0 truncate text-sm">{versionTime(version.snapshot?.revisedAt)}</span>
              <button type="button" className="text-button shrink-0 text-sm" aria-expanded={active} aria-controls={active ? `${historyPreviewId}-panel` : undefined} disabled={busy} onClick={() => setHistorySelection(active ? null : { key: historyKey, index: version.index })}>
                {active ? 'Hide' : 'View'}
              </button>
            </li>;
          })}
        </ul>
        {selectedVersion && <div id={`${historyPreviewId}-panel`} className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <strong className="min-w-0 text-sm">{`Version from ${versionTime(selectedVersion.snapshot?.revisedAt)} (read-only)`}</strong>
            <button type="button" className="text-button shrink-0 text-sm" onClick={() => setHistorySelection(null)}>Close</button>
          </div>
          <div className="invoice-paper-shell a4-preview-shell">
            {historyCurrent?.issue ? <p className="a4-preview-feedback" role="alert">{previewProblem(historyCurrent.issue)}</p>
              : historyCurrent?.preview ? <>{historyCurrent.preview.model.warnings.length > 0 && <div className="a4-preview-feedback" role="alert"><strong>This earlier version has values that need review.</strong><ul>{historyCurrent.preview.model.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></div>}<div dangerouslySetInnerHTML={{ __html: historyHtml }} /></>
                : <p className="a4-preview-feedback" role="status">Preparing this earlier version…</p>}
          </div>
        </div>}
      </section>}
      <section className="invoice-admin-row invoice-admin-delete" aria-labelledby="invoice-delete-title" data-state={confirmingDelete ? 'confirming' : 'idle'}>
        <div className="invoice-admin-copy" aria-live="polite">
          <h2 id="invoice-delete-title">{confirmingDelete ? 'Delete this invoice?' : 'Delete invoice'}</h2>
          <p>{confirmingDelete ? 'It will be removed from your loads, together with any recorded payments. This can’t be undone.' : 'Admins only. Any recorded payments are deleted with the invoice.'}</p>
          <ErrorMessage error={deleteError} />
        </div>
        <div className="action-row shrink-0">
          {confirmingDelete
            ? <><Button disabled={busy} data-delete-cancel="" label="Keep invoice" onClick={() => { setConfirmingDelete(false); focusSoon('[data-delete-trigger]'); }} /><Button variant="danger" disabled={busy} label={busy ? 'Deleting…' : 'Yes, delete'} onClick={removeInvoice} /></>
            : <Button variant="danger-quiet" disabled={busy} data-delete-trigger="" label="Delete invoice" onClick={() => { setDeleteError(''); setConfirmingDelete(true); focusSoon('[data-delete-cancel]'); }} />}
        </div>
      </section>
      </div>}
    </> : <>
      <div className="invoice-draft-action"><Button primary disabled={busy} label="Continue this draft" onClick={() => onResume(record)}><Icon name="arrow" /></Button></div>
      <section className="invoice-admin-row invoice-admin-delete" aria-labelledby="draft-delete-title" data-state={confirmingDelete ? 'confirming' : 'idle'}>
        <div className="invoice-admin-copy" aria-live="polite">
          <h2 id="draft-delete-title">{confirmingDelete ? 'Delete this draft?' : 'Delete draft'}</h2>
          <p>{confirmingDelete ? 'Its measurements will be removed from your loads and from this phone. This can’t be undone.' : 'Not needed any more? Remove it so it stops showing as pending.'}</p>
          <ErrorMessage error={deleteError} />
        </div>
        <div className="action-row shrink-0">
          {confirmingDelete
            ? <><Button disabled={busy} data-delete-cancel="" label="Keep draft" onClick={() => { setConfirmingDelete(false); focusSoon('[data-delete-trigger]'); }} /><Button variant="danger" disabled={busy} label={busy ? 'Deleting…' : 'Yes, delete'} onClick={removeDraft} /></>
            : <Button variant="danger-quiet" disabled={busy} data-delete-trigger="" label="Delete draft" onClick={() => { setDeleteError(''); setConfirmingDelete(true); focusSoon('[data-delete-cancel]'); }} />}
        </div>
      </section>
    </>}
  </div>;
}
