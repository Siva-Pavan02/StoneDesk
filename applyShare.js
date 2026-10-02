const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'client/src/components');
const dispatchDir = path.join(dir, 'dispatch');

// 1. Update DispatchTracker.jsx
let tracker = fs.readFileSync(path.join(dir, 'DispatchTracker.jsx'), 'utf-8');

if (!tracker.includes('import { shareFiles }')) {
  tracker = tracker.replace(
    `import { generateBuyerInvoiceExcel }`,
    `import { shareFiles } from '../utils/shareFiles';\nimport { generateBuyerInvoiceExcel }`
  );
}

if (!tracker.includes('const [isSharing, setIsSharing] = useState(false);')) {
  tracker = tracker.replace(
    `const [saveMessage, setSaveMessage] = useState('');`,
    `const [saveMessage, setSaveMessage] = useState('');\n  const [isSharing, setIsSharing] = useState(false);`
  );
}

const handleShareAllInsert = `
  const handleShareAll = async () => {
    try {
      if (!currentDispatch || (currentDispatch.status !== 'Dispatched' && currentDispatch.status !== 'Delivered')) {
        alert('Please finalize the dispatch first.');
        return;
      }
      setIsSharing(true);
      
      const slipRes = generateDriverTransitSlip(currentDispatch);
      const invoiceRes = await generateBuyerInvoice(currentDispatch);
      const excelRes = generateBuyerInvoiceExcel(currentDispatch);
      
      const slipFile = new File([slipRes.blob], slipRes.filename, { type: 'application/pdf' });
      const invoiceFile = new File([invoiceRes.blob], invoiceRes.filename, { type: 'application/pdf' });
      const excelFile = new File([excelRes.blob], excelRes.filename, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      const files = [slipFile, invoiceFile, excelFile];
      const safeSlipNumber = currentDispatch.dispatchSlipNumber || 'Unknown';
      
      await shareFiles(
        files,
        'GraniteSync Dispatch',
        \`Dispatch Slip \${safeSlipNumber}\`
      );
    } catch (err) {
      alert(err.message || 'Error sharing files');
    } finally {
      setIsSharing(false);
    }
  };
`;

if (!tracker.includes('handleShareAll')) {
  tracker = tracker.replace(
    `const handleDownloadExcel = () => {`,
    `${handleShareAllInsert}\n  const handleDownloadExcel = () => {`
  );
}

if (!tracker.includes('onShareAll={handleShareAll}')) {
  tracker = tracker.replace(
    `onDownloadExcel={handleDownloadExcel} isSaving={isSaving}`,
    `onDownloadExcel={handleDownloadExcel} onShareAll={handleShareAll} isSaving={isSaving} isSharing={isSharing}`
  );
}

fs.writeFileSync(path.join(dir, 'DispatchTracker.jsx'), tracker);

// 2. Update DispatchActions.jsx
let actions = fs.readFileSync(path.join(dispatchDir, 'DispatchActions.jsx'), 'utf-8');

if (!actions.includes('onShareAll')) {
  actions = actions.replace(
    `export default function DispatchActions({ totals, onSaveDraft, onFinalize, onDownloadSlip, onDownloadInvoice, onDownloadExcel, isSaving, saveMessage, currentDispatch }) {`,
    `export default function DispatchActions({ totals, onSaveDraft, onFinalize, onDownloadSlip, onDownloadInvoice, onDownloadExcel, onShareAll, isSaving, isSharing, saveMessage, currentDispatch }) {`
  );
}

const shareButtonHtml = `
          {currentDispatch?.status === 'Dispatched' || currentDispatch?.status === 'Delivered' ? (
            <div className="mt-2.5">
              <button className="w-full py-3 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold flex items-center justify-center shadow-sm transition-all disabled:opacity-50 text-center leading-tight h-full" onClick={onShareAll} type="button" disabled={isSaving || isSharing}><span className="material-symbols-outlined text-[19px] mr-1.5">share</span><span className="text-sm font-bold leading-tight">{isSharing ? 'Generating & Sharing...' : 'Share Documents'}</span></button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
`;

if (!actions.includes('Share Documents')) {
  actions = actions.replace(
    `        </div>
      </div>
    </div>
  );`,
    shareButtonHtml.trimStart()
  );
}

fs.writeFileSync(path.join(dispatchDir, 'DispatchActions.jsx'), actions);

console.log('Share Integration applied successfully.');
