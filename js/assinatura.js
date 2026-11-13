/* Plinc — Assinatura (Mercado Pago): tela para assinar, situação em Mais, modo só consulta e volta do checkout.
 * Quem libera ou bloqueia é o banco (migração 07); o app só mostra e evita tentar gravar quando não pode.
 * Sem a migração 07 no banco, nada disso aparece e o app funciona como antes.
 */
"use strict";

const PRECO_TXT = "R$ 19,90";

/** Busca a situação da assinatura no servidor (calculada lá, com o relógio certo). */
async function carregarAssinatura() {
  estado.assinatura = null; estado.migracao7 = false;
  if (DEMO || !sb?.rpc) return;
  const { data, error } = await sb.rpc("minha_assinatura");
  if (error) {
    if (ehErroDeRede(error)) throw error;
    return;   // migração 07 ainda não rodou: tudo como antes
  }
  estado.migracao7 = true;
  estado.assinatura = data || null;
}

const assinaturaLiberada = () => DEMO || !estado.assinatura || !!estado.assinatura.liberada;
/** Família nova que ainda não pagou: mostra a tela de assinar em vez do app. */
const precisaAssinar = () => !DEMO && !!estado.assinatura && !estado.assinatura.liberada && estado.assinatura.status === "pendente";

/** Antes de gravar: sem assinatura em dia, avisa em vez de tentar. */
function exigirAssinatura() {
  if (assinaturaLiberada()) return;
  throw Object.assign(new Error("Sua assinatura não está em dia: dá para consultar tudo, mas para lançar é preciso renovar em Mais → Sua assinatura."), { amigavel: true });
}

const dataBR = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "");
/** Para onde mandar a pessoa (separado para os testes poderem trocar). */
function abrirCheckout(url) { location.assign(url); }

// ---------- Tela "Ative sua assinatura" ----------
function mostrarTelaAssinar({ voltar = false } = {}) {
  esconderSplash();
  $("#tela-assinar").dataset.voltar = voltar ? "1" : "";
  $("#btn-sair-assinar").textContent = voltar ? "Voltar para o app" : "Sair da conta";
  $("#app").hidden = true;
  $("#tela-login").hidden = true;
  $("#tela-assinar").hidden = false;
  $("#assinar-nome").textContent = (estado.usuario?.nome || "").split(" ")[0];
  const f = $("#form-assinar");
  if (!f.elements.email.value) f.elements.email.value = estado.assinatura?.mp_email || estado.membro?.email || "";
}

async function mensagemDaFuncao(error) {
  try { const j = await error.context.json(); if (j?.erro) return j.erro; } catch {}
  return ehErroDeRede(error) ? "Sem internet: tente de novo quando a conexão voltar." : "Não deu certo agora. Tente de novo em instantes.";
}

async function iniciarCheckout(ev) {
  ev?.preventDefault?.();
  const msg = $("#assinar-msg");
  const email = ($("#form-assinar").elements.email.value || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.textContent = "Confira o e-mail do pagamento."; return; }
  msg.textContent = "Abrindo o Mercado Pago…";
  const { data, error } = await sb.functions.invoke("assinatura", { body: { acao: "assinar", email } });
  if (error || !data?.url) { msg.textContent = error ? await mensagemDaFuncao(error) : "O Mercado Pago não respondeu. Tente de novo."; return; }
  abrirCheckout(data.url);
}

// ---------- Volta do checkout: espera o aviso do Mercado Pago ----------
async function esperarConfirmacao() {
  const tela = !$("#tela-assinar").hidden;
  const msg = (t) => { if (tela) $("#assinar-msg").textContent = t; };
  msg("Recebendo a confirmação do Mercado Pago…");
  history.replaceState(null, "", location.pathname);
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, i < 10 ? 2000 : 4000));
    try { await carregarAssinatura(); } catch { continue; }
    if (assinaturaLiberada() && estado.assinatura?.status !== "pendente") {
      $("#tela-assinar").hidden = true;
      toast("Assinatura ativa! Bem-vindos ao Plinc.");
      if (tela) await entrarNoApp(); else { atualizarBannerAssinatura(); renderCardAssinatura(); }
      return;
    }
  }
  msg("Ainda não chegou a confirmação. Se você concluiu o pagamento, ela chega em alguns minutos: toque em “Já paguei, atualizar”.");
}

async function atualizarAssinaturaManual() {
  $("#assinar-msg").textContent = "Conferindo…";
  try { await carregarAssinatura(); } catch (e) { $("#assinar-msg").textContent = await mensagemDaFuncao(e); return; }
  if (!precisaAssinar()) { $("#tela-assinar").hidden = true; toast("Assinatura ativa! Bem-vindos ao Plinc."); return entrarNoApp(); }
  $("#assinar-msg").textContent = "Ainda não recebemos a confirmação do pagamento.";
}

