"""OmniConvert Studio — yerel medya ve format dönüştürme sunucusu."""
import io
import os
import re
import warnings
import zipfile
import xml.etree.ElementTree as ET
from urllib.parse import quote, urlparse

warnings.filterwarnings('ignore')

import requests
from flask import Flask, Response, jsonify, render_template, request, send_file

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    Image = None

try:
    import yt_dlp
except ImportError:  # pragma: no cover
    yt_dlp = None

try:
    import parth_dl
except ImportError:  # pragma: no cover
    parth_dl = None

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024

USER_AGENT = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
              '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36')


# --------------------------------------------------------------------------
# Sayfa ve sağlık
# --------------------------------------------------------------------------
@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/health')
def health():
    return jsonify({
        'status': 'online',
        'has_ytdlp': yt_dlp is not None,
        'has_pillow': Image is not None,
        'has_parthdl': parth_dl is not None,
    })


# --------------------------------------------------------------------------
# Medya analizi
# --------------------------------------------------------------------------
def detect_platform(url):
    u = url.lower()
    if 'instagram.com' in u:
        return 'instagram'
    if 'youtube.com' in u or 'youtu.be' in u:
        return 'youtube'
    if 'tiktok.com' in u:
        return 'tiktok'
    if 'twitter.com' in u or 'x.com' in u:
        return 'twitter'
    if 'pinterest.' in u or 'pin.it' in u:
        return 'pinterest'
    return 'generic'


def instagram_shortcode(url):
    for pattern in (r'instagram\.com/share/reel/([A-Za-z0-9_-]+)',
                    r'instagram\.com/(?:reel|reels|p|tv)/([A-Za-z0-9_-]+)'):
        m = re.search(pattern, url)
        if m:
            return m.group(1)
    return None


def youtube_id(url):
    for pattern in (r'[?&]v=([A-Za-z0-9_-]{11})',
                    r'youtu\.be/([A-Za-z0-9_-]{11})',
                    r'/shorts/([A-Za-z0-9_-]{11})',
                    r'/embed/([A-Za-z0-9_-]{11})',
                    r'/([A-Za-z0-9_-]{11})(?:[?&#/]|$)'):
        m = re.search(pattern, url)
        if m:
            return m.group(1)
    return None


def ytdlp_extract(url, extra=None):
    if yt_dlp is None:
        return None
    opts = {
        'quiet': True,
        'no_warnings': True,
        'skip_download': True,
        'socket_timeout': 6,
        'noplaylist': True,
        # Biçim seçimini yt-dlp'ye bırakma: ham listeyi biz süzüyoruz.
        'format': 'all',
        'ignore_no_formats_error': True,
    }
    if extra:
        opts.update(extra)
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            return ydl.extract_info(url, download=False)
    except Exception:
        return None


def best_direct_url(info):
    """Sesli tek dosya akışını tercih et; yoksa herhangi bir doğrudan video akışı."""
    if info.get('url') and 'manifest' not in info['url']:
        return info['url']
    usable = [f for f in info.get('formats') or []
              if f.get('url') and 'manifest' not in f['url']
              and not str(f.get('protocol') or '').startswith('m3u8')
              and f.get('vcodec') != 'none']
    with_audio = [f for f in usable if f.get('acodec') != 'none']
    pool = with_audio or usable
    return pool[-1]['url'] if pool else ''


def height_label(h):
    if h and h >= 1080:
        return '1080p', '1080p Full HD'
    if h and h >= 720:
        return '720p', '720p HD'
    if h and h >= 480:
        return '480p', '480p SD'
    if h and h >= 360:
        return '360p', '360p Standart'
    if h and h > 0:
        return '240p', f'{h}p'
    return 'audio', 'MP3 / Ses'


def empty_result(url, platform):
    return {
        'url': url, 'platform': platform, 'title': '', 'thumbnail': '',
        'duration': 0, 'author': '', 'formats': [], 'direct_video_url': '',
        'embed_url': '', 'fallback_links': {},
    }


