/* Plinc — Bloqueio com Face ID (ou digital / biometria do aparelho).
 *
 * Como funciona: ao ligar, o celular cria uma "chave de acesso" (WebAuthn) só para o Plinc.
 * Ao abrir o app (ou voltar depois de 1 minuto fora), a tela fica coberta até o
 * Face ID confirmar que é o dono do aparelho. Quem não conseguir pode entrar de novo
 * com e-mail e senha (isso sai da conta e desliga o bloqueio neste aparelho).
 *
 * É um bloqueio do aparelho, como o dos apps de banco: protege contra alguém que pegue
 * o celular desbloqueado. Os dados continuam protegidos no servidor pelo login de sempre.
 */
"use strict";

const BLOQ_CHAVE = "plinc-bloqueio";
const BLOQ_TEMPO_FORA = 60 * 1000;          // voltou depois de 1 min fora: pede o Face ID de novo

const bloqueio = { travado: false, foraDesde: 0, pedindo: false };

const bloqConfig = () => { try { return JSON.parse(localStorage.getItem(BLOQ_CHAVE)); } catch { return null; } };
const bloqLigado = () => !DEMO && !!bloqConfig()?.id;

function bytesParaB64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64ParaBytes(b64) {
  const s = (b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}
const aleatorio = (n) => crypto.getRandomValues(new Uint8Array(n));

/** Nome da biometria para os textos: "Face ID" no iPhone, "digital" no Android. */
function nomeBiometria() {
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "Face ID";
  if (/android/i.test(ua)) return "digital";
  if (/macintosh/i.test(ua)) return "Touch ID";
  return "biometria";
}

async function biometriaDisponivel() {
  try {
    return !!window.PublicKeyCredential && window.isSecureContext &&
      await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch { return false; }
}

// ---------- Ligar / desligar (Mais → Bloqueio com Face ID) ----------
async function atualizarItemBloqueio() {
  const nome = nomeBiometria();
  const t = $("#bloqueio-titulo"); if (t) t.textContent = nome === "digital" ? "Bloqueio com digital" : "Bloqueio com " + nome;
  const el = $("#bloqueio-estado"); if (!el) return;
  if (DEMO) { el.textContent = "no app real"; return; }
  if (bloqLigado()) { el.textContent = "ligado"; return; }
  el.textContent = (await biometriaDisponivel()) ? "desligado" : "indisponível";
}

async function alternarBloqueio() {
  const nome = nomeBiometria();
  if (DEMO) return toast("O bloqueio com " + nome + " funciona no app de vocês, não na demonstração.");
  if (bloqLigado()) {
    if (!confirm("Desligar o bloqueio com " + nome + " neste aparelho?")) return;
    try { localStorage.removeItem(BLOQ_CHAVE); } catch {}
    toast("Bloqueio desligado neste aparelho");
    return atualizarItemBloqueio();
  }
  if (!(await biometriaDisponivel())) {
    return toast("Este aparelho não tem " + nome + " disponível para o Plinc. Confira se o " + nome + " está ligado nos ajustes do celular.");
  }
  try {
    const nomeUsuario = estado.usuario?.nome || "Plinc";
    const cred = await navigator.credentials.create({ publicKey: {
      challenge: aleatorio(32),
      rp: { name: "Plinc", id: location.hostname },
      user: { id: aleatorio(16), name: "Plinc · " + nomeUsuario, displayName: nomeUsuario },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
      attestation: "none",
      timeout: 60000
    } });
    if (!cred) throw new Error("sem resposta");
    localStorage.setItem(BLOQ_CHAVE, JSON.stringify({ id: bytesParaB64(cred.rawId), usuario: estado.usuario?.id || null, desde: new Date().toISOString() }));
    toast("Pronto! O Plinc vai pedir o " + nome + " sempre que abrir.");
  } catch (e) {
    if (e?.name === "NotAllowedError" || e?.name === "AbortError") toast("Bloqueio não ligado.");
    else erro(e);
  }
  atualizarItemBloqueio();
}

// ---------- Tela de bloqueio ----------
function travarApp() {
  if (!bloqLigado()) return;
  const tela = $("#tela-bloqueio"); if (!tela) return;
  bloqueio.travado = true;
  document.documentElement.classList.add("travado");   // esconde o app na hora, mesmo antes da tela de bloqueio
  $("#bloqueio-erro").textContent = "";
  $("#btn-desbloquear-txt").textContent = "Desbloquear com " + (nomeBiometria() === "digital" ? "a digital" : nomeBiometria());
  // a tela de bloqueio aparece quando a entrada (logo) termina; depois pede o Face ID sozinha
  // (se o celular exigir um toque antes, fica o botão)
  esperarSplash().then(() => {
    if (!bloqueio.travado) return;
    if (!tela.open) tela.showModal();
    setTimeout(() => { if (bloqueio.travado && document.visibilityState === "visible") desbloquear(true); }, 150);
  });
}

function liberarApp() {
  bloqueio.travado = false;
  document.documentElement.classList.remove("travado");
  const tela = $("#tela-bloqueio");
  if (tela?.open) { tela.classList.add("sai"); setTimeout(() => { tela.close(); tela.classList.remove("sai"); }, 220); }
}

async function desbloquear(automatico = false) {
  if (bloqueio.pedindo || !bloqueio.travado) return;
  const cfg = bloqConfig();
  if (!cfg?.id) return liberarApp();
  bloqueio.pedindo = true;
  try {
    const ok = await navigator.credentials.get({ publicKey: {
      challenge: aleatorio(32),
      rpId: location.hostname,
      allowCredentials: [{ type: "public-key", id: b64ParaBytes(cfg.id), transports: ["internal", "hybrid"] }],
      userVerification: "required",
      timeout: 60000
    } });
    if (ok) liberarApp();
  } catch (e) {
    // cancelou (ou o celular pediu um toque): fica na tela com o botão
    if (!automatico) $("#bloqueio-erro").textContent = e?.name === "NotAllowedError"
      ? "Não deu para confirmar. Toque para tentar de novo."
      : "Não foi possível usar o " + nomeBiometria() + " agora.";
  } finally { bloqueio.pedindo = false; }
}

function entrarComSenha() {
  if (!confirm("Sair da conta neste aparelho e entrar de novo com e-mail e senha? O bloqueio é desligado e você pode ligar de novo depois.")) return;
  try { localStorage.removeItem(BLOQ_CHAVE); } catch {}
  liberarApp();
  cacheLocal.limpar(); desligarAoVivo();
  Promise.resolve(sb?.auth.signOut()).catch(() => {}).finally(mostrarLogin);
}

/** Saiu da conta: o bloqueio deste aparelho vai junto. */
function esquecerBloqueio() {
  try { localStorage.removeItem(BLOQ_CHAVE); } catch {}
  if (bloqueio.travado) liberarApp();
}

function ligarBloqueio() {
  $("#btn-bloqueio")?.addEventListener("click", travar(alternarBloqueio));
  $("#btn-desbloquear")?.addEventListener("click", () => desbloquear(false));
  $("#btn-bloqueio-senha")?.addEventListener("click", entrarComSenha);
  const tela = $("#tela-bloqueio");
  tela?.addEventListener("cancel", (ev) => ev.preventDefault());   // Esc não fecha o bloqueio

  // se outra janela (tutorial, guia…) abrir com o app travado, o bloqueio volta para cima dela
  const abrir = HTMLDialogElement.prototype.showModal;
  HTMLDialogElement.prototype.showModal = function () {
    abrir.call(this);
    if (bloqueio.travado && this !== tela && tela?.open) { tela.close(); abrir.call(tela); }
  };

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") { bloqueio.foraDesde = Date.now(); return; }
    if (bloqueio.foraDesde && Date.now() - bloqueio.foraDesde >= BLOQ_TEMPO_FORA && estado.usuario && !$("#app").hidden) travarApp();
    bloqueio.foraDesde = 0;
  });
  atualizarItemBloqueio();
}
