/* Lekka obsługa IndexedDB (zamiast Dexie): baza „klaps” z magazynami projektów i historii wersji.
   Wersja 20 jest zgodna z bazą utworzoną wcześniej przez Dexie (wersja 10, magazyn „projects” z kluczem „id”). */
export const IDB_NAME = 'klaps';
const IDB_VERSION = 20;

const req = <T,>(r: IDBRequest<T>) => new Promise<T>((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export function openIdb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(IDB_NAME, IDB_VERSION);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('snapshots')) db.createObjectStore('snapshots', { keyPath: 'id' }).createIndex('pid', 'pid');
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.onblocked = () => rej(new Error('IndexedDB zablokowana przez inną kartę'));
  });
}

/** prosty magazyn klucz → rekord */
export function idbTable<R extends { id: string }>(db: IDBDatabase, name: string) {
  const store = (mode: IDBTransactionMode) => db.transaction(name, mode).objectStore(name);
  return {
    all: () => req(store('readonly').getAll()) as Promise<R[]>,
    get: (id: string) => req(store('readonly').get(id)) as Promise<R | undefined>,
    put: async (row: R) => { await req(store('readwrite').put(row)); },
    del: async (id: string) => { await req(store('readwrite').delete(id)); },
    byIndex: (index: string, key: IDBValidKey) => req(store('readonly').index(index).getAll(key)) as Promise<R[]>,
  };
}
