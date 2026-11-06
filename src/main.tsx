import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import './styles/app.css';
import { App } from './App';
import { ensureSeed } from './db/db';

const root = createRoot(document.getElementById('root')!);

ensureSeed()
  .catch((e) => console.error('Seeding failed', e))
  .finally(() => {
    // Ask the browser not to evict our IndexedDB data under storage pressure.
    navigator.storage?.persist?.().catch(() => {});
    root.render(
      <StrictMode>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </StrictMode>,
    );
  });
