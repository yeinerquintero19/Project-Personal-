export interface Company {
  id: string;
  name: string;
  ruc: string;
  contact_email: string | null;
  contact_phone: string | null;
  created_at: string;
}

export interface CompanyDetail {
  company: Company;
  loans: LoanListItem[];
}

export interface CreateCompanyPayload {
  name: string;
  ruc: string;
  contact_email?: string | null;
  contact_phone?: string | null;
}

export type LoanStatus = "active" | "paid" | "late";

export interface LoanListItem {
  id: string;
  company_id: string;
  company_name: string;
  amount: string;
  annual_rate: string;
  term_months: number;
  start_date: string;
  currency: string;
  status: LoanStatus;
  created_at: string;
}

export interface Installment {
  id: string;
  loan_id: string;
  number: number;
  due_date: string;
  principal: string;
  interest: string;
  balance: string;
  status: "pending" | "paid" | "late";
  paid_amount: string;
}

export interface Payment {
  id: string;
  installment_id: string;
  amount: string;
  payment_date: string;
  method: string;
  reference: string | null;
  created_at: string;
}

export interface LoanDetail {
  id: string;
  company_id: string;
  company_name: string;
  amount: string;
  annual_rate: string;
  term_months: number;
  start_date: string;
  currency: string;
  status: LoanStatus;
  created_at: string;
  installments: Installment[];
  payments: Payment[];
}

export interface CreateLoanPayload {
  company_id: string;
  amount: string;
  annual_rate: string;
  term_months: number;
  start_date?: string;
  currency?: string;
}

export interface CreatePaymentPayload {
  installment_id?: string;
  amount: string;
  payment_date?: string;
  method?: string;
  reference?: string;
}

export interface Dashboard {
  total_loaned: string;
  total_collected: string;
  outstanding: string;
  active_loans: number;
  paid_loans: number;
  overdue_installments: number;
  overdue_amount: string;
  recent_loans: LoanListItem[];
}

export interface ReportSummary {
  total_loaned: number;
  active_loaned: number;
  total_collected: number;
  outstanding: number;
  expected_interest: number;
  overdue_installments: number;
  overdue_amount: number;
  active_loans: number;
  paid_loans: number;
  average_annual_rate: number;
  recovery_rate: number;
  generated_at: string;
}

export interface OverdueInstallment {
  id: string;
  number: number;
  due_date: string;
  principal: number;
  interest: number;
  paid_amount: number;
  company_name: string;
  ruc: string;
  loan_id: string;
  currency: string;
  days_overdue: number;
  remaining: number;
}

export interface PortfolioRisk {
  companies_concentration: {
    id: string;
    name: string;
    outstanding: number;
    concentration_pct: number;
    rating: string;
  }[];
  installment_health: {
    total: number;
    paid: number;
    late: number;
    upcoming: number;
    paid_pct: number;
    late_pct: number;
  };
}

export interface AmortizationResult {
  params: {
    amount: number;
    annual_rate: number;
    months: number;
    monthly_rate: number;
  };
  schedule: {
    number: number;
    due_date: string;
    payment: number;
    principal: number;
    interest: number;
    balance: number;
  }[];
  totals: {
    monthly_payment: number;
    total_payment: number;
    total_interest: number;
  };
  generated_at: string;
}
