import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSemgrepReport, scanDemoFixture } from '../src/scanner.js';

const output = JSON.stringify({ errors: [], results: [{check_id:'test.rule',path:'fixtures/demo/insecure_example.py',start:{line:8},extra:{severity:'ERROR',message:'Detected insecure expression'}}] });

test('Semgrep output is normalized into structured findings', () => {
  const findings = parseSemgrepReport(output);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, 'ERROR');
  assert.equal(findings[0].line, 8);
});
test('unparseable and error-bearing scanner reports never count as clean', () => {
  assert.throws(() => parseSemgrepReport('not json'));
  assert.throws(() => parseSemgrepReport(JSON.stringify({results:[],errors:[{message:'error'}]})));
  assert.throws(() => parseSemgrepReport(JSON.stringify({results:[]})));
});
test('scanner runs only pinned project fixtures with fixed arguments', async () => {
  let captured;
  const result = await scanDemoFixture({ root: '/project', execute: async (command,args,opts) => {
    captured = {command,args,opts};
    return {stdout:output,stderr:''};
  } });
  assert.equal(captured.command, 'semgrep');
  assert.equal(captured.args.at(-1), '/project/fixtures/demo');
  assert.equal(captured.opts.timeout, 30_000);
  assert.equal(result.status, 'completed');
  assert.equal(result.findings.length, 1);
});
test('missing semgrep gives a visible unavailable state, not a clean result', async () => {
  const result = await scanDemoFixture({execute: async () => {const err = new Error('not found');err.code='ENOENT';throw err;}});
  assert.equal(result.status, 'scanner_unavailable');
  assert.equal(result.verdict, 'execution_failed');
  assert.equal(result.findings.length, 0);
  assert.ok(result.warning.includes('not installed'));
});
test('process failure is not presented as a clean scan', async () => {
  const result = await scanDemoFixture({execute: async () => {const err = new Error('failed');err.code=2;err.stdout='';throw err;}});
  assert.equal(result.status, 'scanner_failed');
  assert.equal(result.verdict, 'execution_failed');
  assert.notEqual(result.verdict, 'clean');
  assert.ok(result.warning.includes('failed'));
});
test('regression: safe fixture scan yields completed clean verdict with 0 findings', async () => {
  const cleanOutput = JSON.stringify({ errors: [], results: [] });
  let captured;
  const result = await scanDemoFixture({
    root: '/project',
    target: 'safe',
    execute: async (command, args, opts) => {
      captured = { command, args, opts };
      return { stdout: cleanOutput, stderr: '' };
    },
  });
  assert.equal(captured.command, 'semgrep');
  assert.ok(captured.args.at(-1).endsWith('safe_example.py'));
  assert.equal(result.status, 'completed');
  assert.equal(result.verdict, 'clean');
  assert.equal(result.findings.length, 0);
  assert.equal(result.warning, null);
});
test('regression: vulnerable fixture scan yields completed vulnerabilities_detected verdict', async () => {
  let captured;
  const result = await scanDemoFixture({
    root: '/project',
    target: 'insecure',
    execute: async (command, args, opts) => {
      captured = { command, args, opts };
      return { stdout: output, stderr: '' };
    },
  });
  assert.ok(captured.args.at(-1).endsWith('insecure_example.py'));
  assert.equal(result.status, 'completed');
  assert.equal(result.verdict, 'vulnerabilities_detected');
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].line, 8);
});

