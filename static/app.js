"use strict";
/* ================= Utilidades ================= */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = v => "US$ " + Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = v => Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = v => Number(v).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";
const fmtDate = s => { if (!s) return "—"; const [y, m, d] = String(s).slice(0, 10).split("-"); return d + "/" + m + "/" + y; };
const nowISO = () => new Date().toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "medium" });
const signed = v => (v > 0 ? "+" : "") + num(v);
const signedPct = v => (v > 0 ? "+" : "") + pct(v);
const deltaCls = v => (v >= 0 ? "up" : "down");
const kindCls = s => (s === "buy" ? "up" : "down");

function toast(msg, type = "ok") {
  const r = $("#toast-root");
  const el = document.createElement("div");
  el.className = "toast toast-" + type;
  el.textContent = msg;
  r.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

async function api(path, opts) {
  const res = await fetch(path, Object.assign({ headers: { "Content-Type": "application/json" } }, opts));
  if (!res.ok) {
    let msg = "Error del servidor";
    try { msg = (await res.json()).detail || msg; } catch (e) { /* noop */ }
    throw new Error(msg);
  }
  return res.status === 204 ? null : res.json();
}

function openModal(html) {
  const d = document.createElement("dialog");
  d.className = "modal";
  d.innerHTML = html;
  document.body.appendChild(d);
  d.showModal();
  d.addEventListener("click", e => { if (e.target === d) d.close(); });
  return d;
}

function badge(s) {
  const labels = { active: "Activo", paid: "Pagado", late: "Vencido", pending: "Pendiente", requested: "Solicitado" };
  return `<span class="badge badge-${s}">${labels[s] || s}</span>`;
}

function sparkSVG(values, w = 92, h = 26) {
  if (!values || values.length < 2) return "";
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => (i / (values.length - 1) * (w - 2) + 1) + "," + (h - 2 - (v - min) / span * (h - 4))).join(" ");
  const up = values[values.length - 1] >= values[0];
  return `<svg class="spark" width="${w}" height="${h}"><polyline class="spark-${up ? "up" : "down"}" points="${pts}" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

const LEDGER_LABEL = {
  trade_buy: "Compra de acciones", trade_sell: "Venta de acciones",
  savings_deposit: "Guardado en el colchón", savings_withdraw: "Retiro del colchón",
  savings_interest: "Interés del colchón", loan_disbursement: "Desembolso de préstamo",
  loan_payment: "Pago de cuota", loan_reversal: "Reversión de préstamo",
};
const ledLabel = t => LEDGER_LABEL[t] || t;

/* ================= Estado global ================= */
const state = {
  view: "dashboard",
  invest: { symbol: "MSFT", range: "6M", price: null, prevClose: null, change: null, chart: null, volume: null },
  loanFilter: "all",
};

const PAGES = {
  dashboard: "Panel", invest: "Inversiones", loans: "Préstamos",
  companies: "Empresas", savings: "Colchón", reports: "Reportes",
};

/* ================= Topbar ================= */
async function refreshTop() {
  try {
    const ov = await api("/api/overview");
    $("#pill-cash").textContent = money(ov.cash);
    $("#pill-savings").textContent = money(ov.savings);
    $("#pill-invest").textContent = money(ov.investments.value);
    const total = ov.total, inv = ov.investments;
    $("#net-worth").innerHTML = `Patrimonio total <b>${money(total)}</b>
      <span class="delta ${deltaCls(inv.pnl)}">(${signedPct(inv.pnlPct)} · ${signed(num(inv.pnl))})</span>`;
    $("#net-worth").title = "Efectivo + Colchón + Inversiones";
    return ov;
  } catch (e) {
    toast(e.message, "err");
    return null;
  }
}

/* ================= Router ================= */
const ROUTES = {
  dashboard: renderDashboard, invest: renderInvest, loans: renderLoans,
  companies: renderCompanies, savings: renderSavings, reports: renderReports,
};

function navigate() {
  let hash = location.hash.replace(/^#\//, "") || "dashboard";
  const clean = hash.split("?")[0];
  if (!ROUTES[clean]) { location.hash = "#/dashboard"; return; }
  state.view = clean;
  document.querySelectorAll(".nav-item").forEach(a =>
    a.classList.toggle("active", a.dataset.nav === clean));
  $("#page-title").textContent = PAGES[clean];
  const view = $("#view");
  view.innerHTML = `<div class="loading"><div class="spinner"></div><span>Cargando...</span></div>`;
  refreshTop().then(() => ROUTES[clean](view));
}

window.addEventListener("hashchange", navigate);

/* ================= Panel ================= */
async function renderDashboard(view) {
  const ov = await refreshTop();
  if (!ov) { view.innerHTML = `<div class="empty"><h2>Servidor no disponible</h2><p>Ejecuta <b>python -m uvicorn app:app</b> en la carpeta del proyecto.</p></div>`; return; }
  const wl = await api("/api/watchlist").catch(() => ({ symbols: [] }));
  const eq = await api("/api/equity").catch(() => ({ points: [] }));

  view.innerHTML = `
    <div class="grid-cards">
      <div class="card stat accent-up"><div class="stat-label">Efectivo disponible</div><div class="stat-value">${money(ov.cash)}</div>
        <div class="stat-foot">Para operar y desembolsar</div></div>
      <div class="card stat accent-amber"><div class="stat-label">Colchón (ahorro)</div><div class="stat-value">${money(ov.savings)}</div>
        <div class="stat-foot">Rinde ${pct(ov.savingsRate)} anual</div></div>
      <div class="card stat accent-blue"><div class="stat-label">Inversiones</div><div class="stat-value">${money(ov.investments.value)}</div>
        <div class="stat-foot ${deltaCls(ov.investments.pnl)}">${signedPct(ov.investments.pnlPct)} · ${signed(num(ov.investments.pnl))}</div></div>
      <div class="card stat accent-green"><div class="stat-label">Patrimonio total</div><div class="stat-value">${money(ov.total)}</div>
        <div class="stat-foot">${nowISO()}</div></div>
    </div>

    <div class="grid-3">
      <div class="card">
        <div class="card-head"><h2>Evolución del patrimonio</h2><span class="dim" style="font-size:12px">${
          eq.points.length ? "desde el " + fmtDate(eq.points[0].day) : ""}</span></div>
        <div id="equity-chart" style="height:300px;width:100%"></div>
      </div>
      <div class="card">
        <div class="card-head"><h2>Mercado</h2><a class="link" href="#/invest">Operar →</a></div>
        <div class="table-wrap"><table class="table" style="min-width:0">
          <tbody>${wl.symbols.slice(0, 6).map(s => `
            <tr style="cursor:pointer" onclick="location.hash='#/invest';state.invest.symbol='${s.symbol}';state.invest.range='6M'">
              <td><b style="font-size:13px">${esc(s.symbol)}</b><br/><span class="dim" style="font-size:11px">${esc(s.name)}</span></td>
              <td class="mono">${num(s.price)}</td>
              <td class="mono ${deltaCls(s.changePct)}">${signedPct(s.changePct)}</td>
              <td>${sparkSVG(s.spark)}</td>
            </tr>`).join("")}</tbody>
        </table></div>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h2>Últimos movimientos</h2><a class="link" href="#/reports">Ver más</a></div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Fecha</th><th>Concepto</th><th>Símbolo</th><th style="text-align:right">Monto</th></tr></thead>
        <tbody>${ov.ledger.map(m => `
          <tr><td>${fmtDate(m.ts)} ${m.ts.slice(11, 16)}</td><td>${esc(ledLabel(m.type))}${m.detail ? `<br/><span class="dim" style="font-size:11px">${esc(m.detail)}</span>` : ""}</td>
          <td class="mono dim">${esc(m.symbol || "—")}</td>
          <td class="mono" style="text-align:right;${m.amount >= 0 ? "color:var(--up);font-weight:700" : "color:var(--down);font-weight:700"}">${signed(num(m.amount))}</td></tr>`).join("") || `<tr><td colspan="4" class="td-empty">Sin movimientos todavía</td></tr>`}
        </tbody></table></div>
    </div>`;

  if (eq.points.length >= 2 && window.LightweightCharts) {
    const chart = LightweightCharts.createChart($("#equity-chart"), {
      layout: { background: { type: "solid", color: "transparent" }, textColor: "#8b96ad" },
      grid: { vertLines: { color: "rgba(255,255,255,.04)" }, horzLines: { color: "rgba(255,255,255,.04)" } },
      rightPriceScale: { borderColor: "rgba(255,255,255,.08)" },
      timeScale: { borderColor: "rgba(255,255,255,.08)" },
      width: $("#equity-chart").clientWidth, height: 300,
    });
    chart.addLineSeries({ color: "#26a69a", lineWidth: 2, priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: true })
      .setData(eq.points.map(p => ({ time: Math.floor(new Date(p.day).getTime() / 1000), value: p.value })));
  }
}

/* ================= Operaciones (compra/venta) ================= */
async function placeTrade(side) {
  const qty = parseFloat($("#trade-qty").value);
  if (!qty || qty <= 0) { toast("Ingresa una cantidad válida", "err"); return; }
  try {
    const r = await api("/api/trade", { method: "POST", body: JSON.stringify({ symbol: state.invest.symbol, side, qty }) });
    toast(side === "buy"
      ? `Compraste ${qty} ${state.invest.symbol} a ${money(r.price)}`
      : `Vendiste ${qty} ${state.invest.symbol} a ${money(r.price)} (${signed(num(r.pnl))})`, "ok");
    await refreshTop();
    renderInvest($("#view"));
  } catch (e) { toast(e.message, "err"); }
}

async function resetApp() {
  if (!confirm("¿Borrar TODOS los datos y volver a la cuenta de $10,000?")) return;
  try {
    await api("/api/reset", { method: "POST" });
    toast("Datos reiniciados");
    navigate();
  } catch (e) { toast(e.message, "err"); }
}

/* ================= Inversiones ================= */
const WATCH = ["MSFT", "AAPL", "GOOGL", "AMZN", "NVDA", "TSLA", "META", "NFLX"];
const RANGES = ["1D", "5D", "1M", "6M", "1Y", "5Y"];

async function renderInvest(view) {
  view.innerHTML = `
    <div class="invest-layout">
      <div class="card">
        <div class="chart-head">
          <div class="symbol-chips">
            ${WATCH.map(s => `<button class="chip ${s === state.invest.symbol ? "active" : ""}" onclick="setSymbol('${s}')">${s}</button>`).join("")}
            <input id="custom-symbol" class="input" placeholder="Otro: IBM..." style="width:110px;padding:7px 10px;font-family:var(--mono);font-size:12px" />
            <button class="btn btn-sm btn-ghost" onclick="goCustom()">Ir</button>
          </div>
          <div class="range-btns">
            ${RANGES.map(r => `<button class="range-btn ${r === state.invest.range ? "active" : ""}" onclick="setRange('${r}')">${r}</button>`).join("")}
          </div>
        </div>
        <div class="ohlc-row">
          <span class="price-big" id="c-price">—</span>
          <span id="c-change" class="mono" style="font-weight:700">—</span>
          <div class="ohlc-stats">
            <div>Apertura<b id="c-open">—</b></div>
            <div>Máximo<b id="c-high">—</b></div>
            <div>Mínimo<b id="c-low">—</b></div>
            <div>Volumen<b id="c-vol">—</b></div>
          </div>
        </div>
        <div id="candle-chart"></div>
        <div class="chart-note"><span id="c-src">Cargando datos de ${esc(state.invest.symbol)}...</span><span class="dim">Velas diarias · datos reales de mercado (Yahoo Finance)</span></div>
      </div>

      <div class="card">
        <div class="card-head"><h2>Operar</h2><span class="dim" style="font-size:12px">${esc(state.invest.symbol)}</span></div>
        <div class="trade-section">
          <div class="seg">
            <button id="seg-buy" class="on-buy" onclick="setSide('buy')">COMPRAR</button>
            <button id="seg-sell" onclick="setSide('sell')">VENDER</button>
          </div>
          <label class="form" style="gap:6px">
            <span style="font-size:12px;color:var(--dim);font-weight:600">Cantidad (acciones)</span>
            <div class="qty-row">
              <input id="trade-qty" class="input" type="number" min="0.0001" step="0.0001" value="10" inputmode="decimal" />
              <button class="qty-preset" onclick="setQty(1)">1</button>
              <button class="qty-preset" onclick="setQty(10)">10</button>
              <button class="qty-preset" onclick="setQty(50)">50</button>
            </div>
          </label>
          <div class="preview">
            <div class="preview-row"><span>Precio estimado</span><strong id="t-price">—</strong></div>
            <div class="preview-row"><span>Comisión (0.1%, mín. $0.99)</span><strong id="t-fee">—</strong></div>
            <div class="preview-row"><span id="t-total-label">Costo total</span><strong id="t-total">—</strong></div>
          </div>
          <button id="trade-btn" class="btn-buy" onclick="placeTrade('buy')">Comprar ${esc(state.invest.symbol)}</button>
          <p class="dim" style="font-size:12px">💡 Compra acciones de Microsoft, Google, Amazon, Apple, NVIDIA... con dinero real de mercado y sigue día a día cómo suben o bajan en la gráfica.</p>
        </div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-head"><h2>Mis posiciones</h2><span class="dim" style="font-size:12px" id="pos-summary"></span></div>
        <div class="table-wrap"><table class="table"><thead>
          <tr><th>Activo</th><th>Cant.</th><th>Costo prom.</th><th>Precio</th><th>Valor</th><th>P&L</th><th></th></tr>
        </thead><tbody id="positions-body"><tr><td colspan="7" class="td-empty">Cargando...</td></tr></tbody></table></div>
      </div>
      <div class="card">
        <div class="card-head"><h2>Historial de operaciones</h2></div>
        <div class="table-wrap"><table class="table"><thead>
          <tr><th>Fecha</th><th>Tipo</th><th>Símbolo</th><th>Cant.</th><th>Precio</th><th style="text-align:right">P&L</th></tr>
        </thead><tbody id="trades-body"><tr><td colspan="6" class="td-empty">Cargando...</td></tr></tbody></table></div>
      </div>
    </div>`;

  await loadCandles(true);
  await loadPositions();
  await loadTradeHistory();
  const wl = await api("/api/watchlist").catch(() => ({ symbols: [] }));
  const q = wl.symbols.find(s => s.symbol === state.invest.symbol);
  if (q) {
    state.invest.price = q.price;
    state.invest.prevClose = q.prevClose;
    updateTradePreview();
  }
}

let tradeSide = "buy";
function setSide(s) {
  tradeSide = s;
  $("#seg-buy").classList.toggle("on-buy", s === "buy");
  $("#seg-sell").classList.toggle("on-sell", s === "sell");
  const btn = $("#trade-btn");
  btn.className = s === "buy" ? "btn-buy" : "btn-sell";
  btn.textContent = (s === "buy" ? "Comprar " : "Vender ") + state.invest.symbol;
  $("#t-total-label").textContent = s === "buy" ? "Costo total" : "Ingreso neto";
  updateTradePreview();
}

function setQty(q) { $("#trade-qty").value = q; updateTradePreview(); }

function updateTradePreview() {
  const qty = parseFloat($("#trade-qty")?.value) || 0;
  const p = state.invest.price;
  if (!p || !$("#t-price")) return;
  const gross = p * qty;
  const fee = Math.max(gross * 0.001, 0.99);
  $("#t-price").textContent = money(p);
  $("#t-fee").textContent = money(fee);
  $("#t-total").textContent = money(tradeSide === "buy" ? gross + fee : Math.max(gross - fee, 0));
}

function setSymbol(s) {
  state.invest.symbol = s;
  document.querySelectorAll(".chip").forEach(c => c.classList.toggle("active", c.textContent === s));
  $("#custom-symbol").value = "";
  loadCandles(false);
}

function goCustom() {
  const v = $("#custom-symbol").value.trim().toUpperCase();
  if (!v) return;
  state.invest.symbol = v;
  document.querySelectorAll(".chip").forEach(c => c.classList.toggle("active", c.textContent === v));
  loadCandles(false);
}

function setRange(r) {
  state.invest.range = r;
  document.querySelectorAll(".range-btn").forEach(b => b.classList.toggle("active", b.textContent === r));
  loadCandles(false);
}

async function loadCandles(initial) {
  const { symbol, range } = state.invest;
  const src = $("#c-src");
  if (src) src.textContent = `Cargando ${symbol}...`;
  try {
    const data = await api(`/api/candles/${encodeURIComponent(symbol)}?range=${range}`);
    const c = data.candles;
    if (!c.length) { if (src) src.textContent = "Sin datos para " + symbol; return; }
    const last = c[c.length - 1], prev = c[c.length - 2] || last;
    state.invest.price = last.close;
    state.invest.prevClose = prev.close;
    const chg = last.close - prev.close, chgPct = chg / prev.close * 100;
    $("#c-price").textContent = num(last.close);
    $("#c-price").style.color = chg >= 0 ? "var(--up)" : "var(--down)";
    $("#c-change").textContent = signedPct(chgPct) + " (" + signed(num(chg)) + ")";
    $("#c-change").className = "mono " + deltaCls(chg);
    $("#c-open").textContent = num(c[0].open);
    $("#c-high").textContent = num(Math.max(...c.map(x => x.high)));
    $("#c-low").textContent = num(Math.min(...c.map(x => x.low)));
    $("#c-vol").textContent = (c[c.length - 1].volume || 0) >= 1000
      ? (c[c.length - 1].volume / 1e6).toFixed(1) + "M" : Math.round(c[c.length - 1].volume || 0).toLocaleString();
    if (src) src.textContent = `${symbol} · ${range} · ${c.length} velas`;

    const el = $("#candle-chart");
    if (!window.LightweightCharts) { if (src) src.textContent = "Gráficas no disponibles (sin internet)"; return; }
    if (initial || !state.invest.chart || el.childElementCount === 0) {
      if (state.invest.chart) { state.invest.chart.remove(); state.invest.chart = null; }
      const chart = LightweightCharts.createChart(el, {
        layout: { background: { type: "solid", color: "transparent" }, textColor: "#8b96ad" },
        grid: { vertLines: { color: "rgba(255,255,255,.04)" }, horzLines: { color: "rgba(255,255,255,.04)" } },
        rightPriceScale: { borderColor: "rgba(255,255,255,.08)" },
        timeScale: { borderColor: "rgba(255,255,255,.08)", timeVisible: true, secondsVisible: false },
        crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
        width: el.clientWidth, height: 430,
      });
      state.invest.chart = chart;
      state.invest.volume = chart.addHistogramSeries({ priceFormat: { type: "volume" }, priceScaleId: "vol" });
      state.invest.volume.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      state.invest.series = chart.addCandlestickSeries({
        upColor: "#26a69a", downColor: "#ef5350", borderVisible: false,
        wickUpColor: "#26a69a", wickDownColor: "#ef5350",
      });
      window.addEventListener("resize", () => {
        if (state.invest.chart && $("#candle-chart")) {
          state.invest.chart.applyOptions({ width: $("#candle-chart").clientWidth });
        }
      });
    }
    state.invest.series.setData(c.map(x => ({ time: x.time, open: x.open, high: x.high, low: x.low, close: x.close })));
    state.invest.volume.setData(c.map(x => ({ time: x.time, value: x.volume, color: x.close >= x.open ? "rgba(38,166,154,.4)" : "rgba(239,83,80,.4)" })));
    state.invest.chart.timeScale().fitContent();
    updateTradePreview();
    if (!tradeSide) tradeSide = "buy";
    setSide(tradeSide);
  } catch (e) {
    if (src) src.textContent = `Error: ${e.message}`;
  }
}

async function loadPositions() {
  try {
    const { positions } = await api("/api/positions");
    const body = $("#positions-body");
    if (!body) return;
    body.innerHTML = positions.length ? positions.map(p => `
      <tr>
        <td><b>${esc(p.symbol)}</b><br/><span class="dim" style="font-size:11px">${esc(p.name)}</span></td>
        <td class="mono">${num(p.qty)}</td>
        <td class="mono">${num(p.avgCost)}</td>
        <td class="mono">${num(p.price)}</td>
        <td class="mono">${num(p.marketValue)}</td>
        <td class="mono ${deltaCls(p.pnl)}">${signed(num(p.pnl))}<br/><span style="font-size:11px">${signedPct(p.pnlPct)}</span></td>
        <td><button class="btn btn-sm btn-danger btn-icon" onclick="sellAll('${p.symbol}')">Vender</button></td>
      </tr>`).join("") : `<tr><td colspan="7" class="td-empty">Aún no tienes acciones. ¡Compra tu primera acción arriba!</td></tr>`;
    const totalPnl = positions.reduce((a, p) => a + p.pnl, 0);
    const totalValue = positions.reduce((a, p) => a + p.marketValue, 0);
    $("#pos-summary").innerHTML = `${positions.length} posición(es) · <b class="${deltaCls(totalPnl)}">${signed(num(totalPnl))}</b> · ${num(totalValue)}`;
  } catch (e) { toast(e.message, "err"); }
}

async function sellAll(symbol) {
  try {
    const { positions } = await api("/api/positions");
    const pos = positions.find(p => p.symbol === symbol);
    if (!pos) return;
    await api("/api/trade", { method: "POST", body: JSON.stringify({ symbol, side: "sell", qty: pos.qty }) });
    toast("Posición de " + symbol + " cerrada");
    await refreshTop();
    renderInvest($("#view"));
  } catch (e) { toast(e.message, "err"); }
}

async function loadTradeHistory() {
  try {
    const { trades } = await api("/api/trades");
    const body = $("#trades-body");
    if (!body) return;
    body.innerHTML = trades.length ? trades.map(t => `
      <tr>
        <td>${fmtDate(t.executed_at)} ${t.executed_at.slice(11, 16)}</td>
        <td><span class="badge ${t.side === "buy" ? "badge-active" : "badge-late"}">${t.side === "buy" ? "Compra" : "Venta"}</span></td>
        <td class="mono">${esc(t.symbol)}</td>
        <td class="mono">${num(t.qty)}</td>
        <td class="mono">${num(t.price)}</td>
        <td class="mono ${deltaCls(t.pnl)}" style="text-align:right">${t.side === "sell" ? signed(num(t.pnl)) : "—"}</td>
      </tr>`).join("") : `<tr><td colspan="6" class="td-empty">Sin operaciones todavía</td></tr>`;
  } catch (e) { toast(e.message, "err"); }
}

/* ================= Préstamos ================= */
async function renderLoans(view) {
  let loans = [];
  try { loans = (await api("/api/loans")).loans; } catch (e) { toast(e.message, "err"); }
  const active = loans.filter(l => l.status === "active" || l.status === "late");
  const requested = loans.filter(l => l.status === "requested");
  const outstanding = active.reduce((a, l) => a + l.outstanding, 0);
  view.innerHTML = `
    <div class="grid-cards">
      <div class="card stat accent-blue"><div class="stat-label">Préstamos activos</div><div class="stat-value">${active.length}</div>
        <div class="stat-foot">${requested.length} solicitud(es) pendiente(s)</div></div>
      <div class="card stat accent-down"><div class="stat-label">Capital pendiente</div><div class="stat-value">${money(outstanding)}</div>
        <div class="stat-foot">Por cobrar a las empresas</div></div>
      <div class="card stat accent-amber"><div class="stat-label">Solicitado</div><div class="stat-value">${requested.length}</div>
        <div class="stat-foot">${money(requested.reduce((a, l) => a + l.amount, 0))} por desembolsar</div></div>
      <div class="card stat accent-green"><div class="stat-label">Acción rápida</div><div style="margin-top:12px"><button class="btn btn-primary" onclick="newLoanModal()">+ Nuevo préstamo</button></div></div>
    </div>
    <div class="card">
      <div class="card-head">
        <h2>Préstamos a empresas</h2>
        <div class="range-btns">
          ${["all", "active", "requested", "paid", "late"].map(f => `
            <button class="range-btn ${state.loanFilter === f ? "active" : ""}" onclick="state.loanFilter='${f}';renderLoans($('#view'))">${({ all: "Todos", active: "Activos", requested: "Solicitados", paid: "Pagados", late: "Vencidos" })[f]}</button>`).join("")}
        </div>
      </div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Empresa</th><th>Monto</th><th>Tasa</th><th>Plazo</th><th>Inicio</th><th>Pendiente</th><th>Estado</th><th></th></tr></thead>
        <tbody>
        ${loans.filter(l => state.loanFilter === "all" || l.status === state.loanFilter).map(l => `
          <tr class="${l.status === "late" ? "row-late" : ""}">
            <td><b>${esc(l.companyName)}</b></td>
            <td class="mono">${money(l.amount)}</td>
            <td class="mono">${pct(l.rate)}</td>
            <td class="mono">${l.term} meses</td>
            <td class="mono dim">${fmtDate(l.startDate)}</td>
            <td class="mono">${money(l.outstanding)}</td>
            <td>${badge(l.status)}</td>
            <td>
              <button class="btn btn-sm btn-ghost btn-icon" onclick="loanDetailModal('${l.id}')">Ver</button>
              ${l.status === "requested" ? `<button class="btn btn-sm btn-blue btn-icon" onclick="disburseLoan('${l.id}')">Desembolsar</button>
                <button class="btn btn-sm btn-danger btn-icon" onclick="deleteLoan('${l.id}')">Eliminar</button>` : ""}
            </td>
          </tr>`).join("") || `<tr><td colspan="8" class="td-empty">${loans.length ? "Ningún préstamo en este filtro" : "Aún no hay préstamos. Crea uno para prestar a una empresa y cobrar cuotas."}</td></tr>`}
        </tbody>
      </table></div>
    </div>`;
}

async function newLoanModal() {
  const { companies } = await api("/api/companies");
  if (!companies.length) { toast("Primero crea una empresa", "err"); return; }
  const d = openModal(`
    <div class="modal-body">
      <h3>Nuevo préstamo</h3>
      <label>Empresa
        <select id="nl-company">${companies.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select></label>
      <div class="form-row">
        <label>Monto (USD)<input id="nl-amount" type="number" min="100" step="100" value="10000" /></label>
        <label>Tasa anual %<input id="nl-rate" type="number" min="0.1" step="0.1" value="12" /></label>
      </div>
      <label>Plazo (meses)<input id="nl-term" type="number" min="1" max="120" value="12" /></label>
      <p class="dim" style="font-size:12.5px">La solicitud queda <b>pendiente de desembolso</b>: al desembolsar se resta del efectivo, se crea el cronograma y la empresa recibe el dinero.</p>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="this.closest('dialog').close()">Cancelar</button>
        <button class="btn btn-primary" onclick="submitLoan()">Crear solicitud</button>
      </div>
    </div>`);
  d.addEventListener("close", () => d.remove());
}

async function submitLoan() {
  try {
    await api("/api/loans", {
      method: "POST", body: JSON.stringify({
        company_id: $("#nl-company").value,
        amount: parseFloat($("#nl-amount").value),
        annual_rate: parseFloat($("#nl-rate").value) / 100,
        term_months: parseInt($("#nl-term").value),
      }),
    });
    document.querySelector("dialog").close();
    toast("Solicitud de préstamo creada");
    renderLoans($("#view"));
  } catch (e) { toast(e.message, "err"); }
}

async function disburseLoan(id) {
  if (!confirm("¿Desembolsar el préstamo? Se descontará del efectivo y se generará el cronograma de cuotas.")) return;
  try {
    await api(`/api/loans/${id}/disburse`, { method: "POST" });
    toast("Préstamo desembolsado");
    refreshTop(); renderLoans($("#view"));
  } catch (e) { toast(e.message, "err"); }
}

async function deleteLoan(id) {
  if (!confirm("¿Eliminar este préstamo? Si ya fue desembolsado, el capital pendiente vuelve a tu efectivo.")) return;
  try {
    await api(`/api/loans/${id}/delete`, { method: "POST" });
    toast("Préstamo eliminado");
    refreshTop(); renderLoans($("#view"));
  } catch (e) { toast(e.message, "err"); }
}

async function loanDetailModal(id) {
  let l;
  try { l = await api(`/api/loans/${id}`); } catch (e) { toast(e.message, "err"); return; }
  const paidCount = l.installments.filter(i => i.status === "paid").length;
  const d = openModal(`
    <div class="modal-body">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <h3>${esc(l.companyName)}</h3>${badge(l.status)}
      </div>
      <div class="preview">
        <div class="preview-row"><span>Monto</span><strong>${money(l.amount)}</strong></div>
        <div class="preview-row"><span>Tasa anual</span><strong>${pct(l.rate)}</strong></div>
        <div class="preview-row"><span>Plazo</span><strong>${l.term} meses</strong></div>
        <div class="preview-row"><span>Capital pendiente</span><strong>${money(l.outstanding)}</strong></div>
        <div class="preview-row"><span>Cuotas pagadas</span><strong>${paidCount} / ${l.installments.length}</strong></div>
      </div>
      <div class="table-wrap" style="max-height:340px;overflow-y:auto"><table class="table" style="min-width:0">
        <thead><tr><th>#</th><th>Vence</th><th>Capital</th><th>Interés</th><th>Cuota</th><th>Pagado</th><th>Estado</th><th></th></tr></thead>
        <tbody>${l.installments.map(i => `
          <tr class="${i.status === "late" ? "row-late" : ""}">
            <td class="mono">${i.number}</td>
            <td class="mono">${fmtDate(i.dueDate)}</td>
            <td class="mono">${num(i.principal)}</td>
            <td class="mono">${num(i.interest)}</td>
            <td class="mono"><b>${num(i.total)}</b></td>
            <td class="mono">${num(i.paidAmount)}</td>
            <td>${badge(i.status)}</td>
            <td>${i.status !== "paid" ? `<button class="btn btn-sm btn-primary btn-icon" onclick="payModal('${i.id}', ${i.number}, ${i.pending})">Pagar</button>` : ""}</td>
          </tr>`).join("")}</tbody>
      </table></div>
    </div>`);
  d.addEventListener("close", () => d.remove());
}

function payModal(installmentId, number, pending) {
  const d = openModal(`
    <div class="modal-body">
      <h3>Registrar pago · Cuota #${number}</h3>
      <label>Monto pendiente <input id="pm-amount" type="number" min="0.01" step="0.01" value="${pending}" /></label>
      <label>Método
        <select id="pm-method">
          <option value="bank_transfer">Transferencia bancaria</option>
          <option value="cash">Efectivo</option>
          <option value="yape">Yape / Plin</option>
        </select></label>
      <label>Referencia<input id="pm-ref" placeholder="Opcional" /></label>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="this.closest('dialog').close()">Cancelar</button>
        <button class="btn btn-primary" onclick="submitPayment('${installmentId}', '${number}')">Registrar pago</button>
      </div>
    </div>`);
  d.addEventListener("close", () => d.remove());
}

async function submitPayment(installmentId, number) {
  const pending = parseFloat($("#pm-amount").value);
  if (!pending || pending <= 0) { toast("Monto inválido", "err"); return; }
  try {
    await api("/api/payments", {
      method: "POST", body: JSON.stringify({
        installment_id: installmentId, amount: pending,
        method: $("#pm-method").value, reference: $("#pm-ref").value,
      }),
    });
    document.querySelector("dialog").close();
    toast(`Pago de cuota #${number} registrado`);
    refreshTop(); renderLoans($("#view"));
  } catch (e) { toast(e.message, "err"); }
}

