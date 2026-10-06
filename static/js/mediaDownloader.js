/* Sekme 1 — Reels & Video İndirici */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const input = $('urlInput');
  const platformIcon = $('platformIcon');
  const clearBtn = $('clearUrlBtn');
  const fetchBtn = $('fetchBtn');
  const qualityPref = $('qualityPref');
  const panel = $('resultPanel');
  const skeleton = $('fetchSkeleton');
  const thumb = $('resultThumb');
  const cover = $('coverFrame');
  const formatList = $('formatList');
  const mirrorList = $('mirrorList');
  const playerBox = $('playerBox');
  const playerToggle = $('playerToggle');
  const filterButtons = document.querySelectorAll('#qualityFilters .filter-btn');

  const PLATFORM_ICONS = { ig: 'i-ig', yt: 'i-yt', tt: 'i-tt', link: 'i-link' };
  const PREF_TO_FILTER = { auto: 'all', audio: 'audio', '1080p': '1080p', '720p': '720p', '480p': 'sd', '360p': 'sd' };
  const FILTER_NAMES = { all: 'Tümü', '1080p': '1080p Full HD', '720p': '720p HD', sd: '480p–360p SD', audio: 'MP3 / Ses' };
  const MIRROR_LABELS = {
    snapinsta: 'SnapInsta', fastdl: 'FastDL', saveclip: 'SaveClip', ddinstagram: 'ddinstagram',
    ssyoutube: 'SSYouTube · 1080p', y2mate_mp4: 'Y2Mate · MP4 1080p/720p', y2mate_mp3: 'Y2Mate · MP3 320 kbps',
    savefrom: 'SaveFrom', yt1s: 'YT1s',
  };
  const FALLBACK_COVER = 'data:image/svg+xml,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360"><defs><radialGradient id="g" cx="70%" cy="20%" r="90%"><stop offset="0" stop-color="#ff5a36" stop-opacity=".55"/><stop offset=".6" stop-color="#1a1a20"/><stop offset="1" stop-color="#0b0b0e"/></radialGradient></defs><rect width="640" height="360" fill="url(#g)"/><circle cx="320" cy="180" r="44" fill="none" stroke="#f1ebe0" stroke-opacity=".7" stroke-width="2"/><path d="M307 160v40l33-20z" fill="#f1ebe0" fill-opacity=".85"/></svg>`);

  let current = null;
  let activeFilter = 'all';

  function detectPlatform(url) {
    const u = url.toLowerCase();
    if (u.includes('instagram.com')) return 'ig';
    if (u.includes('youtube.com') || u.includes('youtu.be')) return 'yt';
    if (u.includes('tiktok.com')) return 'tt';
    return 'link';
  }

  function updateInputState() {
    const value = input.value.trim();
    const platform = detectPlatform(value);
    if (platformIcon.dataset.platform !== platform) {
      platformIcon.dataset.platform = platform;
      platformIcon.querySelector('use').setAttribute('href', `#${PLATFORM_ICONS[platform]}`);
      platformIcon.classList.remove('bump');
      void platformIcon.offsetWidth;
      platformIcon.classList.add('bump');
      setTimeout(() => platformIcon.classList.remove('bump'), 350);
    }
    clearBtn.hidden = !value;
  }

  function formatDuration(sec) {
    sec = Math.round(sec || 0);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = String(sec % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
  }

  function sanitizeTitle(title) {
    const clean = String(title || 'omniconvert')
      .replace(/[^\p{L}\p{N}\s_-]/gu, '')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 40);
    return clean || 'omniconvert';
  }

  function matchesFilter(f, filter) {
    const q = Number(f.quality) || 0;
    switch (filter) {
      case '1080p': return f.quality_tag === '1080p' || q >= 1080;
      case '720p': return f.quality_tag === '720p' || (q >= 720 && q < 1080);
      case 'sd': return ['480p', '360p', '240p'].includes(f.quality_tag) || (q > 0 && q < 720);
      case 'audio': return f.type === 'audio' || f.quality_tag === 'audio';
      default: return true;
    }
  }

  function preferredId(formats) {
    const pref = qualityPref.value;
    let match;
    if (pref === 'auto') match = formats.find((f) => f.type === 'video');
    else if (pref === 'audio') match = formats.find((f) => f.type === 'audio' || f.quality_tag === 'audio');
    else match = formats.find((f) => f.quality_tag === pref);
    return match ? match.id : null;
  }

  function setFilter(filter) {
    activeFilter = filter;
    filterButtons.forEach((b) => b.classList.toggle('active', b.dataset.filter === filter));
    renderFormats();
  }

  function renderFormats() {
    if (!current) return;
    const formats = current.formats || [];
    const list = formats.filter((f) => matchesFilter(f, activeFilter));
    formatList.innerHTML = '';

    if (!list.length) {
      const box = document.createElement('div');
      box.className = 'formats-empty';
      box.innerHTML =
        `<h4><em>${escapeHtml(FILTER_NAMES[activeFilter])}</em> — Bu kalite için doğrudan akış bulunamadı</h4>` +
        '<p>Başka bir kalite deneyin ya da aşağıdaki ayna bağlantılardan biriyle indirin.</p>';
      if (activeFilter !== 'all') {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn--ghost btn--sm';
        btn.textContent = 'Tüm Kaliteleri Göster';
        btn.addEventListener('click', () => setFilter('all'));
        box.appendChild(btn);
      }
      formatList.appendChild(box);
      return;
    }

    const prefId = preferredId(formats);
    const base = sanitizeTitle(current.title);
    list.forEach((f, i) => {
      const isAudio = f.type === 'audio';
      const ext = (f.ext || (isAudio ? 'm4a' : 'mp4')).toLowerCase();
      const suffix = f.quality_tag ? `_${f.quality_tag}` : '';
      const filename = `${base}${suffix}.${ext}`;
      const a = document.createElement('a');
      a.className = `fmt fmt--${isAudio ? 'audio' : 'video'}`;
      a.style.animationDelay = `${i * 45}ms`;
      a.href = `/api/proxy-download?url=${encodeURIComponent(f.url)}&filename=${encodeURIComponent(filename)}`;
      a.setAttribute('download', filename);
      const preferred = prefId && f.id === prefId;
      if (preferred) a.classList.add('fmt--preferred');
      const size = f.filesize ? ` · ${formatBytes(f.filesize)}` : '';
      a.innerHTML =
        `<span class="fmt__ico"><svg class="ico"><use href="#${isAudio ? 'i-music' : 'i-film'}"/></svg></span>` +
        `<span class="fmt__main"><span class="fmt__label">${escapeHtml(f.label)}</span>` +
        `<span class="fmt__sub">Doğrudan İndir (${ext.toUpperCase()}${size})</span></span>` +
        '<span class="fmt__badges">' +
        (preferred ? '<span class="pill pill--star"><svg class="ico"><use href="#i-star"/></svg>Tercihiniz</span>' : '') +
        `<span class="pill pill--${isAudio ? 'audio' : 'video'}">${isAudio ? 'Ses' : 'Video'}</span></span>` +
        '<span class="fmt__go"><svg class="ico"><use href="#i-download"/></svg></span>';
      formatList.appendChild(a);
    });
  }

  function renderMirrors(links) {
    mirrorList.innerHTML = '';
    Object.entries(links || {}).forEach(([key, href]) => {
      const a = document.createElement('a');
      a.className = 'chip';
      a.href = href;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.innerHTML = `<svg class="ico"><use href="#i-external"/></svg>${escapeHtml(MIRROR_LABELS[key] || key.toUpperCase())}`;
      mirrorList.appendChild(a);
    });
  }

  function resetPlayer() {
    playerBox.innerHTML = '';
    playerBox.hidden = true;
    playerToggle.querySelector('span').textContent = 'Canlı Oynatıcıyı Aç';
  }

  function togglePlayer() {
    if (!current) return;
    if (!playerBox.hidden) { resetPlayer(); return; }
    if (current.embed_url) {
      const iframe = document.createElement('iframe');
      iframe.src = current.embed_url;
      iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      iframe.allowFullscreen = true;
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      playerBox.appendChild(iframe);
    } else if (current.direct_video_url) {
      const video = document.createElement('video');
      video.src = current.direct_video_url;
      video.controls = true;
      video.autoplay = true;
      video.playsInline = true;
      playerBox.appendChild(video);
    } else {
      playerBox.innerHTML = '<p>Bu içerik için tarayıcıda oynatılabilir bir akış bulunamadı.</p>';
    }
    playerBox.hidden = false;
    playerToggle.querySelector('span').textContent = 'Oynatıcıyı Kapat';
  }

  function renderResult(data) {
    current = data;
    resetPlayer();
    const platform = data.platform || 'generic';
    $('resultPlatform').textContent = platform.toUpperCase();
    const durationEl = $('resultDuration');
    durationEl.hidden = !data.duration;
    durationEl.textContent = formatDuration(data.duration);
    $('resultTitle').textContent = data.title || 'Başlıksız içerik';
    $('resultAuthor').textContent = data.author || (platform === 'instagram' ? 'Instagram Kullanıcısı' : 'Kanal / Yayıncı');
    cover.classList.toggle('is-portrait', platform === 'instagram' || platform === 'tiktok' || /\/shorts\//.test(data.url || ''));
    thumb.onerror = () => { thumb.onerror = null; thumb.src = FALLBACK_COVER; };
    thumb.src = data.thumbnail || FALLBACK_COVER;
    renderMirrors(data.fallback_links);
    setFilter(PREF_TO_FILTER[qualityPref.value] || 'all');
    panel.hidden = false;
    panel.style.animation = 'none';
    void panel.offsetWidth;
    panel.style.animation = '';
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function analyze() {
    const url = input.value.trim();
    if (!url) {
      showToast('Önce bir bağlantı girin.', 'info');
      input.focus();
      return;
    }
    setBusy(fetchBtn, true);
    panel.hidden = true;
    skeleton.hidden = false;
    try {
      const res = await fetch('/api/media-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, preferred_quality: qualityPref.value }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || `Sunucu hatası (${res.status})`);
      skeleton.hidden = true;
      renderResult(json.data);
      const n = (json.data.formats || []).length;
      showToast(n ? `${n} indirilebilir akış bulundu.` : 'Doğrudan akış bulunamadı; ayna bağlantıları hazır.', n ? 'success' : 'warning');
    } catch (err) {
      skeleton.hidden = true;
      showToast(err.message || 'İçerik alınamadı.', 'error');
    } finally {
      setBusy(fetchBtn, false);
    }
  }

  input.addEventListener('input', updateInputState);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); fetchBtn.click(); } });
  clearBtn.addEventListener('click', () => {
    input.value = '';
    updateInputState();
    panel.hidden = true;
    current = null;
    resetPlayer();
    input.focus();
  });
  fetchBtn.addEventListener('click', analyze);
  playerToggle.addEventListener('click', togglePlayer);
  filterButtons.forEach((b) => b.addEventListener('click', () => setFilter(b.dataset.filter)));
  qualityPref.addEventListener('change', () => { if (current) setFilter(PREF_TO_FILTER[qualityPref.value] || 'all'); });
  document.querySelectorAll('.example-btn').forEach((b) => b.addEventListener('click', () => {
    input.value = b.dataset.url;
    updateInputState();
    fetchBtn.click();
  }));

  updateInputState();
})();
