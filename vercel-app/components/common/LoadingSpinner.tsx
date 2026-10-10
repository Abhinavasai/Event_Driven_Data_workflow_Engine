'use client';

import { motion } from 'framer-motion';

export function LoadingSpinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <motion.div
        className="h-12 w-12 rounded-2xl bg-gradient-to-br from-brand to-accent p-[2px] shadow-lift"
        animate={{ rotate: 360 }}
        transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
      >
        <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-white">
          <div className="h-3 w-3 rounded-full bg-brand" />
        </div>
      </motion.div>
      <p className="text-sm font-medium text-ink-muted">{label}</p>
    </div>
  );
}
