import type {
  AmortizationResult,
  Company,
  CompanyDetail,
  CreateCompanyPayload,
  CreateLoanPayload,
  CreatePaymentPayload,
  Dashboard,
  LoanDetail,
  LoanListItem,
  OverdueInstallment,
  PortfolioRisk,
  ReportSummary,
} from "./types";

export const RUST_API =
  (import.meta.env.VITE_RUST_API as string | undefined) ?? "http://localhost:8080";
export const PYTHON_API =
  (import.meta.env.VITE_PYTHON_API as string | undefined) ?? "http://localhost:8000";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  if (!res.ok) {
    let message = `Error ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      message = body.error ?? message;
    } catch {
      /* respuesta sin JSON */
    }
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function qs(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") search.set(k, v);
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}

export const api = {
  rust: {
    dashboard: () => request<Dashboard>(`${RUST_API}/api/dashboard`),

    companies: () => request<Company[]>(`${RUST_API}/api/companies`),
    company: (id: string) => request<CompanyDetail>(`${RUST_API}/api/companies/${id}`),
    createCompany: (data: CreateCompanyPayload) =>
      request<Company>(`${RUST_API}/api/companies`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updateCompany: (id: string, data: Partial<CreateCompanyPayload>) =>
      request<Company>(`${RUST_API}/api/companies/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    deleteCompany: (id: string) =>
      request<void>(`${RUST_API}/api/companies/${id}`, { method: "DELETE" }),

    loans: (params?: { status?: string; q?: string }) =>
      request<LoanListItem[]>(`${RUST_API}/api/loans${qs(params ?? {})}`),
    loan: (id: string) => request<LoanDetail>(`${RUST_API}/api/loans/${id}`),
    createLoan: (data: CreateLoanPayload) =>
      request<LoanDetail>(`${RUST_API}/api/loans`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    registerPayment: (loanId: string, data: CreatePaymentPayload) =>
      request<unknown>(`${RUST_API}/api/loans/${loanId}/payments`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  python: {
    summary: () => request<ReportSummary>(`${PYTHON_API}/api/reports/summary`),
    overdue: () => request<OverdueInstallment[]>(`${PYTHON_API}/api/reports/overdue`),
    portfolioRisk: () =>
      request<PortfolioRisk>(`${PYTHON_API}/api/reports/portfolio-risk`),
    amortization: (amount: number, annualRate: number, months: number) =>
      request<AmortizationResult>(
        `${PYTHON_API}/api/reports/amortization?amount=${amount}&annual_rate=${annualRate}&months=${months}`,
      ),
  },
};
