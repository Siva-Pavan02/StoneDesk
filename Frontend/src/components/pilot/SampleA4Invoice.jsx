import { useLayoutEffect, useRef, useState } from 'react';

import Icon from './Icon.jsx';
import { formatA4Money, formatA4Number } from '../../utils/a4InvoiceModel.js';
import { landingSampleHtml, landingSampleModel } from '../../utils/landingSampleInvoice.js';

// Largest on-screen height of the scaled preview in the hero frame.
const MAX_FRAME_HEIGHT = 520;

function caption() {
  const { totals } = landingSampleModel();
  return `Sample invoice SAMPLE-001: ${totals.pieces} pieces, ${formatA4Number(totals.area)} sq ft, net payable ${formatA4Money(totals.netPayable)}. Fictional data, not for payment.`;
}

// Public demo of the real A4 invoice. The HTML comes from the app's own renderer
// over a frozen, fictional constant; every text value is escaped by the renderer.
export default function SampleA4Invoice({ variant = 'frame', prefix, onOpenBill }) {
  const viewport = useRef(null);
  const stage = useRef(null);
  const [geometry, setGeometry] = useState(null);
  // The dialog fills the screen width, so its sheet stacks its columns when narrow;
  // the hero frame stays a scaled 210 mm sheet.
  const html = landingSampleHtml(prefix || `landing-${variant}`, { responsive: variant === 'full' });

  useLayoutEffect(() => {
    if (variant !== 'frame') return undefined;
    const box = viewport.current, sheet = stage.current;
    if (!box || !sheet) return undefined;
    let active = true;
    const measure = () => {
      if (!active) return;
      const paperWidth = sheet.offsetWidth, paperHeight = sheet.offsetHeight, available = box.clientWidth;
      if (!paperWidth || !paperHeight || !available) return;
      const scale = Math.min(1, available / paperWidth, MAX_FRAME_HEIGHT / paperHeight);
      const next = { scale, height: Math.round(paperHeight * scale), left: Math.max(0, (available - paperWidth * scale) / 2) };
      setGeometry(previous => previous && previous.scale === next.scale && previous.height === next.height && previous.left === next.left ? previous : next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    document.fonts?.ready.then(measure);
    return () => { active = false; observer.disconnect(); };
  }, [variant]);

  if (variant === 'full') return <div className="mk-a4-full" dangerouslySetInnerHTML={{ __html: html }} />;

  return <div className="mk-a4-preview">
    <figure className="mk-a4-frame">
      <div ref={viewport} className="mk-a4-viewport" style={geometry ? { height: geometry.height } : { aspectRatio: '794 / 540' }}>
        <div ref={stage} className="mk-a4-stage" aria-hidden="true" inert
          style={{ transform: geometry ? `translate3d(${geometry.left}px, 0, 0) scale(${geometry.scale})` : undefined, visibility: geometry ? 'visible' : 'hidden' }}
          dangerouslySetInnerHTML={{ __html: html }} />
      </div>
      <figcaption className="sr-only">{caption()}</figcaption>
    </figure>
    {onOpenBill && <button type="button" onClick={onOpenBill} className="mk-text-link mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#FB471F]">View full sample bill<span className="mk-link-disc" aria-hidden="true"><Icon name="arrow" className="h-3.5 w-3.5" /></span></button>}
  </div>;
}
