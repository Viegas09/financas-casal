/* Finanças do Casal — Ações: pagar, formulários de conta, renda, gasto, orçamento, meta, aporte, cartão, exportar. */
"use strict";

// ================================================================
// AÇÕES
// ================================================================
async function alternarPagamento(contaId) {
  const conta = estado.contas.find((c) => c.id === contaId);
  const pg = pagamentoDe(contaId, estado.mes);
  try {
    if (pg) {
      await db.remover("pagamentos", pg.id);
      estado.pagamentos = estado.pagamentos.filter((p) => p.id !== pg.id);
      render();
      toast(`${conta.nome}: pagamento desmarcado`, { rotulo: "Desfazer", acao: () => restaurarPagamento(pg) });
    } else if (conta.variavel) {
      abrirPagar(conta);
    } else {
      await registrarPagamento(conta, Number(conta.valor), hojeISO());
    }
  } catch (e) { erro(e); }
}

async function registrarPagamento(conta, valor, pagoEm) {
  const novo = await db.inserir("pagamentos", {
    conta_id: conta.id, competencia: estado.mes, valor_pago: valor,
    pago_em: pagoEm, pago_por: estado.usuario.nome.replace(" (demo)", "")
  });
  estado.pagamentos.push(novo);
  render();
  animarPago(conta.id);
  toast(`${conta.nome} paga · ${fmt(valor)}`, { rotulo: "Desfazer", acao: () => removerPagamento(novo) });
}

let pagandoConta = null;
function abrirPagar(conta) {
  pagandoConta = conta;
  const f = $("#form-pagar");
  const prev = previsaoVariavel(conta, estado.mes);
  $("#titulo-modal-pagar").textContent = `Quanto veio ${conta.nome}?`;
  const ult = estado.pagamentos.filter((p) => p.conta_id === conta.id && p.competencia < estado.mes).sort((a, b) => b.competencia.localeCompare(a.competencia))[0];
  $("#dica-pagar").textContent = ult ? `Mês passado: ${brl.format(ult.valor_pago)} · média recente: ${brl.format(prev)}` : `Valor cadastrado: ${brl.format(conta.valor)}`;
  f.elements.valor.value = paraCampo(prev);
  f.elements.pago_em.value = hojeISO();
  $("#modal-pagar").showModal();
  setTimeout(() => { f.elements.valor.focus(); f.elements.valor.select(); }, 250);
}

async function confirmarPagar(ev) {
  ev.preventDefault();
  const f = ev.target.elements;
  const valor = parseValor(f.valor.value);
  if (Number.isNaN(valor)) return toast("Valor inválido");
  try { $("#modal-pagar").close(); await registrarPagamento(pagandoConta, valor, f.pago_em.value); } catch (e) { erro(e); }
}

async function removerPagamento(pg) {
  try {
    await db.remover("pagamentos", pg.id);
    estado.pagamentos = estado.pagamentos.filter((p) => p.id !== pg.id);
    render(); toast("Desfeito");
  } catch (e) { erro(e); }
}

async function restaurarPagamento(pg) {
  try {
    const { conta_id, competencia, valor_pago, pago_em, pago_por } = pg;
    estado.pagamentos.push(await db.inserir("pagamentos", { conta_id, competencia, valor_pago, pago_em, pago_por }));
    render(); toast("Desfeito");
  } catch (e) { erro(e); }
}

function animarPago(contaId) {
  $$(`[data-pagar="${contaId}"]`).forEach((b) => { b.classList.add("pop"); b.closest("li")?.classList.add("brilho"); });
  if (navigator.vibrate) try { navigator.vibrate(12); } catch {}
}

