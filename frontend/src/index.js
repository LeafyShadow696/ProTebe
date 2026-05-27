import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);

// Register service worker for PWA offline support + push + background sync
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const _registration = await navigator.serviceWorker.register('/sw.js');
      
      // Listen for messages from SW (e.g. sync requests)
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'SYNC_MESSAGES') {
          // Let the app know it should retry sending queued messages
          window.dispatchEvent(new CustomEvent('sw-sync-messages'));
        }
      });
      
      console.log('Service Worker registered successfully');
    } catch (error) {
      console.log('Service Worker registration failed (offline support disabled)');
    }
  });
}
