-- =============================================================
-- PrestaPro - Esquema inicial de la base de datos (PostgreSQL)
-- Se ejecuta automáticamente la primera vez que se levanta el
-- contenedor de PostgreSQL via docker-entrypoint-initdb.d.
-- =============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -------------------------------------------------------------
-- Empresas (clientes que piden préstamos)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS companies (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(150) NOT NULL,
    ruc           VARCHAR(20)  NOT NULL UNIQUE,
    contact_email VARCHAR(150),
    contact_phone VARCHAR(30),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------
-- Préstamos
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS loans (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    amount       NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    annual_rate  NUMERIC(6,4)  NOT NULL CHECK (annual_rate > 0),
    term_months  INT           NOT NULL CHECK (term_months BETWEEN 1 AND 360),
    start_date   DATE          NOT NULL DEFAULT CURRENT_DATE,
    currency     VARCHAR(3)    NOT NULL DEFAULT 'USD',
    status       VARCHAR(10)   NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'paid')),
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------
-- Cuotas (plan de amortización francés)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS installments (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id   UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    number    INT  NOT NULL,
    due_date  DATE NOT NULL,
    principal NUMERIC(14,2) NOT NULL,
    interest  NUMERIC(14,2) NOT NULL,
    balance   NUMERIC(14,2) NOT NULL,
    status    VARCHAR(10)    NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'paid')),
    UNIQUE (loan_id, number)
);

-- -------------------------------------------------------------
-- Pagos (uno o más por cuota)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    installment_id UUID NOT NULL REFERENCES installments(id) ON DELETE CASCADE,
    amount         NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    payment_date   DATE NOT NULL DEFAULT CURRENT_DATE,
    method         VARCHAR(20) NOT NULL DEFAULT 'bank_transfer'
                   CHECK (method IN ('bank_transfer', 'cash', 'check', 'card', 'other')),
    reference      VARCHAR(100),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_loans_company   ON loans(company_id);
CREATE INDEX IF NOT EXISTS idx_loans_status    ON loans(status);
CREATE INDEX IF NOT EXISTS idx_inst_loan       ON installments(loan_id);
CREATE INDEX IF NOT EXISTS idx_inst_due_date   ON installments(due_date);
CREATE INDEX IF NOT EXISTS idx_payments_inst   ON payments(installment_id);

-- -------------------------------------------------------------
-- Datos de ejemplo (solo si la tabla está vacía)
-- -------------------------------------------------------------
INSERT INTO companies (name, ruc, contact_email, contact_phone) VALUES
    ('Empresa Andina SAC',    '20100012345', 'finanzas@andina.pe',      '+51 1 555 0101'),
    ('TechSoluciones EIRL',   '20600067890', 'contabilidad@techsol.pe', '+51 1 555 0202'),
    ('AgroInversiones Norte', '20450098765', 'cobranzas@agronorte.pe',  '+51 73 555 0303')
ON CONFLICT DO NOTHING;

INSERT INTO loans (company_id, amount, annual_rate, term_months, start_date, status)
SELECT id, 50000.00, 0.1200, 12, CURRENT_DATE - INTERVAL '60 days', 'active'
FROM companies WHERE ruc = '20100012345'
ON CONFLICT DO NOTHING;

INSERT INTO loans (company_id, amount, annual_rate, term_months, start_date, status)
SELECT id, 12000.00, 0.1800, 6, CURRENT_DATE - INTERVAL '30 days', 'active'
FROM companies WHERE ruc = '20600067890'
ON CONFLICT DO NOTHING;
