# OmniConvert Studio

Yerelde çalışan medya ve format dönüştürme stüdyosu: tek Flask sunucusu, tek sayfalık arayüz.

| Sekme | Ne yapar |
|---|---|
| Reels & Video İndirici | Instagram, YouTube, TikTok, X, Pinterest bağlantısından kapak, süre ve indirilebilir akışlar; sunucu üzerinden akıtılan doğrudan indirme, ayna bağlantılar, canlı oynatıcı |
| Görsel Dönüştürücü | JPG / PNG / WEBP / BMP / ICO; kalite, ölçek, arka plan; toplu dönüştürme, ZIP indirme, panodan yapıştırma |
| Belge & PDF Stüdyosu | DOCX/TXT/MD → PDF, görsellerden PDF, şablonlu hızlı not, karışık dosya birleştirici |
| Videodan Ses Çıkarma | Videonun ses kanalını tarayıcıda kayıpsız WAV'a çevirir |
| Hızlı Araçlar | QR kod, HEX → RGB → HSL, Base64 görsel çözücü |

PDF üretimi, ses çıkarma ve hızlı araçlar tamamen tarayıcıda çalışır. Sunucu yalnız medya analizi, indirme proxy'si, Pillow dönüşümü ve belge ayrıştırma içindir.

## Çalıştırma

```sh
pip install -r requirements.txt
python app.py            # ya da ./start.sh
```

Adres: `http://localhost:5055` (`PORT` ortam değişkeniyle değiştirilir). Harici CDN yoktur; JSZip, jsPDF ve qrcode `static/libs` altından yüklenir.

## Bilinen sınırlar

- PDF standart yazı tipleri `ğ ş ı İ` glifi içermez; bu harfler `g s i I` olarak basılır.
- `.doc` (ikili Word) desteklenmez; sunucu reddeder.
- YouTube'da `web`/`mweb` istemcileri boş dönerse yt-dlp'nin varsayılan istemcilerine ve `android_vr`'a düşülür; bu durumda sesli tek dosya akışı genellikle 360p'dir.
