import React, { useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

import { storage, api } from './lib/api';
import Onboarding from './pages/Onboarding';
import LoveDashboard from './pages/LoveDashboard';
import Gallery from './pages/Gallery';
import Messages from './pages/Messages';
import AIPoet from './pages/AIPoet';
import Calendar from './pages/Calendar';
import LoveMap from './pages/LoveMap';
import Settings from './pages/Settings';
import BottomTabBar from './components/BottomTabBar';
import AmbientBackground from './components/AmbientBackground';

const pageVariants = {
  initial: { opacity: 0, y: 12, filter: 'blur(3px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -8, filter: 'blur(3px)' },
};
const pageTransition = { 
  type: 'spring', 
  stiffness: 260, 
  damping: 28, 
  mass: 0.9 
};

function AnimatedRoutes({ pair, refreshPair }) {
  const location = useLocation();

  const shell = (Component) => (
    <motion.div
      key={location.pathname}
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransition}
      className="min-h-[100dvh] w-full pb-[calc(3.25rem+env(safe-area-inset-bottom))]"   // proper space for bottom tab bar + safe area on all devices
    >
      <Component pair={pair} refreshPair={refreshPair} />
    </motion.div>
  );

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={shell(LoveDashboard)} />
        <Route path="/gallery" element={shell(Gallery)} />
        <Route path="/messages" element={shell(Messages)} />
        <Route path="/poet" element={shell(AIPoet)} />
        <Route path="/calendar" element={shell(Calendar)} />
        <Route path="/map" element={shell(LoveMap)} />
        <Route path="/settings" element={shell(Settings)} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  const [pair, setPair] = useState(storage.getPair());
  const [theme, setTheme] = useState(storage.getTheme());
  const [bootChecked, setBootChecked] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    storage.setTheme(theme);
  }, [theme]);

  const refreshPair = useMemo(
    () => async () => {
      const token = storage.getToken();
      if (!token) return;
      try {
        const { data } = await api.get(`/pair/${token}`);
        storage.setPair(data);
        setPair(data);
      } catch {
        /* silent */
      }
    },
    []
  );

  useEffect(() => {
    (async () => {
      await refreshPair();
      setBootChecked(true);
    })();
  }, [refreshPair]);

  if (!bootChecked) {
    return (
      <BrowserRouter>
        <div className="relative min-h-screen w-full">
          <AmbientBackground />
          <div className="grain" />
          <div className="relative z-10 flex min-h-screen items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
              className="font-display text-3xl tracking-wide"
              style={{ color: 'var(--ink-soft)' }}
            >
              Pro Tebe
            </motion.div>
          </div>
        </div>
      </BrowserRouter>
    );
  }

  if (!pair) {
    return (
      <BrowserRouter>
        <div className="relative min-h-screen w-full overflow-hidden">
          <AmbientBackground />
          <div className="grain" />
          <Onboarding
            onReady={(p) => setPair(p)}
            theme={theme}
            setTheme={setTheme}
          />
        </div>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <div className="relative min-h-screen w-full overflow-hidden">
        <AmbientBackground />
        <div className="grain" />
        <div className="relative z-10 mx-auto min-h-screen w-full max-w-[480px]">
          <AnimatedRoutes pair={pair} refreshPair={refreshPair} />
          <BottomTabBar />
        </div>
      </div>
    </BrowserRouter>
  );
}
