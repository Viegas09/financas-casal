/* Plinc — Gastos variáveis e orçamentos. */
"use strict";

// ---------- Gastos variáveis ----------
function statusOrc(gasto, limite) {
  if (!limite) return { cls: "neutro", pct: 0, txt: "Sem limite" };
  const pct = (gasto / limite) * 100;
  if (pct > 100) return { cls: "crit", pct: 100, txt: `Passou ${fmt(gasto - limite)}` };
  if (pct >= 80) return { cls: "warn", pct, txt: `Restam ${fmt(limite - gasto)}` };
  return { cls: "ok", pct, txt: `Restam ${fmt(limite - gasto)}` };
}

function linhasOrcamento() {
  const gastos = gastosDoMes(estado.mes);
  const porCat = {};
  gastos.forEach((g) => (porCat[g.categoria] = (porCat[g.categoria] || 0) + Number(g.valor)));
  const linhas = estado.orcamentos.filter((o) => o.ativa).map((o) => ({ categoria: o.categoria, limite: Number(o.limite), gasto: porCat[o.categoria] || 0, id: o.id }));
  Object.keys(porCat).filter((c) => !linhas.some((l) => l.categoria === c))
    .forEach((c) => linhas.push({ categoria: c, limite: 0, gasto: porCat[c] }));
  return linhas.sort((a, b) => (b.limite ? b.gasto / b.limite : -1) - (a.limite ? a.gasto / a.limite : -1) || b.gasto - a.gasto);
}

function diasRestantesNoMes() {
  if (estado.mes !== compDe(new Date())) return null;
  const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() - d.getDate() + 1;
}

/** O total de gastos agora aparece no cartão azul da tela inicial; o cartão separado fica escondido. */
function renderResumoGastos() { $("#resumo-gastos").hidden = true; }

function renderGastos() {
  $("#aviso-migracao").hidden = estado.migracao2;
  $("#aviso-migracao").innerHTML = `<strong>Falta um passo no banco de dados</strong><p class="muted pequeno" style="margin-bottom:0">Para usar os gastos variáveis, rode o arquivo <code>supabase/migracao-02-gastos.sql</code> no SQL Editor do Supabase e recarregue o app.</p>`;
  $$(".painel-gastos").forEach((p) => p.classList.toggle("desativado", !estado.migracao2));
  if (!estado.migracao2) { $("#resumo-orc").innerHTML = ""; $("#lista-orc").innerHTML = ""; $("#extrato").innerHTML = ""; return; }

  const gastos = gastosFiltrados();
  renderCredito(gastos);
  if (pessoa !== "todos") { renderGastosPessoa(gastos); renderExtrato(gastos); return; }
  const total = soma(gastos, (g) => g.valor);
  const limite = soma(estado.orcamentos.filter((o) => o.ativa), (o) => o.limite);
  const st = statusOrc(total, limite);
  const dias = diasRestantesNoMes();
  $("#resumo-orc").innerHTML = `
    <div class="ro-num"><small>Gasto em ${esc(nomeMes(estado.mes, "mes"))}</small><b>${fmt(total)}</b>${limite ? `<span>de ${fmt(limite)} planejados</span>` : ""}</div>
    ${limite ? `<div class="meter-orc grande ${st.cls}"><span style="width:${st.pct}%"></span></div>
    <div class="ro-rodape"><span class="${st.cls}">${st.txt}</span>${dias && total < limite ? `<span>${fmt((limite - total) / dias)} por dia · ${dias} dia${dias > 1 ? "s" : ""}</span>` : ""}</div>` : ""}`;

  const linhas = linhasOrcamento();
  $("#lista-orc").innerHTML = linhas.length ? linhas.map((l) => {
    const s2 = statusOrc(l.gasto, l.limite);
    return `
    <li>
      <button class="orc-item" data-filtrar-cat="${esc(l.categoria)}">
        <span class="bola-cat">${svg(iconeDe(l.categoria))}</span>
        <div class="orc-meio">
          <div class="orc-linha"><span class="nome">${esc(l.categoria)}</span><span class="valor">${fmt(l.gasto)}</span></div>
          ${l.limite ? `<div class="meter-orc ${s2.cls}"><span style="width:${s2.pct}%"></span></div>` : ""}
          <div class="orc-linha orc-st"><span class="${s2.cls}">${s2.cls === "crit" ? "! " : ""}${s2.txt}</span>${l.limite ? `<span class="neutro">limite ${fmt(l.limite)}</span>` : ""}</div>
        </div>
      </button>
    </li>`;
  }).join("") : vazio("carrinho", "Nenhuma categoria de gasto", "Crie categorias com limite mensal em Mais → Orçamentos.", ["novo-orcamento", "Nova categoria"]);

  renderExtrato(gastos);
}

