import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyGitHubSignature(rawBody, signature, secret) {
  if (!Buffer.isBuffer(rawBody) || typeof secret !== 'string' || !secret ||
      typeof signature !== 'string' || !/^sha256=[0-9a-f]{64}$/.test(signature)) return false;
  const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  const a = Buffer.from(signature, 'ascii');
  const b = Buffer.from(expected, 'ascii');
  return a.length === b.length && timingSafeEqual(a, b);
}

const allowedActions = new Set(['opened', 'reopened', 'synchronize']);
const validSha = s => typeof s === 'string' && /^[0-9a-f]{40}$/.test(s);

export function getPRMetadata(event, rawBody) {
  if (event !== 'pull_request') return { accepted: false, reason: 'unsupported_event' };
  let payload;
  try { payload = JSON.parse(rawBody.toString('utf8')); }
  catch { return { accepted: false, reason: 'invalid_json' }; }
  if (!allowedActions.has(payload?.action)) return { accepted: false, reason: 'ignored_action' };
  const pr = payload?.pull_request;
  const repo = payload?.repository;
  if (!Number.isSafeInteger(pr?.number) || pr.number < 1 ||
      !Number.isSafeInteger(repo?.id) || repo.id < 1 ||
      typeof repo?.full_name !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(repo.full_name) ||
      !validSha(pr?.head?.sha) || !validSha(pr?.base?.sha)) {
    return { accepted: false, reason: 'incomplete_payload' };
  }
  return {
    accepted: true,
    project: repo.full_name,
    repositoryId: repo.id,
    prNumber: pr.number,
    headSha: pr.head.sha,
    baseSha: pr.base.sha,
    action: payload.action,
    installationId: Number.isSafeInteger(payload?.installation?.id) ? payload.installation.id : null,
  };
}
