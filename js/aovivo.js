/* Plinc — Sincronização ao vivo: o que um celular salva aparece nos outros da família.
 * Como funciona: depois de salvar, o celular manda um sinal "mudou" no canal da família
 * (só o sinal, nenhum dado); quem recebe busca os dados de novo no banco (com as regras de segurança de sempre).
 * Também atualiza quando o app volta para a tela depois de um tempo fechado.
 */
"use strict";

const aoVivo = {
  canal: null,
  pendente: null,        // motivo para recarregar: "aviso" (outro celular salvou) ou "volta" (app voltou para a tela)
  timerEnvio: null,
  carregadoEm: 0
};

/** Entra no canal da família (depois do login). */
function ligarAoVivo() {
  if (DEMO || !sb || aoVivo.canal || !estado.familia?.id || typeof sb.channel !== "function") return;
  try {
    aoVivo.canal = sb.channel("plinc-familia:" + estado.familia.id, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "mudou" }, () => { aoVivo.pendente = "aviso"; tentarRecarregar(); })
      .subscribe();
  } catch (e) { console.warn("ao vivo", e); aoVivo.canal = null; }
}

function desligarAoVivo() {
  if (aoVivo.canal && sb?.removeChannel) sb.removeChannel(aoVivo.canal).catch?.(() => {});
  aoVivo.canal = null; aoVivo.pendente = null;
}

/** Depois de salvar algo: avisa os outros celulares (um aviso só, mesmo salvando várias coisas seguidas). */
function avisarFamilia() {
  if (!aoVivo.canal) return;
  clearTimeout(aoVivo.timerEnvio);
  aoVivo.timerEnvio = setTimeout(() => {
    try { aoVivo.canal.send({ type: "broadcast", event: "mudou", payload: {} }); } catch (e) { console.warn("ao vivo", e); }
  }, 300);
}

const formularioAberto = () => !!document.querySelector("dialog[open]") || !!document.querySelector(".arrastando");

/** Recarrega se der: não no meio de um formulário, nem com o app escondido, nem sem internet. */
function tentarRecarregar() {
  if (!aoVivo.pendente || estado.offline || document.visibilityState === "hidden" || formularioAberto()) return;
  const motivo = aoVivo.pendente;
  aoVivo.pendente = null;
  carregar({ silencioso: true }).then((ok) => { if (ok && motivo === "aviso") toast("↻ Atualizado com o outro celular"); });
}

function ligarAtualizacaoAutomatica() {
  if (DEMO) return;
  // chegou aviso com um formulário aberto: recarrega assim que fechar
  setInterval(tentarRecarregar, 1500);
  // voltou para o app depois de 30 s ou mais: busca os dados de novo
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || !estado.validado || estado.offline) return;
    if (Date.now() - aoVivo.carregadoEm > 30000) { aoVivo.pendente ||= "volta"; tentarRecarregar(); }
  });
}