// ----- Modal conta -----
let editandoConta = null;
const FORMAS_CONTA = ["Pix", "Boleto", "Débito automático", "Dinheiro", "Cartão de crédito"];
function abrirConta(id, prefill = {}) {
  const f = $("#form-conta");
  f.reset();
  f.querySelector(".mais-opcoes").open = false;
  editandoConta = id ? estado.contas.find((c) => c.id === id) : null;
  $("#titulo-modal-conta").textContent = editandoConta ? "Editar conta" : "Nova conta";
  $("#explica-conta").hidden = !!editandoConta || !estado.migracao2;
  const c = editandoConta || { ativa: true, responsavel: RESP_PADRAO(), inicio: estado.mes, ...prefill };
  f.elements.nome.value = c.nome || "";
  f.elements.dia_vencimento.value = c.dia_vencimento || "";
  f.elements.observacao.value = c.observacao || "";
  f.elements.valor.value = paraCampo(c.valor);
  if (c.responsavel && !RESPONSAVEIS.includes(c.responsavel)) $("#sel-responsavel-conta").insertAdjacentHTML("beforeend", `<option>${esc(c.responsavel)}</option>`);
  f.elements.responsavel.value = c.responsavel || RESP_PADRAO();
  f.elements.inicio.value = (c.inicio || estado.mes).slice(0, 7);
  f.elements.ativa.checked = c.ativa !== false;
  // valor muda?
  definirTipoConta(editandoConta ? (c.fim ? "unico" : c.variavel ? "variavel" : "fixo") : prefill.tipo || "");
  $('#tipos-conta [data-t="variavel"]').hidden = !estado.migracao2;
  // categoria
  const cats = [...new Set([...(CFG.CATEGORIAS || []), ...estado.contas.map((x) => x.categoria)].filter(Boolean))];
  if (c.categoria && !cats.includes(c.categoria)) cats.push(c.categoria);
  $("#sel-cat-conta").innerHTML = `<option value="" disabled ${c.categoria ? "" : "selected"}>Escolha…</option>` + cats.map((x) => `<option>${esc(x)}</option>`).join("") + `<option value="__outra">+ Outra categoria…</option>`;
  $("#sel-cat-conta").value = c.categoria || "";
  $("#lbl-cat-outra").hidden = true;
  f.elements.categoria_outra.required = false;
  // como paga (inclui os cartões)
  const cartoes = estado.migracao3 ? estado.cartoes.filter((x) => x.ativo || x.id === c.cartao_id) : [];
  const formas = FORMAS_CONTA.filter((x) => !(cartoes.length && x === "Cartão de crédito"));
  if (c.forma_pagamento && !c.cartao_id && !formas.includes(c.forma_pagamento)) formas.push(c.forma_pagamento);
  $("#sel-forma-conta").innerHTML = `<option value="">Não sei / tanto faz</option>` + formas.map((x) => `<option>${esc(x)}</option>`).join("") +
    (cartoes.length ? `<optgroup label="Cartão de crédito">${cartoes.map((x) => `<option value="cartao:${x.id}">💳 ${esc(x.nome)}</option>`).join("")}</optgroup>` : "");
  $("#sel-forma-conta").value = c.cartao_id ? "cartao:" + c.cartao_id : c.forma_pagamento || "";
  caixaEncerrar(f, {
    editando: !!editandoConta, ativo: c.ativa !== false, campo: "ativa", excluir: "#btn-excluir-conta",
    pergunta: "Parou de pagar esta conta? (ex.: cancelou a assinatura)", encerrar: "Encerrar conta",
    encerrada: "Esta conta está encerrada: não aparece mais nos meses seguintes. O histórico fica guardado.", reativar: "Voltar a cobrar",
    erro: "Cadastrou errado?"
  });
  $("#modal-conta").showModal();
}

const DICAS_TIPO = {
  fixo: "Aparece todo mês com o mesmo valor, até vocês encerrarem a conta.",
  variavel: "Aparece todo mês. Ao marcar como paga, o app pergunta quanto veio. Nos meses seguintes fica “a definir” e não entra no total até ser paga.",
  unico: "Aparece só no mês que está aberto no app e não se repete."
};
function definirTipoConta(t) {
  const f = $("#form-conta");
  f.elements.tipo.value = t;
  f.elements.variavel.checked = t === "variavel";
  $$("#tipos-conta [data-t]").forEach((x) => { x.classList.toggle("ativo", x.dataset.t === t); x.setAttribute("aria-checked", x.dataset.t === t); });
  $("#tipos-conta").classList.remove("erro");
  let dica = DICAS_TIPO[t] || "";
  if (t === "unico") dica = `Aparece só em ${nomeMes((f.elements.inicio.value || estado.mes.slice(0, 7)) + "-01")} e não se repete.` + (estado.migracao4 ? "" : " ⚠ Para usar, rode supabase/migracao-04-conta-unica.sql no Supabase.");
  $("#dica-tipo").textContent = dica;
  $("#dica-tipo").hidden = !dica;
}

