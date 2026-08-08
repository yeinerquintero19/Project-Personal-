# Arquitectura

## Visión general

MerPrest es un sistema de gestión de préstamos entre empresas con una
arquitectura de **microservicios ligeros** en un monorepo:

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Vite + TS)                 │
│              Panel · Préstamos · Empresas · Reportes    │
└───────────────┬─────────────────────┬───────────────────┘
                │ REST                │ REST
        ┌───────▼───────┐      ┌──────▼────────┐
        │  Rust · Axum  │      │ Python · FastAPI│
        │  API core     │      │ Reportes       │
        │  puerto 8080  │      │ puerto 8000    │
        └───────┬───────┘      └──────┬────────┘
                └──────────┬──────────┘
                     ┌─────▼──────┐
                     │ PostgreSQL │
                     │  puerto 5432│
                     └────────────┘
```

## Decisiones de diseño

| Tema                  | Decisión                                                          |
| --------------------- | ----------------------------------------------------------------- |
| Lenguaje del core     | **Rust + Axum**: rendimiento, tipado fuerte, seguridad de memoria.|
| Análisis y reportes   | **Python + FastAPI**: velocidad de desarrollo para indicadores.   |
| Base de datos         | **PostgreSQL 16** en Docker (NUMERIC para dinero, UUID, FK).      |
| Amortización          | Sistema **francés** (cuota fija): `C = P·r/(1-(1+r)^-n)`.         |
| Estado de cuotas      | `pending`/`paid` en BD + estado efectivo `late` calculado en SQL. |
| Pagos parciales       | Una cuota acepta varios pagos; se marca pagada al cubrir el total.|
| Frontend              | TypeScript estricto + Vite; hash-router, sin framework.           |

## Flujo de datos

1. `POST /api/loans` crea el préstamo y, **en una transacción**, genera las
   `n` cuotas usando la fórmula francesa (capital, interés y saldo por cuota).
2. `POST /api/loans/:id/payments` registra un pago contra la cuota pendiente
   más antigua (o una específica), valida que no supere el saldo, y actualiza
   estados de cuota y préstamo.
3. El servicio Python lee la misma base y agrega: morosidad, concentración de
   riesgo, puntualidad por empresa y simulaciones de amortización.

## Seguridad

- Consultas SQL parametrizadas (`$1`, `%s`) en ambos backends.
- CORS permisivo solo por ser desarrollo; restringir en producción.
- Secretos en `.env` (nunca versionados).

## Producción

- Compilar Rust en modo release (`cargo build --release`).
- `uvicorn` con workers: `uvicorn app.main:app --workers 4`.
- Build estático del frontend: `npm run build` (sirve `dist/`).
- Respaldar PostgreSQL con `pg_dump`.
