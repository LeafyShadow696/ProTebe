import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, Image as ImageIcon, MessageCircle, Sparkles, Calendar, Map, Settings } from 'lucide-react';

const tabs = [
  { to: '/', label: 'Domov', Icon: Heart, testid: 'tab-home' },
  { to: '/gallery', label: 'Galerie', Icon: ImageIcon, testid: 'tab-gallery' },
  { to: '/messages', label: 'Vzkazy', Icon: MessageCircle, testid: 'tab-messages' },
  { to: '/poet', label: 'Básník', Icon: Sparkles, testid: 'tab-poet' },
  { to: '/calendar', label: 'Kalendář', Icon: Calendar, testid: 'tab-calendar' },
  { to: '/map', label: 'Mapa', Icon: Map, testid: 'tab-map' },
  { to: '/settings', label: 'Více', Icon: Settings, testid: 'tab-settings' },
];

export default function BottomTabBar() {
  const location = useLocation();
  return (
    <nav
      className="bottom-tab-bar-wrap pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center pb-safe"
      aria-label="Hlavní navigace"
    >
      <div
        className="pointer-events-auto mx-2 mb-2 flex w-full max-w-[480px] items-stretch justify-between gap-0.5 rounded-3xl px-1.5 py-1.5 glass-strong shadow-[0_10px_40px_rgba(0,0,0,0.45)] sm:mx-3 sm:mb-3 sm:rounded-[28px] sm:px-2 sm:py-2"
        data-testid="bottom-tab-bar"
      >
        {tabs.map(({ to, label, Icon, testid }) => {
          const active = location.pathname === to;
          return (
            <NavLink
              key={to}
              to={to}
              data-testid={testid}
              className="relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1.5 tap ring-rose"
            >
              {active && (
                <motion.div
                  layoutId="tab-pill"
                  className="absolute inset-0 -z-10 rounded-2xl"
                  style={{
                    background:
                      'linear-gradient(180deg, rgba(229,179,187,0.18) 0%, rgba(229,179,187,0.08) 100%)',
                    border: '1px solid rgba(229,179,187,0.25)',
                  }}
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}
              <Icon
                size={20}
                strokeWidth={active ? 2.2 : 1.6}
                className={active ? 'text-rose-accent' : 'text-white/60'}
                style={active ? { color: 'var(--rose)' } : { color: 'var(--ink-soft)' }}
              />
              <span
                className="text-[10px] font-medium tracking-tight"
                style={active ? { color: 'var(--ink)' } : { color: 'var(--ink-soft)' }}
              >
                {label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
