import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { timeOfDayMood } from '../lib/dates';

/**
 * Layered ambient background with time-of-day mood sensitivity.
 * The background orbs and CSS gradients react to morning / day / evening / night.
 */
export default function AmbientBackground() {
  const mood = useMemo(() => timeOfDayMood().key, []);
  const moodClass = `mood-${mood}`;

  return (
    <>
      <div className={`ambient-bg ${moodClass}`} aria-hidden="true" />

      <motion.div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.4 }}
      >
        {/* Primary romantic orb */}
        <motion.div
          className="absolute h-[62vw] w-[62vw] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(229,179,187,0.16) 0%, rgba(229,179,187,0) 72%)',
            filter: 'blur(72px)',
            top: '18%',
            left: '12%',
          }}
          animate={{ 
            x: [0, 38, -12, 0], 
            y: [0, -26, 14, 0],
            scale: [1, 1.06, 0.97, 1] 
          }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Secondary deeper orb */}
        <motion.div
          className="absolute h-[58vw] w-[58vw] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(110,90,160,0.18) 0%, rgba(110,90,160,0) 72%)',
            filter: 'blur(82px)',
            bottom: '8%',
            right: '8%',
          }}
          animate={{ 
            x: [0, -32, 18, 0], 
            y: [0, 22, -16, 0],
            scale: [1, 0.95, 1.08, 1] 
          }}
          transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>
    </>
  );
}
