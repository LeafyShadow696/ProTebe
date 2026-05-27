import React from 'react';

/**
 * Reusable glass card with subtle inner shadow.
 */
export default function GlassCard({ children, className = '', as: As = 'div', testid, ...rest }) {
  return (
    <As
      data-testid={testid}
      className={`glass rounded-3xl relative overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.22)] ring-1 ring-white/5 ${className}`}
      {...rest}
    >
      {/* Subtle top inner highlight for material depth */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />
      {children}
    </As>
  );
}