/** Visão de uma pessoa: quanto ela gastou e quanto isso representa do gasto do casal (os limites são do casal). */
function renderGastosPessoa(gastos) {
  const doCasal = gastosDoMes(estado.mes);
  const total = soma(gastos, (g) => g.valor), totalCasal = soma(doCasal, (g) => g.valor);
  const pct = totalCasal ? Math.round((total / totalCasal) * 100) : 0;
  $("#resumo-orc").innerHTML = `
    <div class="ro-num"><small>Gastos de ${esc(pessoa)} em ${esc(nomeMes(estado.mes, "mes"))}</small><b>${fmt(total)}</b><span>de ${fmt(totalCasal)} do casal</span></div>
    <div class="meter-orc grande ok"><span style="width:${pct}%"></span></div>
    <div class="ro-rodape"><span>${pct}% dos gastos do casal</span><span>${gastos.length} lançamento${gastos.length !== 1 ? "s" : ""}</span></div>`;
  const porCat = {}, porCatCasal = {};
  gastos.forEach((g) => (porCat[g.categoria] = (porCat[g.categoria] || 0) + Number(g.valor)));
  doCasal.forEach((g) => (porCatCasal[g.categoria] = (porCatCasal[g.categoria] || 0) + Number(g.valor)));
  const linhas = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
  $("#lista-orc").innerHTML = linhas.length ? linhas.map(([cat, v]) => {
    const c = porCatCasal[cat] || v, p = Math.round((v / c) * 100);
    return `
    <li>
      <button class="orc-item" data-filtrar-cat="${esc(cat)}">
        <span class="bola-cat">${svg(iconeDe(cat))}</span>
        <div class="orc-meio">
          <div class="orc-linha"><span class="nome">${esc(cat)}</span><span class="valor">${fmt(v)}</span></div>
          <div class="meter-orc ok"><span style="width:${p}%"></span></div>
          <div class="orc-linha orc-st"><span class="ok">${p}% do gasto do casal aqui</span><span class="neutro">casal ${fmt(c)}</span></div>
        </div>
      </button>
    </li>`;
  }).join("") : vazio("carrinho", `${esc(pessoa)} não lançou gastos neste mês`, "Os gastos marcados como “Casal” aparecem só em Todos.");
}

// ---------- Crédito: o que vai para a fatura (pago depois) ----------
/** Valor que uma compra no cartão põe na 1ª fatura (a 1ª parcela, se for parcelada). */
const primeiraParcela = (g) => { const n = Math.max(1, Number(g.parcelas) || 1); return n === 1 ? Number(g.valor) : Math.floor((Number(g.valor) / n) * 100) / 100; };

/** Compras no crédito agrupadas pela fatura em que entram: { cartao, comp, valor, compras, parcelado } */
function creditoPorFatura(gastos) {
  const grupos = new Map();
  gastos.filter((g) => g.cartao_id).forEach((g) => {
    const c = estado.cartoes.find((x) => x.id === g.cartao_id); if (!c) return;
    const comp = competenciaFatura(c, g.data), k = c.id + "|" + comp;
    const gr = grupos.get(k) || { cartao: c, comp, valor: 0, compras: 0, futuro: 0 };
    const p1 = primeiraParcela(g);
    gr.valor += p1; gr.futuro += Number(g.valor) - p1; gr.compras++;
    grupos.set(k, gr);
  });
  return [...grupos.values()].sort((a, b) => a.comp.localeCompare(b.comp) || a.cartao.nome.localeCompare(b.cartao.nome));
}

