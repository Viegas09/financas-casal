/* Plinc — Acerto do casal: quanto cada um pagou no mês, quanto era a parte de cada um e quem passa quanto para quem. */
"use strict";

/** Nome do membro que lançou (para gastos no Pix/débito, quem lançou é quem pagou). */
function nomeDoMembro(userId) {
  if (!userId) return null;
  const m = (estado.membrosFamilia || []).find((x) => x.user_id === userId);
  if (m) return m.nome;
  return estado.usuario && estado.usuario.id === userId ? estado.usuario.nome.replace(" (demo)", "") : null;
}

/**
 * Conta o mês: cada pagamento tem quem pagou e para quem era (uma pessoa ou o casal).
 * • Conta fixa paga fora do cartão: quem marcou como paga → responsável da conta.
 * • Fatura paga: quem pagou a fatura → dono de cada compra/conta dentro dela.
 * • Gasto no Pix/débito: quem lançou → responsável do gasto.
 * A parte do casal é dividida pela renda de cada um (se todos tiverem renda cadastrada) ou meio a meio.
 */
function acertoCasal(comp) {
  const P = PESSOAS;
  if (P.length < 2) return null;
  const zero = () => Object.fromEntries(P.map((p) => [p, 0]));
  const pagou = zero(), parte = zero();
  let casal = 0, semPagador = 0;
  const lanca = (pagador, para, valor) => {
    const v = Math.round((Number(valor) || 0) * 100) / 100; if (!v) return;
    if (!P.includes(pagador)) { semPagador += v; return; }
    pagou[pagador] += v;
    if (P.includes(para)) parte[para] += v; else casal += v;
  };
  contasDoMes(comp).filter((c) => c.pagamento && !c.cartao_id).forEach((c) => lanca(c.pagamento.pago_por, c.responsavel, c.pagamento.valor_pago));
  faturasDoMes(comp).forEach((f) => {
    const pg = faturaPaga(f.cartao, f.comp); if (!pg) return;
    const pagador = pg.pago_por || f.cartao.responsavel;
    f.itens.forEach((i) => {
      const dono = i.tipo === "gasto" ? (estado.gastos.find((g) => g.id === i.id) || {}).responsavel : (estado.contas.find((c) => c.id === i.id) || {}).responsavel;
      lanca(pagador, dono, i.valor);
    });
  });
  gastosDoMes(comp).filter((g) => !g.cartao_id).forEach((g) => lanca(nomeDoMembro(g.created_by), g.responsavel, g.valor));

  const rendaDe = (p) => soma(estado.rendas.filter((r) => r.ativa !== false && r.responsavel === p), (r) => r.valor);
  const rendas = P.map(rendaDe), totRenda = soma(rendas, (r) => r);
  const porRenda = rendas.every((r) => r > 0);
  const peso = Object.fromEntries(P.map((p, i) => [p, porRenda ? rendas[i] / totRenda : 1 / P.length]));
  P.forEach((p) => (parte[p] += casal * peso[p]));
  const saldo = Object.fromEntries(P.map((p) => [p, Math.round((pagou[p] - parte[p]) * 100) / 100]));

  // quem passa para quem (o menor número de Pix possível)
  const credores = P.filter((p) => saldo[p] > 0.5).map((p) => ({ p, v: saldo[p] })).sort((a, b) => b.v - a.v);
  const devedores = P.filter((p) => saldo[p] < -0.5).map((p) => ({ p, v: -saldo[p] })).sort((a, b) => b.v - a.v);
  const passes = [];
  for (const d of devedores) {
    for (const c of credores) {
      if (d.v < 0.5) break;
      const v = Math.min(d.v, c.v); if (v < 0.5) continue;
      passes.push({ de: d.p, para: c.p, valor: Math.round(v * 100) / 100 });
      d.v -= v; c.v -= v;
    }
  }
  return { pagou, parte, saldo, peso, porRenda, casal, passes, total: soma(P, (p) => pagou[p]), semPagador };
}

const pctTxt = (x) => `${Math.round(x * 100)}%`;

function renderAcertoCasal() {
  const el = $("#acerto-casal"); if (!el) return;
  const a = acertoCasal(estado.mes);
  if (!a || a.total < 0.01) { el.hidden = true; el.innerHTML = ""; return; }
  el.hidden = false;
  const titulo = a.passes.length
    ? a.passes.map((x) => `<b>${esc(x.de)}</b> passa <b>${fmt(x.valor)}</b> para <b>${esc(x.para)}</b>`).join("<br>")
    : "Tudo dividido certinho: ninguém deve nada";
  const regra = a.porRenda
    ? `Despesas do casal divididas pela renda: ${PESSOAS.map((p) => `${esc(p)} ${pctTxt(a.peso[p])}`).join(" · ")}.`
    : `Despesas do casal divididas meio a meio. <button class="btn-link" data-acao="nova-renda">Cadastre a renda de cada um</button> para dividir proporcionalmente.`;
  el.innerHTML = `
    <div class="card-topo"><h2>Acerto de ${esc(nomeMes(estado.mes, "mes"))}</h2></div>
    <p class="ac-titulo">${titulo}</p>
    <div class="ac-pessoas">${PESSOAS.map((p) => `
      <div class="ac-pessoa">
        <span class="ac-av">${esc(p.charAt(0).toUpperCase())}</span>
        <div><div class="nome">${esc(p)}</div><div class="meta">Pagou ${fmt(a.pagou[p])} · a parte é ${fmt(a.parte[p])}</div></div>
        <span class="ac-saldo ${a.saldo[p] > 0.5 ? "pos" : a.saldo[p] < -0.5 ? "neg" : ""}">${a.saldo[p] > 0.5 ? "+" : a.saldo[p] < -0.5 ? "−" : ""}${fmt(Math.abs(a.saldo[p]))}</span>
      </div>`).join("")}</div>
    <p class="muted pequeno ac-regra">${regra} Entram contas e faturas marcadas como pagas e gastos no Pix/débito (de quem lançou).</p>`;
}