async function salvarConta(ev) {
  ev.preventDefault();
  const f = ev.target.elements;
  const tipo = f.tipo.value;
  if (!tipo) {
    const tc = $("#tipos-conta"); tc.classList.remove("erro"); void tc.offsetWidth; tc.classList.add("erro");
    tc.scrollIntoView({ block: "center", behavior: "smooth" });
    return toast("Escolha como é essa conta");
  }
  if (tipo === "unico" && !estado.migracao4) return toast("Para “Só neste mês”, rode a migração 04 no Supabase");
  const catSel = f.categoria_sel.value;
  const categoria = catSel === "__outra" ? f.categoria_outra.value.trim() : catSel;
  if (!categoria) return toast("Escolha uma categoria");
  const forma = f.forma.value;
  const cartao = forma.startsWith("cartao:") ? estado.cartoes.find((x) => x.id === forma.slice(7)) : null;
  const dados = {
    nome: f.nome.value.trim(), valor: parseValor(f.valor.value), dia_vencimento: Number(f.dia_vencimento.value),
    categoria, responsavel: f.responsavel.value,
    forma_pagamento: cartao ? "Cartão " + cartao.nome : forma || null, observacao: f.observacao.value.trim() || null,
    inicio: (f.inicio.value || estado.mes.slice(0, 7)) + "-01", ativa: f.ativa.checked
  };
  if (estado.migracao2) dados.variavel = tipo === "variavel";
  if (estado.migracao4) dados.fim = tipo === "unico" ? dados.inicio : null;
  if (estado.migracao3) dados.cartao_id = cartao ? cartao.id : null;
  if (Number.isNaN(dados.valor)) return toast("Valor inválido");
  try {
    const eraAtiva = editandoConta ? editandoConta.ativa : true;
    if (editandoConta) Object.assign(editandoConta, await db.atualizar("contas", editandoConta.id, dados));
    else estado.contas.push(await db.inserir("contas", dados));
    $("#modal-conta").close();
    toast(eraAtiva && !dados.ativa ? "Conta encerrada" : !eraAtiva && dados.ativa ? "Conta reativada" : "Conta salva");
    render();
    if ($("#modal-fatura").open) desenharFatura();
  } catch (e) { erro(e); }
}

/** Caixa no fim do formulário: "Parou de pagar? [Encerrar]" e "Cadastrou errado? [Excluir]" (só ao editar). */
function caixaEncerrar(form, o) {
  const box = form.querySelector("[data-encerrar]");
  const btnExcluir = $(o.excluir);
  btnExcluir.hidden = !o.editando;
  box.hidden = !o.editando;
  if (!o.editando) { form.appendChild(btnExcluir); return; }
  box.innerHTML = `
    <div class="be-linha"><span>${esc(o.ativo ? o.pergunta : o.encerrada)}</span>
      <button type="button" class="btn ${o.ativo ? "btn-ghost" : "btn-primary"}" data-alternar-ativo>${esc(o.ativo ? o.encerrar : o.reativar)}</button></div>
    <div class="be-linha"><span>${esc(o.erro)}</span><span data-slot-excluir></span></div>`;
  box.querySelector("[data-slot-excluir]").appendChild(btnExcluir);
  btnExcluir.textContent = "Excluir de vez";
  box.querySelector("[data-alternar-ativo]").onclick = () => {
    form.elements[o.campo].checked = !o.ativo;
    form.requestSubmit();
  };
}

async function excluirConta() {
  if (!editandoConta) return;
  if (!confirm(`Excluir “${editandoConta.nome}” e todo o histórico de pagamentos dela?\n\nSe você só parou de pagar, use “Encerrar conta”: ela some dos próximos meses e o histórico fica guardado.`)) return;
  try {
    await db.remover("contas", editandoConta.id);
    estado.contas = estado.contas.filter((c) => c.id !== editandoConta.id);
    estado.pagamentos = estado.pagamentos.filter((p) => p.conta_id !== editandoConta.id);
    if (DEMO) { demoDB().pagamentos = demoDB().pagamentos.filter((p) => p.conta_id !== editandoConta.id); demoStore.gravar(demoDB()); }
    $("#modal-conta").close();
    toast("Conta excluída");
    render();
  } catch (e) { erro(e); }
}

