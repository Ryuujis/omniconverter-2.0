/* Sekme 4 — Videodan Ses Çıkarma (tamamen tarayıcıda) */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const info = $('audInfo');
  const status = $('audStatus');
  const player = $('audPlayer');
  const downloadBtn = $('audDownload');
  const canvas = $('audWave');
  const idle = $('audIdle');
  const steps = document.querySelectorAll('#audSteps li');

  let wavBlob = null;
  let wavName = 'audio.wav';
  let objectUrl = null;

  function setStatus(text, tone) {
    status.textContent = text;
    status.dataset.tone = tone;
  }

  function setStep(n) {
    steps.forEach((li) => {
      const s = Number(li.dataset.step);
      li.classList.toggle('is-done', s < n);
      li.classList.toggle('is-active', s === n);
    });
  }

  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)));

  function fmtDuration(sec) {
    const s = Math.round(sec);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  function encodeWav(buffer) {
    const channels = buffer.numberOfChannels;
    const rate = buffer.sampleRate;
    const frames = buffer.length;
    const dataSize = frames * channels * 2;
    const view = new DataView(new ArrayBuffer(44 + dataSize));
    const writeStr = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };

    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, rate, true);
    view.setUint32(28, rate * channels * 2, true);
    view.setUint16(32, channels * 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, dataSize, true);

    const data = [];
    for (let c = 0; c < channels; c++) data.push(buffer.getChannelData(c));
    let offset = 44;
    for (let i = 0; i < frames; i++) {
      for (let c = 0; c < channels; c++) {
        const s = Math.max(-1, Math.min(1, data[c][i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        offset += 2;
      }
    }
    return new Blob([view], { type: 'audio/wav' });
  }

  function drawWave(buffer) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    const data = buffer.getChannelData(0);
    const bars = Math.max(40, Math.floor(w / 4));
    const step = Math.floor(data.length / bars) || 1;
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#ff7b55');
    grad.addColorStop(1, '#ff3d6e');
    const mid = h / 2;
    const peaks = [];
    let max = 0.0001;
    for (let b = 0; b < bars; b++) {
      let peak = 0;
      const start = b * step;
      for (let i = start; i < start + step && i < data.length; i += 16) peak = Math.max(peak, Math.abs(data[i]));
      peaks.push(peak);
      max = Math.max(max, peak);
    }
    const bw = w / bars;
    peaks.forEach((p, b) => {
      const bh = Math.max(2, (p / max) * (h * 0.82));
      ctx.fillStyle = grad;
      ctx.globalAlpha = 0.35 + 0.65 * (p / max);
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(b * bw + 1, mid - bh / 2, Math.max(1.5, bw - 2), bh, 2);
      else ctx.rect(b * bw + 1, mid - bh / 2, Math.max(1.5, bw - 2), bh);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    idle.hidden = true;
  }

  function reset() {
    wavBlob = null;
    downloadBtn.disabled = true;
    player.hidden = true;
    player.removeAttribute('src');
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
    idle.hidden = false;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  async function handleFiles(files) {
    const file = files[0];
    if (!file) return;
    if (!file.type.startsWith('video/') && !/\.(mp4|webm|mov|mkv|avi|m4v)$/i.test(file.name)) {
      showToast('Lütfen bir video dosyası seçin.', 'error');
      return;
    }
    reset();
    wavName = `${file.name.replace(/\.[^.]+$/, '') || 'video'}_audio.wav`;
    info.textContent = `${file.name} · ${formatBytes(file.size)}`;
    setStep(1);
    setStatus('Video yükleniyor ve ses kanalı çözülüyor…', 'info');
    const Ctx = window.AudioContext || window.webkitAudioContext;
    let ctx;
    try {
      await nextFrame();
      const arrayBuffer = await file.arrayBuffer();
      ctx = new Ctx();
      setStep(2);
      setStatus('Ses akışı ayrıştırılıyor (PCM Decode)…', 'info');
      const buffer = await ctx.decodeAudioData(arrayBuffer);
      info.textContent = `${file.name} · ${fmtDuration(buffer.duration)} · ${buffer.numberOfChannels} kanal · ${buffer.sampleRate.toLocaleString('tr-TR')} Hz`;
      drawWave(buffer);
      setStep(3);
      setStatus('WAV formatına kodlanıyor…', 'info');
      await nextFrame();
      wavBlob = encodeWav(buffer);
      objectUrl = URL.createObjectURL(wavBlob);
      player.src = objectUrl;
      player.hidden = false;
      downloadBtn.disabled = false;
      setStep(4);
      setStatus(`Hazır! (${formatBytes(wavBlob.size)})`, 'ok');
      showToast('Ses kanalı WAV olarak hazır.', 'success');
    } catch (err) {
      setStep(0);
      setStatus('Hata: Videoda ses kanalı bulunamadı veya biçim desteklenmiyor.', 'bad');
      showToast('Ses çıkarılamadı.', 'error');
    } finally {
      if (ctx && ctx.close) ctx.close();
    }
  }

  bindDropZone($('audDrop'), $('audInput'), handleFiles);
  downloadBtn.addEventListener('click', () => { if (wavBlob) downloadBlob(wavBlob, wavName); });
})();
