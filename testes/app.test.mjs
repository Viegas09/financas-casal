// Testes das telas do app num navegador de verdade (Chromium), sem internet:
// • modo demonstração (dados de exemplo no navegador)
// • Supabase simulado (login, famílias, convites) — fixtures/supabase-simulado.js
import { chromium } from "playwright";
import fs from "fs";

const RAIZ = new URL("../", import.meta.url).pathname;
const URL_APP = "file://" + RAIZ + "index.html";
const FIX = (f) => new URL("./fixtures/" + f, import.meta.url).pathname;
const configOriginal = fs.readFileSync(RAIZ + "js/config.js", "utf8");
const cfgDemo = configOriginal.replace(/SUPABASE_URL: "[^"]*"/, 'SUPABASE_URL: ""');
const cfgMock = configOriginal.replace(/SUPABASE_URL: "[^"]*"/, 'SUPABASE_URL: "https://simulado.supabase.co"').replace(/SUPABASE_ANON_KEY: "[^"]*"/, 'SUPABASE_ANON_KEY: "x"');
const simulado = fs.readFileSync(FIX("supabase-simulado.js"), "utf8");

let falhas = 0;
const ok = (c, m) => { if (!c) falhas++; console.log((c ? "✅ " : "❌ ") + m); };
const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});

async function pagina({ mock = null, limpar = true, armazenar = null, url = URL_APP, antes = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  p.erros = [];
  p.on("pageerror", (e) => p.erros.push(String(e)));
  await p.route("**/js/config.js*", (r) => r.fulfill({ body: mock ? cfgMock : cfgDemo, contentType: "application/javascript" }));
  await p.route("**/supabase-js@2", (r) => r.fulfill({ body: mock ? simulado : "", contentType: "application/javascript" }));
  await p.addInitScript(([m, l, a]) => {
    if (m) window.__MOCK = m;
    if (a) for (const [k, v] of Object.entries(a)) localStorage.setItem(k, v);
    if (l && !sessionStorage.getItem("ja")) { localStorage.clear(); sessionStorage.setItem("ja", "1"); }
    localStorage.setItem("fc-tutorial-visto", "true"); localStorage.setItem("fc-aviso-contas-ok", "true");
  }, [mock, limpar, armazenar]);
  if (antes) await p.addInitScript(antes);
  await p.goto(url);
  await p.waitForTimeout(1200);
  return p;
}
const aba = (p, a) => p.click(`.tabbar [data-aba=${a}]`);

// ================= MODO DEMONSTRAÇÃO =================
{
  const p = await pagina();
  ok(await p.isVisible("#app"), "app abre no modo demonstração");
  ok(/R\$/.test(await p.innerText("#hero-total")), "cartão inicial mostra o total do mês");
  for (const a of ["contas", "gastos", "metas", "mais", "inicio"]) { await aba(p, a); await p.waitForTimeout(150); }
  ok(p.erros.length === 0, "navega por todas as abas sem erro de JavaScript");

  // tipos de conta
  await aba(p, "contas"); await p.click("#filtro-status [data-f=todas]");
  const novaConta = async (nome, valor, tipo) => {
    await p.click("#aba-contas .btn-add"); await p.waitForTimeout(250);
    await p.fill("#form-conta [name=nome]", nome); await p.fill("#form-conta [name=valor]", valor); await p.fill("#form-conta [name=dia_vencimento]", "10");
    await p.selectOption("#sel-cat-conta", "Outros");
    if (tipo) await p.click(`#tipos-conta [data-t="${tipo}"]`);
    await p.click("#form-conta button[type=submit]"); await p.waitForTimeout(350);
  };
  await novaConta("Sem tipo", "10", null);
  ok(await p.evaluate(() => document.querySelector("#modal-conta").open), "conta sem escolher o tipo não salva");
  await p.keyboard.press("Escape"); await p.waitForTimeout(250);
  await novaConta("Fixa T", "1.000", "fixo"); await novaConta("Variavel T", "1.000", "variavel"); await novaConta("Unica T", "1.000", "unico");
  const valor = async (n) => { const l = p.locator("#lista-mes li", { hasText: n }); return (await l.count()) ? (await l.locator(".valor").innerText()).replace(/\s/g, " ") : "—"; };
  ok(await valor("Fixa T") === "R$ 1.000,00", "“1.000” é lido como mil reais");
  await p.click("#mes-proximo"); await p.waitForTimeout(250);
  ok(await valor("Fixa T") === "R$ 1.000,00" && (await valor("Variavel T")).startsWith("a definir") && await valor("Unica T") === "—",
    "mês seguinte: fixa repete, variável fica “a definir”, “só neste mês” some");
  // informar o valor do mês numa conta variável “a definir”
  const totalAntes = await p.innerText("#resumo-contas .rc-topo b");
  await p.click('#lista-mes li:has-text("Variavel T") [data-informar]'); await p.waitForTimeout(300);
  await p.fill("#form-valor-mes [name=valor]", "750"); await p.click("#form-valor-mes button[type=submit]"); await p.waitForTimeout(400);
  const totalDepois = await p.innerText("#resumo-contas .rc-topo b");
  ok((await valor("Variavel T")).startsWith("R$ 750,00") && totalAntes !== totalDepois, "informar valor do mês: “a definir” vira R$ 750,00 e entra no total");
  await p.click("#mes-proximo"); await p.waitForTimeout(250);
  ok(await valor("Variavel T") === "a definir✎" || (await valor("Variavel T")).startsWith("a definir"), "o valor informado vale só para aquele mês");
  await p.click("#mes-anterior"); await p.waitForTimeout(250);
  await novaConta("Variavel Futura", "500,00", "variavel");
  ok((await valor("Variavel Futura")).startsWith("R$ 500,00"), "variável criada para um mês futuro mostra o valor cadastrado nesse mês");
  await p.click("#mes-anterior"); await p.waitForTimeout(250);

  // gasto: categoria obrigatória e trava contra duplicar
  await aba(p, "gastos"); await p.click("#aba-gastos .btn-add"); await p.waitForTimeout(250);
  await p.fill("#form-gasto [name=valor]", "30"); await p.fill("#form-gasto [name=descricao]", "Teste");
  await p.click("#form-gasto button[type=submit]"); await p.waitForTimeout(250);
  ok(await p.evaluate(() => document.querySelector("#chips-cat").classList.contains("erro")), "gasto sem categoria destaca as categorias");
  await p.click('#chips-cat [data-cat="Lazer"]');
  const antes = await p.evaluate(() => JSON.parse(localStorage.getItem("financas-casal-demo")).gastos.length);
  await p.evaluate(() => { const b = document.querySelector("#form-gasto button[type=submit]"); b.click(); b.click(); b.click(); });
  await p.waitForTimeout(500);
  ok(await p.evaluate(() => JSON.parse(localStorage.getItem("financas-casal-demo")).gastos.length) === antes + 1, "3 toques em Salvar = 1 gasto só");

  // arrastar para excluir
  await p.click("#seg-gastos [data-g=extrato]"); await p.waitForTimeout(250);
  const n0 = await p.locator("#extrato .swipe").count();
  await p.evaluate(() => {
    const el = document.querySelector("#extrato .swipe .item"), r = el.getBoundingClientRect(), y = r.top + r.height / 2, x0 = r.right - 30;
    const t = (x) => new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
    el.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, touches: [t(x0)], changedTouches: [t(x0)] }));
    for (let i = 1; i <= 8; i++) el.dispatchEvent(new TouchEvent("touchmove", { bubbles: true, touches: [t(x0 - 260 * i / 8)], changedTouches: [t(x0 - 260 * i / 8)] }));
    el.dispatchEvent(new TouchEvent("touchend", { bubbles: true, touches: [], changedTouches: [t(x0 - 260)] }));
  });
  await p.waitForTimeout(700);
  ok(await p.locator("#extrato .swipe").count() === n0 - 1, "arrastar um gasto até o fim exclui");
  await p.click("#toast button"); await p.waitForTimeout(400);
  ok(await p.locator("#extrato .swipe").count() === n0, "“Desfazer” devolve o gasto");

  // importar extratos
  const importar = async (arq) => {
    await p.click('#aba-gastos [data-acao="importar"]'); await p.waitForTimeout(250);
    await p.setInputFiles("#imp-file", FIX(arq)); await p.waitForTimeout(450);
    const itens = await p.evaluate(() => [...document.querySelectorAll("#imp-lista .imp-item")].map((li) => ({ d: li.querySelector(".imp-desc").textContent, on: li.classList.contains("on"), cat: li.querySelector("select")?.value })));
    return itens;
  };
  const marcados = (it) => it.filter((x) => x.on).map((x) => x.d);
  let it = await importar("nubank-fatura.csv");
  ok(it.length === 7 && marcados(it).length === 6 && !marcados(it).includes("Pagamento recebido"), "Nubank fatura: 6 compras marcadas, pagamento desmarcado");
  ok(it.find((x) => x.d.startsWith("Ifood")).cat === "Restaurantes e delivery" && it.find((x) => x.d.startsWith("Drogasil")).cat === "Farmácia", "categorias sugeridas (iFood, Drogasil)");
  await p.click("#imp-confirmar"); await p.waitForTimeout(450);
  it = await importar("nubank-fatura.csv");
  ok(marcados(it).length === 0, "importar o mesmo arquivo de novo não duplica (tudo “já lançado”)");
  await p.keyboard.press("Escape"); await p.waitForTimeout(250);
  it = await importar("inter.csv");
  ok(it.some((x) => x.d === "POSTO SHELL") && marcados(it).length === 2, "Inter (Latin-1, ;, 1.234,56): descrição e valores certos");
  await p.keyboard.press("Escape"); await p.waitForTimeout(250);
  it = await importar("cartao.ofx");
  ok(it.length === 4 && marcados(it).length === 3, "OFX de cartão: 3 compras, pagamento de fatura desmarcado");
  await p.keyboard.press("Escape"); await p.waitForTimeout(250);
  it = await importar("mercadopago.csv");
  ok(marcados(it).length === 2 && !marcados(it).some((d) => /Cofrinho|Rendimentos|recebida/.test(d)), "Mercado Pago: só compras; cofrinho, rendimentos e Pix recebido de fora");
  await p.keyboard.press("Escape"); await p.waitForTimeout(250);
  it = await importar("nubank-conta.csv");
  ok(!marcados(it).some((d) => /Aluguel|ENEL/i.test(d)), "extrato da conta: Pix do aluguel e boleto de luz ficam desmarcados (contas fixas)");
  await p.keyboard.press("Escape"); await p.waitForTimeout(250);
  it = await importar("debcred.csv");
  ok(marcados(it).length === 1, "planilha com colunas de crédito e débito");
  // lembretes no calendário
  await p.evaluate(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close())); await p.waitForTimeout(200);
  await aba(p, "mais"); await p.waitForTimeout(200);
  await p.click("#btn-calendario"); await p.waitForTimeout(250);
  ok(await p.evaluate(() => document.querySelector("#modal-calendario").open) && /Vão entrar \d+ conta/.test(await p.innerText("#cal-resumo")), "lembretes no calendário: mostra quantas contas vão entrar");
  const [dl] = await Promise.all([p.waitForEvent("download"), p.click("#cal-baixar")]);
  const ics = fs.readFileSync(await dl.path(), "utf8");
  const esperado = await p.evaluate(() => { const i = itensDoCalendario("todas", true); return i.contas.length + i.cartoes.length; });
  ok(dl.suggestedFilename() === "plinc-vencimentos.ics" && ics.startsWith("BEGIN:VCALENDAR") && ics.trim().endsWith("END:VCALENDAR") && (ics.match(/BEGIN:VEVENT/g) || []).length === esperado,
    "baixa o arquivo .ics com um evento por conta/fatura");
  ok(/RRULE:FREQ=MONTHLY;BYMONTHDAY=\d+/.test(ics) && (ics.match(/BEGIN:VALARM/g) || []).length === esperado * 2, "eventos se repetem todo mês e avisam na véspera e no dia");
  ok(await p.evaluate(() => regraMensal(31) === "FREQ=MONTHLY;BYMONTHDAY=28,29,30,31;BYSETPOS=-1" && regraMensal(10) === "FREQ=MONTHLY;BYMONTHDAY=10"), "vencimento dia 31 cai no último dia em meses curtos");
  const unica = await p.evaluate(() => gerarICS({ contas: [{ id: "u", nome: "IPVA", valor: 10, dia_vencimento: 20, responsavel: "Casal", ativa: true, inicio: compDe(new Date()), fim: compDe(new Date()) }], cartoes: [] }));
  ok(!unica.includes("RRULE") && unica.includes("SUMMARY:Vence: IPVA"), "conta “só neste mês” vira um lembrete único");
  const cartao = await p.evaluate(() => itensDoCalendario("todas", true).contas.some((c) => c.cartao_id));
  ok(!cartao, "contas pagas no cartão ficam de fora (entram na fatura)");
  ok(p.erros.length === 0, "modo demonstração sem erros de JavaScript " + p.erros.join(" | "));
}

