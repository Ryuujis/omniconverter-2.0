FROM python:3.11-slim

# yt-dlp ve medya işleme için ffmpeg ve curl kurulumu
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Bağımlılıkları önbellekle
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Uygulama dosyalarını kopyala
COPY . .

# Kayıt klasörünü hazırla
RUN mkdir -p /app/saves/backups

ENV PORT=5055
ENV PYTHONUNBUFFERED=1

EXPOSE 5055

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5055/api/health || exit 1

CMD ["python3", "app.py"]
