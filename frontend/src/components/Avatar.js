import React from 'react';

/**
 * Round avatar. Falls back to an initial inside a glass circle when no image.
 */
export default function Avatar({ src, name, size = 40, className = '', testid }) {
  const initial = (name || '').trim().slice(0, 1).toUpperCase() || '·';
  const style = { width: size, height: size, fontSize: size * 0.42 };
  if (src) {
    return (
      <img
        src={src}
        alt={name || 'avatar'}
        data-testid={testid}
        className={`rounded-full object-cover ${className}`}
        style={{ ...style, border: '1.5px solid rgba(229,179,187,0.4)' }}
      />
    );
  }
  return (
    <div
      data-testid={testid}
      className={`flex items-center justify-center rounded-full font-display ${className}`}
      style={{
        ...style,
        background:
          'linear-gradient(160deg, rgba(229,179,187,0.30) 0%, rgba(199,122,138,0.20) 100%)',
        color: 'var(--ink)',
        border: '1.5px solid rgba(229,179,187,0.35)',
      }}
    >
      {initial}
    </div>
  );
}

/** Two overlapping avatars — "couple" pair display. */
export function CoupleAvatars({ ownerSrc, partnerSrc, ownerName, partnerName, size = 36, testid }) {
  return (
    <div className="flex items-center" data-testid={testid}>
      <Avatar src={ownerSrc} name={ownerName} size={size} />
      <div style={{ marginLeft: -size * 0.35 }}>
        <Avatar src={partnerSrc} name={partnerName} size={size} />
      </div>
    </div>
  );
}
