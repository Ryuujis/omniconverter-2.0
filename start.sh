#!/bin/bash
# Misacon Başlatma Scripti
PORT=${PORT:-5055}
echo "=========================================="
echo "⚡ Misacon Başlatılıyor..."
echo "📍 Adres: http://localhost:$PORT"
echo "=========================================="
python3 app.py
