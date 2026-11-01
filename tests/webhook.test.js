import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyGitHubSignature, getPRMetadata } from '../src/webhook.js';

test('HMAC matches official GitHub verification vector', () => {
  assert.equal(verifyGitHubSignature(Buffer.from('Hello, World!'),
    'sha256=757107ea0eb2509fc211221cce984b8a37570b6d7586c22c46f4379c8b043e17',
    "It's a Secret to Everybody"), true);
});
test('rejects altered, absent, malformed, or mismatched signed body', () => {
  const s = 'sha256=757107ea0eb2509fc211221cce984b8a37570b6d7586c22c46f4379c8b043e17';
  assert.equal(verifyGitHubSignature(Buffer.from('Hello, World?'), s, "It's a Secret to Everybody"), false);
  assert.equal(verifyGitHubSignature(Buffer.from('Hello, World!'), undefined, "It's a Secret to Everybody"), false);
  assert.equal(verifyGitHubSignature(Buffer.from('Hello, World!'), 'sha256=bad', "It's a Secret to Everybody"), false);
  assert.equal(verifyGitHubSignature(Buffer.from('Hello, World!'), s, ''), false);
});
test('extracts only selected pull-request actions with valid revision metadata', () => {
  const p = { action: 'opened', repository: { id: 2, full_name: 'local/test' },
    pull_request: { number: 10, head: { sha: 'a'.repeat(40) }, base: { sha: 'b'.repeat(40) } } };
  let parsed = getPRMetadata('pull_request', Buffer.from(JSON.stringify(p)));
  assert.equal(parsed.accepted, true);
  assert.equal(parsed.prNumber, 10);
  assert.equal(getPRMetadata('issues', Buffer.from(JSON.stringify(p))).accepted, false);
  p.action = 'closed';
  assert.equal(getPRMetadata('pull_request', Buffer.from(JSON.stringify(p))).accepted, false);
  p.action = 'opened'; p.pull_request.head.sha = 'invalid';
  assert.equal(getPRMetadata('pull_request', Buffer.from(JSON.stringify(p))).accepted, false);
  assert.equal(getPRMetadata('pull_request', Buffer.from('{bad')).reason, 'invalid_json');
});
