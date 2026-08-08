import "./styles.css";
import { RUST_API, PYTHON_API } from "./api";
import { renderCompanies } from "./views/companies";
import { renderDashboard } from "./views/dashboard";
import { renderLoanDetail } from "./views/loanDetail";
import { renderLoans } from "./views/loans";
import { renderReports } from "./views/reports";

const view = document.getElementById("view") as HTMLElement;
const titles: Record<string, string> = {
  dashboard: "Panel",
  loans: "Préstamos",
  companies: "Empresas",
  reports: "Reportes",
  "loan-detail": "Detalle del préstamo",
};

function navigate(): void {
  const hash = location.hash.replace(/^#\/?/, "") || "dashboard";
  const [route, param] = hash.split("/");

  document.querySelectorAll("[data-nav]").forEach((el) => {
    el.classList.toggle("active", el.getAttribute("data-nav") === route);
  });

  const titleEl = document.getElementById("page-title");
  if (titleEl) titleEl.textContent = titles[route] ?? "MerPrest";

  switch (route) {
    case "loans":
      if (param) renderLoanDetail(view, param);
      else renderLoans(view);
      break;
    case "companies":
      renderCompanies(view);
      break;
    case "reports":
      renderReports(view);
      break;
    default:
      renderDashboard(view);
  }
}

window.addEventListener("hashchange", navigate);
window.addEventListener("pp:refresh", navigate);

// Reloj en vivo
function tick(): void {
  const clock = document.getElementById("clock");
  if (clock) {
    clock.textContent = new Date().toLocaleString("es-PE", {
      dateStyle: "full",
      timeStyle: "short",
    });
  }
}
tick();
window.setInterval(tick, 1000);

// Estado de los servicios en la barra lateral
async function checkServices(): Promise<void> {
  const set = (id: string, ok: boolean) => {
    const el = document.getElementById(id);
    if (el) el.className = `svc-dot ${ok ? "ok" : "down"}`;
  };
  try {
    const res = await fetch(`${RUST_API}/health`);
    set("svc-rust", res.ok);
  } catch {
    set("svc-rust", false);
  }
  try {
    const res = await fetch(`${PYTHON_API}/api/reports/health`);
    set("svc-py", res.ok);
  } catch {
    set("svc-py", false);
  }
}
checkServices();
window.setInterval(checkServices, 15000);

navigate();