// ================= SUPABASE SIMULADO =================
const VINI = { id: "u-vini", email: "vini@x.com", senha: "123456" };
const tabs = () => ({ contas: [{ id: "c1", nome: "Aluguel", categoria: "Moradia", valor: 2200, dia_vencimento: 5, responsavel: "Casal", ativa: true, inicio: "2026-01-01", variavel: false, fim: null, cartao_id: null }],
  pagamentos: [], rendas: [], gastos: [], orcamentos: [{ id: "o1", categoria: "Mercado", limite: 1000, ativa: true }], metas: [], aportes: [], cartoes: [], faturas_pagas: [] });
const entrar = async (p, email = "vini@x.com", { manterGuia = false } = {}) => {
  await p.fill("#form-login [name=email]", email); await p.fill("#form-login [name=senha]", "123456"); await p.click("#btn-login"); await p.waitForTimeout(800);
  // família vazia abre a configuração inicial; nos testes que não são sobre ela, fecha
  if (!manterGuia && await p.evaluate(() => document.querySelector("#modal-guia")?.open)) { await p.click("#guia-fechar"); await p.waitForTimeout(200); }
};
{
  const p = await pagina({ mock: { usuarios: [VINI], tabelas: { ...tabs(), membros: [{ user_id: "u-vini", nome: "Vinícius" }] } } });
  await entrar(p);
  ok(await p.isVisible("#app") && (await p.innerText("#hero-total")).includes("2.200"), "banco SEM a migração 05: login e dados funcionam como antes");
  await aba(p, "mais"); await p.waitForTimeout(200);
  ok((await p.innerText("#card-familia")).includes("migracao-05"), "sem a migração, a área Família pede para rodar a 05");
  ok(p.erros.length === 0, "sem erros de JavaScript (banco atual)");
}
{
  const p = await pagina({ mock: { usuarios: [VINI], tabelas: { ...tabs(),
    membros: [{ user_id: "u-vini", nome: "Vinícius", familia_id: "f1", papel: "dono", admin: true, email: "vini@x.com" }, { user_id: "u-ma", nome: "Marcela", familia_id: "f1", papel: "dono", admin: true, email: "marcela@x.com" }],
    familias: [{ id: "f1", nome: "Vinícius & Marcela", pessoas: ["Vinícius", "Marcela"] }], convites: [] } } });
  await entrar(p);
  await aba(p, "mais"); await p.waitForTimeout(250);
  const t = await p.innerText("#card-familia");
  ok(t.includes("Vinícius & Marcela") && t.includes("Outras famílias"), "depois da 05: área Família com membros e convite de nova família (admin)");
  ok(!(await p.locator("[data-remover-membro]").count()), "um dono não aparece como removível para o outro dono");
  await p.click('[data-acao="convidar-nova"]'); await p.waitForTimeout(250);
  await p.fill("#form-convite [name=nome]", "Ana"); await p.fill("#form-convite [name=email]", "Ana@X.com"); await p.fill("#form-convite [name=familia_nome]", "Ana & Carlos");
  await p.click("#convite-enviar"); await p.waitForTimeout(350);
  const cv = await p.evaluate(() => window.__MOCK.tabelas.convites[0]);
  ok(cv && cv.email === "ana@x.com" && cv.familia_id === null && (await p.innerText("#titulo-convite")).includes("criado"), "convite de nova família salvo (e-mail em minúsculas) e mensagem pronta para compartilhar");
  ok(p.erros.length === 0, "sem erros de JavaScript (famílias)");
}
{
  const p = await pagina({ mock: { usuarios: [], tabelas: { ...tabs(), membros: [], familias: [], convites: [] } } });
  await p.goto(URL_APP + "?convite"); await p.waitForTimeout(900);
  ok((await p.innerText("#login-titulo")) === "Criar minha conta", "link com ?convite abre direto em “Criar minha conta”");
  await p.fill("#form-login [name=email]", "x@x.com"); await p.fill("#form-login [name=senha]", "123456"); await p.fill("#form-login [name=senha2]", "123456");
  await p.evaluate(() => (window.__MOCK.signUp = async () => ({ data: null, error: { message: "Database error saving new user" } })));
  await p.click("#btn-login"); await p.waitForTimeout(350);
  ok((await p.innerText("#login-erro")).includes("convite"), "cadastro sem convite mostra mensagem clara");
  await p.evaluate(() => (window.__MOCK.signUp = async () => ({ data: { session: null, user: {} }, error: null })));
  await p.click("#btn-login"); await p.waitForTimeout(350);
  ok((await p.innerText("#login-erro")).includes("confirmação"), "cadastro com convite pede para confirmar o e-mail");
}
{
  const p = await pagina({ mock: { usuarios: [{ id: "u-ana", email: "ana@x.com", senha: "123456" }], tabelas: { contas: [], pagamentos: [], rendas: [], gastos: [], orcamentos: [], metas: [], aportes: [], cartoes: [], faturas_pagas: [],
    membros: [{ user_id: "u-ana", nome: "Ana", familia_id: "f2", papel: "dono", admin: false, email: "ana@x.com" }], familias: [{ id: "f2", nome: "Ana & Carlos", pessoas: ["Ana"] }], convites: [] } } });
  await entrar(p, "ana@x.com");
  await aba(p, "contas"); await p.click("#aba-contas .btn-add"); await p.waitForTimeout(250);
  const ops = await p.$$eval("#sel-responsavel-conta option", (e) => e.map((x) => x.value));
  ok(ops.join() === "Ana", "família de uma pessoa: “Quem paga” só com o nome dela (sem “Casal”)");
  await p.keyboard.press("Escape"); await aba(p, "mais"); await p.waitForTimeout(200);
  ok(!(await p.innerText("#card-familia")).includes("Outras famílias"), "quem não é admin não vê “convidar nova família”");
}

