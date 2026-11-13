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

async function pagina({ mock = null, limpar = true, armazenar = null } = {}) {
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
  await p.goto(URL_APP);
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
const entrar = async (p, email = "vini@x.com") => {
  await p.fill("#form-login [name=email]", email); await p.fill("#form-login [name=senha]", "123456"); await p.click("#btn-login"); await p.waitForTimeout(800);
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

await browser.close();
console.log(falhas ? `\n${falhas} FALHA(S) nas telas` : "\nTelas: tudo certo");
process.exit(falhas ? 1 : 0);
