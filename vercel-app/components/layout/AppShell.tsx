'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { PageMotion } from '@/components/motion/Motion';
import { ProductTour } from '@/components/tour/ProductTour';
import { Sidebar } from './Sidebar';

export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [forceTour, setForceTour] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar onStartTour={() => setForceTour(true)} />
      <div className="flex min-w-0 flex-1 flex-col pr-3 pt-3">
        <header
          data-tour="page-header"
          className="sticky top-3 z-20 mx-0 mb-3 mr-0 rounded-2xl border border-white/55 bg-white/60 px-5 py-3.5 shadow-[0_12px_40px_-28px_rgba(15,23,42,0.35)] backdrop-blur-2xl"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="page-kicker">Event-driven data</p>
              <h1 className="page-title">{title}</h1>
              {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
            </div>
            {actions ? (
              <div data-tour="upload-cta" className="flex flex-wrap items-center gap-2">
                {actions}
              </div>
            ) : null}
          </div>
        </header>
        <main className="relative flex-1 overflow-auto px-1 pb-6">
          <PageMotion className="relative z-10 mx-auto max-w-7xl px-2">{children}</PageMotion>
        </main>
      </div>
      <ProductTour
        forceOpen={forceTour}
        onCloseForce={() => setForceTour(false)}
      />
    </div>
  );
}
