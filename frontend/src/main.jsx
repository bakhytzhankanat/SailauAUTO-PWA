import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { registerPushServiceWorker } from './lib/pushNotifications';

if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    registerPushServiceWorker().catch(() => {});
  }, { once: true });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
