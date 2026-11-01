import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { FileStore } from '../src/store.js';
import {
  createUser,
  updateUser,
  createSession,
  deleteSession,
  getSessionUser,
  revokeAllUserSessions,
  revokeOtherSessions,
  findUserById,
  Roles,
} from '../src/auth.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';

async function setupTestServer() {
  const tmp = await mkdtemp(path.join(tmpdir(), 'cs-sec-test-'));
  const usersFile = path.join(tmp, 'users.json');
  const sessionsFile = path.join(tmp, 'sessions.json');
  const allowlistFile = path.join(tmp, 'allowlist.json');

  process.env.CODESENTINEL_USERS_FILE = usersFile;
  process.env.CODESENTINEL_SESSIONS_FILE = sessionsFile;

  const app = createApp({
    store: new FileStore(tmp),
    scan: async () => ({ status: 'completed', findings: [], warning: null }),
    env: {
      NODE_ENV: 'test',
      ALLOWED_REPOS: 'local/controlled-fixture',
    },
  });

  app.listen(0, '127.0.0.1');
  await once(app, 'listening');
  const port = app.address().port;
  const base = `http://127.0.0.1:${port}`;

  return {
    base,
    cleanup: async () => {
      await new Promise(r => app.close(r));
      await rm(tmp, { recursive: true, force: true }).catch(() => {});
      delete process.env.CODESENTINEL_USERS_FILE;
      delete process.env.CODESENTINEL_SESSIONS_FILE;
    },
  };
}

test('Point 4: Username uniqueness under concurrent creation and profile updates', async () => {
  const { base, cleanup } = await setupTestServer();
  try {
    // 1. Initial Owner
    const owner = await createUser({
      name: 'Owner User',
      username: 'owner.user',
      email: 'owner@test.local',
      password: 'InitialOwnerPass123!',
      role: Roles.OWNER,
    });
    assert.ok(owner);

    // 2. Concurrently attempt to create 5 users with identical username 'target.handle'
    const targetHandle = 'target.handle';
    const creationAttempts = Array.from({ length: 5 }, (_, i) =>
      createUser({
        name: `Candidate ${i}`,
        username: targetHandle,
        email: `cand${i}@test.local`,
        password: 'ValidPassword123!',
        role: Roles.USER,
      }).then(
        u => ({ ok: true, user: u }),
        err => ({ ok: false, status: err.status, message: err.message })
      )
    );

    const creationResults = await Promise.all(creationAttempts);
    const successes = creationResults.filter(r => r.ok);
    const conflicts = creationResults.filter(r => !r.ok && r.status === 409);

    assert.equal(successes.length, 1, 'Exactly one concurrent user creation with the same username must succeed');
    assert.equal(conflicts.length, 4, 'All duplicate username creations must be rejected with HTTP 409');

    // 3. Concurrently attempt to update profiles to the same username
    const userA = await createUser({
      name: 'User A',
      username: 'user.alpha',
      email: 'usera@test.local',
      password: 'ValidPassword123!',
      role: Roles.USER,
    });
    const userB = await createUser({
      name: 'User B',
      username: 'user.bravo',
      email: 'userb@test.local',
      password: 'ValidPassword123!',
      role: Roles.USER,
    });

    const updateAttempts = [
      updateUser(userA.id, { username: 'contested.handle' }).then(
        u => ({ ok: true, id: userA.id }),
        err => ({ ok: false, id: userA.id, status: err.status })
      ),
      updateUser(userB.id, { username: 'contested.handle' }).then(
        u => ({ ok: true, id: userB.id }),
        err => ({ ok: false, id: userB.id, status: err.status })
      ),
    ];

    const updateResults = await Promise.all(updateAttempts);
    const updateSuccesses = updateResults.filter(r => r.ok);
    const updateConflicts = updateResults.filter(r => !r.ok && r.status === 409);

    assert.equal(updateSuccesses.length, 1, 'Exactly one concurrent username update must succeed');
    assert.equal(updateConflicts.length, 1, 'Concurrent competing username update must be rejected with 409');
  } finally {
    await cleanup();
  }
});

