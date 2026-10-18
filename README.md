# Convert Universe

Dosya, klasör ve toplu dönüşüm işlemleri için Türkçe web uygulaması. Dosyaları kuyruğa ekleyin, her biri için çıktı formatını seçin ve sonuçları tek tek veya ZIP olarak indirin.

Convert Universe iki şekilde çalışır: GitHub Pages üzerinde sunucusuz **tarayıcı modu**, daha geniş format desteği için Python tabanlı **yerel sunucu modu**. Her iki modda da dönüşüm dosyaları üçüncü taraf bir dönüşüm servisine gönderilmez.

<p align="center">
  <img src="docs/screenshots/workspace.png" alt="Convert Universe koyu temalı çalışma alanı" width="560">
</p>

[Özellikler](#özellikler) · [Kurulum](#kurulum) · [Desteklenen formatlar](#desteklenen-formatlar) · [GitHub Pages](#github-pages-ile-yayınlama) · [Testler](#testler)

## Özellikler

- Tek dosya, çoklu dosya ve klasör seçimi; sürükle-bırak desteği.
- Kullanıcı başlatana kadar bekleyen dönüşüm kuyruğu.
- Dosya başına hedef format seçimi ve uyumlu dosyalara ortak format uygulama.
- JPG ve WebP çıktıları için görsel kalite ayarı.
- Dosya boyutları, toplam seçilen boyut ve sonuçlanan işlem sayısı.
- Dönüşümü iptal etme, yeniden başlatma ve kuyruğu temizleme.
- Dosya bazında hata bildirimi; diğer dosyaların işlenmeye devam etmesi.
- Tekli indirme ve ZIP olarak toplu indirme.
- Dosya sayısını ve boyutunu gösteren indirme onayı.
- Koyu tema, mobil ekranlara uyumlu düzen ve klavye odak göstergeleri.

## Ekran görüntüleri

Görüntüler uygulamanın tarayıcı modundan, örnek dosyalar kullanılarak alınmıştır.

### Dönüşüm kuyruğu

Dosyaların giriş ve çıktı boyutları, seçilen hedef formatlar ve dönüşüm sonuçları aynı listede gösterilir.

![CSV ve PNG dosyalarının başarıyla dönüştürüldüğü kuyruk](docs/screenshots/conversion-queue.png)

### İndirme onayı

Tekli ve toplu indirme işlemleri onay gerektirir. Vazgeçmek veya pencereyi kapatmak bekleyen indirme isteğini temizler.

![Dosya sayısı ve toplam boyut gösteren indirme onayı](docs/screenshots/download-confirmation.png)

## Çalışma modları

| | Tarayıcı modu | Yerel sunucu modu |
| --- | --- | --- |
| Çalışma ortamı | Statik web sunucusu veya GitHub Pages | Python HTTP sunucusu |
| Dönüşüm motoru | Canvas ve JavaScript | Pillow, FFmpeg, LibreOffice ve Python |
| Görseller | PNG, JPG, WebP çıktıları | Ek olarak TIFF, BMP, GIF, ICO ve PDF |
| Veri | JSON, CSV, TSV | JSON, CSV, TSV |
| Video ve ses | Desteklenmez | FFmpeg ile desteklenir |
| Ofis belgeleri | Desteklenmez | LibreOffice ile desteklenir |
| İşleme sırası | Tek seferde bir dosya | Tek yükleme, en fazla iki sunucu işi |
| Dosyaların işlendiği yer | Tarayıcı belleği | Yerel bilgisayarın geçici dizini |

Uygulama, localhost üzerinde yerel API'yi bulursa sunucu modunu kullanır. API yoksa tarayıcı moduna geçer. GitHub Pages üzerinde yerel API aranmaz. Kullanılabilir hedefler arayüzdeki **Desteklenen formatlar** bölümünde listelenir.

## Kurulum

### Tarayıcı modu

Derleme veya JavaScript bağımlılığı kurulumu gerektirmez. `web/` klasörü statik olarak sunulabilir.

Proje kökünde:

```bash
python3 -m http.server 8766 --bind 127.0.0.1
```

[http://127.0.0.1:8766/web/](http://127.0.0.1:8766/web/) adresini açın. Python burada yalnızca statik dosyaları sunar; dönüşümler tarayıcıda yapılır. Güncel bir tarayıcı kullanılması önerilir. Klasör seçimi desteği tarayıcıya göre değişebilir.

### Yerel sunucu modu

Gereksinimler:

- Python 3.10 veya üzeri.
- Pillow; `requirements.txt` üzerinden kurulur.
- Video ve ses işlemleri için FFmpeg.
- Ofis belgeleri için LibreOffice.

Proje kökünde bir sanal ortam oluşturun:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python server.py
```

Uygulama [http://127.0.0.1:8765/](http://127.0.0.1:8765/) adresinde açılır. Sunucuyu durdurmak için terminalde `Ctrl+C` kullanın.

Ubuntu/Debian üzerinde isteğe bağlı dönüşüm motorları:

```bash
sudo apt install ffmpeg libreoffice
```

Farklı bir port kullanmak için:

```bash
PORT=9000 python server.py
```

FFmpeg veya LibreOffice kurulu değilse ilgili dönüşümler sunucu tarafından sunulmaz. Yerel süreç iptali POSIX süreç gruplarını kullanır; mevcut kurulum ve doğrulama Linux içindir. Windows için WSL kullanılabilir.

## Kullanım

1. **Dosya seç** veya **Klasör seç** ile dosyaları ekleyin. Dosya ve klasörleri yükleme alanına sürüklemek de mümkündür.
2. Her dosyanın çıktı formatını seçin. Ortak format tercihi yalnızca uyumlu dosyalara uygulanır.
3. Toplam seçilen boyutu kontrol edin ve **Tümünü dönüştür** düğmesine basın. Dosya seçimi tek başına dönüşümü başlatmaz.
4. Gerekirse **Dönüştürmeyi iptal et** ile kuyruğu durdurun. İptal edilmiş veya hatalı dosyalar yeniden başlatılabilir.
5. Tamamlanan bir dosyayı indirme düğmesiyle seçin veya bütün dosyalar başarılı olduğunda **Tümünü indir (.zip)** kullanın.
6. Dosya sayısını ve çıktı boyutunu inceleyip indirmeyi onaylayın.

### Kuyruk ve indirme kuralları

- Çok sayıda dosya seçmek aynı anda çok sayıda yükleme başlatmaz. Yerel modda yeni yüklemeler, sunucudaki iki iş sınırına göre bekletilir.
- **Tümünü indir** yalnızca kuyruktaki her dosya başarıyla tamamlandığında etkinleşir. Hatalı, iptal edilmiş veya desteklenmeyen dosyalar yeniden işlenmeli ya da listeden kaldırılmalıdır.
- **Vazgeç**, Escape veya indirme penceresini kapatma bekleyen indirme isteğini temizler. Dönüştürülmüş çıktı kuyrukta kalır; yeniden indirmek yeni bir onay gerektirir.
- **Tamamlananları temizle**, başarılı, iptal edilmiş ve desteklenmeyen satırları kaldırır. **Tümünü temizle**, çalışan kuyruğu durdurduktan sonra bütün satırları kaldırır. Kaynak dosyalar silinmez.
- Klasör içeriği düz bir listeye alınır. ZIP içindeki dosya adlarına çakışmayı önlemek için sıra numarası eklenir.
- Sayfa yenilendiğinde veya kapatıldığında istemci kuyruğu kaybolur.

## Desteklenen formatlar

### Tarayıcı modu

| Kategori | Girdi | Çıktı |
| --- | --- | --- |
| Görsel | PNG, JPG, JPEG, WebP, GIF, BMP | PNG, JPG, WebP |
| Veri | JSON, CSV, TSV | JSON, CSV, TSV |

WebP çıktısı yalnızca tarayıcı kodlamayı destekliyorsa gösterilir. Görsel dönüşümü animasyonu korumaz; tek kare üretir. JPG çıktısında şeffaf alanlar beyazla doldurulur. Görsel metadata/EXIF bilgileri korunmaz.

### Yerel sunucu modu

| Kategori | Girdi | Çıktı |
| --- | --- | --- |
| Görsel | PNG, JPG, JPEG, WebP, BMP, TIFF, TIF, GIF, ICO, PPM, TGA, AVIF | PNG, JPG, WebP, TIFF, BMP, GIF, ICO, PDF |
| Video | MP4, MKV, MOV, AVI, WebM, M4V, MPG, MPEG, WMV, FLV, TS, 3GP | MP4, WebM, MKV, MOV, GIF, MP3, WAV, FLAC, OGG, M4A, Opus |
| Ses | MP3, WAV, FLAC, OGG, M4A, AAC, Opus, AIFF, WMA | MP3, WAV, FLAC, OGG, M4A, AAC, Opus, AIFF |
| Belge | DOC, DOCX, ODT, RTF, TXT, HTML, HTM | PDF, DOCX, ODT, RTF, TXT, HTML |
| Tablo | XLS, XLSX, ODS | PDF, XLSX, ODS, CSV |
| Sunum | PPT, PPTX, ODP | PDF, PPTX, ODP |
| Veri | JSON, CSV, TSV | JSON, CSV, TSV |

Codec ve format desteği kurulu motorlara bağlıdır; her girdi/çıktı birleşimi garanti edilmez. CSV girdileri veri dönüştürücüsüyle işlenir. JSON girdisi nesnelerden oluşan bir dizi olmalıdır. CSV/TSV verileri UTF-8 olarak okunur ve metin değerleri korunur.

## GitHub Pages ile yayınlama

Projedeki [Pages iş akışı](.github/workflows/pages.yml), `web/` klasörünü yayınlar. Python sunucusu, testler ve ekran görüntüleri Pages dağıtımına dahil edilmez; ekran görüntüleri repository README'sinde gösterilir.

1. `midvella` hesabında `Convert-Universe` adlı bir repository oluşturun.
2. Proje dosyalarını `.github/workflows/pages.yml` dahil repository köküne ekleyin. Klasör yapısını koruyun.
3. Repository ayarlarında **Settings > Pages > Build and deployment > Source** alanını **GitHub Actions** olarak seçin.
4. `main` veya `master` dalına push yapın. Alternatif olarak **Actions > Publish Convert Universe to GitHub Pages > Run workflow** üzerinden iş akışını başlatın.
5. İş akışı başarılı olduğunda Pages bölümündeki yayın adresini açın.

Bu repository adı için beklenen adres:

```text
https://midvella.github.io/Convert-Universe/
```

Adres, Pages dağıtımı tamamlandıktan sonra kullanılabilir. Başka bir repository adı kullanılırsa URL yolu da değişir. `midvella.github.io` adlı repository ile kök alan adına yayın yapılabilir; uygulamanın göreli dosya yolları her iki yapıyı da destekler.

İş akışı yayınlamadan önce JavaScript sözdizimini ve tarayıcı/kuyruk testlerini kontrol eder. GitHub Pages sürümünde video, ses ve ofis dönüşümleri çalışmaz; bu işlemler için yerel sunucu kullanılmalıdır.

## Sınırlar ve veri saklama

| Sınır | Tarayıcı modu | Yerel sunucu modu |
| --- | --- | --- |
| Görsel dosyası | 50 MB; çözümlenen görsel en fazla 32 megapiksel | Dosya başına 512 MB |
| Veri dosyası | 20 MB | Dosya başına 512 MB |
| Diğer dosyalar | Desteklenmez | Dosya başına 512 MB |
| Arayüzden ZIP indirme | Toplam 256 MB çıktı | Toplam 256 MB çıktı |
| Motor zaman aşımı | Sabit süre sınırı yok | FFmpeg/LibreOffice için 300 saniye |

- ZIP çıktıları sıkıştırmadan paketlenir. Boyut sınırlarının altında da cihaz belleğine bağlı hatalar oluşabilir.
- PDF girdi dönüşümü, OCR, CAD ve arşiv açma desteklenmez. Şifreli veya bozuk dosyalar hata verebilir.
- Görsellerde çok sayfalılık ve animasyon korunmaz. Ofis dönüşümlerinde font ve sayfa düzeni değişebilir.
- Yerel modda iptal, çalışan FFmpeg/LibreOffice süreçlerini sonlandırır. Başlamış Pillow veya tarayıcı görsel işlemi tamamlanabilir; iptal edilen sonuç kullanılmaz. Devam eden yüklemenin iptali, sunucudan iş kimliği alındıktan sonra tamamlanır.
- Yerel dosyalar işletim sisteminin geçici dizininde tutulur. Normal sunucu kapanışında silinir; zorla sonlandırmadan sonra diskte kalabilir. Kuyruktan satır kaldırmak yerel geçici dosyayı hemen silmez.
- Sunucu `127.0.0.1` üzerinde kişisel kullanım için tasarlanmıştır. Kimlik doğrulama, disk kotası ve çok kullanıcılı izolasyon içermez; doğrudan internete açık bir dönüşüm servisi olarak dağıtılmamalıdır.
- Web fontları Google Fonts üzerinden alınır. İnternet erişimi yoksa sistem fontları kullanılır; dönüşüm dosyaları bu servise gönderilmez.

## Proje yapısı

```text
Convert-Universe/
├── .github/workflows/pages.yml   # GitHub Pages doğrulama ve yayın akışı
├── docs/screenshots/            # README ekran görüntüleri
├── tests/
│   ├── browser-engine.test.cjs  # Veri dönüşümü ve ZIP testleri
│   ├── queue.test.cjs           # Kuyruk, iptal ve indirme onayı testleri
│   └── test_conversion.py      # Yerel dönüşüm motoru testleri
├── web/
│   ├── index.html              # Uygulama arayüzü
│   ├── style.css               # Koyu tema ve duyarlı yerleşim
│   ├── app.js                  # Kuyruk ve kullanıcı etkileşimleri
│   ├── browser-engine.js       # Tarayıcı dönüşümleri ve ZIP üretimi
│   ├── logo.svg
│   └── .nojekyll
├── requirements.txt
└── server.py                   # Yerel API ve dönüşüm işçileri
```

## Testler

Tarayıcı tarafındaki kontroller için Node.js 20 veya üzeri kullanın:

```bash
node --check web/app.js
node --check web/browser-engine.js
node --test tests/browser-engine.test.cjs tests/queue.test.cjs
```

Yerel motor testleri için sanal ortamda:

```bash
python -m pip install pytest
python -m pytest -q
```

Testler; CSV/TSV tırnak ve satır sonlarını, Türkçe karakterleri, geçersiz girdileri, ZIP yapısını, 500 dosyanın sırayla işlenmesini, iptali, indirme kilidini ve onaydan vazgeçmeyi kapsar. Python testleri görsel, veri, ses ve belge dönüşümlerini doğrular. FFmpeg veya LibreOffice yoksa ilgili testler atlanır; tüm formatların tek tek test edildiği anlamına gelmez.

## Katkıda bulunma

Hata bildirirken çalışma modunu, tarayıcı/işletim sistemi bilgisini, girdi ve hedef formatı, yaklaşık dosya boyutunu ve görünen hata mesajını ekleyin. Sorunu yeniden üretmek için kişisel veri içermeyen küçük bir örnek tercih edin.

Değişikliklerde tarayıcı ve yerel sunucu modlarını birlikte değerlendirin. Yeni bir format eklerken motor desteğini, arayüzde gösterilen hedefleri ve ilgili testleri güncelleyin.

Proje hesabı: [midvella](https://github.com/midvella)
