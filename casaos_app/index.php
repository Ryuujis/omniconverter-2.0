<?php
session_start();

$valid_user = 'kirito';
$valid_pass = 'asuna<3kirito';

if (isset($_GET['logout'])) {
    session_destroy();
    header("Location: index.php");
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['login'])) {
    $username = $_POST['username'] ?? '';
    $password = $_POST['password'] ?? '';
    
    if ($username === $valid_user && $password === $valid_pass) {
        $_SESSION['logged_in'] = true;
        header("Location: index.php");
        exit;
    } else {
        $error = "Hatali kullanici adi veya sifre!";
    }
}
?>
<!doctype html>
<html lang="tr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Kişisel Dashboard</title>
    <style>
      :root {
        --bg-color: #0f172a;
        --glass-bg: rgba(30, 41, 59, 0.7);
        --glass-border: rgba(255, 255, 255, 0.08);
        --accent: #38bdf8;
        --text: #f8fafc;
        --kirito-bg: #0a0f1c;
        --kirito-cyan: #00e5ff;
        --kirito-red: #f43f5e;
        --kirito-box: #050810;
      }
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      }
      body {
        background: linear-gradient(135deg, #0f172a, #1e1b4b, #0f172a);
        color: var(--text);
        min-height: 100vh;
        padding: 2rem;
      }
      .main-header {
        text-align: center;
        margin-bottom: 2rem;
      }
      .main-header h1 {
        font-weight: 400;
        letter-spacing: 3px;
        color: var(--accent);
        font-size: 2rem;
      }
      .dashboard-grid {
        display: grid;
        grid-template-columns: 1.2fr 1fr;
        gap: 2rem;
        max-width: 1400px;
        margin: 0 auto;
      }
      .left-column,
      .right-column {
        display: flex;
        flex-direction: column;
        gap: 2rem;
      }
      .full-width-card {
        grid-column: 1 / -1;
      }
      .card {
        background: var(--glass-bg);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid var(--glass-border);
        border-radius: 16px;
        padding: 2rem;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
      }
      .card h2 {
        font-size: 1.3rem;
        font-weight: 500;
        color: var(--accent);
        margin-bottom: 1.5rem;
        border-bottom: 1px solid var(--glass-border);
        padding-bottom: 0.5rem;
      }
      .form-group {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        margin-bottom: 1rem;
      }
      .flex-inputs {
        display: flex;
        gap: 1rem;
      }
      .flex-inputs > * {
        flex: 1;
      }
      input, select, button, textarea {
        padding: 0.9rem;
        border-radius: 10px;
        border: 1px solid var(--glass-border);
        outline: none;
        background: rgba(15, 23, 42, 0.6);
        color: var(--text);
        font-size: 1rem;
        transition: all 0.3s ease;
      }
      input:focus, select:focus, textarea:focus {
        border-color: var(--accent);
        box-shadow: 0 0 10px rgba(56, 189, 248, 0.2);
      }
      button {
        background: var(--accent);
        color: #0f172a;
        font-weight: 600;
        cursor: pointer;
        border: none;
      }
      button:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 5px 15px rgba(56, 189, 248, 0.4);
      }
      .game-wrapper {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
      }
      canvas {
        background-color: #020617;
        border: 2px solid var(--glass-border);
        border-radius: 12px;
        display: block;
        image-rendering: pixelated;
        box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.8);
      }
      textarea {
        width: 100%;
        resize: none;
        line-height: 1.5;
      }
      .timer-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        background: var(--kirito-bg);
        border: 1px solid rgba(0, 229, 255, 0.2);
        padding: 3rem;
        border-radius: 16px;
      }
      .flip-clock {
        display: flex;
        gap: 1.5rem;
        align-items: center;
        justify-content: center;
        margin-bottom: 3rem;
      }
      .flip-group {
        display: flex;
        gap: 0.5rem;
      }
      .flip-card {
        position: relative;
        width: 120px;
        height: 160px;
        background: #050810;
        border: 2px solid var(--kirito-cyan);
        border-radius: 12px;
        font-size: 6rem;
        font-weight: 700;
        color: var(--text);
        display: flex;
        justify-content: center;
        align-items: center;
        box-shadow: 0 10px 30px rgba(0, 229, 255, 0.1);
        overflow: hidden;
        perspective: 1000px;
      }
      .flip-card.flip-anim .digit {
        animation: flipDown 0.6s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .digit {
        position: absolute;
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        transform-origin: center;
      }
      @keyframes flipDown {
        0% { transform: rotateX(90deg) scaleY(1.1); opacity: 0; }
        100% { transform: rotateX(0deg) scaleY(1); opacity: 1; }
      }
      .colon {
        font-size: 6rem;
        color: var(--kirito-cyan);
        font-weight: bold;
        animation: pulse 1s infinite alternate;
      }
      @keyframes pulse {
        0% { opacity: 0.5; }
        100% { opacity: 1; text-shadow: 0 0 20px var(--kirito-cyan); }
      }
      .timer-controls {
        display: flex;
        gap: 2rem;
      }
      .timer-controls button {
        padding: 1.5rem 4rem;
        font-size: 1.2rem;
        border-radius: 8px;
        letter-spacing: 2px;
        text-transform: uppercase;
      }
      .kirito-container {
        background: var(--kirito-bg);
        border: 1px solid rgba(0, 229, 255, 0.2);
        width: 100%;
      }
      .kirito-header-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 2rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        padding-bottom: 1rem;
      }
      .kirito-header-top h2 {
        color: var(--kirito-cyan);
        border: none;
        margin: 0;
        padding: 0;
        font-size: 1.5rem;
        letter-spacing: 2px;
        text-transform: uppercase;
      }
      .btn-outline-red {
        background: transparent;
        color: var(--kirito-red);
        border: 1px solid var(--kirito-red);
      }
      .btn-outline-red:hover {
        background: rgba(244, 63, 94, 0.1);
        box-shadow: 0 0 10px rgba(244, 63, 94, 0.2);
      }
      .kirito-grid {
        display: grid;
        grid-template-columns: 60px repeat(7, minmax(0, 1fr)) 100px;
        gap: 0.5rem;
        align-items: center;
        margin-bottom: 1.5rem;
        width: 100%;
      }
      .kirito-grid-header {
        color: var(--kirito-cyan);
        font-size: 0.8rem;
        font-weight: 600;
        text-align: center;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-bottom: 0.5rem;
      }
      .kirito-row-label {
        font-weight: 600;
        font-size: 0.9rem;
        line-height: 1.2;
        text-align: center;
      }
      .kirito-input {
        width: 100%;
        min-width: 0;
        background: var(--kirito-box);
        border: 1px solid rgba(255, 255, 255, 0.05);
        color: var(--text);
        text-align: center;
        font-size: 1rem;
        padding: 1rem 0;
        border-radius: 6px;
      }
      .kirito-input:focus {
        border-color: var(--kirito-cyan);
        box-shadow: none;
      }
      .kirito-row-total {
        color: var(--kirito-cyan);
        font-weight: 700;
        font-size: 1.2rem;
        text-align: center;
      }
      .kirito-footer {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        margin-top: 3rem;
        border-top: 1px solid rgba(255, 255, 255, 0.05);
        padding-top: 2rem;
      }
      .kirito-actions {
        display: flex;
        gap: 1rem;
      }
      .btn-outline-cyan {
        background: transparent;
        color: var(--kirito-cyan);
        border: 1px solid var(--kirito-cyan);
      }
      .btn-outline-cyan:hover:not(:disabled) {
        background: rgba(0, 229, 255, 0.1);
        box-shadow: 0 0 10px rgba(0, 229, 255, 0.2);
      }
      .kirito-grand-total-box {
        background: var(--kirito-box);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        padding: 1.5rem 2rem;
        display: flex;
        align-items: center;
        gap: 2rem;
      }
      .kirito-grand-label {
        color: #94a3b8;
        font-size: 0.9rem;
        letter-spacing: 1px;
        text-transform: uppercase;
      }
      .kirito-grand-value {
        color: var(--kirito-cyan);
        font-size: 3rem;
        font-weight: 700;
        text-shadow: 0 0 20px rgba(0, 229, 255, 0.3);
        line-height: 1;
      }
      .calculator {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        background: var(--kirito-box);
        padding: 1.5rem;
        border-radius: 12px;
        border: 1px solid rgba(0, 229, 255, 0.2);
      }
      .calc-display {
        background: #020617;
        color: var(--kirito-cyan);
        font-size: 2.5rem;
        text-align: right;
        padding: 1rem;
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.05);
        min-height: 80px;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        overflow-x: auto;
        text-shadow: 0 0 10px rgba(0, 229, 255, 0.3);
        word-break: break-all;
      }
      .calc-buttons {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 0.8rem;
      }
      .calc-btn {
        background: rgba(30, 41, 59, 0.8);
        border: 1px solid var(--glass-border);
        padding: 1rem;
        font-size: 1.2rem;
        border-radius: 8px;
        color: var(--text);
        transition: all 0.2s;
      }
      .calc-btn:hover {
        background: rgba(56, 189, 248, 0.2);
        border-color: var(--accent);
        transform: translateY(-2px);
      }
      .calc-op {
        color: var(--accent);
        font-weight: bold;
      }
      .calc-clear, .calc-delete {
        color: var(--kirito-red);
      }
      .calc-clear:hover, .calc-delete:hover {
        background: rgba(244, 63, 94, 0.1);
        border-color: var(--kirito-red);
      }
      .calc-equal {
        background: rgba(0, 229, 255, 0.1);
        color: var(--kirito-cyan);
        border-color: var(--kirito-cyan);
      }
      .calc-equal:hover {
        background: rgba(0, 229, 255, 0.2);
        box-shadow: 0 0 15px rgba(0, 229, 255, 0.3);
      }
      .login-container {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 80vh;
      }
      .login-card {
        background: var(--glass-bg);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid var(--kirito-cyan);
        border-radius: 16px;
        padding: 3rem;
        width: 100%;
        max-width: 400px;
        box-shadow: 0 0 30px rgba(0, 229, 255, 0.2);
        text-align: center;
      }
      .login-card h2 {
        color: var(--kirito-cyan);
        margin-bottom: 2rem;
        font-size: 1.8rem;
        letter-spacing: 2px;
        text-transform: uppercase;
      }
      .login-form {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
      }
      .login-input {
        background: var(--kirito-box);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: var(--text);
        padding: 1rem;
        border-radius: 8px;
        font-size: 1.1rem;
        text-align: center;
      }
      .login-input:focus {
        border-color: var(--kirito-cyan);
        box-shadow: 0 0 10px rgba(0, 229, 255, 0.2);
      }
      .login-btn {
        background: rgba(0, 229, 255, 0.1);
        color: var(--kirito-cyan);
        border: 1px solid var(--kirito-cyan);
        padding: 1rem;
        border-radius: 8px;
        font-size: 1.1rem;
        font-weight: bold;
        letter-spacing: 1px;
        cursor: pointer;
        transition: all 0.3s;
      }
      .login-btn:hover {
        background: rgba(0, 229, 255, 0.2);
        box-shadow: 0 0 15px rgba(0, 229, 255, 0.3);
      }
      .error-msg {
        color: var(--kirito-red);
        margin-bottom: 1rem;
        font-size: 0.9rem;
      }
      @media (max-width: 1024px) {
        .dashboard-grid { grid-template-columns: 1fr; }
        .kirito-grid { overflow-x: auto; white-space: nowrap; padding-bottom: 1rem; }
        .kirito-footer { flex-direction: column; gap: 2rem; align-items: stretch; }
        .kirito-grand-total-box { justify-content: space-between; }
        .flip-clock { transform: scale(0.6); }
      }
    </style>
  </head>
  <body>
    <?php if (!isset($_SESSION['logged_in']) || $_SESSION['logged_in'] !== true): ?>
    
    <div class="login-container">
      <div class="login-card">
        <h2>SISTEM GIRISI</h2>
        <?php if (isset($error)): ?>
          <div class="error-msg"><?php echo htmlspecialchars($error); ?></div>
        <?php endif; ?>
        <form method="POST" class="login-form">
          <input type="hidden" name="login" value="1">
          <input type="text" name="username" class="login-input" placeholder="Kullanici Adi" required autofocus>
          <input type="password" name="password" class="login-input" placeholder="Sifre" required>
          <button type="submit" class="login-btn">GIRIS YAP</button>
        </form>
      </div>
    </div>
    
    <?php else: ?>

    <header class="main-header">
      <h1>KİŞİSEL WORKSPACE & DASHBOARD</h1>
    </header>
    <div class="dashboard-grid">
      <div class="left-column">
        <div class="card">
          <h2>Hava Kuvvetleri (Büyük Ekran)</h2>
          <div class="game-wrapper">
            <canvas id="gameCanvas" width="400" height="400"></canvas>
            <button onclick="startGame()" style="width: 100%">Oyunu Başlat / Sıfırla</button>
          </div>
        </div>
        <div class="card">
          <h2>Dijital Hesap Makinesi</h2>
          <div class="calculator">
            <div class="calc-display" id="calcDisplay">0</div>
            <div class="calc-buttons">
              <button class="calc-btn calc-clear" onclick="calcInput('C')">C</button>
              <button class="calc-btn calc-op" onclick="calcInput('/')">/</button>
              <button class="calc-btn calc-op" onclick="calcInput('*')">x</button>
              <button class="calc-btn calc-delete" onclick="calcInput('DEL')">DEL</button>
              <button class="calc-btn" onclick="calcInput('7')">7</button>
              <button class="calc-btn" onclick="calcInput('8')">8</button>
              <button class="calc-btn" onclick="calcInput('9')">9</button>
              <button class="calc-btn calc-op" onclick="calcInput('-')">-</button>
              <button class="calc-btn" onclick="calcInput('4')">4</button>
              <button class="calc-btn" onclick="calcInput('5')">5</button>
              <button class="calc-btn" onclick="calcInput('6')">6</button>
              <button class="calc-btn calc-op" onclick="calcInput('+')">+</button>
              <button class="calc-btn" onclick="calcInput('1')">1</button>
              <button class="calc-btn" onclick="calcInput('2')">2</button>
              <button class="calc-btn" onclick="calcInput('3')">3</button>
              <button class="calc-btn calc-equal" style="grid-row: span 2" onclick="calcInput('=')">=</button>
              <button class="calc-btn" style="grid-column: span 2" onclick="calcInput('0')">0</button>
              <button class="calc-btn" onclick="calcInput('.')">.</button>
            </div>
          </div>
        </div>
      </div>
      <div class="right-column">
        <div class="card">
          <h2>Medya İndirici Aracı</h2>
          <div class="form-group">
            <input type="text" id="mediaUrl" placeholder="YouTube veya Instagram Bağlantısı" />
            <div class="flex-inputs">
              <select id="mediaFormat">
                <option value="max">En Yüksek Kalite (4K/1080p)</option>
                <option value="720p">Standart Kalite (720p)</option>
                <option value="mp3">Sadece Ses (MP3)</option>
              </select>
              <button onclick="downloadMedia()">İndirmeyi Başlat</button>
            </div>
            <div id="progressContainer" style="display: none; width: 100%; background: var(--glass-border); border-radius: 8px; overflow: hidden; margin-top: 1rem;">
              <div id="progressBar" style="height: 8px; width: 0%; background: var(--accent); transition: width 0.3s;"></div>
            </div>
            <p id="progressText" style="font-size: 1.2rem; font-weight: bold; text-align: center; margin-top: 0.5rem; color: var(--accent); display: none;">%0</p>
            <p id="downloadStatus" style="font-size: 0.9rem; text-align: center; margin-top: 0.5rem; color: #94a3b8;"></p>
          </div>
        </div>
        <div class="card">
          <h2>Kalıcı Notlar</h2>
          <div class="form-group">
            <textarea id="quickNotes" rows="12" placeholder="Notlarınızı buraya yazın..."></textarea>
            <button onclick="saveNotes()">Notları Güvenle Kaydet</button>
          </div>
        </div>
      </div>
      <div class="card full-width-card timer-container">
        <div class="kirito-header-top" style="width: 100%">
          <h2>POMODORO DİJİTAL İSTASYONU</h2>
        </div>
        <div class="flip-clock">
          <div class="flip-group">
            <div class="flip-card" id="card-m1"><div class="digit" id="m1">2</div></div>
            <div class="flip-card" id="card-m2"><div class="digit" id="m2">5</div></div>
          </div>
          <div class="colon">:</div>
          <div class="flip-group">
            <div class="flip-card" id="card-s1"><div class="digit" id="s1">0</div></div>
            <div class="flip-card" id="card-s2"><div class="digit" id="s2">0</div></div>
          </div>
        </div>
        <div class="timer-controls">
          <button class="btn-outline-cyan" onclick="startTimer()" style="background: rgba(0, 229, 255, 0.1)">SİSTEMİ BAŞLAT</button>
          <button class="btn-outline-red" onclick="resetTimer()" style="background: rgba(244, 63, 94, 0.1)">DURDUR / SIFIRLA</button>
        </div>
      </div>
      <div class="card full-width-card kirito-container">
        <div class="kirito-header-top">
          <h2>KİRİTO TAKVİMİ</h2>
          <button class="btn-outline-red" onclick="window.location.href='?logout=1'">ÇIKIŞ</button>
        </div>
        <div class="kirito-grid">
          <div class="kirito-grid-header">HAFTA</div>
          <div class="kirito-grid-header">PAZAR</div>
          <div class="kirito-grid-header">PZT</div>
          <div class="kirito-grid-header">SALI</div>
          <div class="kirito-grid-header">ÇARŞ</div>
          <div class="kirito-grid-header">PERŞ</div>
          <div class="kirito-grid-header">CUMA</div>
          <div class="kirito-grid-header">CMT</div>
          <div class="kirito-grid-header">TOPLAM</div>
          <div class="kirito-row-label">1.<br />Hafta</div>
          <input type="text" class="kirito-input row-1" placeholder="-" />
          <input type="text" class="kirito-input row-1" placeholder="-" />
          <input type="text" class="kirito-input row-1" placeholder="-" />
          <input type="text" class="kirito-input row-1" placeholder="-" />
          <input type="text" class="kirito-input row-1" placeholder="-" />
          <input type="text" class="kirito-input row-1" placeholder="-" />
          <input type="text" class="kirito-input row-1" placeholder="-" />
          <div class="kirito-row-total" id="total-w1">0.00</div>
          <div class="kirito-row-label">2.<br />Hafta</div>
          <input type="text" class="kirito-input row-2" placeholder="-" />
          <input type="text" class="kirito-input row-2" placeholder="-" />
          <input type="text" class="kirito-input row-2" placeholder="-" />
          <input type="text" class="kirito-input row-2" placeholder="-" />
          <input type="text" class="kirito-input row-2" placeholder="-" />
          <input type="text" class="kirito-input row-2" placeholder="-" />
          <input type="text" class="kirito-input row-2" placeholder="-" />
          <div class="kirito-row-total" id="total-w2">0.00</div>
          <div class="kirito-row-label">3.<br />Hafta</div>
          <input type="text" class="kirito-input row-3" placeholder="-" />
          <input type="text" class="kirito-input row-3" placeholder="-" />
          <input type="text" class="kirito-input row-3" placeholder="-" />
          <input type="text" class="kirito-input row-3" placeholder="-" />
          <input type="text" class="kirito-input row-3" placeholder="-" />
          <input type="text" class="kirito-input row-3" placeholder="-" />
          <input type="text" class="kirito-input row-3" placeholder="-" />
          <div class="kirito-row-total" id="total-w3">0.00</div>
          <div class="kirito-row-label">4.<br />Hafta</div>
          <input type="text" class="kirito-input row-4" placeholder="-" />
          <input type="text" class="kirito-input row-4" placeholder="-" />
          <input type="text" class="kirito-input row-4" placeholder="-" />
          <input type="text" class="kirito-input row-4" placeholder="-" />
          <input type="text" class="kirito-input row-4" placeholder="-" />
          <input type="text" class="kirito-input row-4" placeholder="-" />
          <input type="text" class="kirito-input row-4" placeholder="-" />
          <div class="kirito-row-total" id="total-w4">0.00</div>
        </div>
        <div class="kirito-footer">
          <div class="kirito-actions">
            <button class="btn-outline-red" onclick="clearKirito()">TEMİZLE</button>
            <button class="btn-outline-cyan" onclick="saveKirito()">VERİLERİ SUNUCUYA KAYDET</button>
            <button class="btn-outline-cyan" onclick="sendTableToTelegram()">TABLOYU TELEGRAMA GÖNDER</button>
          </div>
          <div class="kirito-grand-total-box">
            <div class="kirito-grand-label">AYLIK TOPLAM</div>
            <div class="kirito-grand-value" id="grand-total">0.00</div>
          </div>
        </div>
      </div>
    </div>
    <script>
      let calcVal = "0";
      function calcInput(key) {
        const display = document.getElementById("calcDisplay");
        if (key === "C") {
          calcVal = "0";
        } else if (key === "DEL") {
          calcVal = calcVal.length > 1 ? calcVal.slice(0, -1) : "0";
        } else if (key === "=") {
          try {
            calcVal = eval(calcVal).toString();
          } catch {
            calcVal = "Hata";
          }
        } else {
          if (calcVal === "0" || calcVal === "Hata") {
            if (["/", "*", "+", "-"].includes(key)) {
              calcVal += key;
            } else if (key === ".") {
              calcVal = "0.";
            } else {
              calcVal = key;
            }
          } else {
            calcVal += key;
          }
        }
        display.innerText = calcVal;
      }

      let canvas, ctx;
      let snake = [{ x: 10, y: 10 }];
      let dx = 0;
      let dy = 0;
      let rocket = { x: 5, y: 5 };
      let gameLoop;
      let gameStarted = false;

      canvas = document.getElementById("gameCanvas");
      ctx = canvas.getContext("2d");
      document.addEventListener("keydown", changeDirection);
      drawGame();

      function startGame() {
        snake = [{ x: 10, y: 10 }];
        dx = 0;
        dy = 0;
        placeRocket();
        clearInterval(gameLoop);
        gameLoop = setInterval(updateGame, 130);
        gameStarted = true;
      }

      function updateGame() {
        const head = { x: snake[0].x + dx, y: snake[0].y + dy };
        if (head.x < 0 || head.x >= 20 || head.y < 0 || head.y >= 20) {
          gameStarted = false;
          clearInterval(gameLoop);
          return;
        }
        for (let i = 1; i < snake.length; i++) {
          if (head.x === snake[i].x && head.y === snake[i].y) {
            gameStarted = false;
            clearInterval(gameLoop);
            return;
          }
        }
        snake.unshift(head);
        if (head.x === rocket.x && head.y === rocket.y) {
          placeRocket();
        } else {
          snake.pop();
        }
        drawGame();
      }

      function drawGame() {
        ctx.fillStyle = "#020617";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = "24px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("🚀", rocket.x * 20 + 10, rocket.y * 20 + 10);
        for (let i = 0; i < snake.length; i++) {
          if (i === 0) {
            ctx.fillText("✈️", snake[i].x * 20 + 10, snake[i].y * 20 + 10);
          } else {
            ctx.fillStyle = "#38bdf8";
            ctx.fillRect(snake[i].x * 20 + 2, snake[i].y * 20 + 2, 16, 16);
          }
        }
      }

      function placeRocket() {
        rocket.x = Math.floor(Math.random() * 20);
        rocket.y = Math.floor(Math.random() * 20);
      }

      function changeDirection(event) {
        const keys = [37, 38, 39, 40];
        const isCalcFocused = document.activeElement && document.activeElement.classList && document.activeElement.classList.contains("calc-btn");
        if (keys.includes(event.keyCode) && !isCalcFocused) {
          event.preventDefault();
        }
        if (!gameStarted && keys.includes(event.keyCode) && !isCalcFocused) {
          startGame();
        }
        const LEFT = 37;
        const UP = 38;
        const RIGHT = 39;
        const DOWN = 40;
        const keyPressed = event.keyCode;
        const goingUp = dy === -1;
        const goingDown = dy === 1;
        const goingRight = dx === 1;
        const goingLeft = dx === -1;

        if (keyPressed === LEFT && !goingRight && !isCalcFocused) { dx = -1; dy = 0; }
        if (keyPressed === UP && !goingDown && !isCalcFocused) { dx = 0; dy = -1; }
        if (keyPressed === RIGHT && !goingLeft && !isCalcFocused) { dx = 1; dy = 0; }
        if (keyPressed === DOWN && !goingUp && !isCalcFocused) { dx = 0; dy = 1; }
      }

      function downloadMedia() {
        const url = document.getElementById("mediaUrl").value;
        const format = document.getElementById("mediaFormat").value;
        const status = document.getElementById("downloadStatus");
        const progressContainer = document.getElementById("progressContainer");
        const progressBar = document.getElementById("progressBar");
        const progressText = document.getElementById("progressText");

        if (!url) {
          status.style.color = "#ef4444";
          status.innerText = "Lütfen geçerli bir link yapıştırın.";
          return;
        }

        const downloadId = Math.random().toString(36).substring(2, 15);
        status.style.color = "#38bdf8";
        status.innerText = "Sunucu ile bağlantı kuruluyor...";
        progressContainer.style.display = "block";
        progressText.style.display = "block";
        progressBar.style.width = "0%";
        progressText.innerText = "%0";

        let progressInterval = setInterval(() => {
          fetch(`http://localhost:5000/api/progress?id=${downloadId}`)
            .then((res) => res.json())
            .then((data) => {
              if (data.yuzde > 0 && data.yuzde <= 100) {
                progressBar.style.width = data.yuzde + "%";
                progressText.innerText = "%" + data.yuzde;
                status.innerText = "Sunucu işliyor...";
              }
            })
            .catch((e) => console.log(e));
        }, 800);

        fetch("http://localhost:5000/api/download", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: url, quality: format, id: downloadId }),
        })
          .then(async (res) => {
            clearInterval(progressInterval);
            if (!res.ok) {
              const err = await res.text();
              throw new Error(err);
            }
            progressBar.style.width = "100%";
            progressText.innerText = "%100";
            status.innerText = "Tarayıcıya aktarılıyor, sağ üstten takip edebilirsin...";

            const disposition = res.headers.get("Content-Disposition");
            let filename = "indirme.mp4";
            if (disposition && disposition.indexOf("attachment") !== -1) {
              const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
              const matches = filenameRegex.exec(disposition);
              if (matches != null && matches[1]) {
                filename = matches[1].replace(/['"]/g, "");
              }
            }
            return res.blob().then((blob) => ({ blob, filename }));
          })
          .then(({ blob, filename }) => {
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.style.display = "none";
            a.href = downloadUrl;
            a.download = decodeURIComponent(filename);
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(downloadUrl);
            document.body.removeChild(a);

            status.style.color = "#4ade80";
            status.innerText = "İndirme tamamen bitti!";
            setTimeout(() => {
              progressContainer.style.display = "none";
              progressText.style.display = "none";
            }, 4000);
          })
          .catch((err) => {
            clearInterval(progressInterval);
            status.style.color = "#f43f5e";
            status.innerText = err.message;
            progressContainer.style.display = "none";
            progressText.style.display = "none";
          });
      }

      let timerInterval;
      let timeLeft = 1500;

      function updateFlipDigit(id, newValue) {
        const digitEl = document.getElementById(id);
        const cardEl = document.getElementById("card-" + id);
        if (digitEl.innerText !== newValue) {
          cardEl.classList.remove("flip-anim");
          void cardEl.offsetWidth;
          digitEl.innerText = newValue;
          cardEl.classList.add("flip-anim");
        }
      }

      function updateTimerDisplay() {
        const minutes = Math.floor(timeLeft / 60).toString().padStart(2, "0");
        const seconds = (timeLeft % 60).toString().padStart(2, "0");
        updateFlipDigit("m1", minutes[0]);
        updateFlipDigit("m2", minutes[1]);
        updateFlipDigit("s1", seconds[0]);
        updateFlipDigit("s2", seconds[1]);
      }

      function startTimer() {
        clearInterval(timerInterval);
        timerInterval = setInterval(() => {
          if (timeLeft > 0) {
            timeLeft--;
            updateTimerDisplay();
          } else {
            clearInterval(timerInterval);
            alert("Süre doldu hoca, mola zamanı!");
          }
        }, 1000);
      }

      function resetTimer() {
        clearInterval(timerInterval);
        timeLeft = 1500;
        updateTimerDisplay();
      }

      document.getElementById("quickNotes").value = localStorage.getItem("dashboardNotes") || "";

      function saveNotes() {
        const notes = document.getElementById("quickNotes").value;
        localStorage.setItem("dashboardNotes", notes);
        const btn = document.querySelector('button[onclick="saveNotes()"]');
        btn.innerText = "Başarıyla Kaydedildi!";
        setTimeout(() => (btn.innerText = "Notları Güvenle Kaydet"), 2000);
      }

      const kiritoInputs = document.querySelectorAll(".kirito-input");

      kiritoInputs.forEach((input) => {
        input.addEventListener("input", calculateKiritoTotals);
      });

      function calculateKiritoTotals() {
        let grandTotalMinutes = 0;

        for (let i = 1; i <= 4; i++) {
          let rowTotalMinutes = 0;
          const rowInputs = document.querySelectorAll(`.row-${i}`);

          rowInputs.forEach((inp) => {
            let valStr = inp.value.trim();
            if (valStr) {
              let h = 0, m = 0;
              if (valStr.includes(".") || valStr.includes(",")) {
                let parts = valStr.replace(",", ".").split(".");
                h = parseInt(parts[0]) || 0;
                let mStr = parts[1] || "0";
                if (mStr.length === 1) mStr += "0";
                m = parseInt(mStr.substring(0, 2)) || 0;
              } else {
                h = parseInt(valStr) || 0;
              }
              rowTotalMinutes += h * 60 + m;
            }
          });

          let rowH = Math.floor(rowTotalMinutes / 60);
          let rowM = rowTotalMinutes % 60;
          document.getElementById(`total-w${i}`).innerText = rowH + "." + (rowM < 10 ? "0" : "") + rowM;
          grandTotalMinutes += rowTotalMinutes;
        }

        let grandH = Math.floor(grandTotalMinutes / 60);
        let grandM = grandTotalMinutes % 60;
        document.getElementById("grand-total").innerText = grandH + "." + (grandM < 10 ? "0" : "") + grandM;
      }

      function clearKirito() {
        kiritoInputs.forEach((inp) => (inp.value = ""));
        calculateKiritoTotals();
      }

      function saveKirito() {
        const btn = document.querySelector(".btn-outline-cyan[onclick='saveKirito()']");
        if (btn.disabled) return;

        btn.disabled = true;
        btn.style.opacity = "0.5";
        btn.style.cursor = "not-allowed";
        btn.innerText = "KAYDEDİLİYOR...";

        const data = [];
        kiritoInputs.forEach((inp) => data.push(inp.value));

        fetch("save_data.php", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data)
        })
          .then(async (res) => {
            if (!res.ok) {
              throw new Error("Sunucu reddetti (İzin hatası olabilir)");
            }
            btn.innerText = "SUNUCUYA KAYDEDİLDİ!";
            setTimeout(() => {
              btn.innerText = "VERİLERİ SUNUCUYA KAYDET";
              btn.disabled = false;
              btn.style.opacity = "1";
              btn.style.cursor = "pointer";
            }, 10000);
          })
          .catch((err) => {
            alert("Hata: " + err.message);
            btn.innerText = "VERİLERİ SUNUCUYA KAYDET";
            btn.disabled = false;
            btn.style.opacity = "1";
            btn.style.cursor = "pointer";
          });
      }

      function sendTableToTelegram() {
        const btn = document.querySelector(".btn-outline-cyan[onclick='sendTableToTelegram()']");
        if (btn.disabled) return;
        
        btn.disabled = true;
        btn.style.opacity = "0.5";
        btn.style.cursor = "not-allowed";
        btn.innerText = "GÖNDERİLİYOR...";

        const data = [];
        kiritoInputs.forEach((inp) => data.push(inp.value));
        
        const totals = [
          document.getElementById('total-w1').innerText,
          document.getElementById('total-w2').innerText,
          document.getElementById('total-w3').innerText,
          document.getElementById('total-w4').innerText
        ];
        
        const grandTotal = document.getElementById('grand-total').innerText;

        fetch("send_table.php", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inputs: data, totals: totals, grandTotal: grandTotal })
        })
        .then(async (res) => {
          if (!res.ok) throw new Error("Gönderilemedi");
          btn.innerText = "TELEGRAMA GÖNDERİLDİ!";
          setTimeout(() => {
            btn.innerText = "TABLOYU TELEGRAMA GÖNDER";
            btn.disabled = false;
            btn.style.opacity = "1";
            btn.style.cursor = "pointer";
          }, 10000);
        })
        .catch((err) => {
          alert("Hata: " + err.message);
          btn.innerText = "TABLOYU TELEGRAMA GÖNDER";
          btn.disabled = false;
          btn.style.opacity = "1";
          btn.style.cursor = "pointer";
        });
      }

      function loadKirito() {
        fetch("kirito_data.json?t=" + new Date().getTime())
          .then((res) => {
            if (!res.ok) throw new Error("Veri dosyası henüz oluşturulmamış");
            return res.json();
          })
          .then((data) => {
            kiritoInputs.forEach((inp, index) => {
              inp.value = data[index] || "";
            });
            calculateKiritoTotals();
          })
          .catch((err) => {
            console.log("Mevcut veri yok, yeni sayfa başlatılıyor.");
          });
      }

      loadKirito();
    </script>
    <?php endif; ?>
  </body>
</html>