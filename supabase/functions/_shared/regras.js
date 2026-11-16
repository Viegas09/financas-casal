// Plinc — regras da assinatura (Mercado Pago).
// Sem dependências: roda nas funções do Supabase (Deno) e nos testes (Node).

export const PRECO = 19.9;
export const TITULO = "Plinc Família";
export const DIA = 864e5;

export const ehUUID = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s ?? ""));
export const ehEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s ?? "")) && String(s).length <= 200;
const maior = (a, b) => (a && new Date(a) > new Date(b) ? new Date(a) : new Date(b));

// ---------- Aviso veio mesmo do Mercado Pago? (header x-signature, HMAC-SHA256) ----------
async function hmacHex(segredo, texto) {
  const enc = new TextEncoder();
  const chave = await crypto.subtle.importKey("raw", enc.encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", chave, enc.encode(texto));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const igual = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

export function lerHeaderAssinatura(x) {
  const r = {};
  for (const parte of String(x ?? "").split(",")) { const [k, v] = parte.split("=").map((s) => s && s.trim()); if (k && v) r[k] = v; }
  return { ts: r.ts, v1: r.v1 };
}

/** Monta o "manifesto" do Mercado Pago: id:<data.id>;request-id:<x-request-id>;ts:<ts>; (partes ausentes ficam de fora). */
export function manifesto({ dataId, xRequestId, ts }) {
  const p = [];
  if (dataId) p.push(`id:${String(dataId).toLowerCase()}`);
  if (xRequestId) p.push(`request-id:${xRequestId}`);
  p.push(`ts:${ts}`);
  return p.join(";") + ";";
}

export async function avisoAutentico({ xSignature, xRequestId, dataId, segredo }) {
  if (!segredo) return false;
  const { ts, v1 } = lerHeaderAssinatura(xSignature);
  if (!ts || !v1) return false;
  return igual(await hmacHex(segredo, manifesto({ dataId, xRequestId, ts })), v1.toLowerCase());
}
export { hmacHex as _hmacHex };

// ---------- O que muda na assinatura da família ----------
// atual = linha de public.assinaturas; devolve só os campos que mudam (ou null = nada a fazer)

/** Aviso de assinatura (preapproval): authorized / paused / cancelled / pending. */
export function mudancaPorPreapproval(pre, atual, agora = new Date()) {
  if (!pre || !atual || atual.status === "cortesia") return null;
  const mesma = !atual.mp_preapproval_id || atual.mp_preapproval_id === pre.id;
  if (pre.status === "authorized") {
    // libera já: a 1ª cobrança acontece em até ~1 hora; o pagamento aprovado estende o prazo
    const minimo = new Date(agora.getTime() + 2 * DIA);
    return { status: "ativa", mp_preapproval_id: pre.id, valido_ate: maior(atual.valido_ate, minimo).toISOString() };
  }
  if (!mesma) return null;   // avisos de uma assinatura antiga não mexem na atual
  if (pre.status === "cancelled") return atual.status === "cancelada" ? null : { status: "cancelada" };
  if (pre.status === "paused") return atual.status === "pausada" ? null : { status: "pausada" };
  return null;
}

/** Aviso de cobrança (authorized_payment): pagamento aprovado estende 1 mês (+1 dia de folga). */
export function mudancaPorPagamento(ap, atual) {
  if (!ap || !atual || atual.status === "cortesia") return null;
  const st = ap.payment?.status;
  if (st === "approved") {
    const base = new Date(ap.debit_date || ap.date_created || Date.now());
    const ate = new Date(base); ate.setUTCMonth(ate.getUTCMonth() + 1); ate.setUTCDate(ate.getUTCDate() + 1);
    return {
      status: atual.status === "cancelada" ? "cancelada" : "ativa",
      pago: true,
      valido_ate: maior(atual.valido_ate, ate).toISOString(),
      ...(atual.mp_preapproval_id ? {} : { mp_preapproval_id: ap.preapproval_id ?? null })
    };
  }
  if ((st === "rejected" || ap.status === "recycling") && atual.status === "ativa") return { status: "atrasada" };
  return null;
}

/** Corpo para criar a assinatura no Mercado Pago (o cliente conclui no checkout deles). */
export function corpoPreapproval({ familiaId, email, appUrl }) {
  return {
    reason: TITULO,
    external_reference: familiaId,
    payer_email: email,
    auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: PRECO, currency_id: "BRL" },
    back_url: new URL("?assinatura=retorno", appUrl).toString(),
    status: "pending"
  };
}
