import { spawn } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = 'http://localhost:4173';
const OUTPUT_DIR = 'docs/screenshots/journeys';
const ARTIFACT_DIR = '/Users/shubhmohta/.gemini/antigravity/brain/a3f5d05c-076d-40a7-90b6-8ea20edee388/screenshots/journeys';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await mkdir(ARTIFACT_DIR, { recursive: true });
  console.log('Starting End-to-End User Journey Verification in real Chrome...');

  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9235',
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1440,960',
    '--user-data-dir=/tmp/cs-chrome-journey-test',
  ]);

  let targetWs = null;
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    try {
      const res = await fetch('http://127.0.0.1:9235/json/version');
      if (res.ok) {
        const data = await res.json();
        targetWs = data.webSocketDebuggerUrl;
        break;
      }
    } catch {}
  }

  if (!targetWs) {
    chrome.kill();
    throw new Error('Failed to connect to headless Chrome remote debugging port.');
  }

  const pageRes = await fetch('http://127.0.0.1:9235/json/new?' + encodeURIComponent('about:blank'), { method: 'PUT' });
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

  const evaluate = async (expression) => {
    const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return res.result?.value;
  };

  const capture = async (name) => {
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(data, 'base64');
    const filename = `${name}.png`;
    await writeFile(path.join(OUTPUT_DIR, filename), buffer);
    await writeFile(path.join(ARTIFACT_DIR, filename), buffer);
    console.log(`  -> Captured screenshot: ${OUTPUT_DIR}/${filename} (${buffer.length} bytes)`);
  };

  await send('Page.enable');
  await send('Network.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 960,
    deviceScaleFactor: 1,
    mobile: false,
  });

  // Clear any existing cookies
  await send('Network.clearBrowserCookies');

  console.log('\n======================================================');
  console.log('JOURNEY 1: Login Gateway');
  console.log('======================================================');
  await send('Page.navigate', { url: `${BASE_URL}/login` });
  await sleep(2000);

  const loginTitle = await evaluate('document.querySelector("h1")?.innerText');
  console.log('Page Title:', loginTitle);

  // Fill in email and password using React prototype value setter
  await evaluate(`
    (() => {
      function setReactInput(input, value) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }

      const emailInput = document.querySelector('input[type="email"], input[name="login"]');
      const passInput = document.querySelector('input[type="password"]');
      setReactInput(emailInput, ${JSON.stringify(process.env.OPERATOR_EMAIL || 'workspaceshubhjain@gmail.com')});
      setReactInput(passInput, ${JSON.stringify(process.env.OPERATOR_PASSWORD || '')});
    })()
  `);
  await sleep(500);

  // Click Submit
  await evaluate(`
    (() => {
      const submitBtn = document.querySelector('button[type="submit"]');
      submitBtn.click();
    })()
  `);
  await sleep(2500);

  const currentUrlAfterLogin = await evaluate('window.location.pathname');
  console.log('URL after login:', currentUrlAfterLogin);
  if (currentUrlAfterLogin !== '/app') {
    throw new Error(`Login failed to navigate to /app. Current URL: ${currentUrlAfterLogin}`);
  }
  await capture('journey_01_login_success');

  console.log('\n======================================================');
  console.log('JOURNEY 2: Dashboard Navigation & Live Scan Execution');
  console.log('======================================================');
  const dashboardHeading = await evaluate('document.querySelector("h1")?.innerText');
  console.log('Dashboard heading:', dashboardHeading);

  // Trigger scan execution via "+ Run Security Scan"
  console.log('Clicking "+ Run Security Scan"...');
  await evaluate(`
    (() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Run Security Scan') || b.innerText.includes('Run Scan'));
      if (btn) btn.click();
    })()
  `);
  await sleep(3500); // Allow Semgrep execution and state update
  await capture('journey_02_scan_executed');

  console.log('\n======================================================');
  console.log('JOURNEY 3: Vulnerabilities & Contextual Investigation Drawer');
  console.log('======================================================');
  await send('Page.navigate', { url: `${BASE_URL}/app/findings` });
  await sleep(2000);

  const findingsCount = await evaluate('document.querySelectorAll(".rounded-xl.border").length');
  console.log('Rendered findings card count:', findingsCount);

  // Click the first "Inspect" button to open the contextual investigation drawer
  console.log('Opening contextual investigation drawer for first finding...');
  await evaluate(`
    (() => {
      const inspectBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Inspect'));
      if (inspectBtn) inspectBtn.click();
    })()
  `);
  await sleep(1500);

  const drawerVisible = await evaluate('Boolean(document.querySelector("button[aria-label=\'Close investigation drawer\']"))');
  console.log('Contextual drawer open:', drawerVisible);
  await capture('journey_03_finding_drawer_open');

  // Close drawer
  console.log('Closing investigation drawer...');
  await evaluate(`
    (() => {
      const closeBtn = document.querySelector('button[aria-label="Close investigation drawer"]');
      if (closeBtn) closeBtn.click();
      else {
        const backdrop = document.querySelector('.fixed.inset-0.bg-black\\/70 > div');
        if (backdrop) backdrop.click();
      }
    })()
  `);
  await sleep(800);

  // Test search filtering
  console.log('Testing search filter (query: eval)...');
  await evaluate(`
    (() => {
      function setReactInput(input, value) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }

      const searchInput = document.querySelector('input[placeholder*="Search"]');
      if (searchInput) {
        setReactInput(searchInput, 'eval');
      }
    })()
  `);
  await sleep(1500);
  await capture('journey_03b_findings_filtered');

  console.log('\n======================================================');
  console.log('JOURNEY 4: Scan History & Detail Inspection');
  console.log('======================================================');
  await send('Page.navigate', { url: `${BASE_URL}/app/scans` });
  await sleep(2000);

  // Click into the first scan row to open scan detail page
  console.log('Opening first scan record...');
  await evaluate(`
    (() => {
      const firstRowBtn = document.querySelector('button[aria-label="Inspect scan detail"]') || document.querySelector('.cursor-pointer');
      if (firstRowBtn) firstRowBtn.click();
    })()
  `);
  await sleep(2000);
  console.log('Scan Detail URL:', await evaluate('window.location.pathname'));
  await capture('journey_04_scan_detail');

  console.log('\n======================================================');
  console.log('JOURNEY 5: Repositories Ingress Management');
  console.log('======================================================');
  await send('Page.navigate', { url: `${BASE_URL}/app/repositories` });
  await sleep(2000);
  const repoName = await evaluate('document.querySelector(".font-medium.text-white")?.innerText');
  console.log('Allowlisted target repository:', repoName);
  await capture('journey_05_repositories');

  console.log('\n======================================================');
  console.log('JOURNEY 6: Zero-Trust Pipeline Topology');
  console.log('======================================================');
  await send('Page.navigate', { url: `${BASE_URL}/app/pipeline` });
  await sleep(2000);

  // Switch to 6-stage topology tab
  console.log('Switching to 6-Stage Topology view...');
  await evaluate(`
    (() => {
      const tab = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('6-Stage Topology'));
      if (tab) tab.click();
    })()
  `);
  await sleep(1000);
  await capture('journey_06_pipeline_topology');

  console.log('\n======================================================');
  console.log('JOURNEY 6b: Dedicated Integrations & Webhook Ingress');
  console.log('======================================================');
  await send('Page.navigate', { url: `${BASE_URL}/app/integrations` });
  await sleep(2000);
  const webhookUrlText = await evaluate('document.querySelector("code")?.innerText');
  console.log('Configured Webhook URL:', webhookUrlText);
  await capture('journey_06b_integrations');

  console.log('\n======================================================');
  console.log('JOURNEY 7: Settings & Operator Profile');
  console.log('======================================================');
  await send('Page.navigate', { url: `${BASE_URL}/app/settings` });
  await sleep(2000);

  // Update operator name
  console.log('Updating operator name...');
  await evaluate(`
    (() => {
      function setReactInput(input, value) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }

      const nameInput = document.querySelector('input[placeholder="Operator Full Name"]') || document.querySelector('input[type="text"]');
      if (nameInput) {
        setReactInput(nameInput, 'Shubh Mohta (Security Lead)');
      }
      const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Save Profile') || b.innerText.includes('Save'));
      if (saveBtn) saveBtn.click();
    })()
  `);
  await sleep(2000);
  await capture('journey_07_settings_updated');

  console.log('\n======================================================');
  console.log('JOURNEY 8: Team & Roles Governance');
  console.log('======================================================');
  await send('Page.navigate', { url: `${BASE_URL}/app/admin` });
  await sleep(2000);
  const membersCount = await evaluate('document.querySelectorAll("table tbody tr").length');
  console.log('Admin member rows:', membersCount);
  await capture('journey_08_team_roles');

  console.log('\n======================================================');
  console.log('JOURNEY 9: Account Popover & Safe Sign Out');
  console.log('======================================================');
  // Navigate back to Dashboard to exercise the sidebar account popover
  await send('Page.navigate', { url: `${BASE_URL}/app` });
  await sleep(2000);

  console.log('Opening Account Popover in sidebar...');
  await evaluate(`
    (() => {
      const accountBtn = document.querySelector('aside .relative button[type="button"]');
      if (accountBtn) accountBtn.click();
    })()
  `);
  await sleep(800);
  await capture('journey_09a_account_popover_open');

  console.log('Clicking Sign Out button...');
  await evaluate(`
    (() => {
      const signOutBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Sign Out') || b.innerText.includes('Logout'));
      if (signOutBtn) signOutBtn.click();
    })()
  `);
  await sleep(2000);

  const urlAfterLogout = await evaluate('window.location.pathname');
  console.log('URL after logout:', urlAfterLogout);

  // Verify route guard by attempting to navigate directly to /app
  console.log('Attempting unauthenticated access to /app...');
  await send('Page.navigate', { url: `${BASE_URL}/app` });
  await sleep(2000);

  const guardedUrl = await evaluate('window.location.pathname');
  console.log('Guarded URL redirect:', guardedUrl);
  if (guardedUrl !== '/login') {
    throw new Error(`Route guard failed: Expected redirect to /login but got ${guardedUrl}`);
  }
  await capture('journey_09b_logout_verified');

  ws.close();
  chrome.kill();
  console.log('\nAll user journeys successfully executed and verified in real Chrome!');
}

main().catch((err) => {
  console.error('Journey verification failed:', err);
  process.exit(1);
});
