/* Finanças do Casal — Desenho das telas: início, contas, análises, cadastros e filtro por pessoa. */
"use strict";

// ================================================================
// RENDER
// ================================================================
function render() {
  $("#mes-atual").textContent = nomeMes(estado.mes, "medio");
  const lista = contasDoMes(estado.mes);
  renderHero(lista);
  renderAlertas(lista);
  renderResumoGastos();
  renderProximas(lista);
  renderListaMes(lista);
  renderCategorias(lista);
  renderDivisao(lista);
  renderHistorico();
  renderCadastroContas();
  renderCadastroRendas();
  renderFiltroPessoa();
  renderGastos();
  renderCadastroOrcamentos();
  renderFaturas();
  renderCadastroCartoes();
  renderMetas();
  renderFamilia();
}

let totalAnterior = null;
function renderHero(lista) {
  const fixas = soma(lista, (c) => c.valorMes);
  const pago = soma(lista.filter((c) => c.pagamento), (c) => c.valorMes);
  const pct = fixas ? Math.round((pago / fixas) * 100) : 0;
  const comGastos = estado.migracao2;
  const gastos = comGastos ? soma(gastosDoMes(estado.mes), (g) => g.valor) : 0;
  const limite = comGastos ? soma(estado.orcamentos.filter((o) => o.ativa), (o) => o.limite) : 0;
  const total = fixas + gastos;
  const renda = soma(estado.rendas.filter((r) => r.ativa), (r) => r.valor);
  const pctRenda = renda ? Math.round((total / renda) * 100) : null;
  const R = 26, C = 2 * Math.PI * R;
  const mes = esc(nomeMes(estado.mes, "mes"));
  $("#hero").innerHTML = `
    <div class="hero-topo">
      <div>
        <div class="rotulo">${comGastos ? `Total de ${mes}` : `Contas fixas de ${mes}`}
          <button class="olho" id="btn-olho" aria-label="${ocultar ? "Mostrar valores" : "Esconder valores"}" aria-pressed="${ocultar}">${svg(ocultar ? "olhoFechado" : "olho")}</button>
        </div>
        <div class="grande" id="hero-total">${fmt(total)}</div>
        ${comGastos ? `<div class="hero-sub">contas fixas + gastos</div>` : ""}
      </div>
      <div class="rosca" role="img" aria-label="${pct}% das contas fixas pagas">
        <svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="${R}" class="trilho-r"/>
          <circle cx="32" cy="32" r="${R}" class="arco-r" stroke-dasharray="${C}" stroke-dashoffset="${C}" data-alvo="${C * (1 - pct / 100)}"/></svg>
        <span>${pct}%<small>${comGastos ? "contas<br>pagas" : "pago"}</small></span>
      </div>
    </div>
    ${comGastos ? `
    <div class="duas">
      <button type="button" class="hero-box" data-ir="contas"><small>Contas fixas ›</small><b>${fmt(fixas)}</b><em>${pago >= fixas && fixas ? "tudo pago ✓" : `falta pagar ${fmt(fixas - pago)}`}</em></button>
      <button type="button" class="hero-box" data-ir="gastos"><small>Gastos ›</small><b>${fmt(gastos)}</b><em>${limite ? (gastos <= limite ? `restam ${fmt(limite - gastos)}` : `⚠ passou ${fmt(gastos - limite)}`) : "lançados no mês"}</em></button>
    </div>` : `
    <div class="duas">
      <div><small>Já pago</small><b>${fmt(pago)}</b></div>
      <div><small>Falta pagar</small><b>${fmt(fixas - pago)}</b></div>
    </div>`}
    <div class="renda-linha">${renda
      ? `<span><b>${pctRenda}%</b> da renda</span><span>Sobram ${fmt(renda - total)}</span>`
      : `<span>Cadastre as rendas em Mais → Rendas para ver quanto sobra</span>`}</div>`;
  // anima o arco e o número
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const arco = $("#hero .arco-r"); if (arco) arco.style.strokeDashoffset = arco.dataset.alvo;
  }));
  if (!ocultar && totalAnterior !== null && totalAnterior !== total) contarAte($("#hero-total"), totalAnterior, total);
  totalAnterior = total;
}

function contarAte(el, de, ate) {
  const ini = performance.now(), dur = 450;
  const passo = (t) => {
    const k = Math.min((t - ini) / dur, 1), e = 1 - Math.pow(1 - k, 3);
    el.textContent = brl.format(de + (ate - de) * e);
    if (k < 1) requestAnimationFrame(passo);
  };
  requestAnimationFrame(passo);
}