// ================= SEM INTERNET =================
// (cada "abrir de novo" é uma página nova com o que ficou guardado no aparelho — recarregar arquivo local no Chromium às vezes perde o localStorage)
const MOCK_VINI = () => ({ usuarios: [VINI], tabelas: { ...tabs(), membros: [{ user_id: "u-vini", nome: "Vinícius" }] } });
{
  const p1 = await pagina({ mock: MOCK_VINI() });
  await entrar(p1);
  const ls = await p1.evaluate(() => ({ ...localStorage }));
  const guardado = JSON.parse(ls["plinc-dados-v1:u-vini"] || "null");
  ok(guardado && guardado.contas.length === 1, "depois de entrar, os dados ficam guardados no aparelho");
  ok(await p1.isHidden("#banner-offline"), "com internet, sem aviso de offline");

  // abre o app de novo, sem internet
  const p = await pagina({ limpar: false, mock: MOCK_VINI(), armazenar: { ...ls, "teste-semRede": "1" } });
  await p.context().setOffline(true); await p.waitForTimeout(300);
  ok(await p.isVisible("#app") && (await p.innerText("#hero-total")).includes("2.200"), "sem internet: o app abre com os últimos dados");
  ok(await p.isVisible("#banner-offline") && (await p.innerText("#banner-offline")).includes("Sem internet"), "sem internet: aparece o aviso com a hora dos dados");
  ok(await p.isHidden("#tela-login"), "sem internet: não manda para o login");
  ok(!(await p.evaluate(() => window.__MOCK.saiu)), "sem internet: não desconecta a conta");

  // tentar salvar sem internet
  const antes = await p.evaluate(() => window.__MOCK.tabelas.gastos.length);
  const msg = await p.evaluate(async () => { try { await db.inserir("gastos", { descricao: "x", valor: 1, data: hojeISO(), categoria: "Mercado" }); return "salvou"; } catch (e) { return e.message; } });
  ok(msg.includes("Sem internet") && antes === (await p.evaluate(() => window.__MOCK.tabelas.gastos.length)), "sem internet: salvar avisa “Sem internet” e não grava nada");

  // a internet volta
  await p.evaluate(() => localStorage.removeItem("teste-semRede"));
  await p.context().setOffline(false);
  await p.waitForFunction(() => document.querySelector("#banner-offline").hidden, null, { timeout: 4000 }).catch(() => {});
  ok(await p.isHidden("#banner-offline"), "a internet volta: o aviso some e os dados atualizam");

  // sair apaga a cópia do aparelho
  await aba(p, "mais"); await p.waitForTimeout(200);
  await p.click("#btn-sair"); await p.waitForTimeout(300);
  ok(!(await p.evaluate(() => localStorage.getItem("plinc-dados-v1:u-vini"))), "ao sair da conta, os dados guardados no aparelho são apagados");
  ok(p.erros.length === 0 && p1.erros.length === 0, "sem erros de JavaScript (sem internet) " + p.erros.join(" | "));
}
{
  // primeira vez, sem internet e sem dados guardados
  const p = await pagina({ limpar: false, mock: MOCK_VINI(), armazenar: { "teste-semRede": "1", "sb-simulado-auth-token": JSON.stringify({ user: { id: "u-vini" } }) } });
  await p.waitForFunction(() => document.querySelector("#login-erro")?.textContent.includes("Sem internet"), null, { timeout: 4000 }).catch(() => {});
  ok(await p.isVisible("#tela-login") && (await p.innerText("#login-erro")).includes("Sem internet"), "sem internet e sem dados guardados: login avisa “Sem internet”");
}

// ================= ENTRADA (logo animado) =================
{
  const p = await pagina();
  ok(await p.evaluate(() => !document.querySelector("#splash") && !document.documentElement.classList.contains("abrindo")), "entrada: o logo animado some quando o app fica pronto");
}