// ----- Modal renda -----
let editandoRenda = null;
function abrirRenda(id) {
  const f = $("#form-renda");
  f.reset();
  editandoRenda = id ? estado.rendas.find((r) => r.id === id) : null;
  $("#titulo-modal-renda").textContent = editandoRenda ? "Editar renda" : "Nova renda";

  const r = editandoRenda || { ativa: true, responsavel: PESSOAS[0] };
  f.elements.descricao.value = r.descricao || "";
  f.elements.valor.value = paraCampo(r.valor);
  f.elements.responsavel.value = r.responsavel;
  f.elements.ativa.checked = r.ativa !== false;
  caixaEncerrar(f, { editando: !!editandoRenda, ativo: r.ativa !== false, campo: "ativa", excluir: "#btn-excluir-renda",
    pergunta: "Parou de receber essa renda?", encerrar: "Encerrar renda",
    encerrada: "Esta renda está encerrada e não entra nas contas do mês.", reativar: "Voltar a contar", erro: "Cadastrou errado?" });
  $("#modal-renda").showModal();
}

async function salvarRenda(ev) {
  ev.preventDefault();
  const f = ev.target.elements;
  const dados = { descricao: f.descricao.value.trim(), valor: parseValor(f.valor.value), responsavel: f.responsavel.value, ativa: f.ativa.checked };
  if (Number.isNaN(dados.valor)) return toast("Valor inválido");
  try {
    if (editandoRenda) Object.assign(editandoRenda, await db.atualizar("rendas", editandoRenda.id, dados));
    else estado.rendas.push(await db.inserir("rendas", dados));
    $("#modal-renda").close();
    toast("Renda salva");
    render();
  } catch (e) { erro(e); }
}

async function excluirRenda() {
  if (!editandoRenda || !confirm(`Excluir a renda “${editandoRenda.descricao}”?`)) return;
  try {
    await db.remover("rendas", editandoRenda.id);
    estado.rendas = estado.rendas.filter((r) => r.id !== editandoRenda.id);
    $("#modal-renda").close();
    render();
  } catch (e) { erro(e); }
}

// ----- Modal gasto -----
let editandoGasto = null;
function chipsCategorias(atual) {
  const cats = estado.orcamentos.filter((o) => o.ativa).map((o) => o.categoria);
  if (atual && !cats.includes(atual)) cats.push(atual);
  if (!cats.includes("Outros")) cats.push("Outros");
  $("#chips-cat").innerHTML = cats.map((c) => `<button type="button" class="chip-cat ${c === atual ? "ativo" : ""}" data-cat="${esc(c)}">${svg(iconeDe(c))}<span>${esc(c)}</span></button>`).join("");
}
function abrirGasto(id, prefill = {}) {
  if (!estado.migracao2) { irPara("gastos"); return toast("Rode a migração 02 no Supabase primeiro"); }
  const f = $("#form-gasto");
  f.reset();
  editandoGasto = id ? estado.gastos.find((g) => g.id === id) : null;
  $("#titulo-modal-gasto").textContent = editandoGasto ? "Editar gasto" : "Novo gasto";
  $("#btn-excluir-gasto").hidden = !editandoGasto;
  $("#explica-gasto").hidden = !!editandoGasto;
  const g = editandoGasto || { data: estado.mes === compDe(new Date()) ? hojeISO() : estado.mes.slice(0, 8) + "01", responsavel: estado.usuario.nome.replace(" (demo)", ""), categoria: filtroCatGasto || "", ...prefill };
  f.elements.valor.value = paraCampo(g.valor);
  f.elements.descricao.value = g.descricao || "";
  f.elements.data.value = g.data;
  f.elements.responsavel.value = RESPONSAVEIS.includes(g.responsavel) ? g.responsavel : PESSOAS[0];
  preencherFormas(g);
  f.elements.categoria.value = g.categoria || "";
  chipsCategorias(g.categoria);
  $("#modal-gasto").showModal();
  if (!editandoGasto) setTimeout(() => f.elements.valor.focus(), 250);
}

const FORMAS = ["Pix", "Débito", "Dinheiro", "Boleto", "Cartão de crédito"];
function preencherFormas(g) {
  const cartoes = estado.migracao3 ? estado.cartoes.filter((c) => c.ativo || c.id === g.cartao_id) : [];
  const formas = FORMAS.filter((x) => !(cartoes.length && x === "Cartão de crédito"));
  if (g.forma_pagamento && !g.cartao_id && !formas.includes(g.forma_pagamento)) formas.push(g.forma_pagamento);
  $("#sel-forma-gasto").innerHTML = `<option value="">—</option>` + formas.map((x) => `<option>${esc(x)}</option>`).join("") +
    (cartoes.length ? `<optgroup label="Cartão de crédito">${cartoes.map((c) => `<option value="cartao:${c.id}">💳 ${esc(c.nome)}</option>`).join("")}</optgroup>` : "");
  $("#sel-forma-gasto").value = g.cartao_id ? "cartao:" + g.cartao_id : g.forma_pagamento || "";
  $("#sel-parcelas").innerHTML = Array.from({ length: 24 }, (_, i) => `<option value="${i + 1}">${i ? i + 1 + "x" : "À vista"}</option>`).join("");
  $("#sel-parcelas").value = String(g.parcelas || 1);
  $("#lbl-parcelas").hidden = !String($("#sel-forma-gasto").value).startsWith("cartao:");
}

