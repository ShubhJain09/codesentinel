import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = 'http://localhost:4173';
const SESSION_TOKEN = '8728447b114d6e3dbf005c7afcd7368c8cd3d5d69b374103fd261a0b5edcb53c';
const SAMPLE_SCAN_ID = 'ab8c2f37-a0ef-40b0-8b60-c5958d27e4af';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log('Launching Headless Chrome with Chrome DevTools Protocol...');
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1440,960',
    '--user-data-dir=/tmp/cs-chrome-cdp-all',
  ]);

  let targetWs = null;
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    try {
      const res = await fetch('http://127.0.0.1:9222/json/version');
      if (res.ok) {
        const data = await res.json();
        targetWs = data.webSocketDebuggerUrl;
        console.log('Connected to Chrome CDP version:', data['Browser']);
        break;
      }
    } catch {}
  }

  if (!targetWs) {
    console.error('Failed to connect to Chrome CDP.');
    chrome.kill();
    process.exit(1);
  }

  const newPageRes = await fetch('http://127.0.0.1:9222/json/new?' + encodeURIComponent('about:blank'), { method: 'PUT' });
  const pageData = await newPageRes.json();
  const ws = new WebSocket(pageData.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  let messageId = 1;
  const pending = new Map();

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    }
  };

  function send(method, params = {}) {
    const id = messageId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await send('Page.enable');
  await send('Network.enable');

  // Authenticate session
  await send('Page.navigate', { url: `${BASE_URL}/` });
  await sleep(1000);
  await send('Network.setCookie', {
    name: 'cs-session',
    value: SESSION_TOKEN,
    url: 'http://localhost:4173',
  });

  const routes = [
    { name: '01_landing_hero', url: `${BASE_URL}/`, wait: 1500 },
    { name: '01_landing_full_page', url: `${BASE_URL}/`, wait: 2000, fullPage: true },
    { name: '02_command_center', url: `${BASE_URL}/app`, wait: 2000 },
    { name: '03_findings_investigation', url: `${BASE_URL}/app/findings`, wait: 2000 },
    { name: '04_pipeline_topology', url: `${BASE_URL}/app/pipeline`, wait: 2000 },
    { name: '05_scan_history', url: `${BASE_URL}/app/scans`, wait: 2000 },
    { name: '06_operator_settings', url: `${BASE_URL}/app/settings`, wait: 1500 },
    { name: '07_admin_governance', url: `${BASE_URL}/app/admin`, wait: 1500 },
    { name: '08_documentation', url: `${BASE_URL}/docs`, wait: 1500 },
    { name: '09_login_gateway', url: `${BASE_URL}/login`, wait: 1500, clearCookie: true },
    { name: '10_register_account', url: `${BASE_URL}/register`, wait: 1500, clearCookie: true },
    { name: '11_scan_detail', url: `${BASE_URL}/app/scans/${SAMPLE_SCAN_ID}`, wait: 2000 },
    { name: '12_repositories', url: `${BASE_URL}/app/repositories`, wait: 2000 },
    { name: '13_terms_page', url: `${BASE_URL}/terms`, wait: 1500 },
    { name: '14_privacy_page', url: `${BASE_URL}/privacy`, wait: 1500 },
    { name: '15_not_found', url: `${BASE_URL}/unknown-route-boundary`, wait: 1500 },
  ];

  for (const item of routes) {
    if (item.clearCookie) {
      await send('Network.clearBrowserCookies');
    } else {
      await send('Network.setCookie', {
        name: 'cs-session',
        value: SESSION_TOKEN,
        url: 'http://localhost:4173',
      });
    }

    console.log(`Capturing ${item.name}...`);
    await send('Page.navigate', { url: item.url });
    await sleep(item.wait);

    const screenshotParams = { format: 'png' };
    if (item.fullPage) {
      screenshotParams.captureBeyondViewport = true;
    }

    const { data } = await send('Page.captureScreenshot', screenshotParams);
    const buffer = Buffer.from(data, 'base64');
    const outPath = path.resolve('docs/screenshots', `${item.name}.png`);
    await writeFile(outPath, buffer);
    console.log(`Saved -> ${item.name}.png (${buffer.length} bytes)`);
  }

  ws.close();
  chrome.kill();
  console.log('Automated screenshot pass complete.');
}

main().catch(console.error);