// ================= BLOQUEIO COM FACE ID (biometria simulada) =================
{
  const faceFalso = () => {
    window.__face = { criou: 0, pediu: 0, ok: false };
    if (!navigator.credentials) Object.defineProperty(navigator, "credentials", { value: {}, configurable: true });
    window.PublicKeyCredential = window.PublicKeyCredential || function () {};
    PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable = async () => true;
    navigator.credentials.create = async () => { __face.criou++; return { rawId: new Uint8Array([1, 2, 3, 4]).buffer }; };
    navigator.credentials.get = async () => { __face.pediu++; if (__face.ok) return {}; throw new DOMException("cancelou", "NotAllowedError"); };
  };
  const p1 = await pagina({ mock: MOCK_VINI(), antes: faceFalso });
  await entrar(p1);
  await aba(p1, "mais"); await p1.waitForTimeout(200);
  ok((await p1.innerText("#bloqueio-estado")) === "desligado", "bloqueio: começa desligado " + await p1.innerText("#bloqueio-estado"));
  await p1.click("#btn-bloqueio"); await p1.waitForTimeout(300);
  ok((await p1.innerText("#bloqueio-estado")) === "ligado" && await p1.evaluate(() => __face.criou === 1 && !!JSON.parse(localStorage.getItem("plinc-bloqueio")).id),
    "bloqueio: ligar cria a chave do aparelho e o item mostra “ligado”");
  const ls = await p1.evaluate(() => ({ ...localStorage }));
  p1.once("dialog", (d) => d.accept());
  await p1.click("#btn-bloqueio"); await p1.waitForTimeout(300);
  ok((await p1.innerText("#bloqueio-estado")) === "desligado" && await p1.evaluate(() => !localStorage.getItem("plinc-bloqueio")), "bloqueio: dá para desligar em Mais");

  // abre o app de novo com o bloqueio ligado: cobre tudo e pede o Face ID
  const p = await pagina({ limpar: false, mock: MOCK_VINI(), armazenar: ls, antes: faceFalso });
  await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.querySelector("#tela-bloqueio").open && __face.pediu >= 1), "bloqueio: ao abrir, aparece a tela de bloqueio e o Face ID é pedido sozinho");
  ok(!(await p.isVisible("#app")), "bloqueio: os valores ficam escondidos enquanto não desbloqueia");
  await p.evaluate(() => { __face.ok = true; }); await p.click("#btn-desbloquear"); await p.waitForTimeout(400);
  ok(await p.evaluate(() => !document.querySelector("#tela-bloqueio").open) && await p.isVisible("#app"), "bloqueio: Face ID confirmado libera o app");
  // voltou depois de mais de 1 minuto fora
  await p.evaluate(() => { __face.ok = false; bloqueio.foraDesde = Date.now() - 61000; document.dispatchEvent(new Event("visibilitychange")); }); await p.waitForTimeout(400);
  ok(await p.evaluate(() => document.querySelector("#tela-bloqueio").open), "bloqueio: voltar depois de 1 minuto fora bloqueia de novo");
  await p.evaluate(() => { bloqueio.foraDesde = 0; });
  await p.evaluate(() => { __face.ok = true; }); await p.click("#btn-desbloquear"); await p.waitForTimeout(400);
  await p.evaluate(() => { bloqueio.foraDesde = Date.now() - 5000; document.dispatchEvent(new Event("visibilitychange")); }); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !document.querySelector("#tela-bloqueio").open), "bloqueio: sair só uns segundos não bloqueia");
  // não consegue o Face ID: entra com e-mail e senha
  await p.evaluate(() => { __face.ok = false; bloqueio.foraDesde = Date.now() - 61000; document.dispatchEvent(new Event("visibilitychange")); }); await p.waitForTimeout(400);
  p.once("dialog", (d) => d.accept());
  await p.click("#btn-bloqueio-senha"); await p.waitForTimeout(500);
  ok(await p.isVisible("#tela-login") && await p.evaluate(() => !localStorage.getItem("plinc-bloqueio") && !document.querySelector("#tela-bloqueio").open),
    "bloqueio: “Entrar com e-mail e senha” sai da conta, desliga o bloqueio e mostra o login");
  ok(p.erros.length === 0 && p1.erros.length === 0, "sem erros de JavaScript (bloqueio) " + [...p.erros, ...p1.erros].join(" | "));
}
{
  const p = await pagina();
  await aba(p, "mais"); await p.waitForTimeout(200);
  ok((await p.innerText("#bloqueio-estado")) === "no app real", "bloqueio: na demonstração o item mostra que é só no app real");
}

// ================= AO VIVO (dois celulares da mesma família) =================
{
  const FAM = () => ({ usuarios: [VINI], tabelas: { ...tabs(),
    membros: [{ user_id: "u-vini", nome: "Vinícius", familia_id: "f1", papel: "dono", admin: true, email: "vini@x.com" }],
    familias: [{ id: "f1", nome: "Vinícius & Marcela", pessoas: ["Vinícius", "Marcela"] }], convites: [] } });
  const p = await pagina({ mock: FAM() });
  await entrar(p);
  ok(await p.evaluate(() => (window.__MOCK.canais["plinc-familia:f1"] || []).length === 1), "ao entrar, o celular escuta o canal da própria família");

  // a Marcela lança um gasto no celular dela
  await p.evaluate(() => { window.__MOCK.tabelas.gastos.push({ id: "g-ma", descricao: "Padaria", valor: 37.5, data: hojeISO(), categoria: "Mercado", responsavel: "Marcela" }); window.__MOCK.receber("plinc-familia:f1"); });
  await p.waitForFunction(() => estado.gastos.some((g) => g.id === "g-ma"), null, { timeout: 4000 }).catch(() => {});
  ok(await p.evaluate(() => estado.gastos.some((g) => g.id === "g-ma")), "outro celular salvou: os dados atualizam sozinhos");
  await p.waitForFunction(() => document.querySelector("#hero-total").textContent.includes("2.237,50"), null, { timeout: 3000 }).catch(() => {});
  ok((await p.innerText("#hero-total")).includes("2.237,50"), "o total da tela inicial já inclui o gasto da Marcela " + (await p.innerText("#hero-total")));

  // aviso chega com um formulário aberto: espera fechar
  await aba(p, "contas"); await p.click("#aba-contas .btn-add"); await p.waitForTimeout(250);
  await p.evaluate(() => { window.__MOCK.tabelas.gastos.push({ id: "g-ma2", descricao: "Farmácia", valor: 20, data: hojeISO(), categoria: "Saúde", responsavel: "Marcela" }); window.__MOCK.receber("plinc-familia:f1"); });
  await p.waitForTimeout(2000);
  ok(!(await p.evaluate(() => estado.gastos.some((g) => g.id === "g-ma2"))), "com formulário aberto, não atualiza no meio (não perde o que está sendo digitado)");
  await p.keyboard.press("Escape");
  await p.waitForFunction(() => estado.gastos.some((g) => g.id === "g-ma2"), null, { timeout: 4000 }).catch(() => {});
  ok(await p.evaluate(() => estado.gastos.some((g) => g.id === "g-ma2")), "fechou o formulário: atualiza em seguida");

  // este celular salva: avisa a família (um aviso só)
  const antes = await p.evaluate(() => window.__MOCK.enviados.length);
  await p.evaluate(async () => { await db.inserir("gastos", { descricao: "Café", valor: 8, data: hojeISO(), categoria: "Mercado" }); await db.inserir("gastos", { descricao: "Pão", valor: 5, data: hojeISO(), categoria: "Mercado" }); });
  await p.waitForTimeout(700);
  const env = await p.evaluate(() => window.__MOCK.enviados);
  ok(env.length - antes === 1 && env.at(-1).canal === "plinc-familia:f1" && env.at(-1).event === "mudou" && JSON.stringify(env.at(-1).payload) === "{}", "ao salvar, avisa os outros celulares da família (só o sinal, sem dados)");

  // sair: para de escutar
  await aba(p, "mais"); await p.waitForTimeout(200); await p.click("#btn-sair"); await p.waitForTimeout(300);
  ok(!(await p.evaluate(() => window.__MOCK.canais["plinc-familia:f1"])), "ao sair da conta, para de escutar o canal");
  ok(p.erros.length === 0, "sem erros de JavaScript (ao vivo) " + p.erros.join(" | "));
}

// ================= ASSINATURA (migração 07) =================
const FAM1 = () => ({ ...tabs(), membros: [{ user_id: "u-vini", nome: "Vinícius", familia_id: "f1", papel: "dono", admin: true, email: "vini@x.com" }],
  familias: [{ id: "f1", nome: "Vinícius & Marcela", pessoas: ["Vinícius", "Marcela"] }], convites: [] });
