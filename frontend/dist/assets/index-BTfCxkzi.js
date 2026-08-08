(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const o of document.querySelectorAll('link[rel="modulepreload"]'))s(o);new MutationObserver(o=>{for(const n of o)if(n.type==="childList")for(const r of n.addedNodes)r.tagName==="LINK"&&r.rel==="modulepreload"&&s(r)}).observe(document,{childList:!0,subtree:!0});function a(o){const n={};return o.integrity&&(n.integrity=o.integrity),o.referrerPolicy&&(n.referrerPolicy=o.referrerPolicy),o.crossOrigin==="use-credentials"?n.credentials="include":o.crossOrigin==="anonymous"?n.credentials="omit":n.credentials="same-origin",n}function s(o){if(o.ep)return;o.ep=!0;const n=a(o);fetch(o.href,n)}})();const p="http://localhost:8080",$="http://localhost:8000";async function u(t,e){const a=await fetch(t,{headers:{"Content-Type":"application/json"},...e});if(!a.ok){let s=`Error ${a.status}`;try{s=(await a.json()).error??s}catch{}throw new Error(s)}if(a.status!==204)return await a.json()}function H(t){const e=new URLSearchParams;for(const[s,o]of Object.entries(t))o!==void 0&&o!==""&&e.set(s,o);const a=e.toString();return a?`?${a}`:""}const m={rust:{dashboard:()=>u(`${p}/api/dashboard`),companies:()=>u(`${p}/api/companies`),company:t=>u(`${p}/api/companies/${t}`),createCompany:t=>u(`${p}/api/companies`,{method:"POST",body:JSON.stringify(t)}),updateCompany:(t,e)=>u(`${p}/api/companies/${t}`,{method:"PUT",body:JSON.stringify(e)}),deleteCompany:t=>u(`${p}/api/companies/${t}`,{method:"DELETE"}),loans:t=>u(`${p}/api/loans${H(t??{})}`),loan:t=>u(`${p}/api/loans/${t}`),createLoan:t=>u(`${p}/api/loans`,{method:"POST",body:JSON.stringify(t)}),registerPayment:(t,e)=>u(`${p}/api/loans/${t}/payments`,{method:"POST",body:JSON.stringify(e)})},python:{summary:()=>u(`${$}/api/reports/summary`),overdue:()=>u(`${$}/api/reports/overdue`),portfolioRisk:()=>u(`${$}/api/reports/portfolio-risk`),amortization:(t,e,a)=>u(`${$}/api/reports/amortization?amount=${t}&annual_rate=${e}&months=${a}`)}};function d(t,e="USD"){const a=typeof t=="string"?Number(t):t;return`${e==="USD"?"US$":"S/"} ${a.toLocaleString("es-PE",{minimumFractionDigits:2,maximumFractionDigits:2})}`}function E(t){return`${((typeof t=="string"?Number(t):t)*100).toLocaleString("es-PE",{minimumFractionDigits:2,maximumFractionDigits:2})}%`}function h(t){const[e,a,s]=t.slice(0,10).split("-");return`${s}/${a}/${e}`}function S(t){const a={active:"Activo",paid:"Pagado",late:"Vencido",pending:"Pendiente"}[t]??t;return`<span class="badge badge-${t}">${a}</span>`}function j(t){return{bank_transfer:"Transferencia",cash:"Efectivo",check:"Cheque",card:"Tarjeta",other:"Otro"}[t]??t}let T;function v(t,e="ok"){const a=document.getElementById("toast-root");if(!a)return;const s=document.createElement("div");s.className=`toast toast-${e}`,s.textContent=t,a.appendChild(s),window.clearTimeout(T),T=window.setTimeout(()=>{s.classList.add("toast-hide"),window.setTimeout(()=>s.remove(),300)},3200)}function C(t){const e=document.createElement("dialog");return e.className="modal",e.innerHTML=t,document.body.appendChild(e),e.showModal(),e.addEventListener("click",a=>{a.target===e&&e.close()}),e}function f(t){t.close(),t.remove()}function _(t,e="Cargando..."){t.innerHTML=`<div class="loading"><div class="spinner"></div><p>${e}</p></div>`}function w(t,e){const a=e instanceof Error?e.message:String(e);t.innerHTML=`
    <div class="empty empty-err">
      <p><strong>Ups, algo salió mal</strong></p>
      <p>${a}</p>
      <button class="btn btn-ghost" onclick="location.reload()">Reintentar</button>
    </div>`}function M(t){t.innerHTML="",_(t,"Cargando empresas..."),m.rust.companies().then(e=>{t.innerHTML=`
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
                ${e.length===0?'<tr><td colspan="6" class="td-empty">Aún no hay empresas registradas</td></tr>':e.map(s=>`
                            <tr>
                              <td><strong>${s.name}</strong></td>
                              <td class="mono">${s.ruc}</td>
                              <td>${s.contact_email??"—"}</td>
                              <td>${s.contact_phone??"—"}</td>
                              <td>${h(s.created_at)}</td>
                              <td class="row-actions">
                                <button class="btn btn-sm btn-ghost" data-edit="${s.id}">Editar</button>
                                <button class="btn btn-sm btn-danger" data-del="${s.id}">Eliminar</button>
                              </td>
                            </tr>`).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `;const a=t.querySelector("#btn-new-company");a==null||a.addEventListener("click",()=>q(null)),t.querySelectorAll("[data-edit]").forEach(s=>{const o=s.getAttribute("data-edit");s.addEventListener("click",()=>{const n=e.find(r=>r.id===o);n&&q(n)})}),t.querySelectorAll("[data-del]").forEach(s=>{const o=s.getAttribute("data-del");s.addEventListener("click",()=>{const n=e.find(r=>r.id===o);confirm(`¿Eliminar a "${n.name}"? Se borrarán sus préstamos y pagos.`)&&m.rust.deleteCompany(o).then(()=>{v("Empresa eliminada"),M(t)}).catch(r=>v(r.message,"err"))})})}).catch(e=>w(t,e))}function q(t){var s,o;const e=t!==null,a=C(`
    <form method="dialog" class="modal-body" id="company-form">
      <h3>${e?"Editar empresa":"Nueva empresa"}</h3>
      <label>Nombre
        <input name="name" required maxlength="150" value="${(t==null?void 0:t.name)??""}" />
      </label>
      <label>RUC
        <input name="ruc" required maxlength="20" value="${(t==null?void 0:t.ruc)??""}" />
      </label>
      <label>Correo de contacto
        <input name="contact_email" type="email" value="${(t==null?void 0:t.contact_email)??""}" />
      </label>
      <label>Teléfono
        <input name="contact_phone" maxlength="30" value="${(t==null?void 0:t.contact_phone)??""}" />
      </label>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-cancel>Cancelar</button>
        <button type="submit" class="btn btn-primary">Guardar</button>
      </div>
    </form>
  `);(s=a.querySelector("[data-cancel]"))==null||s.addEventListener("click",()=>f(a)),(o=a.querySelector("form"))==null||o.addEventListener("submit",n=>{n.preventDefault();const r=n.target,i=new FormData(r),l={name:String(i.get("name")??"").trim(),ruc:String(i.get("ruc")??"").trim(),contact_email:String(i.get("contact_email")??"").trim()||null,contact_phone:String(i.get("contact_phone")??"").trim()||null},b=()=>{(e?m.rust.updateCompany(t.id,l):m.rust.createCompany(l)).then(()=>{v(e?"Empresa actualizada":"Empresa creada"),f(a),window.dispatchEvent(new Event("pp:refresh"))}).catch(g=>v(g.message,"err"))};b()})}function F(t){t.innerHTML="",_(t,"Calculando métricas del portafolio..."),m.rust.dashboard().then(e=>{t.innerHTML=`
        <div class="grid-cards">
          <div class="card stat accent-green">
            <div class="stat-label">Capital desembolsado</div>
            <div class="stat-value">${d(e.total_loaned)}</div>
            <div class="stat-foot">${e.active_loans} préstamos activos</div>
          </div>
          <div class="card stat accent-blue">
            <div class="stat-label">Cobrado hasta hoy</div>
            <div class="stat-value">${d(e.total_collected)}</div>
            <div class="stat-foot">${e.paid_loans} préstamos pagados</div>
          </div>
          <div class="card stat accent-amber">
            <div class="stat-label">Por cobrar (cuotas)</div>
            <div class="stat-value">${d(e.outstanding)}</div>
            <div class="stat-foot">Saldo vivo del portafolio</div>
          </div>
          <div class="card stat ${e.overdue_installments>0?"accent-red":"accent-green"}">
            <div class="stat-label">Cuotas vencidas</div>
            <div class="stat-value">${e.overdue_installments}</div>
            <div class="stat-foot">${d(e.overdue_amount)} en riesgo</div>
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <h2>Préstamos recientes</h2>
            <a class="btn btn-ghost" href="#/loans">Ver todos →</a>
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
              <tbody>
                ${e.recent_loans.map(a=>`
                      <tr>
                        <td><strong>${a.company_name}</strong></td>
                        <td>${d(a.amount,a.currency)}</td>
                        <td>${E(a.annual_rate)}</td>
                        <td>${a.term_months} meses</td>
                        <td>${h(a.start_date)}</td>
                        <td>${S(a.status)}</td>
                        <td><a class="link" href="#/loans/${a.id}">Ver →</a></td>
                      </tr>`).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `}).catch(e=>w(t,e))}function D(t,e){t.innerHTML="",_(t,"Cargando detalle del préstamo..."),m.rust.loan(e).then(a=>{const s=a.installments.find(r=>r.status!=="paid"),o=a.installments.filter(r=>r.status==="paid").length;t.innerHTML=`
        <div class="grid-cards">
          <div class="card stat accent-green">
            <div class="stat-label">Monto</div>
            <div class="stat-value">${d(a.amount,a.currency)}</div>
            <div class="stat-foot">${a.company_name}</div>
          </div>
          <div class="card stat accent-blue">
            <div class="stat-label">Cuotas</div>
            <div class="stat-value">${o} / ${a.installments.length}</div>
            <div class="stat-foot">${E(a.annual_rate)} tasa anual</div>
          </div>
          <div class="card stat accent-amber">
            <div class="stat-label">Estado</div>
            <div class="stat-value">${S(a.status)}</div>
            <div class="stat-foot">Inició ${h(a.start_date)}</div>
          </div>
          <div class="card stat accent-green">
            <div class="stat-label">Siguiente cuota</div>
            <div class="stat-value">${s?h(s.due_date):"—"}</div>
            <div class="stat-foot">${s?`${d(s.principal+s.interest,a.currency)}`:"Préstamo al día"}</div>
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <h2>Cuotas</h2>
            ${s?'<button class="btn btn-primary" id="btn-pay">+ Registrar pago</button>':""}
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
                ${a.installments.map(r=>{const i=Number(r.principal)+Number(r.interest),l=Math.max(i-Number(r.paid_amount),0);return`
                      <tr class="${r.status==="late"?"row-late":""}">
                        <td>${r.number}</td>
                        <td>${h(r.due_date)}</td>
                        <td>${d(r.principal,a.currency)}</td>
                        <td>${d(r.interest,a.currency)}</td>
                        <td><strong>${d(i,a.currency)}</strong></td>
                        <td>${d(r.paid_amount,a.currency)}</td>
                        <td>${d(l,a.currency)}</td>
                        <td>${S(r.status)}</td>
                      </tr>`}).join("")}
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
                ${a.payments.length===0?'<tr><td colspan="5" class="td-empty">Sin pagos registrados</td></tr>':a.payments.map(r=>{var i;return`
                            <tr>
                              <td>${h(r.payment_date)}</td>
                              <td>#${((i=a.installments.find(l=>l.id===r.installment_id))==null?void 0:i.number)??"?"}</td>
                              <td><strong>${d(r.amount,a.currency)}</strong></td>
                              <td>${j(r.method)}</td>
                              <td>${r.reference??"—"}</td>
                            </tr>`}).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `;const n=t.querySelector("#btn-pay");n==null||n.addEventListener("click",()=>A(t,e,a))}).catch(a=>w(t,a))}function A(t,e,a){var l,b;const s=a.installments.filter(c=>c.status!=="paid"),o=s[0],n=Number(o.principal)+Number(o.interest),r=Math.max(n-Number(o.paid_amount),0),i=C(`
    <form method="dialog" class="modal-body" id="payment-form">
      <h3>Registrar pago</h3>
      <label>Cuota a pagar
        <select name="installment_id">
          ${s.map(c=>`
                <option value="${c.id}" ${c.id===o.id?"selected":""}>
                  #${c.number} · ${h(c.due_date)} (${d(Number(c.principal)+Number(c.interest)-Number(c.paid_amount),a.currency)})
                </option>`).join("")}
        </select>
      </label>
      <div class="form-row">
        <label>Monto
          <input name="amount" type="number" step="0.01" min="0.01" required value="${r}" />
        </label>
        <label>Fecha
          <input name="payment_date" type="date" required value="${new Date().toISOString().slice(0,10)}" />
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
  `);(l=i.querySelector("[data-cancel]"))==null||l.addEventListener("click",()=>f(i)),(b=i.querySelector("form"))==null||b.addEventListener("submit",c=>{c.preventDefault();const g=new FormData(c.target),O={installment_id:String(g.get("installment_id")),amount:String(g.get("amount")),payment_date:String(g.get("payment_date")),method:String(g.get("method")),reference:String(g.get("reference")??"")||void 0};m.rust.registerPayment(e,O).then(()=>{v("Pago registrado"),f(i),D(t,e)}).catch(R=>v(R.message,"err"))})}let L=[];function x(t){t.innerHTML="",_(t,"Cargando préstamos..."),Promise.all([m.rust.loans(),m.rust.companies()]).then(([e,a])=>{var s,o;L=a,t.innerHTML=`
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
                ${N(e)}
              </tbody>
            </table>
          </div>
        </div>
      `,(s=t.querySelector("#btn-new-loan"))==null||s.addEventListener("click",()=>z(t)),(o=t.querySelector("#filter-status"))==null||o.addEventListener("change",async n=>{const r=n.target.value;try{const i=await m.rust.loans({status:r});t.querySelector("#loans-body").innerHTML=N(i)}catch(i){v(i.message,"err")}})}).catch(e=>w(t,e))}function N(t){return t.length===0?'<tr><td colspan="7" class="td-empty">Sin préstamos</td></tr>':t.map(e=>`
        <tr>
          <td><strong>${e.company_name}</strong></td>
          <td>${d(e.amount,e.currency)}</td>
          <td>${E(e.annual_rate)}</td>
          <td>${e.term_months} meses</td>
          <td>${h(e.start_date)}</td>
          <td>${S(e.status)}</td>
          <td><a class="link" href="#/loans/${e.id}">Ver →</a></td>
        </tr>`).join("")}function z(t){var o;if(L.length===0){v("Primero registra una empresa","err");return}const e=C(`
    <form method="dialog" class="modal-body modal-wide" id="loan-form">
      <h3>Nuevo préstamo</h3>
      <label>Empresa
        <select name="company_id" required>
          ${L.map(n=>`<option value="${n.id}">${n.name}</option>`).join("")}
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
          <input name="start_date" type="date" required value="${new Date().toISOString().slice(0,10)}" />
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
  `),a=e.querySelector("form");(o=e.querySelector("[data-cancel]"))==null||o.addEventListener("click",()=>f(e));const s=()=>{const n=Number(a.elements.namedItem("amount").value),r=Number(a.elements.namedItem("annual_rate").value)/100,i=Number(a.elements.namedItem("term_months").value);!n||!r||!i||m.python.amortization(n,r,i).then(l=>{e.querySelector("#pv-quota").textContent=d(l.totals.monthly_payment),e.querySelector("#pv-interest").textContent=d(l.totals.total_interest),e.querySelector("#pv-total").textContent=d(l.totals.total_payment)}).catch(()=>{})};a.querySelectorAll("input").forEach(n=>n.addEventListener("input",s)),s(),a.addEventListener("submit",n=>{n.preventDefault();const r=new FormData(a),i={company_id:String(r.get("company_id")),amount:String(r.get("amount")),annual_rate:String(Number(r.get("annual_rate"))/100),term_months:Number(r.get("term_months")),start_date:String(r.get("start_date"))};m.rust.createLoan(i).then(l=>{v("Préstamo creado con sus cuotas"),f(e),x(t),window.location.hash=`#/loans/${l.id}`}).catch(l=>v(l.message,"err"))})}function U(t){t.innerHTML="",_(t,"Generando reportes financieros..."),Promise.all([m.python.summary(),m.python.overdue(),m.python.portfolioRisk()]).then(([e,a,s])=>{var o;t.innerHTML=`
        <div class="grid-cards">
          <div class="card stat accent-green">
            <div class="stat-label">Capital total desembolsado</div>
            <div class="stat-value">${d(e.total_loaned)}</div>
            <div class="stat-foot">${d(e.active_loaned)} activo hoy</div>
          </div>
          <div class="card stat accent-blue">
            <div class="stat-label">Recuperado</div>
            <div class="stat-value">${d(e.total_collected)}</div>
            <div class="stat-foot">Tasa de recuperación ${e.recovery_rate.toFixed(1)}%</div>
          </div>
          <div class="card stat accent-amber">
            <div class="stat-label">Cartera vencida</div>
            <div class="stat-value">${d(e.overdue_amount)}</div>
            <div class="stat-foot">${e.overdue_installments} cuotas vencidas</div>
          </div>
          <div class="card stat accent-blue">
            <div class="stat-label">Interés esperado</div>
            <div class="stat-value">${d(e.expected_interest)}</div>
            <div class="stat-foot">Tasa promedio ${E(e.average_annual_rate)}</div>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h2>Morosidad</h2></div>
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr><th>Empresa</th><th>Cuota</th><th>Vencimiento</th><th>Días de atraso</th><th>Por cobrar</th></tr>
              </thead>
              <tbody>
                ${a.length===0?'<tr><td colspan="5" class="td-empty">¡Sin cuotas vencidas!</td></tr>':a.map(n=>`
                            <tr>
                              <td><strong>${n.company_name}</strong></td>
                              <td>#${n.number}</td>
                              <td>${h(n.due_date)}</td>
                              <td class="danger-text">${n.days_overdue} días</td>
                              <td>${d(n.remaining,n.currency)}</td>
                            </tr>`).join("")}
              </tbody>
            </table>
          </div>
        </div>

        <div class="grid-2">
          <div class="card">
            <div class="card-head"><h2>Salud del portafolio</h2></div>
            <div class="bars">
              <div class="bar-row">
                <span>Pagadas</span>
                <div class="bar-track"><div class="bar-fill green" style="width:${s.installment_health.paid_pct}%"></div></div>
                <span>${s.installment_health.paid} (${s.installment_health.paid_pct}%)</span>
              </div>
              <div class="bar-row">
                <span>Por vencer</span>
                <div class="bar-track"><div class="bar-fill blue" style="width:${Math.max(100-s.installment_health.paid_pct-s.installment_health.late_pct,0)}%"></div></div>
                <span>${s.installment_health.upcoming}</span>
              </div>
              <div class="bar-row">
                <span>Vencidas</span>
                <div class="bar-track"><div class="bar-fill red" style="width:${s.installment_health.late_pct}%"></div></div>
                <span>${s.installment_health.late} (${s.installment_health.late_pct}%)</span>
              </div>
            </div>
            <h3 class="subtitle">Concentración por empresa</h3>
            <div class="table-wrap">
              <table class="table">
                <thead><tr><th>Empresa</th><th>Por cobrar</th><th>% del total</th><th>Rating</th></tr></thead>
                <tbody>
                  ${s.companies_concentration.map(n=>`
                        <tr>
                          <td><strong>${n.name}</strong></td>
                          <td>${d(n.outstanding)}</td>
                          <td>${n.concentration_pct}%</td>
                          <td>${V(n.rating)}</td>
                        </tr>`).join("")}
                </tbody>
              </table>
            </div>
          </div>

          <div class="card">
            <div class="card-head"><h2>Simulador de amortización</h2></div>
            <form id="sim-form" class="sim-form">
              <div class="form-row">
                <label>Monto <input name="amount" type="number" step="0.01" min="1" required value="50000" /></label>
                <label>Tasa anual (%) <input name="rate" type="number" step="0.01" min="0.1" required value="12" /></label>
              </div>
              <div class="form-row">
                <label>Plazo (meses) <input name="months" type="number" min="1" max="360" required value="12" /></label>
                <button type="submit" class="btn btn-primary" style="margin-top:22px">Calcular</button>
              </div>
            </form>
            <div id="sim-result"></div>
          </div>
        </div>
      `,(o=t.querySelector("#sim-form"))==null||o.addEventListener("submit",n=>{n.preventDefault();const r=new FormData(n.target),i=Number(r.get("amount")),l=Number(r.get("rate"))/100,b=Number(r.get("months"));m.python.amortization(i,l,b).then(c=>B(t.querySelector("#sim-result"),c)).catch(c=>v(c.message,"err"))})}).catch(e=>w(t,e))}function V(t){return`<span class="badge ${t==="ALTO"?"badge-late":t==="MEDIO"?"badge-active":"badge-paid"}">${t}</span>`}function B(t,e){t.innerHTML=`
    <div class="preview">
      <div class="preview-row"><span>Cuota mensual</span><strong>${d(e.totals.monthly_payment)}</strong></div>
      <div class="preview-row"><span>Total a pagar</span><strong>${d(e.totals.total_payment)}</strong></div>
      <div class="preview-row"><span>Interés total</span><strong>${d(e.totals.total_interest)}</strong></div>
    </div>
    <div class="table-wrap sim-table">
      <table class="table">
        <thead><tr><th>N°</th><th>Vence</th><th>Cuota</th><th>Capital</th><th>Interés</th><th>Saldo</th></tr></thead>
        <tbody>
          ${e.schedule.map(a=>`
                <tr>
                  <td>${a.number}</td>
                  <td>${h(a.due_date)}</td>
                  <td>${d(a.payment)}</td>
                  <td>${d(a.principal)}</td>
                  <td>${d(a.interest)}</td>
                  <td>${d(a.balance)}</td>
                </tr>`).join("")}
        </tbody>
      </table>
    </div>
  `}const y=document.getElementById("view"),J={dashboard:"Panel",loans:"Préstamos",companies:"Empresas",reports:"Reportes","loan-detail":"Detalle del préstamo"};function P(){const t=location.hash.replace(/^#\/?/,"")||"dashboard",[e,a]=t.split("/");document.querySelectorAll("[data-nav]").forEach(o=>{o.classList.toggle("active",o.getAttribute("data-nav")===e)});const s=document.getElementById("page-title");switch(s&&(s.textContent=J[e]??"MerPrest"),e){case"loans":a?D(y,a):x(y);break;case"companies":M(y);break;case"reports":U(y);break;default:F(y)}}window.addEventListener("hashchange",P);window.addEventListener("pp:refresh",P);function I(){const t=document.getElementById("clock");t&&(t.textContent=new Date().toLocaleString("es-PE",{dateStyle:"full",timeStyle:"short"}))}I();window.setInterval(I,1e3);async function k(){const t=(e,a)=>{const s=document.getElementById(e);s&&(s.className=`svc-dot ${a?"ok":"down"}`)};try{const e=await fetch(`${p}/health`);t("svc-rust",e.ok)}catch{t("svc-rust",!1)}try{const e=await fetch(`${$}/api/reports/health`);t("svc-py",e.ok)}catch{t("svc-py",!1)}}k();window.setInterval(k,15e3);P();
