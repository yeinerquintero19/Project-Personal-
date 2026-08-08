import os
import sqlite3
import time
import uuid
from datetime import date, datetime, timedelta
from typing import Optional

import yfinance as yf
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

BASE = os.path.dirname(os.path.abspath(__file__))
def _db_path():
    for p in (os.path.join(BASE, "data", "merprest.db"), os.path.join("/tmp", "merprest.db")):
        try:
            os.makedirs(os.path.dirname(p), exist_ok=True)
            with open(p, "a", encoding="utf-8"):
                pass
            return p
        except Exception:
            continue
    return os.path.join("/tmp", "merprest.db")
DB_PATH = _db_path()

app = FastAPI(title="MerPrest Capital")

# ---------------------------------------------------------------- DB
def get_db():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    return con

def seed():
    con = get_db()
    con.executescript("""
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, ruc TEXT, contact_email TEXT,
      contact_phone TEXT, balance REAL DEFAULT 0, created_at TEXT);
    CREATE TABLE IF NOT EXISTS loans (
      id TEXT PRIMARY KEY, company_id TEXT, amount REAL, annual_rate REAL,
      term_months INTEGER, start_date TEXT, status TEXT DEFAULT 'requested', created_at TEXT);
    CREATE TABLE IF NOT EXISTS installments (
      id TEXT PRIMARY KEY, loan_id TEXT, number INTEGER, due_date TEXT,
      principal REAL, interest REAL, total REAL, balance REAL, paid_amount REAL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY, installment_id TEXT, loan_id TEXT, amount REAL,
      payment_date TEXT, method TEXT, reference TEXT);
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY CHECK (id=1), cash REAL DEFAULT 10000,
      savings REAL DEFAULT 0, savings_rate REAL DEFAULT 0.06, last_interest_date TEXT);
    CREATE TABLE IF NOT EXISTS positions (
      symbol TEXT PRIMARY KEY, qty REAL, avg_cost REAL);
    CREATE TABLE IF NOT EXISTS trades (
      id TEXT PRIMARY KEY, symbol TEXT, side TEXT, qty REAL, price REAL,
      total REAL, fee REAL, pnl REAL DEFAULT 0, executed_at TEXT);
    CREATE TABLE IF NOT EXISTS ledger (
      id TEXT PRIMARY KEY, ts TEXT, type TEXT, symbol TEXT, amount REAL, detail TEXT);
    CREATE TABLE IF NOT EXISTS snapshots (day TEXT PRIMARY KEY, value REAL);
    """)
    if not con.execute("SELECT 1 FROM accounts").fetchone():
        con.execute("INSERT INTO accounts (id, cash, savings, savings_rate, last_interest_date) VALUES (1, 10000, 0, 0.06, ?)", (today(),))
        demo = [
            ("Empresa Andina SAC", "20100012345", "finanzas@andina.pe", "+51 1 555 0101"),
            ("TechSoluciones EIRL", "20600067890", "contabilidad@techsol.pe", "+51 1 555 0202"),
            ("AgroInversiones Norte", "20450098765", "cobranzas@agronorte.pe", "+51 73 555 0303"),
        ]
        for name, ruc, email, phone in demo:
            con.execute("INSERT INTO companies VALUES (?,?,?,?,?,0,?)", (uuid.uuid4().hex, name, ruc, email, phone, today()))
    con.commit()
    con.close()

def uid():
    return uuid.uuid4().hex

def today():
    return date.today().isoformat()

def r2(v):
    return round(v * 100) / 100

def add_months(d: str, m: int) -> str:
    dt = datetime.strptime(d, "%Y-%m-%d")
    month = dt.month - 1 + m
    year = dt.year + month // 12
    month = month % 12 + 1
    day = min(dt.day, [31, 29 if year % 4 == 0 else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1])
    return f"{year:04d}-{month:02d}-{day:02d}"