const futuro = (d) => new Date(Date.now() + d * 864e5).toISOString();
{
  // criar conta pelo botão da página de venda (?cadastro)
  const p = await pagina({ url: URL_APP + "?cadastro", mock: { usuarios: [], tabelas: FAM1() } });
  ok((await p.innerText("#login-titulo")) === "Criar minha conta" && await p.isVisible("#lbl-nome"), "link ?cadastro abre “Criar minha conta” pedindo o nome");
  await p.evaluate(() => (window.__MOCK.signUp = async () => ({ data: { session: null, user: {} }, error: null })));
  await p.fill("#form-login [name=nome]", "Bia"); await p.fill("#form-login [name=email]", "bia@x.com");
  await p.fill("#form-login [name=senha]", "123456"); await p.fill("#form-login [name=senha2]", "123456");
  await p.click("#btn-login"); await p.waitForTimeout(400);
  ok((await p.evaluate(() => window.__MOCK.ultimoSignUp?.options?.data?.nome)) === "Bia", "o nome vai junto no cadastro (vira o nome da família)");
}
{
  // família nova que ainda não pagou
  const BIA = { id: "u-bia", email: "bia@x.com", senha: "123456" };
  const tb = { ...tabs(), contas: [], membros: [{ user_id: "u-bia", nome: "Bia", familia_id: "f9", papel: "dono", email: "bia@x.com" }], familias: [{ id: "f9", nome: "Família de Bia", pessoas: ["Bia"] }], convites: [] };
  const p = await pagina({ mock: { usuarios: [BIA], tabelas: tb, assinatura: { status: "pendente", liberada: false, pago: false, valido_ate: null } } });
  await entrar(p, "bia@x.com");
  ok(await p.isVisible("#tela-assinar") && await p.isHidden("#app"), "família que não pagou vê a tela “Ative sua assinatura” (não o app)");
  ok((await p.inputValue("#form-assinar [name=email]")) === "bia@x.com" && (await p.innerText("#tela-assinar")).includes("19,90"), "tela mostra o preço e já preenche o e-mail");
  await p.evaluate(() => { window.__MOCK.funcoes = { assinatura: async (b) => ({ data: { url: "https://mp.exemplo/checkout?preapproval_id=x" }, error: null }) }; window.abrirCheckout = (u) => (window.__foiPara = u); });
  await p.click("#form-assinar button[type=submit]"); await p.waitForTimeout(400);
  const ch = await p.evaluate(() => window.__MOCK.chamadas.at(-1));
  ok(ch?.nome === "assinatura" && ch.body.acao === "assinar" && ch.body.email === "bia@x.com" && (await p.evaluate(() => window.__foiPara)).includes("preapproval_id"), "“Assinar com Mercado Pago” pede a assinatura ao servidor e abre o checkout");
  await p.evaluate(() => { window.__MOCK.funcoes.assinatura = async () => ({ data: null, error: { message: "x", context: { json: async () => ({ erro: "Confira o e-mail do pagamento." }) } } }); });
  await p.click("#form-assinar button[type=submit]"); await p.waitForTimeout(300);
  ok((await p.innerText("#assinar-msg")).includes("Confira o e-mail"), "erro do servidor aparece em português na tela");
}
{
  // volta do checkout: espera o aviso do Mercado Pago e entra no app
  const BIA = { id: "u-bia", email: "bia@x.com", senha: "123456" };
  const tb = { ...tabs(), membros: [{ user_id: "u-bia", nome: "Bia", familia_id: "f9", papel: "dono", email: "bia@x.com" }], familias: [{ id: "f9", nome: "Família de Bia", pessoas: ["Bia"] }], convites: [] };
  const p = await pagina({ url: URL_APP + "?assinatura=retorno", mock: { usuarios: [BIA], tabelas: tb, assinatura: { status: "pendente", liberada: false, pago: false } } });
  await entrar(p, "bia@x.com");
  ok((await p.innerText("#assinar-msg")).includes("Recebendo a confirmação"), "voltou do Mercado Pago: “Recebendo a confirmação…”");
  await p.evaluate((v) => { window.__MOCK.assinatura = { status: "ativa", liberada: true, pago: false, valido_ate: v }; }, futuro(2));
  await p.waitForFunction(() => !document.querySelector("#app").hidden, null, { timeout: 8000 }).catch(() => {});
  ok(await p.isVisible("#app") && await p.isHidden("#tela-assinar"), "confirmação chegou: entra no app sozinho");
  ok(!(await p.evaluate(() => location.search.includes("assinatura"))), "o endereço volta ao normal (sem ?assinatura=retorno)");
}
{
  // assinatura vencida (passou a tolerância): só consulta
  const p = await pagina({ mock: { usuarios: [VINI], tabelas: FAM1(), assinatura: { status: "atrasada", liberada: false, pago: true, valido_ate: futuro(-10), tolerancia_ate: futuro(-3) } } });
  await entrar(p);
  ok(await p.isVisible("#app") && (await p.innerText("#hero-total")).includes("2.200"), "vencida: o app abre e mostra os dados (só consulta)");
  ok(await p.isVisible("#banner-assinatura") && (await p.innerText("#banner-assinatura")).includes("Renovar"), "vencida: aviso no topo com botão Renovar");
  const antes = await p.evaluate(() => window.__MOCK.tabelas.gastos.length);
  const msg = await p.evaluate(async () => { try { await db.inserir("gastos", { descricao: "x", valor: 1, data: hojeISO(), categoria: "Mercado" }); return "salvou"; } catch (e) { return e.message; } });
  ok(msg.includes("assinatura") && antes === await p.evaluate(() => window.__MOCK.tabelas.gastos.length), "vencida: tentar lançar avisa da assinatura e não grava");
  await aba(p, "mais"); await p.waitForTimeout(200);
  ok((await p.innerText("#card-assinatura")).includes("Vencida") && await p.isVisible("#card-assinatura [data-acao=renovar-assinatura]"), "Mais → Sua assinatura: “Vencida” com botão para assinar de novo");
  await p.click("#banner-assinatura [data-acao=renovar-assinatura]"); await p.waitForTimeout(200);
  ok(await p.isVisible("#tela-assinar") && (await p.innerText("#btn-sair-assinar")) === "Voltar para o app", "Renovar abre a tela de assinar, com opção de voltar ao app");
  await p.click("#btn-sair-assinar"); await p.waitForTimeout(200);
  ok(await p.isVisible("#app"), "Voltar para o app funciona");
}
{
  // assinatura ativa: cancelar
  const p = await pagina({ mock: { usuarios: [VINI], tabelas: FAM1(), assinatura: { status: "ativa", liberada: true, pago: true, valido_ate: futuro(20) } } });
  p.on("dialog", (d) => d.accept());
  await entrar(p);
  ok(await p.isHidden("#banner-assinatura"), "ativa: sem aviso no topo");
  await aba(p, "mais"); await p.waitForTimeout(200);
  ok((await p.innerText("#card-assinatura")).includes("Ativa") && (await p.innerText("#card-assinatura")).includes("próxima cobrança"), "Mais → Sua assinatura: “Ativa” com a próxima cobrança");
  await p.evaluate((v) => { window.__MOCK.funcoes = { assinatura: async (b) => { window.__MOCK.assinatura = { status: "cancelada", liberada: true, pago: true, valido_ate: v }; return { data: { ok: true }, error: null }; } }; }, futuro(20));
  await p.click("#card-assinatura [data-acao=cancelar-assinatura]"); await p.waitForTimeout(500);
  ok((await p.evaluate(() => window.__MOCK.chamadas.at(-1)?.body?.acao)) === "cancelar" && (await p.innerText("#card-assinatura")).includes("Cancelada"), "cancelar: pede ao servidor e mostra “Cancelada · usa até…”");
  ok(p.erros.length === 0, "sem erros de JavaScript (assinatura) " + p.erros.join(" | "));
}
{
  // cortesia (vocês e a irmã): nada muda
  const p = await pagina({ mock: { usuarios: [VINI], tabelas: FAM1(), assinatura: { status: "cortesia", liberada: true, pago: false } } });
  await entrar(p);
  await aba(p, "mais"); await p.waitForTimeout(200);
  ok(await p.isVisible("#app") && await p.isHidden("#banner-assinatura") && (await p.innerText("#card-assinatura")).includes("Cortesia") && !(await p.locator("#card-assinatura button").count()), "cortesia: app normal, “Cortesia” em Mais, sem botões de cobrança");
}

