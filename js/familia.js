/* Plinc — Família e convites. */
"use strict";

// ================================================================
// FAMÍLIA E CONVITES
// ================================================================
function renderFamilia() {
  const el = $("#card-familia");
  if (DEMO) { el.hidden = true; return; }
  el.hidden = false;
  if (!estado.familia) {
    el.innerHTML = `<h2>Família</h2><div class="aviso-inline"><strong>Falta um passo no banco de dados</strong><span>Para convidar outras pessoas e famílias, rode <code>supabase/migracao-05-familias.sql</code> no SQL Editor do Supabase.</span></div>`;
    return;
  }
  const souDono = estado.membro?.papel === "dono", souAdmin = !!estado.membro?.admin;
  const membros = (estado.membrosFamilia || []).slice().sort((a, b) => (a.papel === "dono" ? -1 : 1) - (b.papel === "dono" ? -1 : 1) || a.nome.localeCompare(b.nome));
  const pend = (estado.convites || []).filter((c) => !c.aceito_em);
  const daFam = pend.filter((c) => c.familia_id), novas = pend.filter((c) => !c.familia_id);
  el.innerHTML = `
    <div class="cf-topo">
      <span class="bola-cat">${svg("casa")}</span>
      <div><small>Sua família</small><h2>${esc(estado.familia.nome)}</h2></div>
      ${souDono ? `<button type="button" class="btn-link" id="btn-renomear-familia">Renomear</button>` : ""}
    </div>
    <ul class="cf-lista">
      ${membros.map((m) => `
        <li><span class="mini-avatar">${esc(m.nome.charAt(0))}</span>
          <div><b>${esc(m.nome)}${m.user_id === estado.usuario.id ? " (você)" : ""}</b><small>${esc(m.email || "")}${m.papel === "dono" ? " · dono" : ""}</small></div>
          ${souDono && m.user_id !== estado.usuario.id && m.papel !== "dono" ? `<button type="button" class="btn-link perigo" data-remover-membro="${m.user_id}">Remover</button>` : ""}
        </li>`).join("")}
      ${daFam.map((c) => `
        <li class="pendente"><span class="mini-avatar">${esc(c.nome.charAt(0))}</span>
          <div><b>${esc(c.nome)}</b><small>${esc(c.email)} · convite pendente</small></div>
          <button type="button" class="btn-link" data-reenviar-convite="${c.id}">Enviar</button>
          <button type="button" class="btn-link perigo" data-cancelar-convite="${c.id}">Cancelar</button>
        </li>`).join("")}
    </ul>
    <button type="button" class="btn btn-ghost btn-bloco" data-acao="convidar-familia">+ Convidar para esta família</button>
    ${souAdmin ? `
      <div class="cf-admin">
        <b>Outras famílias</b>
        <p class="muted pequeno">Cada família tem os próprios dados; uma não vê a outra.</p>
        ${novas.map((c) => `<div class="cf-conv"><div><b>${esc(c.familia_nome || "Nova família")}</b><small>${esc(c.nome)} · ${esc(c.email)} · pendente</small></div>
          <button type="button" class="btn-link" data-reenviar-convite="${c.id}">Enviar</button><button type="button" class="btn-link perigo" data-cancelar-convite="${c.id}">Cancelar</button></div>`).join("")}
        <button type="button" class="btn btn-ghost btn-bloco" data-acao="convidar-nova">+ Convidar uma nova família</button>
      </div>` : ""}`;
}

let modoConvite = "familia";
function abrirConvite(modo) {
  modoConvite = modo;
  const f = $("#form-convite"); f.reset();
  $("#titulo-convite").textContent = modo === "nova" ? "Convidar uma nova família" : "Convidar para a família";
  $("#explica-convite").innerHTML = modo === "nova"
    ? "A pessoa cria uma <b>família separada</b>, com os próprios dados. Depois ela mesma convida o cônjuge."
    : `A pessoa vai ver e lançar tudo junto com vocês em <b>${esc(estado.familia.nome)}</b>.`;
  $("#lbl-familia-nome").hidden = modo !== "nova";
  $("#convite-campos").hidden = false; $("#convite-pronto").hidden = true;
  $("#convite-enviar").hidden = false; $("#convite-fechar").textContent = "Cancelar";
  $("#modal-convite").showModal();
}

const linkApp = () => location.origin + location.pathname + "?convite";
const msgConvite = (c) => `Oi, ${c.nome}! Te convidei para o app Plinc${c.familia_id ? ` (${estado.familia.nome})` : ""}.\n\n1. Abra: ${linkApp()}\n2. Toque em “Criar minha conta”\n3. Use este e-mail: ${c.email}\n4. Escolha uma senha e confirme pelo e-mail que vai chegar.`;

