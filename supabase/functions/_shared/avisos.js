// Plinc — regras dos avisos de vencimento (puras, sem banco): o que vence amanhã em cada família e o texto do aviso.
// Usadas pela função "avisos" (todo dia às 8h) e pelos testes.

const pad = (n) => String(n).padStart(2, "0");
const diasNoMes = (a, m) => new Date(Date.UTC(a, m, 0)).getUTCDate();
const compDe = (iso) => iso.slice(0, 7) + "-01";
const somaMes = (comp, n) => { const [a, m] = comp.split("-").map(Number); const d = new Date(Date.UTC(a, m - 1 + n, 1)); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-01`; };
const diaEfetivo = (comp, dia) => { const [a, m] = comp.split("-").map(Number); return Math.min(dia, diasNoMes(a, m)); };
const brl = (v) => "R$ " + Number(v).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** Data de hoje no horário de Brasília (AAAA-MM-DD). */
export const hojeBrasil = (agora = new Date()) => new Date(agora.getTime() - 3 * 3600e3).toISOString().slice(0, 10);
export const amanhaDe = (hoje) => { const d = new Date(hoje + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };

/** Mesma regra do app (js/cartoes.js): mês de vencimento da fatura em que entra uma compra. */
function competenciaFatura(c, dataISO) {
  const [a, m, d] = dataISO.split("-").map(Number);
  const fech = Math.min(c.dia_fechamento, diasNoMes(a, m));
  const mesFech = d <= fech ? `${a}-${pad(m)}-01` : somaMes(`${a}-${pad(m)}-01`, 1);
  return c.dia_vencimento > c.dia_fechamento ? mesFech : somaMes(mesFech, 1);
}

const contaVale = (c, comp) => c.ativa !== false && (c.inicio || "0000-00-00") <= comp && (!c.fim || comp <= c.fim);

/** Total da fatura de um cartão no mês (compras com parcelas + contas fixas cobradas no cartão). */
export function totalFatura(c, comp, { gastos = [], contas = [], valores_mes = [] }) {
  let total = 0;
  gastos.filter((g) => g.cartao_id === c.id).forEach((g) => {
    const n = Math.max(1, Number(g.parcelas) || 1);
    const [a1, m1] = competenciaFatura(c, g.data).split("-").map(Number), [a2, m2] = comp.split("-").map(Number);
    const k = (a2 - a1) * 12 + (m2 - m1);
    if (k < 0 || k >= n) return;
    const parcela = Math.floor((Number(g.valor) / n) * 100) / 100;
    total += k === n - 1 ? Math.round((Number(g.valor) - parcela * (n - 1)) * 100) / 100 : parcela;
  });
  for (let i = -2; i <= 0; i++) {
    const mes = somaMes(comp, i);
    contas.filter((x) => x.cartao_id === c.id && contaVale(x, mes)).forEach((x) => {
      const data = `${mes.slice(0, 7)}-${pad(diaEfetivo(mes, x.dia_vencimento))}`;
      if (competenciaFatura(c, data) !== comp) return;
      const vm = valores_mes.find((v) => v.conta_id === x.id && v.competencia === mes);
      total += vm ? Number(vm.valor) : Number(x.valor);
    });
  }
  return Math.round(total * 100) / 100;
}

/**
 * O que vence amanhã e ainda não foi pago, por família.
 * dados: { contas, pagamentos, valores_mes, cartoes, faturas_pagas, gastos } (todas as famílias; cada linha tem familia_id)
 * Devolve Map familia_id → [{ nome, valor|null }]
 */
export function vencimentosAmanha(dados, hoje) {
  const amanha = amanhaDe(hoje), comp = compDe(amanha), dia = Number(amanha.slice(8));
  const { contas = [], pagamentos = [], valores_mes = [], cartoes = [], faturas_pagas = [], gastos = [] } = dados;
  const porFamilia = new Map();
  const add = (f, item) => { if (!f) return; if (!porFamilia.has(f)) porFamilia.set(f, []); porFamilia.get(f).push(item); };
  contas.filter((c) => !c.cartao_id && contaVale(c, comp) && diaEfetivo(comp, c.dia_vencimento) === dia)
    .filter((c) => !pagamentos.some((p) => p.conta_id === c.id && p.competencia === comp))
    .forEach((c) => {
      const vm = valores_mes.find((v) => v.conta_id === c.id && v.competencia === comp);
      add(c.familia_id, { nome: c.nome, valor: vm ? Number(vm.valor) : c.variavel ? null : Number(c.valor) });
    });
  cartoes.filter((c) => c.ativo !== false && diaEfetivo(comp, c.dia_vencimento) === dia)
    .filter((c) => !faturas_pagas.some((f) => f.cartao_id === c.id && f.competencia === comp))
    .forEach((c) => {
      const doCartao = { gastos: gastos.filter((g) => g.familia_id === c.familia_id), contas: contas.filter((x) => x.familia_id === c.familia_id), valores_mes };
      const total = totalFatura(c, comp, doCartao);
      if (total > 0) add(c.familia_id, { nome: "Fatura " + c.nome, valor: total });
    });
  return porFamilia;
}

const juntar = (nomes) => nomes.length <= 1 ? nomes.join("") : nomes.slice(0, -1).join(", ") + " e " + nomes.at(-1);

/** Texto da notificação. */
export function mensagem(itens) {
  const comValor = itens.filter((i) => i.valor !== null), total = comValor.reduce((s, i) => s + i.valor, 0);
  if (itens.length === 1) {
    const i = itens[0];
    return { titulo: `Amanhã vence: ${i.nome}`, corpo: (i.valor !== null ? brl(i.valor) + " · " : "") + "Toque para abrir e marcar como paga." };
  }
  const nomes = itens.map((i) => i.nome), mostrar = nomes.length > 3 ? [...nomes.slice(0, 3), `mais ${nomes.length - 3}`] : nomes;
  return { titulo: `Amanhã vencem ${itens.length} contas`, corpo: juntar(mostrar) + (total ? ` · ${brl(total)}` : "") };
}