// ================= PRIMEIRO ACESSO GUIADO =================
{
  const vazia = { ...FAM1(), contas: [], orcamentos: [] };
  const p = await pagina({ mock: { usuarios: [VINI], tabelas: vazia } });
  await entrar(p, undefined, { manterGuia: true }); await p.waitForTimeout(600);
  ok(await p.evaluate(() => document.querySelector("#modal-guia").open), "família nova: abre a configuração inicial");
  ok((await p.innerText("#guia-rendas")).includes("Marcela"), "guia: pede a renda de cada pessoa da família");
  await p.fill('[data-guia-renda="0"]', "6.000"); await p.fill('[data-guia-renda="1"]', "4000");
  await p.click("#guia-proximo"); await p.waitForTimeout(150);
  await p.fill('[data-guia-valor="2"]', "200"); await p.fill('[data-guia-dia="2"]', "15");
  await p.fill('[data-guia-valor="4"]', "119,90");
  await p.click("#guia-proximo"); await p.waitForTimeout(150);
  ok((await p.innerText("#guia-proximo")) === "Concluir", "guia: 3º passo é o cartão, com botão Concluir");
  await p.fill("#guia-cartao-nome", "Nubank"); await p.selectOption("#guia-cartao-dono", "Marcela");
  await p.fill("#guia-cartao-fech", "3"); await p.fill("#guia-cartao-venc", "10");
  await p.click("#guia-proximo"); await p.waitForTimeout(600);
  const t = await p.evaluate(() => window.__MOCK.tabelas);
  const luz = t.contas.find((c) => c.nome === "Luz"), net = t.contas.find((c) => c.nome === "Internet");
  ok(t.rendas.length === 2 && t.rendas.some((r) => r.responsavel === "Marcela" && Number(r.valor) === 4000) && t.rendas.some((r) => Number(r.valor) === 6000), "guia: grava a renda de cada um");
  ok(t.contas.length === 2 && luz?.dia_vencimento === 15 && luz.variavel === true && net?.dia_vencimento === 10 && Number(net.valor) === 119.9, "guia: grava só as contas preenchidas (luz variável dia 15, internet no dia 10 padrão)");
  ok(t.cartoes.length === 1 && t.cartoes[0].responsavel === "Marcela" && t.cartoes[0].dia_vencimento === 10, "guia: grava o cartão");
  ok(!(await p.evaluate(() => document.querySelector("#modal-guia").open)) && (await p.innerText("#hero-total")).includes("319,90"), "guia: fecha e o mês já aparece montado");
  await p.reload(); await p.waitForTimeout(900);
  ok(!(await p.evaluate(() => document.querySelector("#modal-guia").open)), "guia: não aparece de novo depois de feito");
  ok(p.erros.length === 0, "sem erros de JavaScript (guia) " + p.erros.join(" | "));
}
{
  const p = await pagina({ mock: { usuarios: [VINI], tabelas: { ...FAM1(), contas: [], orcamentos: [] } } });
  await entrar(p, undefined, { manterGuia: true }); await p.waitForTimeout(600);
  await p.click("#guia-fechar"); await p.waitForTimeout(300);
  ok(!(await p.evaluate(() => document.querySelector("#modal-guia").open)) && (await p.evaluate(() => window.__MOCK.tabelas.contas.length)) === 0, "guia: “Fazer depois” fecha sem gravar nada");
  await aba(p, "mais"); await p.click('[data-acao="guia"]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.querySelector("#modal-guia").open), "guia: dá para abrir de novo em Mais → Configuração inicial");
}

// ================= CRÉDITO → FATURA DO MÊS QUE VEM, MÊS QUE VEM NO INÍCIO E ACERTO DO CASAL =================
{
  const hoje = new Date(), pad2 = (n) => String(n).padStart(2, "0");
  const mes = `${hoje.getFullYear()}-${pad2(hoje.getMonth() + 1)}`;
  const prox = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
  const nomeProx = prox.toLocaleDateString("pt-BR", { month: "long" });
  const g = (id, dia, descricao, valor, extra) => ({ id, data: `${mes}-${dia}`, descricao, valor, categoria: "Outros", responsavel: "Casal", forma_pagamento: null, cartao_id: null, parcelas: 1, ...extra });
  const tab = { ...FAM1(),
    membros: [...FAM1().membros, { user_id: "u-marcela", nome: "Marcela", familia_id: "f1", papel: "membro", admin: false, email: "marcela@x.com" }],
    contas: [{ id: "c1", nome: "Aluguel", categoria: "Moradia", valor: 2000, dia_vencimento: 5, responsavel: "Casal", ativa: true, inicio: "2026-01-01", variavel: false, fim: null, cartao_id: null }],
    pagamentos: [{ id: "p1", conta_id: "c1", competencia: `${mes}-01`, valor_pago: 2000, pago_em: `${mes}-05`, pago_por: "Vinícius" }],
    rendas: [{ id: "r1", descricao: "Salário", valor: 6000, responsavel: "Vinícius", ativa: true }, { id: "r2", descricao: "Salário", valor: 4000, responsavel: "Marcela", ativa: true }],
    cartoes: [{ id: "k1", nome: "Nubank", dia_fechamento: 3, dia_vencimento: 10, limite: null, responsavel: "Marcela", ativo: true }],
    gastos: [g("g1", 15, "Mercado Extra", 300, { cartao_id: "k1", forma_pagamento: "Cartão Nubank", created_by: "u-marcela" }),
      g("g2", 16, "Farmácia", 100, { forma_pagamento: "Pix", created_by: "u-vini" }),
      g("g3", 17, "Uber", 50, { responsavel: "Vinícius", forma_pagamento: "Importado do extrato", created_by: "u-vini" })] };
  const p = await pagina({ mock: { usuarios: [VINI], tabelas: tab } });
  await entrar(p);
  const ac = (await p.innerText("#acerto-casal")).replace(/\u00a0/g, " ");
  ok(ac.includes("Marcela passa R$ 840,00 para Vinícius") && ac.includes("60%") && ac.includes("40%"), "acerto: Vinícius pagou aluguel + farmácia (2.100), parte dele 60% → Marcela passa 840 " + ac.replace(/\n/g, " / "));
  const pm = await p.innerText("#proximo-mes");
  ok(pm.includes("Fatura Nubank") && pm.includes("300,00") && pm.includes("2.300,00"), "Início: o mês que vem já mostra a fatura (300) + contas fixas (total 2.300) " + pm.replace(/\n/g, " / "));
  await aba(p, "gastos"); await p.waitForTimeout(200);
  const cm = await p.innerText("#credito-mes");
  ok(cm.includes("Pix ou débito") && cm.includes("150,00") && cm.includes("No crédito") && cm.includes("300,00") && cm.toLowerCase().includes(`fatura de ${nomeProx}`) && cm.includes("Nubank · vence") && cm.includes("A pagar"),
    "Gastos: separa o que já saiu (Pix/débito 150) do que vai na fatura do mês que vem (300, a pagar) " + cm.replace(/\n/g, " / "));
  await p.click('#seg-gastos [data-g="extrato"]'); await p.waitForTimeout(150);
  ok((await p.innerText("#extrato")).includes("Nubank · fatura " + prox.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toLowerCase()), "extrato: compra no crédito mostra em qual fatura entra");
  {
    const venc = `${String(10).padStart(2, "0")}/${String(prox.getMonth() + 1).padStart(2, "0")}`;
    const rp = (await p.innerText("#resumo-pag-gastos")).replace(/ /g, " ");
    ok(rp.includes("Já pago") && rp.includes("R$ 150,00") && rp.includes("A pagar") && rp.includes("R$ 300,00") && rp.includes("vence " + venc) && rp.includes("33%"),
      "extrato: resumo já pago (Pix/débito 150) × a pagar (crédito 300, vence " + venc + ") " + rp.replace(/\n/g, " / "));
    const li = p.locator("#extrato li", { hasText: "Mercado Extra" });
    ok((await li.innerText()).includes("Paga em " + venc), "extrato: compra no crédito diz quando será paga");
    ok((await p.locator("#extrato li", { hasText: "Farmácia" }).innerText()).includes("✓ Pago"), "extrato: Pix/débito aparece como pago");
    await p.click('#filtro-pag-gastos [data-fp="apagar"]'); await p.waitForTimeout(120);
    const ap = await p.innerText("#extrato");
    ok(ap.includes("Mercado Extra") && !ap.includes("Farmácia") && !ap.includes("Uber"), "filtro A pagar: só o que vai na fatura");
    await p.click('#filtro-pag-gastos [data-fp="pagos"]'); await p.waitForTimeout(120);
    const pg = await p.innerText("#extrato");
    ok(!pg.includes("Mercado Extra") && pg.includes("Farmácia") && pg.includes("Uber"), "filtro Pagos: só o que já saiu da conta");
    // marca a fatura como paga direto no banco simulado → a compra vira paga
    await p.evaluate((c) => { estado.faturas_pagas.push({ id: "fp1", cartao_id: "k1", competencia: c, pago_em: hojeISO() }); renderExtrato(gastosFiltrados()); }, `${prox.getFullYear()}-${String(prox.getMonth() + 1).padStart(2, "0")}-01`);
    ok((await p.innerText("#extrato")).includes("Mercado Extra") && (await p.innerText("#resumo-pag-gastos")).includes("100%"), "fatura paga: a compra no crédito passa para Pagos");
    await p.evaluate(() => { estado.faturas_pagas.length = 0; });
    await p.click('#filtro-pag-gastos [data-fp="todos"]'); await p.waitForTimeout(120);
    await p.click('#seg-gastos [data-g="orcamento"]'); await p.waitForTimeout(120);
    await p.click('#credito-mes [data-ver-pag="apagar"]'); await p.waitForTimeout(150);
    ok(await p.isVisible("#extrato") && (await p.getAttribute('#filtro-pag-gastos [data-fp="apagar"]', "class")).includes("ativo"), "Orçamento: tocar em “No crédito” abre o extrato em A pagar");
    await p.click('#filtro-pag-gastos [data-fp="todos"]'); await p.waitForTimeout(120);
  }
  await p.click('#seg-gastos [data-g="orcamento"]'); await p.waitForTimeout(150);
  await p.click('[data-acao="mover-cartao"]'); await p.waitForTimeout(250);
  ok((await p.locator("#mover-cartao-lista input").count()) === 2, "mover para o cartão: lista os gastos sem cartão do mês");
  await p.locator("#mover-cartao-lista label", { hasText: "Uber" }).locator("input").check();
  ok((await p.innerText("#btn-mover-cartao")) === "Mover 1 gasto", "mover: botão mostra quantos vão");
  await p.click("#btn-mover-cartao"); await p.waitForTimeout(400);
  const uber = await p.evaluate(() => window.__MOCK.tabelas.gastos.find((x) => x.id === "g3"));
  ok(uber.cartao_id === "k1" && uber.forma_pagamento === "Cartão Nubank", "mover: o gasto passa para o cartão");
  ok((await p.innerText("#credito-mes")).includes("350,00"), "depois de mover, a fatura do mês que vem soma 350");
  await p.click("#toast button"); await p.waitForTimeout(400);
  ok(!(await p.evaluate(() => window.__MOCK.tabelas.gastos.find((x) => x.id === "g3").cartao_id)), "mover: “Desfazer” devolve o gasto para Pix/débito");
  await p.locator('#credito-mes [data-abrir-fatura]').click(); await p.waitForTimeout(300);
  ok((await p.innerText("#fatura-detalhe")).toLowerCase().includes(nomeProx), "tocar na fatura abre a fatura do mês que vem (não a do mês atual)");
  ok(p.erros.length === 0, "sem erros de JavaScript (crédito e acerto) " + p.erros.join(" | "));
}
{
  // sem cartão cadastrado: convite para cadastrar, e a aba Cartões aparece mesmo assim
  const t = { ...FAM1(), gastos: [{ id: "x1", data: new Date().toISOString().slice(0, 10), descricao: "Mercado", valor: 80, categoria: "Mercado", responsavel: "Casal", forma_pagamento: "Importado do extrato", cartao_id: null, parcelas: 1 }] };
  const p = await pagina({ mock: { usuarios: [VINI], tabelas: t } });
  await entrar(p); await aba(p, "gastos"); await p.waitForTimeout(200);
  ok((await p.innerText("#credito-mes")).includes("Algum gasto foi no cartão de crédito?") && await p.isVisible('#seg-gastos [data-g="cartoes"]'), "sem cartão: Gastos convida a cadastrar e a aba Cartões fica visível");
}

// ================= FATURA DO CARTÃO EM CONTAS (caso da Marcela) =================
{
  // ela importou a fatura sem ter cartão cadastrado: os gastos entraram como Pix/débito
  const g = (id, data, descricao, valor) => ({ id, data, descricao, valor, categoria: "Outros", responsavel: "Marcela", forma_pagamento: "Importado do extrato", cartao_id: null, parcelas: 1 });
  const gastos = [g("g1", "2026-11-10", "Ifood *Restaurante Bom", 45.9), g("g2", "2026-11-09", "Supermercado Dia", 123.47), g("g3", "2026-11-08", "Uber *Trip", 18.3),
    g("g4", "2026-11-07", "Drogasil 123", 56), g("g5", "2026-11-04", "Amazon Marketplace - Parcela 2/6", 89.9), g("g6", "2026-11-03", "Netflix.Com", 55.9)];
  const p = await pagina({ mock: { usuarios: [VINI], tabelas: { ...FAM1(), gastos } } });
  await entrar(p);
  await aba(p, "gastos"); await p.waitForTimeout(200);
  await p.click('#aba-gastos [data-acao="importar"]'); await p.waitForTimeout(250);
  await p.setInputFiles("#imp-file", FIX("nubank-fatura.csv")); await p.waitForTimeout(450);
  ok(await p.isVisible("#imp-aviso-cartao") && (await p.innerText("#imp-aviso-cartao")).includes("Parece uma fatura de cartão"), "importação: arquivo de fatura sem cartão cadastrado mostra aviso para cadastrar");
  await p.click('#imp-aviso-cartao [data-acao="novo-cartao"]'); await p.waitForTimeout(300);
  await p.fill("#form-cartao [name=nome]", "Nubank Marcela"); await p.fill("#form-cartao [name=dia_fechamento]", "3"); await p.fill("#form-cartao [name=dia_vencimento]", "10");
  await p.click("#form-cartao button[type=submit]"); await p.waitForTimeout(400);
  const forma = await p.$eval("#imp-forma", (s) => s.options[s.selectedIndex].text);
  ok(await p.evaluate(() => document.querySelector("#modal-importar").open) && forma.includes("Nubank Marcela") && await p.isHidden("#imp-aviso-cartao"),
    "cartão cadastrado pela importação já fica escolhido e o aviso some");
  const mov = await p.locator("#imp-lista .badge", { hasText: "vai para o cartão" }).count();
  ok(mov === 6 && (await p.innerText("#imp-confirmar")) === "Mover 6 para o cartão", "o que já tinha sido importado sem cartão aparece como “vai para o cartão”");
  await p.click("#imp-confirmar"); await p.waitForTimeout(500);
  const noCartao = await p.evaluate(() => window.__MOCK.tabelas.gastos.filter((x) => x.cartao_id).length);
  ok(noCartao === 6 && (await p.evaluate(() => window.__MOCK.tabelas.gastos.length)) === 6, "confirmar move os 6 gastos para o cartão, sem duplicar");
  // fatura de dezembro (compras de 4 a 10/11; fecha dia 3, vence dia 10) aparece em Contas
  await p.evaluate(() => { estado.mes = "2026-12-01"; render(); });
  await aba(p, "contas"); await p.click("#filtro-status [data-f=pendentes]"); await p.waitForTimeout(200);
  const linha = p.locator("#lista-mes li.fatura-item");
  ok(await linha.count() === 1 && (await linha.innerText()).includes("Fatura Nubank Marcela") && (await linha.innerText()).includes("333,57") && (await linha.innerText()).includes("Dia 10"),
    "Contas → A pagar: fatura do cartão com valor e dia do vencimento");
  ok((await p.innerText("#resumo-contas")).includes("Faturas do cartão"), "resumo de Contas mostra quanto falta das faturas");
  await linha.locator("[data-pagar-fatura]").click(); await p.waitForTimeout(400);
  const fp = await p.evaluate(() => window.__MOCK.tabelas.faturas_pagas);
  ok(fp.length === 1 && fp[0].competencia === "2026-12-01" && Number(fp[0].valor_pago) === 333.57, "tocar no quadrado marca a fatura como paga");
  ok(!(await p.locator("#lista-mes li.fatura-item").count()), "fatura paga sai de “A pagar”");
  await p.click("#filtro-status [data-f=pagas]"); await p.waitForTimeout(200);
  ok((await p.locator("#lista-mes li.fatura-item.paga").count()) === 1, "e aparece em “Pagas”");
  await p.click("#toast button"); await p.waitForTimeout(400);
  ok(!(await p.evaluate(() => window.__MOCK.tabelas.faturas_pagas.length)), "“Desfazer” desmarca o pagamento da fatura");
  await p.click("#filtro-status [data-f=todas]"); await p.waitForTimeout(200);
  await p.locator("#lista-mes li.fatura-item .info").click(); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.querySelector("#modal-fatura").open), "tocar na fatura abre o detalhe com as compras");
  ok(p.erros.length === 0, "sem erros de JavaScript (fatura em Contas) " + p.erros.join(" | "));
}

