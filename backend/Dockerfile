# ===========================================================
# NeuroScreen — Backend Dockerfile
# ===========================================================
# Multi-stage Docker build for production deployment.
#
# Build:
#   docker build -t neuroscreen-backend ./backend
#
# Run:
#   docker run -p 8000:8000 --env-file .env neuroscreen-backend
# ===========================================================

FROM python:3.11-slim AS base

# System dependencies for OpenCV, MediaPipe, audio processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    libfontconfig1 \
    libice6 \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd -r neuroscreen && useradd -r -g neuroscreen -d /app -s /sbin/nologin neuroscreen

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p /app/ml/models && chown -R neuroscreen:neuroscreen /app

# Switch to non-root user
USER neuroscreen

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')" || exit 1

# Run with Uvicorn (production settings)
# Workers = 2 * CPU cores + 1 (default to 2 for small instances)
CMD ["uvicorn", "main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "2", \
     "--access-log", \
     "--proxy-headers", \
     "--forwarded-allow-ips", "*"]
