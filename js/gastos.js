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

let filtroCatGasto = null;
function renderExtrato(gastos) {
  const lista = (filtroCatGasto ? gastos.filter((g) => g.categoria === filtroCatGasto) : gastos)
    .slice().sort((a, b) => b.data.localeCompare(a.data) || String(b.created_at || "").localeCompare(String(a.created_at || "")));
  const hoje = hojeISO();
  const ontem = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; })();
  const rotuloDia = (d) => d === hoje ? "Hoje" : d === ontem ? "Ontem"
    : (() => { const t = new Date(d + "T12:00").toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, ""); return t.charAt(0).toUpperCase() + t.slice(1); })();
  const grupos = [];
  lista.forEach((g) => { const u = grupos[grupos.length - 1]; if (u && u.dia === g.data) u.itens.push(g); else grupos.push({ dia: g.data, itens: [g] }); });
  const filtro = filtroCatGasto ? `<div class="filtro-ativo">Mostrando <b>${esc(filtroCatGasto)}</b> · ${fmt(soma(lista, (g) => g.valor))}<button data-limpar-filtro aria-label="Limpar filtro">✕</button></div>` : "";
  $("#extrato").innerHTML = filtro + (grupos.length ? grupos.map((gr) => `
    <div class="dia-extrato"><span>${esc(rotuloDia(gr.dia))}</span><span>${fmt(soma(gr.itens, (g) => g.valor))}</span></div>
    <article class="card card-lista"><ul class="lista-cadastro">${gr.itens.map((g) => `
      <li class="swipe" data-swipe="gasto" data-id="${g.id}">${ACAO_EXCLUIR()}<button class="item" data-editar-gasto="${g.id}">
        <span class="bola-cat">${svg(iconeDe(g.categoria, g.descricao))}</span>
        <div><div class="nome">${esc(g.descricao)}</div><div class="meta">${esc(g.categoria)} · ${esc(g.responsavel)}${g.forma_pagamento ? " · " + esc(g.forma_pagamento) : ""}${g.parcelas > 1 ? ` · ${g.parcelas}x` : ""}</div></div>
        <span class="valor">−${fmt(g.valor)}</span><span class="seta">›</span>
      </button></li>`).join("")}</ul></article>`).join("") + `<p class="dica">Arraste um gasto para a esquerda para excluir.</p>`
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
    : vazio("carrinho", "Nenhuma categoria de gasto", "Ex.: Mercado R$ 1.200, Lazer R$ 300.", ["novo-orcamento", "Nova categoria"]);
}