// ================= MOEDA DA FAMÍLIA (irmã na Suécia) =================
{
  const t = FAM1(); t.familias = [{ ...t.familias[0], moeda: "SEK" }];
  t.contas = [{ ...t.contas[0], nome: "Hyra", valor: 8500 }];
  const p = await pagina({ mock: { usuarios: [VINI], tabelas: t } });
  await entrar(p);
  const hero = (await p.innerText("#hero-total")).replace(/\u00a0|\u202f/g, " ");
  ok(hero.includes("8 500,00 kr") && !hero.includes("R$"), "moeda: família em coroa sueca vê os valores em kr " + hero);
  await aba(p, "gastos"); await p.click('#aba-gastos [data-acao="novo-gasto"]'); await p.waitForTimeout(250);
  ok((await p.innerText("#modal-gasto .campo-rs span")).trim() === "kr", "moeda: o campo de valor mostra kr em vez de R$");
  await p.fill("#modal-gasto [name=valor]", "1 234,50"); await p.fill("#modal-gasto [name=descricao]", "ICA");
  await p.evaluate(() => { const f = document.querySelector("#form-gasto"); f.categoria.value = "Mercado"; });
  await p.click("#form-gasto button[type=submit]"); await p.waitForTimeout(400);
  const ica = await p.evaluate(() => window.__MOCK.tabelas.gastos.find((g) => g.descricao === "ICA"));
  ok(ica && Number(ica.valor) === 1234.5, "moeda: aceita o número no jeito sueco (1 234,50) " + JSON.stringify(ica && ica.valor));
  await aba(p, "mais"); await p.waitForTimeout(200);
  ok(await p.isVisible("#sel-moeda-familia") && (await p.$eval("#sel-moeda-familia", (s) => s.value)) === "SEK", "moeda: dono vê a moeda da família em Mais → Família");
  p.once("dialog", (d) => d.accept());
  await p.selectOption("#sel-moeda-familia", "EUR"); await p.waitForTimeout(400);
  ok((await p.evaluate(() => window.__MOCK.tabelas.familias[0].moeda)) === "EUR" && (await p.innerText("#hero-total")).includes("€"), "moeda: trocar grava na família e o app passa a mostrar €");
  ok(p.erros.length === 0, "sem erros de JavaScript (moeda) " + p.erros.join(" | "));
}