def analyze_instagram(url, data):
    code = instagram_shortcode(url)
    if code:
        data['embed_url'] = f'https://www.instagram.com/p/{code}/embed/'
        data['thumbnail'] = f'https://www.instagram.com/p/{code}/media/?size=l'
        data['fallback_links'] = {
            'snapinsta': f'https://snapinsta.app/?url={quote(url, safe="")}',
            'fastdl': f'https://fastdl.app/?url={quote(url, safe="")}',
            'saveclip': f'https://saveclip.app/?url={quote(url, safe="")}',
            'ddinstagram': f'https://www.ddinstagram.com/reel/{code}',
        }
    data['title'] = f'Instagram Reel ({code})' if code else 'Instagram Reel'

    if parth_dl is not None:
        try:
            info = parth_dl.get_info(url) or {}
            title = info.get('title') or info.get('caption')
            if title:
                data['title'] = title
            if info.get('thumbnail'):
                data['thumbnail'] = info['thumbnail']
            if info.get('uploader'):
                data['author'] = info['uploader']
            if info.get('duration'):
                data['duration'] = int(info['duration'] or 0)
            candidates = list(info.get('formats') or [])
            for entry in info.get('entries') or []:
                if entry.get('kind', 'video') == 'video':
                    candidates.extend(entry.get('formats') or [])
            seen_urls = set()
            for f in candidates:
                furl = f.get('url')
                if not furl or furl in seen_urls:
                    continue
                seen_urls.add(furl)
                res = f.get('resolution') or (
                    f"{f.get('width')}x{f.get('height')}" if f.get('height') else 'HD')
                height = f.get('height') or 0
                tag = '1080p' if ('1080' in str(res) or 'HD' in str(res) or height >= 1080) else '720p'
                data['formats'].append({
                    'id': f.get('format_id') or f'ig_{len(data["formats"])}',
                    'label': f'{tag} MP4 Video',
                    'quality': 1080 if tag == '1080p' else 720,
                    'quality_tag': tag, 'ext': 'mp4', 'type': 'video',
                    'url': furl, 'filesize': f.get('filesize') or 0,
                })
                if not data['direct_video_url']:
                    data['direct_video_url'] = furl
        except Exception:
            pass

    if not data['direct_video_url']:
        info = ytdlp_extract(url)
        if info:
            data['title'] = info.get('title') or data['title']
            data['thumbnail'] = info.get('thumbnail') or data['thumbnail']
            data['author'] = info.get('uploader') or data['author']
            data['duration'] = int(info.get('duration') or 0)
            direct = best_direct_url(info)
            if direct:
                data['direct_video_url'] = direct
                data['formats'] += [
                    {'id': 'ig_1080', 'label': '1080p Full HD MP4', 'quality': 1080,
                     'quality_tag': '1080p', 'ext': 'mp4', 'type': 'video', 'url': direct, 'filesize': 0},
                    {'id': 'ig_720', 'label': '720p HD MP4 (Hızlı)', 'quality': 720,
                     'quality_tag': '720p', 'ext': 'mp4', 'type': 'video', 'url': direct, 'filesize': 0},
                ]

    if data['direct_video_url'] and not any(f['type'] == 'audio' for f in data['formats']):
        data['formats'].append({
            'id': 'ig_audio', 'label': 'MP3 Ses / Müzik (320 kbps)', 'quality': 0,
            'quality_tag': 'audio', 'ext': 'mp4', 'type': 'audio',
            'url': data['direct_video_url'], 'filesize': 0,
        })


