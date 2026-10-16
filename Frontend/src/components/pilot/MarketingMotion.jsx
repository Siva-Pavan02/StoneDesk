import { memo, useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';

function isReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// 60fps Compositor-only Magnetic CTA button: Uses direct transform manipulation on the DOM node.
export function MagneticCTA({ children, onClick, compact = false, compactLabel, className = '' }) {
  const btnRef = useRef(null);
  const finePointer = useRef(false);
  const rafId = useRef(0);

  useEffect(() => {
    const query = window.matchMedia('(hover: hover) and (pointer: fine)');
    const update = () => {
      finePointer.current = query.matches && !isReducedMotion();
      if (btnRef.current) btnRef.current.style.transform = 'translate3d(0, 0, 0)';
    };
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  function reset() {
    if (rafId.current) cancelAnimationFrame(rafId.current);
    if (btnRef.current) {
      btnRef.current.style.transform = 'translate3d(0, 0, 0)';
    }
  }

  function move(event) {
    if (!finePointer.current || event.pointerType === 'touch' || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const x = Math.max(-5, Math.min(5, (event.clientX - rect.left - rect.width / 2) * 0.055));
    const y = Math.max(-3, Math.min(3, (event.clientY - rect.top - rect.height / 2) * 0.07));
    if (rafId.current) cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => {
      if (btnRef.current) {
        btnRef.current.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
      }
    });
  }

  return (
    <button
      ref={btnRef}
      type="button"
      aria-label={compactLabel ? children : undefined}
      onClick={onClick}
      onPointerMove={move}
      onPointerLeave={reset}
      onPointerCancel={reset}
      onBlur={reset}
      className={`mk-primary inline-flex min-h-12 shrink-0 items-center justify-center gap-4 rounded-full pl-6 pr-2 text-sm font-semibold ${compact ? 'mk-primary-compact' : ''} ${className}`}
      style={{ willChange: 'transform' }}
    >
      {compactLabel ? (
        <>
          <span className="hidden sm:inline">{children}</span>
          <span className="sm:hidden" aria-hidden="true">{compactLabel}</span>
        </>
      ) : (
        <span>{children}</span>
      )}
      {compact ? (
        <Icon name="arrow" className="mk-cta-arrow h-4 w-4 shrink-0" />
      ) : (
        <span className="mk-cta-disc flex shrink-0 items-center justify-center rounded-full" aria-hidden="true">
          <Icon name="arrow" className="h-4 w-4" />
        </span>
      )}
    </button>
  );
}

// 60fps Reveal: Native IntersectionObserver with compositor opacity & transform
export function Reveal({ children, className = '', delay = 0 }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (isReducedMotion()) {
      setVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        // 'none' once shown: a lingering transform would become the containing block for
        // absolutely positioned children (e.g. the workflow step dots) and misplace them.
        transform: visible ? 'none' : 'translate3d(0, 16px, 0)',
        transition: visible
          ? `opacity 800ms cubic-bezier(.32,.72,0,1) ${delay}s, transform 800ms cubic-bezier(.32,.72,0,1) ${delay}s`
          : 'none',
        willChange: visible ? 'auto' : 'transform, opacity'
      }}
    >
      {children}
    </div>
  );
}

// 60fps Compositor-Only Sample Motion Badge
export const SampleMotionBadge = memo(function SampleMotionBadge() {
  return (
    <div className="flex min-h-[61px] items-center border-t border-[#e0eae7] px-4 py-3 text-xs sm:px-5">
      <span className="sample-badge-float inline-flex items-center gap-2 text-[#17645d]">
        <Icon name="check" className="h-4 w-4" />
        Sample bill · saved totals
      </span>
    </div>
  );
});