def log(con, type_, amount, symbol=None, detail=None):
    con.execute("INSERT INTO ledger (id, ts, type, symbol, amount, detail) VALUES (?,?,?,?,?,?)",
                (uid(), datetime.now().isoformat(timespec="seconds"), type_, symbol, r2(amount), detail))

def french_schedule(amount, annual_rate, months, start):
    r = annual_rate / 12
    payment = amount * r / (1 - (1 + r) ** -months) if r > 0 else amount / months
    bal, out = amount, []
    for i in range(1, months + 1):
        interest = bal * r
        principal = bal if i == months else payment - interest
        bal = max(bal - principal, 0)
        out.append((uid(), i, add_months(start, i), r2(principal), r2(interest), r2(principal + interest), r2(bal)))
    return out

seed()

# ---------------------------------------------------------------- Market data
SYMBOLS = [("MSFT", "Microsoft"), ("AAPL", "Apple"), ("GOOGL", "Alphabet"), ("AMZN", "Amazon"),
           ("NVDA", "NVIDIA"), ("TSLA", "Tesla"), ("META", "Meta"), ("NFLX", "Netflix")]
SYMBOL_NAMES = dict(SYMBOLS)
_cached = {}

def cached(key, ttl, fn):
    now = time.time()
    hit = _cached.get(key)
    if hit and now - hit[0] < ttl:
        return hit[1]
    val = fn()
    _cached[key] = (now, val)
    return val

def _download(symbols, period, interval):
    df = yf.download(symbols, period=period, interval=interval, progress=False, auto_adjust=True, group_by="ticker", threads=True)
    if df is None or df.empty:
        raise RuntimeError("sin datos de Yahoo Finance")
    return df

def _flat(df):
    if hasattr(df.columns, "nlevels") and df.columns.nlevels > 1:
        df.columns = df.columns.get_level_values(0)
    return df

def quotes():
    def fetch():
        multi = len(SYMBOLS) > 1
        df = _download(" ".join(s[0] for s in SYMBOLS), "5d", "1d")
        out = {}
        for sym, _ in SYMBOLS:
            try:
                sub = _flat(df[sym]) if multi else _flat(df)
                close = sub["Close"].dropna()
                if len(close) < 2:
                    continue
                price, prev = float(close.iloc[-1]), float(close.iloc[-2])
                if price != price or prev != prev or price <= 0:
                    continue
                out[sym] = {"price": price, "prevClose": prev, "change": r2(price - prev),
                            "changePct": r2((price - prev) / prev * 100)}
            except Exception:
                continue
        return out
    return cached("quotes", 20, fetch)

def sparklines():
    def fetch():
        multi = len(SYMBOLS) > 1
        df = _download(" ".join(s[0] for s in SYMBOLS), "3mo", "1d")
        out = {}
        for sym, _ in SYMBOLS:
            try:
                sub = _flat(df[sym]) if multi else _flat(df)
                close = sub["Close"].dropna()
                if len(close) >= 5:
                    out[sym] = [float(v) for v in close]
            except Exception:
                continue
        return out
    return cached("sparks", 300, fetch)

def candles(symbol, rng):
    ranges = {"1D": ("1d", "5m"), "5D": ("5d", "15m"), "1M": ("1mo", "1h"), "6M": ("6mo", "1d"),
              "1Y": ("1y", "1d"), "5Y": ("5y", "1wk")}
    period, interval = ranges.get(rng, ("6mo", "1d"))

    def fetch():
        df = _flat(yf.download(symbol, period=period, interval=interval, progress=False, auto_adjust=True))
        df = df.dropna()
        out = []
        for idx, row in df.iterrows():
            ts = int(idx.timestamp())
            out.append({"time": ts, "open": float(row["Open"]), "high": float(row["High"]),
                        "low": float(row["Low"]), "close": float(row["Close"]),
                        "volume": float(row["Volume"]) if "Volume" in df.columns else 0})
        return out
    return cached(f"candles-{symbol}-{rng}", 60, fetch)

