// Testes das funções de assinatura (Mercado Pago simulado, sem internet)
import crypto from "node:crypto";
import { avisoAutentico, manifesto, mudancaPorPreapproval, mudancaPorPagamento, corpoPreapproval, PRECO } from "../supabase/functions/_shared/regras.js";
import { processarAviso, pedidoDoApp } from "../supabase/functions/_shared/acoes.js";

let falhas = 0;
const ok = (c, m) => { if (!c) falhas++; console.log((c ? "✅ " : "❌ ") + m); };
const FAM = "11111111-2222-3333-4444-555555555555";
const SEGREDO = "segredo-de-teste";
const assinar = (dataId, reqId, ts) => "ts=" + ts + ",v1=" + crypto.createHmac("sha256", SEGREDO).update(manifesto({ dataId, xRequestId: reqId, ts })).digest("hex");

// ---------- aviso autêntico ----------
{
  const h = assinar("abc123", "req-1", "1731500000");
  ok(await avisoAutentico({ xSignature: h, xRequestId: "req-1", dataId: "abc123", segredo: SEGREDO }), "aviso com assinatura certa é aceito");
  ok(!(await avisoAutentico({ xSignature: h, xRequestId: "req-1", dataId: "abc123", segredo: "outro" })), "assinatura com segredo errado é recusada");
  ok(!(await avisoAutentico({ xSignature: h, xRequestId: "req-1", dataId: "zzz", segredo: SEGREDO })), "aviso adulterado (outro id) é recusado");
  ok(!(await avisoAutentico({ xSignature: null, xRequestId: "req-1", dataId: "abc123", segredo: SEGREDO })), "aviso sem assinatura é recusado");
  ok(!(await avisoAutentico({ xSignature: h, xRequestId: "req-1", dataId: "abc123", segredo: "" })), "sem segredo configurado, nada é aceito");
  ok(await avisoAutentico({ xSignature: assinar("abc123", "r", "1"), xRequestId: "r", dataId: "ABC123", segredo: SEGREDO }), "id com letras maiúsculas é comparado em minúsculas (regra do Mercado Pago)");
}

// ---------- mudanças ----------
const agora = new Date("2026-11-13T12:00:00Z");
{
  const pend = { status: "pendente", valido_ate: null, pago: false, mp_preapproval_id: "pre-1" };
  const a = mudancaPorPreapproval({ id: "pre-1", status: "authorized" }, pend, agora);
  ok(a?.status === "ativa" && new Date(a.valido_ate) - agora === 2 * 864e5, "assinatura autorizada: libera na hora (2 dias até a 1ª cobrança confirmar)");
  ok(mudancaPorPreapproval({ id: "pre-1", status: "authorized" }, { status: "cortesia" }, agora) === null, "família cortesia não é mexida");
  ok(mudancaPorPreapproval({ id: "pre-velha", status: "cancelled" }, { status: "ativa", mp_preapproval_id: "pre-1" }, agora) === null, "cancelamento de uma assinatura antiga não cancela a atual");
  ok(mudancaPorPreapproval({ id: "pre-1", status: "cancelled" }, { status: "ativa", mp_preapproval_id: "pre-1", valido_ate: "2026-12-14T00:00:00Z" }, agora)?.status === "cancelada", "cancelou no Mercado Pago: fica cancelada (mantém o prazo pago)");
  ok(mudancaPorPreapproval({ id: "pre-1", status: "pending" }, pend, agora) === null, "assinatura ainda pendente não muda nada");

  const ativa = { status: "ativa", valido_ate: "2026-11-15T12:00:00Z", pago: false, mp_preapproval_id: "pre-1" };
  const ap = { id: 9, preapproval_id: "pre-1", debit_date: "2026-11-13T12:00:00Z", payment: { status: "approved" } };
  const p1 = mudancaPorPagamento(ap, ativa);
  ok(p1?.pago === true && p1.valido_ate === "2026-12-14T12:00:00.000Z", "cobrança aprovada: válido por 1 mês + 1 dia de folga " + p1?.valido_ate);
  const p2 = mudancaPorPagamento(ap, { ...ativa, ...p1 });
  ok(p2.valido_ate === p1.valido_ate, "o mesmo aviso chegando 2 vezes não dá mês a mais");
  ok(mudancaPorPagamento({ ...ap, payment: { status: "rejected" } }, ativa)?.status === "atrasada", "cobrança recusada: fica atrasada (a tolerância de 7 dias começa no fim do prazo)");
  ok(mudancaPorPagamento(ap, { status: "cortesia" }) === null, "cobrança não mexe em família cortesia");
  ok(mudancaPorPagamento(ap, { ...ativa, status: "cancelada" })?.status === "cancelada", "cobrança aprovada depois de cancelar não reativa (só estende o prazo)");
}

// ---------- corpo da assinatura no Mercado Pago ----------
{
  const c = corpoPreapproval({ familiaId: FAM, email: "a@b.com", appUrl: "https://viegas09.github.io/financas-casal/" });
  ok(c.auto_recurring.transaction_amount === PRECO && PRECO === 19.9 && c.auto_recurring.currency_id === "BRL" && c.auto_recurring.frequency_type === "months" && c.status === "pending",
    "assinatura: R$ 19,90 por mês, em reais, concluída no checkout do Mercado Pago");
  ok(c.external_reference === FAM && c.back_url === "https://viegas09.github.io/financas-casal/?assinatura=retorno", "assinatura ligada à família e volta para o app depois do pagamento");
}

