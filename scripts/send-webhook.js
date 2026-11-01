import { createHmac, randomUUID } from 'node:crypto';

const secret = process.env.WEBHOOK_SECRET;
if (!secret) {
  console.error('Set WEBHOOK_SECRET in BOTH server and demo script terminals first.');
  process.exit(1);
}
const payload = JSON.stringify({
  action: 'opened',
  repository: { id: 1234, full_name: 'local/controlled-test-repo' },
  pull_request: {
    number: 12,
    base: { sha: 'a'.repeat(40) },
    head: { sha: 'b'.repeat(40) },
  },
});
const signature = `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`;
const res = await fetch(`http://127.0.0.1:${process.env.PORT || '4173'}/webhooks/github`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-github-event': 'pull_request',
    'x-github-delivery': randomUUID(),
    'x-hub-signature-256': signature,
  },
  body: payload,
});
console.log(`HTTP ${res.status}: ${await res.text()}`);
