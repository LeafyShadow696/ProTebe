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
  initial: { opacity: 0, y: 8, filter: 'blur(4px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -6, filter: 'blur(4px)' },
};
const pageTransition = { duration: 0.32, ease: [0.22, 1, 0.36, 1] };

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
      className="min-h-screen w-full"
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

  // Theme handling
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

  // Hydrate from server on mount.
  useEffect(() => {
    (async () => {
      await refreshPair();
      setBootChecked(true);
    })();
  }, [refreshPair]);

  if (!bootChecked) {
    return (
      <div className="relative min-h-screen w-full">
        <AmbientBackground />
        <div className="grain" />
        <div className="relative z-10 flex min-h-screen items-center justify-center text-white/40">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="font-display text-3xl tracking-wide"
          >
            Remix
          </motion.div>
        </div>
      </div>
    );
  }

  if (!pair) {
    return (
      <div className="relative min-h-screen w-full overflow-hidden">
        <AmbientBackground />
        <div className="grain" />
        <Onboarding
          onReady={(p) => {
            setPair(p);
          }}
          theme={theme}
          setTheme={setTheme}
        />
      </div>
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