def analyze_youtube(url, data):
    vid = youtube_id(url)
    if vid:
        data['thumbnail'] = f'https://img.youtube.com/vi/{vid}/maxresdefault.jpg'
        data['embed_url'] = f'https://www.youtube-nocookie.com/embed/{vid}'
    enc = quote(url, safe='')
    watch = f'youtube.com/watch?v={vid}' if vid else url
    data['fallback_links'] = {
        'ssyoutube': f'https://ssyoutube.com/{watch}',
        'y2mate_mp4': f'https://www.y2mate.com/youtube/{vid or ""}',
        'y2mate_mp3': f'https://www.y2mate.com/youtube-mp3/{vid or ""}',
        'savefrom': f'https://en.savefrom.net/?url={enc}',
        'yt1s': f'https://yt1s.com/en?q={enc}',
    }
    try:
        r = requests.get('https://www.youtube.com/oembed',
                         params={'url': url, 'format': 'json'}, timeout=4)
        if r.ok:
            o = r.json()
            data['title'] = o.get('title', '')
            data['author'] = o.get('author_name', '')
    except Exception:
        pass

    info = ytdlp_extract(url, {'extractor_args': {'youtube': {'player_client': ['web', 'mweb']}}})
    if not info or not any('manifest' not in (f.get('url') or 'manifest')
                           and (f.get('acodec') or 'none') != 'none'
                           for f in info.get('formats') or []):
        # web/mweb istemcileri PO token isteyince boş döner; yt-dlp'nin varsayılan istemcileri
        # yalnız ses verir, android_vr sesli MP4 akışını ekler.
        info = ytdlp_extract(url, {'extractor_args': {'youtube': {'player_client': ['default', 'android_vr']}}}) or info
    if not info:
        return
    data['title'] = info.get('title') or data['title']
    data['author'] = info.get('uploader') or info.get('channel') or data['author']
    data['duration'] = int(info.get('duration') or 0)
    if info.get('thumbnail'):
        data['thumbnail'] = info['thumbnail']

    seen_heights, seen_audio = set(), set()
    video, audio = [], []
    for f in info.get('formats') or []:
        furl = f.get('url') or ''
        if not furl or 'manifest' in furl:
            continue
        vcodec, acodec = f.get('vcodec') or 'none', f.get('acodec') or 'none'
        size = f.get('filesize') or f.get('filesize_approx') or 0
        h = f.get('height') or 0
        if vcodec != 'none' and acodec != 'none':
            if h in seen_heights:
                continue
            seen_heights.add(h)
            tag, _ = height_label(h)
            video.append({'id': f.get('format_id'), 'label': f'MP4 {h}p (Video + Ses)',
                          'quality': h, 'quality_tag': tag, 'ext': f.get('ext') or 'mp4',
                          'type': 'video', 'url': furl, 'filesize': size})
        elif vcodec == 'none' and acodec != 'none':
            abr = int(f.get('abr') or 0)
            key = f'audio_{abr}'
            if key in seen_audio:
                continue
            seen_audio.add(key)
            audio.append({'id': f.get('format_id'), 'label': f'Ses ({abr} kbps MP3/M4A)',
                          'quality': 0, 'quality_tag': 'audio', 'ext': f.get('ext') or 'm4a',
                          'type': 'audio', 'url': furl, 'filesize': size, 'abr': abr})
    video.sort(key=lambda x: x['quality'], reverse=True)
    audio.sort(key=lambda x: x['abr'], reverse=True)
    data['formats'] = video + audio
    if video:
        data['direct_video_url'] = video[0]['url']


def analyze_generic(url, data):
    info = ytdlp_extract(url)
    if not info:
        return
    data['title'] = info.get('title') or ''
    data['thumbnail'] = info.get('thumbnail') or ''
    data['author'] = info.get('uploader') or ''
    data['duration'] = int(info.get('duration') or 0)
    direct = best_direct_url(info)
    if direct:
        data['direct_video_url'] = direct
        data['formats'].append({'id': 'hd', 'label': 'HD MP4 Video', 'quality': 720,
                                'quality_tag': '720p', 'ext': 'mp4', 'type': 'video',
                                'url': direct, 'filesize': 0})


@app.route('/api/media-info', methods=['POST'])
def media_info():
    payload = request.get_json(silent=True) or {}
    url = (payload.get('url') or '').strip()
    if not url:
        return jsonify({'error': 'Geçerli bir URL giriniz.'}), 400
    try:
        platform = detect_platform(url)
        data = empty_result(url, platform)
        if platform == 'instagram':
            analyze_instagram(url, data)
        elif platform == 'youtube':
            analyze_youtube(url, data)
        else:
            analyze_generic(url, data)
        return jsonify({'success': True, 'data': data})
    except Exception as exc:
        return jsonify({'error': f'Analiz başarısız: {exc}'}), 500