function mostrarConvitePronto(c) {
  $("#convite-campos").hidden = true; $("#convite-pronto").hidden = false;
  $("#convite-enviar").hidden = true; $("#convite-fechar").textContent = "Fechar";
  $("#titulo-convite").textContent = "Convite criado ✓";
  $("#explica-convite").innerHTML = `Agora mande o link para <b>${esc(c.nome)}</b>. A conta precisa ser criada com <b>${esc(c.email)}</b>.`;
  $("#convite-pronto").innerHTML = `<pre class="msg-convite">${esc(msgConvite(c))}</pre>
    <div class="linha"><button type="button" class="btn btn-primary" id="btn-compartilhar-convite">Compartilhar</button><button type="button" class="btn btn-ghost" id="btn-copiar-convite">Copiar mensagem</button></div>`;
  $("#btn-compartilhar-convite").onclick = async () => {
    try { if (navigator.share) await navigator.share({ title: "Convite", text: msgConvite(c) }); else throw 0; }
    catch { copiarTexto(msgConvite(c)); }
  };
  $("#btn-copiar-convite").onclick = () => copiarTexto(msgConvite(c));
}
function copiarTexto(t) {
  (navigator.clipboard?.writeText(t) || Promise.reject()).then(() => toast("Mensagem copiada"), () => toast("Não deu para copiar: selecione o texto"));
}

async function enviarConvite(ev) {
  const f = ev.target.elements;
  const email = f.email.value.trim().toLowerCase(), nome = f.nome.value.trim();
  if (!email || !nome) return;
  if ((estado.membrosFamilia || []).some((m) => (m.email || "").toLowerCase() === email)) return toast("Essa pessoa já está na família");
  if ((estado.convites || []).some((c) => !c.aceito_em && c.email.toLowerCase() === email)) return toast("Já existe um convite pendente para esse e-mail");
  const linha = modoConvite === "nova" ? { email, nome, familia_id: null, familia_nome: f.familia_nome.value.trim() || `Família de ${nome}` } : { email, nome, familia_id: estado.familia.id };
  try {
    const c = await db.inserir("convites", linha);
    (estado.convites ||= []).push(c);
    renderFamilia();
    mostrarConvitePronto(c);
  } catch (e) { erro(e); }
}

function ligarFamilia() {
  $("#form-convite").addEventListener("submit", travar(enviarConvite));
  document.addEventListener("click", async (ev) => {
    const t = ev.target.closest("[data-acao='convidar-familia'],[data-acao='convidar-nova'],[data-cancelar-convite],[data-reenviar-convite],[data-remover-membro],#btn-renomear-familia");
    if (!t) return;
    if (t.dataset.acao === "convidar-familia") return abrirConvite("familia");
    if (t.dataset.acao === "convidar-nova") return abrirConvite("nova");
    if (t.dataset.reenviarConvite) {
      const c = estado.convites.find((x) => x.id === t.dataset.reenviarConvite);
      abrirConvite(c.familia_id ? "familia" : "nova"); return mostrarConvitePronto(c);
    }
    try {
      if (t.dataset.cancelarConvite) {
        if (!confirm("Cancelar este convite?")) return;
        await db.remover("convites", t.dataset.cancelarConvite);
        estado.convites = estado.convites.filter((x) => x.id !== t.dataset.cancelarConvite);
        renderFamilia(); toast("Convite cancelado");
      } else if (t.dataset.removerMembro) {
        const m = estado.membrosFamilia.find((x) => x.user_id === t.dataset.removerMembro);
        if (!confirm(`Remover ${m.nome} da família?\n\nEla perde o acesso aos dados. Os lançamentos feitos por ela continuam.`)) return;
        const { error } = await sb.from("membros").delete().eq("user_id", m.user_id);
        if (error) throw error;
        estado.membrosFamilia = estado.membrosFamilia.filter((x) => x.user_id !== m.user_id);
        renderFamilia(); toast(`${m.nome} foi removida da família`);
      } else if (t.id === "btn-renomear-familia") {
        const nome = prompt("Nome da família:", estado.familia.nome);
        if (!nome || !nome.trim() || nome.trim() === estado.familia.nome) return;
        estado.familia = await db.atualizar("familias", estado.familia.id, { nome: nome.trim() });
        renderFamilia(); toast("Família renomeada");
      }
    } catch (e) { erro(e); }
  });
}
