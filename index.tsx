import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Function to mount the app
const mountApp = () => {
  const rootElement = document.getElementById('root');
  
  if (!rootElement) {
    console.error("FAILED TO FIND ROOT ELEMENT");
    return;
  }

  // Clear any existing content (helps with hot reload/re-renders)
  rootElement.innerHTML = '';

  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
};

// Wait for DOM to be ready before mounting
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountApp);
} else {
  mountApp();
}