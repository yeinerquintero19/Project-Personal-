import { api } from "../api";
import type { AmortizationResult } from "../types";
import { errorState, fmtDate, loading, money, pct, toast } from "../ui";

export function renderReports(container: HTMLElement): void {
  container.innerHTML = "";
  loading(container, "Generando reportes financieros...");

  Promise.all([api.python.summary(), api.python.overdue(), api.python.portfolioRisk()])
    .then(([summary, overdue, risk]) => {
      container.innerHTML = `
        <div class="grid-cards">
          <div class="card stat accent-green">
            <div class="stat-label">Capital total desembolsado</div>
            <div class="stat-value">${money(summary.total_loaned)}</div>
            <div class="stat-foot">${money(summary.active_loaned)} activo hoy</div>
          </div>
          <div class="card stat accent-blue">
            <div class="stat-label">Recuperado</div>
            <div class="stat-value">${money(summary.total_collected)}</div>
            <div class="stat-foot">Tasa de recuperación ${summary.recovery_rate.toFixed(1)}%</div>
          </div>
          <div class="card stat accent-amber">
            <div class="stat-label">Cartera vencida</div>
            <div class="stat-value">${money(summary.overdue_amount)}</div>
            <div class="stat-foot">${summary.overdue_installments} cuotas vencidas</div>
          </div>
          <div class="card stat accent-blue">
            <div class="stat-label">Interés esperado</div>
            <div class="stat-value">${money(summary.expected_interest)}</div>
            <div class="stat-foot">Tasa promedio ${pct(summary.average_annual_rate)}</div>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h2>Morosidad</h2></div>
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr><th>Empresa</th><th>Cuota</th><th>Vencimiento</th><th>Días de atraso</th><th>Por cobrar</th></tr>
              </thead>
              <tbody>
                ${
                  overdue.length === 0
                    ? `<tr><td colspan="5" class="td-empty">¡Sin cuotas vencidas!</td></tr>`
                    : overdue
                        .map(
                          (o) => `
                            <tr>
                              <td><strong>${o.company_name}</strong></td>
                              <td>#${o.number}</td>
                              <td>${fmtDate(o.due_date)}</td>
                              <td class="danger-text">${o.days_overdue} días</td>
                              <td>${money(o.remaining, o.currency)}</td>
                            </tr>`,
                        )
                        .join("")
                }
              </tbody>
            </table>
          </div>
        </div>

        <div class="grid-2">
          <div class="card">
            <div class="card-head"><h2>Salud del portafolio</h2></div>
            <div class="bars">
              <div class="bar-row">
                <span>Pagadas</span>
                <div class="bar-track"><div class="bar-fill green" style="width:${risk.installment_health.paid_pct}%"></div></div>
                <span>${risk.installment_health.paid} (${risk.installment_health.paid_pct}%)</span>
              </div>
              <div class="bar-row">
                <span>Por vencer</span>
                <div class="bar-track"><div class="bar-fill blue" style="width:${Math.max(100 - risk.installment_health.paid_pct - risk.installment_health.late_pct, 0)}%"></div></div>
                <span>${risk.installment_health.upcoming}</span>
              </div>
              <div class="bar-row">
                <span>Vencidas</span>
                <div class="bar-track"><div class="bar-fill red" style="width:${risk.installment_health.late_pct}%"></div></div>
                <span>${risk.installment_health.late} (${risk.installment_health.late_pct}%)</span>
              </div>
            </div>
            <h3 class="subtitle">Concentración por empresa</h3>
            <div class="table-wrap">
              <table class="table">
                <thead><tr><th>Empresa</th><th>Por cobrar</th><th>% del total</th><th>Rating</th></tr></thead>
                <tbody>
                  ${risk.companies_concentration
                    .map(
                      (c) => `
                        <tr>
                          <td><strong>${c.name}</strong></td>
                          <td>${money(c.outstanding)}</td>
                          <td>${c.concentration_pct}%</td>
                          <td>${riskBadge(c.rating)}</td>
                        </tr>`,
                    )
                    .join("")}
                </tbody>
              </table>
            </div>
          </div>

          <div class="card">
            <div class="card-head"><h2>Simulador de amortización</h2></div>
            <form id="sim-form" class="sim-form">
              <div class="form-row">
                <label>Monto <input name="amount" type="number" step="0.01" min="1" required value="50000" /></label>
                <label>Tasa anual (%) <input name="rate" type="number" step="0.01" min="0.1" required value="12" /></label>
              </div>
              <div class="form-row">
                <label>Plazo (meses) <input name="months" type="number" min="1" max="360" required value="12" /></label>
                <button type="submit" class="btn btn-primary" style="margin-top:22px">Calcular</button>
              </div>
            </form>
            <div id="sim-result"></div>
          </div>
        </div>
      `;

      container.querySelector("#sim-form")?.addEventListener("submit", (e) => {
        e.preventDefault();
        const data = new FormData(e.target as HTMLFormElement);
        const amount = Number(data.get("amount"));
        const rate = Number(data.get("rate")) / 100;
        const months = Number(data.get("months"));
        api.python
          .amortization(amount, rate, months)
          .then((r) => renderSimulator(container.querySelector("#sim-result")!, r))
          .catch((err) => toast(err.message, "err"));
      });
    })
    .catch((err) => errorState(container, err));
}

function riskBadge(rating: string): string {
  const cls = rating === "ALTO" ? "badge-late" : rating === "MEDIO" ? "badge-active" : "badge-paid";
  return `<span class="badge ${cls}">${rating}</span>`;
}

function renderSimulator(el: HTMLElement, r: AmortizationResult): void {
  el.innerHTML = `
    <div class="preview">
      <div class="preview-row"><span>Cuota mensual</span><strong>${money(r.totals.monthly_payment)}</strong></div>
      <div class="preview-row"><span>Total a pagar</span><strong>${money(r.totals.total_payment)}</strong></div>
      <div class="preview-row"><span>Interés total</span><strong>${money(r.totals.total_interest)}</strong></div>
    </div>
    <div class="table-wrap sim-table">
      <table class="table">
        <thead><tr><th>N°</th><th>Vence</th><th>Cuota</th><th>Capital</th><th>Interés</th><th>Saldo</th></tr></thead>
        <tbody>
          ${r.schedule
            .map(
              (s) => `
                <tr>
                  <td>${s.number}</td>
                  <td>${fmtDate(s.due_date)}</td>
                  <td>${money(s.payment)}</td>
                  <td>${money(s.principal)}</td>
                  <td>${money(s.interest)}</td>
                  <td>${money(s.balance)}</td>
                </tr>`,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}