async function salvarGasto(ev) {
  ev.preventDefault();
  const f = ev.target.elements;
  const forma = f.forma.value;
  const cartao = forma.startsWith("cartao:") ? estado.cartoes.find((c) => c.id === forma.slice(7)) : null;
  const dados = {
    valor: parseValor(f.valor.value), descricao: f.descricao.value.trim(), categoria: f.categoria.value,
    data: f.data.value, responsavel: f.responsavel.value, forma_pagamento: cartao ? "Cartão " + cartao.nome : forma || null
  };
  if (estado.migracao3) { dados.cartao_id = cartao ? cartao.id : null; dados.parcelas = cartao ? Number(f.parcelas.value) || 1 : 1; }
  if (Number.isNaN(dados.valor) || !dados.valor) return toast("Informe o valor");
  if (!dados.categoria) {
    const ch = $("#chips-cat"); ch.classList.remove("erro"); void ch.offsetWidth; ch.classList.add("erro");
    ch.scrollIntoView({ block: "center", behavior: "smooth" });
    return toast("Escolha uma categoria (toque numa das opções)");
  }
  try {
    if (editandoGasto) Object.assign(editandoGasto, await db.atualizar("gastos", editandoGasto.id, dados));
    else estado.gastos.push(await db.inserir("gastos", dados));
    $("#modal-gasto").close();
    render();
    const l = linhasOrcamento().find((x) => x.categoria === dados.categoria);
    if (l && l.limite && l.gasto > l.limite) toast(`⚠ ${dados.categoria} passou do limite em ${fmt(l.gasto - l.limite)}`);
    else if (l && l.limite && l.gasto >= l.limite * 0.8) toast(`${dados.categoria}: restam ${fmt(l.limite - l.gasto)} no mês`);
    else toast(dados.parcelas > 1 ? `Gasto salvo · ${dados.parcelas}x de ${fmt(dados.valor / dados.parcelas)}` : "Gasto salvo");
    if ($("#modal-fatura").open) desenharFatura();
  } catch (e) { erro(e); }
}

async function excluirGasto() {
  if (!editandoGasto || !confirm(`Excluir o gasto “${editandoGasto.descricao}”?`)) return;
  $("#modal-gasto").close();
  await apagarGasto(editandoGasto);
}
async function apagarGasto(g) {
  try {
    await db.remover("gastos", g.id);
    estado.gastos = estado.gastos.filter((x) => x.id !== g.id);
    render();
    toast("Gasto excluído", { rotulo: "Desfazer", acao: async () => {
      const { id, created_at, created_by, ...resto } = g;
      estado.gastos.push(await db.inserir("gastos", resto)); render();
    } });
  } catch (e) { erro(e); }
}

// ----- Modal orçamento -----
let editandoOrc = null;
function abrirOrcamento(id) {
  if (!estado.migracao2) return toast("Rode a migração 02 no Supabase primeiro");
  const f = $("#form-orcamento");
  f.reset();
  editandoOrc = id ? estado.orcamentos.find((o) => o.id === id) : null;
  $("#titulo-modal-orcamento").textContent = editandoOrc ? "Editar categoria" : "Nova categoria de gasto";

  const o = editandoOrc || { ativa: true };
  f.elements.categoria.value = o.categoria || "";
  f.elements.limite.value = paraCampo(o.limite);
  f.elements.ativa.checked = o.ativa !== false;
  caixaEncerrar(f, { editando: !!editandoOrc, ativo: o.ativa !== false, campo: "ativa", excluir: "#btn-excluir-orcamento",
    pergunta: "Não quer mais acompanhar essa categoria?", encerrar: "Arquivar",
    encerrada: "Categoria arquivada: não aparece no orçamento.", reativar: "Reativar", erro: "Cadastrou errado?" });
  $("#modal-orcamento").showModal();
}

