#!/usr/bin/env node
/**
 * CodeSentinel Local-Only Administrative Password Reset Utility
 *
 * This script provides a safe, authorized local password reset procedure.
 * It requires direct local terminal access to the workspace and executes
 * standard PBKDF2-SHA256 (200,000 rounds) key derivation.
 *
 * Passwords should NEVER be passed as command line arguments to avoid
 * leaking in process listings or shell history. Run interactively or pipe via stdin:
 *
 * Interactive Usage:
 *   node scripts/reset_password.js [email]
 *
 * Stdin Usage:
 *   node scripts/reset_password.js [email] < secret_file
 */

import { findUserByEmail, findUserByLogin, updateUser, revokeAllUserSessions } from '../src/auth.js';
import readline from 'node:readline';

const identifier = (process.argv[2] || 'workspaceshubhjain@gmail.com').toLowerCase().trim();

function readPasswordSilently(promptText) {
  return new Promise((resolve) => {
    process.stdout.write(promptText);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      let pwd = '';
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      const onData = (ch) => {
        if (ch === '\n' || ch === '\r' || ch === '\u0004') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(pwd);
        } else if (ch === '\u0003') {
          process.exit(130);
        } else if (ch === '\u0008' || ch === '\x7f') {
          if (pwd.length > 0) pwd = pwd.slice(0, -1);
        } else {
          pwd += ch;
        }
      };
      process.stdin.on('data', onData);
    } else {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question('', (ans) => {
        rl.close();
        resolve(ans.trim());
      });
    }
  });
}

async function main() {
  const user = (await findUserByEmail(identifier)) || (await findUserByLogin(identifier));
  if (!user) {
    console.error(`\x1b[31m[Error] User "${identifier}" not found in data/users.json.\x1b[0m`);
    process.exit(1);
  }

  // If a 3rd CLI argument was passed, warn the operator
  if (process.argv[3]) {
    console.warn('\x1b[33m[Warning] Passing passwords via CLI arguments can leak into shell history and process tables.\x1b[0m');
  }

  const newPassword = (process.argv[3] || (await readPasswordSilently(`Enter new password for ${user.email} (input hidden, min 8 chars): `))).trim();

  if (!newPassword || newPassword.length < 8 || newPassword.length > 128) {
    console.error('\x1b[31m[Error] Password must be between 8 and 128 characters.\x1b[0m');
    process.exit(1);
  }

  console.log(`\n[Security] Found account: ${user.name} (${user.email})`);
  console.log(`[Security] Current Role: ${user.role} (Preserved)`);
  console.log(`[Security] Re-keying account with salted PBKDF2-SHA256 (200,000 iterations)...`);

  await updateUser(user.id, { password: newPassword, mustChangePassword: false });
  await revokeAllUserSessions(user.id);

  console.log(`\x1b[32m[Success] Password successfully updated for ${user.email}.\x1b[0m`);
  console.log(`[Security] All prior sessions revoked.`);
  console.log(`[Security] You can now log in at http://localhost:4173/login`);
}

main().catch((err) => {
  console.error('\x1b[31m[Error]\x1b[0m', err);
  process.exit(1);
});
