import csv, io, json, mimetypes, os, shutil, signal, subprocess, tempfile, threading, time, uuid, zipfile
from pathlib import Path
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlparse
from PIL import Image, ImageOps

ROOT = Path(__file__).parent
DATA = Path(tempfile.mkdtemp(prefix='convert-universe-'))
LIMIT = 512 * 1024 * 1024
JOBS = {}
LOCK = threading.RLock()
CONTEXT = threading.local()
POOL = ThreadPoolExecutor(max_workers=2)
IMAGES = 'png jpg jpeg webp bmp tiff tif gif ico ppm tga avif'.split()
VIDEO = 'mp4 mkv mov avi webm m4v mpg mpeg wmv flv ts 3gp'.split()
AUDIO = 'mp3 wav flac ogg m4a aac opus aiff wma'.split()
DOCS = 'doc docx odt rtf txt html htm'.split()
SHEETS = 'xls xlsx ods csv'.split()
SLIDES = 'ppt pptx odp'.split()

def targets(ext):
    if ext in IMAGES: return ['png','jpg','webp','tiff','bmp','gif','ico','pdf']
    if ext in VIDEO and shutil.which('ffmpeg'): return ['mp4','webm','mkv','mov','gif','mp3','wav','flac','ogg','m4a','opus']
    if ext in AUDIO and shutil.which('ffmpeg'): return ['mp3','wav','flac','ogg','m4a','aac','opus','aiff']
    if ext in ['json','tsv','csv']: return ['json','csv','tsv']
    if shutil.which('libreoffice'):
        if ext in DOCS: return ['pdf','docx','odt','rtf','txt','html']
        if ext in SHEETS: return ['pdf','xlsx','ods','csv']
        if ext in SLIDES: return ['pdf','pptx','odp']
    return []

def run(command):
    proc = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
    started = time.monotonic()
    try:
        while True:
            job_id = getattr(CONTEXT, 'job_id', None)
            with LOCK:
                cancelled = job_id and JOBS[job_id]['status'] == 'cancelled'
            if cancelled: raise ValueError('İşlem iptal edildi.')
            if time.monotonic() - started > 300: raise ValueError('Dönüşüm 5 dakikalık süre sınırını aştı.')
            try:
                proc.communicate(timeout=0.2)
                break
            except subprocess.TimeoutExpired: pass
        if proc.returncode: raise ValueError('Dönüşüm motoru dosyayı okuyamadı veya hedef biçimi üretemedi.')
    finally:
        if proc.poll() is None:
            os.killpg(proc.pid, signal.SIGKILL)
            proc.communicate()

def convert(source, dest, ext, target, quality=90):
    if target not in targets(ext): raise ValueError('Bu dönüşüm desteklenmiyor.')
    if ext == target:
        shutil.copyfile(source, dest); return
    if ext in IMAGES:
        with Image.open(source) as original:
            image = ImageOps.exif_transpose(original)
            if target in ['jpg','pdf']:
                rgba = image.convert('RGBA'); image = Image.new('RGB', rgba.size, 'white'); image.paste(rgba, mask=rgba.getchannel('A'))
            image.save(dest, format={'jpg':'JPEG','tiff':'TIFF','pdf':'PDF'}.get(target, target.upper()), quality=quality)
    elif ext in VIDEO + AUDIO:
        args = ['ffmpeg','-nostdin','-v','error','-y','-i',str(source)]
        if target in AUDIO: args += ['-vn']
        if target == 'mp4': args += ['-c:v','libx264','-pix_fmt','yuv420p','-vf','scale=trunc(iw/2)*2:trunc(ih/2)*2','-movflags','+faststart']
        if target == 'webm': args += ['-c:v','libvpx-vp9','-c:a','libopus']
        if target == 'gif': args += ['-vf','fps=12,scale=640:-1:flags=lanczos']
        run(args + [str(dest)])
    elif ext in ['json','csv','tsv']:
        text = source.read_text(encoding='utf-8-sig')
        if ext == 'json':
            rows = json.loads(text)
            if not isinstance(rows, list) or any(not isinstance(r, dict) for r in rows): raise ValueError('JSON, nesnelerden oluşan bir dizi olmalı.')
        else: rows = list(csv.DictReader(io.StringIO(text), delimiter='\t' if ext == 'tsv' else ','))
        if target == 'json': dest.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding='utf-8')
        else:
            keys = list(dict.fromkeys(k for r in rows for k in r))
            with dest.open('w', encoding='utf-8-sig', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=keys, delimiter='\t' if target == 'tsv' else ','); writer.writeheader(); writer.writerows(rows)
    else:
        out = dest.parent / 'office'; out.mkdir(exist_ok=True)
        run(['libreoffice', '-env:UserInstallation=' + (dest.parent/'profile').as_uri(), '--headless','--convert-to',target,'--outdir',str(out),str(source)])
        result = out / (source.stem + '.' + target)
        if not result.exists(): raise ValueError('Belge dönüştürülemedi. Şifreli veya uyumsuz olabilir.')
        shutil.move(result, dest)
    if not dest.exists() or not dest.stat().st_size: raise ValueError('Dönüşüm boş bir çıktı üretti.')

