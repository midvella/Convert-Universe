const {test}=require('node:test');
const assert=require('node:assert/strict');
const engine=require('../web/browser-engine.js');
test('CSV preserves quoted delimiters, quotes, multiline Unicode and CRLF',()=>{
 const text='ad,not\r\nÇağrı,"a,b\n""test"""\r\n';
 const rows=JSON.parse(engine.convertData(text,'csv','json'));
 assert.deepEqual(rows,[{ad:'Çağrı',not:'a,b\n"test"'}]);
 assert.deepEqual(engine.parseDelimited(engine.convertData(JSON.stringify(rows),'json','tsv'),'\t'),rows);
});
test('invalid structures fail clearly',()=>{
 for(const text of ['null','[null]','{}','[3]'])assert.throws(()=>engine.convertData(text,'json','csv'));
 for(const text of ['a,a\n1,2','a,b\n1','a\n"unclosed'])assert.throws(()=>engine.parseDelimited(text,','));
});
test('prototype-shaped headers remain ordinary data',()=>{
 const result=engine.parseDelimited('__proto__,constructor\nx,y',',');
 assert.equal(result[0].__proto__,'x');assert.equal(result[0].constructor,'y');
});
test('CRC matches standard vector',()=>assert.equal(engine.crc32(new TextEncoder().encode('123456789')),0xcbf43926));
test('ZIP carries UTF8 names, checksums and correct central offsets',async()=>{
 const blob=await engine.zip([{name:'örnek.json',blob:new Blob(['{"ok":true}'])}]);
 const bytes=new Uint8Array(await blob.arrayBuffer());const v=new DataView(bytes.buffer);
 assert.equal(v.getUint32(0,true),0x04034b50);assert.equal(v.getUint16(6,true),0x800);
 const end=bytes.length-22;assert.equal(v.getUint32(end,true),0x06054b50);
 assert.equal(v.getUint16(end+10,true),1);const center=v.getUint32(end+16,true);
 assert.equal(v.getUint32(center,true),0x02014b50);assert.equal(v.getUint32(center+42,true),0);
 assert.equal(v.getUint32(14,true),engine.crc32(new TextEncoder().encode('{"ok":true}')));
});