/** Bloco em Gastos: quanto já saiu da conta (Pix/débito) e quanto vai ser pago nas faturas. */
function renderCredito(gastos) {
  const el = $("#credito-mes"); if (!el) return;
  if (!estado.migracao3 || !gastos.length) { el.hidden = true; el.innerHTML = ""; return; }
  el.hidden = false;
  const ativos = estado.cartoes.filter((c) => c.ativo);
  const semCartao = gastos.filter((g) => !ehCredito(g));
  const credSemCartao = gastos.filter((g) => ehCredito(g) && !g.cartao_id);
  const noCredito = soma(gastos.filter(ehCredito), (g) => g.valor), naHora = soma(semCartao, (g) => g.valor);
  if (!ativos.length && !credSemCartao.length) {
    el.innerHTML = `
      <div class="cm-topo"><span class="bola-cat">${svg("cartao")}</span><div><b>Algum gasto foi no cartão de crédito?</b>
      <small>Cadastre o cartão e mova esses gastos para ele: o Plinc mostra o que vai para a fatura do mês que vem, para vocês darem baixa quando pagarem.</small></div></div>
      <div class="cm-botoes"><button class="btn btn-primary" data-acao="novo-cartao">Cadastrar cartão</button></div>`;
    return;
  }
  const grupos = creditoPorFatura(gastos);
  el.innerHTML = `
    <div class="cm-divisao">
      <button type="button" data-ver-pag="pagos"><small>Pix ou débito</small><b>${fmt(naHora)}</b><span>já saiu da conta</span></button>
      <button type="button" data-ver-pag="apagar"><small>No crédito</small><b>${fmt(noCredito)}</b><span>pago na fatura ›</span></button>
    </div>
    ${grupos.length ? `<ul class="cm-faturas">${grupos.map((g) => {
      const st = statusFatura(g.cartao, g.comp), dt = datasFatura(g.cartao, g.comp);
      return `<li><button class="cm-fatura" data-abrir-fatura="${g.cartao.id}" data-comp="${g.comp}">
        <span class="bola-cat">${svg("cartao")}</span>
        <div><div class="nome">Fatura de ${esc(nomeMes(g.comp, "mes"))}</div>
        <div class="meta">${esc(g.cartao.nome)} · vence ${esc(fmtData(dt.vencimento))} · ${g.compras} compra${g.compras > 1 ? "s" : ""}${g.futuro > 0.004 ? ` · +${fmt(g.futuro)} em parcelas futuras` : ""}</div></div>
        <div class="dir"><span class="valor">${fmt(g.valor)}</span><span class="badge ${st.cls}">${st.chave === "paga" ? "✓ Paga" : "A pagar"}</span></div>
      </button></li>`;
    }).join("")}</ul>` : ""}
    ${credSemCartao.length ? (() => { const comp = mesPagamentoCredito(credSemCartao[0]); return `<ul class="cm-faturas"><li><button class="cm-fatura" data-ver-pag="apagar">
        <span class="bola-cat">${svg("cartao")}</span>
        <div><div class="nome">Crédito · paga em ${esc(nomeMes(comp, "mes").toLowerCase())}</div>
        <div class="meta">${credSemCartao.length} compra${credSemCartao.length > 1 ? "s" : ""} no crédito</div></div>
        <div class="dir"><span class="valor">${fmt(soma(credSemCartao, (g) => g.valor))}</span><span class="badge futura">A pagar</span></div>
      </button></li></ul>`; })() : ""}
    ${semCartao.length && ativos.length ? `<button class="btn-link cm-mover" data-acao="mover-cartao">Algum gasto foi no crédito? Mover para o cartão</button>` : ""}`;
}

