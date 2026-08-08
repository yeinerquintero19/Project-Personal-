export function money(value: string | number, currency = "USD"): string {
  const n = typeof value === "string" ? Number(value) : value;
  const symbol = currency === "USD" ? "US$" : "S/";
  return `${symbol} ${n.toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function pct(value: string | number): string {
  const n = typeof value === "string" ? Number(value) : value;
  return `${(n * 100).toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

export function fmtDate(value: string): string {
  const [y, m, d] = value.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function statusBadge(status: string): string {
  const labels: Record<string, string> = {
    active: "Activo",
    paid: "Pagado",
    late: "Vencido",
    pending: "Pendiente",
  };
  const label = labels[status] ?? status;
  return `<span class="badge badge-${status}">${label}</span>`;
}

export function methodLabel(method: string): string {
  const labels: Record<string, string> = {
    bank_transfer: "Transferencia",
    cash: "Efectivo",
    check: "Cheque",
    card: "Tarjeta",
    other: "Otro",
  };
  return labels[method] ?? method;
}

let toastTimer: number | undefined;

export function toast(message: string, type: "ok" | "err" = "ok"): void {
  const root = document.getElementById("toast-root");
  if (!root) return;
  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  el.textContent = message;
  root.appendChild(el);
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    el.classList.add("toast-hide");
    window.setTimeout(() => el.remove(), 300);
  }, 3200);
}

export function openModal(html: string): HTMLDialogElement {
  const dialog = document.createElement("dialog");
  dialog.className = "modal";
  dialog.innerHTML = html;
  document.body.appendChild(dialog);
  dialog.showModal();
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });
  return dialog;
}

export function closeModal(dialog: HTMLDialogElement): void {
  dialog.close();
  dialog.remove();
}

export function loading(container: HTMLElement, text = "Cargando..."): void {
  container.innerHTML = `<div class="loading"><div class="spinner"></div><p>${text}</p></div>`;
}

export function emptyState(container: HTMLElement, text: string): void {
  container.innerHTML = `<div class="empty">${text}</div>`;
}

export function errorState(container: HTMLElement, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  container.innerHTML = `
    <div class="empty empty-err">
      <p><strong>Ups, algo salió mal</strong></p>
      <p>${message}</p>
      <button class="btn btn-ghost" onclick="location.reload()">Reintentar</button>
    </div>`;
}
