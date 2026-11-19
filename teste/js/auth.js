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
  ligarPerfil();
  ligarCalendario();
  ligarFamilia();
  ligarAssinatura();
  ligarGuia();
  ligarBloqueio();
  if (typeof ligarAvisos === "function") ligarAvisos();

  ligarOffline();
  ligarAtualizacaoAutomatica();
  registrarSW();

  if (DEMO) {
    $("#banner-demo").hidden = false;
    if (DEMO_PUBLICA) $("#banner-demo").innerHTML = 'Demonstração com dados de exemplo · pode mexer à vontade · <a href="plinc/#preco">Assinar o Plinc</a>';
    estado.usuario = { nome: PESSOAS[0] + " (demo)" };
    return entrarNoApp();
  }

  if (temSessaoSalva()) travarApp();   // bloqueio com Face ID (se ligado neste aparelho)
  abrirComDadosSalvos();   // abre na hora com os dados da última vez (se houver)
  await iniciarSessao();

  sb.auth.onAuthStateChange((evento) => {
    if (evento === "SIGNED_OUT") { esquecerBloqueio(); cacheLocal.limpar(); desligarAoVivo(); mostrarLogin(); }
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
  if (typeof bloqueio !== "undefined" && bloqueio.travado) liberarApp();   // vai digitar a senha mesmo
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
  estado.usuario = { nome: data.nome, id: user.id, email: user.email, desde: user.created_at };
  estado.membro = data;
  estado.familia = null;
  if (data.familia_id) {
    const { data: fam, error: ef } = await sb.from("familias").select("*").eq("id", data.familia_id).maybeSingle();
    if (ef && ehErroDeRede(ef)) throw ef;
    estado.familia = fam || null;
  }
  await carregarAssinatura();
  estado.validado = true;
  definirPessoas(estado.familia?.pessoas);
  definirMoeda(estado.familia?.moeda);
  preencherSelects();
  if (pessoa !== "todos" && !PESSOAS.includes(pessoa)) pessoa = "todos";
  ligarAoVivo();
  const voltouDoCheckout = new URLSearchParams(location.search).get("assinatura") === "retorno";
  if (precisaAssinar()) {
    mostrarTelaAssinar();
    if (voltouDoCheckout) esperarConfirmacao();
    return;
  }
  await entrarNoApp();
  if (voltouDoCheckout) { history.replaceState(null, "", location.pathname); toast("Assinatura confirmada. Obrigado!"); }
}

// A entrada (logo animado) fica pelo menos o tempo da animação; se o app ficar pronto antes, espera ela terminar.
const SPLASH_MINIMO = navigator.webdriver ? 0 : 2000;   // ~1 s com o logo e a frase já parados na tela
let splashSaiu; const promessaSplash = new Promise((ok) => { splashSaiu = ok; });
const esperarSplash = () => promessaSplash;

function esconderSplash() {
  const s = $("#splash");
  if (!s) return splashSaiu();
  if (s.classList.contains("sai")) return;
  s.classList.add("sai");   // marca já, para não agendar duas vezes
  const falta = Math.max(0, SPLASH_MINIMO - performance.now());
  setTimeout(() => {
    s.classList.add("saindo");
    document.documentElement.classList.remove("abrindo");
    splashSaiu();
    setTimeout(() => s.remove(), 600);
  }, falta);
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
  if (typeof abrirTrocarSenha === "function") return abrirTrocarSenha();
}
