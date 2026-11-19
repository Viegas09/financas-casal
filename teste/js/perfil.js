/* Plinc — Perfil: quem está usando o app (nome, e-mail, família, assinatura) e as opções da conta. */
"use strict";

const PAPEL_TXT = { dono: "Dono da família", membro: "Membro da família" };

function renderPerfil() {
  const u = estado.usuario || {}; if (!u.nome) return;
  const nome = u.nome.replace(" (demo)", ""), inicial = nome.charAt(0).toUpperCase();
  const email = u.email || estado.membro?.email || (DEMO ? "demonstracao@plinc.app" : "");
  const fam = estado.familia?.nome || (DEMO ? "Família de demonstração" : "");
  const papel = estado.membro?.papel ? PAPEL_TXT[estado.membro.papel] || "" : "";
  const membros = (estado.membrosFamilia || []).filter((m) => m.user_id !== u.id).map((m) => m.nome);
  const desde = u.desde ? new Date(u.desde).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) : "";
  const sit = typeof textoSituacao === "function" && estado.assinatura ? textoSituacao(estado.assinatura).t : (DEMO ? "Demonstração" : "");
  const sitCls = !estado.assinatura || estado.assinatura.liberada ? "bom" : "crit";

  const at = $("#perfil-atalho-avatar"); if (at) { at.textContent = inicial; $("#perfil-atalho-nome").textContent = nome; }
  const el = $("#perfil-topo"); if (!el) return;
  el.innerHTML = `
    <span class="avatar enorme" aria-hidden="true">${esc(inicial)}</span>
    <h1>${esc(nome)}</h1>
    ${email ? `<p class="muted">${esc(email)}</p>` : ""}
    <div class="perfil-chips">
      ${fam ? `<span class="chip-perfil">${svg("casa")} ${esc(fam)}</span>` : ""}
      ${sit ? `<span class="chip-perfil ${sitCls}">Assinatura: ${esc(sit)}</span>` : ""}
    </div>
    <dl class="perfil-dados">
      ${papel ? `<div><dt>Papel</dt><dd>${esc(papel)}</dd></div>` : ""}
      ${membros.length ? `<div><dt>Divide com</dt><dd>${esc(membros.join(", "))}</dd></div>` : ""}
      ${desde ? `<div><dt>No Plinc desde</dt><dd>${esc(desde)}</dd></div>` : ""}
      <div><dt>Moeda</dt><dd>${esc(typeof nomeMoeda === "function" ? nomeMoeda(MOEDA) : "Real")}</dd></div>
    </dl>`;
  $("#perfil-email").textContent = email;
}

// ---------- Trocar senha (folha própria, no lugar do prompt) ----------
function abrirTrocarSenha() {
  if (DEMO) return toast("No modo demonstração não há senha para trocar.");
  const f = $("#form-senha"); f.reset(); $("#senha-erro").textContent = "";
  $("#modal-senha").showModal();
  setTimeout(() => f.elements.nova.focus(), 50);
}

async function salvarSenha(ev) {
  ev.preventDefault();
  const f = ev.target, nova = f.elements.nova.value, rep = f.elements.repete.value;
  if (nova.length < 8) return ($("#senha-erro").textContent = "A senha precisa ter pelo menos 8 caracteres.");
  if (nova !== rep) return ($("#senha-erro").textContent = "As duas senhas não são iguais.");
  const btn = f.querySelector("[type=submit]"); btn.disabled = true;
  const { error } = await sb.auth.updateUser({ password: nova });
  btn.disabled = false;
  if (error) return ($("#senha-erro").textContent = "Não consegui trocar a senha: " + error.message);
  $("#modal-senha").close();
  toast("Senha alterada!");
}

function ligarPerfil() {
  $("#btn-trocar-senha").addEventListener("click", abrirTrocarSenha);
  $("#form-senha").addEventListener("submit", salvarSenha);
}
