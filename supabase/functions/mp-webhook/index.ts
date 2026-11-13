// Plinc — recebe os avisos do Mercado Pago (assinatura criada/cancelada, cobrança aprovada/recusada)
// e atualiza a assinatura da família. Publicada com --no-verify-jwt (quem chama é o Mercado Pago);
// a autenticidade é conferida pela assinatura secreta (x-signature) e o estado é buscado na API deles.
import { processarAviso } from "../_shared/acoes.js";
import { lerAssinatura, gravarAssinatura, mp, MP_SEGREDO } from "../_shared/servidor.js";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  const url = new URL(req.url);
  const corpo = await req.json().catch(() => ({}));
  try {
    const r = await processarAviso({
      tipo: url.searchParams.get("type") || corpo.type || url.searchParams.get("topic") || corpo.topic,
      dataId: url.searchParams.get("data.id") || corpo?.data?.id,
      xSignature: req.headers.get("x-signature"),
      xRequestId: req.headers.get("x-request-id")
    }, { segredo: MP_SEGREDO, mp, lerAssinatura, gravarAssinatura });
    return new Response(String(r.dados), { status: r.status });
  } catch (e) {
    console.error(e);
    return new Response("erro", { status: 500 });   // o Mercado Pago tenta de novo depois
  }
});
