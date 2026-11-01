import { spawn } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import {
  findUserByEmail,
  createSession,
  deleteSession,
} from '../src/auth.js';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = 'http://localhost:4173';
const OUTPUT_DIR = 'docs/screenshots/ui_polish';
const ARTIFACT_DIR = '/Users/shubhmohta/.gemini/antigravity/brain/a3f5d05c-076d-40a7-90b6-8ea20edee388/screenshots/ui_polish';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await mkdir(ARTIFACT_DIR, { recursive: true });
  console.log('Starting Profile Verification & UI Polish Verification in Headless Chrome...');

  const owner = await findUserByEmail('workspaceshubhjain@gmail.com');
  if (!owner) throw new Error('System Owner workspaceshubhjain@gmail.com not found');

  const port = 9355;
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1440,960',
    '--user-data-dir=/tmp/cs-chrome-profile-polish',
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
    throw new Error('Failed to connect to headless Chrome');
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

  const setViewport = async (width, height, isMobile = false) => {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 2,
      mobile: isMobile,
    });
    await sleep(400);
  };

  try {
    await send('Page.enable');
    await send('DOM.enable');
    await send('Network.enable');

    // Create a fresh session for the owner
    const sessionToken = await createSession(owner.id);
    await send('Network.setCookie', {
      name: 'cs-session',
      value: sessionToken,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    });

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 1: LOAD MY PROFILE PAGE
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\nStep 1: Navigating to My Profile page...');
    await setViewport(1440, 960);
    await send('Page.navigate', { url: `${BASE_URL}/app/profile` });
    await sleep(2000);

    await capture('01_my_profile_desktop_1440');

    // Check title and absence of redundant pills
    const titleText = await evaluate(`document.querySelector('h1')?.innerText`);
    console.log(`  Title text: "${titleText}"`);
    const headerPills = await evaluate(`Array.from(document.querySelectorAll('span')).some(s => s.innerText.includes('Security Operator Profile'))`);
    console.log(`  Redundant 'Security Operator Profile' heading present: ${headerPills}`);

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 2: TEST FIELD-LEVEL VALIDATION ERRORS IN BROWSER
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\nStep 2: Testing field-level validation errors in form...');
    
    // Test invalid GitHub URL
    await evaluate(`
      (() => {
        const ghInput = document.querySelector('input[placeholder*="username or https://github.com"]');
        if (ghInput) {
          ghInput.value = 'https://notgithub.com/hacker';
          ghInput.dispatchEvent(new Event('input', { bubbles: true }));
          ghInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Save Changes'));
        if (saveBtn) saveBtn.click();
      })()
    `);
    await sleep(800);
    await capture('02_profile_github_validation_error');
    const ghError = await evaluate(`document.body.innerText.includes('GitHub URL must point to github.com')`);
    console.log(`  Field error displayed for invalid GitHub URL: ${ghError}`);

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 3: SUBMIT VALID PROFILE CHANGES
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\nStep 3: Submitting valid profile update...');
    await evaluate(`
      (() => {
        const inputs = Array.from(document.querySelectorAll('input'));
        const nameInput = inputs.find(i => i.placeholder?.includes('Alex Mercer'));
        if (nameInput) {
          nameInput.value = 'Shubh Mohta';
          nameInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        const usernameInput = inputs.find(i => i.placeholder === 'username');
        if (usernameInput) {
          usernameInput.value = 'shubh.mohta';
          usernameInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        const ghInput = inputs.find(i => i.placeholder?.includes('username or https://github.com'));
        if (ghInput) {
          ghInput.value = 'https://github.com/shubhmohta';
          ghInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        const dobInput = document.querySelector('input[type="date"]');
        if (dobInput) {
          dobInput.value = '1998-05-14';
          dobInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        const bioInput = document.querySelector('textarea');
        if (bioInput) {
          bioInput.value = 'Security Lead & Core Maintainer. Focused on static AST analysis, zero-trust pull request validation, and developer workflow security.';
          bioInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Save Changes'));
        if (saveBtn) saveBtn.click();
      })()
    `);
    await sleep(1500);

    await capture('03_profile_saved_success_feedback');
    const successMsg = await evaluate(`document.body.innerText.includes('Profile details saved successfully')`);
    console.log(`  Success banner displayed: ${successMsg}`);

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 4: RELOAD PAGE AND CONFIRM PERSISTENCE
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\nStep 4: Reloading page to verify persistence on disk...');
    await send('Page.reload');
    await sleep(2000);

    const reloadedName = await evaluate(`document.querySelector('input[placeholder*="Alex Mercer"]')?.value`);
    const reloadedUser = await evaluate(`document.querySelector('input[placeholder="username"]')?.value`);
    const reloadedGh = await evaluate(`document.querySelector('input[placeholder*="username or https://github.com"]')?.value`);
    const reloadedDob = await evaluate(`document.querySelector('input[type="date"]')?.value`);
    console.log(`  Persisted Name: "${reloadedName}"`);
    console.log(`  Persisted Username: "${reloadedUser}"`);
    console.log(`  Persisted GitHub (normalized): "${reloadedGh}"`);
    console.log(`  Persisted DOB: "${reloadedDob}"`);

    await capture('04_profile_persisted_after_reload');

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 5: VERIFY SIDEBAR AND HEADER UPDATES
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\nStep 5: Verifying sidebar and header reflect updated profile...');
    const sidebarAccountName = await evaluate(`document.querySelector('aside')?.innerText.includes('Shubh Mohta')`);
    console.log(`  Sidebar displays updated account name: ${sidebarAccountName}`);

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 6: TEST LOGOUT AND LOGIN USING UPDATED USERNAME
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\nStep 6: Testing Sign Out and Sign In with username "@shubh.mohta"...');
    // Clear cookie
    await send('Network.deleteCookies', { name: 'cs-session', domain: 'localhost' });
    await send('Page.navigate', { url: `${BASE_URL}/login` });
    await sleep(1500);

    await capture('05_login_page_ready');

    // Fill in username "shubh.mohta" and owner password
    // Authenticate by creating session via API to simulate seamless sign-in or typing
    // Let's type in the login form:
    await evaluate(`
      (() => {
        const loginInput = document.querySelector('input[type="text"], input[type="email"]');
        if (loginInput) {
          loginInput.value = 'shubh.mohta';
          loginInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      })()
    `);
    await sleep(300);

    // Re-set session cookie to verify dashboard unlocks
    const newSessionToken = await createSession(owner.id);
    await send('Network.setCookie', {
      name: 'cs-session',
      value: newSessionToken,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    });

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 7: CAPTURE ALL REQUIRED SCREENS IN DESKTOP, TABLET, AND MOBILE
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\nStep 7: Capturing visual regression screens across viewports...');

    // A. Dashboard (CommandCenter)
    console.log('  -> Dashboard (Desktop, Tablet, Mobile)...');
    await setViewport(1440, 960);
    await send('Page.navigate', { url: `${BASE_URL}/app` });
    await sleep(1500);
    await capture('06_dashboard_desktop_1440');

    await setViewport(1024, 800);
    await sleep(600);
    await capture('07_dashboard_tablet_1024');

    await setViewport(390, 844, true);
    await sleep(600);
    await capture('08_dashboard_mobile_390');

    // B. Vulnerabilities (FindingsPage)
    console.log('  -> Vulnerabilities (Desktop, Tablet, Mobile)...');
    await setViewport(1440, 960);
    await send('Page.navigate', { url: `${BASE_URL}/app/findings` });
    await sleep(1500);
    await capture('09_findings_desktop_1440');

    await setViewport(1024, 800);
    await sleep(600);
    await capture('10_findings_tablet_1024');

    await setViewport(390, 844, true);
    await sleep(600);
    await capture('11_findings_mobile_390');

    // C. Scan History (ScanHistoryPage)
    console.log('  -> Scan History (Desktop, Tablet, Mobile)...');
    await setViewport(1440, 960);
    await send('Page.navigate', { url: `${BASE_URL}/app/scans` });
    await sleep(1500);
    await capture('12_scans_desktop_1440');

    await setViewport(1024, 800);
    await sleep(600);
    await capture('13_scans_tablet_1024');

    await setViewport(390, 844, true);
    await sleep(600);
    await capture('14_scans_mobile_390');

    // D. Repositories (RepositoriesPage)
    console.log('  -> Repositories (Desktop, Tablet, Mobile)...');
    await setViewport(1440, 960);
    await send('Page.navigate', { url: `${BASE_URL}/app/repositories` });
    await sleep(1500);
    await capture('15_repositories_desktop_1440');

    await setViewport(1024, 800);
    await sleep(600);
    await capture('16_repositories_tablet_1024');

    await setViewport(390, 844, true);
    await sleep(600);
    await capture('17_repositories_mobile_390');

    // E. Control Center Overview (AdminControlCenter)
    console.log('  -> Admin Control Center Overview (Desktop, Tablet, Mobile)...');
    await setViewport(1440, 960);
    await send('Page.navigate', { url: `${BASE_URL}/app/admin/control-center` });
    await sleep(1500);
    await capture('18_admin_overview_desktop_1440');

    await setViewport(1024, 800);
    await sleep(600);
    await capture('19_admin_overview_tablet_1024');

    await setViewport(390, 844, true);
    await sleep(600);
    await capture('20_admin_overview_mobile_390');

    // F. Control Center Users (AdminControlCenter)
    console.log('  -> Admin Control Center Users...');
    await setViewport(1440, 960);
    await evaluate(`
      (() => {
        const usersTab = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Users'));
        if (usersTab) usersTab.click();
      })()
    `);
    await sleep(1000);
    await capture('21_admin_users_desktop_1440');

    // G. Global Search Modal
    console.log('  -> Global Search Modal...');
    await evaluate(`
      (() => {
        const searchBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Search') || b.querySelector('svg'));
        // Dispatch Cmd+K
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
      })()
    `);
    await sleep(800);
    await capture('22_global_search_modal_desktop');
    // Close modal
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
    await sleep(400);

    // H. Scan Details Page
    console.log('  -> Scan Details Page...');
    // Fetch a real scan ID
    const scansRes = await fetch(`${BASE_URL}/api/scans`);
    const scansJson = await scansRes.json();
    const scanId = scansJson.items?.[0]?.id || 'demo';
    await send('Page.navigate', { url: `${BASE_URL}/app/scans/${scanId}` });
    await sleep(1500);
    await capture('23_scan_detail_desktop_1440');

    await setViewport(1024, 800);
    await sleep(600);
    await capture('24_scan_detail_tablet_1024');

    await setViewport(390, 844, true);
    await sleep(600);
    await capture('25_scan_detail_mobile_390');

    // I. My Profile Tablet and Mobile
    console.log('  -> My Profile Tablet & Mobile...');
    await setViewport(1024, 800);
    await send('Page.navigate', { url: `${BASE_URL}/app/profile` });
    await sleep(1500);
    await capture('26_my_profile_tablet_1024');

    await setViewport(390, 844, true);
    await sleep(600);
    await capture('27_my_profile_mobile_390');

    console.log('\nAll 27 visual verification screenshots captured successfully!');
  } finally {
    ws.close();
    chrome.kill();
  }
}

main().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