@app.route('/api/proxy-download')
def proxy_download():
    url = request.args.get('url')
    filename = request.args.get('filename') or 'omniconvert_download.mp4'
    if not url:
        return Response('URL parametresi eksik', status=400, mimetype='text/plain')
    try:
        parsed = urlparse(url)
        host = parsed.netloc.lower()
        if 'googlevideo' in host or 'youtube' in host:
            referer = 'https://www.youtube.com/'
        elif 'cdninstagram' in host or 'fbcdn' in host or 'instagram' in host:
            referer = 'https://www.instagram.com/'
        else:
            referer = f'{parsed.scheme}://{parsed.netloc}/'
        upstream = requests.get(url, stream=True, timeout=20,
                                headers={'User-Agent': USER_AGENT, 'Referer': referer})
        upstream.raise_for_status()
    except Exception as exc:
        return Response(f'İndirme hatası: {exc}', status=500, mimetype='text/plain')

    encoded = quote(filename)
    headers = {'Content-Disposition': f'attachment; filename="{encoded}"; filename*=UTF-8\'\'{encoded}'}
    if upstream.headers.get('content-length'):
        headers['Content-Length'] = upstream.headers['content-length']

    def generate():
        try:
            for chunk in upstream.iter_content(chunk_size=64 * 1024):
                if chunk:
                    yield chunk
        finally:
            upstream.close()

    return Response(generate(), headers=headers,
                    content_type=upstream.headers.get('content-type') or 'video/mp4')


# --------------------------------------------------------------------------
# Görsel dönüştürme (Pillow)
# --------------------------------------------------------------------------
FORMAT_MAP = {'JPG': 'JPEG', 'JPEG': 'JPEG', 'PNG': 'PNG', 'WEBP': 'WEBP',
              'BMP': 'BMP', 'GIF': 'GIF', 'ICO': 'ICO'}
MIME_MAP = {'JPEG': 'image/jpeg', 'PNG': 'image/png', 'WEBP': 'image/webp',
            'BMP': 'image/bmp', 'GIF': 'image/gif', 'ICO': 'image/x-icon'}


def parse_hex(value):
    value = (value or '').lstrip('#')
    if re.fullmatch(r'[0-9a-fA-F]{6}', value):
        return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))
    return (255, 255, 255)


@app.route('/api/convert-image', methods=['POST'])
def convert_image():
    file = request.files.get('file')
    if not file:
        return jsonify({'error': 'Dosya yüklenmedi'}), 400
    try:
        fmt = FORMAT_MAP.get((request.form.get('target_format') or 'JPEG').upper(), 'JPEG')
        quality = max(10, min(100, int(float(request.form.get('quality') or 92))))
        scale = float(request.form.get('scale') or 1)
        img = Image.open(file.stream)
        img.load()

        if 0.05 < scale <= 4.0 and scale != 1:
            w = max(1, round(img.width * scale))
            h = max(1, round(img.height * scale))
            img = img.resize((w, h), Image.LANCZOS)

        if fmt in ('JPEG', 'BMP'):
            if img.mode in ('RGBA', 'LA', 'P'):
                rgba = img.convert('RGBA')
                bg = Image.new('RGB', rgba.size, parse_hex(request.form.get('bg_color')))
                bg.paste(rgba, mask=rgba.split()[-1])
                img = bg
            elif img.mode != 'RGB':
                img = img.convert('RGB')

        out = io.BytesIO()
        save_kwargs = {}
        if fmt in ('JPEG', 'WEBP'):
            save_kwargs = {'quality': quality, 'optimize': True}
        elif fmt == 'PNG':
            save_kwargs = {'optimize': True}
        elif fmt == 'ICO':
            img.thumbnail((256, 256), Image.LANCZOS)
            save_kwargs = {'sizes': [img.size]}
        img.save(out, format=fmt, **save_kwargs)
        out.seek(0)

        ext = fmt.lower()
        if ext == 'jpeg':
            ext = 'jpg'
        base = os.path.splitext(file.filename or 'image')[0]
        return send_file(out, mimetype=MIME_MAP[fmt], as_attachment=True,
                         download_name=f'{base}_converted.{ext}')
    except Exception as exc:
        return jsonify({'error': f'Görsel dönüştürme başarısız: {exc}'}), 500