test('Point 3: mustChangePassword: true strictly blocks protected routes until password rotation', async () => {
  const { base, cleanup } = await setupTestServer();
  try {
    const owner = await createUser({
      name: 'System Owner',
      username: 'system.owner',
      email: 'owner@sec.local',
      password: 'OwnerPassword123!',
      role: Roles.OWNER,
    });

    // Create user with mustChangePassword = true
    const member = await createUser({
      name: 'New Member',
      username: 'new.member',
      email: 'member@sec.local',
      password: 'TempPassword123!',
      role: Roles.USER,
      mustChangePassword: true,
    });
    assert.equal(member.mustChangePassword, true);

    const memberToken = await createSession(member.id);
    const authHeaders = {
      authorization: `Bearer ${memberToken}`,
      'content-type': 'application/json',
    };

    // A. Must be blocked from normal scans endpoint
    const scansRes = await fetch(`${base}/api/scans`, { headers: authHeaders });
    assert.equal(scansRes.status, 403, 'Must be blocked from GET /api/scans');
    const scansBody = await scansRes.json();
    assert.equal(scansBody.code, 'MUST_CHANGE_PASSWORD');

    // B. Must be blocked from findings endpoint
    const findingsRes = await fetch(`${base}/api/findings`, { headers: authHeaders });
    assert.equal(findingsRes.status, 403, 'Must be blocked from GET /api/findings');
    const findingsBody = await findingsRes.json();
    assert.equal(findingsBody.code, 'MUST_CHANGE_PASSWORD');

    // C. Must be blocked from admin endpoints
    const adminRes = await fetch(`${base}/api/admin/users`, { headers: authHeaders });
    assert.equal(adminRes.status, 403, 'Must be blocked from admin routes');

    // D. Must be blocked from demo scan triggers
    const demoRes = await fetch(`${base}/api/demo/scan`, {
      method: 'POST',
      headers: authHeaders,
    });
    assert.equal(demoRes.status, 403, 'Must be blocked from triggering scans');

    // E. CAN access GET /api/auth/me to verify status
    const meRes = await fetch(`${base}/api/auth/me`, { headers: authHeaders });
    assert.equal(meRes.status, 200, 'Must be permitted to fetch own profile status');
    const meBody = await meRes.json();
    assert.equal(meBody.user.mustChangePassword, true);

    // F. Cannot update bio without rotating password
    const updateBioRes = await fetch(`${base}/api/auth/profile`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ bio: 'Hacker' }),
    });
    assert.equal(updateBioRes.status, 403, 'Must not update bio without setting permanent password');

    // G. Successfully rotates password
    const rotateRes = await fetch(`${base}/api/auth/profile`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        currentPassword: 'TempPassword123!',
        newPassword: 'PermanentPassword2026!Sec',
      }),
    });
    assert.equal(rotateRes.status, 200, 'Password rotation must succeed');
    const rotateBody = await rotateRes.json();
    assert.equal(rotateBody.user.mustChangePassword, false);

    // H. Now normal access to /api/scans is unlocked!
    const unlockedScansRes = await fetch(`${base}/api/scans`, { headers: authHeaders });
    assert.equal(unlockedScansRes.status, 200, 'Protected routes must be unlocked after password rotation');
  } finally {
    await cleanup();
  }
});

