const $=s=>document.querySelector(s);let formats={},items=[],busy=false,localMode=false,cancelling=false,zipping=false,runVersion=0;let pendingDownload=null;
const labels={ready:'Başlatılmayı bekliyor',pending:'Sırada bekliyor',uploading:'Yükleniyor…',queued:'Sırada',running:'Dönüştürülüyor…',done:'Tamamlandı',error:'Hata',cancelled:'İptal edildi',unsupported:'Desteklenmiyor'};
function toast(message){$('#toast').textContent=message;$('#toast').style.display='block';clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>$('#toast').style.display='none',4500)}
const size=n=>n<1024?`${n} B`:n<1048576?`${(n/1024).toFixed(1)} KB`:`${(n/1048576).toFixed(1)} MB`;
function addFiles(files){if(zipping){toast('ZIP hazırlanırken dosya eklenemez.');return}for(const file of files){if(file.size>(localMode?512:50)*1024*1024||!file.size){toast(`${file.name}: Dosya boş veya izin verilen boyut sınırını aşıyor.`);continue}const ext=file.name.split('.').pop().toLowerCase(),options=formats[ext]||[],preferred=$('#globalTarget').value;items.push({key:crypto.randomUUID(),file,name:file.name,ext,options,target:options.includes(preferred)?preferred:(options.find(x=>x!==ext)||options[0]||''),status:options.length?'ready':'unsupported'})}render()}
function render(){const root=$('#rows');root.replaceChildren();$('#count').textContent=items.length;for(const item of items){const row=document.createElement('div');row.className='row';const file=document.createElement('div');file.className='file';const icon=document.createElement('span');icon.className='file-icon';icon.textContent=item.ext.toUpperCase().slice(0,5);const info=document.createElement('div');info.className='file-info';const title=document.createElement('b');title.textContent=item.name;title.title=item.file.webkitRelativePath||item.name;const sub=document.createElement('small');sub.textContent=size(item.file.size)+(item.status==='done'?` → ${size(item.size)}`:'');info.append(title,sub);file.append(icon,info);const select=document.createElement('select');select.setAttribute('aria-label',`${item.name} çıktı formatı`);for(const target of item.options){const opt=new Option(target.toUpperCase(),target);select.add(opt)}select.value=item.target;select.disabled=zipping||cancelling||!['ready','error','cancelled'].includes(item.status);select.onchange=()=>item.target=select.value;const state=document.createElement('span');state.className=`state ${item.status}`;state.textContent=labels[item.status];state.title=item.error||'';if(item.error){state.textContent='Hata ⓘ';state.tabIndex=0;state.onclick=()=>toast(item.error)}const actions=document.createElement('div');if(item.status==='done'){const a=document.createElement('button');a.type='button';a.className='download-button';a.textContent='↓';a.title='İndir';a.setAttribute('aria-label',`${item.name} indir`);a.disabled=zipping;a.onclick=()=>requestDownload('single',[item]);actions.append(a)}const remove=document.createElement('button');remove.textContent='×';remove.setAttribute('aria-label',`${item.name} kaldır`);remove.disabled=cancelling||zipping||item.status==='uploading'||(!localMode&&item.status==='running');remove.onclick=async()=>{if(localMode&&['queued','running'].includes(item.status)){try{await fetch(`/api/cancel/${item.id}`,{method:'POST',body:'{}'})}catch{toast('İptal isteği iletilemedi.');return}}if(item.url)URL.revokeObjectURL(item.url);items=items.filter(x=>x!==item);render()};actions.append(remove);row.append(file,select,state,actions);root.append(row)}if(!items.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='Henüz dosya yok. İlk dosyanı ekleyerek başla.';root.append(empty)}const done=items.filter(x=>x.status==='done').length;$('#summary').textContent=items.length?`${items.length} dosya · ${done} tamamlandı · ${size(items.reduce((a,b)=>a+b.file.size,0))}`:'Dönüştürmeye hazır olduğunda buradayız.';const active=items.some(x=>['pending','uploading','queued','running'].includes(x.status));
$('#start').disabled=busy||cancelling||zipping||active||!items.some(x=>['ready','error','cancelled'].includes(x.status)&&x.options.length);
$('#zip').disabled=zipping||cancelling||busy||!items.length||!items.every(x=>x.status==='done');
$('#zip').title=items.length&&!items.every(x=>x.status==='done')?'Toplu indirme için bütün dosyalar tamamlanmalı. Hatalı veya desteklenmeyen dosyaları kaldırabilir ya da yeniden deneyebilirsin.':'';
$('#cancelAll').disabled=cancelling||(!busy&&!active);$('#clearAll').disabled=cancelling||zipping||!items.length;$('#clear').disabled=zipping||cancelling;
const total=items.reduce((a,b)=>a+b.file.size,0),processed=items.filter(x=>['done','error','cancelled'].includes(x.status)).length;
$('#uploadSummary').textContent=`${localMode?'Toplam yükleme boyutu':'Toplam seçilen boyut'}: ${size(total)} · ${items.length} dosya`;
$('#batchProgress').max=Math.max(1,items.length);$('#batchProgress').value=processed;
$('#batchSummary').textContent=cancelling?'İşlemler durduruluyor…':`${processed} / ${items.length} işlem sonuçlandı · ${localMode?'Tek seferde 1 yükleme, en fazla 2 dönüşüm':'Dosyalar sırayla cihazında işlenir'}`;
$('#start').textContent=busy?'Dosyalar işleniyor…':'Tümünü dönüştür ↗'}
$('#choose').onclick=()=>$('#files').click();$('#folder').onclick=()=>$('#folders').click();for(const id of ['files','folders'])$('#'+id).onchange=e=>{addFiles(e.target.files);e.target.value=''};
$('#drop').ondragover=e=>{e.preventDefault();$('#drop').classList.add('drag')};$('#drop').ondragleave=()=>$('#drop').classList.remove('drag');
async function traverse(entry){if(entry.isFile)return new Promise((res,rej)=>entry.file(f=>res([f]),rej));if(entry.isDirectory){const reader=entry.createReader();let all=[];while(true){const chunk=await new Promise((res,rej)=>reader.readEntries(res,rej));if(!chunk.length)break;for(const child of chunk)all.push(...await traverse(child))}return all}return []}
$('#drop').ondrop=async e=>{e.preventDefault();$('#drop').classList.remove('drag');try{const entries=[...e.dataTransfer.items].map(i=>i.webkitGetAsEntry?.()).filter(Boolean);if(entries.length){for(const entry of entries)addFiles(await traverse(entry))}else addFiles(e.dataTransfer.files)}catch{toast('Klasör okunamadı. Klasör seç düğmesini kullanabilirsin.')}};
$('#quality').oninput=e=>$('#qualityValue').textContent='%'+e.target.value;$('#globalTarget').onchange=e=>{for(const item of items)if(item.status==='ready'&&item.options.includes(e.target.value))item.target=e.target.value;render()};
$('#start').onclick=async()=>{
  if(busy||cancelling||zipping)return;busy=true;const version=++runVersion;const pending=items.filter(x=>['ready','error','cancelled'].includes(x.status)&&x.options.length);pending.forEach(x=>x.status='pending');render();
  for(const item of pending){
    if(version!==runVersion)break;if(!items.includes(item))continue;
    // Keep only two jobs in the server, rather than enqueueing hundreds of uploads.
    while(localMode&&version===runVersion&&items.filter(i=>['queued','running'].includes(i.status)).length>=2){await new Promise(resolve=>setTimeout(resolve,200))}
    if(version!==runVersion)break;
    item.status=localMode?'uploading':'running'; item.error=''; render();
    try{
      if(localMode){
        const response=await fetch('/api/upload',{method:'POST',headers:{'X-Filename':encodeURIComponent(item.name),'X-Target':item.target,'X-Quality':$('#quality').value},body:item.file});
        const data=await response.json(); if(!response.ok)throw Error(data.error); if(version!==runVersion){await cancelJob(data.id);item.status='cancelled'}else Object.assign(item,data);
      }else{
        await new Promise(resolve=>setTimeout(resolve,30));
        const blob=await BrowserEngine.convert(item.file,item.ext,item.target,Number($('#quality').value));
        if(version===runVersion&&items.includes(item)){item.blob=blob;item.url=URL.createObjectURL(blob);item.size=blob.size;item.status='done'}else item.status='cancelled';
      }
    }catch(e){item.status=version===runVersion?'error':'cancelled';item.error=version===runVersion?(e.message||'Dosya dönüştürülemedi.'):''}
    render();
  }
  busy=false;render();
};
$('#clear').onclick=()=>{items=items.filter(i=>{if(['done','cancelled','unsupported'].includes(i.status)){if(i.url)URL.revokeObjectURL(i.url);return false}return true});render()};
async function cancelJob(id){const response=await fetch(`/api/cancel/${id}`,{method:'POST',body:'{}'});if(!response.ok)throw Error('İptal isteği iletilemedi.')}
async function stopAll(){
  if(cancelling)return; cancelling=true;++runVersion;render();
  const active=items.filter(i=>['pending','uploading','queued','running'].includes(i.status));
  let failed=false;
  for(const item of active){
    try{if(localMode&&item.id)await cancelJob(item.id);item.status='cancelled'}catch{failed=true}
  }
  // Let the single in-flight upload return its job ID so it too can be cancelled.
  while(busy)await new Promise(resolve=>setTimeout(resolve,50));
  cancelling=false;render();if(failed)throw Error('Bazı işler iptal edilemedi. Sunucu bağlantısını kontrol et.');
}
$('#cancelAll').onclick=()=>stopAll().then(()=>toast('Dönüşüm kuyruğu durduruldu.')).catch(e=>toast(e.message));
$('#clearAll').onclick=async()=>{try{await stopAll();for(const item of items)if(item.url)URL.revokeObjectURL(item.url);items=[];render();toast('Tüm dosyalar kuyruktan temizlendi.')}catch(e){toast(e.message)}};
function clearDownloadRequest(){
  pendingDownload=null;
  $('#downloadDetails').textContent='';
  $('#downloadConfirm').disabled=true;
}
function dismissDownload(){clearDownloadRequest();$('#downloadDialog').close()}
function requestDownload(kind, files){
  if(zipping||!files.length||files.some(item=>item.status!=='done'||!items.includes(item)))return;
  pendingDownload={kind,files:files.slice()};
  const bytes=files.reduce((sum,item)=>sum+item.size,0);
  $('#downloadTitle').textContent=kind==='single'?'Dosyayı indirmeyi onayla':'Toplu indirmeyi onayla';
  $('#downloadDetails').textContent=kind==='single'
    ?`${files[0].name.replace(/\.[^.]+$/,'')}.${files[0].target} · 1 dosya · ${size(bytes)}`
    :`${files.length} dosya · toplam çıktı boyutu ${size(bytes)}. Tek ZIP dosyası olarak indirilecek; ZIP başlıkları nedeniyle indirme boyutu biraz daha büyük olabilir.`;
  $('#downloadConfirm').disabled=false;
  $('#downloadDialog').showModal();
}
$('#zip').onclick=()=>{if(!$('#zip').disabled)requestDownload('zip',items)};
$('#downloadBack').onclick=dismissDownload;
$('#downloadDialog').oncancel=()=>clearDownloadRequest();
$('#downloadDialog').onclose=()=>{if(!$('#downloadDialog').open)clearDownloadRequest()};
$('#downloadConfirm').onclick=async()=>{
  const request=pendingDownload;
  dismissDownload();
  if(!request)return;
  if(zipping||request.files.some(item=>!items.includes(item)||item.status!=='done')){toast('Kuyruk değişti. İndirmeyi yeniden başlat.');return}
  if(request.kind==='single'){
    const item=request.files[0];const link=document.createElement('a');
    link.href=item.url||`/api/download/${item.id}`;
    link.download=item.name.replace(/\.[^.]+$/,'')+'.'+item.target;
    link.click();return;
  }
  if(busy||cancelling||request.files.length!==items.length||request.files.some((item,index)=>item!==items[index])){toast('Kuyruk değişti. İndirmeyi yeniden başlat.');return}
  zipping=true;

  const button=$('#zip');button.disabled=true;button.textContent='ZIP hazırlanıyor…';render();
  try{
    const completed=request.files;
    if(completed.reduce((sum,i)=>sum+i.size,0)>256*1024*1024)throw Error('Toplu indirme sınırı 256 MB. Dosyaları tek tek indir.');
    const files=[];
    for(const [index,item]of completed.entries()){
      let blob=item.blob;
      if(!blob){const response=await fetch(`/api/download/${item.id}`);if(!response.ok)throw Error('Çıktı indirilemedi.');blob=await response.blob()}
      files.push({name:`${String(index+1).padStart(3,'0')}-${item.name.replace(/\.[^.]+$/,'')}.${item.target}`,blob});
    }
    const url=URL.createObjectURL(await BrowserEngine.zip(files));const a=document.createElement('a');a.href=url;a.download='convert-universe.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
  }catch(e){toast(e.message)}finally{zipping=false;button.textContent='↓ Tümünü indir (.zip)';render()}
};
$('#formatsBtn').onclick=()=>$('#formatDialog').showModal();$('#closeDialog').onclick=()=>$('#formatDialog').close();$('#home').onclick=()=>window.scrollTo({top:0,behavior:'smooth'});
async function poll(){try{if(items.some(i=>['running','queued'].includes(i.status))){const res=await fetch('/api/jobs');if(!res.ok)throw Error();const jobs=await res.json();for(const job of jobs){const item=items.find(i=>i.id===job.id);if(item&&!cancelling&&item.status!=='cancelled')Object.assign(item,job)}render()}}catch{toast('Sunucuyla bağlantı kesildi. Yeniden bağlanmaya çalışılıyor.')}finally{setTimeout(poll,1500)}}
async function initialize(){
  $('#choose').disabled=true;$('#folder').disabled=true;
  if(['localhost','127.0.0.1','[::1]'].includes(location.hostname)){
    try{
      const response=await fetch('/api/formats',{signal:AbortSignal.timeout(2000)});
      if(response.ok){const data=await response.json();if(data.png&&data.csv){formats=data;localMode=true}}
    }catch{/* Static previews fall back to the browser engine. */}
  }
  if(!localMode)formats=BrowserEngine.getFormats();
  $('#modeLabel').textContent=localMode?'● YEREL SUNUCU MODU':'● TARAYICI MODU';
  $('#modeNotice').textContent=localMode?'Yerel motorlar hazır. Desteklenen görsel, belge, video, ses ve veri dosyalarını dönüştürebilirsin.':'Görsel ve veri dönüşümleri tarayıcında çalışır. Video, ses ve ofis belgeleri için yerel sürüm gerekir. GIF dönüşümünde yalnızca ilk kare alınır.';
  if(localMode){
    $('#uploadLimit').textContent='Dosya başına en fazla 512 MB · Çoklu yükleme';
    $('#imageSupport').textContent='PNG, JPG, WebP, TIFF ve daha fazlası';
    $('#officeSupport').textContent=formats.docx?'Word, Excel, PowerPoint → PDF':'LibreOffice kurulu değil';
    $('#mediaSupport').textContent=formats.mp4?'MP4, WebM, MP3, WAV ve daha fazlası':'FFmpeg kurulu değil';
  }
  for(const target of [...new Set(Object.values(formats).flat())].sort())$('#globalTarget').add(new Option(target.toUpperCase(),target));
  for(const [source,outputs]of Object.entries(formats)){const div=document.createElement('div');div.textContent=`${source.toUpperCase()} → ${outputs.join(', ').toUpperCase()}`;$('#formatList').append(div)}
  $('#choose').disabled=false;$('#folder').disabled=false;
  if(localMode)poll();
}
initialize().catch(()=>toast('Dönüşüm motoru başlatılamadı. Güncel bir tarayıcıyla yeniden dene.'));
