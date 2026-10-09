'use client';

import { memo, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { motion, useAnimationControls, useMotionValue, useReducedMotion, useSpring } from 'motion/react';
import { useLanguage } from '../../i18n/LanguageContext';
import Icon from './Icon.jsx';

function subscribeReducedMotion(notify) {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  query.addEventListener('change', notify);
  return () => query.removeEventListener('change', notify);
}
function readReducedMotion() { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
function useMarketingReducedMotion() {
  const initial = useReducedMotion();
  // This installed Motion version captures the initial preference only. Also
  // subscribe to OS changes, including when motion is enabled and then disabled.
  return useSyncExternalStore(subscribeReducedMotion, readReducedMotion, () => initial !== false);
}

// Only these small leaves own animation. Pointer coordinates never enter React state.
export function MagneticCTA({ children, onClick, compact = false, compactLabel, className = '' }) {
  const reduced = useMarketingReducedMotion();
  const finePointer = useRef(false);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 260, damping: 24, mass: 0.35 });
  const springY = useSpring(y, { stiffness: 260, damping: 24, mass: 0.35 });

  useEffect(() => {
    const query = window.matchMedia('(hover: hover) and (pointer: fine)');
    const update = () => {
      finePointer.current = query.matches && reduced === false;
      x.set(0); y.set(0);
      if (!finePointer.current) { springX.jump(0); springY.jump(0); }
    };
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, [reduced, x, y, springX, springY]);

  function reset() { x.set(0); y.set(0); }
  function move(event) {
    if (!finePointer.current || event.pointerType === 'touch') return;
    const rect = event.currentTarget.getBoundingClientRect();
    x.set(Math.max(-5, Math.min(5, (event.clientX - rect.left - rect.width / 2) * 0.055)));
    y.set(Math.max(-3, Math.min(3, (event.clientY - rect.top - rect.height / 2) * 0.07)));
  }

  return <motion.button type="button" aria-label={compactLabel ? children : undefined} onClick={onClick} onPointerMove={move} onPointerLeave={reset} onPointerCancel={reset} onBlur={reset}
    style={{ x: springX, y: springY }} className={`mk-primary inline-flex min-h-12 shrink-0 items-center justify-center gap-4 rounded-full pl-6 pr-2 text-sm font-semibold ${compact ? 'mk-primary-compact' : ''} ${className}`}>
    {compactLabel ? <><span className="hidden sm:inline">{children}</span><span className="sm:hidden" aria-hidden="true">{compactLabel}</span></> : <span>{children}</span>}
    <span className="mk-cta-disc flex h-9 w-9 shrink-0 items-center justify-center rounded-full" aria-hidden="true"><Icon name="arrow" className="h-4 w-4" /></span>
  </motion.button>;
}

export function Reveal({ children, className = '', delay = 0 }) {
  const reduced = useMarketingReducedMotion();
  return <motion.div className={className} initial={reduced !== false ? false : { opacity: 0, y: 14 }}
    whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.12 }}
    transition={{ duration: reduced ? 0 : 0.5, delay: reduced ? 0 : delay, ease: [0.16, 1, 0.3, 1] }}>
    {children}
  </motion.div>;
}

export const SampleMotionBadge = memo(function SampleMotionBadge() {
  const { pick } = useLanguage();
  const reduced = useMarketingReducedMotion();
  const controls = useAnimationControls();
  const target = useRef(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const node = target.current;
    if (!node) return;
    let intersecting = false;
    let running = null;
    controls.set({ y: 0 });
    const pointer = window.matchMedia('(pointer: coarse)');
    const sync = () => {
      const shouldRun = intersecting && !document.hidden && !paused && reduced === false && !pointer.matches;
      if (shouldRun === running) return;
      running = shouldRun;
      controls.stop();
      if (shouldRun) {
        // The only perpetual animation: a sample saved-status marker, not live activity.
        void controls.start({ y: [0, -3, 0], transition: { duration: 4, repeat: Infinity, ease: [0.45, 0, 0.55, 1] } });
      } else controls.set({ y: 0 });
    };
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
      intersecting = entries[0]?.isIntersecting ?? false; sync();
    }, { threshold: 0.15 });
    if (observer) observer.observe(node);
    document.addEventListener('visibilitychange', sync);
    pointer.addEventListener('change', sync);
    return () => {
      observer?.disconnect();
      document.removeEventListener('visibilitychange', sync);
      pointer.removeEventListener('change', sync);
      controls.stop();
    };
  }, [controls, paused, reduced]);

  return <div ref={target} className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e0eae7] px-4 py-3 text-xs sm:px-5">
    <motion.span animate={controls} className="inline-flex items-center gap-2 text-[#17645d]">
      <Icon name="check" className="h-4 w-4" />{pick('Sample bill · saved totals', 'నమూనా బిల్లు · సేవ్ చేసిన మొత్తాలు')}
    </motion.span>
    <button type="button" aria-pressed={paused} disabled={Boolean(reduced)} onClick={() => setPaused(value => !value)} className="mk-motion-toggle min-h-9 rounded-full px-3 text-[#526661]">
      {reduced ? pick('Motion off', 'చలనం ఆఫ్') : paused ? pick('Resume motion', 'చలనం కొనసాగించండి') : pick('Pause motion', 'చలనం ఆపండి')}
    </button>
  </div>;
});