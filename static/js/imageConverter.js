/* Sekme 2 — Görsel Dönüştürücü */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const drop = $('imgDrop');
  const fileInput = $('imgInput');
  const formatInput = $('imgFormat');
  const formatSeg = $('imgFormatSeg');
  const quality = $('imgQuality');
  const qualityVal = $('imgQualityVal');
  const scale = $('imgScale');
  const bgWrap = $('bgColorWrap');
  const bg = $('imgBg');
  const bgHex = $('imgBgHex');
  const queueEl = $('imgQueue');
  const emptyEl = $('imgEmpty');
  const convertAllBtn = $('imgConvertAll');
  const zipBtn = $('imgZipBtn');
  const clearBtn = $('imgClear');
  const savingsEl = $('imgSavings');
  const countEl = $('imgQueueCount');

  const MIME = { JPEG: 'image/jpeg', PNG: 'image/png', WEBP: 'image/webp', BMP: 'image/bmp', ICO: 'image/x-icon' };
  const CANVAS_FORMATS = ['JPEG', 'PNG', 'WEBP'];
  const queue = [];
  const shown = new Set(); // giriş animasyonu yalnız ilk çizimde oynar
  let seq = 0;

  const ext = (fmt) => (fmt === 'JPEG' ? 'jpg' : fmt.toLowerCase());
  const baseName = (name) => name.replace(/\.[^.]+$/, '') || 'image';
  const isSvg = (file) => file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);

  function syncControls() {
    const fmt = formatInput.value;
    bgWrap.hidden = !(fmt === 'JPEG' || fmt === 'BMP');
    qualityVal.textContent = `%${quality.value}`;
    quality.style.setProperty('--p', `${((quality.value - 10) / 90) * 100}%`);
    bgHex.textContent = bg.value.toUpperCase();
  }

  formatSeg.addEventListener('click', (e) => {
    const btn = e.target.closest('.seg__btn');
    if (!btn) return;
    formatSeg.querySelectorAll('.seg__btn').forEach((b) => b.classList.toggle('active', b === btn));
    formatInput.value = btn.dataset.value;
    syncControls();
  });
  quality.addEventListener('input', syncControls);
  bg.addEventListener('input', syncControls);

  window.handleImageFiles = function (files, silent) {
    const accepted = files.filter((f) => f.type.startsWith('image/') || /\.svg$/i.test(f.name));
    if (!accepted.length) {
      showToast('Yalnızca görsel dosyaları eklenebilir.', 'error');
      return;
    }
    accepted.forEach((file) => {
      queue.push({
        id: ++seq,
        file,
        name: file.name || 'clipboard_image.png',
        size: file.size,
        type: file.type || (isSvg(file) ? 'image/svg+xml' : 'image/*'),
        thumbUrl: URL.createObjectURL(file),
        status: 'pending',
        output: null,
        outName: '',
      });
    });
    render();
    if (!silent) showToast(`${accepted.length} görsel listeye eklendi.`, 'success');
  };

  bindDropZone(drop, fileInput, (files) => window.handleImageFiles(files));

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Dosya okunamadı'));
      reader.onload = () => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Görsel çözülemedi'));
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function drawToCanvas(file, factor, fill) {
    const img = await loadImage(file);
    const w = Math.max(1, Math.round((img.naturalWidth || img.width || 512) * factor));
    const h = Math.max(1, Math.round((img.naturalHeight || img.height || 512) * factor));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);
    return canvas;
  }

  const toBlob = (canvas, mime, q) => new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b && b.type === mime ? resolve(b) : reject(new Error('Canvas bu formatı üretemedi'))), mime, q);
  });

  async function convertInBrowser(item, fmt) {
    const canvas = await drawToCanvas(item.file, Number(scale.value), fmt === 'JPEG' ? bg.value : null);
    return toBlob(canvas, MIME[fmt], Number(quality.value) / 100);
  }

  async function convertOnServer(item, fmt) {
    let source = item.file;
    if (isSvg(item.file)) {
      // Pillow SVG okuyamaz: önce tarayıcıda PNG'ye rasterleştir, ölçeği sunucuya bırak.
      const canvas = await drawToCanvas(item.file, 1, null);
      source = new File([await toBlob(canvas, 'image/png')], `${baseName(item.name)}.png`, { type: 'image/png' });
    }
    const form = new FormData();
    form.append('file', source, source.name || item.name);
    form.append('target_format', fmt);
    form.append('quality', quality.value);
    form.append('scale', scale.value);
    form.append('bg_color', bg.value);
    const res = await fetch('/api/convert-image', { method: 'POST', body: form });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Sunucu hatası (${res.status})`);
    }
    return res.blob();
  }

  async function convertItem(item) {
    const fmt = formatInput.value;
    item.status = 'busy';
    render();
    try {
      let blob;
      if (CANVAS_FORMATS.includes(fmt)) {
        try {
          blob = await convertInBrowser(item, fmt);
        } catch (e) {
          blob = await convertOnServer(item, fmt);
        }
      } else {
        blob = await convertOnServer(item, fmt);
      }
      item.output = blob;
      item.outName = `${baseName(item.name)}_converted.${ext(fmt)}`;
      item.status = 'done';
    } catch (err) {
      item.status = 'pending';
      showToast(`${item.name}: ${err.message || 'dönüştürülemedi'}`, 'error');
    }
    render();
    return item.status === 'done';
  }

  function render() {
    countEl.textContent = queue.length;
    emptyEl.hidden = queue.length > 0;
    zipBtn.hidden = !queue.some((q) => q.status === 'done');

    const done = queue.filter((q) => q.status === 'done');
    const before = done.reduce((s, q) => s + q.size, 0);
    const after = done.reduce((s, q) => s + q.output.size, 0);
    const pct = before ? Math.round(((before - after) / before) * 100) : 0;
    savingsEl.hidden = !(pct > 0);
    savingsEl.textContent = `Toplam -%${pct} tasarruf`;

    queueEl.innerHTML = '';
    queue.forEach((item, i) => {
      const card = document.createElement('article');
      card.className = 'qcard';
      if (shown.has(item.id)) card.style.animation = 'none';
      else card.style.animationDelay = `${Math.min(i, 12) * 30}ms`;
      shown.add(item.id);
      let stateHtml = '<span class="state">Bekliyor</span>';
      let delta = '';
      let action = `<button class="btn btn--ghost qcard__btn" data-act="convert" type="button">Dönüştür</button>`;
      if (item.status === 'busy') {
        stateHtml = '<span class="state state--busy">Dönüştürülüyor...</span>';
        action = '';
      } else if (item.status === 'done') {
        stateHtml = `<span class="state state--done">Hazır (${formatBytes(item.output.size)})</span>`;
        const d = Math.round(((item.output.size - item.size) / item.size) * 100);
        delta = d <= 0
          ? `<span class="delta delta--save">-%${Math.abs(d)}</span>`
          : `<span class="delta delta--grow">+%${d}</span>`;
        action = `<button class="btn btn--accent qcard__btn" data-act="download" type="button"><svg class="ico"><use href="#i-download"/></svg>İndir</button>`;
      }
      card.innerHTML =
        `<div class="qcard__thumb${item.status === 'busy' ? ' is-busy' : ''}"><img src="${item.thumbUrl}" alt="" loading="lazy">` +
        `<button class="qcard__remove" data-act="remove" type="button" aria-label="Kaldır"><svg class="ico"><use href="#i-close"/></svg></button></div>` +
        `<div class="qcard__body"><span class="qcard__name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>` +
        `<span class="qcard__meta">${formatBytes(item.size)} · ${escapeHtml(item.type)}</span>` +
        `<div class="qcard__row">${stateHtml}${delta}</div>` +
        `<div class="qcard__row">${action}</div></div>`;
      card.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-act]');
        if (!btn) return;
        if (btn.dataset.act === 'convert') convertItem(item);
        if (btn.dataset.act === 'download') downloadBlob(item.output, item.outName);
        if (btn.dataset.act === 'remove') {
          URL.revokeObjectURL(item.thumbUrl);
          queue.splice(queue.indexOf(item), 1);
          render();
        }
      });
      queueEl.appendChild(card);
    });
  }

  convertAllBtn.addEventListener('click', async () => {
    const pending = queue.filter((q) => q.status === 'pending');
    if (!pending.length) {
      showToast('Dönüştürülecek yeni görsel yok.', 'info');
      return;
    }
    setBusy(convertAllBtn, true);
    let ok = 0;
    for (const item of pending) {
      if (queue.includes(item) && await convertItem(item)) ok++;
    }
    setBusy(convertAllBtn, false);
    if (ok === pending.length) showToast('Tüm görseller başarıyla dönüştürüldü!', 'success');
    else if (ok) showToast(`${ok}/${pending.length} görsel dönüştürüldü.`, 'warning');
  });

  zipBtn.addEventListener('click', async () => {
    if (typeof JSZip === 'undefined') {
      showToast('ZIP kütüphanesi yüklenemedi.', 'info');
      return;
    }
    const done = queue.filter((q) => q.status === 'done');
    if (!done.length) return;
    setBusy(zipBtn, true);
    try {
      const zip = new JSZip();
      const used = new Set();
      done.forEach((q) => {
        let name = q.outName;
        for (let n = 2; used.has(name); n++) name = q.outName.replace(/(\.[^.]+)$/, `_${n}$1`);
        used.add(name);
        zip.file(name, q.output);
      });
      downloadBlob(await zip.generateAsync({ type: 'blob' }), 'OmniConvert_Gorseller.zip');
    } finally {
      setBusy(zipBtn, false);
    }
  });

  clearBtn.addEventListener('click', () => {
    queue.forEach((q) => URL.revokeObjectURL(q.thumbUrl));
    queue.length = 0;
    render();
  });

  syncControls();
  render();
})();