test('Point 5: Comprehensive Backend Authorization Matrix', async () => {
  const { base, cleanup } = await setupTestServer();
  try {
    const owner = await createUser({
      name: 'Primary Owner',
      username: 'primary.owner',
      email: 'owner@corp.local',
      password: 'OwnerPassword123!',
      role: Roles.OWNER,
    });
    await updateUser(owner.id, { dob: '1995-10-20' });

    const admin = await createUser({
      name: 'Admin User',
      username: 'admin.user',
      email: 'admin@corp.local',
      password: 'AdminPassword123!',
      role: Roles.ADMIN,
    });

    const member = await createUser({
      name: 'Member User',
      username: 'member.user',
      email: 'member@corp.local',
      password: 'MemberPassword123!',
      role: Roles.USER,
    });

    const ownerToken = await createSession(owner.id);
    const adminToken = await createSession(admin.id);
    const memberToken = await createSession(member.id);

    const ownerHeaders = { authorization: `Bearer ${ownerToken}`, 'content-type': 'application/json' };
    const adminHeaders = { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' };
    const memberHeaders = { authorization: `Bearer ${memberToken}`, 'content-type': 'application/json' };

    // 1. Profile Privacy: DOB returned only to self on /api/auth/me
    const ownerMe = await (await fetch(`${base}/api/auth/me`, { headers: ownerHeaders })).json();
    assert.equal(ownerMe.user.dob, '1995-10-20', 'Own profile includes DOB');

    // 2. Profile Privacy: /api/admin/users strips DOB and passwordHash
    const dirRes = await (await fetch(`${base}/api/admin/users`, { headers: adminHeaders })).json();
    for (const u of dirRes.users) {
      assert.equal(u.dob, undefined, 'DOB must be stripped in directory listing');
      assert.equal(u.passwordHash, undefined, 'passwordHash must be stripped');
    }

    // 3. Member cannot access /api/admin/users
    const memberDirRes = await fetch(`${base}/api/admin/users`, { headers: memberHeaders });
    assert.equal(memberDirRes.status, 403, 'Member must receive 403 on admin user directory');

    // 4. Member cannot view or modify allowlist
    const memberGetAllow = await fetch(`${base}/api/admin/allowlist`, { headers: memberHeaders });
    assert.equal(memberGetAllow.status, 403, 'Member must receive 403 on GET allowlist');

    const memberPostAllow = await fetch(`${base}/api/admin/allowlist`, {
      method: 'POST',
      headers: memberHeaders,
      body: JSON.stringify({ repository: 'unauthorized/repo' }),
    });
    assert.equal(memberPostAllow.status, 403, 'Member must receive 403 on POST allowlist');

    // 5. Admin cannot provision an Owner account
    const adminCreateOwner = await fetch(`${base}/api/admin/users`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        name: 'Rogue Owner',
        email: 'rogue@corp.local',
        username: 'rogue.owner',
        role: Roles.OWNER,
      }),
    });
    assert.equal(adminCreateOwner.status, 403, 'Admin cannot provision Owner accounts');

    // 6. Admin cannot reset Owner password
    const adminResetOwner = await fetch(`${base}/api/admin/users/${owner.id}/reset-password`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ password: 'HackedPassword123!' }),
    });
    assert.equal(adminResetOwner.status, 403, 'Admin cannot reset Owner password');

    // 7. Admin cannot change roles (Owner-only endpoint)
    const adminChangeRole = await fetch(`${base}/api/admin/users/${member.id}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ role: Roles.ADMIN }),
    });
    assert.equal(adminChangeRole.status, 403, 'Admin cannot change user roles');

    // 8. Owner CAN promote member to Admin
    const ownerPromote = await fetch(`${base}/api/admin/users/${member.id}`, {
      method: 'PATCH',
      headers: ownerHeaders,
      body: JSON.stringify({ role: Roles.ADMIN }),
    });
    assert.equal(ownerPromote.status, 200, 'Owner can change user roles');
    const promotedBody = await ownerPromote.json();
    assert.equal(promotedBody.user.role, Roles.ADMIN);

    // 9. Cannot demote the last System Owner
    const demoteOwner = await fetch(`${base}/api/admin/users/${owner.id}`, {
      method: 'PATCH',
      headers: ownerHeaders,
      body: JSON.stringify({ role: Roles.ADMIN }),
    });
    assert.equal(demoteOwner.status, 400, 'Cannot demote the last System Owner');

    // 10. Avatar endpoint: non-existent user gives 404, unauthenticated gives 401
    const unauthAvatar = await fetch(`${base}/api/users/${owner.id}/avatar`);
    assert.equal(unauthAvatar.status, 401, 'Unauthenticated avatar fetch gives 401');

    const fakeAvatar = await fetch(`${base}/api/users/0000000000000000/avatar`, { headers: ownerHeaders });
    assert.equal(fakeAvatar.status, 404, 'Non-existent user avatar gives 404');
  } finally {
    await cleanup();
  }
});

test('Point 2: Session invalidation upon password rotation', async () => {
  const { base, cleanup } = await setupTestServer();
  try {
    const owner = await createUser({
      name: 'Rotation Owner',
      username: 'rot.owner',
      email: 'rot@test.local',
      password: 'OldPassword123!',
      role: Roles.OWNER,
    });

    // Create 3 active sessions across different devices
    const session1 = await createSession(owner.id);
    const session2 = await createSession(owner.id);
    const session3 = await createSession(owner.id);

    // Verify all 3 sessions are valid initially
    assert.ok(await getSessionUser(session1));
    assert.ok(await getSessionUser(session2));
    assert.ok(await getSessionUser(session3));

    // Rotate password via PATCH /api/auth/profile using session1
    const rotateRes = await fetch(`${base}/api/auth/profile`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${session1}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        currentPassword: 'OldPassword123!',
        newPassword: 'BrandNewPassword2026!',
      }),
    });
    assert.equal(rotateRes.status, 200);

    // Session 1 (active rotating device) is preserved
    assert.ok(await getSessionUser(session1), 'Active device session should remain authenticated');

    // Sessions 2 and 3 are invalidated!
    assert.equal(await getSessionUser(session2), null, 'Other device session 2 must be revoked');
    assert.equal(await getSessionUser(session3), null, 'Other device session 3 must be revoked');

    // When administrative reset or CLI reset is performed: ALL sessions are revoked
    await revokeAllUserSessions(owner.id);
    assert.equal(await getSessionUser(session1), null, 'All sessions revoked after administrative reset');
  } finally {
    await cleanup();
  }
});
