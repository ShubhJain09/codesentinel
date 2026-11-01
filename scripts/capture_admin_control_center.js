import { spawn } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = 'http://localhost:4173';
const OUTPUT_DIR = 'docs/screenshots/admin_control_center';
const ARTIFACT_DIR = '/Users/shubhmohta/.gemini/antigravity/brain/a3f5d05c-076d-40a7-90b6-8ea20edee388/screenshots/admin_control_center';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await mkdir(ARTIFACT_DIR, { recursive: true });
  console.log('Starting Admin Control Center & Interactive Controls Verification in Chrome...');

  const port = 9345;
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1440,960',
    '--user-data-dir=/tmp/cs-chrome-admin-test',
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
    chrome.kill();
    throw new Error('Failed to connect to headless Chrome remote debugging port.');
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
    console.log(`  -> Captured: ${filename} (${buffer.length} bytes)`);
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

  // 1. Log in as System Owner
  console.log('\nLogging in as System Owner...');
  await send('Page.navigate', { url: `${BASE_URL}/login` });
  await sleep(1500);

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
      document.querySelector('button[type="submit"]')?.click();
    })()
  `);
  await sleep(2500);

  // 2. Open Dark Command Palette
  console.log('Capturing Dark Command Palette...');
  await evaluate(`
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
  `);
  await sleep(600);
  await capture('01_dark_command_palette');

  // Close command palette
  await evaluate(`
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  `);
  await sleep(400);

  // 3. System Owner popover on Dashboard (/app)
  console.log('Capturing System Owner Popover...');
  await evaluate(`
    (() => {
      const chips = document.querySelectorAll('.agndex-meta-chip');
      for (const chip of chips) {
        if (chip.textContent.includes('System Owner') || chip.textContent.includes('Administrator') || chip.textContent.includes('Operator')) {
          chip.click();
          break;
        }
      }
    })()
  `);
  await sleep(600);
  await capture('02_system_owner_popover');

  // Close popover
  await evaluate(`
    (() => {
      const closeButtons = document.querySelectorAll('button');
      for (const b of closeButtons) {
        if (b.textContent.trim() === 'Close') {
          b.click();
          break;
        }
      }
    })()
  `);
  await sleep(400);

  // 4. Scan History Review Summary & Filter Modal
  console.log('Capturing Scan History Review Summary Modal...');
  await send('Page.navigate', { url: `${BASE_URL}/app/scans` });
  await sleep(1500);

  await evaluate(`
    (() => {
      const chips = document.querySelectorAll('.agndex-meta-chip');
      for (const chip of chips) {
        if (chip.textContent.includes('Reviews Recorded')) {
          chip.click();
          break;
        }
      }
    })()
  `);
  await sleep(600);
  await capture('03_scan_history_summary_modal');

  // Close summary modal
  await evaluate(`
    (() => {
      const closeButtons = document.querySelectorAll('button');
      for (const b of closeButtons) {
        if (b.textContent.trim() === 'Close') {
          b.click();
          break;
        }
      }
    })()
  `);
  await sleep(400);

  // Filter to Flagged flaws tab above the table
  console.log('Capturing Scan History Filtered by Flagged...');
  await evaluate(`
    (() => {
      const buttons = document.querySelectorAll('button');
      for (const b of buttons) {
        if (b.textContent.startsWith('Flagged (')) {
          b.click();
          break;
        }
      }
    })()
  `);
  await sleep(600);
  await capture('04_scan_history_filtered_flagged');

  // 5. Repositories Target & Allowlist Modals
  console.log('Capturing Repositories Target Modal...');
  await send('Page.navigate', { url: `${BASE_URL}/app/repositories` });
  await sleep(1500);

  await evaluate(`
    (() => {
      const chips = document.querySelectorAll('.agndex-meta-chip');
      for (const chip of chips) {
        if (chip.textContent.includes('Repository Target') || chip.textContent.includes('Repository Targets')) {
          chip.click();
          break;
        }
      }
    })()
  `);
  await sleep(600);
  await capture('05_repositories_target_modal');

  // Close target modal and open allowlist modal
  console.log('Capturing Repositories Allowlist Modal...');
  await evaluate(`
    (() => {
      const closeButtons = document.querySelectorAll('button');
      for (const b of closeButtons) {
        if (b.textContent.trim() === 'Close') {
          b.click();
          break;
        }
      }
    })()
  `);
  await sleep(400);

  await evaluate(`
    (() => {
      const chips = document.querySelectorAll('.agndex-meta-chip');
      for (const chip of chips) {
        if (chip.textContent.includes('Allowlist: STRICT')) {
          chip.click();
          break;
        }
      }
    })()
  `);
  await sleep(600);
  await capture('06_repositories_allowlist_modal');

  // Close allowlist modal
  await evaluate(`
    (() => {
      const closeButtons = document.querySelectorAll('button');
      for (const b of closeButtons) {
        if (b.textContent.trim() === 'Close') {
          b.click();
          break;
        }
      }
    })()
  `);
  await sleep(400);

  // 6. Pipeline Topology & Semgrep Core Modal
  console.log('Capturing Pipeline Topology...');
  await send('Page.navigate', { url: `${BASE_URL}/app/pipeline` });
  await sleep(1500);

  await evaluate(`
    (() => {
      const chips = document.querySelectorAll('.agndex-meta-chip');
      for (const chip of chips) {
        if (chip.textContent.includes('6 Stages Operational')) {
          chip.click();
          break;
        }
      }
    })()
  `);
  await sleep(600);
  await capture('07_pipeline_stages_topology');

  console.log('Capturing Pipeline Semgrep Core Modal...');
  await evaluate(`
    (() => {
      const chips = document.querySelectorAll('.agndex-meta-chip');
      for (const chip of chips) {
        if (chip.textContent.includes('Semgrep')) {
          chip.click();
          break;
        }
      }
    })()
  `);
  await sleep(600);
  await capture('08_pipeline_scanner_inspector_modal');

  // Close scanner modal
  await evaluate(`
    (() => {
      const closeButtons = document.querySelectorAll('button');
      for (const b of closeButtons) {
        if (b.textContent.trim() === 'Close') {
          b.click();
          break;
        }
      }
    })()
  `);
  await sleep(400);

  // 7. Team & Roles Members & Matrix Modal
  console.log('Capturing Team & Roles Members Directory...');
  await send('Page.navigate', { url: `${BASE_URL}/app/admin` });
  await sleep(1500);

  await evaluate(`
    (() => {
      const chips = document.querySelectorAll('.agndex-meta-chip');
      for (const chip of chips) {
        if (chip.textContent.includes('Member')) {
          chip.click();
          break;
        }
      }
    })()
  `);
  await sleep(600);
  await capture('09_team_roles_member_focus');

  console.log('Capturing Team & Roles Permissions Matrix Modal...');
  await evaluate(`
    (() => {
      const chips = document.querySelectorAll('.agndex-meta-chip');
      for (const chip of chips) {
        if (chip.textContent.includes('Access')) {
          chip.click();
          break;
        }
      }
    })()
  `);
  await sleep(600);
  await capture('10_team_roles_matrix_modal');

  // Close matrix modal
  await evaluate(`
    (() => {
      const closeButtons = document.querySelectorAll('button');
      for (const b of closeButtons) {
        if (b.textContent.trim() === 'Close') {
          b.click();
          break;
        }
      }
    })()
  `);
  // Generate real audit log entry via authenticated session
  await evaluate(`
    fetch('/api/admin/allowlist', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ repository: 'acme-corp/api-gateway' })
    })
  `);
  await sleep(500);

  // 8. Admin Control Center Tabs
  console.log('Capturing Admin Control Center Tabs...');
  await send('Page.navigate', { url: `${BASE_URL}/app/admin/control-center` });
  await sleep(1500);

  // Tab A: Users
  await capture('11_admin_control_center_users');

  // Tab B: Repositories & Allowlist
  await evaluate(`
    (() => {
      const buttons = document.querySelectorAll('button');
      for (const b of buttons) {
        if (b.textContent.includes('Repositories & Allowlist')) {
          b.click();
          break;
        }
      }
    })()
  `);
  await sleep(600);
  await capture('12_admin_control_center_allowlist');

  // Tab C: Scanner Diagnostics
  await evaluate(`
    (() => {
      const buttons = document.querySelectorAll('button');
      for (const b of buttons) {
        if (b.textContent.includes('Scanner Diagnostics')) {
          b.click();
          break;
        }
      }
    })()
  `);
  await sleep(600);
  await capture('13_admin_control_center_scanner');

  // Tab D: Integrations & Webhooks
  await evaluate(`
    (() => {
      const buttons = document.querySelectorAll('button');
      for (const b of buttons) {
        if (b.textContent.includes('Integrations & Webhooks')) {
          b.click();
          break;
        }
      }
    })()
  `);
  await sleep(600);
  await capture('14_admin_control_center_integrations');

  // Tab E: Audit & Governance
  await evaluate(`
    (() => {
      const buttons = document.querySelectorAll('button');
      for (const b of buttons) {
        if (b.textContent.includes('Audit & Governance')) {
          b.click();
          break;
        }
      }
    })()
  `);
  await sleep(600);
  await capture('15_admin_control_center_audit');

  // 9. Responsive Viewports
  console.log('Capturing Tablet Viewport (1024x768)...');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1024,
    height: 768,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await sleep(500);
  await capture('16_admin_control_center_tablet');

  console.log('Capturing Mobile Viewport (390x844)...');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await sleep(500);
  await capture('17_admin_control_center_mobile');

  console.log('\nAll 17 verification screenshots captured successfully!');
  ws.close();
  chrome.kill();
}

main().catch((err) => {
  console.error('Error in capture script:', err);
  process.exit(1);
});
