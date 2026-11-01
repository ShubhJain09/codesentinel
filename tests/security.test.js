import test from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter } from '../src/rate-limit.js';
import { scanDemoFixture } from '../src/scanner.js';
import { isSetupRequired, createUser, Roles } from '../src/auth.js';
import { randomUUID } from 'node:crypto';

test('security: rate limiter allows requests up to max and throttles on exceed', () => {
  const limiter = createRateLimiter({ windowMs: 1000, max: 3 });
  const ip = `192.0.2.${Math.floor(Math.random() * 255)}`;

  assert.equal(limiter.check(ip).allowed, true);
  assert.equal(limiter.check(ip).allowed, true);
  assert.equal(limiter.check(ip).allowed, true);

  const blocked = limiter.check(ip);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.ok(blocked.retryAfterSeconds >= 1);

  limiter.destroy();
});

test('security: scanner execution environment is purged of sensitive credentials', async () => {
  process.env.GITHUB_TOKEN = 'ghp_secretTokenThatMustNeverLeak';
  process.env.WEBHOOK_SECRET = 'superSecretWebhookKey123';
  process.env.OWNER_PASSWORD = 'superSecretPassword456';

  let capturedEnv;
  await scanDemoFixture({
    root: process.cwd(),
    execute: async (cmd, args, opts) => {
      capturedEnv = opts.env;
      return {
        stdout: JSON.stringify({ results: [], errors: [] }),
        stderr: '',
      };
    },
  });

  assert.ok(capturedEnv, 'execute should have received options with env');
  assert.equal(capturedEnv.GITHUB_TOKEN, undefined, 'GITHUB_TOKEN must not leak into scanner environment');
  assert.equal(capturedEnv.WEBHOOK_SECRET, undefined, 'WEBHOOK_SECRET must not leak into scanner environment');
  assert.equal(capturedEnv.OWNER_PASSWORD, undefined, 'OWNER_PASSWORD must not leak into scanner environment');
  assert.equal(capturedEnv.SEMGREP_SEND_METRICS, 'off');
  assert.equal(capturedEnv.SEMGREP_ENABLE_VERSION_CHECK, '0');

  delete process.env.GITHUB_TOKEN;
  delete process.env.WEBHOOK_SECRET;
  delete process.env.OWNER_PASSWORD;
});

test('security: first registered account receives Owner role if user count is zero', async () => {
  const { tmpdir } = await import('node:os');
  const path = await import('node:path');
  const prevUsersFile = process.env.CODESENTINEL_USERS_FILE;
  process.env.CODESENTINEL_USERS_FILE = path.join(tmpdir(), `codesentinel-empty-users-${randomUUID()}.json`);

  try {
    assert.equal(await isSetupRequired(), true);

    const email1 = `first-owner-${randomUUID()}@codesentinel.local`;
    const firstUser = await createUser({
      name: 'Initial System Owner',
      email: email1,
      password: 'SecureOwnerPassword123!',
    });
    assert.equal(firstUser.email, email1);
    assert.equal(firstUser.role, Roles.OWNER, 'First registered user must automatically receive the Owner role');

    // Subsequent users without explicit role should receive USER role
    const email2 = `staff-dev-${randomUUID()}@codesentinel.local`;
    const secondUser = await createUser({
      name: 'Staff Developer',
      email: email2,
      password: 'SecureDevPassword123!',
    });
    assert.equal(secondUser.role, Roles.USER, 'Subsequent user must default to the User role');

    // Attempting to demote the only owner should be rejected
    const { updateUser, deleteUser } = await import('../src/auth.js');
    await assert.rejects(
      () => updateUser(firstUser.id, { role: Roles.USER }),
      { message: 'Cannot demote or remove the last System Owner', status: 400 }
    );

    // Attempting to delete the only owner should be rejected
    await assert.rejects(
      () => deleteUser(firstUser.id),
      { message: 'Cannot delete the last System Owner', status: 400 }
    );
  } finally {
    if (prevUsersFile) process.env.CODESENTINEL_USERS_FILE = prevUsersFile;
    else delete process.env.CODESENTINEL_USERS_FILE;
  }
});
