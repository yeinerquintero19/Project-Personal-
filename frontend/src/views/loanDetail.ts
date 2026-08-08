import { api } from "../api";
import type { CreatePaymentPayload } from "../types";
import {
  closeModal,
  errorState,
  fmtDate,
  loading,
  methodLabel,
  money,
  openModal,
  pct,
  statusBadge,
  toast,
} from "../ui";

export function renderLoanDetail(container: HTMLElement, id: string): void {
  container.innerHTML = "";
  loading(container, "Cargando detalle del préstamo...");

  api.rust
    .loan(id)
    .then((loan) => {
      const nextPending = loan.installments.find((i) => i.status !== "paid");
      const paidCount = loan.installments.filter((i) => i.status === "paid").length;

      container.innerHTML = `
        <div class="grid-cards">
          <div class="card stat accent-green">
            <div class="stat-label">Monto</div>
            <div class="stat-value">${money(loan.amount, loan.currency)}</div>
            <div class="stat-foot">${loan.company_name}</div>
          </div>
          <div class="card stat accent-blue">
            <div class="stat-label">Cuotas</div>
            <div class="stat-value">${paidCount} / ${loan.installments.length}</div>
            <div class="stat-foot">${pct(loan.annual_rate)} tasa anual</div>
          </div>
          <div class="card stat accent-amber">
            <div class="stat-label">Estado</div>
            <div class="stat-value">${statusBadge(loan.status)}</div>
            <div class="stat-foot">Inició ${fmtDate(loan.start_date)}</div>
          </div>
          <div class="card stat accent-green">
            <div class="stat-label">Siguiente cuota</div>
            <div class="stat-value">${nextPending ? fmtDate(nextPending.due_date) : "—"}</div>
            <div class="stat-foot">${
              nextPending
                ? `${money(nextPending.principal + nextPending.interest, loan.currency)}`
                : "Préstamo al día"
            }</div>
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <h2>Cuotas</h2>
            ${
              nextPending
                ? `<button class="btn btn-primary" id="btn-pay">+ Registrar pago</button>`
                : ""
            }
          </div>
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Vence</th>
                  <th>Capital</th>
                  <th>Interés</th>
                  <th>Total</th>
                  <th>Pagado</th>
                  <th>Saldo</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                ${loan.installments
                  .map((i) => {
                    const total = Number(i.principal) + Number(i.interest);
                    const remaining = Math.max(total - Number(i.paid_amount), 0);
                    return `
                      <tr class="${i.status === "late" ? "row-late" : ""}">
                        <td>${i.number}</td>
                        <td>${fmtDate(i.due_date)}</td>
                        <td>${money(i.principal, loan.currency)}</td>
                        <td>${money(i.interest, loan.currency)}</td>
                        <td><strong>${money(total, loan.currency)}</strong></td>
                        <td>${money(i.paid_amount, loan.currency)}</td>
                        <td>${money(remaining, loan.currency)}</td>
                        <td>${statusBadge(i.status)}</td>
                      </tr>`;
                  })
                  .join("")}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h2>Historial de pagos</h2></div>
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr><th>Fecha</th><th>Cuota</th><th>Monto</th><th>Método</th><th>Referencia</th></tr>
              </thead>
              <tbody>
                ${
                  loan.payments.length === 0
                    ? `<tr><td colspan="5" class="td-empty">Sin pagos registrados</td></tr>`
                    : loan.payments
                        .map(
                          (p) => `
                            <tr>
                              <td>${fmtDate(p.payment_date)}</td>
                              <td>#${loan.installments.find((i) => i.id === p.installment_id)?.number ?? "?"}</td>
                              <td><strong>${money(p.amount, loan.currency)}</strong></td>
                              <td>${methodLabel(p.method)}</td>
                              <td>${p.reference ?? "—"}</td>
                            </tr>`,
                        )
                        .join("")
                }
              </tbody>
            </table>
          </div>
        </div>
      `;

      const payBtn = container.querySelector("#btn-pay");
      payBtn?.addEventListener("click", () => openPaymentForm(container, id, loan));
    })
    .catch((err) => errorState(container, err));
}

function openPaymentForm(
  container: HTMLElement,
  loanId: string,
  loan: import("../types").LoanDetail,
): void {
  const pending = loan.installments.filter((i) => i.status !== "paid");
  const target = pending[0];
  const total = Number(target.principal) + Number(target.interest);
  const remaining = Math.max(total - Number(target.paid_amount), 0);

  const dialog = openModal(`
    <form method="dialog" class="modal-body" id="payment-form">
      <h3>Registrar pago</h3>
      <label>Cuota a pagar
        <select name="installment_id">
          ${pending
            .map(
              (i) => `
                <option value="${i.id}" ${i.id === target.id ? "selected" : ""}>
                  #${i.number} · ${fmtDate(i.due_date)} (${money(
                    Number(i.principal) + Number(i.interest) - Number(i.paid_amount),
                    loan.currency,
                  )})
                </option>`,
            )
            .join("")}
        </select>
      </label>
      <div class="form-row">
        <label>Monto
          <input name="amount" type="number" step="0.01" min="0.01" required value="${remaining}" />
        </label>
        <label>Fecha
          <input name="payment_date" type="date" required value="${new Date().toISOString().slice(0, 10)}" />
        </label>
      </div>
      <label>Método
        <select name="method">
          <option value="bank_transfer">Transferencia</option>
          <option value="cash">Efectivo</option>
          <option value="check">Cheque</option>
          <option value="card">Tarjeta</option>
          <option value="other">Otro</option>
        </select>
      </label>
      <label>Referencia <input name="reference" maxlength="100" /></label>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-cancel>Cancelar</button>
        <button type="submit" class="btn btn-primary">Registrar pago</button>
      </div>
    </form>
  `);

  dialog.querySelector("[data-cancel]")?.addEventListener("click", () => closeModal(dialog));

  dialog.querySelector("form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(e.target as HTMLFormElement);
    const payload: CreatePaymentPayload = {
      installment_id: String(data.get("installment_id")),
      amount: String(data.get("amount")),
      payment_date: String(data.get("payment_date")),
      method: String(data.get("method")),
      reference: String(data.get("reference") ?? "") || undefined,
    };

    api.rust
      .registerPayment(loanId, payload)
      .then(() => {
        toast("Pago registrado");
        closeModal(dialog);
        renderLoanDetail(container, loanId);
      })
      .catch((err) => toast(err.message, "err"));
  });
}
