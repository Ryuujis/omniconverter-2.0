/* Sekme 3 — Belge & PDF Stüdyosu (4 mod) */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const PT = 0.3528; // 1 pt = 0.3528 mm

  // ---------------------------------------------------------------- yardımcılar
  const trSafe = (s) => String(s ?? '')
    .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
    .replace(/ş/g, 's').replace(/Ş/g, 'S')
    .replace(/ı/g, 'i').replace(/İ/g, 'I');
  const trDate = () => new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  const baseName = (name) => String(name || 'belge').replace(/\.[^.]+$/, '');
  const extOf = (name) => (String(name).match(/\.([^.]+)$/) || [, ''])[1].toLowerCase();
  const withPdf = (name, fallback) => {
    const n = String(name || '').trim() || fallback;
    return /\.pdf$/i.test(n) ? n : `${n}.pdf`;
  };

  function getJsPDF() {
    const ctor = window.jspdf && window.jspdf.jsPDF;
    if (!ctor) showToast('PDF kütüphanesi (jsPDF) yüklenemedi.', 'warning');
    return ctor;
  }

  const readText = (file) => file.text();
  const readDataUrl = (file) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('Dosya okunamadı'));
    r.readAsDataURL(file);
  });
  const loadImg = (src) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Görsel çözülemedi'));
    img.src = src;
  });

  async function readImageFile(file) {
    const dataUrl = await readDataUrl(file);
    const img = await loadImg(dataUrl);
    return { dataUrl, img, w: img.naturalWidth || img.width || 800, h: img.naturalHeight || img.height || 600 };
  }

  function toJpeg(img, w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return c.toDataURL('image/jpeg', 0.92);
  }

  function countWords(elements) {
    return elements.reduce((n, el) => {
      if (el.type === 'table') return n + el.rows.flat().join(' ').split(/\s+/).filter(Boolean).length;
      return n + String(el.text).split(/\s+/).filter(Boolean).length;
    }, 0);
  }

  // ---------------------------------------------------------------- ayrıştırma
  function wAttr(node, name) {
    return node.getAttributeNS(W_NS, name) ?? node.getAttribute(`w:${name}`);
  }

  function flagOn(rPr, tag) {
    const el = rPr && Array.from(rPr.children).find((c) => c.localName === tag);
    if (!el) return false;
    const v = wAttr(el, 'val');
    return !(v === '0' || v === 'false');
  }

  function parseDocxParagraph(p) {
    const styleEl = p.getElementsByTagNameNS(W_NS, 'pStyle')[0];
    const style = (styleEl ? wAttr(styleEl, 'val') : '') || '';
    const sl = style.toLowerCase();
    const runs = [];
    Array.from(p.getElementsByTagNameNS(W_NS, 'r')).forEach((r) => {
      let text = '';
      Array.from(r.childNodes).forEach((c) => {
        if (c.localName === 't') text += c.textContent;
        else if (c.localName === 'tab') text += '\t';
        else if (c.localName === 'br') text += '\n';
      });
      if (!text) return;
      const rPr = Array.from(r.children).find((c) => c.localName === 'rPr');
      runs.push({ text, bold: flagOn(rPr, 'b'), italic: flagOn(rPr, 'i') });
    });
    const text = runs.map((r) => r.text).join('').trim();
    if (!text) return null;
    if (['heading', 'baslik', 'title', 'subtitle'].some((k) => sl.includes(k))) {
      const level = sl.includes('2') ? 2 : sl.includes('3') ? 3 : 1;
      return { type: 'heading', level, text };
    }
    return { type: 'paragraph', text, runs };
  }

  async function parseDocx(file) {
    if (typeof JSZip === 'undefined') throw new Error('JSZip yok');
    const zip = await JSZip.loadAsync(file);
    const entry = zip.file('word/document.xml');
    if (!entry) throw new Error('word/document.xml bulunamadı');
    const xml = new DOMParser().parseFromString(await entry.async('string'), 'application/xml');
    if (xml.getElementsByTagName('parsererror').length) throw new Error('XML ayrıştırılamadı');
    const body = xml.getElementsByTagNameNS(W_NS, 'body')[0];
    const elements = [];
    Array.from(body ? body.children : []).forEach((node) => {
      if (node.localName === 'p') {
        const el = parseDocxParagraph(node);
        if (el) elements.push(el);
      } else if (node.localName === 'tbl') {
        const rows = Array.from(node.getElementsByTagNameNS(W_NS, 'tr')).map((tr) =>
          Array.from(tr.children).filter((c) => c.localName === 'tc').map((tc) =>
            Array.from(tc.getElementsByTagNameNS(W_NS, 't')).map((t) => t.textContent).join('').trim()));
        if (rows.length) elements.push({ type: 'table', rows });
      }
    });
    const images = [];
    const media = Object.keys(zip.files).filter((n) => n.startsWith('word/media/') && !zip.files[n].dir);
    for (const name of media) {
      const e = extOf(name);
      const mime = e === 'jpg' ? 'image/jpeg' : `image/${e}`;
      images.push({ name, dataUri: `data:${mime};base64,${await zip.file(name).async('base64')}` });
    }
    return { title: baseName(file.name), elements, images, word_count: countWords(elements) };
  }

  function parseTextLines(text) {
    const elements = [];
    String(text).split(/\r?\n/).forEach((line) => {
      const s = line.trim();
      if (!s) return;
      if (s.startsWith('#')) {
        const level = Math.min(3, s.match(/^#+/)[0].length);
        elements.push({ type: 'heading', level, text: s.replace(/^#+\s*/, '') });
      } else if (s.length >= 4 && s.length <= 49 && s === s.toLocaleUpperCase('tr-TR') && /\p{L}/u.test(s)) {
        elements.push({ type: 'heading', level: 1, text: s });
      } else {
        elements.push({ type: 'paragraph', text: s });
      }
    });
    return elements;
  }

  async function parseOnServer(file) {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/convert-document', { method: 'POST', body: form });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) throw new Error(json.error || `Sunucu hatası (${res.status})`);
    return { title: json.data.title, elements: json.data.elements, images: [], word_count: json.data.word_count };
  }

  const TEXT_EXTS = ['txt', 'md', 'markdown', 'csv', 'rtf', 'json', 'html'];

  async function parseDocument(file) {
    const ext = extOf(file.name);
    try {
      if (ext === 'docx') return await parseDocx(file);
      if (TEXT_EXTS.includes(ext)) {
        const elements = parseTextLines(await readText(file));
        return { title: baseName(file.name), elements, images: [], word_count: countWords(elements) };
      }
    } catch (err) {
      showToast('Tarayıcıda ayrıştırılamadı, sunucu ayrıştırıcısı deneniyor…', 'warning');
      return parseOnServer(file);
    }
    if (ext !== 'doc') showToast('Bilinmeyen biçim, sunucu ayrıştırıcısı deneniyor…', 'warning');
    return parseOnServer(file);
  }

  // ---------------------------------------------------------------- PDF yazımı
  function makeCursor(doc, margin) {
    const pageH = () => doc.internal.pageSize.getHeight();
    return {
      y: margin,
      ensure(h) {
        if (this.y + h > pageH() - margin) {
          doc.addPage();
          this.y = margin;
        }
      },
    };
  }

  function writeParagraph(doc, cur, text, o) {
    doc.setFont(o.font, o.style || 'normal');
    doc.setFontSize(o.size);
    const lh = o.size * PT * (o.lineFactor || 1.35);
    doc.splitTextToSize(trSafe(text), o.width).forEach((line) => {
      cur.ensure(lh);
      doc.text(line, o.x, cur.y, { baseline: 'top' });
      cur.y += lh;
    });
  }

  function writeTable(doc, cur, rows, o) {
    const cols = Math.max(...rows.map((r) => r.length), 1);
    const colW = o.width / cols;
    const cellH = 7.5;
    doc.setLineWidth(0.15);
    doc.setDrawColor(150, 150, 150);
    rows.forEach((row, ri) => {
      cur.ensure(cellH);
      for (let c = 0; c < cols; c++) {
        const x = o.x + c * colW;
        if (ri === 0) {
          doc.setFillColor(232, 228, 220);
          doc.rect(x, cur.y, colW, cellH, 'FD');
        } else {
          doc.rect(x, cur.y, colW, cellH, 'S');
        }
        doc.setFont(o.font, ri === 0 ? 'bold' : 'normal');
        doc.setFontSize(Math.max(8, o.size - 2));
        let text = trSafe(row[c] || '');
        if (text.length > 35) text = text.slice(0, 35);
        doc.text(text, x + 2, cur.y + cellH / 2, { baseline: 'middle', maxWidth: colW - 3 });
      }
      cur.y += cellH;
    });
    cur.y += 4;
  }

  function writeElements(doc, cur, elements, o) {
    elements.forEach((el) => {
      if (el.type === 'heading') {
        const add = el.level === 1 ? 5 : el.level === 2 ? 3 : 1;
        cur.y += 2;
        cur.ensure((o.size + add) * PT * 2);
        writeParagraph(doc, cur, el.text, { ...o, size: o.size + add, style: 'bold', lineFactor: 1.25 });
        cur.y += 1.5;
      } else if (el.type === 'table') {
        writeTable(doc, cur, el.rows, o);
      } else {
        const allBold = el.runs && el.runs.length && el.runs.every((r) => r.bold);
        writeParagraph(doc, cur, el.text, { ...o, style: allBold ? 'bold' : 'normal' });
        cur.y += o.size * PT * 0.7;
      }
    });
  }

  function addPageNumbers(doc) {
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(110, 110, 110);
      const w = doc.internal.pageSize.getWidth();
      const h = doc.internal.pageSize.getHeight();
      doc.text(`Sayfa ${i} / ${n}`, w / 2, h - 7, { align: 'center' });
    }
    doc.setTextColor(0, 0, 0);
  }

  function fitImage(doc, img, w, h, margin) {
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const aw = pw - margin * 2;
    const ah = ph - margin * 2;
    const ratio = Math.min(aw / w, ah / h);
    const dw = w * ratio;
    const dh = h * ratio;
    doc.addImage(toJpeg(img, w, h), 'JPEG', (pw - dw) / 2, (ph - dh) / 2, dw, dh, undefined, 'FAST');
  }

  // ---------------------------------------------------------------- mod geçişi
  document.querySelectorAll('.mode-btn').forEach((btn) => btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach((b) => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.pdf-mode').forEach((m) => m.classList.toggle('active', m.id === `mode-${btn.dataset.mode}`));
  }));

  // ================================================================ MOD 1
  const docState = { parsed: null };
  const docPreview = $('docPreview');

  function renderDocPreview() {
    const p = docState.parsed;
    if (!p) return;
    const parts = [];
    if ($('docHeader').value === 'yes') {
      parts.push(`<div class="pv-head"><span>${escapeHtml(p.title)}</span><span>${escapeHtml(trDate())}</span></div>`);
    }
    p.elements.slice(0, 40).forEach((el) => {
      if (el.type === 'heading') {
        const tag = `h${el.level || 1}`;
        parts.push(`<${tag}>${escapeHtml(el.text)}</${tag}>`);
      } else if (el.type === 'table') {
        const rows = el.rows.slice(0, 8).map((row, i) => {
          const cell = i === 0 ? 'th' : 'td';
          return `<tr>${row.map((c) => `<${cell}>${escapeHtml(c)}</${cell}>`).join('')}</tr>`;
        });
        parts.push(`<table>${rows.join('')}</table>`);
      } else if (el.runs && el.runs.length) {
        parts.push(`<p>${el.runs.map((r) => {
          let t = escapeHtml(r.text);
          if (r.bold) t = `<strong>${t}</strong>`;
          if (r.italic) t = `<em>${t}</em>`;
          return t;
        }).join('')}</p>`);
      } else {
        parts.push(`<p>${escapeHtml(el.text)}</p>`);
      }
    });
    if (p.elements.length > 40) {
      parts.push(`<p class="pv-more">… +${p.elements.length - 40} paragraf ve öğe daha mevcut</p>`);
    }
    if (!p.elements.length) parts.push('<p class="pv-more">Belgede okunabilir metin bulunamadı.</p>');
    docPreview.innerHTML = parts.join('');
    docPreview.scrollTop = 0;
  }

  async function handleDocFile(files) {
    const file = files[0];
    if (!file) return;
    $('docBadge').textContent = file.name;
    $('docMeta').textContent = 'Ayrıştırılıyor…';
    $('docCount').textContent = '';
    try {
      const parsed = await parseDocument(file);
      docState.parsed = parsed;
      const words = parsed.word_count || countWords(parsed.elements);
      $('docMeta').textContent = `${words.toLocaleString('tr-TR')} kelime • ~${Math.max(1, Math.round(words / 380))} sayfa`;
      $('docCount').textContent = `${parsed.elements.length} öğe`;
      $('docName').value = `${parsed.title}.pdf`;
      renderDocPreview();
      showToast(`${file.name} ayrıştırıldı.`, 'success');
    } catch (err) {
      docState.parsed = null;
      $('docBadge').textContent = 'Belge yok';
      $('docMeta').textContent = '';
      showToast(err.message || 'Belge okunamadı.', 'error');
    }
  }

  bindDropZone($('docDrop'), $('docInput'), handleDocFile);
  $('docHeader').addEventListener('change', renderDocPreview);

  $('docGenerate').addEventListener('click', () => {
    const p = docState.parsed;
    if (!p) { showToast('Önce bir belge yükleyin.', 'error'); return; }
    const JsPDF = getJsPDF();
    if (!JsPDF) return;
    const btn = $('docGenerate');
    setBusy(btn, true);
    setTimeout(() => {
      try {
        const [format, orientation] = $('docPage').value.split('-');
        const doc = new JsPDF({ unit: 'mm', format, orientation });
        const margin = Number($('docMargin').value);
        const size = Number($('docSize').value);
        const font = $('docFont').value;
        const width = doc.internal.pageSize.getWidth() - margin * 2;
        const cur = makeCursor(doc, margin);
        if ($('docHeader').value === 'yes') {
          writeParagraph(doc, cur, p.title, { font, size: size + 5, style: 'bold', x: margin, width, lineFactor: 1.2 });
          cur.y += 1;
          writeParagraph(doc, cur, trDate(), { font, size: 9, x: margin, width });
          cur.y += 2;
          doc.setLineWidth(0.3);
          doc.setDrawColor(120, 120, 120);
          doc.line(margin, cur.y, margin + width, cur.y);
          cur.y += 6;
        }
        writeElements(doc, cur, p.elements, { font, size, x: margin, width });
        if ($('docPageNum').value === 'yes') addPageNumbers(doc);
        doc.save(withPdf($('docName').value, p.title));
        showToast('PDF oluşturuldu.', 'success');
      } catch (err) {
        showToast(`PDF oluşturulamadı: ${err.message}`, 'error');
      } finally {
        setBusy(btn, false);
      }
    }, 30);
  });

  // Liste yeniden çizildiğinde giriş animasyonu yalnız yeni öğelerde oynar.
  const entered = new WeakSet();
  function enterOnce(el, item, i) {
    if (entered.has(item)) el.style.animation = 'none';
    else el.style.animationDelay = `${Math.min(i, 12) * 35}ms`;
    entered.add(item);
  }

  // ================================================================ MOD 2
  const pimgItems = [];
  const pimgList = $('pimgList');
  const pimgEmptyHtml = pimgList.innerHTML;

  function renderPimg() {
    $('pimgBadge').textContent = `${pimgItems.length} sayfa`;
    $('pimgActions').hidden = !pimgItems.length;
    if (!pimgItems.length) { pimgList.innerHTML = pimgEmptyHtml; return; }
    pimgList.innerHTML = '';
    pimgItems.forEach((it, i) => {
      const el = document.createElement('div');
      el.className = 'page';
      enterOnce(el, it, i);
      el.innerHTML =
        `<div class="page__sheet"><img src="${it.dataUrl}" alt=""></div>` +
        `<div class="page__foot"><span class="page__num">Sayfa ${i + 1}<b>${it.w}×${it.h}</b></span>` +
        '<button class="icon-btn" type="button" aria-label="Kaldır"><svg class="ico"><use href="#i-close"/></svg></button></div>';
      el.querySelector('button').addEventListener('click', () => {
        pimgItems.splice(pimgItems.indexOf(it), 1);
        renderPimg();
      });
      pimgList.appendChild(el);
    });
  }

  async function addPimg(files) {
    const imgs = files.filter((f) => f.type.startsWith('image/'));
    if (!imgs.length) { showToast('Yalnızca görsel dosyaları eklenebilir.', 'error'); return; }
    for (const file of imgs) {
      try {
        const { dataUrl, img, w, h } = await readImageFile(file);
        pimgItems.push({ file, name: file.name, dataUrl, img, w, h });
      } catch (err) {
        showToast(`${file.name}: ${err.message}`, 'error');
      }
    }
    renderPimg();
    showToast(`${imgs.length} görsel sayfa olarak eklendi.`, 'success');
  }

  bindDropZone($('pimgDrop'), $('pimgInput'), addPimg);
  $('pimgClear').addEventListener('click', () => { pimgItems.length = 0; renderPimg(); });

  $('pimgGenerate').addEventListener('click', () => {
    if (!pimgItems.length) { showToast('Önce görsel ekleyin.', 'error'); return; }
    const JsPDF = getJsPDF();
    if (!JsPDF) return;
    const btn = $('pimgGenerate');
    setBusy(btn, true);
    setTimeout(() => {
      try {
        const page = $('pimgPage').value;
        const orientation = $('pimgOrient').value;
        const margin = Number($('pimgMargin').value);
        let doc;
        pimgItems.forEach((it, i) => {
          if (page === 'fit') {
            const o = it.w > it.h ? 'l' : 'p';
            if (i === 0) doc = new JsPDF({ unit: 'px', format: [it.w, it.h], orientation: o, hotfixes: ['px_scaling'] });
            else doc.addPage([it.w, it.h], o);
            const pw = doc.internal.pageSize.getWidth();
            const ph = doc.internal.pageSize.getHeight();
            doc.addImage(toJpeg(it.img, it.w, it.h), 'JPEG', 0, 0, pw, ph, undefined, 'FAST');
          } else {
            if (i === 0) doc = new JsPDF({ unit: 'mm', format: page, orientation });
            else doc.addPage(page, orientation);
            fitImage(doc, it.img, it.w, it.h, margin);
          }
        });
        doc.save(withPdf($('pimgName').value, 'gorseller_belgesi'));
        showToast(`${pimgItems.length} sayfalık PDF oluşturuldu.`, 'success');
      } catch (err) {
        showToast(`PDF oluşturulamadı: ${err.message}`, 'error');
      } finally {
        setBusy(btn, false);
      }
    }, 30);
  });

  // ================================================================ MOD 3
  const txtBody = $('txtBody');
  const TEMPLATES = {
    blank: () => '',
    petition: () => [
      '# ………………………… MÜDÜRLÜĞÜNE',
      '',
      'KONU: ……………………………… hakkında.',
      '',
      `${trDate()} tarihinde kurumunuza yaptığım başvuru ile ilgili olarak aşağıdaki hususları bilgilerinize sunarım.`,
      '',
      'Talebimin değerlendirilerek gereğinin yapılmasını, sonucundan tarafıma yazılı olarak bilgi verilmesini saygılarımla arz ederim.',
      '',
      '# EKLER',
      '1. Nüfus cüzdanı fotokopisi',
      '2. İlgili belge örneği',
      '',
      '# İLETİŞİM',
      'Adres: …………………………………………………',
      'Telefon: 0 (5__) ___ __ __',
      'E-posta: ……………@……………',
      '',
      '',
      'Ad Soyad: ……………………',
      'İmza: ……………………',
    ].join('\n'),
    minutes: () => [
      '# TOPLANTI TUTANAĞI',
      `Tarih: ${trDate()}`,
      'Yer: ……………………',
      '',
      '# KATILIMCILAR',
      '- ……………………',
      '- ……………………',
      '',
      '# GÜNDEM',
      '1. Önceki toplantı kararlarının değerlendirilmesi',
      '2. Proje durum raporu',
      '3. Dilek ve öneriler',
      '',
      '# ALINAN KARARLAR',
      '1. ……………………',
      '2. ……………………',
      '',
      '# SONRAKİ ADIMLAR',
      '- Sorumlu: …………  Teslim: …………',
      '- Bir sonraki toplantı tarihi: …………',
    ].join('\n'),
    code: () => [
      '# KOD / NOT DÖKÜMÜ',
      `Oluşturulma: ${trDate()}`,
      '',
      '# ÖRNEK KOD',
      'function convert(file, format) {',
      '    const result = engine.process(file, { target: format });',
      '    return result.ok ? result.blob : null;',
      '}',
      '',
      '# SİSTEM DURUMU',
      'Dönüştürme motoru aktif. Tüm işlemler yerel olarak tamamlandı; harici bir sunucuya veri gönderilmedi.',
    ].join('\n'),
  };

  const updateWords = () => {
    $('txtWords').textContent = (txtBody.value.trim().match(/\S+/g) || []).length;
  };
  txtBody.addEventListener('input', updateWords);
  document.querySelectorAll('.tpl-btn').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('.tpl-btn').forEach((x) => x.classList.toggle('active', x === b));
    txtBody.value = TEMPLATES[b.dataset.tpl]();
    updateWords();
    txtBody.focus();
  }));
  $('txtClear').addEventListener('click', () => { txtBody.value = ''; updateWords(); });

  $('txtGenerate').addEventListener('click', () => {
    const body = txtBody.value;
    if (!body.trim()) { showToast('Önce bir metin yazın.', 'error'); return; }
    const JsPDF = getJsPDF();
    if (!JsPDF) return;
    const btn = $('txtGenerate');
    setBusy(btn, true);
    setTimeout(() => {
      try {
        const title = $('txtTitle').value.trim() || 'Resmi Yazışma Belgesi';
        const author = $('txtAuthor').value.trim() || 'Misacon Kullanıcısı';
        const doc = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'p' });
        const margin = 15;
        const width = doc.internal.pageSize.getWidth() - margin * 2;
        const cur = makeCursor(doc, margin);
        const base = { font: 'helvetica', x: margin, width };
        writeParagraph(doc, cur, title, { ...base, size: 14, style: 'bold' });
        cur.y += 1;
        writeParagraph(doc, cur, `${author}  •  ${trDate()}`, { ...base, size: 9 });
        cur.y += 2;
        doc.setLineWidth(0.3);
        doc.setDrawColor(120, 120, 120);
        doc.line(margin, cur.y, margin + width, cur.y);
        cur.y += 6;
        body.split(/\r?\n/).forEach((raw) => {
          const s = raw.trim();
          if (!s) { cur.y += 3; return; }
          const upper = s.length >= 4 && s.length <= 49 && s === s.toLocaleUpperCase('tr-TR') && /\p{L}/u.test(s);
          if (s.startsWith('#') || upper) {
            cur.y += 1.5;
            writeParagraph(doc, cur, s.replace(/^#+\s*/, ''), { ...base, size: 12, style: 'bold' });
            cur.y += 1;
          } else {
            writeParagraph(doc, cur, raw.replace(/\s+$/, ''), { ...base, size: 11 });
          }
        });
        addPageNumbers(doc);
        doc.save(`${title.replace(/[^\p{L}\p{N}]/gu, '_')}.pdf`);
        showToast('PDF oluşturuldu.', 'success');
      } catch (err) {
        showToast(`PDF oluşturulamadı: ${err.message}`, 'error');
      } finally {
        setBusy(btn, false);
      }
    }, 30);
  });
  updateWords();

  // ================================================================ MOD 4
  const mergeItems = [];
  const mergeList = $('mergeList');

  function renderMerge() {
    $('mergeBadge').textContent = `${mergeItems.length} dosya`;
    $('mergeEmpty').hidden = mergeItems.length > 0;
    mergeList.innerHTML = '';
    mergeItems.forEach((it, i) => {
      const li = document.createElement('li');
      li.className = 'merge-item';
      enterOnce(li, it, i);
      const isImg = it.kind === 'image';
      li.innerHTML =
        `<span class="merge-item__idx">${String(i + 1).padStart(2, '0')}</span>` +
        `<span class="merge-item__thumb">${isImg ? `<img src="${it.dataUrl}" alt="">` : '<svg class="ico"><use href="#i-doc"/></svg>'}</span>` +
        `<span style="min-width:0"><span class="merge-item__name" title="${escapeHtml(it.name)}">${escapeHtml(it.name)}</span>` +
        `<span class="merge-item__meta"><span class="kind kind--${isImg ? 'img' : 'doc'}">${isImg ? '🖼️ Görsel Sayfası' : '📄 Belge İçeriği'}</span>${formatBytes(it.size)}</span></span>` +
        '<button class="icon-btn" type="button" aria-label="Kaldır"><svg class="ico"><use href="#i-close"/></svg></button>';
      li.querySelector('button').addEventListener('click', () => {
        mergeItems.splice(mergeItems.indexOf(it), 1);
        renderMerge();
      });
      mergeList.appendChild(li);
    });
  }

  async function addMerge(files) {
    let added = 0;
    for (const file of files) {
      const ext = extOf(file.name);
      try {
        if (file.type.startsWith('image/')) {
          const { dataUrl, img, w, h } = await readImageFile(file);
          mergeItems.push({ kind: 'image', name: file.name, size: file.size, dataUrl, img, w, h });
        } else if (ext === 'docx') {
          const parsed = await parseDocx(file);
          mergeItems.push({ kind: 'doc', name: file.name, size: file.size, elements: parsed.elements });
        } else if (['txt', 'md', 'rtf'].includes(ext)) {
          const elements = (await readText(file)).split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
            .map((text) => ({ type: 'paragraph', text }));
          mergeItems.push({ kind: 'doc', name: file.name, size: file.size, elements });
        } else {
          const parsed = await parseOnServer(file);
          mergeItems.push({ kind: 'doc', name: file.name, size: file.size, elements: parsed.elements });
        }
        added++;
      } catch (err) {
        showToast(`${file.name}: ${err.message}`, 'error');
      }
    }
    renderMerge();
    if (added) showToast(`${added} dosya birleştirme listesine eklendi.`, 'success');
  }

  bindDropZone($('mergeDrop'), $('mergeInput'), addMerge);

  $('mergeGenerate').addEventListener('click', () => {
    if (!mergeItems.length) { showToast('Önce dosya ekleyin.', 'error'); return; }
    const JsPDF = getJsPDF();
    if (!JsPDF) return;
    const btn = $('mergeGenerate');
    setBusy(btn, true);
    setTimeout(() => {
      try {
        const doc = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'p' });
        const margin = 15;
        const width = doc.internal.pageSize.getWidth() - margin * 2;
        mergeItems.forEach((it, i) => {
          if (i > 0) doc.addPage('a4', 'p');
          if (it.kind === 'image') {
            fitImage(doc, it.img, it.w, it.h, margin);
            return;
          }
          const cur = makeCursor(doc, margin);
          const base = { font: 'helvetica', x: margin, width };
          writeParagraph(doc, cur, it.name, { ...base, size: 13, style: 'bold' });
          cur.y += 1.5;
          doc.setLineWidth(0.3);
          doc.setDrawColor(120, 120, 120);
          doc.line(margin, cur.y, margin + width, cur.y);
          cur.y += 5;
          it.elements.forEach((el) => {
            const text = el.type === 'table' ? el.rows.map((r) => r.join(' | ')).join('\n') : el.text;
            String(text).split('\n').forEach((line) => writeParagraph(doc, cur, line, { ...base, size: 10 }));
            cur.y += 1.5;
          });
        });
        doc.save('birlestirilmis_belge.pdf');
        showToast(`${mergeItems.length} dosya tek PDF'te birleştirildi.`, 'success');
      } catch (err) {
        showToast(`PDF oluşturulamadı: ${err.message}`, 'error');
      } finally {
        setBusy(btn, false);
      }
    }, 30);
  });

  renderMerge();
})();
