/* Plinc — Login, cadastro e entrada no app. */
"use strict";

// ================================================================
// AUTENTICAÇÃO
// ================================================================
async function iniciar() {
  preencherSelects();
  ligarEventos();
  ligarTutorial();
  ligarArraste();
  ligarImportar();
  ligarFamilia();

  if (DEMO) {
    $("#banner-demo").hidden = false;
    estado.usuario = { nome: PESSOAS[0] + " (demo)" };
    return entrarNoApp();
  }

  const { data } = await sb.auth.getSession();
  if (data.session) await validarMembro(); else mostrarLogin();

  sb.auth.onAuthStateChange((evento) => {
    if (evento === "SIGNED_OUT") mostrarLogin();
    if (evento === "PASSWORD_RECOVERY") trocarSenha();
  });
}

function mostrarLogin() {
  esconderSplash();
  $("#app").hidden = true;
  $("#tela-login").hidden = false;
}

async function validarMembro() {
  const { data: { user } } = await sb.auth.getUser();
  const { data, error } = await sb.from("membros").select("*").eq("user_id", user.id).maybeSingle();
  if (error || !data) {
    await sb.auth.signOut();
    $("#login-erro").textContent = "Este usuário não tem acesso ao painel. Peça um convite para quem já usa o app.";
    return mostrarLogin();
  }
  estado.usuario = { nome: data.nome, id: user.id };
  estado.membro = data;
  estado.familia = null;
  if (data.familia_id) {
    const { data: fam } = await sb.from("familias").select("*").eq("id", data.familia_id).maybeSingle();
    estado.familia = fam || null;
  }
  definirPessoas(estado.familia?.pessoas);
  preencherSelects();
  if (pessoa !== "todos" && !PESSOAS.includes(pessoa)) pessoa = "todos";
  entrarNoApp();
}

function esconderSplash() {
  const s = $("#splash"); if (!s || s.classList.contains("sai")) return;
  s.classList.add("sai"); setTimeout(() => s.remove(), 400);
}

async function entrarNoApp() {
  $("#tela-login").hidden = true;
  $("#app").hidden = false;
  $("#nome-usuario").textContent = estado.usuario.nome;
  $("#avatar").textContent = estado.usuario.nome.charAt(0).toUpperCase();
  await carregar();
}

async function trocarSenha() {
  const nova = prompt("Digite sua nova senha (mínimo 8 caracteres):");
  if (!nova || nova.length < 8) return toast("Senha não alterada.");
  const { error } = await sb.auth.updateUser({ password: nova });
  toast(error ? "Erro ao trocar a senha: " + error.message : "Senha alterada!");
}