// ---------- Mover gastos para o cartão ----------
function abrirMoverCartao() {
  const cartoes = estado.cartoes.filter((c) => c.ativo);
  if (!cartoes.length) return abrirCartao();
  const lista = gastosFiltrados().filter((g) => !g.cartao_id).sort((a, b) => b.data.localeCompare(a.data));
  $("#mover-cartao-sel").innerHTML = cartoes.map((c) => `<option value="${c.id}">💳 ${esc(c.nome)} (${esc(c.responsavel)})</option>`).join("");
  $("#mover-cartao-lista").innerHTML = lista.length ? lista.map((g) => `
    <li><label class="mover-item"><input type="checkbox" value="${g.id}">
      <span class="bola-cat">${svg(iconeDe(g.categoria, g.descricao))}</span>
      <span class="mover-meio"><span class="nome">${esc(g.descricao)}</span><span class="meta">${esc(fmtData(g.data))} · ${esc(g.responsavel)}</span></span>
      <span class="valor">${fmt(g.valor)}</span></label></li>`).join("")
    : `<li class="muted pequeno">Nenhum gasto sem cartão neste mês.</li>`;
  atualizarMoverCartao();
  $("#modal-mover-cartao").showModal();
}
function atualizarMoverCartao() {
  const n = $$("#mover-cartao-lista input:checked").length;
  $("#btn-mover-cartao").textContent = n ? `Mover ${n} gasto${n > 1 ? "s" : ""}` : "Escolha os gastos";
  $("#btn-mover-cartao").disabled = !n;
}
async function confirmarMoverCartao() {
  const c = estado.cartoes.find((x) => x.id === $("#mover-cartao-sel").value); if (!c) return;
  const ids = $$("#mover-cartao-lista input:checked").map((i) => i.value);
  const alvos = ids.map((id) => estado.gastos.find((g) => g.id === id)).filter(Boolean);
  const antes = alvos.map((g) => ({ g, forma_pagamento: g.forma_pagamento }));
  try {
    for (const g of alvos) Object.assign(g, await db.atualizar("gastos", g.id, { cartao_id: c.id, forma_pagamento: "Cartão " + c.nome }));
    $("#modal-mover-cartao").close(); render();
    toast(`${alvos.length} gasto${alvos.length > 1 ? "s" : ""} no cartão ${c.nome}`, { rotulo: "Desfazer", acao: async () => {
      try { for (const a of antes) Object.assign(a.g, await db.atualizar("gastos", a.g.id, { cartao_id: null, forma_pagamento: a.forma_pagamento })); render(); toast("Desfeito"); } catch (e) { erro(e); }
    } });
  } catch (e) { erro(e); }
}