async function salvarOrcamento(ev) {
  ev.preventDefault();
  const f = ev.target.elements;
  const dados = { categoria: f.categoria.value.trim(), limite: parseValor(f.limite.value), ativa: f.ativa.checked };
  if (Number.isNaN(dados.limite)) return toast("Limite inválido");
  if (estado.orcamentos.some((o) => o.categoria.toLowerCase() === dados.categoria.toLowerCase() && o !== editandoOrc)) return toast("Essa categoria já existe");
  try {
    const antigo = editandoOrc?.categoria;
    if (editandoOrc) Object.assign(editandoOrc, await db.atualizar("orcamentos", editandoOrc.id, dados));
    else estado.orcamentos.push(await db.inserir("orcamentos", dados));
    // renomeou a categoria: leva os gastos junto
    if (antigo && antigo !== dados.categoria) {
      for (const g of estado.gastos.filter((x) => x.categoria === antigo)) Object.assign(g, await db.atualizar("gastos", g.id, { categoria: dados.categoria }));
    }
    $("#modal-orcamento").close();
    toast("Categoria salva");
    render();
  } catch (e) { erro(e); }
}

async function excluirOrcamento() {
  if (!editandoOrc || !confirm(`Excluir a categoria “${editandoOrc.categoria}”?\n\nOs gastos já lançados continuam, só sem limite.`)) return;
  try {
    await db.remover("orcamentos", editandoOrc.id);
    estado.orcamentos = estado.orcamentos.filter((o) => o.id !== editandoOrc.id);
    $("#modal-orcamento").close();
    render();
  } catch (e) { erro(e); }
}

// ----- Modal meta -----
let editandoMeta = null;
function abrirMeta(id) {
  if (!estado.migracao3) { irPara("metas"); return toast("Rode a migração 03 no Supabase primeiro"); }
  const f = $("#form-meta"); f.reset();
  editandoMeta = id ? estado.metas.find((m) => m.id === id) : null;
  $("#titulo-modal-meta").textContent = editandoMeta ? "Editar meta" : "Nova meta";

  const m = editandoMeta || { ativa: true };
  f.elements.nome.value = m.nome || "";
  f.elements.valor_alvo.value = paraCampo(m.valor_alvo);
  f.elements.prazo.value = m.prazo ? m.prazo.slice(0, 7) : "";
  f.elements.onde.value = m.onde || "";
  f.elements.ativa.checked = m.ativa !== false;
  caixaEncerrar(f, { editando: !!editandoMeta, ativo: m.ativa !== false, campo: "ativa", excluir: "#btn-excluir-meta",
    pergunta: "Pausou ou desistiu desta meta?", encerrar: "Arquivar meta",
    encerrada: "Meta arquivada: o que foi guardado continua contando.", reativar: "Reativar", erro: "Cadastrou errado?" });
  $("#modal-meta").showModal();
}
async function salvarMeta(ev) {
  ev.preventDefault();
  const f = ev.target.elements;
  const dados = { nome: f.nome.value.trim(), valor_alvo: parseValor(f.valor_alvo.value), prazo: f.prazo.value ? f.prazo.value + "-01" : null, onde: f.onde.value.trim() || null, ativa: f.ativa.checked };
  if (Number.isNaN(dados.valor_alvo) || !dados.valor_alvo) return toast("Informe quanto querem juntar");
  try {
    if (editandoMeta) Object.assign(editandoMeta, await db.atualizar("metas", editandoMeta.id, dados));
    else estado.metas.push(await db.inserir("metas", dados));
    $("#modal-meta").close();
    toast("Meta salva"); render();
    if (metaAberta && $("#modal-meta-detalhe").open) desenharMetaDetalhe();
  } catch (e) { erro(e); }
}
async function excluirMeta() {
  if (!editandoMeta || !confirm(`Excluir a meta “${editandoMeta.nome}” e todo o histórico de aportes dela?`)) return;
  try {
    await db.remover("metas", editandoMeta.id);
    estado.metas = estado.metas.filter((m) => m.id !== editandoMeta.id);
    estado.aportes = estado.aportes.filter((a) => a.meta_id !== editandoMeta.id);
    if (DEMO) { demoDB().aportes = demoDB().aportes.filter((a) => a.meta_id !== editandoMeta.id); demoStore.gravar(demoDB()); }
    $("#modal-meta").close(); $("#modal-meta-detalhe").close();
    toast("Meta excluída"); render();
  } catch (e) { erro(e); }
}

