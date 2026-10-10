'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useState, type CSSProperties } from 'react';
import { TOUR_STEPS, TOUR_STORAGE_KEY, type TourStep } from '@/lib/tour';

type Rect = { top: number; left: number; width: number; height: number };

function readRect(selector: string | undefined): Rect | null {
  if (!selector) return null;
  const el = document.querySelector(`[data-tour="${selector}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return null;
  const pad = 8;
  return {
    top: Math.max(8, r.top - pad),
    left: Math.max(8, r.left - pad),
    width: Math.min(window.innerWidth - 16, r.width + pad * 2),
    height: Math.min(window.innerHeight - 16, r.height + pad * 2),
  };
}

function tooltipStyle(rect: Rect | null, step: TourStep): CSSProperties {
  const cardW = 340;
  const margin = 16;
  if (!rect) {
    return {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: cardW,
    };
  }
  const placement = step.placement ?? 'auto';
  const preferRight = rect.left + rect.width + cardW + margin < window.innerWidth;
  const preferBottom = rect.top + rect.height + 200 < window.innerHeight;

  if (placement === 'right' || (placement === 'auto' && preferRight)) {
    return {
      position: 'fixed',
      top: Math.min(rect.top, window.innerHeight - 220),
      left: Math.min(rect.left + rect.width + margin, window.innerWidth - cardW - margin),
      width: cardW,
    };
  }
  if (placement === 'left') {
    return {
      position: 'fixed',
      top: Math.min(rect.top, window.innerHeight - 220),
      left: Math.max(margin, rect.left - cardW - margin),
      width: cardW,
    };
  }
  if (placement === 'top' || (placement === 'auto' && !preferBottom)) {
    return {
      position: 'fixed',
      top: Math.max(margin, rect.top - 190),
      left: Math.min(Math.max(margin, rect.left), window.innerWidth - cardW - margin),
      width: cardW,
    };
  }
  return {
    position: 'fixed',
    top: Math.min(rect.top + rect.height + margin, window.innerHeight - 200),
    left: Math.min(Math.max(margin, rect.left), window.innerWidth - cardW - margin),
    width: cardW,
  };
}

export function ProductTour({
  forceOpen,
  onCloseForce,
}: {
  forceOpen?: boolean;
  onCloseForce?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  const step = TOUR_STEPS[index];

  const finish = useCallback(() => {
    localStorage.setItem(TOUR_STORAGE_KEY, 'done');
    setOpen(false);
    onCloseForce?.();
  }, [onCloseForce]);

  useEffect(() => {
    if (forceOpen) {
      setIndex(0);
      setOpen(true);
      if (pathname !== '/') router.push('/');
      return;
    }
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(TOUR_STORAGE_KEY) === 'done') return;
    const t = window.setTimeout(() => {
      if (pathname !== '/') router.push('/');
      setOpen(true);
    }, 700);
    return () => window.clearTimeout(t);
  }, [forceOpen, pathname, router]);

  // When forced closed externally, keep storage as-is unless finished via finish()
  useEffect(() => {
    if (!forceOpen && open && localStorage.getItem(TOUR_STORAGE_KEY) === 'done') {
      setOpen(false);
    }
  }, [forceOpen, open]);

  const measure = useCallback(() => {
    if (!open) return;
    const next = readRect(step?.target);
    setRect(next);
    if (step?.target) {
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      el?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center', inline: 'nearest' });
    }
  }, [open, step, reduce]);

  useLayoutEffect(() => {
    measure();
  }, [measure, index]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [open, measure]);

  // Dashboard-only targets: if missing, skip ahead after brief wait
  useEffect(() => {
    if (!open || !step?.target) return;
    if (pathname !== '/') {
      router.push('/');
      return;
    }
    const timer = window.setTimeout(() => {
      if (!readRect(step.target) && index < TOUR_STEPS.length - 1) {
        // wait for dashboard content; retry measure only
        measure();
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [open, step, pathname, router, index, measure]);

  if (!open || !step) return null;

  const progress = ((index + 1) / TOUR_STEPS.length) * 100;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[80]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Dim layer */}
        <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-[1px]" onClick={finish} />

        {/* Spotlight */}
        {rect && (
          <motion.div
            className="pointer-events-none absolute z-[81] rounded-2xl ring-2 ring-sky-400/90"
            initial={false}
            animate={{
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
            }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            style={{
              boxShadow: '0 0 0 9999px rgba(2, 6, 23, 0.58), 0 0 0 4px rgba(56,189,248,0.35)',
              background: 'transparent',
            }}
          />
        )}

        {/* Tooltip card */}
        <motion.div
          key={step.id}
          className="z-[82] rounded-2xl border border-white/70 bg-white p-5 shadow-2xl"
          style={tooltipStyle(rect, step)}
          initial={reduce ? false : { opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.25 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="tour-title"
        >
          <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 to-amber-400"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.25 }}
            />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-600">
            Step {index + 1} of {TOUR_STEPS.length}
          </p>
          <h2 id="tour-title" className="mt-1 text-lg font-bold tracking-tight text-ink">
            {step.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.body}</p>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              className="cursor-pointer text-xs font-semibold text-slate-500 hover:text-ink"
              onClick={finish}
            >
              Skip tour
            </button>
            <div className="flex gap-2">
              {index > 0 && (
                <button
                  type="button"
                  className="btn-secondary !px-3 !py-2 text-xs"
                  onClick={() => setIndex((i) => Math.max(0, i - 1))}
                >
                  Back
                </button>
              )}
              {index < TOUR_STEPS.length - 1 ? (
                <button
                  type="button"
                  className="btn-primary !px-3 !py-2 text-xs"
                  onClick={() => setIndex((i) => i + 1)}
                >
                  Next
                </button>
              ) : (
                <button type="button" className="btn-accent !px-3 !py-2 text-xs" onClick={finish}>
                  Finish
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