// ---------- Pago × a pagar (como em Contas) ----------
let filtroPagGasto = "todos";
const dataCurta = (d) => new Date(d + "T12:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

/** Pix/débito: pago na hora. Crédito: pago quando a fatura (de cada parcela) for marcada como paga.
 *  { pago, pendente (quanto falta), proxVenc (vencimento da próxima fatura em aberto), cartao, comp } */
/** Crédito = pago depois (na fatura do mês seguinte). Débito/Pix/dinheiro = já saiu da conta. */
const ehCredito = (g) => !!g.cartao_id || (/cr[eé]dito/i.test(g.forma_pagamento || "") && !/d[eé]bito/i.test(g.forma_pagamento || ""));
/** Crédito sem cartão cadastrado: compra de novembro é paga em dezembro (mês seguinte ao da compra). */
const mesPagamentoCredito = (g) => somaMes(g.data.slice(0, 8) + "01", 1);

function situacaoGasto(g) {
  const c = g.cartao_id && estado.cartoes.find((x) => x.id === g.cartao_id);
  if (!c && ehCredito(g)) {
    const comp = mesPagamentoCredito(g);
    // já passou o mês do pagamento → considera pago
    if (compDe(new Date()) > comp) return { pago: true, pendente: 0, credito: true };
    return { pago: false, pendente: Number(g.valor), cartao: null, credito: true, comp, proxVenc: null };
  }
  if (!c) return { pago: true, pendente: 0 };
  const n = Math.max(1, Number(g.parcelas) || 1), total = Number(g.valor);
  const parcela = Math.floor((total / n) * 100) / 100, comp0 = competenciaFatura(c, g.data);
  let pendente = 0, proxComp = null, abertas = 0;
  for (let k = 0; k < n; k++) {
    const comp = somaMes(comp0, k);
    if (faturaPaga(c, comp)) continue;
    pendente += k === n - 1 ? Math.round((total - parcela * (n - 1)) * 100) / 100 : parcela;
    abertas++; if (!proxComp) proxComp = comp;
  }
  pendente = Math.round(pendente * 100) / 100;
  if (pendente < 0.005) return { pago: true, pendente: 0, cartao: c };
  return { pago: false, pendente, cartao: c, comp: proxComp, proxVenc: datasFatura(c, proxComp).vencimento, parcelada: n > 1, abertas, n };
}

/** Selo de cada gasto no extrato. */
function seloGasto(s, g) {
  if (s.pago) return `<span class="badge paga">✓ Pago</span>`;
  if (!s.cartao) return `<span class="badge futura" title="Crédito: paga na fatura de ${esc(nomeMes(s.comp, "mes"))}">Paga em ${esc(nomeMes(s.comp, "curto").toLowerCase())}</span>`;
  const d = diasEntre(hojeISO(), s.proxVenc);
  const cls = d < 0 ? "atrasada" : d <= DIAS_ALERTA ? "breve" : "futura";
  return `<span class="badge ${cls}" title="Entra na fatura ${esc(s.cartao.nome)} de ${esc(nomeMes(s.comp, "mes"))}">${d < 0 ? "! Fatura vencida" : `Paga em ${dataCurta(s.proxVenc)}`}</span>`;
}

/** Resumo no topo do extrato: já pago × a pagar (e quando cada fatura vence). */
function renderResumoPagGastos(gastos) {
  const el = $("#resumo-pag-gastos"); if (!el) return;
  $("#filtro-pag-gastos").hidden = !gastos.length;
  if (!gastos.length) { el.hidden = true; el.innerHTML = ""; return; }
  el.hidden = false;
  const sit = gastos.map((g) => ({ g, s: situacaoGasto(g) }));
  const total = soma(gastos, (g) => g.valor);
  const aPagar = soma(sit, (x) => x.s.pendente), pago = Math.round((total - aPagar) * 100) / 100;
  const pct = total ? Math.round((pago / total) * 100) : 0;
  const pend = sit.filter((x) => !x.s.pago);
  // agrupa o que falta pagar pela fatura (cartão + vencimento)
  const porFatura = new Map();
  pend.forEach(({ s }) => { const k = (s.cartao ? s.cartao.id : "credito") + "|" + s.comp; const f = porFatura.get(k) || { cartao: s.cartao, comp: s.comp, venc: s.proxVenc || s.comp, valor: 0 }; f.valor += s.pendente; porFatura.set(k, f); });
  const fats = [...porFatura.values()].sort((a, b) => a.venc.localeCompare(b.venc));
  const quando = (f) => f.cartao ? `${fats.length > 1 ? "próxima fatura" : "fatura"} vence ${dataCurta(f.venc)}` : `paga em ${nomeMes(f.comp, "mes").toLowerCase()}`;
  const prox = fats[0];
  el.innerHTML = `
    <div class="rc-topo"><div><small>Gastos de ${esc(nomeMes(estado.mes, "mes"))}</small><b>${fmt(total)}</b></div><span class="rc-pct">${pct}%<small>pago</small></span></div>
    <div class="meter-orc grande ${pct === 100 ? "bom" : "ok"}"><span style="width:${pct}%"></span></div>
    <div class="rc-duas">
      <button type="button" data-filtro-pag="pagos"><small>Já pago</small><b class="bom-txt">${fmt(pago)}</b><em>já saiu da conta</em></button>
      <button type="button" data-filtro-pag="apagar"><small>A pagar</small><b>${fmt(aPagar)}</b><em>${prox ? quando(prox) : "nada no crédito em aberto ✓"}</em></button>
    </div>
    ${fats.length ? `<ul class="rpg-faturas">${fats.map((f) => f.cartao ? `<li><button type="button" data-abrir-fatura="${f.cartao.id}" data-comp="${f.comp}">
      <span>${svg("cartao")} ${esc(f.cartao.nome)} · fatura de ${esc(nomeMes(f.comp, "mes").toLowerCase())}</span><b>${fmt(f.valor)} <small>em ${dataCurta(f.venc)}</small></b></button></li>`
      : `<li><button type="button" data-filtro-pag="apagar"><span>${svg("cartao")} Crédito · fatura de ${esc(nomeMes(f.comp, "mes").toLowerCase())}</span><b>${fmt(f.valor)} <small>em ${esc(nomeMes(f.comp, "curto").toLowerCase())}</small></b></button></li>`).join("")}</ul>` : ""}`;
}

let filtroCatGasto = null;
/** No extrato: compra no cartão mostra em qual fatura entra. */
function metaPagamento(g) {
  const c = g.cartao_id && estado.cartoes.find((x) => x.id === g.cartao_id);
  if (c) return ` · <span class="tag-fatura">💳 ${esc(c.nome)} · fatura ${esc(nomeMes(competenciaFatura(c, g.data), "curto").toLowerCase())}</span>`;
  return g.forma_pagamento ? " · " + esc(g.forma_pagamento) : "";
}
function renderExtrato(gastos) {
  renderResumoPagGastos(gastos);
  $$("#filtro-pag-gastos button").forEach((b) => b.classList.toggle("ativo", b.dataset.fp === filtroPagGasto));
  const sit = new Map(gastos.map((g) => [g.id, situacaoGasto(g)]));
  const lista = (filtroCatGasto ? gastos.filter((g) => g.categoria === filtroCatGasto) : gastos)
    .filter((g) => filtroPagGasto === "todos" || (filtroPagGasto === "pagos" ? sit.get(g.id).pago : !sit.get(g.id).pago))
    .slice().sort((a, b) => b.data.localeCompare(a.data) || String(b.created_at || "").localeCompare(String(a.created_at || "")));
  const hoje = hojeISO();
  const ontem = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; })();
  const rotuloDia = (d) => d === hoje ? "Hoje" : d === ontem ? "Ontem"
    : (() => { const t = new Date(d + "T12:00").toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, ""); return t.charAt(0).toUpperCase() + t.slice(1); })();
  const porDia = (itens) => { const gs = []; itens.forEach((g) => { const u = gs[gs.length - 1]; if (u && u.dia === g.data) u.itens.push(g); else gs.push({ dia: g.data, itens: [g] }); }); return gs; };
  const filtro = filtroCatGasto ? `<div class="filtro-ativo">Mostrando <b>${esc(filtroCatGasto)}</b> · ${fmt(soma(lista, (g) => g.valor))}<button data-limpar-filtro aria-label="Limpar filtro">✕</button></div>` : "";
  // Separa em duas seções: Crédito (paga depois) e Débito/Pix (já pago)
  const cred = lista.filter(ehCredito), deb = lista.filter((g) => !ehCredito(g));
  const credAberto = cred.filter((g) => !sit.get(g.id).pago);
  const compCred = credAberto.length ? sit.get(credAberto[0].id).comp : null;
  const secoes = [
    cred.length && { titulo: "💳 Crédito", sub: credAberto.length ? `paga em ${nomeMes(compCred, "mes").toLowerCase()}` : "fatura paga", itens: cred, cls: "credito" },
    deb.length && { titulo: "✓ Débito / Pix", sub: "já pago", itens: deb, cls: "debito" }
  ].filter(Boolean);
  const grupos = secoes.flatMap((sec) => porDia(sec.itens).map((gr, i) => ({ ...gr, sec: i === 0 ? sec : null })));
  $("#extrato").innerHTML = filtro + (grupos.length ? grupos.map((gr) => `
    ${gr.sec ? `<div class="secao-extrato ${gr.sec.cls}"><span><b>${gr.sec.titulo}</b> · ${esc(gr.sec.sub)}</span><b>${fmt(soma(gr.sec.itens, (g) => g.valor))}</b></div>` : ""}
    <div class="dia-extrato"><span>${esc(rotuloDia(gr.dia))}</span><span>${fmt(soma(gr.itens, (g) => g.valor))}</span></div>
    <article class="card card-lista"><ul class="lista-cadastro">${gr.itens.map((g) => `
      <li class="swipe" data-swipe="gasto" data-id="${g.id}">${ACAO_EXCLUIR()}<button class="item" data-editar-gasto="${g.id}">
        <span class="bola-cat">${svg(iconeDe(g.categoria, g.descricao))}</span>
        <div><div class="nome">${esc(g.descricao)}</div><div class="meta">${esc(g.categoria)} · ${esc(g.responsavel)}${metaPagamento(g)}${g.parcelas > 1 ? ` · ${g.parcelas}x` : ""}</div></div>
        <span class="dir"><span class="valor">−${fmt(g.valor)}</span>${seloGasto(sit.get(g.id), g)}</span><span class="seta">›</span>
      </button></li>`).join("")}</ul></article>`).join("") + `<p class="dica">Arraste um gasto para a esquerda para excluir.</p>`
    : gastos.length && filtroPagGasto === "apagar" ? `<article class="card card-lista"><ul class="lista-cadastro">${vazio("festa", "Nada a pagar", "Tudo o que foi gasto neste mês já saiu da conta ou está em fatura paga.")}</ul></article>`
    : gastos.length && filtroPagGasto === "pagos" ? `<article class="card card-lista"><ul class="lista-cadastro">${vazio("cartao", "Nada pago ainda", "Os gastos deste mês estão no crédito: viram “pagos” quando a fatura for marcada como paga.")}</ul></article>`
    : `<article class="card card-lista"><ul class="lista-cadastro">${vazio("carrinho", "Nenhum gasto neste mês", "Registre mercado, delivery, lazer… e acompanhe o limite de cada categoria.", ["novo-gasto", "Registrar gasto"])}</ul></article>`);
}

