use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::{ApiError, ApiResult};
use crate::interest;
use crate::models::{
    CreateLoan, InstallmentDetail, Loan, LoanDetail, LoanFilters, LoanListItem, Payment,
};

const LOAN_SELECT: &str = "SELECT l.id, l.company_id, c.name AS company_name, l.amount,
        l.annual_rate, l.term_months, l.start_date, l.currency,
        CASE WHEN l.status = 'paid' THEN 'paid'
             WHEN EXISTS (SELECT 1 FROM installments i
                          WHERE i.loan_id = l.id AND i.status = 'pending'
                            AND i.due_date < CURRENT_DATE) THEN 'late'
             ELSE 'active' END AS status,
        l.created_at
 FROM loans l
 JOIN companies c ON c.id = l.company_id";

pub async fn list(
    State(pool): State<PgPool>,
    Query(filters): Query<LoanFilters>,
) -> ApiResult<Json<Vec<LoanListItem>>> {
    let mut where_clauses: Vec<String> = Vec::new();

    match filters.status.as_deref() {
        Some("paid") => where_clauses.push("l.status = 'paid'".to_string()),
        Some("active") => where_clauses.push("l.status = 'active'".to_string()),
        Some("late") => where_clauses.push(
            "l.status = 'active' AND EXISTS (
                SELECT 1 FROM installments i
                WHERE i.loan_id = l.id AND i.status = 'pending'
                  AND i.due_date < CURRENT_DATE)"
                .to_string(),
        ),
        _ => {}
    }

    let mut has_q = false;
    if let Some(q) = filters.q.as_ref() {
        if !q.trim().is_empty() {
            where_clauses.push("c.name ILIKE $1".to_string());
            has_q = true;
        }
    }

    let sql = if where_clauses.is_empty() {
        format!("{LOAN_SELECT} ORDER BY l.created_at DESC")
    } else {
        format!(
            "{LOAN_SELECT} WHERE {} ORDER BY l.created_at DESC",
            where_clauses.join(" AND ")
        )
    };

    let mut query = sqlx::query_as::<_, LoanListItem>(&sql);
    if has_q {
        let pattern = format!("%{}%", filters.q.as_deref().unwrap_or("").trim());
        query = query.bind(pattern);
    }

    let loans: Vec<LoanListItem> = query.fetch_all(&pool).await?;
    Ok(Json(loans))
}

pub async fn get(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<LoanDetail>> {
    let detail = fetch_detail(&pool, id).await?;
    Ok(Json(detail))
}

pub async fn create(
    State(pool): State<PgPool>,
    Json(body): Json<CreateLoan>,
) -> ApiResult<(StatusCode, Json<LoanDetail>)> {
    let currency = body.currency.unwrap_or_else(|| "USD".to_string());
    let start_date = body
        .start_date
        .unwrap_or_else(|| chrono::Utc::now().date_naive());

    if body.term_months <= 0 {
        return Err(ApiError::BadRequest(
            "El plazo debe ser al menos 1 mes".to_string(),
        ));
    }

    // Validar que la empresa exista
    let exists: (bool,) = sqlx::query_as(
        "SELECT EXISTS(SELECT 1 FROM companies WHERE id = $1)",
    )
    .bind(body.company_id)
    .fetch_one(&pool)
    .await?;
    if !exists.0 {
        return Err(ApiError::NotFound(
            "No se encontró la empresa indicada".to_string(),
        ));
    }

    let schedule = interest::french_schedule(
        body.amount,
        body.annual_rate,
        body.term_months as u32,
        start_date,
    );

    let mut tx = pool.begin().await?;

    let loan: Loan = sqlx::query_as(
        "INSERT INTO loans (company_id, amount, annual_rate, term_months, start_date, currency)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *",
    )
    .bind(body.company_id)
    .bind(body.amount)
    .bind(body.annual_rate)
    .bind(body.term_months)
    .bind(start_date)
    .bind(&currency)
    .fetch_one(&mut *tx)
    .await?;

    for seed in &schedule {
        sqlx::query(
            "INSERT INTO installments (loan_id, number, due_date, principal, interest, balance)
             VALUES ($1, $2, $3, $4, $5, $6)",
        )
        .bind(loan.id)
        .bind(seed.number as i32)
        .bind(seed.due_date)
        .bind(seed.principal)
        .bind(seed.interest)
        .bind(seed.balance)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    let detail = fetch_detail(&pool, loan.id).await?;
    Ok((StatusCode::CREATED, Json(detail)))
}

/// Carga el detalle completo de un préstamo (empresa, cuotas con estado efectivo
/// y pagos registrados).
pub async fn fetch_detail(pool: &PgPool, id: Uuid) -> ApiResult<LoanDetail> {
    let loan: LoanListItem = sqlx::query_as(&format!("{LOAN_SELECT} WHERE l.id = $1"))
        .bind(id)
        .fetch_one(pool)
        .await?;

    let installments: Vec<InstallmentDetail> = sqlx::query_as(
        "SELECT i.id, i.loan_id, i.number, i.due_date, i.principal, i.interest, i.balance,
                CASE WHEN i.status = 'paid' THEN 'paid'
                     WHEN i.due_date < CURRENT_DATE THEN 'late'
                     ELSE 'pending' END AS status,
                COALESCE((SELECT SUM(p.amount) FROM payments p
                          WHERE p.installment_id = i.id), 0)::numeric AS paid_amount
         FROM installments i
         WHERE i.loan_id = $1
         ORDER BY i.number",
    )
    .bind(id)
    .fetch_all(pool)
    .await?;

    let payments: Vec<Payment> = sqlx::query_as(
        "SELECT p.* FROM payments p
         JOIN installments i ON i.id = p.installment_id
         WHERE i.loan_id = $1
         ORDER BY p.created_at DESC",
    )
    .bind(id)
    .fetch_all(pool)
    .await?;

    Ok(LoanDetail {
        id: loan.id,
        company_id: loan.company_id,
        company_name: loan.company_name,
        amount: loan.amount,
        annual_rate: loan.annual_rate,
        term_months: loan.term_months,
        start_date: loan.start_date,
        currency: loan.currency,
        status: loan.status,
        created_at: loan.created_at,
        installments,
        payments,
    })
}
