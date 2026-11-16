// Plinc — ligação das funções com o banco (Supabase) e com a API do Mercado Pago. Só roda no servidor.
/* global Deno */
const env = (k) => Deno.env.get(k) || "";

export const SUPABASE_URL = env("SUPABASE_URL");
// chave de serviço: a antiga (JWT) ou a nova (sb_secret_...)
export const CHAVE_SERVICO = env("SUPABASE_SERVICE_ROLE_KEY") || (() => {
  try { const k = JSON.parse(env("SUPABASE_SECRET_KEYS") || "{}"); return k.default || Object.values(k)[0] || ""; } catch { return ""; }
})();
export const APP_URL = env("APP_URL") || "https://viegas09.github.io/financas-casal/";
const MP_TOKEN = env("MP_ACCESS_TOKEN");
export const MP_SEGREDO = env("MP_WEBHOOK_SECRET");

const cabecalhosServico = () => ({
  apikey: CHAVE_SERVICO,
  ...(CHAVE_SERVICO.startsWith("eyJ") ? { Authorization: `Bearer ${CHAVE_SERVICO}` } : {}),
  "Content-Type": "application/json"
});

export async function lerAssinatura(familiaId) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/assinaturas?familia_id=eq.${familiaId}&select=*`, { headers: cabecalhosServico() });
  if (!r.ok) throw new Error("ler assinatura: " + r.status + " " + (await r.text()));
  return (await r.json())[0] || null;
}

export async function gravarAssinatura(familiaId, campos) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/assinaturas?familia_id=eq.${familiaId}`, {
    method: "PATCH", headers: { ...cabecalhosServico(), Prefer: "return=minimal" },
    body: JSON.stringify({ ...campos, atualizado_em: new Date().toISOString() })
  });
  if (!r.ok) throw new Error("gravar assinatura: " + r.status + " " + (await r.text()));
}

export async function membro(userId) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/membros?user_id=eq.${userId}&select=familia_id,papel`, { headers: cabecalhosServico() });
  if (!r.ok) throw new Error("ler membro: " + r.status);
  return (await r.json())[0] || null;
}

/** Quem está pedindo (pelo token de login enviado pelo app). */
export async function usuarioDoPedido(req) {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: CHAVE_SERVICO, Authorization: auth } });
  if (!r.ok) return null;
  const u = await r.json();
  return u?.id ? { id: u.id, email: u.email } : null;
}

export async function mp(caminho, { method = "GET", body } = {}) {
  const r = await fetch(`https://api.mercadopago.com${caminho}`, {
    method,
    headers: { Authorization: `Bearer ${MP_TOKEN}`, "Content-Type": "application/json", ...(method === "POST" ? { "X-Idempotency-Key": crypto.randomUUID() } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Mercado Pago ${method} ${caminho}: ${r.status} ${JSON.stringify(dados).slice(0, 300)}`);
  return dados;
}

export function cors(req) {
  const origem = req.headers.get("Origin") || "";
  const permitida = origem && (APP_URL.startsWith(origem) || /^https:\/\/([a-z0-9-]+\.)?useplinc\.com\.br$/.test(origem) || /^http:\/\/localhost(:\d+)?$/.test(origem));
  return {
    "Access-Control-Allow-Origin": permitida ? origem : new URL(APP_URL).origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin"
  };
}
