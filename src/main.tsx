import '@fontsource-variable/atkinson-hyperlegible-next';
// Atkinson Next is loaded only for the typeface comparison on /specimen.
import '@fontsource-variable/atkinson-hyperlegible-mono';
import '@fontsource-variable/instrument-sans';
import './styles/tokens.css';
import './styles/base.css';
import './styles/code.css';
import './styles/app.css';
import './styles/site.css';
import './styles/specimen.css';

import { MotionConfig } from 'motion/react';
import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { Finding } from './app/Finding';
import { Home, NewScan, NotFound, Planned, ScanReport, Scans } from './app/pages';
import { AppShell } from './app/Shell';
import { Landing } from './site/Landing';
import { Specimen } from './site/Specimen';

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <ScrollTop />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/specimen" element={<Specimen />} />
          <Route path="/app" element={<AppShell />}>
            <Route index element={<Home />} />
            <Route path="new-scan" element={<NewScan />} />
            <Route path="scans" element={<Scans />} />
            <Route path="scans/:scanId" element={<ScanReport />} />
            <Route path="scans/:scanId/findings/:fp" element={<Finding />} />
            <Route path="findings" element={<Planned />} />
            <Route path="repositories" element={<Planned />} />
            <Route path="rules" element={<Planned />} />
            <Route path="members" element={<Planned />} />
            <Route path="settings" element={<Planned />} />
            <Route path="help" element={<Planned />} />
            <Route path="*" element={<NotFound />} />
          </Route>
          <Route path="*" element={<Landing />} />
        </Routes>
      </BrowserRouter>
    </MotionConfig>
  </StrictMode>,
);
