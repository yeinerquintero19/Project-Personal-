"""Cálculos financieros para los reportes de MerPrest."""

from __future__ import annotations

from datetime import date


def french_amortization(
    amount: float, annual_rate: float, months: int, start_date: date
) -> list[dict]:
    """Genera el plan de amortización francés (cuota fija).

    Fórmula: C = P * r / (1 - (1 + r)^-n), con r = tasa mensual.
    """
    monthly_rate = annual_rate / 12.0
    if monthly_rate <= 0:
        payment = amount / months
    else:
        payment = amount * monthly_rate / (1 - (1 + monthly_rate) ** -months)

    balance = amount
    schedule = []

    for number in range(1, months + 1):
        interest = balance * monthly_rate
        principal = balance if number == months else payment - interest
        balance_after = max(balance - principal, 0.0)

        schedule.append(
            {
                "number": number,
                "due_date": add_months(start_date, number).isoformat(),
                "payment": round(principal + interest, 2),
                "principal": round(principal, 2),
                "interest": round(interest, 2),
                "balance": round(balance_after, 2),
            }
        )
        balance = balance_after

    return schedule


def add_months(day: date, months: int) -> date:
    """Suma meses a una fecha manteniendo el día (con límite de fin de mes)."""
    month_index = day.month - 1 + months
    year = day.year + month_index // 12
    month = month_index % 12 + 1
    last_day = _days_in_month(year, month)
    return date(year, month, min(day.day, last_day))


def _days_in_month(year: int, month: int) -> int:
    if month == 12:
        next_month = date(year + 1, 1, 1)
    else:
        next_month = date(year, month + 1, 1)
    return (next_month - date(year, month, 1)).days
