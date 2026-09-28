import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'sonner';
import { AppProvider } from './context/AppContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { App } from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppProvider>
        <App />
        <Toaster
        position="top-center"
        richColors
        closeButton
        toastOptions={{
          style: {
            fontFamily: 'var(--font-family)',
            borderRadius: 'var(--radius-md)',
            fontSize: 14,
            fontWeight: 600,
          },
          duration: 3500,
        }}
      />
    </AppProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
