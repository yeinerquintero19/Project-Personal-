use chrono::{Months, NaiveDate};
use rust_decimal::prelude::*;
use rust_decimal::Decimal;

/// Semilla para crear una cuota del plan de amortización.
pub struct InstallmentSeed {
    pub number: u32,
    pub due_date: NaiveDate,
    pub principal: Decimal,
    pub interest: Decimal,
    pub balance: Decimal,
}

/// Plan de amortización francés (cuota fija).
///
/// - `amount`: monto del préstamo (P)
/// - `annual_rate`: tasa anual (ej. 0.12 = 12 %)
/// - `months`: número de cuotas (n)
/// - `start_date`: fecha de desembolso
///
/// Cuota fija: `C = P * r / (1 - (1 + r)^-n)` donde `r` es la tasa mensual.
pub fn french_schedule(
    amount: Decimal,
    annual_rate: Decimal,
    months: u32,
    start_date: NaiveDate,
) -> Vec<InstallmentSeed> {
    let amount_f = amount.to_f64().unwrap_or(0.0);
    let monthly_rate = annual_rate.to_f64().unwrap_or(0.0) / 12.0;
    let n = months as f64;

    let payment = if monthly_rate <= 0.0 {
        amount_f / n
    } else {
        amount_f * monthly_rate / (1.0 - (1.0 + monthly_rate).powf(-n))
    };

    let mut balance = amount_f;
    let mut schedule = Vec::with_capacity(months as usize);

    for i in 1..=months {
        let interest = balance * monthly_rate;
        // En la última cuota se ajusta el capital para liquidar el saldo.
        let principal = if i == months { balance } else { payment - interest };
        let balance_after = (balance - principal).max(0.0);

        schedule.push(InstallmentSeed {
            number: i,
            due_date: start_date
                .checked_add_months(Months::new(i))
                .unwrap_or(start_date),
            principal: dec2(principal),
            interest: dec2(interest),
            balance: dec2(balance_after),
        });

        balance = balance_after;
    }

    schedule
}

/// Redondea a 2 decimales y convierte a Decimal.
fn dec2(v: f64) -> Decimal {
    Decimal::from_f64_retain((v * 100.0).round() / 100.0).unwrap_or_default()
}
