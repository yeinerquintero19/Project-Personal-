# Referencia de la API

## Servicio Rust (http://localhost:8080)

### Empresas

| Método | Ruta                 | Descripción                          |
| ------ | -------------------- | ------------------------------------ |
| GET    | /api/companies       | Listar (`?q=texto` filtra por nombre/RUC/correo) |
| GET    | /api/companies/:id   | Detalle + préstamos de la empresa    |
| POST   | /api/companies       | Crear `{name, ruc, contact_email?, contact_phone?}` |
| PUT    | /api/companies/:id   | Actualizar (campos parciales)        |
| DELETE | /api/companies/:id   | Eliminar (en cascada)                |

### Préstamos

| Método | Ruta                 | Descripción                          |
| ------ | -------------------- | ------------------------------------ |
| GET    | /api/loans           | Listar (`?status=active\|late\|paid`, `?q=`) |
| GET    | /api/loans/:id       | Detalle con cuotas y pagos           |
| POST   | /api/loans           | Crear `{company_id, amount, annual_rate, term_months, start_date?}` |

Respuesta de `POST /api/loans` y `GET /api/loans/:id`:

```json
{
  "id": "uuid",
  "company_id": "uuid",
  "company_name": "Empresa Andina SAC",
  "amount": "50000.00",
  "annual_rate": "0.1200",
  "term_months": 12,
  "start_date": "2026-08-07",
  "currency": "USD",
  "status": "active",
  "installments": [
    {
      "id": "uuid",
      "number": 1,
      "due_date": "2026-09-07",
      "principal": "3950.16",
      "interest": "500.00",
      "balance": "46049.84",
      "status": "pending",
      "paid_amount": "0.00"
    }
  ],
  "payments": []
}
```

### Pagos

| Método | Ruta                          | Descripción                          |
| ------ | ----------------------------- | ------------------------------------ |
| POST   | /api/loans/:id/payments       | `{installment_id?, amount, payment_date?, method?, reference?}` |

Reglas:
- Sin `installment_id` se paga la cuota pendiente más antigua.
- Si el monto supera el saldo pendiente → error 400.
- Pagos parciales permitidos; al completar la cuota, se marca pagada y, si es
  la última, el préstamo pasa a `paid`.

### Dashboard

| Método | Ruta           | Descripción                          |
| ------ | -------------- | ------------------------------------ |
| GET    | /api/dashboard | Capital desembolsado, cobrado, por cobrar, vencidas, recientes |

### Salud

| Método | Ruta    | Descripción                          |
| ------ | ------- | ------------------------------------ |
| GET    | /health | `{status: "ok", service: "merprest-rust"}` |

---

## Servicio Python (http://localhost:8000)

| Método | Ruta                              | Descripción                          |
| ------ | --------------------------------- | ------------------------------------ |
| GET    | /api/reports/summary              | Indicadores globales + tasa de recuperación |
| GET    | /api/reports/overdue              | Cuotas vencidas con días de atraso   |
| GET    | /api/reports/company/:id          | Historial, puntualidad y saldos de una empresa |
| GET    | /api/reports/portfolio-risk       | Concentración por empresa y salud de cuotas |
| GET    | /api/reports/amortization         | Simulador `?amount=&annual_rate=&months=` |
| GET    | /api/reports/health               | Health check                         |

Documentación interactiva (Swagger) en http://localhost:8000/docs

---

## Errores

Todos los endpoints devuelven en caso de error:

```json
{ "error": "mensaje descriptivo" }
```

| Código | Significado                                   |
| ------ | --------------------------------------------- |
| 400    | Validación de negocio (monto excede saldo...) |
| 404    | Recurso no encontrado                         |
| 409    | Conflicto (RUC duplicado)                     |
| 500    | Error interno                                 |
