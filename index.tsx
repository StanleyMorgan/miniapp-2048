
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Провайдеры перенесены в App.tsx для отложенной инициализации.
// Это ключевое исправление для предотвращения гонки состояний с Farcaster SDK.

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