// ---------- Aviso no topo (assinatura vencida: só consulta) ----------
function atualizarBannerAssinatura() {
  const b = $("#banner-assinatura");
  if (!b) return;
  const a = estado.assinatura;
  const mostrar = !DEMO && !!a && !a.liberada && a.status !== "pendente";
  b.hidden = !mostrar;
  if (mostrar) b.innerHTML = `Assinatura vencida: seus dados estão guardados, mas só dá para consultar. <button type="button" class="btn-link" data-acao="renovar-assinatura">Renovar</button>`;
}

// ---------- Cartão "Sua assinatura" (Mais) ----------
function textoSituacao(a) {
  if (!a) return { t: "", d: "" };
  const ate = dataBR(a.valido_ate), tol = dataBR(a.tolerancia_ate);
  switch (a.status) {
    case "cortesia": return { t: "Cortesia", d: "Acesso completo, sem cobrança." };
    case "pendente": return { t: "Aguardando pagamento", d: "Assine para começar a lançar." };
    case "ativa": return a.liberada ? { t: "Ativa", d: `${PRECO_TXT}/mês · próxima cobrança por volta de ${ate}.` } : { t: "Vencida", d: "Renove para voltar a lançar." };
    case "atrasada": case "pausada": return a.liberada ? { t: "Pagamento não confirmado", d: `O Mercado Pago está tentando cobrar de novo. Tudo liberado até ${tol}.` } : { t: "Vencida", d: "Renove para voltar a lançar." };
    case "cancelada": return a.liberada ? { t: "Cancelada", d: `Você usa normalmente até ${ate}.` } : { t: "Cancelada", d: "Assine de novo para voltar a lançar." };
    default: return { t: a.status, d: "" };
  }
}

function renderCardAssinatura() {
  const el = $("#card-assinatura");
  if (!el) return;
  if (DEMO || !estado.migracao7 || !estado.assinatura) { el.hidden = true; return; }
  const a = estado.assinatura, s = textoSituacao(a);
  const souDono = estado.membro?.papel === "dono";
  const podeCancelar = souDono && ["ativa", "atrasada", "pausada"].includes(a.status) && a.liberada;
  const podeAssinar = a.status !== "cortesia" && (a.status === "pendente" || a.status === "cancelada" || !a.liberada);
  el.hidden = false;
  el.innerHTML = `
    <div class="cf-topo">
      <span class="bola-cat">${svg("moeda")}</span>
      <div><small>Sua assinatura</small><h2>${esc(s.t)}</h2></div>
    </div>
    <p class="muted">${esc(s.d)}</p>
    ${podeAssinar ? `<button type="button" class="btn btn-primary btn-bloco" data-acao="renovar-assinatura">${a.status === "pendente" ? "Assinar" : "Assinar de novo"} · ${PRECO_TXT}/mês</button>` : ""}
    ${podeCancelar ? `<button type="button" class="btn-link perigo" data-acao="cancelar-assinatura">Cancelar assinatura</button>` : ""}`;
}

async function cancelarAssinatura() {
  const a = estado.assinatura;
  if (!confirm(`Cancelar a assinatura? Vocês continuam usando até ${dataBR(a?.valido_ate)} e nada é apagado.`)) return;
  const { data, error } = await sb.functions.invoke("assinatura", { body: { acao: "cancelar" } });
  if (error || !data?.ok) return toast(error ? await mensagemDaFuncao(error) : "Não foi possível cancelar agora.");
  await carregarAssinatura();
  renderCardAssinatura(); atualizarBannerAssinatura();
  toast("Assinatura cancelada. Vocês usam até " + dataBR(estado.assinatura?.valido_ate) + ".");
}

function renovarAssinatura() { mostrarTelaAssinar({ voltar: true }); }

function ligarAssinatura() {
  $("#form-assinar").addEventListener("submit", travar(iniciarCheckout));
  $("#btn-ja-paguei").addEventListener("click", travar(atualizarAssinaturaManual));
  $("#btn-sair-assinar").addEventListener("click", () => {
    $("#tela-assinar").hidden = true;
    if ($("#tela-assinar").dataset.voltar) { $("#app").hidden = false; return; }
    cacheLocal.limpar(); desligarAoVivo(); sb.auth.signOut(); mostrarLogin();
  });
  document.addEventListener("click", (ev) => {
    const t = ev.target.closest("[data-acao=renovar-assinatura],[data-acao=cancelar-assinatura]");
    if (!t) return;
    if (t.dataset.acao === "renovar-assinatura") renovarAssinatura();
    else travar(cancelarAssinatura)(ev);
  });
}
