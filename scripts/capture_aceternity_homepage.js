import { spawn } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = 'http://localhost:4173';
const ARTIFACT_DIR = '/Users/shubhmohta/.gemini/antigravity/brain/a3f5d05c-076d-40a7-90b6-8ea20edee388/screenshots/aceternity_homepage';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function captureHomepageInteractions() {
  await mkdir(ARTIFACT_DIR, { recursive: true });

  const port = 9333;
  console.log(`\nLaunching Chrome Headless for Aceternity Homepage Capture on port ${port}...`);

  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1440,1050',
    '--user-data-dir=/tmp/cs-chrome-aceternity',
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
    console.error('Failed to connect to Chrome');
    chrome.kill();
    return;
  }

  const pageRes = await fetch(
    `http://127.0.0.1:${port}/json/new?` + encodeURIComponent('about:blank'),
    { method: 'PUT' }
  );
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

  const takeScreenshot = async (filename, fullPage = false) => {
    const params = { format: 'png' };
    if (fullPage) {
      params.captureBeyondViewport = true;
    }
    const { data } = await send('Page.captureScreenshot', params);
    const buffer = Buffer.from(data, 'base64');
    const localPath = path.join(ARTIFACT_DIR, filename);
    await writeFile(localPath, buffer);
    console.log(`Saved screenshot -> ${filename} (${buffer.length} bytes)`);
  };

  // 1. Desktop 1440x1050: Initial View & Overview Tab
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1050,
    deviceScaleFactor: 1,
    mobile: false,
  });
  console.log('Navigating to homepage...');
  await send('Page.navigate', { url: `${BASE_URL}/` });
  await sleep(2500);

  // Accept or dismiss cookie consent for clean UI
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText === 'Accept');
      if (btn) btn.click();
    })()`,
  });
  await sleep(600);

  await takeScreenshot('01_desktop_hero_overview_tab.png');

  // 2. Click Tab 2: Scan
  console.log('Selecting Tab: Scan...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Scan'));
      if (btn) btn.click();
    })()`,
  });
  await sleep(1000);
  await takeScreenshot('02_desktop_tab_scan.png');

  // 3. Click Tab 3: Findings
  console.log('Selecting Tab: Findings...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Findings'));
      if (btn) btn.click();
    })()`,
  });
  await sleep(1000);
  await takeScreenshot('03a_desktop_tab_findings_vulnerable.png');

  // Click Remediated Safe Implementation
  console.log('Toggling Findings: Remediated Implementation...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Remediated Safe Implementation'));
      if (btn) btn.click();
    })()`,
  });
  await sleep(600);
  await takeScreenshot('03b_desktop_tab_findings_remediated.png');

  // 4. Click Tab 4: History
  console.log('Selecting Tab: History...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('History'));
      if (btn) btn.click();
    })()`,
  });
  await sleep(1000);
  await takeScreenshot('04_desktop_tab_history.png');

  // 5. Click Tab 5: Pipeline
  console.log('Selecting Tab: Pipeline...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Pipeline'));
      if (btn) btn.click();
    })()`,
  });
  await sleep(1000);
  await takeScreenshot('05_desktop_tab_pipeline.png');

  // 6. Full Page Desktop
  console.log('Capturing Desktop Full Page...');
  await takeScreenshot('06_desktop_full_page.png', true);

  // 7. Tablet 1024x768
  console.log('Capturing Tablet (1024x768)...');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1024,
    height: 768,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send('Page.navigate', { url: `${BASE_URL}/` });
  await sleep(2000);
  await takeScreenshot('07_tablet_1024_landing.png');

  // 8. Mobile 390x844
  console.log('Capturing Mobile (390x844)...');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await send('Page.navigate', { url: `${BASE_URL}/` });
  await sleep(2000);
  await takeScreenshot('08_mobile_390_landing.png');

  ws.close();
  chrome.kill();
  console.log('\nAll Aceternity interactive homepage screenshots captured successfully.');
}

captureHomepageInteractions().catch(console.error);