function renderCadastroOrcamentos() {
  const el = $("#cad-orcamentos");
  if (!estado.migracao2) { el.innerHTML = vazio("carrinho", "Falta um passo no banco", "Rode supabase/migracao-02-gastos.sql no Supabase para usar orçamentos."); return; }
  const orcs = [...estado.orcamentos].sort((a, b) => (b.ativa - a.ativa) || a.categoria.localeCompare(b.categoria));
  el.innerHTML = orcs.length ? orcs.map((o) => `
    <li class="${o.ativa ? "" : "inativa"}">
      <button class="item" data-editar-orcamento="${o.id}">
        <span class="bola-cat">${svg(iconeDe(o.categoria))}</span>
        <div><div class="nome">${esc(o.categoria)}${o.ativa ? "" : ' <span class="badge inativa">Arquivada</span>'}</div><div class="meta">Limite mensal</div></div>
        <span class="valor">${fmt(o.limite)}</span><span class="seta">›</span>
      </button>
    </li>`).join("") + `<li class="total"><span>Total planejado por mês</span><span>${fmt(soma(orcs.filter((o) => o.ativa), (o) => o.limite))}</span></li>`
    : vazio("carrinho", "Nenhuma categoria de gasto", `Ex.: Mercado ${fmt(1200)}, Lazer ${fmt(300)}.`, ["novo-orcamento", "Nova categoria"]);
}
