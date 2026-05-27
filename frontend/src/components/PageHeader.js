import React from 'react';
import { motion } from 'framer-motion';

/**
 * Standard page header with safe-area padding and an optional right slot.
 */
export default function PageHeader({ kicker, title, subtitle, right, testid }) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="pt-safe"
      data-testid={testid}
    >
      <div className="flex items-start justify-between px-5 pt-6 pb-2">
        <div>
          {kicker && (
            <div
              className="text-[11px] uppercase tracking-[0.18em]"
              style={{ color: 'var(--ink-soft)' }}
            >
              {kicker}
            </div>
          )}
          <h1
            className="font-display text-[34px] font-light leading-tight tracking-tight"
            style={{ color: 'var(--ink)' }}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>
              {subtitle}
            </p>
          )}
        </div>
        {right && <div className="pt-2">{right}</div>}
      </div>
    </motion.header>
  );
}
