import { api } from "../api";
import { errorState, fmtDate, loading, money, pct, statusBadge } from "../ui";

export function renderDashboard(container: HTMLElement): void {
  container.innerHTML = "";
  loading(container, "Calculando métricas del portafolio...");

  api.rust
    .dashboard()
    .then((d) => {
      container.innerHTML = `
        <div class="grid-cards">
          <div class="card stat accent-green">
            <div class="stat-label">Capital desembolsado</div>
            <div class="stat-value">${money(d.total_loaned)}</div>
            <div class="stat-foot">${d.active_loans} préstamos activos</div>
          </div>
          <div class="card stat accent-blue">
            <div class="stat-label">Cobrado hasta hoy</div>
            <div class="stat-value">${money(d.total_collected)}</div>
            <div class="stat-foot">${d.paid_loans} préstamos pagados</div>
          </div>
          <div class="card stat accent-amber">
            <div class="stat-label">Por cobrar (cuotas)</div>
            <div class="stat-value">${money(d.outstanding)}</div>
            <div class="stat-foot">Saldo vivo del portafolio</div>
          </div>
          <div class="card stat ${d.overdue_installments > 0 ? "accent-red" : "accent-green"}">
            <div class="stat-label">Cuotas vencidas</div>
            <div class="stat-value">${d.overdue_installments}</div>
            <div class="stat-foot">${money(d.overdue_amount)} en riesgo</div>
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <h2>Préstamos recientes</h2>
            <a class="btn btn-ghost" href="#/loans">Ver todos →</a>
          </div>
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Monto</th>
                  <th>Tasa anual</th>
                  <th>Plazo</th>
                  <th>Inicio</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${d.recent_loans
                  .map(
                    (l) => `
                      <tr>
                        <td><strong>${l.company_name}</strong></td>
                        <td>${money(l.amount, l.currency)}</td>
                        <td>${pct(l.annual_rate)}</td>
                        <td>${l.term_months} meses</td>
                        <td>${fmtDate(l.start_date)}</td>
                        <td>${statusBadge(l.status)}</td>
                        <td><a class="link" href="#/loans/${l.id}">Ver →</a></td>
                      </tr>`,
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        </div>
      `;
    })
    .catch((err) => errorState(container, err));
}
