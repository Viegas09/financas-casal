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
  ligarCalendario();
  ligarFamilia();

  ligarOffline();
  ligarAtualizacaoAutomatica();
  registrarSW();

  if (DEMO) {
    $("#banner-demo").hidden = false;
    if (DEMO_PUBLICA) $("#banner-demo").innerHTML = 'Demonstração com dados de exemplo · pode mexer à vontade · <a href="plinc/#preco">Assinar o Plinc</a>';
    estado.usuario = { nome: PESSOAS[0] + " (demo)" };
    return entrarNoApp();
  }

  abrirComDadosSalvos();   // abre na hora com os dados da última vez (se houver)
  await iniciarSessao();

  sb.auth.onAuthStateChange((evento) => {
    if (evento === "SIGNED_OUT") { cacheLocal.limpar(); desligarAoVivo(); mostrarLogin(); }
    if (evento === "PASSWORD_RECOVERY") trocarSenha();
  });
}

/** Confere a sessão no servidor. Sem internet, segue com os dados guardados (se houver). */
async function iniciarSessao() {
  try {
    const { data, error } = await sb.auth.getSession();
    if (error && ehErroDeRede(error)) throw error;
    if (data?.session) await validarMembro();
    else if (estado.doCache && !navigator.onLine) modoOffline(true);
    else { cacheLocal.limpar(); mostrarLogin(); }
  } catch (e) {
    if (!ehErroDeRede(e)) { console.error(e); esconderSplash(); return toast("Não foi possível entrar: " + (e.message || e)); }
    if (estado.doCache) return modoOffline(true);
    mostrarLogin();
    $("#login-erro").textContent = "Sem internet. Conecte-se para entrar.";
  }
}

function mostrarLogin() {
  esconderSplash();
  $("#app").hidden = true;
  $("#tela-login").hidden = false;
}

async function validarMembro() {
  const { data: { user }, error: eu } = await sb.auth.getUser();
  if (eu && ehErroDeRede(eu)) throw eu;
  if (!user) { cacheLocal.limpar(); return mostrarLogin(); }
  const { data, error } = await sb.from("membros").select("*").eq("user_id", user.id).maybeSingle();
  if (error && ehErroDeRede(error)) throw error;
  if (error || !data) {
    cacheLocal.limpar();
    await sb.auth.signOut();
    $("#login-erro").textContent = "Este usuário não tem acesso ao painel. Peça um convite para quem já usa o app.";
    return mostrarLogin();
  }
  estado.usuario = { nome: data.nome, id: user.id };
  estado.membro = data;
  estado.familia = null;
  if (data.familia_id) {
    const { data: fam, error: ef } = await sb.from("familias").select("*").eq("id", data.familia_id).maybeSingle();
    if (ef && ehErroDeRede(ef)) throw ef;
    estado.familia = fam || null;
  }
  estado.validado = true;
  definirPessoas(estado.familia?.pessoas);
  preencherSelects();
  if (pessoa !== "todos" && !PESSOAS.includes(pessoa)) pessoa = "todos";
  ligarAoVivo();
  entrarNoApp();
}

function esconderSplash() {
  const s = $("#splash"); if (!s || s.classList.contains("sai")) return;
  s.classList.add("sai"); setTimeout(() => s.remove(), 400);
}

function mostrarApp() {
  $("#tela-login").hidden = true;
  $("#app").hidden = false;
  $("#nome-usuario").textContent = estado.usuario.nome;
  $("#avatar").textContent = estado.usuario.nome.charAt(0).toUpperCase();
}

async function entrarNoApp() {
  mostrarApp();
  await carregar();
}

async function trocarSenha() {
  const nova = prompt("Digite sua nova senha (mínimo 8 caracteres):");
  if (!nova || nova.length < 8) return toast("Senha não alterada.");
  const { error } = await sb.auth.updateUser({ password: nova });
  toast(error ? "Erro ao trocar a senha: " + error.message : "Senha alterada!");
}
