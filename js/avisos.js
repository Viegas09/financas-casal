/* Plinc — Avisos de vencimento no celular: liga/desliga a notificação "Amanhã vence…" neste aparelho. */
"use strict";

const pushSuportado = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const ehIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const instalado = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

function base64ParaBytes(b64) {
  const s = (b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function inscricaoAtual() {
  if (!pushSuportado()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

/** Texto do item em Mais → Avisos no celular. */
async function atualizarItemAvisos() {
  const el = $("#avisos-estado"); if (!el) return;
  if (DEMO) { el.textContent = "no app real"; return; }
  if (!pushSuportado()) { el.textContent = ehIOS() && !instalado() ? "instale o app" : "indisponível"; return; }
  const sub = await inscricaoAtual().catch(() => null);
  el.textContent = sub && Notification.permission === "granted" ? "ligados" : Notification.permission === "denied" ? "bloqueados" : "desligados";
}

async function alternarAvisos() {
  if (DEMO) return toast("Os avisos no celular funcionam no app de vocês, não na demonstração.");
  if (!pushSuportado()) {
    return toast(ehIOS() && !instalado()
      ? "No iPhone, primeiro adicione o Plinc à Tela de Início (Compartilhar → Adicionar à Tela de Início) e abra por lá."
      : "Este navegador não aceita avisos. Use o app instalado no celular (Chrome no Android, ou Tela de Início no iPhone).");
  }
  try {
    const atual = await inscricaoAtual();
    if (atual && Notification.permission === "granted") {
      if (!confirm("Desligar os avisos de vencimento neste aparelho?")) return;
      await sb.from("avisos_inscricoes").delete().eq("endpoint", atual.endpoint);
      await atual.unsubscribe();
      toast("Avisos desligados neste aparelho");
      return atualizarItemAvisos();
    }
    const perm = await Notification.requestPermission();
    if (perm !== "granted") { toast("Sem permissão para avisar. Libere as notificações do Plinc nos ajustes do celular."); return atualizarItemAvisos(); }
    const { data, error } = await sb.functions.invoke("avisos", { body: { acao: "chave" } });
    if (error || !data?.chave) return toast("Os avisos ainda não estão configurados no servidor. Tente mais tarde.");
    const reg = await navigator.serviceWorker.ready;
    const sub = atual || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ParaBytes(data.chave) });
    const j = sub.toJSON();
    const { error: e2 } = await sb.from("avisos_inscricoes").upsert({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, aparelho: navigator.userAgent.slice(0, 120) }, { onConflict: "endpoint" });
    if (e2) {
      if (/relation|does not exist|schema cache/i.test(e2.message || "")) return toast("Falta um passo no banco: rodar a migração 08 no Supabase.");
      throw e2;
    }
    await sb.functions.invoke("avisos", { body: { acao: "testar" } }).catch(() => {});
    toast("Avisos ligados! Vamos avisar um dia antes de cada vencimento.");
  } catch (e) { erro(e); }
  atualizarItemAvisos();
}

function ligarAvisos() {
  $("#btn-avisos")?.addEventListener("click", travar(alternarAvisos));
  atualizarItemAvisos();
}