def live_price(symbol):
    q = quotes()
    if symbol in q:
        return q[symbol]["price"]
    try:
        return float(yf.Ticker(symbol).fast_info.last_price)
    except Exception:
        return None

def apply_savings_interest(con):
    acc = con.execute("SELECT * FROM accounts WHERE id=1").fetchone()
    if acc["savings"] > 0 and acc["last_interest_date"] < today():
        days = (date.today() - datetime.strptime(acc["last_interest_date"], "%Y-%m-%d").date()).days
        if days > 0:
            interest = r2(acc["savings"] * acc["savings_rate"] / 365 * days)
            if interest > 0.005:
                con.execute("UPDATE accounts SET savings=savings+?, last_interest_date=? WHERE id=1", (interest, today()))
                log(con, "savings_interest", interest, detail="Interés del colchón")

def account(con):
    apply_savings_interest(con)
    con.commit()
    return con.execute("SELECT * FROM accounts WHERE id=1").fetchone()

def positions_with_prices():
    con = get_db()
    rows = con.execute("SELECT * FROM positions WHERE qty > 0").fetchall()
    con.close()
    q = quotes()
    out = []
    for r in rows:
        p = q.get(r["symbol"], {}).get("price")
        if p is None:
            continue
        mv = r2(r["qty"] * p)
        cost = r2(r["qty"] * r["avg_cost"])
        out.append({"symbol": r["symbol"], "name": SYMBOL_NAMES.get(r["symbol"], r["symbol"]),
                    "qty": r["qty"], "avgCost": r2(r["avg_cost"]), "price": p,
                    "marketValue": mv, "cost": cost, "pnl": r2(mv - cost),
                    "pnlPct": r2((p - r["avg_cost"]) / r["avg_cost"] * 100) if r["avg_cost"] else 0})
    return sorted(out, key=lambda x: -x["marketValue"])

def loan_outstanding(con, loan_id, amount):
    rows = con.execute("SELECT total, paid_amount, principal FROM installments WHERE loan_id=?", (loan_id,)).fetchall()
    paid_principal = sum(r2(r["principal"] * min(r["paid_amount"], r["total"]) / r["total"]) if r["total"] else 0 for r in rows)
    return r2(max(0, amount - paid_principal))

def loan_summary(con, loan):
    rows = con.execute("SELECT paid_amount, total, principal, due_date FROM installments WHERE loan_id=?", (loan["id"],)).fetchall()
    if loan["status"] == "requested" or not rows:
        status = "requested" if loan["status"] == "requested" else "active"
    elif all(r["paid_amount"] >= r["total"] - 0.005 for r in rows):
        status = "paid"
    elif any(r["paid_amount"] < r["total"] - 0.005 and r["due_date"] < today() for r in rows):
        status = "late"
    else:
        status = "active"
    interest_collected = sum(r["paid_amount"] - r["principal"] * min(r["paid_amount"], r["total"]) / r["total"] if r["total"] else 0 for r in rows) if status != "requested" else 0
    return {"id": loan["id"], "companyId": loan["company_id"], "companyName": loan["company_name"],
            "amount": loan["amount"], "rate": loan["annual_rate"], "term": loan["term_months"],
            "startDate": loan["start_date"], "createdAt": loan["created_at"], "status": status,
            "outstanding": r2(loan_outstanding(con, loan["id"], loan["amount"])),
            "interestCollected": r2(interest_collected)}

# ---------------------------------------------------------------- Models
class CompanyIn(BaseModel):
    name: str = Field(min_length=2)
    ruc: str = ""
    contact_email: str = ""
    contact_phone: str = ""

class LoanIn(BaseModel):
    company_id: str
    amount: float = Field(gt=0, le=10_000_000)
    annual_rate: float = Field(ge=0.001, le=0.9)
    term_months: int = Field(ge=1, le=120)

