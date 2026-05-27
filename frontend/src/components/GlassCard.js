import React from 'react';

/**
 * Reusable glass card with subtle inner shadow.
 */
export default function GlassCard({ children, className = '', as: As = 'div', testid, ...rest }) {
  return (
    <As
      data-testid={testid}
      className={`glass rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.18)] ${className}`}
      {...rest}
    >
      {children}
    </As>
  );
}