def worker(id):
    CONTEXT.job_id = id
    with LOCK:
        job = JOBS[id]
        if job['status'] == 'cancelled': return
        job['status'] = 'running'
    try:
        convert(Path(job['source']), Path(job['output']), job['ext'], job['target'], job['quality'])
        with LOCK:
            if job['status'] != 'cancelled': job.update(status='done', size=Path(job['output']).stat().st_size)
    except Exception as e:
        with LOCK:
            if job['status'] != 'cancelled': job.update(status='error', error=str(e) if isinstance(e, ValueError) else 'Dosya işlenemedi. Biçimini ve içeriğini kontrol edin.')

def public(job): return {k:v for k,v in job.items() if k not in ['source','output']}

class Handler(BaseHTTPRequestHandler):
    def respond(self, status, data, kind='application/json'):
        payload = json.dumps(data, ensure_ascii=False).encode() if kind == 'application/json' else data
        self.send_response(status); self.send_header('Content-Type',kind); self.send_header('Content-Length',str(len(payload))); self.send_header('X-Content-Type-Options','nosniff'); self.end_headers(); self.wfile.write(payload)
    def do_GET(self):
        path = urlparse(self.path).path
        if path == '/api/formats': return self.respond(200, {x:targets(x) for x in dict.fromkeys(IMAGES+VIDEO+AUDIO+DOCS+SHEETS+SLIDES+['json','tsv']) if targets(x)})
        if path == '/api/jobs':
            with LOCK: return self.respond(200, [public(j) for j in JOBS.values()])
        if path.startswith('/api/download/'):
            with LOCK: job = JOBS.get(path.rsplit('/',1)[-1])
            if not job or job['status'] != 'done': return self.respond(404, {'error':'Çıktı bulunamadı.'})
            return self.respond(200, Path(job['output']).read_bytes(), 'application/octet-stream')
        if path == '/api/zip':
            buff = io.BytesIO()
            with LOCK: completed = [dict(j) for j in JOBS.values() if j['status']=='done']
            with zipfile.ZipFile(buff,'w',zipfile.ZIP_DEFLATED) as archive:
                for i,j in enumerate(completed): archive.write(j['output'], f"{i+1:03d}-{Path(j['name']).stem}.{j['target']}")
            return self.respond(200,buff.getvalue(),'application/zip')
        files = {'/':'index.html','/app.js':'app.js','/style.css':'style.css','/logo.svg':'logo.svg','/browser-engine.js':'browser-engine.js'}
        if path not in files: return self.respond(404, {'error':'Bulunamadı'})
        f = ROOT/'web'/files[path]; return self.respond(200,f.read_bytes(),mimetypes.guess_type(f)[0] or 'text/plain')
    def do_POST(self):
        # Reject cross-origin browser writes to the local service.
        origin = self.headers.get('Origin')
        if origin and origin != 'http://' + self.headers.get('Host',''): return self.respond(403, {'error':'Geçersiz kaynak.'})
        try:
            length = int(self.headers.get('Content-Length','0'))
            if length <= 0 or length > LIMIT: return self.respond(413, {'error':'Dosya boş veya 512 MB sınırını aşıyor.'})
            if self.path.startswith('/api/cancel/'):
                with LOCK:
                    job = JOBS.get(self.path.rsplit('/',1)[-1])
                    if job and job['status'] in ['queued','running']: job['status']='cancelled'
                self.rfile.read(length); return self.respond(200, {'ok':True})
            if self.path != '/api/upload': return self.respond(404,{'error':'Bulunamadı'})
            from urllib.parse import unquote
            name = Path(unquote(self.headers.get('X-Filename','file')).replace('\\','/')).name
            ext = Path(name).suffix.lower().lstrip('.'); target = self.headers.get('X-Target','')
            quality = max(10,min(100,int(self.headers.get('X-Quality','90'))))
            if target not in targets(ext): return self.respond(400, {'error':'Bu dosya veya hedef biçim desteklenmiyor.'})
            id = uuid.uuid4().hex; folder = DATA/id; folder.mkdir()
            source = folder/('input.'+ext); output = folder/('output.'+target)
            with source.open('wb') as f:
                remaining = length
                while remaining:
                    chunk = self.rfile.read(min(1024*1024,remaining))
                    if not chunk: raise ValueError('Yükleme tamamlanamadı.')
                    f.write(chunk); remaining -= len(chunk)
            job = dict(id=id,name=name,ext=ext,target=target,quality=quality,status='queued',source=str(source),output=str(output),size=length)
            with LOCK: JOBS[id]=job
            POOL.submit(worker,id); self.respond(201,public(job))
        except (ValueError, OSError) as e: self.respond(400,{'error':str(e)})

if __name__ == '__main__':
    import atexit
    atexit.register(lambda: shutil.rmtree(DATA, ignore_errors=True))
    port = int(os.environ.get('PORT','8765'))
    print(f'Convert Universe → http://127.0.0.1:{port}', flush=True)
    ThreadingHTTPServer(('127.0.0.1',port),Handler).serve_forever()
