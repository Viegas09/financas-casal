/* Plinc — Funcionar sem internet: guarda os últimos dados no aparelho, abre na hora e avisa quando está offline. */
"use strict";

// O que fica guardado no aparelho (só os dados da família de quem está logado; apagado ao sair da conta)
const TABELAS_CACHE = ["contas", "pagamentos", "rendas", "gastos", "orcamentos", "metas", "aportes", "cartoes", "faturas_pagas", "valores_mes", "membrosFamilia", "convites"];
const FLAGS_CACHE = ["migracao2", "migracao3", "migracao4", "migracao6", "migracao7", "assinatura"];

const cacheLocal = {
  pre: "plinc-dados-v1:",
  ultimo: "plinc-ultimo-usuario",
  salvar() {
    if (DEMO || !estado.usuario?.id) return;
    const d = { salvoEm: estado.salvoEm || new Date().toISOString(), usuario: estado.usuario, membro: estado.membro, familia: estado.familia };
    for (const k of [...TABELAS_CACHE, ...FLAGS_CACHE]) d[k] = estado[k];
    try {
      localStorage.setItem(this.pre + estado.usuario.id, JSON.stringify(d));
      localStorage.setItem(this.ultimo, estado.usuario.id);
    } catch (e) { console.warn("Não foi possível guardar os dados no aparelho", e); }
  },
  ler() {
    try { const id = localStorage.getItem(this.ultimo); return id ? JSON.parse(localStorage.getItem(this.pre + id)) : null; } catch { return null; }
  },
  limpar() {
    try { Object.keys(localStorage).filter((k) => k.startsWith(this.pre) || k === this.ultimo).forEach((k) => localStorage.removeItem(k)); } catch {}
  }
};

let timerCache = null;
/** Depois de salvar algo no servidor, atualiza a cópia do aparelho (sem atrapalhar a tela). */
function salvarCacheDepois() {
  if (DEMO) return;
  clearTimeout(timerCache);
  timerCache = setTimeout(() => cacheLocal.salvar(), 400);
}

const temSessaoSalva = () => { try { return Object.keys(localStorage).some((k) => /^sb-.+-auth-token$/.test(k)); } catch { return false; } };

/** Abre o app na hora com os dados da última vez, antes de falar com o servidor. */
function abrirComDadosSalvos() {
  if (DEMO || !temSessaoSalva()) return false;
  const d = cacheLocal.ler();
  if (!d?.usuario?.id) return false;
  if (d.assinatura && !d.assinatura.liberada && d.assinatura.status === "pendente") return false;   // ainda não assinou: não abre o app
  for (const k of [...TABELAS_CACHE, ...FLAGS_CACHE]) if (k in d) estado[k] = d[k];
  estado.usuario = d.usuario; estado.membro = d.membro; estado.familia = d.familia;
  estado.salvoEm = d.salvoEm; estado.doCache = true;
  definirPessoas(estado.familia?.pessoas);
  preencherSelects();
  if (pessoa !== "todos" && !PESSOAS.includes(pessoa)) pessoa = "todos";
  mostrarApp();
  render();
  esconderSplash();
  return true;
}

function quandoFoi(iso) {
  if (!iso) return "antes";
  const d = new Date(iso);
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return d.toDateString() === new Date().toDateString() ? "hoje às " + hora : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " às " + hora;
}

function modoOffline(ligado) {
  estado.offline = ligado;
  const b = $("#banner-offline");
  if (!b) return;
  b.hidden = !ligado;
  if (ligado) b.textContent = `Sem internet · mostrando os dados de ${quandoFoi(estado.salvoEm)}. Para salvar, conecte-se.`;
}

function ligarOffline() {
  if (DEMO) return;
  window.addEventListener("offline", () => { if (estado.usuario) modoOffline(true); });
  window.addEventListener("online", () => {
    if (!estado.offline) return;
    if (estado.doCache && !estado.validado) iniciarSessao(); else carregar();
  });
}

/** Guarda as telas e arquivos do app no celular (abre rápido e sem internet). Só em https. */
function registrarSW() {
  if (!("serviceWorker" in navigator) || !/^https?:$/.test(location.protocol)) return;
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch((e) => console.warn("service worker", e)));
}
