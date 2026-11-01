import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHmac, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { FileStore } from '../src/store.js';

test('end-to-end local server: demo scanner, static UI, signed webhook, and deduplication', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'codesentinel-http-'));
  const app = createApp({ store: new FileStore(dir), webhookSecret:'local-test-secret',
    scan: async () => ({ status:'completed', findings:[{id:'demo',rule:'r1',path:'test.py',line:1,severity:'ERROR',message:'test'}], warning:null }),
    env:{ALLOWED_REPOS:'org/demo'},pipeline:{enqueue:()=>{}} });
  app.listen(0,'127.0.0.1');
  await once(app,'listening');
  const base = `http://127.0.0.1:${app.address().port}`;
  try {
    let r = await fetch(`${base}/api/health`);assert.equal(r.status,200);
    r = await fetch(`${base}/`);assert.equal(r.status,200);assert.match(await r.text(),/Security, before merge/);
    r = await fetch(`${base}/api/demo/scan`,{method:'POST'});assert.equal(r.status,200);
    assert.equal((await r.json()).item.status,'completed');
    r = await fetch(`${base}/api/demo/scan`,{method:'POST',headers:{origin:'http://malicious.invalid'}});assert.equal(r.status,403);
    const p = JSON.stringify({action:'opened',repository:{id:1234,full_name:'org/demo'},pull_request:{number:12,head:{sha:'a'.repeat(40)},base:{sha:'b'.repeat(40)}}});
    const deliveryId=randomUUID();
    const headers={'content-type':'application/json','x-github-event':'pull_request',
      'x-github-delivery':deliveryId,'x-hub-signature-256':`sha256=${createHmac('sha256','local-test-secret').update(p).digest('hex')}`};
    r=await fetch(`${base}/webhooks/github`,{method:'POST',headers:{...headers,'x-hub-signature-256':'sha256='+('0'.repeat(64))},body:p});assert.equal(r.status,401);
    r=await fetch(`${base}/webhooks/github`,{method:'POST',headers,body:p});assert.equal(r.status,202);assert.equal((await r.json()).scanStarted,true);
    r=await fetch(`${base}/webhooks/github`,{method:'POST',headers,body:p});assert.equal(r.status,200);assert.equal((await r.json()).duplicate,true);
    r=await fetch(`${base}/api/scans`);const {items}=await r.json();assert.equal(items.length,2);
    assert.equal(items[0].status,'queued');
  } finally { await new Promise(resolve=>app.close(resolve));await rm(dir,{recursive:true,force:true}); }
});
