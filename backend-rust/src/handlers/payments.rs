use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use rust_decimal::Decimal;
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::{ApiError, ApiResult};
use crate::models::{CreatePayment, Installment, Loan, Payment};

/// Registra un pago contra una cuota de un préstamo.
///
/// - Si `installment_id` no se envía, se paga automáticamente la cuota
///   pendiente más antigua.
/// - Se permiten pagos parciales; cuando el acumulado cubre la cuota completa,
///   la cuota pasa a `paid` y, si es la última, el préstamo a `paid`.
pub async fn register(
    State(pool): State<PgPool>,
    Path(loan_id): Path<Uuid>,
    Json(body): Json<CreatePayment>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    // Verificar que el préstamo exista
    sqlx::query_as::<_, Loan>("SELECT * FROM loans WHERE id = $1")
        .bind(loan_id)
        .fetch_one(&pool)
        .await?;

    let payment_date = body
        .payment_date
        .unwrap_or_else(|| chrono::Utc::now().date_naive());
    let method = body.method.unwrap_or_else(|| "bank_transfer".to_string());

    // Determinar la cuota a pagar
    let installment = match body.installment_id {
        Some(iid) => {
            let inst: Installment = sqlx::query_as(
                "SELECT * FROM installments WHERE id = $1 AND loan_id = $2",
            )
            .bind(iid)
            .bind(loan_id)
            .fetch_one(&pool)
            .await
            .map_err(|_| {
                ApiError::BadRequest("La cuota indicada no pertenece al préstamo".to_string())
            })?;
            if inst.status == "paid" {
                return Err(ApiError::BadRequest(
                    "La cuota ya está pagada por completo".to_string(),
                ));
            }
            inst
        }
        None => {
            sqlx::query_as::<_, Installment>(
                "SELECT * FROM installments
                 WHERE loan_id = $1 AND status = 'pending'
                 ORDER BY number LIMIT 1",
            )
            .bind(loan_id)
            .fetch_one(&pool)
            .await
            .map_err(|_| {
                ApiError::BadRequest("El préstamo no tiene cuotas pendientes".to_string())
            })?
        }
    };

    let installment_id = installment.id;

    // Saldo pendiente de la cuota
    let total: Decimal = sqlx::query_as::<_, (Decimal,)>(
        "SELECT principal + interest FROM installments WHERE id = $1",
    )
    .bind(installment_id)
    .fetch_one(&pool)
    .await?
    .0;

    let paid: Decimal = sqlx::query_as::<_, (Decimal,)>(
        "SELECT COALESCE(SUM(amount), 0) FROM payments WHERE installment_id = $1",
    )
    .bind(installment_id)
    .fetch_one(&pool)
    .await?
    .0;

    let remaining = total - paid;
    if body.amount > remaining {
        return Err(ApiError::BadRequest(format!(
            "El monto excede el saldo pendiente de la cuota (queda {} por pagar)",
            remaining
        )));
    }

    // Insertar el pago
    let payment: Payment = sqlx::query_as(
        "INSERT INTO payments (installment_id, amount, payment_date, method, reference)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *",
    )
    .bind(installment_id)
    .bind(body.amount)
    .bind(payment_date)
    .bind(&method)
    .bind(&body.reference)
    .fetch_one(&pool)
    .await?;

    let new_paid = paid + body.amount;

    // Si la cuota quedó cubierta, actualizar estados
    if new_paid >= total {
        sqlx::query("UPDATE installments SET status = 'paid' WHERE id = $1")
            .bind(installment_id)
            .execute(&pool)
            .await?;

        let pending: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM installments WHERE loan_id = $1 AND status = 'pending'",
        )
        .bind(loan_id)
        .fetch_one(&pool)
        .await?;

        if pending.0 == 0 {
            sqlx::query("UPDATE loans SET status = 'paid' WHERE id = $1")
                .bind(loan_id)
                .execute(&pool)
                .await?;
        }
    }

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "payment": payment,
            "installment_remaining": (total - new_paid),
            "installment_status": if new_paid >= total { "paid" } else { "pending" },
        })),
    ))
}