class PaymentIn(BaseModel):
    installment_id: str
    amount: float = Field(gt=0)
    method: str = "bank_transfer"
    reference: str = ""

class TradeIn(BaseModel):
    symbol: str = Field(min_length=1, max_length=10)
    side: str = Field(pattern="^(buy|sell)$")
    qty: float = Field(gt=0)

class SavingsIn(BaseModel):
    action: str = Field(pattern="^(deposit|withdraw)$")
    amount: float = Field(gt=0)

# ---------------------------------------------------------------- API
@app.get("/api/overview")
def overview():
    con = get_db()
    acc = account(con)
    pos = positions_with_prices()
    invest_value = r2(sum(p["marketValue"] for p in pos))
    total = r2(acc["cash"] + acc["savings"] + invest_value)
    con.execute("INSERT OR IGNORE INTO snapshots (day, value) VALUES (?,?)", (today(), total))
    con.commit()
    rows = con.execute("SELECT * FROM ledger ORDER BY ts DESC LIMIT 12").fetchall()
    con.close()
    return {"cash": r2(acc["cash"]), "savings": r2(acc["savings"]), "savingsRate": acc["savings_rate"],
            "investments": {"value": invest_value,
                            "pnl": r2(sum(p["pnl"] for p in pos)),
                            "pnlPct": r2(sum(p["pnl"] for p in pos) / sum(p["cost"] for p in pos) * 100) if pos else 0},
            "total": total, "ledger": [dict(r) for r in rows]}

@app.get("/api/watchlist")
def watchlist():
    q, sp = quotes(), sparklines()
    return {"symbols": [{"symbol": s, "name": name, **q[s],
                         "spark": sp.get(s, [])} for s, name in SYMBOLS if s in q]}

@app.get("/api/candles/{symbol}")
def get_candles(symbol: str, range: str = "6M"):
    symbol = symbol.upper()
    try:
        return {"symbol": symbol, "candles": candles(symbol, range)}
    except Exception as e:
        raise HTTPException(502, f"No se pudieron cargar datos de {symbol}: {e}")

@app.get("/api/positions")
def positions():
    return {"positions": positions_with_prices()}

@app.get("/api/trades")
def trade_history():
    con = get_db()
    rows = con.execute("SELECT * FROM trades ORDER BY executed_at DESC LIMIT 100").fetchall()
    con.close()
    return {"trades": [dict(r) for r in rows]}

@app.get("/api/equity")
def equity():
    con = get_db()
    rows = con.execute("SELECT day, value FROM snapshots ORDER BY day").fetchall()
    con.close()
    return {"points": [{"day": r["day"], "value": r["value"]} for r in rows]}

COMMISSION = 0.001
MIN_COMMISSION = 0.99

