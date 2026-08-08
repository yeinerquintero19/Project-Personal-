# =============================================================
# PrestaPro - Atajos de desarrollo
# =============================================================

.PHONY: setup db rust python frontend dev build lint

setup:            ## Instala todo (Docker, deps) y deja el proyecto listo
	bash scripts/setup.sh

db:               ## Levanta PostgreSQL con Docker
	docker compose up -d

db-down:          ## Detiene PostgreSQL
	docker compose down

rust:             ## Compila y ejecuta la API en Rust (puerto 8080)
	cd backend-rust && cargo run

rust-build:       ## Compila la API en Rust
	cd backend-rust && cargo build

python:           ## Ejecuta la API de reportes en Python (puerto 8000)
	cd backend-python && .venv/bin/uvicorn app.main:app --port 8000 --reload

frontend:         ## Ejecuta el frontend (puerto 5173)
	cd frontend && npm run dev

build:            ## Compila los 3 módulos
	cd backend-rust && cargo build --release
	cd frontend && npm run build

dev:              ## Levanta los 3 servicios a la vez
	bash scripts/dev.sh

help:             ## Muestra esta ayuda
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'
