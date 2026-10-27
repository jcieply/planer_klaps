/* ===== ZIP: minimalny zapis (deflate-raw przez CompressionStream) i odczyt ===== */
const Zip = (() => {
  const enc = new TextEncoder();
  const dec = new TextDecoder('utf-8');

  let T = null;
  function crcTable() {
    if (T) return T;
    T = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      T[n] = c >>> 0;
    }
    return T;
  }
  function crc32(buf) {
    const t = crcTable();
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  async function streamTo(bytes, stream) {
    const out = new Blob([bytes]).stream().pipeThrough(stream);
    return new Uint8Array(await new Response(out).arrayBuffer());
  }
  async function deflateRaw(bytes) {
    if (typeof CompressionStream === 'undefined') return null;
    try { return await streamTo(bytes, new CompressionStream('deflate-raw')); } catch (e) { return null; }
  }
  async function inflateRaw(bytes) {
    if (typeof DecompressionStream === 'undefined') throw new Error('Przeglądarka nie obsługuje dekompresji ZIP');
    return await streamTo(bytes, new DecompressionStream('deflate-raw'));
  }
  async function zlibDeflate(bytes) {
    if (typeof CompressionStream === 'undefined') return null;
    try { return await streamTo(bytes, new CompressionStream('deflate')); } catch (e) { return null; }
  }

  /** files: [{name, data: string|Uint8Array}] -> Uint8Array */
  async function write(files) {
    const parts = [];
    const central = [];
    let offset = 0;
    const now = new Date();
    const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    for (const f of files) {
      const nameBytes = enc.encode(f.name);
      const raw = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
      const crc = crc32(raw);
      let comp = raw.length > 200 ? await deflateRaw(raw) : null;
      let method = 8;
      if (!comp || comp.length >= raw.length) { comp = raw; method = 0; }
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true);
      lh.setUint16(4, 20, true);
      lh.setUint16(6, 0x0800, true);
      lh.setUint16(8, method, true);
      lh.setUint16(10, dosTime, true);
      lh.setUint16(12, dosDate, true);
      lh.setUint32(14, crc, true);
      lh.setUint32(18, comp.length, true);
      lh.setUint32(22, raw.length, true);
      lh.setUint16(26, nameBytes.length, true);
      lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), nameBytes, comp);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true);
      ch.setUint16(4, 20, true);
      ch.setUint16(6, 20, true);
      ch.setUint16(8, 0x0800, true);
      ch.setUint16(10, method, true);
      ch.setUint16(12, dosTime, true);
      ch.setUint16(14, dosDate, true);
      ch.setUint32(16, crc, true);
      ch.setUint32(20, comp.length, true);
      ch.setUint32(24, raw.length, true);
      ch.setUint16(28, nameBytes.length, true);
      ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), nameBytes);
      offset += 30 + nameBytes.length + comp.length;
    }
    let cdSize = 0;
    for (const p of central) cdSize += p.length;
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true);
    end.setUint32(16, offset, true);
    const all = [...parts, ...central, new Uint8Array(end.buffer)];
    let total = 0;
    for (const p of all) total += p.length;
    const out = new Uint8Array(total);
    let pos = 0;
    for (const p of all) { out.set(p, pos); pos += p.length; }
    return out;
  }

  /** Czyta wpisy ZIP. Zwraca { names:[], get(name):Promise<Uint8Array>, text(name):Promise<string> } */
  function read(bytes) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let eocd = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 66000); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('To nie jest poprawny plik ZIP/DOCX');
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const entries = {};
    for (let i = 0; i < count; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true);
      const csize = dv.getUint32(p + 20, true);
      const nlen = dv.getUint16(p + 28, true);
      const elen = dv.getUint16(p + 30, true);
      const clen = dv.getUint16(p + 32, true);
      const lho = dv.getUint32(p + 42, true);
      const name = dec.decode(bytes.subarray(p + 46, p + 46 + nlen));
      entries[name] = { method, csize, lho };
      p += 46 + nlen + elen + clen;
    }
    async function get(name) {
      const e = entries[name];
      if (!e) return null;
      const lnlen = dv.getUint16(e.lho + 26, true);
      const lelen = dv.getUint16(e.lho + 28, true);
      const start = e.lho + 30 + lnlen + lelen;
      const data = bytes.subarray(start, start + e.csize);
      if (e.method === 0) return data;
      if (e.method === 8) return await inflateRaw(data);
      throw new Error('Nieobsługiwana kompresja w pliku ZIP');
    }
    return { names: Object.keys(entries), get, async text(name) { const d = await get(name); return d ? dec.decode(d) : null; } };
  }

  return { write, read, crc32, zlibDeflate };
})();
if (typeof module !== 'undefined') module.exports = Zip;