@app.post("/api/trade")
def trade(body: TradeIn):
    price = live_price(body.symbol)
    if not price:
        raise HTTPException(502, f"No hay precio disponible para {body.symbol}")
    con = get_db()
    acc = account(con)
    gross = r2(price * body.qty)
    fee = r2(max(gross * COMMISSION, MIN_COMMISSION))
    if body.side == "buy":
        total = r2(gross + fee)
        if total > acc["cash"] + 0.005:
            con.close()
            raise HTTPException(400, "Efectivo insuficiente para la compra")
        cur = con.execute("SELECT * FROM positions WHERE symbol=?", (body.symbol,)).fetchone()
        old_qty = cur["qty"] if cur else 0
        old_cost = cur["avg_cost"] if cur else 0
        new_qty = old_qty + body.qty
        avg = r2((old_qty * old_cost + gross + fee) / new_qty)
        con.execute("INSERT INTO positions (symbol, qty, avg_cost) VALUES (?,?,?) ON CONFLICT(symbol) DO UPDATE SET qty=?, avg_cost=?",
                    (body.symbol, new_qty, avg, new_qty, avg))
        con.execute("UPDATE accounts SET cash=cash-? WHERE id=1", (total,))
        pnl = 0
    else:
        cur = con.execute("SELECT * FROM positions WHERE symbol=?", (body.symbol,)).fetchone()
        if not cur or cur["qty"] < body.qty - 0.0001:
            con.close()
            raise HTTPException(400, f"No tienes {body.qty} de {body.symbol}")
        revenue = r2(gross - fee)
        pnl = r2(revenue - cur["avg_cost"] * body.qty)
        new_qty = r2(cur["qty"] - body.qty)
        if new_qty <= 0.0001:
            con.execute("DELETE FROM positions WHERE symbol=?", (body.symbol,))
        else:
            con.execute("UPDATE positions SET qty=? WHERE symbol=?", (new_qty, body.symbol))
        con.execute("UPDATE accounts SET cash=cash+? WHERE id=1", (revenue,))
        total = -revenue
    con.execute("INSERT INTO trades (id, symbol, side, qty, price, total, fee, pnl, executed_at) VALUES (?,?,?,?,?,?,?,?,?)",
                (uid(), body.symbol, body.side, body.qty, price, r2(gross), fee, pnl, datetime.now().isoformat(timespec="seconds")))
    log(con, "trade_" + body.side, total, body.symbol, detail=f"{'Compra' if body.side=='buy' else 'Venta'} {body.qty} {body.symbol}")
    con.commit()
    con.close()
    return {"ok": True, "price": price, "pnl": pnl, "side": body.side}

@app.post("/api/savings")
def savings(body: SavingsIn):
    con = get_db()
    acc = account(con)
    amount = r2(body.amount)
    if body.action == "deposit":
        if amount > acc["cash"] + 0.005:
            con.close()
            raise HTTPException(400, "Efectivo insuficiente para guardar en el colchón")
        con.execute("UPDATE accounts SET cash=cash-?, savings=savings+? WHERE id=1", (amount, amount))
        log(con, "savings_deposit", -amount, detail="Guardado en el colchón")
    else:
        if amount > acc["savings"] + 0.005:
            con.close()
            raise HTTPException(400, "No hay tanto guardado en el colchón")
        con.execute("UPDATE accounts SET cash=cash+?, savings=savings-? WHERE id=1", (amount, amount))
        log(con, "savings_withdraw", amount, detail="Retiro del colchón")
    con.commit()
    acc = account(con)
    con.close()
    return {"cash": r2(acc["cash"]), "savings": r2(acc["savings"])}

@app.get("/api/companies")
def companies():
    con = get_db()
    rows = con.execute("""
        SELECT c.*, (SELECT COUNT(*) FROM loans l WHERE l.company_id=c.id) AS loan_count,
               (SELECT COUNT(*) FROM loans l WHERE l.company_id=c.id AND l.status!='requested' AND l.status!='paid') AS active_loans
        FROM companies c ORDER BY c.name""").fetchall()
    con.close()
    return {"companies": [dict(r) for r in rows]}

@app.post("/api/companies")
def add_company(body: CompanyIn):
    con = get_db()
    cid = uid()
    con.execute("INSERT INTO companies (id, name, ruc, contact_email, contact_phone, balance, created_at) VALUES (?,?,?,?,?,0,?)",
                (cid, body.name, body.ruc, body.contact_email, body.contact_phone, today()))
    con.commit()
    con.close()
    return {"id": cid}

@app.get("/api/loans")
def loans_list():
    con = get_db()
    rows = con.execute("SELECT l.*, c.name AS company_name FROM loans l JOIN companies c ON c.id=l.company_id ORDER BY l.created_at DESC").fetchall()
    out = [loan_summary(con, r) for r in rows]
    con.close()
    return {"loans": out}