// ================= AVISOS NO CELULAR (na demonstração só explica) =================
{
  const p = await pagina();
  await aba(p, "mais"); await p.waitForTimeout(200);
  ok((await p.innerText("#avisos-estado")) === "no app real", "avisos: na demonstração o item mostra que é só no app real");
  await p.click("#btn-avisos"); await p.waitForTimeout(200);
  ok((await p.innerText("#toast")).includes("demonstração"), "avisos: na demonstração explica em vez de pedir permissão");
}

// ================= DEMONSTRAÇÃO PÚBLICA (app?demo, link da página de venda) =================
{
  const p = await pagina({ url: URL_APP + "?demo", mock: { usuarios: [VINI], tabelas: { ...tabs(), membros: [{ user_id: "u-vini", nome: "Vinícius" }] } } });
  ok(await p.isVisible("#app") && await p.isHidden("#tela-login"), "app?demo abre direto, sem login, mesmo com o banco configurado");
  ok((await p.innerText("#nome-usuario")) === "Ana (demo)" && (await p.innerText("#banner-demo")).includes("Demonstração"), "demonstração usa a família de exemplo (Ana e Léo) e mostra o aviso com link para assinar");
  ok(await p.evaluate(() => !!localStorage.getItem("plinc-demo-publica") && !localStorage.getItem("plinc-dados-v1:u-vini") && sb === null), "demonstração não conversa com o banco e guarda os dados de exemplo à parte");
  ok(p.erros.length === 0, "sem erros de JavaScript (demonstração pública) " + p.erros.join(" | "));
}

// ================= GASTOS: CRÉDITO × DÉBITO =================
{
  const p = await pagina();
  await p.evaluate(() => {
    estado.cartoes = []; const h = hojeISO();
    estado.gastos = [
      { id: "g1", data: h, descricao: "Mercado débito", categoria: "Mercado", valor: 100, responsavel: PESSOAS[0], forma_pagamento: "Débito", cartao_id: null, parcelas: 1, created_at: "" },
      { id: "g2", data: h, descricao: "Loja crédito", categoria: "Lazer", valor: 250, responsavel: PESSOAS[0], forma_pagamento: "Cartão de crédito", cartao_id: null, parcelas: 1, created_at: "" },
      { id: "g3", data: h, descricao: "Pix padaria", categoria: "Mercado", valor: 30, responsavel: PESSOAS[0], forma_pagamento: "Pix", cartao_id: null, parcelas: 1, created_at: "" }];
    render(); irPara("gastos"); mostrarSubGastos("extrato");
  });
  await p.waitForTimeout(300);
  const prox = await p.evaluate(() => nomeMes(somaMes(compDe(new Date()), 1), "mes").toLowerCase());
  const secoes = await p.$$eval("#extrato .secao-extrato", (els) => els.map((e) => e.innerText.replace(/\s+/g, " ")));
  await p.screenshot({ path: "/tmp/credito-debito.png", fullPage: true });
  ok(secoes.length === 2 && /Crédito/.test(secoes[0]) && /Débito/.test(secoes[1]), "extrato separa Crédito e Débito/Pix " + JSON.stringify(secoes));
  ok(secoes[0].includes("paga em " + prox) && /250/.test(secoes[0]), "crédito sem cartão é pago no mês seguinte");
  ok(/já pago/.test(secoes[1]) && /130/.test(secoes[1]), "débito e Pix contam como já pagos");
  const aPagar = await p.innerText("#resumo-pag-gastos");
  ok(/250/.test(aPagar), "resumo mostra o crédito em A pagar");
  ok(p.erros.length === 0, "sem erro de JavaScript (crédito × débito) " + p.erros.join(" | "));
  await p.context().close();
}

await browser.close();
console.log(falhas ? `\n${falhas} FALHA(S) nas telas` : "\nTelas: tudo certo");
process.exit(falhas ? 1 : 0);
