import json, shutil, subprocess
from pathlib import Path
import pytest
from PIL import Image
from server import convert, targets

def test_transparent_image_to_jpg(tmp_path):
    source=tmp_path/'in.png'; dest=tmp_path/'out.jpg'
    Image.new('RGBA',(24,24),(255,0,0,0)).save(source)
    convert(source,dest,'png','jpg')
    with Image.open(dest) as image:
        assert image.mode=='RGB'; assert image.getpixel((0,0))==(255,255,255)

def test_csv_json_roundtrip(tmp_path):
    source=tmp_path/'in.csv'; source.write_text('ad,not\nÇağrı,"a,b"\n',encoding='utf-8')
    out=tmp_path/'out.json'; convert(source,out,'csv','json')
    assert json.loads(out.read_text())==[{'ad':'Çağrı','not':'a,b'}]
    dest=tmp_path/'out.tsv'; convert(out,dest,'json','tsv')
    assert 'Çağrı\ta,b' in dest.read_text(encoding='utf-8-sig')

def test_invalid_json(tmp_path):
    p=tmp_path/'in.json'; p.write_text('{}')
    with pytest.raises(ValueError): convert(p,tmp_path/'out.csv','json','csv')

def test_unsupported(tmp_path):
    assert targets('exe')==[]
    with pytest.raises(ValueError): convert(tmp_path/'bad',tmp_path/'out','exe','pdf')

@pytest.mark.skipif(not shutil.which('ffmpeg'),reason='FFmpeg unavailable')
def test_audio(tmp_path):
    source=tmp_path/'in.wav'; out=tmp_path/'out.mp3'
    subprocess.run(['ffmpeg','-v','error','-f','lavfi','-i','sine=frequency=440:duration=0.2',str(source)],check=True)
    convert(source,out,'wav','mp3'); assert out.stat().st_size>100

@pytest.mark.skipif(not shutil.which('libreoffice'),reason='LibreOffice unavailable')
def test_document_pdf(tmp_path):
    source=tmp_path/'in.txt'; source.write_text('Convert Universe test')
    out=tmp_path/'out.pdf'; convert(source,out,'txt','pdf'); assert out.read_bytes().startswith(b'%PDF')
