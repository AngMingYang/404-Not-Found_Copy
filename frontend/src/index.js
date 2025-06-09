import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function() {
  const container = document.getElementById('root');
  
  if (!container) {
    console.error('Could not find root element with id "root"');
    return;
  }
  
  const root = ReactDOM.createRoot(container);
  root.render(<App />);
});

// Fallback if DOM is already loaded
if (document.readyState === 'loading') {
  // Document is still loading, wait for DOMContentLoaded
} else {
  // Document is already loaded
  const container = document.getElementById('root');
  if (container) {
    const root = ReactDOM.createRoot(container);
    root.render(<App />);
  }
}