function renderAlertas(lista) {
  const atr = lista.filter((c) => c.status.chave === "atrasada");
  const hoje = lista.filter((c) => c.status.chave === "hoje");
  const breve = lista.filter((c) => c.status.chave === "breve");
  const pend = lista.filter((c) => !c.pagamento);
  const itens = [];
  if (atr.length) itens.push(`<button class="alerta crit" data-ir="contas">! ${atr.length} atrasada${atr.length > 1 ? "s" : ""} · ${fmt(soma(atr, (c) => c.valorMes))}</button>`);
  if (hoje.length) itens.push(`<button class="alerta warn" data-ir="contas">● ${hoje.length} vence${hoje.length > 1 ? "m" : ""} hoje</button>`);
  if (breve.length) itens.push(`<button class="alerta warn" data-ir="contas">● ${breve.length} em breve</button>`);
  faturasDoMes(estado.mes).forEach((f) => {
    if (f.status.chave === "vencida") itens.push(`<button class="alerta crit" data-abrir-fatura="${f.cartao.id}">! Fatura ${esc(f.cartao.nome)} vencida</button>`);
    else if (f.status.chave === "fechada" && f.status.dias <= DIAS_ALERTA) itens.push(`<button class="alerta warn" data-abrir-fatura="${f.cartao.id}">● Fatura ${esc(f.cartao.nome)} ${f.status.dias === 0 ? "vence hoje" : `vence em ${f.status.dias}d`}</button>`);
  });
  if (lista.length && !pend.length) itens.push(`<span class="alerta good">✓ Tudo pago neste mês</span>`);
  $("#alertas").innerHTML = itens.join("");
  const cont = $("#contador-pendentes");
  const urg = atr.length + hoje.length;
  cont.hidden = !urg; cont.textContent = urg;
}

function itemConta(c) {
  const titulo = c.pagamento
    ? `Pago em ${new Date(c.pagamento.pago_em + "T12:00").toLocaleDateString("pt-BR")}${c.pagamento.pago_por ? " por " + c.pagamento.pago_por : ""}`
    : "Marcar como paga";
  return `
    <li class="${c.pagamento ? "paga" : ""}">
      <button class="pagar ${c.pagamento ? "on" : ""}" data-pagar="${c.id}" aria-label="${c.pagamento ? "Desmarcar pagamento de" : "Marcar como paga:"} ${esc(c.nome)}" title="${esc(titulo)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4.5 4.5L19 7"/></svg></button>
      ${bolaIcone(c)}
      <div class="info" data-editar-conta="${c.id}">
        <div class="nome">${esc(c.nome)}</div>
        <div class="meta">${c.fim ? "Só neste mês · " : ""}Dia ${c.dia_vencimento} · ${esc(c.categoria)} · ${esc(c.responsavel)}</div>
      </div>
      <div class="dir">
        ${c.variavel && !c.pagamento && estado.migracao6
          ? `<button type="button" class="valor valor-btn ${c.aDefinir ? "a-definir" : ""}" data-informar="${c.id}" title="Informar o valor deste mês">${c.aDefinir ? "a definir" : (c.estimado && !ocultar ? "~" : "") + fmt(c.valorMes)}<span class="lapis" aria-hidden="true">✎</span></button>`
          : c.aDefinir ? `<span class="valor a-definir" title="O valor muda todo mês: informe quando pagar">a definir</span>`
          : `<span class="valor" ${c.estimado ? 'title="Estimativa pela média dos últimos meses"' : ""}>${c.estimado && !ocultar ? "~" : ""}${fmt(c.valorMes)}</span>`}
        <span class="badge ${c.status.chave}">${c.status.texto}</span>
      </div>
    </li>`;
}

function renderProximas(lista) {
  const pend = lista.filter((c) => !c.pagamento).slice(0, 3);
  $("#lista-proximas").innerHTML = pend.length
    ? pend.map(itemConta).join("")
    : estado.contas.length
      ? vazio("festa", "Tudo em dia!", "Nenhuma conta pendente neste mês.")
      : vazio("lista", "Comece cadastrando suas contas", "Aluguel, luz, internet… cadastre uma vez e acompanhe todo mês.", ["nova-conta", "Cadastrar primeira conta"]);
}

function renderAvisoContas() {
  const el = $("#aviso-contas");
  el.hidden = lerPref("aviso-contas-ok", false) || !estado.contas.length;
}