// ----- Modal aporte -----
let editandoAporte = null, tipoAporte = "guardar";
function definirTipoAporte(t) {
  tipoAporte = t;
  $$("#seg-tipo-aporte button").forEach((x) => x.classList.toggle("ativo", x.dataset.t === t));
  $("#titulo-modal-aporte").textContent = (editandoAporte ? "Editar " : "") + (t === "retirar" ? "retirada" : editandoAporte ? "aporte" : "Guardar dinheiro");
}
function abrirAporte(opcoes = {}) {
  if (!estado.migracao3) { irPara("metas"); return toast("Rode a migração 03 no Supabase primeiro"); }
  const ativas = estado.metas.filter((m) => m.ativa);
  if (!opcoes.id && !ativas.length) { toast("Crie uma meta primeiro"); return abrirMeta(); }
  const f = $("#form-aporte"); f.reset();
  editandoAporte = opcoes.id ? estado.aportes.find((a) => a.id === opcoes.id) : null;
  $("#btn-excluir-aporte").hidden = !editandoAporte;
  const a = editandoAporte || { data: hojeISO(), responsavel: estado.usuario.nome.replace(" (demo)", ""), meta_id: opcoes.metaId || (ativas.length === 1 ? ativas[0].id : "") };
  f.elements.valor.value = a.valor ? paraCampo(Math.abs(a.valor)) : "";
  f.elements.data.value = a.data;
  f.elements.responsavel.value = RESPONSAVEIS.includes(a.responsavel) ? a.responsavel : PESSOAS[0];
  f.elements.observacao.value = a.observacao || "";
  f.elements.meta_id.value = a.meta_id || "";
  const metasChips = [...ativas]; if (a.meta_id && !metasChips.some((m) => m.id === a.meta_id)) { const x = estado.metas.find((m) => m.id === a.meta_id); if (x) metasChips.push(x); }
  $("#chips-meta").innerHTML = metasChips.map((m) => `<button type="button" class="chip-cat ${m.id === a.meta_id ? "ativo" : ""}" data-meta="${m.id}">${svg(iconeMeta(m))}<span>${esc(m.nome)}</span></button>`).join("");
  definirTipoAporte(opcoes.tipo || (a.valor < 0 ? "retirar" : "guardar"));
  $("#modal-aporte").showModal();
  if (!editandoAporte) setTimeout(() => f.elements.valor.focus(), 250);
}
async function salvarAporte(ev) {
  ev.preventDefault();
  const f = ev.target.elements;
  const v = parseValor(f.valor.value);
  if (Number.isNaN(v) || !v) return toast("Informe o valor");
  if (!f.meta_id.value) return toast("Escolha a meta");
  const dados = { meta_id: f.meta_id.value, valor: tipoAporte === "retirar" ? -v : v, data: f.data.value, responsavel: f.responsavel.value, observacao: f.observacao.value.trim() || null };
  try {
    if (editandoAporte) Object.assign(editandoAporte, await db.atualizar("aportes", editandoAporte.id, dados));
    else estado.aportes.push(await db.inserir("aportes", dados));
    $("#modal-aporte").close();
    render();
    if ($("#modal-meta-detalhe").open) desenharMetaDetalhe();
    const meta = estado.metas.find((m) => m.id === dados.meta_id);
    const i = meta && infoMeta(meta);
    toast(i && !i.falta ? `🎉 ${meta.nome}: meta alcançada!` : tipoAporte === "retirar" ? "Retirada registrada" : `Guardado! ${meta ? meta.nome + " em " + Math.floor(i.pct) + "%" : ""}`);
  } catch (e) { erro(e); }
}
async function excluirAporte() {
  if (!editandoAporte || !confirm("Excluir este lançamento?")) return;
  try {
    await db.remover("aportes", editandoAporte.id);
    estado.aportes = estado.aportes.filter((a) => a.id !== editandoAporte.id);
    $("#modal-aporte").close(); render();
    if ($("#modal-meta-detalhe").open) desenharMetaDetalhe();
  } catch (e) { erro(e); }
}

