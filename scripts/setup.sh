#!/usr/bin/env bash
# =============================================================
# PrestaPro - Script de setup e instalación (Linux/macOS/Git Bash)
# Uso: ./scripts/setup.sh
# =============================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

step()  { echo -e "${GREEN}==>${NC} $1"; }
warn()  { echo -e "${YELLOW}!! $1${NC}"; }
fail()  { echo -e "${RED}ERROR: $1${NC}"; exit 1; }

command_exists() { command -v "$1" >/dev/null 2>&1; }

step "Verificando herramientas instaladas..."
command_exists docker || fail "Docker no está instalado. https://www.docker.com/products/docker-desktop/"
command_exists cargo  || fail "Rust no está instalado. https://rustup.rs"
command_exists python3 || python --version >/dev/null 2>&1 || fail "Python 3 no está instalado."
command_exists node   || fail "Node.js no está instalado. https://nodejs.org"
step "Todo listo: Docker, Rust, Python, Node ✓"

step "1/4 Levantando PostgreSQL con Docker..."
docker compose -f "$ROOT/docker-compose.yml" up -d
sleep 5

step "2/4 Configurando backend Rust..."
if [ ! -f "$ROOT/backend-rust/.env" ]; then
  cp "$ROOT/backend-rust/.env.example" "$ROOT/backend-rust/.env"
  warn "Creado backend-rust/.env con valores por defecto"
fi
( cd "$ROOT/backend-rust" && cargo build ) || warn "cargo build falló (revisa la instalación de Rust)"

step "3/4 Configurando backend Python..."
if [ ! -f "$ROOT/backend-python/.env" ]; then
  cp "$ROOT/backend-python/.env.example" "$ROOT/backend-python/.env"
  warn "Creado backend-python/.env con valores por defecto"
fi
python3 -m venv "$ROOT/backend-python/.venv" 2>/dev/null || python -m venv "$ROOT/backend-python/.venv"
"$ROOT/backend-python/.venv/bin/pip" install -r "$ROOT/backend-python/requirements.txt"

step "4/4 Instalando frontend..."
( cd "$ROOT/frontend" && npm install )

echo
step "¡Setup completado!"
echo "  API Rust   : cd backend-rust && cargo run      -> http://localhost:8080"
echo "  API Python : cd backend-python && .venv/bin/uvicorn app.main:app --port 8000"
echo "  Frontend   : cd frontend && npm run dev        -> http://localhost:5173"
