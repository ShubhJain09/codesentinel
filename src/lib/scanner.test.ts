import { describe, expect, it } from 'vitest';
import { findPullRequest } from '../data/fixtures';
import { RULES } from '../data/rules';
import { scanPullRequest } from './scanner';

describe('prototype rules', () => {
  for (const rule of RULES) {
    const { id } = rule;
    const { flagged: positive, ignored: negative } = rule.examples;
    it(`${id} matches its positive cases`, () => {
      for (const line of positive) expect(rule.test(line), line).not.toBeNull();
    });
    it(`${id} ignores its negative cases`, () => {
      for (const line of negative) expect(rule.test(line), line).toBeNull();
    });
  }
});

describe('sample pull requests', () => {
  it('demo-auth-service #12 yields one finding per rule, on the expected lines', () => {
    const pr = findPullRequest('demo-auth-service', 12);
    if (!pr) throw new Error('fixture missing');
    const result = scanPullRequest(pr);
    expect(result.outcome.kind).toBe('findings');
    if (result.outcome.kind !== 'findings') return;
    const summary = result.outcome.findings.map((f) => `${f.ruleId} ${f.filePath}:${f.line}`);
    expect(summary).toEqual([
      'CS-004 src/db/users.js:18',
      'CS-001 src/config/payments.js:4',
      'CS-002 src/lib/pricing.js:23',
      'CS-003 src/client/profile.js:7',
      'CS-005 src/server/session.js:26',
    ]);
  });

  it('redacts secret evidence', () => {
    const pr = findPullRequest('demo-auth-service', 12);
    if (!pr) throw new Error('fixture missing');
    const result = scanPullRequest(pr);
    if (result.outcome.kind !== 'findings') throw new Error('expected findings');
    const secret = result.outcome.findings.find((f) => f.ruleId === 'CS-001');
    expect(secret?.evidence).not.toContain('7d1e5c90a4b84f2e9c3a');
    expect(secret?.evidence).toContain('••••••');
  });

  it('billing-api #7 matches no configured rules', () => {
    const pr = findPullRequest('billing-api', 7);
    if (!pr) throw new Error('fixture missing');
    expect(scanPullRequest(pr).outcome.kind).toBe('clean');
  });

  it('docs-site #3 fails validation instead of reporting a clean scan', () => {
    const pr = findPullRequest('docs-site', 3);
    if (!pr) throw new Error('fixture missing');
    const result = scanPullRequest(pr);
    expect(result.outcome).toEqual({ kind: 'failed', reason: 'Unsupported file type: assets/architecture.bin' });
  });

  it('is repeatable', () => {
    const pr = findPullRequest('demo-auth-service', 12);
    if (!pr) throw new Error('fixture missing');
    expect(scanPullRequest(pr)).toEqual(scanPullRequest(pr));
  });
});

describe('highlight precision', () => {
  const text = (id: string, line: string) => {
    const r = RULES.find((x) => x.id === id)?.test(line);
    return r ? line.slice(r.start, r.end) : null;
  };
  it('CS-003 marks the whole assignment, not one character of it', () => {
    expect(text('CS-003', "  root.querySelector('[data-profile-bio]').innerHTML = profile.bio;")).toBe('innerHTML = profile.bio');
    expect(text('CS-003', "el.insertAdjacentHTML('beforeend', row);")).toBe("insertAdjacentHTML('beforeend', row)");
  });
  it('CS-002 marks the full evaluated call, with nested parentheses', () => {
    expect(text('CS-002', '  const rate = eval(rule.expression.replace(/subtotal/g, String(order.subtotal)));')).toBe(
      'eval(rule.expression.replace(/subtotal/g, String(order.subtotal)))',
    );
  });
});