function renderResumoContas(lista) {
  const total = soma(lista, (c) => c.valorMes);
  const pago = soma(lista.filter((c) => c.pagamento), (c) => c.valorMes);
  const pct = total ? Math.round((pago / total) * 100) : 0;
  const atr = lista.filter((c) => c.status.chave === "atrasada");
  const npag = lista.filter((c) => c.pagamento).length;
  $("#resumo-contas").hidden = !lista.length;
  $("#resumo-contas").innerHTML = `
    <div class="rc-topo"><div><small>Contas fixas de ${esc(nomeMes(estado.mes, "mes"))}</small><b>${fmt(total)}</b>${lista.some((c) => c.aDefinir) ? `<em class="rc-def">+ ${lista.filter((c) => c.aDefinir).length} com valor a definir</em>` : ""}</div><span class="rc-pct">${pct}%<small>pago</small></span></div>
    <div class="meter-orc grande ${pct === 100 ? "bom" : "ok"}"><span style="width:${pct}%"></span></div>
    <div class="rc-duas">
      <div><small>Já pago</small><b class="bom-txt">${fmt(pago)}</b><em>${npag} de ${lista.length} conta${lista.length !== 1 ? "s" : ""}</em></div>
      <div><small>Falta pagar</small><b>${fmt(total - pago)}</b><em class="${atr.length ? "crit" : ""}">${atr.length ? `! ${atr.length} atrasada${atr.length > 1 ? "s" : ""}` : lista.length - npag ? `${lista.length - npag} pendente${lista.length - npag > 1 ? "s" : ""}` : "tudo pago ✓"}</em></div>
    </div>`;
}

function renderListaMes(lista) {
  renderAvisoContas();
  renderResumoContas(lista);
  const f = estado.filtro;
  const itens = lista.filter((c) => f === "todas" || (f === "pagas" ? c.pagamento : !c.pagamento));
  $("#lista-mes").innerHTML = itens.length
    ? itens.map(itemConta).join("")
    : !estado.contas.length
      ? vazio("lista", "Nenhuma conta cadastrada", "Cadastre as contas fixas e elas aparecem aqui todo mês.", ["nova-conta", "Nova conta"])
      : f === "pendentes" ? vazio("festa", "Nada a pagar neste mês", "Todas as contas já foram pagas.")
      : vazio("lista", "Nenhuma conta paga ainda", "Toque no quadrado de uma conta para marcar como paga.");
}

function renderCategorias(lista) {
  const mapa = {};
  lista.forEach((c) => (mapa[c.categoria] = (mapa[c.categoria] || 0) + c.valorMes));
  let linhas = Object.entries(mapa).sort((a, b) => b[1] - a[1]);
  if (linhas.length > 7) {
    const resto = linhas.slice(6);
    linhas = [...linhas.slice(0, 6), [`Outras (${resto.length})`, soma(resto, (l) => l[1])]];
  }
  const total = soma(linhas, (l) => l[1]);
  const max = Math.max(...linhas.map((l) => l[1]), 1);
  $("#graf-categorias").innerHTML = linhas.length
    ? linhas.map(([cat, v]) => `
      <div class="bh" data-tip="${esc(cat)}: ${fmt(v)} (${Math.round((v / total) * 100)}% do mês)">
        <span class="r">${esc(cat)} <span style="color:var(--text-3)">· ${Math.round((v / total) * 100)}%</span></span>
        <span class="v">${fmt(v)}</span>
        <div class="trilho"><div class="barra" style="width:${(v / max) * 100}%"></div></div>
      </div>`).join("")
    : `<ul class="lista-contas">${vazio("grafico", "Sem dados neste mês", "Cadastre contas para ver para onde vai o dinheiro.")}</ul>`;
}

function renderDivisao(lista) {
  const casal = soma(lista.filter((c) => c.responsavel === "Casal"), (c) => c.valorMes);
  const outros = lista.filter((c) => c.responsavel !== "Casal" && !PESSOAS.includes(c.responsavel));
  $("#divisao").innerHTML = PESSOAS.map((p) => {
    const ind = soma(lista.filter((c) => c.responsavel === p), (c) => c.valorMes);
    const metade = casal / PESSOAS.length;
    return `<div class="pessoa"><div><div class="n">${esc(p)}</div><div class="d">${fmt(ind)} só dele(a) + ${fmt(metade)} do casal</div></div><div class="t">${fmt(ind + metade)}</div></div>`;
  }).join("") + (outros.length ? `<p class="muted pequeno">${outros.length} conta(s) com responsável não reconhecido ficaram de fora.</p>` : "");
}

