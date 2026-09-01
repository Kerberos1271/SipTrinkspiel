import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  let registration: ServiceWorkerRegistration | null = null;
  let isReloadingForUpdate = false;
  const hadController = Boolean(navigator.serviceWorker.controller);

  const checkForUpdatesAndData = () => {
    void registration?.update().catch(() => undefined);
    window.dispatchEvent(new Event('sip-app-resume'));
  };

  window.addEventListener('online', checkForUpdatesAndData);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdatesAndData();
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || isReloadingForUpdate) return;
    isReloadingForUpdate = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    const serviceWorkerUrl = `/sw.js?v=${encodeURIComponent(__APP_VERSION__)}`;
    navigator.serviceWorker.register(serviceWorkerUrl, { updateViaCache: 'none' })
      .then((nextRegistration) => {
        registration = nextRegistration;
        const activateWaitingWorker = () => registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
        activateWaitingWorker();
        registration.addEventListener('updatefound', () => {
          const installing = registration?.installing;
          installing?.addEventListener('statechange', () => {
            if (installing.state === 'installed') activateWaitingWorker();
          });
        });
        return registration.update();
      })
      .catch(() => undefined);
  });
}