// ----- Modal cartão -----
let editandoCartao = null;
function abrirCartao(id) {
  if (!estado.migracao3) return toast("Rode a migração 03 no Supabase primeiro");
  const f = $("#form-cartao"); f.reset();
  editandoCartao = id ? estado.cartoes.find((c) => c.id === id) : null;
  $("#titulo-modal-cartao").textContent = editandoCartao ? "Editar cartão" : "Novo cartão";

  const c = editandoCartao || { ativo: true, responsavel: RESP_PADRAO() };
  f.elements.nome.value = c.nome || "";
  f.elements.dia_fechamento.value = c.dia_fechamento || "";
  f.elements.dia_vencimento.value = c.dia_vencimento || "";
  f.elements.limite.value = paraCampo(c.limite);
  f.elements.responsavel.value = c.responsavel;
  f.elements.ativo.checked = c.ativo !== false;
  caixaEncerrar(f, { editando: !!editandoCartao, ativo: c.ativo !== false, campo: "ativo", excluir: "#btn-excluir-cartao",
    pergunta: "Cancelou este cartão?", encerrar: "Arquivar cartão",
    encerrada: "Cartão arquivado: não aparece para novas compras.", reativar: "Reativar", erro: "Cadastrou errado?" });
  $("#modal-cartao").showModal();
}
async function salvarCartao(ev) {
  ev.preventDefault();
  const f = ev.target.elements;
  const lim = f.limite.value.trim() ? parseValor(f.limite.value) : null;
  if (Number.isNaN(lim)) return toast("Limite inválido");
  const dados = { nome: f.nome.value.trim(), dia_fechamento: Number(f.dia_fechamento.value), dia_vencimento: Number(f.dia_vencimento.value), limite: lim, responsavel: f.responsavel.value, ativo: f.ativo.checked };
  try {
    if (editandoCartao) Object.assign(editandoCartao, await db.atualizar("cartoes", editandoCartao.id, dados));
    else estado.cartoes.push(await db.inserir("cartoes", dados));
    $("#modal-cartao").close(); toast("Cartão salvo"); render();
  } catch (e) { erro(e); }
}
async function excluirCartao() {
  if (!editandoCartao || !confirm(`Excluir o cartão “${editandoCartao.nome}”?\n\nOs gastos lançados nele continuam, mas deixam de aparecer na fatura. Para manter o histórico, use “Arquivar cartão”.`)) return;
  try {
    const id = editandoCartao.id;
    await db.remover("cartoes", id);
    estado.cartoes = estado.cartoes.filter((c) => c.id !== id);
    estado.gastos.forEach((g) => { if (g.cartao_id === id) g.cartao_id = null; });
    estado.contas.forEach((c) => { if (c.cartao_id === id) c.cartao_id = null; });
    if (DEMO) { demoDB().gastos.forEach((g) => { if (g.cartao_id === id) g.cartao_id = null; }); demoDB().contas.forEach((c) => { if (c.cartao_id === id) c.cartao_id = null; }); demoStore.gravar(demoDB()); }
    $("#modal-cartao").close(); render();
  } catch (e) { erro(e); }
}

// ----- Exportar -----
function exportarCSV() {
  const linhas = [["conta", "categoria", "responsavel", "dia_vencimento", "valor_cadastrado", "competencia", "valor_pago", "pago_em", "pago_por"]];
  estado.contas.forEach((c) => {
    const pgs = estado.pagamentos.filter((p) => p.conta_id === c.id);
    if (!pgs.length) linhas.push([c.nome, c.categoria, c.responsavel, c.dia_vencimento, c.valor, "", "", "", ""]);
    pgs.sort((a, b) => a.competencia.localeCompare(b.competencia))
      .forEach((p) => linhas.push([c.nome, c.categoria, c.responsavel, c.dia_vencimento, c.valor, p.competencia.slice(0, 7), p.valor_pago, p.pago_em, p.pago_por || ""]));
  });
  const csv = "﻿" + linhas.map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `financas-casal-contas-${hojeISO()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  if (estado.gastos.length) {
    const lg = [["data", "descricao", "categoria", "quem_pagou", "forma_pagamento", "valor"],
      ...estado.gastos.slice().sort((x, y) => x.data.localeCompare(y.data)).map((g) => [g.data, g.descricao, g.categoria, g.responsavel, g.forma_pagamento || "", g.valor])];
    const csv2 = "\ufeff" + lg.map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
    const b = document.createElement("a");
    b.href = URL.createObjectURL(new Blob([csv2], { type: "text/csv;charset=utf-8" }));
    b.download = `financas-casal-gastos-${hojeISO()}.csv`;
    setTimeout(() => { b.click(); URL.revokeObjectURL(b.href); }, 400);
  }
}
