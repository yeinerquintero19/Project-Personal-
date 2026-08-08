# PrestaPro

Sistema de gestión de préstamos para empresas: portafolio, cuotas, pagos y reportes.

## Requisitos

- Docker (para PostgreSQL) — https://www.docker.com/products/docker-desktop/
- Rust (toolchain estable) — https://rustup.rs
- Python 3.11+ — https://www.python.org/downloads/
- Node.js 18+ — https://nodejs.org

## Stack

| Capa       | Tecnología                                    |
| ---------- | --------------------------------------------- |
| Backend    | Rust + Axum (API de préstamos)                |
| Backend    | Python + FastAPI (reportes y análisis)        |
| Frontend   | TypeScript + HTML + CSS (Vite)                |
| Base datos | PostgreSQL 16 (Docker)                        |
| Scripts    | Shell (Bash) + PowerShell                     |

## Arranque rápido

### 1) Levantar la base de datos

```bash
docker compose up -d
```

### 2) Configurar variables de entorno

Copiar `backend-rust/.env.example` a `backend-rust/.env` y
`backend-python/.env.example` a `backend-python/.env`. Los valores por defecto
funcionan con el `docker-compose.yml` incluido.

### 3) Backend Rust (API principal) — puerto 8080

```bash
cd backend-rust
cargo run
```

### 4) Backend Python (reportes) — puerto 8000

```bash
cd backend-python
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 5) Frontend — puerto 5173

```bash
cd frontend
npm install
npm run dev
```

Abrir http://localhost:5173

## Automatización

```bash
# Todo con un solo comando (Bash):
./scripts/setup.sh

# En PowerShell (Windows):
powershell -ExecutionPolicy Bypass -File scripts/setup.ps1
```

## Documentación

- `docs/architecture.md` — Arquitectura y decisiones de diseño.
- `docs/api.md` — Referencia de los endpoints REST.

## Endpoints principales

| Método | Ruta                    | Servicio  | Descripción                      |
| ------ | ----------------------- | --------- | -------------------------------- |
| POST   | /api/companies          | Rust      | Crear empresa                    |
| GET    | /api/companies          | Rust      | Listar empresas                  |
| POST   | /api/loans              | Rust      | Crear préstamo + cuotas          |
| GET    | /api/loans/:id          | Rust      | Detalle con cuotas               |
| POST   | /api/loans/:id/payments | Rust      | Registrar pago de cuota          |
| GET    | /api/dashboard          | Rust      | Resumen del portafolio           |
| GET    | /api/reports/summary    | Python    | Resumen financiero               |
| GET    | /api/reports/overdue    | Python    | Cuotas vencidas                  |
| GET    | /api/reports/amortization| Python    | Tabla de amortización francesa   |