# --------------------------------------------------------------------------
# Belge ayrıştırma
# --------------------------------------------------------------------------
W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
TEXT_EXTS = {'txt', 'md', 'markdown', 'csv', 'rtf', 'json', 'html', 'htm'}


def docx_paragraph(p):
    style = p.find(f'{W}pPr/{W}pStyle')
    style_val = (style.get(f'{W}val') if style is not None else '') or ''
    sl = style_val.lower()
    runs, text = [], []
    for r in p.iter(f'{W}r'):
        t = ''.join(node.text or '' for node in r.iter(f'{W}t'))
        if not t:
            continue
        rpr = r.find(f'{W}rPr')
        bold = rpr is not None and rpr.find(f'{W}b') is not None
        italic = rpr is not None and rpr.find(f'{W}i') is not None
        runs.append({'text': t, 'bold': bold, 'italic': italic})
        text.append(t)
    full = ''.join(text).strip()
    if not full:
        return None
    if any(k in sl for k in ('heading', 'baslik', 'title', 'subtitle')):
        level = 2 if '2' in sl else 3 if '3' in sl else 1
        return {'type': 'heading', 'level': level, 'text': full}
    return {'type': 'paragraph', 'text': full, 'runs': runs}


def parse_docx(raw):
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        root = ET.fromstring(z.read('word/document.xml'))
    body = root.find(f'{W}body')
    elements = []
    for child in list(body) if body is not None else []:
        if child.tag == f'{W}p':
            el = docx_paragraph(child)
            if el:
                elements.append(el)
        elif child.tag == f'{W}tbl':
            rows = []
            for tr in child.iter(f'{W}tr'):
                rows.append([''.join(t.text or '' for t in tc.iter(f'{W}t')).strip()
                             for tc in tr.findall(f'{W}tc')])
            if rows:
                elements.append({'type': 'table', 'rows': rows})
    return elements


def parse_text_lines(text):
    elements = []
    for line in text.splitlines():
        s = line.strip()
        if not s:
            continue
        if s.startswith('#'):
            level = min(3, len(s) - len(s.lstrip('#')))
            elements.append({'type': 'heading', 'level': level, 'text': s.lstrip('#').strip()})
        elif 4 <= len(s) <= 49 and s.upper() == s and any(c.isalpha() for c in s):
            elements.append({'type': 'heading', 'level': 1, 'text': s})
        else:
            elements.append({'type': 'paragraph', 'text': s})
    return elements


def count_words(elements):
    total = 0
    for el in elements:
        if el['type'] == 'table':
            total += sum(len(c.split()) for row in el['rows'] for c in row)
        else:
            total += len(el['text'].split())
    return total


@app.route('/api/convert-document', methods=['POST'])
def convert_document():
    file = request.files.get('file')
    if not file:
        return jsonify({'error': 'Dosya yüklenmedi'}), 400
    filename = file.filename or 'belge'
    base, ext = os.path.splitext(filename)
    ext = ext.lstrip('.').lower()
    if ext != 'docx' and ext not in TEXT_EXTS:
        return jsonify({'error': f'Desteklenmeyen dosya formatı ({ext}). '
                                 'DOCX, TXT, MD, CSV, RTF, JSON veya HTML yükleyin.'}), 400
    try:
        raw = file.read()
        if ext == 'docx':
            elements = parse_docx(raw)
        else:
            text = None
            for enc in ('utf-8', 'utf-8-sig', 'windows-1254', 'iso-8859-9', 'latin-1'):
                try:
                    text = raw.decode(enc)
                    break
                except UnicodeDecodeError:
                    continue
            elements = parse_text_lines(text or '')
        char_count = sum(len(e.get('text', '')) for e in elements)
        return jsonify({'success': True, 'data': {
            'filename': filename, 'ext': ext, 'title': base, 'elements': elements,
            'word_count': count_words(elements), 'char_count': char_count,
        }})
    except Exception as exc:
        return jsonify({'error': f'Belge işlenirken hata oluştu: {exc}'}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5055)), debug=False)
