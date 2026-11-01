import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

export class FileStore {
  constructor(directory) {
    this.dir = directory;
    this.file = path.join(directory, 'scans.json');
    this.queue = Promise.resolve();
  }
  async all() {
    try {
      const data = JSON.parse(await readFile(this.file, 'utf8'));
      if (!Array.isArray(data)) throw new Error('Invalid scan store format');
      return data;
    } catch (err) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
  }
  async add(entry) { return (await this._insert(entry)).item; }
  async addUniqueScan(entry) {
    if (!entry.scanKey) throw new Error('Unique scan insertion requires scanKey');
    return this._insert(entry, { uniqueScanKey: true });
  }
  async update(id, patch) {
    const next = this.queue.then(async () => {
      const old = await this.all();
      const index = old.findIndex(x => x.id === id);
      if (index < 0) throw new Error('Scan record not found');
      const item = {...old[index],...patch,id};
      old[index] = item;
      await this._write(old);
      return item;
    });
    this.queue = next.then(() => undefined, () => undefined);
    return next;
  }
  async _write(items) {
    await mkdir(this.dir, {recursive:true});
    const tmp = `${this.file}.${randomUUID()}.tmp`;
    await writeFile(tmp,JSON.stringify(items,null,2),{mode:0o600});
    await rename(tmp,this.file);
  }
  async addUniqueDelivery(entry) {
    if (!entry.deliveryId) throw new Error('Unique webhook insertion requires deliveryId');
    return this._insert(entry, { uniqueDelivery: true });
  }
  async _insert(entry, { uniqueDelivery = false, uniqueScanKey = false } = {}) {
    // Serializing read-check-write keeps duplicate deliveries atomic within this process.
    const next = this.queue.then(async () => {
      await mkdir(this.dir, { recursive: true });
      const old = await this.all();
      if (uniqueDelivery) {
        const existing = old.find(item => item.deliveryId === entry.deliveryId);
        if (existing) return { duplicate: true, item: existing };
      }
      if (uniqueScanKey) {
        const existing = old.find(item => item.scanKey === entry.scanKey);
        if (existing) return {duplicate:true,item:existing};
      }
      const item = { id: randomUUID(), at: new Date().toISOString(), ...entry };
      const updated = [item, ...old].slice(0, 200);
      await this._write(updated);
      return { duplicate: false, item };
    });
    this.queue = next.then(() => undefined, () => undefined);
    return next;
  }
}