/* ================= Empresas ================= */
async function renderCompanies(view) {
  let companies = [];
  try { companies = (await api("/api/companies")).companies; } catch (e) { toast(e.message, "err"); }
  const totalBalance = companies.reduce((a, c) => a + c.balance, 0);
  view.innerHTML = `
    <div class="grid-cards">
      <div class="card stat accent-blue"><div class="stat-label">Empresas</div><div class="stat-value">${companies.length}</div></div>
      <div class="card stat accent-green"><div class="stat-label">Dinero prestado a empresas</div><div class="stat-value">${money(totalBalance)}</div></div>
      <div class="card stat accent-amber"><div class="stat-label">Acción rápida</div><div style="margin-top:12px"><button class="btn btn-primary" onclick="newCompanyModal()">+ Nueva empresa</button></div></div>
    </div>
    <div class="card">
      <div class="card-head"><h2>Empresas clientes</h2></div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Empresa</th><th>RUC</th><th>Contacto</th><th>Préstamos</th><th>Saldo por cobrar</th></tr></thead>
        <tbody>${companies.map(c => `
          <tr>
            <td><b>${esc(c.name)}</b></td>
            <td class="mono dim">${esc(c.ruc) || "—"}</td>
            <td class="dim">${esc(c.contact_email) || "—"}</td>
            <td class="mono">${c.active_loans} activo(s) · ${c.loan_count} total</td>
            <td class="mono" style="font-weight:700">${money(c.balance)}</td>
          </tr>`).join("") || `<tr><td colspan="5" class="td-empty">Sin empresas. Crea la primera.</td></tr>`}
        </tbody>
      </table></div>
    </div>`;
}