@app.post("/api/loans")
def create_loan(body: LoanIn):
    con = get_db()
    if not con.execute("SELECT 1 FROM companies WHERE id=?", (body.company_id,)).fetchone():
        con.close()
        raise HTTPException(404, "Empresa no encontrada")
    lid = uid()
    con.execute("INSERT INTO loans (id, company_id, amount, annual_rate, term_months, start_date, status, created_at) VALUES (?,?,?,?,?,NULL,'requested',?)",
                (lid, body.company_id, body.amount, body.annual_rate, body.term_months, today()))
    con.commit()
    con.close()
    return {"id": lid}

@app.post("/api/loans/{loan_id}/disburse")
def disburse(loan_id: str):
    con = get_db()
    loan = con.execute("SELECT * FROM loans WHERE id=?", (loan_id,)).fetchone()
    if not loan or loan["status"] != "requested":
        con.close()
        raise HTTPException(404, "Préstamo no encontrado o ya desembolsado")
    for inst in french_schedule(loan["amount"], loan["annual_rate"], loan["term_months"], today()):
        con.execute("INSERT INTO installments (id, loan_id, number, due_date, principal, interest, total, balance, paid_amount) VALUES (?,?,?,?,?,?,?,?,0)", (inst[0], loan_id) + inst[1:])
    con.execute("UPDATE loans SET status='active', start_date=? WHERE id=?", (today(), loan_id))
    con.execute("UPDATE accounts SET cash=cash-? WHERE id=1", (loan["amount"],))
    con.execute("UPDATE companies SET balance=balance+? WHERE id=?", (loan["amount"], loan["company_id"]))
    log(con, "loan_disbursement", -loan["amount"], detail=f"Desembolso préstamo {loan['amount']:,.2f}")
    con.commit()
    con.close()
    return {"ok": True}

@app.post("/api/loans/{loan_id}/delete")
def delete_loan(loan_id: str):
    con = get_db()
    loan = con.execute("SELECT * FROM loans WHERE id=?", (loan_id,)).fetchone()
    if not loan:
        con.close()
        raise HTTPException(404, "Préstamo no encontrado")
    if loan["status"] != "requested":
        outstanding = loan_outstanding(con, loan_id, loan["amount"])
        con.execute("UPDATE accounts SET cash=cash+? WHERE id=1", (outstanding,))
        con.execute("UPDATE companies SET balance=balance-? WHERE id=?", (outstanding, loan["company_id"]))
        log(con, "loan_reversal", outstanding, detail=f"Eliminación de préstamo (capital pendiente)")
    con.execute("DELETE FROM installments WHERE loan_id=?", (loan_id,))
    con.execute("DELETE FROM loans WHERE id=?", (loan_id,))
    con.commit()
    con.close()
    return {"ok": True}

@app.get("/api/loans/{loan_id}")
def loan_detail(loan_id: str):
    con = get_db()
    loan = con.execute("SELECT l.*, c.name AS company_name FROM loans l JOIN companies c ON c.id=l.company_id WHERE l.id=?", (loan_id,)).fetchone()
    if not loan:
        con.close()
        raise HTTPException(404, "Préstamo no encontrado")
    insts = con.execute("SELECT * FROM installments WHERE loan_id=? ORDER BY number", (loan_id,)).fetchall()
    con.close()
    out = loan_summary(get_db(), loan)
    detail = []
    for i in insts:
        if i["paid_amount"] >= i["total"] - 0.005:
            st = "paid"
        elif i["due_date"] < today():
            st = "late"
        else:
            st = "pending"
        detail.append({"id": i["id"], "number": i["number"], "dueDate": i["due_date"],
                       "principal": i["principal"], "interest": i["interest"], "total": i["total"],
                       "paidAmount": i["paid_amount"], "pending": r2(i["total"] - i["paid_amount"]),
                       "status": st})
    out["installments"] = detail
    return out

