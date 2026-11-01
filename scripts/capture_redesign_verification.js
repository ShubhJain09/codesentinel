import { spawn } from 'node:child_process';
import { writeFile, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = 'http://localhost:4173';
const SESSION_TOKEN = '8728447b114d6e3dbf005c7afcd7368c8cd3d5d69b374103fd261a0b5edcb53c';
const ARTIFACT_DIR = '/Users/shubhmohta/.gemini/antigravity/brain/a3f5d05c-076d-40a7-90b6-8ea20edee388/screenshots/after';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runCapture(viewports) {
  await mkdir('docs/screenshots/after', { recursive: true });
  await mkdir(ARTIFACT_DIR, { recursive: true });

  for (let idx = 0; idx < viewports.length; idx++) {
    const vp = viewports[idx];
    const port = 9222 + idx;
    console.log(`\n=== Running Capture for Viewport: ${vp.name} (${vp.width}x${vp.height}) on port ${port} ===`);

    const chrome = spawn(CHROME_PATH, [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      '--disable-gpu',
      '--no-sandbox',
      `--window-size=${vp.width},${vp.height}`,
      `--user-data-dir=/tmp/cs-chrome-${vp.name}`,
    ]);

    let targetWs = null;
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      try {
        const res = await fetch(`http://127.0.0.1:${port}/json/version`);
        if (res.ok) {
          const data = await res.json();
          targetWs = data.webSocketDebuggerUrl;
          break;
        }
      } catch {}
    }

    if (!targetWs) {
      console.error(`Failed to connect to Chrome for ${vp.name}`);
      chrome.kill();
      continue;
    }

    const pageRes = await fetch(`http://127.0.0.1:${port}/json/new?` + encodeURIComponent('about:blank'), { method: 'PUT' });
    const { webSocketDebuggerUrl: pWs } = await pageRes.json();
    const ws = new WebSocket(pWs);
    await new Promise((r) => (ws.onopen = r));

    let id = 1;
    const send = (method, params = {}) =>
      new Promise((resolve) => {
        const cur = id++;
        const handler = (e) => {
          const m = JSON.parse(e.data);
          if (m.id === cur) {
            ws.removeEventListener('message', handler);
            resolve(m.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id: cur, method, params }));
      });

    await send('Page.enable');
    await send('Network.enable');

    // Set viewport dimensions explicitly
    await send('Emulation.setDeviceMetricsOverride', {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 1,
      mobile: vp.isMobile || false,
    });

    for (const route of vp.routes) {
      if (route.public) {
        await send('Network.clearBrowserCookies');
      } else {
        await send('Network.setCookie', {
          name: 'cs-session',
          value: SESSION_TOKEN,
          url: 'http://localhost:4173',
        });
      }

      console.log(`Capturing [${vp.name}] ${route.name} (${route.url})...`);
      await send('Page.navigate', { url: route.url });
      await sleep(route.wait || 2000);

      if (route.action) {
        await route.action(send);
      }

      const params = { format: 'png' };
      if (route.fullPage) {
        params.captureBeyondViewport = true;
      }

      const { data } = await send('Page.captureScreenshot', params);
      const buffer = Buffer.from(data, 'base64');
      const filename = `${vp.name}_${route.name}.png`;
      const localPath = path.join('docs/screenshots/after', filename);
      await writeFile(localPath, buffer);
      await writeFile(path.join(ARTIFACT_DIR, filename), buffer);
      console.log(`Saved -> ${localPath} (${buffer.length} bytes)`);
    }

    ws.close();
    chrome.kill();
    await sleep(1000);
  }

  console.log('\nAll viewport captures completed successfully.');
}

const VIEWPORTS = [
  {
    name: 'desktop_1440',
    width: 1440,
    height: 960,
    routes: [
      { name: '01_landing_hero', url: `${BASE_URL}/`, public: true, wait: 2000 },
      { name: '01_landing_full', url: `${BASE_URL}/`, public: true, fullPage: true, wait: 2500 },
      { name: '02_command_center', url: `${BASE_URL}/app`, wait: 2500 },
      {
        name: '02b_account_popover',
        url: `${BASE_URL}/app`,
        wait: 2000,
        action: async (send) => {
          await send('Runtime.evaluate', {
            expression: `(() => {
              const accountBtn = document.querySelector('aside button[type="button"]');
              if (accountBtn) accountBtn.click();
            })()`,
          });
          await sleep(500);
        },
      },
      { name: '03_findings', url: `${BASE_URL}/app/findings`, wait: 2500 },
      {
        name: '03b_findings_occurrences',
        url: `${BASE_URL}/app/findings`,
        wait: 2000,
        action: async (send) => {
          await send('Runtime.evaluate', {
            expression: `(() => {
              const occBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('All Occurrences'));
              if (occBtn) occBtn.click();
            })()`,
          });
          await sleep(500);
        },
      },
      { name: '04_pipeline', url: `${BASE_URL}/app/pipeline`, wait: 2500 },
      { name: '05_scan_history', url: `${BASE_URL}/app/scans`, wait: 2000 },
      { name: '06_repositories', url: `${BASE_URL}/app/repositories`, wait: 2000 },
      { name: '06b_integrations', url: `${BASE_URL}/app/integrations`, wait: 2000 },
      { name: '07_settings', url: `${BASE_URL}/app/settings`, wait: 2000 },
      { name: '08_admin', url: `${BASE_URL}/app/admin`, wait: 2000 },
      { name: '09_login', url: `${BASE_URL}/login`, public: true, wait: 1500 },
      { name: '10_register', url: `${BASE_URL}/register`, public: true, wait: 1500 },
      { name: '11_scan_detail', url: `${BASE_URL}/app/scans/ab8c2f37e401`, wait: 2000 },
      { name: '12_docs', url: `${BASE_URL}/docs`, public: true, wait: 2000 },
    ],
  },
  {
    name: 'tablet_1024',
    width: 1024,
    height: 768,
    routes: [
      { name: '01_landing', url: `${BASE_URL}/`, public: true, wait: 2000 },
      { name: '02_command_center', url: `${BASE_URL}/app`, wait: 2500 },
      { name: '03_findings', url: `${BASE_URL}/app/findings`, wait: 2500 },
      { name: '06b_integrations', url: `${BASE_URL}/app/integrations`, wait: 2000 },
      { name: '07_settings', url: `${BASE_URL}/app/settings`, wait: 2000 },
    ],
  },
  {
    name: 'mobile_390',
    width: 390,
    height: 844,
    isMobile: true,
    routes: [
      { name: '01_landing', url: `${BASE_URL}/`, public: true, wait: 2000 },
      { name: '02_command_center', url: `${BASE_URL}/app`, wait: 2500 },
      { name: '03_findings', url: `${BASE_URL}/app/findings`, wait: 2500 },
      { name: '06b_integrations', url: `${BASE_URL}/app/integrations`, wait: 2000 },
      { name: '07_settings', url: `${BASE_URL}/app/settings`, wait: 2000 },
    ],
  },
];

runCapture(VIEWPORTS).catch(console.error);