function newCompanyModal() {
  const d = openModal(`
    <div class="modal-body">
      <h3>Nueva empresa</h3>
      <label>Nombre *<input id="cm-name" placeholder="Ej: Distribuidora Los Andes SAC" /></label>
      <label>RUC<input id="cm-ruc" placeholder="Opcional" maxlength="11" /></label>
      <div class="form-row">
        <label>Correo<input id="cm-email" placeholder="Opcional" /></label>
        <label>Teléfono<input id="cm-phone" placeholder="Opcional" /></label>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="this.closest('dialog').close()">Cancelar</button>
        <button class="btn btn-primary" onclick="submitCompany()">Guardar</button>
      </div>
    </div>`);
  d.addEventListener("close", () => d.remove());
}

async function submitCompany() {
  const name = $("#cm-name").value.trim();
  if (!name) { toast("El nombre es obligatorio", "err"); return; }
  try {
    await api("/api/companies", {
      method: "POST", body: JSON.stringify({
        name, ruc: $("#cm-ruc").value.trim(), contact_email: $("#cm-email").value.trim(),
        contact_phone: $("#cm-phone").value.trim(),
      }),
    });
    document.querySelector("dialog").close();
    toast("Empresa creada");
    renderCompanies($("#view"));
  } catch (e) { toast(e.message, "err"); }
}

