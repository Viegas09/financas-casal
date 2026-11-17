/* Plinc — Primeiro acesso guiado: renda, contas fixas e cartão em 3 passos, para a família nova já ver o mês montado. */
"use strict";

const GUIA_CONTAS = [
  { nome: "Aluguel ou financiamento", categoria: "Moradia" },
  { nome: "Condomínio", categoria: "Condomínio" },
  { nome: "Luz", categoria: "Energia", variavel: true },
  { nome: "Água", categoria: "Água", variavel: true },
  { nome: "Internet", categoria: "Internet e telefone" },
  { nome: "Celular", categoria: "Internet e telefone" },
  { nome: "Streaming (Netflix, Spotify…)", categoria: "Assinaturas" },
  { nome: "Plano de saúde", categoria: "Saúde" }
];

let guiaPasso = 0;
const chaveGuia = () => "guia-feito-" + ((estado.familia && estado.familia.id) || "local");

/** Família nova (nada cadastrado) e ainda não viu o guia. */
const precisaGuia = () => !DEMO && !precisaAssinar() && !lerPref(chaveGuia(), false)
  && !estado.contas.length && !estado.rendas.length && !(estado.cartoes || []).length;

function abrirGuia() {
  guiaPasso = 0;
  $("#guia-rendas").innerHTML = PESSOAS.map((p, i) => `
    <label>Renda mensal de ${esc(p)} <small class="muted">(o que cai na conta)</small>
      <input data-guia-renda="${i}" type="text" inputmode="decimal" placeholder="0,00" autocomplete="off" />
    </label>`).join("");
  $("#guia-contas").innerHTML = GUIA_CONTAS.map((c, i) => `
    <li class="guia-conta">
      <span class="bola-cat">${svg(iconeDe(c.categoria, c.nome))}</span>
      <span class="gc-nome">${esc(c.nome)}${c.variavel ? '<small class="muted">valor muda todo mês</small>' : ""}</span>
      <input data-guia-valor="${i}" type="text" inputmode="decimal" placeholder="R$ 0,00" aria-label="Valor de ${esc(c.nome)}" autocomplete="off" />
      <input data-guia-dia="${i}" type="number" min="1" max="31" placeholder="dia" aria-label="Dia do vencimento de ${esc(c.nome)}" />
    </li>`).join("");
  $("#guia-cartao-dono").innerHTML = PESSOAS.map((p) => `<option>${esc(p)}</option>`).join("");
  $("#form-guia").reset();
  desenharGuia();
  $("#modal-guia").showModal();
}

function desenharGuia() {
  $$(".guia-passo").forEach((el, i) => (el.hidden = i !== guiaPasso));
  $$("#guia-pontos span").forEach((el, i) => el.classList.toggle("ativo", i <= guiaPasso));
  $("#guia-voltar").hidden = guiaPasso === 0;
  $("#guia-proximo").textContent = guiaPasso === 2 ? "Concluir" : "Próximo";
  $("#guia-contador").textContent = `Passo ${guiaPasso + 1} de 3`;
}

/** Lê o que foi preenchido. Devolve { rendas, contas, cartao, erro }. */
function lerGuia() {
  const rendas = PESSOAS.map((p, i) => ({ descricao: "Salário", valor: parseValor($(`[data-guia-renda="${i}"]`).value || "0"), responsavel: p, ativa: true }))
    .filter((r) => r.valor > 0);
  const contas = [];
  for (const [i, c] of GUIA_CONTAS.entries()) {
    const txt = $(`[data-guia-valor="${i}"]`).value.trim(); if (!txt) continue;
    const valor = parseValor(txt), dia = Number($(`[data-guia-dia="${i}"]`).value || 10);
    if (Number.isNaN(valor) || valor <= 0) return { erro: `Valor inválido em “${c.nome}”` };
    if (!(dia >= 1 && dia <= 31)) return { erro: `Dia inválido em “${c.nome}” (1 a 31)` };
    const d = { nome: c.nome.replace(/ \(.*\)$/, ""), categoria: c.categoria, valor, dia_vencimento: dia, responsavel: RESP_PADRAO(),
      forma_pagamento: null, observacao: null, inicio: compDe(new Date()), ativa: true };
    if (estado.migracao2) d.variavel = !!c.variavel;
    contas.push(d);
  }
  let cartao = null;
  const nome = $("#guia-cartao-nome").value.trim();
  if (nome && estado.migracao3) {
    const fech = Number($("#guia-cartao-fech").value), venc = Number($("#guia-cartao-venc").value);
    if (!(fech >= 1 && fech <= 31) || !(venc >= 1 && venc <= 31)) return { erro: "Informe o dia de fechamento e de vencimento do cartão (1 a 31)" };
    cartao = { nome, dia_fechamento: fech, dia_vencimento: venc, limite: null, responsavel: $("#guia-cartao-dono").value, ativo: true };
  }
  return { rendas, contas, cartao };
}

async function avancarGuia() {
  if (guiaPasso < 2) {
    const r = lerGuia();
    if (r.erro) return toast(r.erro);
    guiaPasso++; desenharGuia(); return;
  }
  const { rendas, contas, cartao, erro: e } = lerGuia();
  if (e) return toast(e);
  try {
    for (const r of rendas) estado.rendas.push(await db.inserir("rendas", r));
    if (contas.length) estado.contas.push(...await db.inserirVarios("contas", contas));
    if (cartao) estado.cartoes.push(await db.inserir("cartoes", cartao));
    gravarPref(chaveGuia(), true);
    $("#modal-guia").close();
    render();
    const n = rendas.length + contas.length + (cartao ? 1 : 0);
    toast(n ? "Pronto! O mês de vocês já está montado" : "Tudo bem, dá para cadastrar depois em Mais → Cadastros");
    irPara("inicio");
  } catch (err) { erro(err); }
}

function fecharGuia() {
  gravarPref(chaveGuia(), true);
  $("#modal-guia").close();
  toast("Quando quiser, refaça em Mais → Configuração inicial");
}

function ligarGuia() {
  $("#guia-proximo").addEventListener("click", travar(avancarGuia));
  $("#guia-voltar").addEventListener("click", () => { guiaPasso = Math.max(0, guiaPasso - 1); desenharGuia(); });
  $("#guia-fechar").addEventListener("click", fecharGuia);
  $("#form-guia").addEventListener("submit", (ev) => ev.preventDefault());
  $("#modal-guia").addEventListener("cancel", (ev) => { ev.preventDefault(); fecharGuia(); });
}
