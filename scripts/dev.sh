#!/usr/bin/env bash
# =============================================================
# MerPrest - Script de desarrollo (Linux/macOS/Git Bash)
# Levanta los 3 servicios con logs en consola.
# =============================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

step() { echo -e "${GREEN}==>${NC} $1"; }

step "Asegurando PostgreSQL..."
docker compose -f "$ROOT/docker-compose.yml" up -d

step "Lanzando backend Rust (http://localhost:8080)..."
(cd "$ROOT/backend-rust" && cargo run) &
PID_RUST=$!

step "Lanzando backend Python (http://localhost:8000)..."
(cd "$ROOT/backend-python" && .venv/bin/uvicorn app.main:app --port 8000 --reload) &
PID_PY=$!

step "Lanzando frontend (http://localhost:5173)..."
(cd "$ROOT/frontend" && npm run dev) &
PID_FE=$!

trap 'kill $PID_RUST $PID_PY $PID_FE 2>/dev/null' EXIT INT TERM

echo -e "${YELLOW}Servicios activos. Ctrl+C para detener.${NC}"
wait
