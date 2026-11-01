import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';

process.env.CODESENTINEL_USERS_FILE = path.join(tmpdir(), `codesentinel-test-users-${randomUUID()}.json`);
process.env.CODESENTINEL_SESSIONS_FILE = path.join(tmpdir(), `codesentinel-test-sessions-${randomUUID()}.json`);

import {
  createUser, authenticateUser, createSession, getSessionUser,
  deleteSession, updateUser, findUserByEmail, Roles
} from '../src/auth.js';

test('auth: registers user, hashes password, and authenticates correctly', async () => {
  const email = `auth-test-${randomUUID()}@codesentinel.local`;
  const user = await createUser({
    name: 'Security Test Engineer',
    email,
    password: 'SecurePassword123!',
    role: Roles.USER,
  });

  assert.equal(user.email, email);
  assert.equal(user.name, 'Security Test Engineer');
  assert.equal(user.role, Roles.USER);
  assert.equal(typeof user.id, 'string');
  assert.equal(user.passwordHash, undefined, 'password hash must never be exposed');

  // Authenticate with valid credentials
  const authOk = await authenticateUser(email, 'SecurePassword123!');
  assert.ok(authOk);
  assert.equal(authOk.id, user.id);

  // Rejects invalid password
  const authBad = await authenticateUser(email, 'WrongPassword123!');
  assert.equal(authBad, null);

  // Rejects unknown user
  const authMissing = await authenticateUser('nonexistent@codesentinel.local', 'AnyPassword123!');
  assert.equal(authMissing, null);
});

test('auth: rejects duplicate email registration', async () => {
  const dupEmail = `dup-test-${randomUUID()}@codesentinel.local`;
  await createUser({
    name: 'Initial User',
    email: dupEmail,
    password: 'InitialPassword123!',
  });
  await assert.rejects(
    () => createUser({
      name: 'Duplicate Test',
      email: dupEmail,
      password: 'AnotherPassword123!',
    }),
    { message: 'Email already registered', status: 409 }
  );
});

test('auth: session lifecycle (create, fetch, expire/delete)', async () => {
  const email = `sess-test-${randomUUID()}@codesentinel.local`;
  const user = await createUser({
    name: 'Session Operator',
    email,
    password: 'SessionPassword123!',
  });

  const token = await createSession(user.id);
  assert.equal(typeof token, 'string');
  assert.equal(token.length, 64);

  const sessionUser = await getSessionUser(token);
  assert.ok(sessionUser);
  assert.equal(sessionUser.id, user.id);

  // Delete session
  await deleteSession(token);
  const deleted = await getSessionUser(token);
  assert.equal(deleted, null);
});

test('auth: profile update and password change', async () => {
  const email = `prof-test-${randomUUID()}@codesentinel.local`;
  const user = await createUser({
    name: 'Original Operator',
    email,
    password: 'OriginalPassword123!',
  });

  const updated = await updateUser(user.id, {
    name: 'Updated Security Lead',
    password: 'NewStrongPassword456!',
  });

  assert.equal(updated.name, 'Updated Security Lead');

  // Old password no longer works
  const oldAuth = await authenticateUser(email, 'OriginalPassword123!');
  assert.equal(oldAuth, null);

  // New password works
  const newAuth = await authenticateUser(email, 'NewStrongPassword456!');
  assert.ok(newAuth);
});
