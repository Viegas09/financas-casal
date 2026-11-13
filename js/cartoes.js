/* Plinc — Cartões de crédito e faturas. */
"use strict";

// ---------- Cartões de crédito ----------
const diasNoMes = (a, m) => new Date(a, m, 0).getDate();
const dataNoMes = (comp, dia) => { const [a, m] = comp.split("-").map(Number); return `${a}-${pad(m)}-${pad(Math.min(dia, diasNoMes(a, m)))}`; };
const diasEntre = (de, ate) => Math.round((new Date(ate + "T12:00") - new Date(de + "T12:00")) / 864e5);
const venceNoMesmoMes = (c) => c.dia_vencimento > c.dia_fechamento;

/** Mês de vencimento ("AAAA-MM-01") da fatura em que entra uma compra feita em dataISO. */
function competenciaFatura(c, dataISO) {
  const [a, m, d] = dataISO.split("-").map(Number);
  const fech = Math.min(c.dia_fechamento, diasNoMes(a, m));
  const mesFech = d <= fech ? compDe(new Date(a, m - 1, 1)) : compDe(new Date(a, m, 1));
  return venceNoMesmoMes(c) ? mesFech : somaMes(mesFech, 1);
}
const datasFatura = (c, comp) => ({
  fechamento: dataNoMes(venceNoMesmoMes(c) ? comp : somaMes(comp, -1), c.dia_fechamento),
  vencimento: dataNoMes(comp, c.dia_vencimento)
});

function itensFatura(c, comp) {
  const itens = [];
  estado.gastos.filter((g) => g.cartao_id === c.id).forEach((g) => {
    const n = Math.max(1, Number(g.parcelas) || 1);
    const k = (() => { const [a1, m1] = competenciaFatura(c, g.data).split("-").map(Number); const [a2, m2] = comp.split("-").map(Number); return (a2 - a1) * 12 + (m2 - m1); })();
    if (k < 0 || k >= n) return;
    const parcela = Math.floor((Number(g.valor) / n) * 100) / 100;
    const valor = k === n - 1 ? Math.round((Number(g.valor) - parcela * (n - 1)) * 100) / 100 : parcela;
    itens.push({ tipo: "gasto", id: g.id, data: g.data, descricao: g.descricao, categoria: g.categoria, valor, parcela: n > 1 ? `${k + 1}/${n}` : "" });
  });
  for (let i = -2; i <= 0; i++) {
    const mesConta = somaMes(comp, i);
    contasDoMes(mesConta).filter((x) => x.cartao_id === c.id).forEach((x) => {
      const data = dataNoMes(mesConta, x.dia_vencimento);
      if (competenciaFatura(c, data) === comp) itens.push({ tipo: "conta", id: x.id, data, descricao: x.nome, categoria: x.categoria, valor: x.valorMes, parcela: "", estimado: x.estimado, aDefinir: x.aDefinir });
    });
  }
  return itens.sort((a, b) => b.data.localeCompare(a.data));
}

const faturaPaga = (c, comp) => estado.faturas_pagas.find((f) => f.cartao_id === c.id && f.competencia === comp);

function statusFatura(c, comp) {
  const pg = faturaPaga(c, comp);
  const { fechamento, vencimento } = datasFatura(c, comp);
  const hoje = hojeISO();
  if (pg) return { chave: "paga", texto: "✓ Paga", cls: "paga" };
  if (hoje <= fechamento) { const d = diasEntre(hoje, fechamento); return { chave: "aberta", texto: d === 0 ? "Aberta · fecha hoje" : `Aberta · fecha em ${d} dia${d > 1 ? "s" : ""}`, cls: "futura", dias: d }; }
  if (hoje <= vencimento) { const d = diasEntre(hoje, vencimento); return { chave: "fechada", texto: d === 0 ? "● Vence hoje" : `● Fechada · vence em ${d} dia${d > 1 ? "s" : ""}`, cls: d <= DIAS_ALERTA ? "breve" : "futura", dias: d }; }
  return { chave: "vencida", texto: "! Vencida", cls: "atrasada" };
}

