// Plinc — o que cada função faz, com as "dependências" recebidas de fora
// (banco, Mercado Pago, usuário) para poder testar sem internet.
import { avisoAutentico, mudancaPorPreapproval, mudancaPorPagamento, corpoPreapproval, ehUUID, ehEmail } from "./regras.js";

const resposta = (status, dados) => ({ status, dados });

/**
 * Aviso do Mercado Pago (webhook).
 * deps: { segredo, mp(caminho) → json, lerAssinatura(familiaId) → linha|null, gravarAssinatura(familiaId, campos) }
 * Nunca confia no conteúdo do aviso: busca o estado de verdade na API do Mercado Pago.
 */
export async function processarAviso({ tipo, dataId, xSignature, xRequestId }, deps) {
  if (!(await avisoAutentico({ xSignature, xRequestId, dataId, segredo: deps.segredo }))) return resposta(401, "assinatura inválida");
  if (!dataId || !/^[\w-]+$/.test(String(dataId))) return resposta(200, "ignorado");

  let familiaId = null, calcular = null;
  if (tipo === "subscription_preapproval") {
    const pre = await deps.mp(`/preapproval/${dataId}`);
    familiaId = pre?.external_reference;
    calcular = (atual) => mudancaPorPreapproval(pre, atual);
  } else if (tipo === "subscription_authorized_payment") {
    const ap = await deps.mp(`/authorized_payments/${dataId}`);
    familiaId = ap?.external_reference;
    if (!ehUUID(familiaId) && ap?.preapproval_id) familiaId = (await deps.mp(`/preapproval/${ap.preapproval_id}`))?.external_reference;
    calcular = (atual) => mudancaPorPagamento(ap, atual);
  } else {
    return resposta(200, "ignorado");
  }
  if (!ehUUID(familiaId)) return resposta(200, "sem família");
  const atual = await deps.lerAssinatura(familiaId);
  const campos = calcular(atual);
  if (campos) await deps.gravarAssinatura(familiaId, campos);
  return resposta(200, campos ? "atualizado" : "sem mudança");
}

/**
 * Pedido do app (pessoa logada): assinar ou cancelar.
 * deps: { usuario() → {id, email}|null, membro(userId) → {familia_id, papel}|null, lerAssinatura, gravarAssinatura,
 *         mp(caminho, {method, body}) → json, appUrl }
 */
export async function pedidoDoApp({ acao, email }, deps) {
  const u = await deps.usuario();
  if (!u) return resposta(401, { erro: "Entre na sua conta de novo." });
  const m = await deps.membro(u.id);
  if (!m?.familia_id) return resposta(403, { erro: "Sua conta não está ligada a uma família." });
  const atual = await deps.lerAssinatura(m.familia_id);
  if (!atual) return resposta(409, { erro: "Assinaturas ainda não estão ativas no servidor (migração 07)." });

  if (acao === "assinar") {
    if (atual.status === "cortesia") return resposta(409, { erro: "Sua família tem acesso cortesia: não precisa assinar." });
    if (atual.status === "ativa" && atual.valido_ate && new Date(atual.valido_ate) > new Date()) return resposta(409, { erro: "Sua assinatura já está ativa." });
    const mail = String(email || u.email || "").trim().toLowerCase();
    if (!ehEmail(mail)) return resposta(400, { erro: "Confira o e-mail do pagamento." });
    const pre = await deps.mp("/preapproval", { method: "POST", body: corpoPreapproval({ familiaId: m.familia_id, email: mail, appUrl: deps.appUrl }) });
    if (!pre?.init_point) return resposta(502, { erro: "O Mercado Pago não respondeu. Tente de novo em instantes." });
    await deps.gravarAssinatura(m.familia_id, { mp_preapproval_id: pre.id, mp_email: mail });
    return resposta(200, { url: pre.init_point });
  }

  if (acao === "cancelar") {
    if (m.papel !== "dono") return resposta(403, { erro: "Só quem é dono da família pode cancelar." });
    if (!atual.mp_preapproval_id || !["ativa", "atrasada", "pausada"].includes(atual.status)) return resposta(409, { erro: "Não há assinatura ativa para cancelar." });
    await deps.mp(`/preapproval/${atual.mp_preapproval_id}`, { method: "PUT", body: { status: "cancelled" } });
    await deps.gravarAssinatura(m.familia_id, { status: "cancelada" });
    return resposta(200, { ok: true, valido_ate: atual.valido_ate });
  }

  return resposta(400, { erro: "Ação desconhecida." });
}
