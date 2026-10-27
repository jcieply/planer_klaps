/* Dekompresja DEFLATE (raw) w czystym JS – zapas dla przeglądarek bez DecompressionStream (np. Safari < 16.4).
   Na podstawie tiny-inflate (Devon Govett, licencja MIT), z rosnącym buforem wyjściowym. */

class Tree { table = new Uint16Array(16); trans = new Uint16Array(288); }
interface D { src: Uint8Array; si: number; tag: number; bc: number; dest: Uint8Array; dl: number }

const sltree = new Tree(), sdtree = new Tree();
const lengthBits = new Uint8Array(30), lengthBase = new Uint16Array(30);
const distBits = new Uint8Array(30), distBase = new Uint16Array(30);
const clcidx = new Uint8Array([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
const codeTree = new Tree();
const lengths = new Uint8Array(288 + 32);
const offs = new Uint16Array(16);

function buildBitsBase(bits: Uint8Array, base: Uint16Array, delta: number, first: number) {
  for (let i = 0; i < delta; ++i) bits[i] = 0;
  for (let i = 0; i < 30 - delta; ++i) bits[i + delta] = (i / delta) | 0;
  for (let sum = first, i = 0; i < 30; ++i) { base[i] = sum; sum += 1 << bits[i]; }
}
function buildFixedTrees(lt: Tree, dt: Tree) {
  for (let i = 0; i < 7; ++i) lt.table[i] = 0;
  lt.table[7] = 24; lt.table[8] = 152; lt.table[9] = 112;
  for (let i = 0; i < 24; ++i) lt.trans[i] = 256 + i;
  for (let i = 0; i < 144; ++i) lt.trans[24 + i] = i;
  for (let i = 0; i < 8; ++i) lt.trans[24 + 144 + i] = 280 + i;
  for (let i = 0; i < 112; ++i) lt.trans[24 + 144 + 8 + i] = 144 + i;
  for (let i = 0; i < 5; ++i) dt.table[i] = 0;
  dt.table[5] = 32;
  for (let i = 0; i < 32; ++i) dt.trans[i] = i;
}
function buildTree(t: Tree, lens: Uint8Array, off: number, num: number) {
  for (let i = 0; i < 16; ++i) t.table[i] = 0;
  for (let i = 0; i < num; ++i) t.table[lens[off + i]]++;
  t.table[0] = 0;
  for (let sum = 0, i = 0; i < 16; ++i) { offs[i] = sum; sum += t.table[i]; }
  for (let i = 0; i < num; ++i) if (lens[off + i]) t.trans[offs[lens[off + i]]++] = i;
}
function getBit(d: D) {
  if (!d.bc--) { d.tag = d.src[d.si++] | 0; d.bc = 7; }
  const bit = d.tag & 1;
  d.tag >>>= 1;
  return bit;
}
function readBits(d: D, num: number, base: number) {
  if (!num) return base;
  while (d.bc < 24) { d.tag |= (d.src[d.si++] | 0) << d.bc; d.bc += 8; }
  const val = d.tag & (0xffff >>> (16 - num));
  d.tag >>>= num; d.bc -= num;
  return val + base;
}
function decodeSymbol(d: D, t: Tree) {
  while (d.bc < 24) { d.tag |= (d.src[d.si++] | 0) << d.bc; d.bc += 8; }
  let sum = 0, cur = 0, len = 0, tag = d.tag;
  do { cur = 2 * cur + (tag & 1); tag >>>= 1; ++len; sum += t.table[len]; cur -= t.table[len]; } while (cur >= 0);
  d.tag = tag; d.bc -= len;
  return t.trans[sum + cur];
}
function decodeTrees(d: D, lt: Tree, dt: Tree) {
  const hlit = readBits(d, 5, 257), hdist = readBits(d, 5, 1), hclen = readBits(d, 4, 4);
  for (let i = 0; i < 19; ++i) lengths[i] = 0;
  for (let i = 0; i < hclen; ++i) lengths[clcidx[i]] = readBits(d, 3, 0);
  buildTree(codeTree, lengths, 0, 19);
  for (let num = 0; num < hlit + hdist;) {
    const sym = decodeSymbol(d, codeTree);
    if (sym === 16) { const prev = lengths[num - 1]; for (let n = readBits(d, 2, 3); n; --n) lengths[num++] = prev; }
    else if (sym === 17) { for (let n = readBits(d, 3, 3); n; --n) lengths[num++] = 0; }
    else if (sym === 18) { for (let n = readBits(d, 7, 11); n; --n) lengths[num++] = 0; }
    else lengths[num++] = sym;
  }
  buildTree(lt, lengths, 0, hlit);
  buildTree(dt, lengths, hlit, hdist);
}
function ensure(d: D, extra: number) {
  if (d.dl + extra <= d.dest.length) return;
  let n = d.dest.length * 2 || 1024;
  while (n < d.dl + extra) n *= 2;
  const b = new Uint8Array(n); b.set(d.dest.subarray(0, d.dl)); d.dest = b;
}
function inflateBlockData(d: D, lt: Tree, dt: Tree) {
  for (;;) {
    let sym = decodeSymbol(d, lt);
    if (sym === 256) return;
    if (sym < 256) { ensure(d, 1); d.dest[d.dl++] = sym; continue; }
    sym -= 257;
    const length = readBits(d, lengthBits[sym], lengthBase[sym]);
    const dist = decodeSymbol(d, dt);
    const from = d.dl - readBits(d, distBits[dist], distBase[dist]);
    if (from < 0) throw new Error('inflate: błędne dane');
    ensure(d, length);
    for (let i = from; i < from + length; ++i) d.dest[d.dl++] = d.dest[i];
  }
}
function inflateStored(d: D) {
  while (d.bc > 8) { d.si--; d.bc -= 8; }
  const length = d.src[d.si] | (d.src[d.si + 1] << 8);
  const inv = d.src[d.si + 2] | (d.src[d.si + 3] << 8);
  if (length !== (~inv & 0xffff)) throw new Error('inflate: błędny blok');
  d.si += 4;
  ensure(d, length);
  d.dest.set(d.src.subarray(d.si, d.si + length), d.dl);
  d.dl += length; d.si += length;
  d.bc = 0; d.tag = 0;
}

buildFixedTrees(sltree, sdtree);
buildBitsBase(lengthBits, lengthBase, 4, 3);
buildBitsBase(distBits, distBase, 2, 1);
lengthBits[28] = 0; lengthBase[28] = 258;

/** dekompresja surowego strumienia DEFLATE */
export function inflateRawSync(src: Uint8Array, sizeHint = 0): Uint8Array {
  const d: D = { src, si: 0, tag: 0, bc: 0, dest: new Uint8Array(sizeHint || src.length * 4 || 1024), dl: 0 };
  let final: number;
  do {
    final = getBit(d);
    const type = readBits(d, 2, 0);
    if (type === 0) inflateStored(d);
    else if (type === 1) inflateBlockData(d, sltree, sdtree);
    else if (type === 2) { const lt = new Tree(), dt = new Tree(); decodeTrees(d, lt, dt); inflateBlockData(d, lt, dt); }
    else throw new Error('inflate: nieznany typ bloku');
  } while (!final);
  return d.dest.slice(0, d.dl);
}

/** dekompresja: natywnie (DecompressionStream), a gdy jej brak – w JS */
export async function inflateRaw(src: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream !== 'undefined') {
    try {
      const s = new Blob([src as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Uint8Array(await new Response(s).arrayBuffer());
    } catch { /* zapas poniżej */ }
  }
  return inflateRawSync(src);
}
const fromB64 = (s: string) => { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
/** rozpakowanie zasobu spakowanego przy budowaniu (base64 z DEFLATE) */
export async function unpackBytes(b64: string) { return inflateRaw(fromB64(b64)); }
export async function unpackJson<T>(b64: string): Promise<T> { return JSON.parse(new TextDecoder().decode(await unpackBytes(b64))) as T; }
