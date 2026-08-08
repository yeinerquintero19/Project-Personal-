"""Reportes financieros y de análisis del portafolio de préstamos.

Este servicio (Python + FastAPI) complementa a la API principal escrita en
Rust: lee de la misma base de datos y entrega indicadores agregados,
listados de morosidad y análisis de riesgo.
"""

from __future__ import annotations

import math
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from ..db import get_conn
from ..finances import french_amortization

router = APIRouter(prefix="/api/reports", tags=["reports"])

NUMERIC = Decimal
DATE = date


def _clean(row: dict) -> dict:
    """Convierte Decimal/date/datetime a tipos JSON-serializables."""
    cleaned = {}
    for key, value in row.items():
        if isinstance(value, Decimal):
            cleaned[key] = float(value)
        elif isinstance(value, (date,)):
            cleaned[key] = value.isoformat()
        else:
            cleaned[key] = value
    return cleaned


# ---------------------------------------------------------------------------
# Modelos de respuesta
# ---------------------------------------------------------------------------

class AmortizationParams(BaseModel):
    amount: float = Field(gt=0, description="Monto del préstamo")
    annual_rate: float = Field(gt=0, le=1, description="Tasa anual (0.12 = 12%)")
    months: int = Field(ge=1, le=360, description="Plazo en meses")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/summary")
def portfolio_summary() -> dict:
    """Indicadores globales del portafolio de préstamos."""
    with get_conn() as conn:
        total_loaned = conn.execute(
            "SELECT COALESCE(SUM(amount), 0) FROM loans"
        ).fetchone()["coalesce"]

        active_loaned = conn.execute(
            "SELECT COALESCE(SUM(amount), 0) FROM loans WHERE status = 'active'"
        ).fetchone()["coalesce"]

        total_collected = conn.execute(
            "SELECT COALESCE(SUM(amount), 0) FROM payments"
        ).fetchone()["coalesce"]

        outstanding = conn.execute(
            """SELECT COALESCE(SUM(
                    i.principal + i.interest -
                    COALESCE((SELECT SUM(p.amount) FROM payments p
                              WHERE p.installment_id = i.id), 0)), 0)
               FROM installments i WHERE i.status = 'pending'"""
        ).fetchone()["coalesce"]

        expected_interest = conn.execute(
            "SELECT COALESCE(SUM(i.interest), 0) FROM installments i"
        ).fetchone()["coalesce"]

        overdue = conn.execute(
            """SELECT COUNT(*) AS count,
                      COALESCE(SUM(
                          i.principal + i.interest -
                          COALESCE((SELECT SUM(p.amount) FROM payments p
                                    WHERE p.installment_id = i.id), 0)), 0) AS amount
               FROM installments i
               WHERE i.status = 'pending' AND i.due_date < CURRENT_DATE"""
        ).fetchone()

        counts = conn.execute(
            "SELECT status, COUNT(*) AS n FROM loans GROUP BY status"
        ).fetchall()

        avg_rate = conn.execute(
            "SELECT COALESCE(AVG(annual_rate), 0) FROM loans"
        ).fetchone()["coalesce"]

    n_active = next((r["n"] for r in counts if r["status"] == "active"), 0)
    n_paid = next((r["n"] for r in counts if r["status"] == "paid"), 0)

    return {
        "total_loaned": float(total_loaned),
        "active_loaned": float(active_loaned),
        "total_collected": float(total_collected),
        "outstanding": float(outstanding),
        "expected_interest": float(expected_interest),
        "overdue_installments": int(overdue["count"]),
        "overdue_amount": float(overdue["amount"]),
        "active_loans": int(n_active),
        "paid_loans": int(n_paid),
        "average_annual_rate": float(avg_rate),
        "recovery_rate": (
            float(total_collected) / float(active_loaned + total_collected) * 100
            if float(active_loaned + total_collected) > 0
            else 0.0
        ),
        "generated_at": date.today().isoformat(),
    }


