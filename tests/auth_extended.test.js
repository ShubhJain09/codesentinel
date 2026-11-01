import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';

process.env.CODESENTINEL_USERS_FILE = path.join(tmpdir(), `codesentinel-test-users-${randomUUID()}.json`);
process.env.CODESENTINEL_SESSIONS_FILE = path.join(tmpdir(), `codesentinel-test-sessions-${randomUUID()}.json`);

import {
  createUser, authenticateUser, createSession, getSessionUser,
  disableUser, enableUser, adminResetPassword, revokeOtherSessions,
  generateTemporaryPassword, validateUsername, Roles
} from '../src/auth.js';

test('auth extended: supports custom username and authenticates via username or email', async () => {
  const username = `alice_${randomUUID().slice(0, 8)}`;
  const email = `${username}@example.com`;
  const user = await createUser({
    name: 'Alice Security',
    username,
    email,
    password: 'Password123!',
    role: Roles.USER,
  });

  assert.equal(user.username, username.toLowerCase());
  assert.equal(user.email, email.toLowerCase());
  assert.equal(user.status, 'active');

  // Authenticate by username
  const authByUsername = await authenticateUser(username, 'Password123!');
  assert.ok(authByUsername, 'Should authenticate using username');
  assert.equal(authByUsername.id, user.id);

  // Authenticate by email
  const authByEmail = await authenticateUser(email, 'Password123!');
  assert.ok(authByEmail, 'Should authenticate using email');
  assert.equal(authByEmail.id, user.id);

  // Authenticate with wrong password
  const badAuth = await authenticateUser(username, 'WrongPassword!');
  assert.equal(badAuth, null);
});

test('auth extended: rejects duplicate username and reserved usernames', async () => {
  const uname = `bob_${randomUUID().slice(0, 8)}`;
  await createUser({
    name: 'Bob Operator',
    username: uname,
    email: `bob_${randomUUID().slice(0, 8)}@example.com`,
    password: 'Password123!',
  });

  // Duplicate username
  await assert.rejects(
    () => createUser({
      name: 'Bob Clone',
      username: uname,
      email: `bob_clone_${randomUUID().slice(0, 8)}@example.com`,
      password: 'Password123!',
    }),
    { message: 'Username already taken', status: 409 }
  );

  // Reserved username
  assert.equal(validateUsername('admin'), false);
  assert.equal(validateUsername('root'), false);
  assert.equal(validateUsername('system'), false);
  assert.equal(validateUsername('owner'), false);
  assert.equal(validateUsername('valid_name-123'), true);
});

test('auth extended: account disabling prevents login and revokes active sessions', async () => {
  const uname = `charlie_${randomUUID().slice(0, 8)}`;
  const email = `${uname}@example.com`;
  const user = await createUser({
    name: 'Charlie Dev',
    username: uname,
    email,
    password: 'Password123!',
  });

  const token = await createSession(user.id);
  const activeUser = await getSessionUser(token);
  assert.ok(activeUser);

  // Disable account
  const disabled = await disableUser(user.id);
  assert.equal(disabled.status, 'disabled');

  // Active session must be invalid
  const sessionAfterDisable = await getSessionUser(token);
  assert.equal(sessionAfterDisable, null);

  // Login attempt must throw 403
  await assert.rejects(
    () => authenticateUser(uname, 'Password123!'),
    { status: 403 }
  );

  // Re-enable account
  const reenabled = await enableUser(user.id);
  assert.equal(reenabled.status, 'active');

  const authReenabled = await authenticateUser(uname, 'Password123!');
  assert.ok(authReenabled);
});

test('auth extended: temporary password generation and admin reset password', async () => {
  const temp = generateTemporaryPassword();
  assert.equal(typeof temp, 'string');
  assert.ok(temp.length >= 16);

  const uname = `dave_${randomUUID().slice(0, 8)}`;
  const user = await createUser({
    name: 'Dave Admin',
    username: uname,
    email: `${uname}@example.com`,
    password: 'OldPassword123!',
  });

  const token = await createSession(user.id);
  assert.ok(await getSessionUser(token));

  // Admin resets password
  const newTemp = generateTemporaryPassword();
  const resetUser = await adminResetPassword(user.id, newTemp, true);
  assert.equal(resetUser.mustChangePassword, true);

  // Old session revoked
  assert.equal(await getSessionUser(token), null);

  // Old password rejected
  assert.equal(await authenticateUser(uname, 'OldPassword123!'), null);

  // New password accepted and flags mustChangePassword
  const authNew = await authenticateUser(uname, newTemp);
  assert.ok(authNew);
  assert.equal(authNew.mustChangePassword, true);
});

test('auth extended: revokeOtherSessions preserves current token and terminates others', async () => {
  const uname = `eve_${randomUUID().slice(0, 8)}`;
  const user = await createUser({
    name: 'Eve Tester',
    username: uname,
    email: `${uname}@example.com`,
    password: 'Password123!',
  });

  const token1 = await createSession(user.id);
  const token2 = await createSession(user.id);

  assert.ok(await getSessionUser(token1));
  assert.ok(await getSessionUser(token2));

  // Revoke others keeping token2
  await revokeOtherSessions(user.id, token2);

  assert.equal(await getSessionUser(token1), null, 'token1 should be revoked');
  assert.ok(await getSessionUser(token2), 'token2 should remain active');
});
