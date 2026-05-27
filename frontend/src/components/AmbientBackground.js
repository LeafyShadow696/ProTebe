import React from 'react';
import { motion } from 'framer-motion';

/**
 * Layered ambient background — two soft rose/midnight orbs that breathe.
 * Pure CSS variant lives in index.css; this adds a couple of motion blobs on top
 * for extra depth (so the screen never feels static).
 */
export default function AmbientBackground() {
  return (
    <>
      <div className="ambient-bg" aria-hidden="true" />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2 }}
      >
        <motion.div
          className="absolute h-[60vw] w-[60vw] rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(229,179,187,0.18) 0%, rgba(229,179,187,0) 70%)',
            filter: 'blur(60px)',
            top: '20%',
            left: '15%',
          }}
          animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute h-[55vw] w-[55vw] rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(110,90,160,0.22) 0%, rgba(110,90,160,0) 70%)',
            filter: 'blur(70px)',
            bottom: '10%',
            right: '10%',
          }}
          animate={{ x: [0, -25, 0], y: [0, 15, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>
    </>
  );
}
