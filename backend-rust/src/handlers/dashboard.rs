use axum::extract::State;
use axum::Json;
use rust_decimal::Decimal;
use sqlx::PgPool;

use crate::error::ApiResult;
use crate::models::{Dashboard, LoanListItem};

pub async fn get(State(pool): State<PgPool>) -> ApiResult<Json<Dashboard>> {
    let total_loaned: (Decimal,) = sqlx::query_as(
        "SELECT COALESCE(SUM(amount), 0) FROM loans WHERE status = 'active'",
    )
    .fetch_one(&pool)
    .await?;

    let total_collected: (Decimal,) =
        sqlx::query_as("SELECT COALESCE(SUM(amount), 0) FROM payments")
            .fetch_one(&pool)
            .await?;

    // Saldo pendiente por cobrar (solo cuotas no pagadas)
    let outstanding: (Decimal,) = sqlx::query_as(
        "SELECT COALESCE(SUM(
                i.principal + i.interest -
                COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.installment_id = i.id), 0)
            ), 0)
         FROM installments i WHERE i.status = 'pending'",
    )
    .fetch_one(&pool)
    .await?;

    let active_loans: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM loans WHERE status = 'active'")
            .fetch_one(&pool)
            .await?;

    let paid_loans: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM loans WHERE status = 'paid'")
            .fetch_one(&pool)
            .await?;

    let overdue_installments: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM installments i
         WHERE i.status = 'pending' AND i.due_date < CURRENT_DATE",
    )
    .fetch_one(&pool)
    .await?;

    let overdue_amount: (Decimal,) = sqlx::query_as(
        "SELECT COALESCE(SUM(
                i.principal + i.interest -
                COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.installment_id = i.id), 0)
            ), 0)
         FROM installments i
         WHERE i.status = 'pending' AND i.due_date < CURRENT_DATE",
    )
    .fetch_one(&pool)
    .await?;

    let recent_loans: Vec<LoanListItem> = sqlx::query_as(
        "SELECT l.id, l.company_id, c.name AS company_name, l.amount, l.annual_rate,
                l.term_months, l.start_date, l.currency,
                CASE WHEN l.status = 'paid' THEN 'paid'
                     WHEN EXISTS (SELECT 1 FROM installments i
                                  WHERE i.loan_id = l.id AND i.status = 'pending'
                                    AND i.due_date < CURRENT_DATE) THEN 'late'
                     ELSE 'active' END AS status,
                l.created_at
         FROM loans l
         JOIN companies c ON c.id = l.company_id
         ORDER BY l.created_at DESC
         LIMIT 5",
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(Dashboard {
        total_loaned: total_loaned.0,
        total_collected: total_collected.0,
        outstanding: outstanding.0,
        active_loans: active_loans.0,
        paid_loans: paid_loans.0,
        overdue_installments: overdue_installments.0,
        overdue_amount: overdue_amount.0,
        recent_loans,
    }))
}
