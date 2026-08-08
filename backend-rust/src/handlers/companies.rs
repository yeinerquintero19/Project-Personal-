use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use serde::Deserialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::{ApiError, ApiResult};
use crate::models::{Company, CompanyDetail, CreateCompany, LoanListItem, UpdateCompany};

#[derive(Debug, Deserialize)]
pub struct ListParams {
    pub q: Option<String>,
}

pub async fn list(
    State(pool): State<PgPool>,
    Query(params): Query<ListParams>,
) -> ApiResult<Json<Vec<Company>>> {
    let companies = match params.q {
        Some(q) if !q.trim().is_empty() => {
            let pattern = format!("%{}%", q.trim());
            sqlx::query_as::<_, Company>(
                "SELECT * FROM companies
                 WHERE name ILIKE $1 OR ruc ILIKE $1 OR contact_email ILIKE $1
                 ORDER BY created_at DESC",
            )
            .bind(&pattern)
            .fetch_all(&pool)
            .await?
        }
        _ => {
            sqlx::query_as::<_, Company>("SELECT * FROM companies ORDER BY created_at DESC")
                .fetch_all(&pool)
                .await?
        }
    };
    Ok(Json(companies))
}

pub async fn get(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<CompanyDetail>> {
    let company: Company = sqlx::query_as("SELECT * FROM companies WHERE id = $1")
        .bind(id)
        .fetch_one(&pool)
        .await?;

    let loans: Vec<LoanListItem> = sqlx::query_as(
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
         WHERE l.company_id = $1
         ORDER BY l.created_at DESC",
    )
    .bind(id)
    .fetch_all(&pool)
    .await?;

    Ok(Json(CompanyDetail { company, loans }))
}

pub async fn create(
    State(pool): State<PgPool>,
    Json(body): Json<CreateCompany>,
) -> ApiResult<(StatusCode, Json<Company>)> {
    let company = sqlx::query_as::<_, Company>(
        "INSERT INTO companies (name, ruc, contact_email, contact_phone)
         VALUES ($1, $2, $3, $4)
         RETURNING *",
    )
    .bind(&body.name)
    .bind(&body.ruc)
    .bind(&body.contact_email)
    .bind(&body.contact_phone)
    .fetch_one(&pool)
    .await
    .map_err(|e| ApiError::sqlx(e, "Ya existe una empresa con ese RUC"))?;

    Ok((StatusCode::CREATED, Json(company)))
}

pub async fn update(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateCompany>,
) -> ApiResult<Json<Company>> {
    let mut sets: Vec<String> = Vec::new();
    let mut values: Vec<String> = Vec::new();

    if let Some(v) = body.name {
        values.push(v);
        sets.push(format!("name = ${}", values.len()));
    }
    if let Some(v) = body.ruc {
        values.push(v);
        sets.push(format!("ruc = ${}", values.len()));
    }
    if let Some(v) = body.contact_email {
        values.push(v);
        sets.push(format!("contact_email = ${}", values.len()));
    }
    if let Some(v) = body.contact_phone {
        values.push(v);
        sets.push(format!("contact_phone = ${}", values.len()));
    }

    if sets.is_empty() {
        return Err(ApiError::BadRequest(
            "No se enviaron campos para actualizar".to_string(),
        ));
    }

    let query = format!(
        "UPDATE companies SET {} WHERE id = ${} RETURNING *",
        sets.join(", "),
        values.len() + 1
    );

    let mut q = sqlx::query_as::<_, Company>(&query).bind(id);
    for v in values {
        q = q.bind(v);
    }
    let company = q
        .fetch_one(&pool)
        .await
        .map_err(|e| ApiError::sqlx(e, "Ya existe una empresa con ese RUC"))?;

    Ok(Json(company))
}

pub async fn delete(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> ApiResult<StatusCode> {
    let result = sqlx::query("DELETE FROM companies WHERE id = $1")
        .bind(id)
        .execute(&pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(ApiError::NotFound(
            "No se encontró la empresa".to_string(),
        ));
    }
    Ok(StatusCode::NO_CONTENT)
}
