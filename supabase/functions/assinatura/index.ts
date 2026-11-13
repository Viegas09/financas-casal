// Plinc — pedidos do app sobre a assinatura: { acao: "assinar", email } ou { acao: "cancelar" }.
// Publicada sem verificação automática de login (--no-verify-jwt): a própria função confere o login.
import { pedidoDoApp } from "../_shared/acoes.js";
import { usuarioDoPedido, membro, lerAssinatura, gravarAssinatura, mp, cors, APP_URL } from "../_shared/servidor.js";

Deno.serve(async (req) => {
  const h = { ...cors(req), "Content-Type": "application/json" };
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  if (req.method !== "POST") return new Response(JSON.stringify({ erro: "Use POST" }), { status: 405, headers: h });
  try {
    const corpo = await req.json().catch(() => ({}));
    const r = await pedidoDoApp(corpo, {
      usuario: () => usuarioDoPedido(req), membro, lerAssinatura, gravarAssinatura, mp, appUrl: APP_URL
    });
    return new Response(JSON.stringify(r.dados), { status: r.status, headers: h });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ erro: "Não deu certo agora. Tente de novo em instantes." }), { status: 500, headers: h });
  }
});