function faturasDoMes(comp) {
  if (!estado.migracao3) return [];
  return estado.cartoes.filter((c) => c.ativo).map((c) => {
    const itens = itensFatura(c, comp);
    return { cartao: c, comp, itens, total: soma(itens, (i) => i.valor), status: statusFatura(c, comp), ...datasFatura(c, comp) };
  });
}

/** Quanto do limite está comprometido: faturas não pagas a partir da atual (inclui parcelas futuras). */
function limiteUsado(c) {
  const atual = competenciaFatura(c, hojeISO());
  let total = 0;
  for (let i = -1; i < 48; i++) { const comp = somaMes(atual, i); if (!faturaPaga(c, comp)) total += soma(itensFatura(c, comp).filter((x) => x.tipo === "gasto"), (x) => x.valor); }
  return total;
}

const fmtData = (d, opts = { day: "numeric", month: "short" }) => new Date(d + "T12:00").toLocaleDateString("pt-BR", opts).replace(".", "");

function renderFaturas() {
  const el = $("#faturas");
  const usaCartao = estado.migracao3 && estado.cartoes.length > 0;
  const segCartoes = $('#seg-gastos [data-g="cartoes"]');
  segCartoes.hidden = !usaCartao;
  if (!usaCartao && segCartoes.classList.contains("ativo")) { mostrarSubGastos("orcamento"); }
  if (!estado.migracao3) { el.innerHTML = avisoMigracao3(); return; }
  const fats = faturasDoMes(estado.mes);
  el.innerHTML = fats.length ? fats.map((f) => {
    const usado = f.cartao.limite ? limiteUsado(f.cartao) : 0;
    const pctLim = f.cartao.limite ? Math.min(100, (usado / f.cartao.limite) * 100) : 0;
    return `
    <button class="card fatura-card" data-abrir-fatura="${f.cartao.id}">
      <div class="fc-topo">
        <span class="bola-cat">${svg("cartao")}</span>
        <div class="fc-nome"><strong>${esc(f.cartao.nome)}</strong><small>Fatura de ${esc(nomeMes(f.comp, "mes"))} · ${esc(f.cartao.responsavel)}</small></div>
        <span class="seta">›</span>
      </div>
      <div class="fc-valor">${fmt(f.total)}</div>
      <div class="fc-linha"><span class="badge ${f.status.cls}">${f.status.texto}</span><span>Fecha ${esc(fmtData(f.fechamento))} · vence ${esc(fmtData(f.vencimento))}</span></div>
      ${f.cartao.limite ? `<div class="meter-orc ${pctLim > 90 ? "crit" : pctLim > 70 ? "warn" : "ok"}"><span style="width:${pctLim}%"></span></div>
      <div class="fc-linha neutro"><span>Limite usado ${fmt(usado)}</span><span>disponível ${fmt(Math.max(0, f.cartao.limite - usado))}</span></div>` : ""}
    </button>`;
  }).join("") : `<article class="card card-lista"><ul class="lista-cadastro">${vazio("cartao", "Nenhum cartão cadastrado", "Cadastre o cartão (dia de fechamento e vencimento) e escolha ele ao lançar gastos: a fatura é montada sozinha, com parcelas.", ["novo-cartao", "Cadastrar cartão"])}</ul></article>`;
}

