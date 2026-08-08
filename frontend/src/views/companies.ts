import { api } from "../api";
import type { Company, CreateCompanyPayload } from "../types";
import {
  closeModal,
  errorState,
  fmtDate,
  loading,
  openModal,
  toast,
} from "../ui";

export function renderCompanies(container: HTMLElement): void {
  container.innerHTML = "";
  loading(container, "Cargando empresas...");

  api.rust
    .companies()
    .then((companies) => {
      container.innerHTML = `
        <div class="card">
          <div class="card-head">
            <h2>Empresas clientes</h2>
            <button class="btn btn-primary" id="btn-new-company">+ Nueva empresa</button>
          </div>
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>RUC</th>
                  <th>Contacto</th>
                  <th>Teléfono</th>
                  <th>Registrada</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${
                  companies.length === 0
                    ? `<tr><td colspan="6" class="td-empty">Aún no hay empresas registradas</td></tr>`
                    : companies
                        .map(
                          (c) => `
                            <tr>
                              <td><strong>${c.name}</strong></td>
                              <td class="mono">${c.ruc}</td>
                              <td>${c.contact_email ?? "—"}</td>
                              <td>${c.contact_phone ?? "—"}</td>
                              <td>${fmtDate(c.created_at)}</td>
                              <td class="row-actions">
                                <button class="btn btn-sm btn-ghost" data-edit="${c.id}">Editar</button>
                                <button class="btn btn-sm btn-danger" data-del="${c.id}">Eliminar</button>
                              </td>
                            </tr>`,
                        )
                        .join("")
                }
              </tbody>
            </table>
          </div>
        </div>
      `;

      const newBtn = container.querySelector("#btn-new-company");
      newBtn?.addEventListener("click", () => openCompanyForm(null));

      container.querySelectorAll("[data-edit]").forEach((btn) => {
        const id = btn.getAttribute("data-edit")!;
        btn.addEventListener("click", () => {
          const company = companies.find((c) => c.id === id);
          if (company) openCompanyForm(company);
        });
      });

      container.querySelectorAll("[data-del]").forEach((btn) => {
        const id = btn.getAttribute("data-del")!;
        btn.addEventListener("click", () => {
          const company = companies.find((c) => c.id === id)!;
          if (confirm(`¿Eliminar a "${company.name}"? Se borrarán sus préstamos y pagos.`)) {
            api.rust
              .deleteCompany(id)
              .then(() => {
                toast("Empresa eliminada");
                renderCompanies(container);
              })
              .catch((err) => toast(err.message, "err"));
          }
        });
      });
    })
    .catch((err) => errorState(container, err));
}

function openCompanyForm(company: Company | null): void {
  const editing = company !== null;
  const dialog = openModal(`
    <form method="dialog" class="modal-body" id="company-form">
      <h3>${editing ? "Editar empresa" : "Nueva empresa"}</h3>
      <label>Nombre
        <input name="name" required maxlength="150" value="${company?.name ?? ""}" />
      </label>
      <label>RUC
        <input name="ruc" required maxlength="20" value="${company?.ruc ?? ""}" />
      </label>
      <label>Correo de contacto
        <input name="contact_email" type="email" value="${company?.contact_email ?? ""}" />
      </label>
      <label>Teléfono
        <input name="contact_phone" maxlength="30" value="${company?.contact_phone ?? ""}" />
      </label>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-cancel>Cancelar</button>
        <button type="submit" class="btn btn-primary">Guardar</button>
      </div>
    </form>
  `);

  dialog.querySelector("[data-cancel]")?.addEventListener("click", () => closeModal(dialog));

  dialog.querySelector("form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const data = new FormData(form);
    const payload: CreateCompanyPayload = {
      name: String(data.get("name") ?? "").trim(),
      ruc: String(data.get("ruc") ?? "").trim(),
      contact_email: String(data.get("contact_email") ?? "").trim() || null,
      contact_phone: String(data.get("contact_phone") ?? "").trim() || null,
    };

    const submit = () => {
      const action = editing
        ? api.rust.updateCompany(company!.id, payload)
        : api.rust.createCompany(payload);

      action
        .then(() => {
          toast(editing ? "Empresa actualizada" : "Empresa creada");
          closeModal(dialog);
          window.dispatchEvent(new Event("pp:refresh"));
        })
        .catch((err) => toast(err.message, "err"));
    };

    if (!editing) {
      // Vista previa rápida: mostrar monto prestado no aplica aquí
      submit();
    } else {
      submit();
    }
  });
}
