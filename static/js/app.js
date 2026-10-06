/* OmniConvert Studio — global işlevler: toast, byte biçimi, sekmeler, sağlık, pano. */
(function () {
  'use strict';

  const ICONS = { info: 'i-info', success: 'i-check', error: 'i-alert', warning: 'i-alert' };

  window.showToast = function (message, type = 'info', duration = 3500) {
    const box = document.getElementById('toastContainer');
    if (!box) return;
    const kind = ICONS[type] ? type : 'info';
    const el = document.createElement('div');
    el.className = `toast toast--${kind}`;
    el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    el.style.setProperty('--d', `${duration}ms`);
    el.innerHTML =
      `<span class="toast__ico"><svg class="ico"><use href="#${ICONS[kind]}"/></svg></span>` +
      '<span class="toast__msg"></span><span class="toast__bar"></span>';
    el.querySelector('.toast__msg').textContent = message;
    box.appendChild(el);
    setTimeout(() => {
      el.classList.add('is-leaving');
      setTimeout(() => el.remove(), 300);
    }, duration);
  };

  window.formatBytes = function (bytes, decimals = 1) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    const value = bytes / Math.pow(1024, i);
    return `${i === 0 ? value : value.toFixed(decimals)} ${units[i]}`;
  };

  window.escapeHtml = function (text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };

  window.setBusy = function (btn, busy) {
    if (!btn) return;
    btn.classList.toggle('is-loading', busy);
    btn.disabled = busy;
  };

  window.downloadBlob = function (blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  // Ortak bırakma alanı bağlayıcısı
  window.bindDropZone = function (zone, input, onFiles) {
    if (!zone || !input) return;
    ['dragenter', 'dragover'].forEach((ev) => zone.addEventListener(ev, (e) => {
      e.preventDefault();
      zone.classList.add('is-over');
    }));
    ['dragleave', 'dragend'].forEach((ev) => zone.addEventListener(ev, (e) => {
      if (!zone.contains(e.relatedTarget)) zone.classList.remove('is-over');
    }));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('is-over');
      if (e.dataTransfer?.files?.length) onFiles(Array.from(e.dataTransfer.files));
    });
    zone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
    });
    input.addEventListener('change', () => {
      if (input.files.length) onFiles(Array.from(input.files));
      input.value = '';
    });
  };

  // ---------------- Sekmeler ----------------
  const tabButtons = document.querySelectorAll('.tab-btn');
  const panes = document.querySelectorAll('.tab-pane');
  const crumb = document.getElementById('crumbName');

  window.activateTab = function (name) {
    tabButtons.forEach((b) => {
      const on = b.dataset.tab === name;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', String(on));
      if (on && window.matchMedia('(max-width: 960px)').matches) {
        b.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
      }
    });
    panes.forEach((p) => {
      const on = p.id === `tab-${name}`;
      p.classList.toggle('active', on);
      if (on && crumb) crumb.textContent = p.dataset.title;
    });
  };
  tabButtons.forEach((b) => b.addEventListener('click', () => {
    window.activateTab(b.dataset.tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }));

  // ---------------- Sağlık kontrolü ----------------
  const dot = document.querySelector('#statusBadge .status-dot');
  const statusText = document.getElementById('statusText');
  fetch('/api/health')
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
    .then((d) => {
      if (d.status === 'online') {
        dot?.classList.add('online');
        statusText.textContent = 'Motor Aktif';
      }
    })
    .catch(() => {
      dot?.classList.remove('online');
      statusText.textContent = 'Çevrimdışı';
    });

  // ---------------- Pano: bağlantı yapıştır ----------------
  document.getElementById('pasteLinkBtn')?.addEventListener('click', async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!/^https?:\/\//i.test(text)) {
        window.showToast('Panoda geçerli bir bağlantı (http/https) bulunamadı.', 'info');
        return;
      }
      window.activateTab('downloader');
      const input = document.getElementById('urlInput');
      input.value = text;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('fetchBtn').click();
    } catch (err) {
      window.showToast('Pano erişimi reddedildi. Tarayıcı iznini kontrol edin.', 'error');
    }
  });

  // ---------------- Pano: görsel yapıştır ----------------
  document.addEventListener('paste', (e) => {
    const items = Array.from(e.clipboardData?.items || []);
    const imageItem = items.find((it) => it.kind === 'file' && it.type.startsWith('image/'));
    if (!imageItem) return;
    const blob = imageItem.getAsFile();
    if (!blob) return;
    e.preventDefault();
    const file = new File([blob], 'clipboard_image.png', { type: blob.type || 'image/png' });
    window.activateTab('image');
    if (typeof window.handleImageFiles === 'function') {
      window.handleImageFiles([file], true);
      window.showToast('Panodaki görsel kuyruğa eklendi.', 'success');
    }
  });

  // ---------------- Kart ışığı ----------------
  document.addEventListener('pointermove', (e) => {
    const card = e.target.closest?.('.card');
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - r.left}px`);
    card.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, { passive: true });
})();
