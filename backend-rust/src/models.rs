use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Companies
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, FromRow)]
pub struct Company {
    pub id: Uuid,
    pub name: String,
    pub ruc: String,
    pub contact_email: Option<String>,
    pub contact_phone: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct CompanyDetail {
    pub company: Company,
    pub loans: Vec<LoanListItem>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCompany {
    pub name: String,
    pub ruc: String,
    pub contact_email: Option<String>,
    pub contact_phone: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
pub struct UpdateCompany {
    pub name: Option<String>,
    pub ruc: Option<String>,
    pub contact_email: Option<String>,
    pub contact_phone: Option<String>,
}

// ---------------------------------------------------------------------------
// Loans
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, FromRow)]
pub struct Loan {
    pub id: Uuid,
    pub company_id: Uuid,
    pub amount: Decimal,
    pub annual_rate: Decimal,
    pub term_months: i32,
    pub start_date: NaiveDate,
    pub currency: String,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct LoanListItem {
    pub id: Uuid,
    pub company_id: Uuid,
    pub company_name: String,
    pub amount: Decimal,
    pub annual_rate: Decimal,
    pub term_months: i32,
    pub start_date: NaiveDate,
    pub currency: String,
    /// Estado efectivo: active | paid | late
    pub status: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateLoan {
    pub company_id: Uuid,
    pub amount: Decimal,
    pub annual_rate: Decimal,
    pub term_months: i32,
    pub start_date: Option<NaiveDate>,
    pub currency: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
pub struct LoanFilters {
    pub status: Option<String>,
    pub q: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct LoanDetail {
    pub id: Uuid,
    pub company_id: Uuid,
    pub company_name: String,
    pub amount: Decimal,
    pub annual_rate: Decimal,
    pub term_months: i32,
    pub start_date: NaiveDate,
    pub currency: String,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub installments: Vec<InstallmentDetail>,
    pub payments: Vec<Payment>,
}

// ---------------------------------------------------------------------------
// Installments
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, FromRow)]
pub struct Installment {
    pub id: Uuid,
    pub loan_id: Uuid,
    pub number: i32,
    pub due_date: NaiveDate,
    pub principal: Decimal,
    pub interest: Decimal,
    pub balance: Decimal,
    pub status: String,
}

#[derive(Debug, Serialize, FromRow)]
pub struct InstallmentDetail {
    pub id: Uuid,
    pub loan_id: Uuid,
    pub number: i32,
    pub due_date: NaiveDate,
    pub principal: Decimal,
    pub interest: Decimal,
    pub balance: Decimal,
    /// Estado efectivo: pending | paid | late
    pub status: String,
    pub paid_amount: Decimal,
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, FromRow)]
pub struct Payment {
    pub id: Uuid,
    pub installment_id: Uuid,
    pub amount: Decimal,
    pub payment_date: NaiveDate,
    pub method: String,
    pub reference: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePayment {
    pub installment_id: Option<Uuid>,
    pub amount: Decimal,
    pub payment_date: Option<NaiveDate>,
    pub method: Option<String>,
    pub reference: Option<String>,
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct Dashboard {
    pub total_loaned: Decimal,
    pub total_collected: Decimal,
    pub outstanding: Decimal,
    pub active_loans: i64,
    pub paid_loans: i64,
    pub overdue_installments: i64,
    pub overdue_amount: Decimal,
    pub recent_loans: Vec<LoanListItem>,
}
