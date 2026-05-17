#!/bin/bash
# Zero-downtime rolling deploy to EC2
# Requires: EC2_HOST, SSH_KEY_PATH env vars

set -euo pipefail

EC2_HOST="${EC2_HOST:?EC2_HOST required}"
SSH_KEY="${SSH_KEY_PATH:-~/.ssh/adflow.pem}"
REMOTE_DIR="${REMOTE_DIR:-/opt/adflow}"

echo "==> Building images locally..."
docker compose build

echo "==> Saving images..."
docker save $(docker compose config --images) | gzip > /tmp/adflow-images.tar.gz

echo "==> Uploading to EC2..."
scp -i "$SSH_KEY" /tmp/adflow-images.tar.gz "ubuntu@${EC2_HOST}:/tmp/"

echo "==> Rolling deploy on EC2..."
ssh -i "$SSH_KEY" "ubuntu@${EC2_HOST}" << 'REMOTE'
  set -e
  cd /opt/adflow
  docker load < /tmp/adflow-images.tar.gz
  docker compose pull 2>/dev/null || true
  docker compose up -d --no-deps --build --remove-orphans
  docker compose exec -T campaign-api wget -qO- http://localhost:3001/health
  echo "Deploy complete"
REMOTE

echo "==> Health check..."
curl -sf "http://${EC2_HOST}:3001/health" && echo "Campaign API healthy"