@router.get("/overdue")
def overdue_installments() -> list[dict]:
    """Cuotas vencidas con empresa, días de atraso y monto por cobrar."""
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT i.id, i.number, i.due_date, i.principal, i.interest,
                      COALESCE((SELECT SUM(p.amount) FROM payments p
                                WHERE p.installment_id = i.id), 0) AS paid_amount,
                      c.name AS company_name, c.ruc, l.id AS loan_id, l.currency
               FROM installments i
               JOIN loans l ON l.id = i.loan_id
               JOIN companies c ON c.id = l.company_id
               WHERE i.status = 'pending' AND i.due_date < CURRENT_DATE
               ORDER BY i.due_date"""
        ).fetchall()

    today = date.today()
    result = []
    for row in rows:
        remaining = row["principal"] + row["interest"] - row["paid_amount"]
        result.append(
            {
                **_clean(row),
                "days_overdue": (today - row["due_date"]).days,
                "remaining": float(remaining),
            }
        )
    return result


@router.get("/company/{company_id}")
def company_report(company_id: str) -> dict:
    """Reporte de una empresa: historial de préstamos y puntualidad."""
    with get_conn() as conn:
        company = conn.execute(
            "SELECT * FROM companies WHERE id = %s", (company_id,)
        ).fetchone()
        if company is None:
            raise HTTPException(status_code=404, detail="Empresa no encontrada")

        loans = conn.execute(
            """SELECT l.id, l.amount, l.annual_rate, l.term_months, l.start_date,
                      l.status, l.created_at,
                      COALESCE((SELECT SUM(p.amount) FROM payments p
                                JOIN installments i ON i.id = p.installment_id
                                WHERE i.loan_id = l.id), 0) AS paid,
                      (SELECT COUNT(*) FROM installments i
                       WHERE i.loan_id = l.id AND i.status = 'pending') AS pending_installments
               FROM loans l
               WHERE l.company_id = %s
               ORDER BY l.created_at DESC""",
            (company_id,),
        ).fetchall()

        punctuality = conn.execute(
            """SELECT AVG(p.payment_date - i.due_date) AS avg_days,
                      COUNT(*) FILTER (WHERE p.payment_date > i.due_date) AS late_payments,
                      COUNT(*) AS total_payments
               FROM payments p
               JOIN installments i ON i.id = p.installment_id
               JOIN loans l ON l.id = i.loan_id
               WHERE l.company_id = %s""",
            (company_id,),
        ).fetchone()

    total_loaned = sum(float(r["amount"]) for r in loans)
    total_paid = sum(float(r["paid"]) for r in loans)
    pending = sum(r["pending_installments"] for r in loans)

    avg_days = punctuality["avg_days"]
    punctuality_clean = {
        "avg_days_late": float(avg_days) if avg_days is not None else None,
        "late_payments": int(punctuality["late_payments"]),
        "total_payments": int(punctuality["total_payments"]),
    }

    return {
        "company": _clean(company),
        "loans": [_clean(r) for r in loans],
        "totals": {
            "total_loaned": total_loaned,
            "total_paid": total_paid,
            "outstanding": max(total_loaned - total_paid, 0.0),
            "pending_installments": int(pending),
        },
        "punctuality": punctuality_clean,
    }


@router.get("/portfolio-risk")
def portfolio_risk() -> dict:
    """Distribución del riesgo: concentración por empresa y salud de cuotas."""
    with get_conn() as conn:
        by_company = conn.execute(
            """SELECT c.id, c.name,
                      COALESCE(SUM(
                          i.principal + i.interest -
                          COALESCE((SELECT SUM(p.amount) FROM payments p
                                    WHERE p.installment_id = i.id), 0)), 0) AS outstanding
               FROM companies c
               JOIN loans l ON l.company_id = c.id
               JOIN installments i ON i.loan_id = l.id AND i.status = 'pending'
               GROUP BY c.id, c.name
               ORDER BY outstanding DESC"""
        ).fetchall()

        installment_health = conn.execute(
            """SELECT
                      COUNT(*) AS total,
                      COUNT(*) FILTER (WHERE i.status = 'paid') AS paid,
                      COUNT(*) FILTER (WHERE i.status = 'pending' AND i.due_date < CURRENT_DATE) AS late,
                      COUNT(*) FILTER (WHERE i.status = 'pending' AND i.due_date >= CURRENT_DATE) AS upcoming
               FROM installments i"""
        ).fetchone()

    total_outstanding = sum(float(r["outstanding"]) for r in by_company)

    companies = []
    for r in by_company:
        share = (
            float(r["outstanding"]) / total_outstanding * 100
            if total_outstanding > 0
            else 0.0
        )
        companies.append(
            {
                "id": r["id"],
                "name": r["name"],
                "outstanding": float(r["outstanding"]),
                "concentration_pct": round(share, 2),
                "rating": _rating(share),
            }
        )

    total = installment_health["total"] or 0
    late_pct = (
        (installment_health["late"] / total * 100) if total else 0.0
    )
    paid_pct = (
        (installment_health["paid"] / total * 100) if total else 0.0
    )

    return {
        "companies_concentration": companies,
        "installment_health": {
            "total": int(installment_health["total"]),
            "paid": int(installment_health["paid"]),
            "late": int(installment_health["late"]),
            "upcoming": int(installment_health["upcoming"]),
            "paid_pct": round(paid_pct, 2),
            "late_pct": round(late_pct, 2),
        },
    }


def _rating(concentration_pct: float) -> str:
    """Rating simple de concentración de riesgo por empresa."""
    if concentration_pct >= 50:
        return "ALTO"
    if concentration_pct >= 25:
        return "MEDIO"
    return "BAJO"


@router.get("/amortization")
def amortization_table(
    amount: float = Query(gt=0, description="Monto del préstamo"),
    annual_rate: float = Query(gt=0, le=1, description="Tasa anual (0.12 = 12%)"),
    months: int = Query(ge=1, le=360, description="Plazo en meses"),
) -> dict:
    """Tabla de amortización francesa simulada (no guarda nada)."""
    start = date.today()
    schedule = french_amortization(amount, annual_rate, months, start)

    total_payment = sum(item["payment"] for item in schedule)
    total_interest = total_payment - amount

    return {
        "params": {
            "amount": amount,
            "annual_rate": annual_rate,
            "months": months,
            "monthly_rate": round(annual_rate / 12, 6),
        },
        "schedule": schedule,
        "totals": {
            "monthly_payment": round(schedule[0]["payment"], 2),
            "total_payment": round(total_payment, 2),
            "total_interest": round(total_interest, 2),
        },
        "generated_at": start.isoformat(),
    }


@router.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "merprest-python", "version": "0.1.0"}
