const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function setup(convert){
 const nodes=new Map();let downloads=0;
 function element(){return {value:'',textContent:'',disabled:false,style:{},children:[],classList:{add(){},remove(){}},append(...x){this.children.push(...x)},add(x){this.children.push(x)},replaceChildren(){this.children=[]},setAttribute(){},click(){if(this.download)downloads++},showModal(){this.open=true},close(){this.open=false}}}
 const get=key=>{if(!nodes.has(key))nodes.set(key,element());return nodes.get(key)};
 get('#quality').value='90';get('#globalTarget').value='auto';
 const context=vm.createContext({document:{querySelector:get,createElement:element},window:{scrollTo(){}},location:{hostname:'midvella.github.io'},Option:function(){},crypto:require('node:crypto').webcrypto,URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},setTimeout:(fn,ms)=>setTimeout(fn,ms===30?0:ms),clearTimeout,Blob,console,BrowserEngine:{getFormats:()=>({csv:['json']}),convert,zip:async()=>new Blob(['zip'])}});
 vm.runInContext(fs.readFileSync('web/app.js','utf8')+'\n globalThis.state=()=>({items,busy,cancelling,pendingDownload}); globalThis.add=addFiles; globalThis.request=requestDownload;',context);
 return {context,get,downloads:()=>downloads};
}
function file(n){return {name:`sample-${n}.csv`,size:42}}
test('500 selections wait for start; sequential work and download gating',async()=>{
 let calls=0,active=0,max=0;
 const {context,get}=setup(async()=>{calls++;active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,0));active--;return new Blob(['{}'])});
 context.add(Array.from({length:500},(_,n)=>file(n)));
 assert.equal(calls,0);assert.equal(get('#zip').disabled,true);
 const promise=get('#start').onclick();
 assert.equal(get('#zip').disabled,true);
 await promise;
 assert.equal(calls,500);assert.equal(max,1);assert.equal(context.state().items.every(i=>i.status==='done'),true);assert.equal(get('#zip').disabled,false);
 get('#zip').onclick();assert.equal(get('#downloadDialog').open,true);assert.match(get('#downloadDetails').textContent,/500 dosya/);
 get('#downloadBack').onclick();assert.equal(get('#downloadDialog').open,false);
});
test('cancel stops pending jobs and clear removes all rows',async()=>{
 let calls=0,release;const {context,get}=setup(async()=>{calls++;await new Promise(r=>release=r);return new Blob(['{}'])});
 context.add([file(1),file(2),file(3)]);
 const running=get('#start').onclick();await new Promise(r=>setTimeout(r,10));
 const stopping=get('#cancelAll').onclick();release();await Promise.all([running,stopping]);
 assert.equal(calls,1);assert.equal(context.state().items.every(i=>i.status==='cancelled'),true);assert.equal(get('#zip').disabled,true);
 await get('#clearAll').onclick();assert.equal(context.state().items.length,0);
});
test('one failed file keeps bulk download locked',async()=>{
 const {context,get}=setup(async file=>{if(file.name.includes('2'))throw Error('invalid');return new Blob(['{}'])});
 context.add([file(1),file(2)]);await get('#start').onclick();
 assert.equal(context.state().items[0].status,'done');assert.equal(context.state().items[1].status,'error');assert.equal(get('#zip').disabled,true);
});

test('single download waits for approval and refusal clears pending request',async()=>{
 const {context,get,downloads}=setup(async()=>new Blob(['{}']));
 context.add([file(1)]);await get('#start').onclick();
 const row=get('#rows').children[0];const download=row.children[3].children[0];
 assert.equal(download.href,undefined);download.onclick();
 assert.equal(downloads(),0);assert.equal(context.state().pendingDownload.kind,'single');
 get('#downloadBack').onclick();assert.equal(context.state().pendingDownload,null);
 assert.equal(get('#downloadDetails').textContent,'');
 await get('#downloadConfirm').onclick();assert.equal(downloads(),0);
 download.onclick();await get('#downloadConfirm').onclick();assert.equal(downloads(),1);
 assert.equal(context.state().pendingDownload,null);
 await get('#downloadConfirm').onclick();assert.equal(downloads(),1);
});
test('Escape and closing clear both single and bulk requests',async()=>{
 const {context,get,downloads}=setup(async()=>new Blob(['{}']));
 context.add([file(1)]);await get('#start').onclick();
 for(const kind of ['single','zip']){
  context.request(kind,context.state().items);
  get('#downloadDialog').oncancel();
  assert.equal(context.state().pendingDownload,null);
  await get('#downloadConfirm').onclick();assert.equal(downloads(),0);
  context.request(kind,context.state().items);
  get('#downloadDialog').close();get('#downloadDialog').onclose();
  assert.equal(context.state().pendingDownload,null);
 }
});