function renderHistorico() {
  const meses = Array.from({ length: 6 }, (_, i) => somaMes(estado.mes, i - 5));
  const atual = compDe(new Date());
  const dados = meses.map((m) => {
    const l = contasDoMes(m);
    const previsto = m >= atual;
    const valor = previsto ? soma(l, (c) => c.valorMes) : soma(l.filter((c) => c.pagamento), (c) => c.valorMes);
    return { m, valor, previsto };
  });
  const max = Math.max(...dados.map((d) => d.valor), 1);
  $("#graf-historico").innerHTML = dados.map((d) => `
    <div class="bv ${d.previsto ? "previsto" : ""}" data-tip="${esc(nomeMes(d.m))}: ${fmt(d.valor)} ${d.previsto ? "(previsto)" : "(pago)"}">
      <span class="rot-v">${d.valor ? brlCurto.format(d.valor) : ""}</span>
      <div class="barra" style="height:${(d.valor / max) * 85}%"></div>
    </div>`).join("");
  $("#eixo-historico").innerHTML = dados.map((d) => `<span>${esc(nomeMes(d.m, "curto"))}</span>`).join("");
}

function renderCadastroContas() {
  const contas = [...estado.contas].sort((a, b) => (b.ativa - a.ativa) || a.dia_vencimento - b.dia_vencimento);
  const ativas = contas.filter((c) => c.ativa && !c.fim);
  $("#cad-contas").innerHTML = contas.length
    ? contas.map((c) => `
      <li class="swipe ${c.ativa ? "" : "inativa"}" data-swipe="conta" data-id="${c.id}">${ACAO_EXCLUIR()}
        <button class="item" data-editar-conta="${c.id}">
          ${bolaIcone(c)}
          <div><div class="nome">${esc(c.nome)}${c.ativa ? "" : ' <span class="badge inativa">Encerrada</span>'}</div>
          <div class="meta">${c.fim ? `Só ${esc(nomeMes(c.fim, "curto").toLowerCase())}/${c.fim.slice(2, 4)} · ` : c.variavel ? "Valor variável · " : ""}Dia ${c.dia_vencimento} · ${esc(c.categoria)} · ${esc(c.responsavel)}${c.forma_pagamento ? " · " + esc(c.forma_pagamento) : ""}</div></div>
          <span class="valor">${fmt(c.valor)}</span><span class="seta">›</span>
        </button>
      </li>`).join("") + `<li class="total"><span>Total por mês</span><span>${fmt(soma(ativas, (c) => c.valor))}</span></li>`
    : vazio("lista", "Nenhuma conta fixa", "Toque em + para cadastrar a primeira.", ["nova-conta", "Nova conta"]);
}

function renderCadastroRendas() {
  const rendas = [...estado.rendas].sort((a, b) => b.ativa - a.ativa);
  $("#cad-rendas").innerHTML = rendas.length
    ? rendas.map((r) => `
      <li class="swipe ${r.ativa ? "" : "inativa"}" data-swipe="renda" data-id="${r.id}">${ACAO_EXCLUIR()}
        <button class="item" data-editar-renda="${r.id}">
          <span class="bola-cat" aria-hidden="true">${svg("moeda")}</span>
          <div><div class="nome">${esc(r.descricao)}${r.ativa ? "" : ' <span class="badge inativa">Encerrada</span>'}</div><div class="meta">${esc(r.responsavel)}</div></div>
          <span class="valor">${fmt(r.valor)}</span><span class="seta">›</span>
        </button>
      </li>`).join("") + `<li class="total"><span>Total por mês</span><span>${fmt(soma(rendas.filter((r) => r.ativa), (r) => r.valor))}</span></li>`
    : vazio("moeda", "Nenhuma renda cadastrada", "Com as rendas, o painel mostra quanto sobra depois das contas.", ["nova-renda", "Nova renda"]);
}

// ---------- Filtro por pessoa (abas Gastos e Metas) ----------
let pessoa = lerPref("pessoa", "todos");
if (pessoa !== "todos" && !PESSOAS.includes(pessoa)) pessoa = "todos";
const daPessoa = (x) => pessoa === "todos" || x.responsavel === pessoa;
const gastosFiltrados = () => gastosDoMes(estado.mes).filter(daPessoa);
function renderFiltroPessoa() {
  const ops = [["todos", "Todos"], ...PESSOAS.map((p) => [p, p])];
  $$("[data-filtro-pessoa]").forEach((el) => {
    el.innerHTML = ops.map(([v, t]) => `<button type="button" class="chip-pessoa ${v === pessoa ? "ativo" : ""}" data-pessoa="${esc(v)}" aria-pressed="${v === pessoa}">${v === "todos" ? "" : `<span class="mini-avatar">${esc(t.charAt(0))}</span>`}${esc(t)}</button>`).join("");
  });
}
