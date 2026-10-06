/* Sekme 5 — Hızlı Araçlar: QR, renk kodu, Base64 çözücü */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  // ---------------------------------------------------------------- QR
  const qrText = $('qrText');
  const qrBox = $('qrBox');
  const QR_DEFAULT = 'https://instagram.com';

  function drawQr() {
    if (typeof QRCode === 'undefined') return;
    qrBox.innerHTML = '';
    new QRCode(qrBox, {
      text: qrText.value.trim() || QR_DEFAULT,
      width: 180,
      height: 180,
      colorDark: '#0f172a',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H,
    });
  }

  function qrSource() {
    const img = qrBox.querySelector('img');
    const canvas = qrBox.querySelector('canvas');
    if (img && img.src && img.src.startsWith('data:')) return { img };
    if (canvas) return { canvas };
    if (img && img.src) return { img };
    return null;
  }

  function saveDataUrl(url, name) {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  $('qrPng').addEventListener('click', () => {
    const src = qrSource();
    if (!src) return;
    saveDataUrl(src.img ? src.img.src : src.canvas.toDataURL('image/png'), 'qrcode.png');
    showToast('QR kod PNG olarak indirildi.', 'success');
  });

  $('qrJpg').addEventListener('click', () => {
    const src = qrSource();
    if (!src) return;
    const from = src.canvas || src.img;
    const c = document.createElement('canvas');
    c.width = from.width || 180;
    c.height = from.height || 180;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(from, 0, 0, c.width, c.height);
    saveDataUrl(c.toDataURL('image/jpeg', 0.95), 'qrcode.jpg');
    showToast('QR kod JPG olarak indirildi.', 'success');
  });

  qrText.addEventListener('input', drawQr);
  drawQr();

  // ---------------------------------------------------------------- Renk
  const band = $('colorBand');
  const bandHex = $('colorBandHex');
  const picker = $('colorPicker');
  const hexIn = $('hexIn');
  const rgbIn = $('rgbIn');
  const hslIn = $('hslIn');

  function hexToRgb(hex) {
    const m = /^#([0-9a-f]{6})$/i.exec(hex);
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function rgbToHsl({ r, g, b }) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0;
    let s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  function applyColor(rawHex, fromInput) {
    let hex = rawHex.trim();
    if (hex && !hex.startsWith('#')) hex = `#${hex}`;
    const rgb = hexToRgb(hex);
    if (!rgb) return;
    hex = hex.toUpperCase();
    const hsl = rgbToHsl(rgb);
    if (!fromInput || hexIn.value !== hex) hexIn.value = hex;
    rgbIn.value = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    hslIn.value = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
    picker.value = hex.toLowerCase();
    bandHex.textContent = hex;
    const lum = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
    band.style.setProperty('--c', hex);
    band.style.setProperty('--on-c', lum > 0.55 ? '#111111' : '#f7f2ea');
  }

  band.addEventListener('click', () => (picker.showPicker ? picker.showPicker() : picker.click()));
  picker.addEventListener('input', () => applyColor(picker.value, false));
  hexIn.addEventListener('input', () => applyColor(hexIn.value, true));

  document.querySelectorAll('.copy-btn').forEach((btn) => btn.addEventListener('click', async (e) => {
    e.preventDefault();
    const target = $(btn.dataset.target);
    try {
      await navigator.clipboard.writeText(target.value);
      const original = btn.innerHTML;
      btn.classList.add('is-done');
      btn.innerHTML = '<svg class="ico"><use href="#i-check"/></svg>';
      setTimeout(() => { btn.innerHTML = original; btn.classList.remove('is-done'); }, 1500);
      showToast(`${target.value} kopyalandı.`, 'success');
    } catch (err) {
      showToast('Panoya kopyalanamadı.', 'error');
    }
  }));

  applyColor(hexIn.value, false);

  // ---------------------------------------------------------------- Base64
  const b64Text = $('b64Text');
  const b64Preview = $('b64Preview');

  $('b64Copy').addEventListener('click', async () => {
    const text = b64Text.value;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      showToast('Base64 metni kopyalandı.', 'success');
    } catch (err) {
      showToast('Panoya kopyalanamadı.', 'error');
    }
  });

  $('b64Decode').addEventListener('click', () => {
    let text = b64Text.value.trim();
    if (!text) return;
    if (!text.startsWith('data:image/')) text = `data:image/png;base64,${text.replace(/\s+/g, '')}`;
    const img = new Image();
    img.alt = 'Base64 önizleme';
    img.onload = () => {
      b64Preview.innerHTML = '';
      b64Preview.appendChild(img);
      showToast(`Görsel çözüldü (${img.naturalWidth}×${img.naturalHeight}).`, 'success');
    };
    img.onerror = () => showToast('Geçersiz Base64 formatı', 'error');
    img.src = text;
  });
})();