/* ================= Colchón ================= */
async function renderSavings(view) {
  const ov = await refreshTop();
  if (!ov) return;
  const { ledger } = await api("/api/ledger");
  const moves = ledger.filter(m => m.type.startsWith("savings"));
  view.innerHTML = `
    <div class="grid-2">
      <div class="card">
        <div class="card-head"><h2>Colchón · ahorro</h2><span class="badge badge-active">Rinde ${pct(ov.savingsRate)} anual</span></div>
        <div style="font-size:12px;color:var(--dim);margin-bottom:6px">Tu dinero guardado crece solo cada día con interés compuesto.</div>
        <div class="stat-value" style="font-size:38px;color:var(--up)">${money(ov.savings)}</div>
        <div class="dim" style="font-size:13px;margin:4px 0 18px">Se calcula ${pct(ov.savingsRate)} / 365 ≈ ${pct(ov.savingsRate / 365)} diario sobre lo guardado.</div>
        <div class="form" style="max-width:340px">
          <div class="seg">
            <button id="sv-dep" class="on-buy" onclick="svSide('deposit')">GUARDAR</button>
            <button id="sv-wd" onclick="svSide('withdraw')">RETIRAR</button>
          </div>
          <label style="display:flex;flex-direction:column;gap:6px;font-size:12px;color:var(--dim);font-weight:600">Monto (USD)
            <input id="sv-amount" type="number" min="1" step="1" value="100" class="input" /></label>
          <div style="display:flex;gap:8px">
            ${[50, 100, 500, 1000].map(v => `<button class="qty-preset" onclick="$('#sv-amount').value=${v}">$${v}</button>`).join("")}
          </div>
          <button id="sv-btn" class="btn-buy" onclick="savingsMove()">Guardar en el colchón</button>
          <p class="dim" style="font-size:12px">Efectivo disponible: <b class="mono">${money(ov.cash)}</b></p>
        </div>
      </div>
      <div class="card">
        <div class="card-head"><h2>Movimientos del colchón</h2></div>
        <div class="table-wrap"><table class="table"><thead>
          <tr><th>Fecha</th><th>Concepto</th><th style="text-align:right">Monto</th></tr>
        </thead><tbody>
          ${moves.map(m => `
            <tr>
              <td>${fmtDate(m.ts)}</td>
              <td>${esc(ledLabel(m.type))}</td>
              <td class="mono" style="text-align:right;font-weight:700">${signed(num(m.amount))}</td>
            </tr>`).join("") || `<tr><td colspan="3" class="td-empty">Guarda tu primer dólar en el colchón 🎯</td></tr>`}
        </tbody></table></div>
      </div>
    </div>`;
}