@app.post("/api/payments")
def pay_installment(body: PaymentIn):
    con = get_db()
    inst = con.execute("SELECT * FROM installments WHERE id=?", (body.installment_id,)).fetchone()
    if not inst:
        con.close()
        raise HTTPException(404, "Cuota no encontrada")
    pending = r2(inst["total"] - inst["paid_amount"])
    if body.amount > pending + 0.01:
        con.close()
        raise HTTPException(400, f"El pago excede lo pendiente de la cuota ({pending:,.2f})")
    amount = r2(body.amount)
    con.execute("UPDATE installments SET paid_amount=paid_amount+? WHERE id=?", (amount, inst["id"]))
    con.execute("INSERT INTO payments (id, installment_id, loan_id, amount, payment_date, method, reference) VALUES (?,?,?,?,?,?,?)",
                (uid(), inst["id"], inst["loan_id"], amount, today(), body.method, body.reference))
    con.execute("UPDATE accounts SET cash=cash+? WHERE id=1", (amount,))
    con.execute("UPDATE companies SET balance=MAX(balance-?,0) WHERE id=?",
                (amount, con.execute("SELECT company_id FROM loans WHERE id=?", (inst["loan_id"],)).fetchone()["company_id"]))
    log(con, "loan_payment", amount, detail=f"Pago de cuota #{inst['number']} del préstamo")
    all_paid = con.execute("SELECT COUNT(*) c FROM installments WHERE loan_id=? AND paid_amount < total-0.005", (inst["loan_id"],)).fetchone()["c"] == 0
    if all_paid:
        con.execute("UPDATE loans SET status='paid' WHERE id=?", (inst["loan_id"],))
    con.commit()
    con.close()
    return {"ok": True}

@app.get("/api/ledger")
def ledger():
    con = get_db()
    rows = con.execute("SELECT * FROM ledger ORDER BY ts DESC LIMIT 200").fetchall()
    con.close()
    return {"ledger": [dict(r) for r in rows]}

@app.get("/api/reports")
def reports():
    con = get_db()
    loans = con.execute("SELECT l.*, c.name AS company_name FROM loans l JOIN companies c ON c.id=l.company_id").fetchall()
    total_lent = sum(l["amount"] for l in loans if l["status"] != "requested")
    outstanding = sum(loan_outstanding(con, l["id"], l["amount"]) for l in loans if l["status"] not in ("requested", "paid"))
    interest_paid = con.execute("SELECT COALESCE(SUM(i.paid_amount),0) FROM installments i").fetchone()[0]
    interest_earned = r2(sum(
        sum(r2(i["paid_amount"] - i["principal"] * min(i["paid_amount"], i["total"]) / i["total"]) for i in con.execute("SELECT * FROM installments WHERE loan_id=?", (l["id"],)).fetchall()) for l in loans))
    trade_stats = con.execute("SELECT COALESCE(SUM(pnl),0) pnl, COUNT(*) n FROM trades").fetchone()
    fees = con.execute("SELECT COALESCE(SUM(fee),0) FROM trades").fetchone()[0]
    per_symbol = con.execute("SELECT symbol, SUM(qty*price) volume, SUM(pnl) pnl, COUNT(*) trades FROM trades GROUP BY symbol ORDER BY volume DESC").fetchall()
    con.close()
    return {"totalLent": r2(total_lent), "outstanding": r2(outstanding), "interestEarned": interest_earned,
            "tradePnl": r2(trade_stats["pnl"]), "tradeCount": trade_stats["n"], "feesCollected": r2(fees),
            "perSymbol": [dict(r) for r in per_symbol]}

@app.post("/api/reset")
def reset():
    con = get_db()
    con.executescript("DROP TABLE IF EXISTS companies; DROP TABLE IF EXISTS loans; DROP TABLE IF EXISTS installments; DROP TABLE IF EXISTS payments; DROP TABLE IF EXISTS accounts; DROP TABLE IF EXISTS positions; DROP TABLE IF EXISTS trades; DROP TABLE IF EXISTS ledger; DROP TABLE IF EXISTS snapshots;")
    con.commit()
    con.close()
    seed()
    return {"ok": True}

app.mount("/", StaticFiles(directory=os.path.join(BASE, "static"), html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
