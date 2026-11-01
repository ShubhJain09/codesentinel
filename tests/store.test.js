import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { FileStore } from '../src/store.js';

test('concurrent records are preserved and reloaded from disk', async () => {
  const temp = await mkdtemp(path.join(tmpdir(),'codesentinel-store-'));
  try {
    const store = new FileStore(temp);
    await Promise.all(Array.from({length: 12}, (_, i) => store.add({status: 'demo', n:i})));
    assert.equal((await store.all()).length,12);
    assert.equal(new Set((await store.all()).map(x=>x.id)).size,12);
    assert.equal((await new FileStore(temp).all()).length,12);
  } finally {await rm(temp,{force:true,recursive:true});}
});

test('duplicate webhook deliveries are deduplicated atomically in the local file store', async () => {
  const temp = await mkdtemp(path.join(tmpdir(),'codesentinel-delivery-'));
  try {
    const store = new FileStore(temp);
    const results = await Promise.all(Array.from({ length: 7 }, () => store.addUniqueDelivery({ deliveryId: 'same-delivery-id', source:'github-webhook' })));
    assert.equal(results.filter(x => !x.duplicate).length, 1);
    assert.equal((await store.all()).length, 1);
  } finally {await rm(temp,{force:true,recursive:true});}
});