let svSideState = "deposit";
function svSide(s) {
  svSideState = s;
  $("#sv-dep").classList.toggle("on-buy", s === "deposit");
  $("#sv-wd").classList.toggle("on-sell", s === "withdraw");
  const btn = $("#sv-btn");
  btn.className = s === "deposit" ? "btn-buy" : "btn-sell";
  btn.textContent = s === "deposit" ? "Guardar en el colchón" : "Retirar del colchón";
}

async function savingsMove() {
  const amount = parseFloat($("#sv-amount").value);
  if (!amount || amount <= 0) { toast("Monto inválido", "err"); return; }
  try {
    const r = await api("/api/savings", { method: "POST", body: JSON.stringify({ action: svSideState, amount }) });
    toast(svSideState === "deposit"
      ? `Guardaste ${money(amount)} en el colchón`
      : `Retiraste ${money(amount)} del colchón`);
    renderSavings($("#view"));
  } catch (e) { toast(e.message, "err"); }
}

/* ================= Reportes ================= */
async function renderReports(view) {
  let r = {};
  try { r = await api("/api/reports"); } catch (e) { toast(e.message, "err"); }
  const { ledger } = await api("/api/ledger");
  const tradesLed = ledger.filter(m => m.type.startsWith("trade"));
  view.innerHTML = `
    <div class="grid-cards">
      <div class="card stat accent-blue"><div class="stat-label">Total prestado</div><div class="stat-value">${money(r.totalLent || 0)}</div>
        <div class="stat-foot">${money(r.outstanding || 0)} por cobrar</div></div>
      <div class="card stat accent-green"><div class="stat-label">Interés cobrado</div><div class="stat-value">${money(r.interestEarned || 0)}</div>
        <div class="stat-foot">Por préstamos a empresas</div></div>
      <div class="card stat accent-up"><div class="stat-label">G/P realizado (trading)</div><div class="stat-value ${deltaCls(r.tradePnl || 0)}">${signed(num(r.tradePnl || 0))}</div>
        <div class="stat-foot">${r.tradeCount || 0} operaciones · ${money(r.feesCollected || 0)} en comisiones</div></div>
      <div class="card stat accent-amber"><div class="stat-label">Actividad total</div><div class="stat-value">${ledger.length}</div>
        <div class="stat-foot">${tradesLed.length} operaciones de bolsa</div></div>
    </div>
    <div class="grid-2">
      <div class="card">
        <div class="card-head"><h2>Operaciones por acción</h2></div>
        <div class="table-wrap"><table class="table"><thead>
          <tr><th>Símbolo</th><th>Operaciones</th><th style="text-align:right">Volumen</th><th style="text-align:right">G/P realizado</th></tr>
        </thead><tbody>
          ${(r.perSymbol || []).map(s => `
            <tr>
              <td class="mono"><b>${esc(s.symbol)}</b></td>
              <td class="mono">${s.trades}</td>
              <td class="mono" style="text-align:right">${num(s.volume)}</td>
              <td class="mono ${deltaCls(s.pnl)}" style="text-align:right">${signed(num(s.pnl))}</td>
            </tr>`).join("") || `<tr><td colspan="4" class="td-empty">Aún no operas en bolsa</td></tr>`}
        </tbody></table></div>
      </div>
      <div class="card">
        <div class="card-head"><h2>Movimientos completos</h2></div>
        <div class="table-wrap" style="max-height:340px;overflow-y:auto"><table class="table" style="min-width:0"><thead>
          <tr><th>Fecha</th><th>Concepto</th><th style="text-align:right">Monto</th></tr>
        </thead><tbody>
          ${ledger.map(m => `
            <tr>
              <td>${fmtDate(m.ts)} ${m.ts.slice(11, 16)}</td>
              <td>${esc(ledLabel(m.type))}${m.symbol ? ` <span class="mono dim">(${esc(m.symbol)})</span>` : ""}</td>
              <td class="mono ${deltaCls(m.amount)}" style="text-align:right;font-weight:700">${signed(num(m.amount))}</td>
            </tr>`).join("") || `<tr><td colspan="3" class="td-empty">Sin movimientos</td></tr>`}
        </tbody></table></div>
      </div>
    </div>`;
}

/* ================= Arranque ================= */
setInterval(() => {
  const c = $("#clock");
  if (c) c.textContent = nowISO();
}, 1000);
navigate();

