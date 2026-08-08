import { api } from "../api";
import type { Company, CreateLoanPayload } from "../types";
import {
  closeModal,
  errorState,
  fmtDate,
  loading,
  money,
  openModal,
  pct,
  statusBadge,
  toast,
} from "../ui";

let companies: Company[] = [];

export function renderLoans(container: HTMLElement): void {
  container.innerHTML = "";
  loading(container, "Cargando préstamos...");

  Promise.all([api.rust.loans(), api.rust.companies()])
    .then(([loans, companiesList]) => {
      companies = companiesList;
      container.innerHTML = `
        <div class="card">
          <div class="card-head">
            <h2>Préstamos</h2>
            <div class="head-actions">
              <select id="filter-status" class="select">
                <option value="">Todos</option>
                <option value="active">Activos</option>
                <option value="late">Vencidos</option>
                <option value="paid">Pagados</option>
              </select>
              <button class="btn btn-primary" id="btn-new-loan">+ Nuevo préstamo</button>
            </div>
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
              <tbody id="loans-body">
                ${renderRows(loans)}
              </tbody>
            </table>
          </div>
        </div>
      `;

      container.querySelector("#btn-new-loan")?.addEventListener("click", () => openLoanForm(container));
      container.querySelector("#filter-status")?.addEventListener("change", async (e) => {
        const status = (e.target as HTMLSelectElement).value;
        try {
          const filtered = await api.rust.loans({ status });
          container.querySelector("#loans-body")!.innerHTML = renderRows(filtered);
        } catch (err) {
          toast((err as Error).message, "err");
        }
      });
    })
    .catch((err) => errorState(container, err));
}

function renderRows(loans: import("../types").LoanListItem[]): string {
  if (loans.length === 0) return `<tr><td colspan="7" class="td-empty">Sin préstamos</td></tr>`;
  return loans
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
    .join("");
}

function openLoanForm(container: HTMLElement): void {
  if (companies.length === 0) {
    toast("Primero registra una empresa", "err");
    return;
  }

  const dialog = openModal(`
    <form method="dialog" class="modal-body modal-wide" id="loan-form">
      <h3>Nuevo préstamo</h3>
      <label>Empresa
        <select name="company_id" required>
          ${companies.map((c) => `<option value="${c.id}">${c.name}</option>`).join("")}
        </select>
      </label>
      <div class="form-row">
        <label>Monto (US$)
          <input name="amount" type="number" step="0.01" min="1" required value="10000" />
        </label>
        <label>Tasa anual (%)
          <input name="annual_rate" type="number" step="0.01" min="0.1" max="100" required value="12" />
        </label>
      </div>
      <div class="form-row">
        <label>Plazo (meses)
          <input name="term_months" type="number" min="1" max="360" required value="12" />
        </label>
        <label>Fecha de desembolso
          <input name="start_date" type="date" required value="${new Date().toISOString().slice(0, 10)}" />
        </label>
      </div>
      <div id="amort-preview" class="preview">
        <div class="preview-row"><span>Cuota mensual estimada</span><strong id="pv-quota">—</strong></div>
        <div class="preview-row"><span>Interés total estimado</span><strong id="pv-interest">—</strong></div>
        <div class="preview-row"><span>Total a pagar</span><strong id="pv-total">—</strong></div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-cancel>Cancelar</button>
        <button type="submit" class="btn btn-primary">Crear préstamo</button>
      </div>
    </form>
  `);

  const form = dialog.querySelector("form") as HTMLFormElement;
  dialog.querySelector("[data-cancel]")?.addEventListener("click", () => closeModal(dialog));

  const refreshPreview = () => {
    const amount = Number((form.elements.namedItem("amount") as HTMLInputElement).value);
    const rate = Number((form.elements.namedItem("annual_rate") as HTMLInputElement).value) / 100;
    const months = Number((form.elements.namedItem("term_months") as HTMLInputElement).value);
    if (!amount || !rate || !months) return;
    api.python.amortization(amount, rate, months).then((r) => {
      dialog.querySelector("#pv-quota")!.textContent = money(r.totals.monthly_payment);
      dialog.querySelector("#pv-interest")!.textContent = money(r.totals.total_interest);
      dialog.querySelector("#pv-total")!.textContent = money(r.totals.total_payment);
    }).catch(() => { /* vista previa opcional */ });
  };

  form.querySelectorAll("input").forEach((i) => i.addEventListener("input", refreshPreview));
  refreshPreview();

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const payload: CreateLoanPayload = {
      company_id: String(data.get("company_id")),
      amount: String(data.get("amount")),
      annual_rate: String(Number(data.get("annual_rate")) / 100),
      term_months: Number(data.get("term_months")),
      start_date: String(data.get("start_date")),
    };

    api.rust
      .createLoan(payload)
      .then((loan) => {
        toast("Préstamo creado con sus cuotas");
        closeModal(dialog);
        renderLoans(container);
        window.location.hash = `#/loans/${loan.id}`;
      })
      .catch((err) => toast(err.message, "err"));
  });
}
