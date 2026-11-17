/* ==========================================================================
   Misacon — Çalışma Takipçisi (sekme 06)
   Dört haftalık çalışma süresi takvimi; kirito_data.json ve Telegram entegrasyonu.
   ========================================================================== */

(() => {
  'use strict';

  const CURRENT_USER = (document.body?.dataset?.username || 'kirito').trim().toLowerCase() || 'kirito';
  const STORAGE_KEY = `misacon_work_tracker_v1_${CURRENT_USER}`;
  const USER_DATA_FILE = `saves/${CURRENT_USER}_data.json`;
  const WEEKS = 4;
  const DAYS = 7;
  const MAX_MINUTES = Math.floor(Number.MAX_SAFE_INTEGER / (WEEKS * DAYS));

  const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

  const calendarBody   = document.getElementById('wt-calendar-body');
  const saveStatus     = document.getElementById('wt-save-status');
  const statusText     = document.getElementById('wt-status-text');
  const monthlyTotal   = document.getElementById('wt-monthly-total');
  const tableGrandTotal = document.getElementById('wt-table-grand-total');
  const clearDialog    = document.getElementById('wt-clear-dialog');
  const filledDaysEl   = document.getElementById('wt-filled-days');
  const rhythmPlotEl   = document.getElementById('wt-rhythm-plot');
  const saveButton     = document.getElementById('wt-save-button');
  const telegramButton = document.getElementById('wt-telegram-button');

  if (!calendarBody) return;

  const inputs      = [];
  const weekOutputs = [];
  const weekFills   = [];
  const rhythmBars  = [];
  let saveTimer     = null;
  let dirty         = false;

  function parseDuration(raw) {
    const text = raw.trim();
    if (text === '' || text === '-') return { kind: 'empty', minutes: 0 };
    let minutes;
    // Saat ve dakika ayrımı: 2:30, 2h30, 2.30, 2,30
    const clock = text.match(/^(\d+)\s*(?::|h|\.|,)\s*(\d{1,2})$/i);
    if (clock) {
      const h = Number(clock[1]);
      let mStr = clock[2];
      if (mStr.length === 1) mStr += '0';
      const rem = Number(mStr);
      if (rem > 59) return { kind: 'invalid', minutes: 0 };
      minutes = h * 60 + rem;
    } else if (/^\d+$/.test(text)) {
      minutes = Number(text) * 60;
    } else {
      return { kind: 'invalid', minutes: 0 };
    }
    if (!Number.isSafeInteger(minutes) || minutes < 0 || minutes > MAX_MINUTES)
      return { kind: 'invalid', minutes: 0 };
    return { kind: 'valid', minutes };
  }

  function formatDuration(minutes) {
    return Math.floor(minutes / 60) + ':' + String(minutes % 60).padStart(2, '0');
  }

  function setStatus(message, state = 'ready') {
    statusText.textContent = message;
    saveStatus.dataset.state = state;
  }

  // Tablo satır ve hücrelerini oluştur
  for (let week = 0; week < WEEKS; week++) {
    const row     = document.createElement('tr');
    const heading = document.createElement('th');
    heading.scope = 'row';
    heading.innerHTML =
      '<span class="wt-week-label">' +
        '<span class="wt-week-number" aria-hidden="true">0' + (week + 1) + '</span>' +
        (week + 1) + '. hafta' +
      '</span>';
    row.append(heading);
    inputs[week] = [];

    for (let day = 0; day < DAYS; day++) {
      const cell  = document.createElement('td');
      const input = document.createElement('input');
      input.type         = 'text';
      input.className    = 'wt-time-input';
      input.id           = 'wt-time-' + week + '-' + day;
      input.placeholder  = '—';
      input.autocomplete = 'off';
      input.spellcheck   = false;
      input.setAttribute('autocapitalize', 'off');
      input.setAttribute('aria-label', (week + 1) + '. hafta, ' + dayNames[day]);
      input.setAttribute('aria-describedby', 'wt-input-help');

      input.addEventListener('input',  () => { refresh(); scheduleSave(); });
      input.addEventListener('blur',   () => normalize(input));
      input.addEventListener('keydown', e => {
        if (e.isComposing || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
        let nw = week, nd = day;
        switch (e.key) {
          case 'Enter':
          case 'ArrowDown':  nw = Math.min(WEEKS - 1, week + 1); break;
          case 'ArrowUp':    nw = Math.max(0, week - 1);          break;
          case 'ArrowRight': nd = Math.min(DAYS - 1, day + 1);   break;
          case 'ArrowLeft':  nd = Math.max(0, day - 1);          break;
          case 'Home':       nd = 0;                               break;
          case 'End':        nd = DAYS - 1;                        break;
          case 'Escape':     e.preventDefault(); normalize(input); return;
          default: return;
        }
        e.preventDefault();
        inputs[nw][nd].focus();
      });

      cell.append(input);
      row.append(cell);
      inputs[week][day] = input;
    }

    const totalCell = document.createElement('td');
    totalCell.className = 'wt-week-total-cell';

    const output = document.createElement('output');
    output.className = 'wt-week-total';
    output.id = 'wt-week-total-' + week;
    output.setAttribute('aria-label', (week + 1) + '. hafta toplamı');
    output.setAttribute('aria-live', 'polite');
    output.setAttribute('aria-atomic', 'true');
    output.textContent = '0:00';

    const track = document.createElement('div');
    track.className = 'wt-total-track';
    track.setAttribute('aria-hidden', 'true');
    const fill = document.createElement('div');
    fill.className = 'wt-total-fill';
    track.append(fill);

    totalCell.append(output, track);
    row.append(totalCell);
    calendarBody.append(row);

    weekOutputs.push(output);
    weekFills.push(fill);
    rhythmBars.push(document.getElementById('wt-rhythm-' + week));
  }

  function refresh() {
    const totals = [];
    let filled = 0;

    for (let week = 0; week < WEEKS; week++) {
      let total = 0;
      for (const input of inputs[week]) {
        const parsed  = parseDuration(input.value);
        const invalid = parsed.kind === 'invalid';
        input.setAttribute('aria-invalid', String(invalid));
        input.setAttribute('aria-describedby',
          invalid ? 'wt-input-help wt-invalid-help' : 'wt-input-help');
        input.parentElement.classList.toggle('wt-invalid',   invalid);
        input.parentElement.classList.toggle('wt-has-value', parsed.kind === 'valid');
        if (parsed.kind === 'valid') { total += parsed.minutes; filled++; }
      }
      totals.push(total);
      const fmt = formatDuration(total);
      if (weekOutputs[week].textContent !== fmt) weekOutputs[week].textContent = fmt;
    }

    const monthly = totals.reduce((s, v) => s + v, 0);
    const fmt = formatDuration(monthly);
    if (monthlyTotal.textContent !== fmt) monthlyTotal.textContent = fmt;
    if (tableGrandTotal && tableGrandTotal.textContent !== fmt) tableGrandTotal.textContent = fmt;
    filledDaysEl.textContent = filled;

    const peak = Math.max(...totals);
    for (let w = 0; w < WEEKS; w++) {
      weekFills[w].style.width   = (monthly ? totals[w] / monthly * 100 : 0) + '%';
      rhythmBars[w].style.height = (peak    ? totals[w] / peak    * 100 : 0) + '%';
    }

    rhythmPlotEl.setAttribute('aria-label',
      peak
        ? totals.map((t, w) => (w + 1) + '. hafta: ' + formatDuration(t)).join('; ')
        : 'Henüz çalışma süresi girilmedi.');
  }

  function normalize(input) {
    const parsed = parseDuration(input.value);
    const next =
      parsed.kind === 'valid' ? formatDuration(parsed.minutes) :
      parsed.kind === 'empty' ? '' : input.value;
    if (next !== input.value) { input.value = next; scheduleSave(); }
    refresh();
  }

  function getFlatInputs() {
    const arr = [];
    for (let w = 0; w < WEEKS; w++) {
      for (let d = 0; d < DAYS; d++) {
        arr.push(inputs[w][d].value.trim());
      }
    }
    return arr;
  }

  function getWeekTotalsFormatted() {
    const totals = [];
    for (let w = 0; w < WEEKS; w++) {
      totals.push(weekOutputs[w].textContent.trim());
    }
    return totals;
  }

  function saveLocal() {
    clearTimeout(saveTimer);
    saveTimer = null;
    try {
      const flat = getFlatInputs();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(flat));
      dirty = false;
    } catch {}
  }

  function scheduleSave() {
    dirty = true;
    clearTimeout(saveTimer);
    setStatus('Değişiklikler var…', 'pending');
    saveTimer = setTimeout(saveLocal, 350);
  }

  // Sunucuya kaydet (saves/kirito_data.json ve Telegram bildirim)
  async function saveServer() {
    clearTimeout(saveTimer);
    saveTimer = null;
    dirty = false;

    saveLocal();

    const saveBtn = saveButton;
    const originalContent = saveBtn ? saveBtn.innerHTML : null;

    if (saveBtn) {
      saveBtn.disabled = true;
    }
    setStatus(`${USER_DATA_FILE} kaydediliyor ve Telegram bildiriliyor…`, 'pending');

    try {
      const flatInputs = getFlatInputs();
      const totals = getWeekTotalsFormatted();
      const grandTotal = monthlyTotal.textContent.trim();

      const response = await fetch('/api/tracker/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputs: flatInputs,
          totals: totals,
          grandTotal: grandTotal
        })
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Sunucu hatası');
      }

      let msg = `${result.path || USER_DATA_FILE} kaydedildi`;
      if (result.telegram_sent) {
        msg += ' • Telegram bildirildi';
      }
      setStatus(msg, 'saved');

      if (saveBtn) {
        saveBtn.classList.add('btn--success');
        saveBtn.innerHTML =
          '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>' +
          '<span class="btn__label">Kaydedildi!</span>';
        setTimeout(() => {
          saveBtn.classList.remove('btn--success');
          if (originalContent) saveBtn.innerHTML = originalContent;
          saveBtn.disabled = false;
        }, 2200);
      }
    } catch (err) {
      console.warn('Sunucuya kaydetme hatası:', err);
      setStatus('Yerel kaydedildi (sunucu/Telegram: ' + err.message + ')', 'error');
      if (saveBtn) {
        saveBtn.disabled = false;
        if (originalContent) saveBtn.innerHTML = originalContent;
      }
    }
  }

  // Tüm tabloyu Telegram'a rapor olarak gönder
  async function sendTelegramTable() {
    const btn = telegramButton;
    if (!btn || btn.disabled) return;

    const originalContent = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="btn__label">Gönderiliyor…</span>';
    setStatus('Telegram\'a tablo raporu gönderiliyor…', 'pending');

    try {
      const flatInputs = getFlatInputs();
      const totals = getWeekTotalsFormatted();
      const grandTotal = monthlyTotal.textContent.trim();

      const response = await fetch('/api/tracker/send-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputs: flatInputs,
          totals: totals,
          grandTotal: grandTotal
        })
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Telegram gönderilemedi');
      }

      setStatus('Tablo Telegram\'a başarıyla gönderildi!', 'saved');
      btn.classList.add('btn--success');
      btn.innerHTML =
        '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>' +
        '<span class="btn__label">Gönderildi!</span>';
      setTimeout(() => {
        btn.classList.remove('btn--success');
        btn.innerHTML = originalContent;
        btn.disabled = false;
      }, 2500);
    } catch (err) {
      alert('Telegram Gönderim Hatası: ' + err.message);
      setStatus('Telegram hatası: ' + err.message, 'error');
      btn.innerHTML = originalContent;
      btn.disabled = false;
    }
  }

  // Sunucudan (kirito_data.json) veya yerel depolamadan yükle
  async function load() {
    let serverLoaded = false;
    try {
      const res = await fetch('/api/tracker/load?t=' + Date.now());
      if (res.ok) {
        const result = await res.json();
        if (result.success && Array.isArray(result.data)) {
          for (let w = 0; w < WEEKS; w++) {
            for (let d = 0; d < DAYS; d++) {
              inputs[w][d].value = result.data[w * 7 + d] || '';
            }
          }
          serverLoaded = true;
          refresh();
          saveLocal();
          setStatus(`saves/${result.filename || (CURRENT_USER + '_data.json')} yüklendi`, 'saved');
          return;
        }
      }
    } catch {
      // Çevrimdışıysa devam et
    }

    // LocalStorage yedeğinden yükle
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw !== null) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved)) {
          for (let w = 0; w < WEEKS; w++) {
            for (let d = 0; d < DAYS; d++) {
              inputs[w][d].value = saved[w * 7 + d] || '';
            }
          }
        } else if (saved && typeof saved === 'object') {
          const cells = saved.cells || saved.c;
          if (cells) {
            inputs.forEach((row, w) => row.forEach((inp, d) => {
              inp.value = cells['c' + w + '-' + d] ?? '';
            }));
          }
        }
        refresh();
        setStatus('Yerel kayıt yüklendi', 'saved');
        return;
      }
    } catch {}

    setStatus('Hazır. İlk süreni ekle.', 'ready');
  }

  if (saveButton) {
    saveButton.addEventListener('click', saveServer);
  }

  if (telegramButton) {
    telegramButton.addEventListener('click', sendTelegramTable);
  }

  if (clearDialog) {
    document.getElementById('wt-clear-button').addEventListener('click', () => {
      clearDialog.returnValue = 'cancel';
      clearDialog.showModal();
    });

    clearDialog.addEventListener('close', () => {
      if (clearDialog.returnValue !== 'clear') return;
      clearTimeout(saveTimer);
      saveTimer = null;
      dirty = false;
      inputs.forEach(row => row.forEach(inp => { inp.value = ''; }));
      refresh();
      try {
        localStorage.removeItem(STORAGE_KEY);
        setStatus('Temizlendi', 'saved');
      } catch {}
      saveServer();
      inputs[0][0].focus();
    });
  }

  document.addEventListener('keydown', e => {
    const pane = document.getElementById('tab-tracker');
    if (!pane || !pane.classList.contains('active')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      saveServer();
    }
  });

  window.addEventListener('pagehide', () => { if (dirty) saveLocal(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && dirty) saveLocal();
  });

  load();
  refresh();
})();
