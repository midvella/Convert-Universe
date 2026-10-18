/* Browser-only conversion and ZIP packaging; no third-party services. */
(function (root) {
  'use strict';
  function parseDelimited(text, delimiter) {
    text = text.replace(/^\uFEFF/, '');
    const rows = []; let row = [], value = '', quoted = false, closed = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"') { if (text[i + 1] === '"') { value += '"'; i++; } else { quoted = false; closed = true; } }
        else value += c;
      } else if (c === delimiter) { row.push(value); value = ''; closed = false; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(value); rows.push(row); row = []; value = ''; closed = false;
      } else if (c === '"' && !value && !closed) quoted = true;
      else { if (closed || c === '"') throw Error('CSV/TSV tırnak yapısı geçersiz.'); value += c; }
    }
    if (quoted) throw Error('CSV/TSV içinde kapanmamış tırnak var.');
    if (value || row.length || closed) { row.push(value); rows.push(row); }
    if (!rows.length) throw Error('Tablo boş.');
    const headers = rows.shift();
    if (new Set(headers).size !== headers.length || headers.some(h => !h.trim())) throw Error('Sütun adları boş veya tekrar ediyor.');
    return rows.map(values => {
      if (values.length !== headers.length) throw Error('Tablodaki sütun sayıları eşleşmiyor.');
      return Object.fromEntries(headers.map((key, i) => [key, values[i]]));
    });
  }
  function convertData(text, ext, target) {
    const rows = ext === 'json' ? JSON.parse(text.replace(/^\uFEFF/, '')) : parseDelimited(text, ext === 'tsv' ? '\t' : ',');
    if (!Array.isArray(rows) || rows.some(r => !r || Array.isArray(r) || typeof r !== 'object')) throw Error('JSON, nesnelerden oluşan bir dizi olmalı.');
    if (target === 'json') return JSON.stringify(rows, null, 2);
    const delimiter = target === 'tsv' ? '\t' : ',';
    const keys = [...new Set(rows.flatMap(Object.keys))];
    const quote = value => {
      let s = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
      return /["\r\n]/.test(s) || s.includes(delimiter) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    return '\uFEFF' + [keys.map(quote).join(delimiter), ...rows.map(r => keys.map(k => quote(r[k])).join(delimiter))].join('\r\n');
  }
  function getFormats() {
    const outputs = ['png', 'jpg'];
    if (document.createElement('canvas').toDataURL('image/webp').startsWith('data:image/webp')) outputs.push('webp');
    return Object.fromEntries([...['png','jpg','jpeg','webp','gif','bmp'].map(x => [x, [...outputs]]), ...['json','csv','tsv'].map(x => [x, ['json','csv','tsv']])]);
  }
  async function convert(file, ext, target, quality) {
    if (['json','csv','tsv'].includes(ext)) {
      if (file.size > 20 * 1024 * 1024) throw Error('Tarayıcıda veri dosyaları için sınır 20 MB.');
      return new Blob([convertData(await file.text(), ext, target)], {type: target === 'json' ? 'application/json' : 'text/plain;charset=utf-8'});
    }
    if (file.size > 50 * 1024 * 1024) throw Error('Tarayıcıda görseller için sınır 50 MB.');
    const url = URL.createObjectURL(file), image = new Image();
    try {
      image.src = url; await image.decode();
      if (!image.naturalWidth || image.naturalWidth * image.naturalHeight > 32000000) throw Error('Görsel 32 megapiksel sınırını aşıyor.');
      const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw Error('Tarayıcı görsel motorunu başlatamadı.');
      if (target === 'jpg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
      ctx.drawImage(image, 0, 0);
      const mime = target === 'jpg' ? 'image/jpeg' : 'image/' + target;
      const blob = await new Promise(resolve => canvas.toBlob(resolve, mime, quality / 100));
      canvas.width = 0; canvas.height = 0;
      if (!blob || blob.type !== mime) throw Error('Tarayıcın bu çıktı formatını desteklemiyor.');
      return blob;
    } finally { URL.revokeObjectURL(url); }
  }
  const crcTable = Array.from({length:256}, (_, n) => { for (let k=0;k<8;k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
  function crc32(bytes) { let n = 0xffffffff; for (const b of bytes) n = crcTable[(n ^ b) & 255] ^ (n >>> 8); return (n ^ 0xffffffff) >>> 0; }
  async function zip(files) {
    if (files.length > 65535 || files.reduce((sum,f) => sum+f.blob.size,0) > 256 * 1024 * 1024) throw Error('Toplu indirme sınırı 256 MB / 65.535 dosya. Dosyaları tek tek indir.');
    const chunks = [], central = []; let offset = 0, centralSize = 0;
    for (const file of files) {
      const name = new TextEncoder().encode(file.name.replace(/[\\/]/g, '_'));
      const data = new Uint8Array(await file.blob.arrayBuffer()), crc = crc32(data);
      const local = new Uint8Array(30 + name.length), v = new DataView(local.buffer);
      v.setUint32(0,0x04034b50,true); v.setUint16(4,20,true); v.setUint16(6,0x800,true); v.setUint16(12,33,true);
      v.setUint32(14,crc,true); v.setUint32(18,data.length,true); v.setUint32(22,data.length,true); v.setUint16(26,name.length,true); local.set(name,30);
      const entry = new Uint8Array(46+name.length), c = new DataView(entry.buffer);
      c.setUint32(0,0x02014b50,true); c.setUint16(4,20,true); c.setUint16(6,20,true); c.setUint16(8,0x800,true); c.setUint16(14,33,true);
      c.setUint32(16,crc,true); c.setUint32(20,data.length,true); c.setUint32(24,data.length,true); c.setUint16(28,name.length,true); c.setUint32(42,offset,true); entry.set(name,46);
      chunks.push(local,data); central.push(entry); offset += local.length+data.length; centralSize += entry.length;
    }
    const end = new Uint8Array(22), e = new DataView(end.buffer);
    e.setUint32(0,0x06054b50,true); e.setUint16(8,files.length,true); e.setUint16(10,files.length,true); e.setUint32(12,centralSize,true); e.setUint32(16,offset,true);
    return new Blob([...chunks,...central,end], {type:'application/zip'});
  }
  const api = {parseDelimited, convertData, getFormats, convert, zip, crc32};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BrowserEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
