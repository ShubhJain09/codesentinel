import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp, normalizeGitHubHandle, validateDateOfBirth } from '../src/app.js';
import { FileStore } from '../src/store.js';
import { createUser, createSession, findUserByLogin, findUserById } from '../src/auth.js';

test('regression: normalizeGitHubHandle accepts username and full profile URLs', () => {
  // Plain username
  assert.deepEqual(normalizeGitHubHandle('shubhmohta'), { value: 'shubhmohta' });
  // With leading @
  assert.deepEqual(normalizeGitHubHandle('@shubhmohta'), { value: 'shubhmohta' });
  // Full HTTPS URL
  assert.deepEqual(normalizeGitHubHandle('https://github.com/shubhmohta'), { value: 'shubhmohta' });
  // Full HTTP URL with trailing slash
  assert.deepEqual(normalizeGitHubHandle('http://github.com/octocat/'), { value: 'octocat' });
  // github.com/username
  assert.deepEqual(normalizeGitHubHandle('github.com/torvalds'), { value: 'torvalds' });
  // Empty / undefined
  assert.deepEqual(normalizeGitHubHandle(''), { value: '' });
  assert.deepEqual(normalizeGitHubHandle(null), { value: '' });

  // Rejections
  assert.match(normalizeGitHubHandle('https://gitlab.com/shubhmohta').error, /github\.com/);
  assert.match(normalizeGitHubHandle('https://github.com/org/repo').error, /profile/);
  assert.match(normalizeGitHubHandle('user--invalid').error, /Invalid GitHub username/);
});

test('regression: validateDateOfBirth enforces calendar validity and timezone safety', () => {
  // Valid dates
  assert.deepEqual(validateDateOfBirth('1995-06-15'), { value: '1995-06-15' });
  assert.deepEqual(validateDateOfBirth('2000-01-01'), { value: '2000-01-01' });
  assert.deepEqual(validateDateOfBirth(''), { value: '' });

  // Calendar invalid
  assert.match(validateDateOfBirth('2023-02-30').error, /Invalid calendar date/);
  assert.match(validateDateOfBirth('2023-04-31').error, /Invalid calendar date/);

  // Future date
  const futureYear = new Date().getFullYear() + 2;
  assert.match(validateDateOfBirth(`${futureYear}-01-01`).error, /cannot be in the future/);

  // Format invalid
  assert.match(validateDateOfBirth('06-15-1995').error, /YYYY-MM-DD/);
  assert.match(validateDateOfBirth('not-a-date').error, /YYYY-MM-DD/);
});

test('regression: PATCH /api/auth/profile handles username, full GitHub URL, and DOB with field errors', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'cs-reg-test-'));
  const prevUsersFile = process.env.CODESENTINEL_USERS_FILE;
  const prevSessionsFile = process.env.CODESENTINEL_SESSIONS_FILE;
  process.env.CODESENTINEL_USERS_FILE = path.join(dir, 'users.json');
  process.env.CODESENTINEL_SESSIONS_FILE = path.join(dir, 'sessions.json');

  let server;
  try {
    const store = new FileStore(path.join(dir, 'store'));
    server = createApp({ store, scan: async () => ({ status: 'completed' }) });
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    const base = `http://127.0.0.1:${port}`;

    // Create user
    const user1 = await createUser({
      name: 'Initial User',
      username: 'initial.user',
      email: 'reguser1@example.com',
      password: 'password123',
    });
    const session1 = await createSession(user1.id);

    // Create a second user for conflict testing
    await createUser({
      name: 'Second User',
      username: 'taken.name',
      email: 'reguser2@example.com',
      password: 'password123',
    });

    // 1. Successful profile update with full GitHub URL and DOB
    const res1 = await fetch(`${base}/api/auth/profile`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${session1}`,
      },
      body: JSON.stringify({
        name: 'Updated Name',
        username: 'updated.user',
        bio: 'Senior Security Engineer',
        githubUsername: 'https://github.com/shubhmohta',
        dob: '1995-06-15',
      }),
    });
    assert.equal(res1.status, 200);
    const body1 = await res1.json();
    assert.equal(body1.user.name, 'Updated Name');
    assert.equal(body1.user.username, 'updated.user');
    assert.equal(body1.user.bio, 'Senior Security Engineer');
    assert.equal(body1.user.githubUsername, 'shubhmohta'); // normalized!
    assert.equal(body1.user.dob, '1995-06-15'); // preserved exactly!
    assert.equal(body1.user.id, user1.id); // immutable id!

    // 2. Verify persistence on disk
    const reloadedUser = await findUserById(user1.id);
    assert.equal(reloadedUser.username, 'updated.user');
    assert.equal(reloadedUser.githubUsername, 'shubhmohta');

    // 3. Verify login using the updated username
    const foundByNewUsername = await findUserByLogin('updated.user');
    assert.ok(foundByNewUsername);
    assert.equal(foundByNewUsername.id, user1.id);

    // Also supports leading @ login
    const foundWithAt = await findUserByLogin('@updated.user');
    assert.ok(foundWithAt);
    assert.equal(foundWithAt.id, user1.id);

    // 4. Duplicate username returns HTTP 409 with field: 'username'
    const resConflict = await fetch(`${base}/api/auth/profile`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${session1}`,
      },
      body: JSON.stringify({
        username: 'TAKEN.NAME', // case-insensitive check
      }),
    });
    assert.equal(resConflict.status, 409);
    const conflictBody = await resConflict.json();
    assert.equal(conflictBody.field, 'username');
    assert.match(conflictBody.error, /already taken/i);

    // 5. Malformed GitHub URL returns HTTP 400 with field: 'githubUsername' and NOT 500
    const resBadGh = await fetch(`${base}/api/auth/profile`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${session1}`,
      },
      body: JSON.stringify({
        githubUsername: 'https://evil.com/fake',
      }),
    });
    assert.equal(resBadGh.status, 400);
    const badGhBody = await resBadGh.json();
    assert.equal(badGhBody.field, 'githubUsername');
    assert.match(badGhBody.error, /github\.com/i);

    // 6. Future DOB returns HTTP 400 with field: 'dob' and NOT 500
    const resFutureDob = await fetch(`${base}/api/auth/profile`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${session1}`,
      },
      body: JSON.stringify({
        dob: '2099-01-01',
      }),
    });
    assert.equal(resFutureDob.status, 400);
    const futureDobBody = await resFutureDob.json();
    assert.equal(futureDobBody.field, 'dob');
    assert.match(futureDobBody.error, /future/i);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve)).catch(() => {});
    process.env.CODESENTINEL_USERS_FILE = prevUsersFile;
    process.env.CODESENTINEL_SESSIONS_FILE = prevSessionsFile;
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
});
