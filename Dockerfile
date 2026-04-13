# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS frontend-builder

WORKDIR /app

COPY package.json package-lock.json postcss.config.js tailwind.config.js vite.config.js ./

RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
COPY frontend ./frontend
RUN npm run build

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=5000

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    poppler-utils \
    binutils \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip pip install --no-cache-dir \
    --trusted-host pypi.org \
    --trusted-host pypi.python.org \
    --trusted-host files.pythonhosted.org \
    -r requirements.txt

COPY . .
COPY --from=frontend-builder /app/web/static/dist /app/web/static/dist

RUN mkdir -p /app/.mts_memory/uploads

EXPOSE 5000

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--threads", "4", "web_app:app"]
