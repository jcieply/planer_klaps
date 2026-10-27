/* Baza IndexedDB: przejście 20 → 21 tworzy magazyn opisów wersji z istniejących wersji, bez ich utraty. */
import { describe, expect, it } from 'vitest';
import { IDB_NAME, idbBatch, idbTable, openIdb } from '../../src/domain/idb';

const rq = <T,>(r: IDBRequest<T>) => new Promise<T>((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

describe('IndexedDB v21', () => {
  it('uzupełnia opisy wersji ze starej bazy (v20) i zapisuje opis z treścią razem', async () => {
    await new Promise<void>((res, rej) => {
      const o = indexedDB.open(IDB_NAME, 20);
      o.onupgradeneeded = () => { const db = o.result; db.createObjectStore('projects', { keyPath: 'id' }); db.createObjectStore('snapshots', { keyPath: 'id' }).createIndex('pid', 'pid'); };
      o.onsuccess = () => {
        const tx = o.result.transaction('snapshots', 'readwrite');
        tx.objectStore('snapshots').put({ id: 's1', pid: 'p1', at: 5, label: 'stara', auto: true, raw: { plan: 'x'.repeat(1000), script: '', media: '' } });
        tx.oncomplete = () => { o.result.close(); res(); }; tx.onerror = () => rej(tx.error);
      };
    });
    const db = await openIdb();
    const meta = idbTable<any>(db, 'snapmeta');
    const rows = await meta.byIndex('pid', 'p1');
    expect(rows).toHaveLength(1);
    expect(rows[0].label).toBe('stara');
    expect(rows[0].raw).toBeUndefined();
    // nowa wersja: opis i treść w jednej transakcji, usunięcie kasuje oba
    await idbBatch(db, [{ store: 'snapshots', put: { id: 's2', pid: 'p1', raw: { plan: 'y' } } }, { store: 'snapmeta', put: { id: 's2', pid: 'p1', label: 'nowa' } }]);
    expect((await meta.byIndex('pid', 'p1')).length).toBe(2);
    await idbBatch(db, [{ store: 'snapshots', del: 's2' }, { store: 'snapmeta', del: 's2' }]);
    expect((await meta.byIndex('pid', 'p1')).length).toBe(1);
    expect(await rq(db.transaction('snapshots').objectStore('snapshots').get('s2'))).toBeUndefined();
    db.close();
  });
});