let faturaAberta = null;
function abrirFatura(cartaoId) {
  const c = estado.cartoes.find((x) => x.id === cartaoId); if (!c) return;
  faturaAberta = { cartao: c, comp: estado.mes };
  desenharFatura();
  $("#modal-fatura").showModal();
}
function desenharFatura() {
  const { cartao: c, comp } = faturaAberta;
  const itens = itensFatura(c, comp), total = soma(itens, (i) => i.valor), st = statusFatura(c, comp), dt = datasFatura(c, comp);
  const pg = faturaPaga(c, comp);
  $("#fatura-detalhe").innerHTML = `
    <div class="fd-topo"><span class="bola-cat">${svg("cartao")}</span><div><h2>${esc(c.nome)}</h2><small class="muted">Fatura de ${esc(nomeMes(comp))}</small></div></div>
    <div class="fd-total">${fmt(total)}</div>
    <div class="fc-linha"><span class="badge ${st.cls}">${st.texto}</span><span>Fecha ${esc(fmtData(dt.fechamento))} · vence ${esc(fmtData(dt.vencimento))}</span></div>
    ${pg ? `<p class="muted pequeno">Paga em ${esc(fmtData(pg.pago_em, { day: "numeric", month: "long" }))}${pg.pago_por ? " por " + esc(pg.pago_por) : ""} · ${fmt(Number(pg.valor_pago) || total)}</p>` : ""}
    <ul class="lista-cadastro fd-lista">${itens.length ? itens.map((i) => `
      <li><button class="item" ${i.tipo === "gasto" ? `data-editar-gasto="${i.id}"` : `data-editar-conta="${i.id}"`}>
        <span class="bola-cat">${svg(iconeDe(i.categoria, i.descricao))}</span>
        <div><div class="nome">${esc(i.descricao)}${i.parcela ? ` <span class="badge futura">${i.parcela}</span>` : ""}${i.tipo === "conta" ? ' <span class="badge futura">fixa</span>' : ""}</div><div class="meta">${esc(fmtData(i.data))} · ${esc(i.categoria)}</div></div>
        <span class="valor ${i.aDefinir ? "a-definir" : ""}">${i.aDefinir ? "a definir" : (i.estimado && !ocultar ? "~" : "") + fmt(i.valor)}</span><span class="seta">›</span>
      </button></li>`).join("") : vazio("cartao", "Nada nesta fatura", "Ao lançar um gasto, escolha este cartão em “Pagamento”.")}</ul>`;
  $("#btn-pagar-fatura").textContent = pg ? "Desmarcar pagamento" : "Marcar fatura como paga";
  $("#btn-pagar-fatura").classList.toggle("btn-primary", !pg);
  $("#btn-pagar-fatura").classList.toggle("btn-ghost", !!pg);
  $("#btn-pagar-fatura").disabled = !pg && !total;
}
async function alternarFatura() {
  const { cartao: c, comp } = faturaAberta;
  const pg = faturaPaga(c, comp);
  try {
    if (pg) { await db.remover("faturas_pagas", pg.id); estado.faturas_pagas = estado.faturas_pagas.filter((x) => x.id !== pg.id); toast("Pagamento da fatura desmarcado"); }
    else {
      const total = soma(itensFatura(c, comp), (i) => i.valor);
      estado.faturas_pagas.push(await db.inserir("faturas_pagas", { cartao_id: c.id, competencia: comp, valor_pago: total, pago_em: hojeISO(), pago_por: estado.usuario.nome.replace(" (demo)", "") }));
      toast(`Fatura ${c.nome} paga · ${fmt(total)}`);
    }
    render(); desenharFatura();
  } catch (e) { erro(e); }
}

function renderCadastroCartoes() {
  const el = $("#cad-cartoes");
  if (!estado.migracao3) { el.innerHTML = `<li>${avisoMigracao3()}</li>`; return; }
  const cs = [...estado.cartoes].sort((a, b) => (b.ativo - a.ativo) || a.nome.localeCompare(b.nome));
  el.innerHTML = cs.length ? cs.map((c) => `
    <li class="${c.ativo ? "" : "inativa"}">
      <button class="item" data-editar-cartao="${c.id}">
        <span class="bola-cat">${svg("cartao")}</span>
        <div><div class="nome">${esc(c.nome)}${c.ativo ? "" : ' <span class="badge inativa">Arquivado</span>'}</div><div class="meta">Fecha dia ${c.dia_fechamento} · vence dia ${c.dia_vencimento} · ${esc(c.responsavel)}</div></div>
        <span class="valor">${c.limite ? fmt(c.limite) : ""}</span><span class="seta">›</span>
      </button>
    </li>`).join("") : vazio("cartao", "Nenhum cartão", "Cadastre os cartões para acompanhar as faturas.", ["novo-cartao", "Novo cartão"]);
}

const avisoMigracao3 = () => `<div class="aviso-inline"><strong>Falta um passo no banco de dados</strong><span>Rode <code>supabase/migracao-03-metas-cartoes.sql</code> no SQL Editor do Supabase e recarregue o app.</span></div>`;
