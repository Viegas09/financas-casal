// Plinc — avisos de vencimento no celular (notificação push).
// • { acao: "chave" }   → chave pública para o app se inscrever (qualquer um pode pedir).
// • { acao: "testar" }  → manda um aviso de teste para os aparelhos de quem pediu (precisa estar logado).
// • { acao: "enviar" }  → chamado todo dia às 8h pelo agendador do banco (cabeçalho x-plinc-cron com o
//                         código guardado em avisos_config): avisa o que vence amanhã em cada família.
// Publicada com --no-verify-jwt; cada ação confere quem está pedindo.
import webpush from "npm:web-push@3.6.7";
import { vencimentosAmanha, mensagem, hojeBrasil } from "../_shared/avisos.js";
import { rest, usuarioDoPedido, cors, APP_URL } from "../_shared/servidor.js";

const PUB = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const PRIV = Deno.env.get("VAPID_PRIVATE_KEY") || "";
if (PUB && PRIV) webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT") || APP_URL, PUB, PRIV);

const json = (req: Request, dados: unknown, status = 200) =>
  new Response(JSON.stringify(dados), { status, headers: { ...cors(req), "Content-Type": "application/json" } });

/** Manda para cada aparelho; aparelhos que saíram (404/410) são apagados. */
async function mandar(inscricoes: any[], aviso: { titulo: string; corpo: string }) {
  let enviados = 0;
  for (const s of inscricoes) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ ...aviso, url: APP_URL }), { TTL: 12 * 3600 });
      enviados++;
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) await rest(`avisos_inscricoes?id=eq.${s.id}`, { method: "DELETE" }).catch(() => {});
      else console.error("push", e?.statusCode, e?.body || e?.message);
    }
  }
  return enviados;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return new Response("ok");
  const corpo = await req.json().catch(() => ({}));
  try {
    if (corpo.acao === "chave") return json(req, { chave: PUB || null });
    if (!PUB || !PRIV) return json(req, { erro: "Avisos ainda não configurados no servidor (chaves VAPID)." }, 503);

    if (corpo.acao === "testar") {
      const u = await usuarioDoPedido(req);
      if (!u) return json(req, { erro: "Entre no app de novo." }, 401);
      const subs = await rest(`avisos_inscricoes?user_id=eq.${u.id}&select=*`);
      const n = await mandar(subs || [], { titulo: "Avisos ligados ✓", corpo: "Vamos te avisar um dia antes de cada conta e fatura vencer." });
      return json(req, { enviados: n });
    }

    if (corpo.acao === "enviar") {
      const cfg = (await rest("avisos_config?id=eq.1&select=token"))?.[0];
      if (!cfg || req.headers.get("x-plinc-cron") !== cfg.token) return json(req, { erro: "não autorizado" }, 401);
      const subs = (await rest("avisos_inscricoes?select=*")) || [];
      if (!subs.length) return json(req, { familias: 0, enviados: 0 });
      const familias = [...new Set(subs.map((s: any) => s.familia_id).filter(Boolean))];
      const em = `familia_id=in.(${familias.join(",")})`;
      const [contas, pagamentos, valores_mes, cartoes, faturas_pagas, gastos] = await Promise.all([
        rest(`contas?${em}&select=*`), rest(`pagamentos?${em}&select=conta_id,competencia`),
        rest(`valores_mes?${em}&select=conta_id,competencia,valor`).catch(() => []),
        rest(`cartoes?${em}&select=*`).catch(() => []), rest(`faturas_pagas?${em}&select=cartao_id,competencia`).catch(() => []),
        rest(`gastos?${em}&cartao_id=not.is.null&select=id,familia_id,cartao_id,data,valor,parcelas`).catch(() => [])
      ]);
      const venc = vencimentosAmanha({ contas, pagamentos, valores_mes, cartoes, faturas_pagas, gastos }, hojeBrasil());
      const fams = (await rest(`familias?id=in.(${familias.join(",")})&select=id,moeda`).catch(() => [])) || [];
      const moedaDe = (id: string) => fams.find((f: any) => f.id === id)?.moeda || "BRL";
      let enviados = 0;
      for (const [fam, itens] of venc) enviados += await mandar(subs.filter((s: any) => s.familia_id === fam), mensagem(itens, moedaDe(fam)));
      return json(req, { familias: venc.size, enviados });
    }
    return json(req, { erro: "ação desconhecida" }, 400);
  } catch (e) {
    console.error(e);
    return json(req, { erro: "Não foi possível agora. Tente de novo." }, 500);
  }
});