// ---------- aviso (webhook) de ponta a ponta ----------
function banco(inicial) {
  const tab = { [FAM]: { ...inicial } }; const gravados = [];
  return { tab, gravados, lerAssinatura: async (f) => tab[f] || null, gravarAssinatura: async (f, c) => { gravados.push(c); Object.assign(tab[f], c); } };
}
{
  const b = banco({ status: "pendente", valido_ate: null, pago: false, mp_preapproval_id: "pre-1" });
  let chamadas = 0;
  const mp = async (cam) => { chamadas++; if (cam === "/preapproval/pre-1") return { id: "pre-1", status: "authorized", external_reference: FAM }; if (cam === "/authorized_payments/77") return { id: 77, preapproval_id: "pre-1", debit_date: "2026-11-13T13:00:00Z", payment: { status: "approved" } }; throw new Error("inesperado " + cam); };
  const falso = await processarAviso({ tipo: "subscription_preapproval", dataId: "pre-1", xSignature: "ts=1,v1=deadbeef", xRequestId: "x" }, { segredo: SEGREDO, mp, ...b });
  ok(falso.status === 401 && chamadas === 0 && b.gravados.length === 0, "aviso falso: recusado sem consultar nada e sem mexer no banco");
  const r1 = await processarAviso({ tipo: "subscription_preapproval", dataId: "pre-1", xSignature: assinar("pre-1", "x", "5"), xRequestId: "x" }, { segredo: SEGREDO, mp, ...b });
  ok(r1.status === 200 && b.tab[FAM].status === "ativa", "assinou no checkout: aviso libera a família");
  const r2 = await processarAviso({ tipo: "subscription_authorized_payment", dataId: "77", xSignature: assinar("77", "y", "6"), xRequestId: "y" }, { segredo: SEGREDO, mp, ...b });
  ok(r2.status === 200 && b.tab[FAM].pago === true && b.tab[FAM].valido_ate.startsWith("2026-12-14"), "cobrança aprovada (família achada pela assinatura): pago até 14/12");
  const r3 = await processarAviso({ tipo: "payment", dataId: "1", xSignature: assinar("1", "z", "7"), xRequestId: "z" }, { segredo: SEGREDO, mp, ...b });
  ok(r3.status === 200 && r3.dados === "ignorado", "outros tipos de aviso são ignorados");
}

// ---------- pedidos do app ----------
{
  const b = banco({ status: "pendente", valido_ate: null, pago: false, mp_preapproval_id: null });
  const pedidos = [];
  const mp = async (cam, op = {}) => { pedidos.push({ cam, ...op }); if (op.method === "POST") return { id: "pre-9", init_point: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=pre-9" }; return {}; };
  const deps = (u, papel = "dono") => ({ usuario: async () => u, membro: async () => ({ familia_id: FAM, papel }), mp, appUrl: "https://viegas09.github.io/financas-casal/", ...b });
  ok((await pedidoDoApp({ acao: "assinar" }, deps(null))).status === 401, "sem login: recusado");
  ok((await pedidoDoApp({ acao: "assinar", email: "nao-é-email" }, deps({ id: "u1", email: "x" }))).status === 400, "e-mail inválido: pede para conferir");
  const r = await pedidoDoApp({ acao: "assinar", email: "Bia@X.com " }, deps({ id: "u1", email: "bia@x.com" }));
  const post = pedidos.find((p) => p.method === "POST");
  ok(r.status === 200 && r.dados.url.includes("preapproval_id=pre-9") && post.body.payer_email === "bia@x.com" && post.body.external_reference === FAM, "assinar: cria a assinatura no Mercado Pago e devolve o link do checkout");
  ok(b.tab[FAM].mp_preapproval_id === "pre-9" && b.tab[FAM].status === "pendente", "assinar: guarda a assinatura, mas só libera quando o Mercado Pago avisar");
  Object.assign(b.tab[FAM], { status: "ativa", valido_ate: "2026-12-14T12:00:00Z" });
  ok((await pedidoDoApp({ acao: "cancelar" }, deps({ id: "u2" }, "membro"))).status === 403, "cancelar: só o dono da família");
  const c = await pedidoDoApp({ acao: "cancelar" }, deps({ id: "u1" }));
  ok(c.status === 200 && pedidos.some((p) => p.method === "PUT" && p.cam === "/preapproval/pre-9" && p.body.status === "cancelled") && b.tab[FAM].status === "cancelada", "cancelar: cancela no Mercado Pago e mantém o acesso até o fim do período");
  const bc = banco({ status: "cortesia" });
  ok((await pedidoDoApp({ acao: "assinar" }, { ...deps({ id: "u1", email: "a@b.com" }), ...bc })).status === 409, "família cortesia não precisa assinar");
}

console.log(falhas ? `\n${falhas} FALHA(S) nas funções` : "\nFunções: tudo certo");
process.exit(falhas ? 1 : 0);
