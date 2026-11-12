/* Finanças do Casal — dashboard de contas fixas
 * HTML + JS puro, sem etapa de build. Dados e login no Supabase.
 */
(() => {
  "use strict";

  const CFG = window.CONFIG || {};
  const DEMO = !CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY;
  // Pessoas da família (vêm do banco depois do login; o config.js é só o padrão / modo demonstração)
  let PESSOAS = CFG.PESSOAS || ["Pessoa 1", "Pessoa 2"];
  let RESPONSAVEIS = [...PESSOAS, "Casal"];
  function definirPessoas(lista) {
    PESSOAS = lista && lista.length ? [...lista] : CFG.PESSOAS || ["Pessoa 1"];
    RESPONSAVEIS = PESSOAS.length >= 2 ? [...PESSOAS, "Casal"] : [...PESSOAS];
  }
  const RESP_PADRAO = () => (RESPONSAVEIS.includes("Casal") ? "Casal" : RESPONSAVEIS[0]);
  const DIAS_ALERTA = CFG.DIAS_ALERTA ?? 5;

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const brlCurtoFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 });
  const lerPref = (k, padrao) => { try { const v = localStorage.getItem("fc-" + k); return v === null ? padrao : JSON.parse(v); } catch { return padrao; } };
  const gravarPref = (k, v) => { try { localStorage.setItem("fc-" + k, JSON.stringify(v)); } catch {} };
  let ocultar = lerPref("ocultar", false);
  const OCULTO = "R$ •••••";
  const fmt = (v) => (ocultar ? OCULTO : brl.format(Number(v) || 0));
  const brlCurto = { format: (v) => (ocultar ? "•••" : brlCurtoFmt.format(v)) };

  // ---------- Ícones por categoria ----------
  const ICONES = {
    casa: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    predio: '<path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17M3 21h18M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/>',
    raio: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    gota: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
    chama: '<path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5 1-8.5z"/>',
    wifi: '<path d="M2 9a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0"/><circle cx="12" cy="19.5" r="1"/>',
    carro: '<path d="M3 17v-4l2-5h14l2 5v4zM3 13h18M7 17v2M17 17v2"/><circle cx="7.5" cy="15" r=".5"/><circle cx="16.5" cy="15" r=".5"/>',
    coracao: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
    escudo: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>',
    play: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/>',
    livro: '<path d="M4 19V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2 2 2 0 0 0 2 2h13"/>',
    pata: '<circle cx="8" cy="9" r="1.6"/><circle cx="16" cy="9" r="1.6"/><circle cx="5" cy="13" r="1.4"/><circle cx="19" cy="13" r="1.4"/><path d="M12 13c-3 0-5 3-5 5 0 1.5 1.5 2 5 2s5-.5 5-2c0-2-2-5-5-5z"/>',
    grafico: '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>',
    carrinho: '<path d="M3 4h2l2.5 11h11L21 7H6.5"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/>',
    telefone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
    cartao: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
    etiqueta: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="7.5" r="1"/>',
    olho: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    olhoFechado: '<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    lista: '<path d="M6 3h12a1 1 0 0 1 1 1v17l-3-2-2 2-2-2-2 2-2-2-3 2V4a1 1 0 0 1 1-1zm3 5h6M9 12h6M9 16h4"/>',
    festa: '<path d="m4 20 4.5-12.5L16.5 15.5zM14 4l1 2M19 5l-2 2M20 10h-2M12 8c1-1 1.5-2.5 1-4"/>',
    garfo: '<path d="M7 3v8a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3M9 13v8M17 3c-2 1.5-3 4-3 7h3v11"/>',
    sacola: '<path d="M5 8h14l-1 13H6zM9 8V6a3 3 0 0 1 6 0v2"/>',
    ingresso: '<path d="M3 8a2 2 0 0 0 0 4v4h18v-4a2 2 0 0 0 0-4V5H3zM14 5v14"/>',
    pilula: '<path d="M10.5 3.5a5 5 0 0 1 7 7l-7 7a5 5 0 0 1-7-7zM7 10l7 7"/>',
    alvo: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    aviao: '<path d="M10.5 19.5 12 21l1.5-1.5-.5-4.5 7.5 3V16l-7.5-5V5a1.5 1.5 0 0 0-3 0v6L2.5 16v2l7.5-3z"/>',
    porquinho: '<path d="M19 9c-1-3-4-4-7-4-4.5 0-8 2.5-8 6.5 0 2 1 3.5 2.5 4.5V20h3v-2h5v2h3v-3.5c1-.7 1.8-1.6 2.2-2.5H21v-4h-1.5c-.2-.4-.3-.7-.5-1zM15 9.5h.01"/>',
    anel: '<circle cx="12" cy="15" r="6"/><path d="m9 4 3 4 3-4-1.5-1h-3z"/>',
    lixeira: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    moeda: '<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .9-3 2s1 1.7 3 2 3 .9 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6.5v11"/>'
  };
  const svg = (nome, cls = "") => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONES[nome] || ICONES.etiqueta}</svg>`;
  const semAcento = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const REGRAS_ICONE = [
    [/aluguel|moradia|casa|financiamento|iptu/, "casa"], [/condominio/, "predio"],
    [/energia|luz|eletric/, "raio"], [/agua|saneamento|sabesp/, "gota"], [/gas\b|gas$|comgas/, "chama"],
    [/celular|telefone|vivo|claro|tim\b/, "telefone"], [/internet|wifi|fibra/, "wifi"],
    [/transporte|carro|combust|gasolina|uber|onibus|estacion|ipva/, "carro"],
    [/farmacia|drogaria|remedio/, "pilula"], [/saude|academia|plano|medic|dentista|terapia/, "coracao"], [/seguro/, "escudo"],
    [/assinatura|streaming|netflix|spotify|disney|prime|youtube|hbo|max\b/, "play"],
    [/educa|curso|escola|faculdade|livro/, "livro"], [/pet|cachorro|gato|veterin|racao/, "pata"],
    [/invest|poupanca|reserva|aporte|tesouro/, "grafico"], [/mercado|aliment|feira|padaria/, "carrinho"],
    [/cartao|fatura|nubank/, "cartao"],
    [/restaurante|delivery|ifood|lanche|pizza|almoco|jantar|bar\b/, "garfo"],
    [/lazer|cinema|show|passeio|viagem|ingresso/, "ingresso"], [/compra|roupa|presente|shopping/, "sacola"],
    [/remedio/, "pilula"]
  ];
  const iconeDe = (...textos) => {
    for (const t of textos) { const n = semAcento(t); for (const [re, ic] of REGRAS_ICONE) if (re.test(n)) return ic; }
    return "etiqueta";
  };
  const iconeMeta = (m) => {
    const n = semAcento(m.nome);
    if (/reserva|emergencia|seguranca/.test(n)) return "escudo";
    if (/viagem|ferias|japao|europa|paris|lua de mel/.test(n)) return "aviao";
    if (/casa|apartamento|ape|imovel|entrada|reforma/.test(n)) return "casa";
    if (/carro|moto/.test(n)) return "carro";
    if (/casamento|alianca|festa/.test(n)) return "anel";
    if (/filho|bebe|educa|faculdade|curso/.test(n)) return "livro";
    if (/aposent|invest|acoes|patrimonio/.test(n)) return "grafico";
    return "alvo";
  };
  const ACAO_EXCLUIR = () => `<button type="button" class="swipe-acao" data-excluir-swipe tabindex="-1" aria-hidden="true">${svg("lixeira")}<span>Excluir</span></button>`;
  const bolaIcone = (conta) => `<span class="bola-cat" aria-hidden="true">${svg(iconeDe(conta.categoria, conta.nome))}</span>`;
  const vazio = (icone, titulo, texto, acao) => `
    <li class="estado-vazio">
      <span class="ev-ic">${svg(icone)}</span>
      <strong>${titulo}</strong>
      ${texto ? `<span>${texto}</span>` : ""}
      ${acao ? `<button class="btn btn-primary" data-acao="${acao[0]}">${acao[1]}</button>` : ""}
    </li>`;
  /** Aceita "1.234,56", "1234,56", "1234.56", "R$ 50" */
  const parseValor = (t) => {
    let v = String(t ?? "").replace(/[R$\s]/g, "");
    if (v.includes(",")) v = v.replace(/\./g, "").replace(",", ".");
    else if (/^\d{1,3}(\.\d{3})+$/.test(v)) v = v.replace(/\./g, "");   // "1.000" = mil
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN;
  };
  const paraCampo = (n) => (n === null || n === undefined || n === "" ? "" : Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------- Datas (competência = "AAAA-MM-01") ----------
  const pad = (n) => String(n).padStart(2, "0");
  const compDe = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
  const somaMes = (comp, n) => { const [a, m] = comp.split("-").map(Number); return compDe(new Date(a, m - 1 + n, 1)); };
  const nomeMes = (comp, formato = "longo") => {
    const [a, m] = comp.split("-").map(Number);
    const d = new Date(a, m - 1, 1);
    const mesLongo = d.toLocaleDateString("pt-BR", { month: "long" });
    const mesCurto = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
    const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
    if (formato === "mes") return mesLongo;
    if (formato === "curto") return cap(mesCurto) + (m === 1 ? " " + String(a).slice(2) : "");
    if (formato === "medio") return cap(mesCurto) + " " + a;
    return cap(mesLongo) + " de " + a;
  };
  const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

  // ================================================================
  // CAMADA DE DADOS — Supabase ou localStorage (modo demonstração)
  // ================================================================
  let sb = null;
  if (!DEMO) sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);

  const demoStore = {
    chave: "financas-casal-demo",
    ler() { try { return JSON.parse(localStorage.getItem(this.chave)) || null; } catch { return null; } },
    gravar(d) { try { localStorage.setItem(this.chave, JSON.stringify(d)); } catch {} },
    dados() {
      let d = this.ler();
      if (!d || !d.gastos || !d.metas) { d = dadosExemplo(); this.gravar(d); }
      return d;
    }
  };
  let memDemo = null;
  const demoDB = () => (memDemo ??= demoStore.dados());
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));

  const db = {
    async listar(tabela) {
      if (DEMO) return structuredClone(demoDB()[tabela] || []);
      const { data, error } = await sb.from(tabela).select("*");
      if (error) throw error;
      return data;
    },
    async inserir(tabela, linha) {
      if (DEMO) { const r = { id: uid(), ...linha }; demoDB()[tabela].push(r); demoStore.gravar(demoDB()); return r; }
      const { data, error } = await sb.from(tabela).insert(linha).select().single();
      if (error) throw error;
      return data;
    },
    async inserirVarios(tabela, linhas) {
      if (!linhas.length) return [];
      if (DEMO) { const rs = linhas.map((l) => ({ id: uid(), ...l })); demoDB()[tabela].push(...rs); demoStore.gravar(demoDB()); return rs; }
      const { data, error } = await sb.from(tabela).insert(linhas).select();
      if (error) throw error;
      return data;
    },
    async atualizar(tabela, id, campos) {
      if (DEMO) { const r = demoDB()[tabela].find((x) => x.id === id); Object.assign(r, campos); demoStore.gravar(demoDB()); return r; }
      const { data, error } = await sb.from(tabela).update(campos).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    async remover(tabela, id) {
      if (DEMO) { const t = demoDB()[tabela]; t.splice(t.findIndex((x) => x.id === id), 1); demoStore.gravar(demoDB()); return; }
      const { error } = await sb.from(tabela).delete().eq("id", id);
      if (error) throw error;
    }
  };

  // ================================================================
  // ESTADO
  // ================================================================
  const estado = {
    usuario: null,          // { nome }
    contas: [],
    pagamentos: [],
    rendas: [],
    gastos: [],
    orcamentos: [],
    migracao2: true,        // tabelas de gastos existem no banco?
    metas: [],
    aportes: [],
    cartoes: [],
    faturas_pagas: [],
    migracao3: true,        // tabelas de metas/cartões existem no banco?
    migracao4: true,        // coluna contas.fim (conta "só neste mês") existe?
    mes: compDe(new Date()),
    filtro: "pendentes"
  };

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

  // ================================================================
  // CARREGAR E CALCULAR
  // ================================================================
  async function carregar() {
    try {
      const opcional = (t, flag) => db.listar(t).catch((e) => { console.warn(t, e); estado[flag] = false; return []; });
      estado.migracao2 = true; estado.migracao3 = true;
      const [contas, pagamentos, rendas, gastos, orcamentos, metas, aportes, cartoes, faturas_pagas] = await Promise.all([
        db.listar("contas"), db.listar("pagamentos"), db.listar("rendas"),
        opcional("gastos", "migracao2"), opcional("orcamentos", "migracao2"),
        opcional("metas", "migracao3"), opcional("aportes", "migracao3"), opcional("cartoes", "migracao3"), opcional("faturas_pagas", "migracao3")
      ]);
      Object.assign(estado, { contas, pagamentos, rendas, gastos, orcamentos, metas, aportes, cartoes, faturas_pagas });
      estado.migracao4 = DEMO ? true : contas.length ? "fim" in contas[0] : !(await sb.from("contas").select("fim").limit(1)).error;
      if (!DEMO && estado.familia) {
        const [mb, cv] = await Promise.all([db.listar("membros").catch(() => []), db.listar("convites").catch(() => [])]);
        estado.membrosFamilia = mb; estado.convites = cv;
      }
      render();
      esconderSplash();
      if (!lerPref("tutorial-visto", false)) setTimeout(() => abrirTutorial(0), 500);
    } catch (e) {
      esconderSplash();
      console.error(e);
      toast("Não foi possível carregar os dados: " + (e.message || e));
    }
  }

  const pagamentoDe = (contaId, comp) => estado.pagamentos.find((p) => p.conta_id === contaId && p.competencia === comp);

  /** Contas que valem para a competência: ativas e iniciadas até o mês, ou que tenham pagamento registrado nele. */
  function contasDoMes(comp) {
    return estado.contas
      .filter((c) => pagamentoDe(c.id, comp) || (c.ativa && (c.inicio || "0000-00-00") <= comp && (!c.fim || comp <= c.fim)))
      .map((c) => {
        const pg = pagamentoDe(c.id, comp);
        // conta de valor variável em mês futuro: não projeta valor ("a definir") e não soma no total
        // (no primeiro mês da conta vale o valor que a pessoa cadastrou: é o valor real daquele mês)
        const primeiroMes = (c.inicio || "").slice(0, 7) === comp.slice(0, 7);
        const aDefinir = !pg && !!c.variavel && comp > compDe(new Date()) && !primeiroMes;
        const prev = !pg && c.variavel && !aDefinir && !primeiroMes ? previsaoVariavel(c, comp) : null;
        return { ...c, pagamento: pg || null, estimado: prev !== null, aDefinir,
          valorMes: pg ? Number(pg.valor_pago) : aDefinir ? 0 : prev ?? Number(c.valor), status: statusDe(c, comp, pg) };
      })
      .sort((a, b) => a.dia_vencimento - b.dia_vencimento || a.nome.localeCompare(b.nome));
  }

  /** Média dos últimos 3 pagamentos antes do mês; sem histórico, o valor cadastrado. */
  function previsaoVariavel(conta, comp) {
    const ult = estado.pagamentos.filter((p) => p.conta_id === conta.id && p.competencia < comp)
      .sort((a, b) => b.competencia.localeCompare(a.competencia)).slice(0, 3);
    return ult.length ? Math.round((soma(ult, (p) => p.valor_pago) / ult.length) * 100) / 100 : Number(conta.valor);
  }

  const gastosDoMes = (comp) => estado.gastos.filter((g) => g.data.slice(0, 7) === comp.slice(0, 7));

  function statusDe(conta, comp, pg) {
    if (pg) return { chave: "paga", texto: "✓ Paga" };
    const [a, m] = comp.split("-").map(Number);
    const ultimoDia = new Date(a, m, 0).getDate();
    const venc = `${a}-${pad(m)}-${pad(Math.min(conta.dia_vencimento, ultimoDia))}`;
    const hoje = hojeISO();
    if (venc < hoje) return { chave: "atrasada", texto: "! Atrasada" };
    if (venc === hoje) return { chave: "hoje", texto: "● Vence hoje" };
    const dias = Math.round((new Date(venc) - new Date(hoje)) / 864e5);
    if (dias <= DIAS_ALERTA) return { chave: "breve", texto: `● Vence em ${dias} dia${dias > 1 ? "s" : ""}` };
    return { chave: "futura", texto: "A vencer" };
  }

  const soma = (arr, f) => arr.reduce((t, x) => t + (Number(f(x)) || 0), 0);

  // ================================================================
  // RENDER
  // ================================================================
  function render() {
    $("#mes-atual").textContent = nomeMes(estado.mes, "medio");
    const lista = contasDoMes(estado.mes);
    renderHero(lista);
    renderAlertas(lista);
    renderResumoGastos();
    renderProximas(lista);
    renderListaMes(lista);
    renderCategorias(lista);
    renderDivisao(lista);
    renderHistorico();
    renderCadastroContas();
    renderCadastroRendas();
    renderFiltroPessoa();
    renderGastos();
    renderCadastroOrcamentos();
    renderFaturas();
    renderCadastroCartoes();
    renderMetas();
    renderFamilia();
  }

  let totalAnterior = null;
  function renderHero(lista) {
    const fixas = soma(lista, (c) => c.valorMes);
    const pago = soma(lista.filter((c) => c.pagamento), (c) => c.valorMes);
    const pct = fixas ? Math.round((pago / fixas) * 100) : 0;
    const comGastos = estado.migracao2;
    const gastos = comGastos ? soma(gastosDoMes(estado.mes), (g) => g.valor) : 0;
    const limite = comGastos ? soma(estado.orcamentos.filter((o) => o.ativa), (o) => o.limite) : 0;
    const total = fixas + gastos;
    const renda = soma(estado.rendas.filter((r) => r.ativa), (r) => r.valor);
    const pctRenda = renda ? Math.round((total / renda) * 100) : null;
    const R = 26, C = 2 * Math.PI * R;
    const mes = esc(nomeMes(estado.mes, "mes"));
    $("#hero").innerHTML = `
      <div class="hero-topo">
        <div>
          <div class="rotulo">${comGastos ? `Total de ${mes}` : `Contas fixas de ${mes}`}
            <button class="olho" id="btn-olho" aria-label="${ocultar ? "Mostrar valores" : "Esconder valores"}" aria-pressed="${ocultar}">${svg(ocultar ? "olhoFechado" : "olho")}</button>
          </div>
          <div class="grande" id="hero-total">${fmt(total)}</div>
          ${comGastos ? `<div class="hero-sub">contas fixas + gastos</div>` : ""}
        </div>
        <div class="rosca" role="img" aria-label="${pct}% das contas fixas pagas">
          <svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="${R}" class="trilho-r"/>
            <circle cx="32" cy="32" r="${R}" class="arco-r" stroke-dasharray="${C}" stroke-dashoffset="${C}" data-alvo="${C * (1 - pct / 100)}"/></svg>
          <span>${pct}%<small>${comGastos ? "contas<br>pagas" : "pago"}</small></span>
        </div>
      </div>
      ${comGastos ? `
      <div class="duas">
        <button type="button" class="hero-box" data-ir="contas"><small>Contas fixas ›</small><b>${fmt(fixas)}</b><em>${pago >= fixas && fixas ? "tudo pago ✓" : `falta pagar ${fmt(fixas - pago)}`}</em></button>
        <button type="button" class="hero-box" data-ir="gastos"><small>Gastos ›</small><b>${fmt(gastos)}</b><em>${limite ? (gastos <= limite ? `restam ${fmt(limite - gastos)}` : `⚠ passou ${fmt(gastos - limite)}`) : "lançados no mês"}</em></button>
      </div>` : `
      <div class="duas">
        <div><small>Já pago</small><b>${fmt(pago)}</b></div>
        <div><small>Falta pagar</small><b>${fmt(fixas - pago)}</b></div>
      </div>`}
      <div class="renda-linha">${renda
        ? `<span><b>${pctRenda}%</b> da renda</span><span>Sobram ${fmt(renda - total)}</span>`
        : `<span>Cadastre as rendas em Mais → Rendas para ver quanto sobra</span>`}</div>`;
    // anima o arco e o número
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const arco = $("#hero .arco-r"); if (arco) arco.style.strokeDashoffset = arco.dataset.alvo;
    }));
    if (!ocultar && totalAnterior !== null && totalAnterior !== total) contarAte($("#hero-total"), totalAnterior, total);
    totalAnterior = total;
  }

  function contarAte(el, de, ate) {
    const ini = performance.now(), dur = 450;
    const passo = (t) => {
      const k = Math.min((t - ini) / dur, 1), e = 1 - Math.pow(1 - k, 3);
      el.textContent = brl.format(de + (ate - de) * e);
      if (k < 1) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  }

  function renderAlertas(lista) {
    const atr = lista.filter((c) => c.status.chave === "atrasada");
    const hoje = lista.filter((c) => c.status.chave === "hoje");
    const breve = lista.filter((c) => c.status.chave === "breve");
    const pend = lista.filter((c) => !c.pagamento);
    const itens = [];
    if (atr.length) itens.push(`<button class="alerta crit" data-ir="contas">! ${atr.length} atrasada${atr.length > 1 ? "s" : ""} · ${fmt(soma(atr, (c) => c.valorMes))}</button>`);
    if (hoje.length) itens.push(`<button class="alerta warn" data-ir="contas">● ${hoje.length} vence${hoje.length > 1 ? "m" : ""} hoje</button>`);
    if (breve.length) itens.push(`<button class="alerta warn" data-ir="contas">● ${breve.length} em breve</button>`);
    faturasDoMes(estado.mes).forEach((f) => {
      if (f.status.chave === "vencida") itens.push(`<button class="alerta crit" data-abrir-fatura="${f.cartao.id}">! Fatura ${esc(f.cartao.nome)} vencida</button>`);
      else if (f.status.chave === "fechada" && f.status.dias <= DIAS_ALERTA) itens.push(`<button class="alerta warn" data-abrir-fatura="${f.cartao.id}">● Fatura ${esc(f.cartao.nome)} ${f.status.dias === 0 ? "vence hoje" : `vence em ${f.status.dias}d`}</button>`);
    });
    if (lista.length && !pend.length) itens.push(`<span class="alerta good">✓ Tudo pago neste mês</span>`);
    $("#alertas").innerHTML = itens.join("");
    const cont = $("#contador-pendentes");
    const urg = atr.length + hoje.length;
    cont.hidden = !urg; cont.textContent = urg;
  }

  function itemConta(c) {
    const titulo = c.pagamento
      ? `Pago em ${new Date(c.pagamento.pago_em + "T12:00").toLocaleDateString("pt-BR")}${c.pagamento.pago_por ? " por " + c.pagamento.pago_por : ""}`
      : "Marcar como paga";
    return `
      <li class="${c.pagamento ? "paga" : ""}">
        <button class="pagar ${c.pagamento ? "on" : ""}" data-pagar="${c.id}" aria-label="${c.pagamento ? "Desmarcar pagamento de" : "Marcar como paga:"} ${esc(c.nome)}" title="${esc(titulo)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4.5 4.5L19 7"/></svg></button>
        ${bolaIcone(c)}
        <div class="info" data-editar-conta="${c.id}">
          <div class="nome">${esc(c.nome)}</div>
          <div class="meta">${c.fim ? "Só neste mês · " : ""}Dia ${c.dia_vencimento} · ${esc(c.categoria)} · ${esc(c.responsavel)}</div>
        </div>
        <div class="dir">
          ${c.aDefinir ? `<span class="valor a-definir" title="O valor muda todo mês: informe quando pagar">a definir</span>`
            : `<span class="valor" ${c.estimado ? 'title="Estimativa pela média dos últimos meses"' : ""}>${c.estimado && !ocultar ? "~" : ""}${fmt(c.valorMes)}</span>`}
          <span class="badge ${c.status.chave}">${c.status.texto}</span>
        </div>
      </li>`;
  }

  function renderProximas(lista) {
    const pend = lista.filter((c) => !c.pagamento).slice(0, 3);
    $("#lista-proximas").innerHTML = pend.length
      ? pend.map(itemConta).join("")
      : estado.contas.length
        ? vazio("festa", "Tudo em dia!", "Nenhuma conta pendente neste mês.")
        : vazio("lista", "Comece cadastrando suas contas", "Aluguel, luz, internet… cadastre uma vez e acompanhe todo mês.", ["nova-conta", "Cadastrar primeira conta"]);
  }

  function renderAvisoContas() {
    const el = $("#aviso-contas");
    el.hidden = lerPref("aviso-contas-ok", false) || !estado.contas.length;
  }

  function renderResumoContas(lista) {
    const total = soma(lista, (c) => c.valorMes);
    const pago = soma(lista.filter((c) => c.pagamento), (c) => c.valorMes);
    const pct = total ? Math.round((pago / total) * 100) : 0;
    const atr = lista.filter((c) => c.status.chave === "atrasada");
    const npag = lista.filter((c) => c.pagamento).length;
    $("#resumo-contas").hidden = !lista.length;
    $("#resumo-contas").innerHTML = `
      <div class="rc-topo"><div><small>Contas fixas de ${esc(nomeMes(estado.mes, "mes"))}</small><b>${fmt(total)}</b>${lista.some((c) => c.aDefinir) ? `<em class="rc-def">+ ${lista.filter((c) => c.aDefinir).length} com valor a definir</em>` : ""}</div><span class="rc-pct">${pct}%<small>pago</small></span></div>
      <div class="meter-orc grande ${pct === 100 ? "bom" : "ok"}"><span style="width:${pct}%"></span></div>
      <div class="rc-duas">
        <div><small>Já pago</small><b class="bom-txt">${fmt(pago)}</b><em>${npag} de ${lista.length} conta${lista.length !== 1 ? "s" : ""}</em></div>
        <div><small>Falta pagar</small><b>${fmt(total - pago)}</b><em class="${atr.length ? "crit" : ""}">${atr.length ? `! ${atr.length} atrasada${atr.length > 1 ? "s" : ""}` : lista.length - npag ? `${lista.length - npag} pendente${lista.length - npag > 1 ? "s" : ""}` : "tudo pago ✓"}</em></div>
      </div>`;
  }

  function renderListaMes(lista) {
    renderAvisoContas();
    renderResumoContas(lista);
    const f = estado.filtro;
    const itens = lista.filter((c) => f === "todas" || (f === "pagas" ? c.pagamento : !c.pagamento));
    $("#lista-mes").innerHTML = itens.length
      ? itens.map(itemConta).join("")
      : !estado.contas.length
        ? vazio("lista", "Nenhuma conta cadastrada", "Cadastre as contas fixas e elas aparecem aqui todo mês.", ["nova-conta", "Nova conta"])
        : f === "pendentes" ? vazio("festa", "Nada a pagar neste mês", "Todas as contas já foram pagas.")
        : vazio("lista", "Nenhuma conta paga ainda", "Toque no quadrado de uma conta para marcar como paga.");
  }

  function renderCategorias(lista) {
    const mapa = {};
    lista.forEach((c) => (mapa[c.categoria] = (mapa[c.categoria] || 0) + c.valorMes));
    let linhas = Object.entries(mapa).sort((a, b) => b[1] - a[1]);
    if (linhas.length > 7) {
      const resto = linhas.slice(6);
      linhas = [...linhas.slice(0, 6), [`Outras (${resto.length})`, soma(resto, (l) => l[1])]];
    }
    const total = soma(linhas, (l) => l[1]);
    const max = Math.max(...linhas.map((l) => l[1]), 1);
    $("#graf-categorias").innerHTML = linhas.length
      ? linhas.map(([cat, v]) => `
        <div class="bh" data-tip="${esc(cat)}: ${fmt(v)} (${Math.round((v / total) * 100)}% do mês)">
          <span class="r">${esc(cat)} <span style="color:var(--text-3)">· ${Math.round((v / total) * 100)}%</span></span>
          <span class="v">${fmt(v)}</span>
          <div class="trilho"><div class="barra" style="width:${(v / max) * 100}%"></div></div>
        </div>`).join("")
      : `<ul class="lista-contas">${vazio("grafico", "Sem dados neste mês", "Cadastre contas para ver para onde vai o dinheiro.")}</ul>`;
  }

  function renderDivisao(lista) {
    const casal = soma(lista.filter((c) => c.responsavel === "Casal"), (c) => c.valorMes);
    const outros = lista.filter((c) => c.responsavel !== "Casal" && !PESSOAS.includes(c.responsavel));
    $("#divisao").innerHTML = PESSOAS.map((p) => {
      const ind = soma(lista.filter((c) => c.responsavel === p), (c) => c.valorMes);
      const metade = casal / PESSOAS.length;
      return `<div class="pessoa"><div><div class="n">${esc(p)}</div><div class="d">${fmt(ind)} só dele(a) + ${fmt(metade)} do casal</div></div><div class="t">${fmt(ind + metade)}</div></div>`;
    }).join("") + (outros.length ? `<p class="muted pequeno">${outros.length} conta(s) com responsável não reconhecido ficaram de fora.</p>` : "");
  }

  function renderHistorico() {
    const meses = Array.from({ length: 6 }, (_, i) => somaMes(estado.mes, i - 5));
    const atual = compDe(new Date());
    const dados = meses.map((m) => {
      const l = contasDoMes(m);
      const previsto = m >= atual;
      const valor = previsto ? soma(l, (c) => c.valorMes) : soma(l.filter((c) => c.pagamento), (c) => c.valorMes);
      return { m, valor, previsto };
    });
    const max = Math.max(...dados.map((d) => d.valor), 1);
    $("#graf-historico").innerHTML = dados.map((d) => `
      <div class="bv ${d.previsto ? "previsto" : ""}" data-tip="${esc(nomeMes(d.m))}: ${fmt(d.valor)} ${d.previsto ? "(previsto)" : "(pago)"}">
        <span class="rot-v">${d.valor ? brlCurto.format(d.valor) : ""}</span>
        <div class="barra" style="height:${(d.valor / max) * 85}%"></div>
      </div>`).join("");
    $("#eixo-historico").innerHTML = dados.map((d) => `<span>${esc(nomeMes(d.m, "curto"))}</span>`).join("");
  }

  function renderCadastroContas() {
    const contas = [...estado.contas].sort((a, b) => (b.ativa - a.ativa) || a.dia_vencimento - b.dia_vencimento);
    const ativas = contas.filter((c) => c.ativa && !c.fim);
    $("#cad-contas").innerHTML = contas.length
      ? contas.map((c) => `
        <li class="swipe ${c.ativa ? "" : "inativa"}" data-swipe="conta" data-id="${c.id}">${ACAO_EXCLUIR()}
          <button class="item" data-editar-conta="${c.id}">
            ${bolaIcone(c)}
            <div><div class="nome">${esc(c.nome)}${c.ativa ? "" : ' <span class="badge inativa">Encerrada</span>'}</div>
            <div class="meta">${c.fim ? `Só ${esc(nomeMes(c.fim, "curto").toLowerCase())}/${c.fim.slice(2, 4)} · ` : c.variavel ? "Valor variável · " : ""}Dia ${c.dia_vencimento} · ${esc(c.categoria)} · ${esc(c.responsavel)}${c.forma_pagamento ? " · " + esc(c.forma_pagamento) : ""}</div></div>
            <span class="valor">${fmt(c.valor)}</span><span class="seta">›</span>
          </button>
        </li>`).join("") + `<li class="total"><span>Total por mês</span><span>${fmt(soma(ativas, (c) => c.valor))}</span></li>`
      : vazio("lista", "Nenhuma conta fixa", "Toque em + para cadastrar a primeira.", ["nova-conta", "Nova conta"]);
  }

  function renderCadastroRendas() {
    const rendas = [...estado.rendas].sort((a, b) => b.ativa - a.ativa);
    $("#cad-rendas").innerHTML = rendas.length
      ? rendas.map((r) => `
        <li class="swipe ${r.ativa ? "" : "inativa"}" data-swipe="renda" data-id="${r.id}">${ACAO_EXCLUIR()}
          <button class="item" data-editar-renda="${r.id}">
            <span class="bola-cat" aria-hidden="true">${svg("moeda")}</span>
            <div><div class="nome">${esc(r.descricao)}${r.ativa ? "" : ' <span class="badge inativa">Encerrada</span>'}</div><div class="meta">${esc(r.responsavel)}</div></div>
            <span class="valor">${fmt(r.valor)}</span><span class="seta">›</span>
          </button>
        </li>`).join("") + `<li class="total"><span>Total por mês</span><span>${fmt(soma(rendas.filter((r) => r.ativa), (r) => r.valor))}</span></li>`
      : vazio("moeda", "Nenhuma renda cadastrada", "Com as rendas, o painel mostra quanto sobra depois das contas.", ["nova-renda", "Nova renda"]);
  }

  // ---------- Filtro por pessoa (abas Gastos e Metas) ----------
  let pessoa = lerPref("pessoa", "todos");
  if (pessoa !== "todos" && !PESSOAS.includes(pessoa)) pessoa = "todos";
  const daPessoa = (x) => pessoa === "todos" || x.responsavel === pessoa;
  const gastosFiltrados = () => gastosDoMes(estado.mes).filter(daPessoa);
  function renderFiltroPessoa() {
    const ops = [["todos", "Todos"], ...PESSOAS.map((p) => [p, p])];
    $$("[data-filtro-pessoa]").forEach((el) => {
      el.innerHTML = ops.map(([v, t]) => `<button type="button" class="chip-pessoa ${v === pessoa ? "ativo" : ""}" data-pessoa="${esc(v)}" aria-pressed="${v === pessoa}">${v === "todos" ? "" : `<span class="mini-avatar">${esc(t.charAt(0))}</span>`}${esc(t)}</button>`).join("");
    });
  }

  // ---------- Gastos variáveis ----------
  function statusOrc(gasto, limite) {
    if (!limite) return { cls: "neutro", pct: 0, txt: "Sem limite" };
    const pct = (gasto / limite) * 100;
    if (pct > 100) return { cls: "crit", pct: 100, txt: `Passou ${fmt(gasto - limite)}` };
    if (pct >= 80) return { cls: "warn", pct, txt: `Restam ${fmt(limite - gasto)}` };
    return { cls: "ok", pct, txt: `Restam ${fmt(limite - gasto)}` };
  }

  function linhasOrcamento() {
    const gastos = gastosDoMes(estado.mes);
    const porCat = {};
    gastos.forEach((g) => (porCat[g.categoria] = (porCat[g.categoria] || 0) + Number(g.valor)));
    const linhas = estado.orcamentos.filter((o) => o.ativa).map((o) => ({ categoria: o.categoria, limite: Number(o.limite), gasto: porCat[o.categoria] || 0, id: o.id }));
    Object.keys(porCat).filter((c) => !linhas.some((l) => l.categoria === c))
      .forEach((c) => linhas.push({ categoria: c, limite: 0, gasto: porCat[c] }));
    return linhas.sort((a, b) => (b.limite ? b.gasto / b.limite : -1) - (a.limite ? a.gasto / a.limite : -1) || b.gasto - a.gasto);
  }

  function diasRestantesNoMes() {
    if (estado.mes !== compDe(new Date())) return null;
    const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() - d.getDate() + 1;
  }

  /** O total de gastos agora aparece no cartão azul da tela inicial; o cartão separado fica escondido. */
  function renderResumoGastos() { $("#resumo-gastos").hidden = true; }

  function renderGastos() {
    $("#aviso-migracao").hidden = estado.migracao2;
    $("#aviso-migracao").innerHTML = `<strong>Falta um passo no banco de dados</strong><p class="muted pequeno" style="margin-bottom:0">Para usar os gastos variáveis, rode o arquivo <code>supabase/migracao-02-gastos.sql</code> no SQL Editor do Supabase e recarregue o app.</p>`;
    $$(".painel-gastos").forEach((p) => p.classList.toggle("desativado", !estado.migracao2));
    if (!estado.migracao2) { $("#resumo-orc").innerHTML = ""; $("#lista-orc").innerHTML = ""; $("#extrato").innerHTML = ""; return; }

    const gastos = gastosFiltrados();
    if (pessoa !== "todos") { renderGastosPessoa(gastos); renderExtrato(gastos); return; }
    const total = soma(gastos, (g) => g.valor);
    const limite = soma(estado.orcamentos.filter((o) => o.ativa), (o) => o.limite);
    const st = statusOrc(total, limite);
    const dias = diasRestantesNoMes();
    $("#resumo-orc").innerHTML = `
      <div class="ro-num"><small>Gasto em ${esc(nomeMes(estado.mes, "mes"))}</small><b>${fmt(total)}</b>${limite ? `<span>de ${fmt(limite)} planejados</span>` : ""}</div>
      ${limite ? `<div class="meter-orc grande ${st.cls}"><span style="width:${st.pct}%"></span></div>
      <div class="ro-rodape"><span class="${st.cls}">${st.txt}</span>${dias && total < limite ? `<span>${fmt((limite - total) / dias)} por dia · ${dias} dia${dias > 1 ? "s" : ""}</span>` : ""}</div>` : ""}`;

    const linhas = linhasOrcamento();
    $("#lista-orc").innerHTML = linhas.length ? linhas.map((l) => {
      const s2 = statusOrc(l.gasto, l.limite);
      return `
      <li>
        <button class="orc-item" data-filtrar-cat="${esc(l.categoria)}">
          <span class="bola-cat">${svg(iconeDe(l.categoria))}</span>
          <div class="orc-meio">
            <div class="orc-linha"><span class="nome">${esc(l.categoria)}</span><span class="valor">${fmt(l.gasto)}</span></div>
            ${l.limite ? `<div class="meter-orc ${s2.cls}"><span style="width:${s2.pct}%"></span></div>` : ""}
            <div class="orc-linha orc-st"><span class="${s2.cls}">${s2.cls === "crit" ? "! " : ""}${s2.txt}</span>${l.limite ? `<span class="neutro">limite ${fmt(l.limite)}</span>` : ""}</div>
          </div>
        </button>
      </li>`;
    }).join("") : vazio("carrinho", "Nenhuma categoria de gasto", "Crie categorias com limite mensal em Mais → Orçamentos.", ["novo-orcamento", "Nova categoria"]);

    renderExtrato(gastos);
  }

  /** Visão de uma pessoa: quanto ela gastou e quanto isso representa do gasto do casal (os limites são do casal). */
  function renderGastosPessoa(gastos) {
    const doCasal = gastosDoMes(estado.mes);
    const total = soma(gastos, (g) => g.valor), totalCasal = soma(doCasal, (g) => g.valor);
    const pct = totalCasal ? Math.round((total / totalCasal) * 100) : 0;
    $("#resumo-orc").innerHTML = `
      <div class="ro-num"><small>Gastos de ${esc(pessoa)} em ${esc(nomeMes(estado.mes, "mes"))}</small><b>${fmt(total)}</b><span>de ${fmt(totalCasal)} do casal</span></div>
      <div class="meter-orc grande ok"><span style="width:${pct}%"></span></div>
      <div class="ro-rodape"><span>${pct}% dos gastos do casal</span><span>${gastos.length} lançamento${gastos.length !== 1 ? "s" : ""}</span></div>`;
    const porCat = {}, porCatCasal = {};
    gastos.forEach((g) => (porCat[g.categoria] = (porCat[g.categoria] || 0) + Number(g.valor)));
    doCasal.forEach((g) => (porCatCasal[g.categoria] = (porCatCasal[g.categoria] || 0) + Number(g.valor)));
    const linhas = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
    $("#lista-orc").innerHTML = linhas.length ? linhas.map(([cat, v]) => {
      const c = porCatCasal[cat] || v, p = Math.round((v / c) * 100);
      return `
      <li>
        <button class="orc-item" data-filtrar-cat="${esc(cat)}">
          <span class="bola-cat">${svg(iconeDe(cat))}</span>
          <div class="orc-meio">
            <div class="orc-linha"><span class="nome">${esc(cat)}</span><span class="valor">${fmt(v)}</span></div>
            <div class="meter-orc ok"><span style="width:${p}%"></span></div>
            <div class="orc-linha orc-st"><span class="ok">${p}% do gasto do casal aqui</span><span class="neutro">casal ${fmt(c)}</span></div>
          </div>
        </button>
      </li>`;
    }).join("") : vazio("carrinho", `${esc(pessoa)} não lançou gastos neste mês`, "Os gastos marcados como “Casal” aparecem só em Todos.");
  }

  let filtroCatGasto = null;
  function renderExtrato(gastos) {
    const lista = (filtroCatGasto ? gastos.filter((g) => g.categoria === filtroCatGasto) : gastos)
      .slice().sort((a, b) => b.data.localeCompare(a.data) || String(b.created_at || "").localeCompare(String(a.created_at || "")));
    const hoje = hojeISO();
    const ontem = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; })();
    const rotuloDia = (d) => d === hoje ? "Hoje" : d === ontem ? "Ontem"
      : (() => { const t = new Date(d + "T12:00").toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, ""); return t.charAt(0).toUpperCase() + t.slice(1); })();
    const grupos = [];
    lista.forEach((g) => { const u = grupos[grupos.length - 1]; if (u && u.dia === g.data) u.itens.push(g); else grupos.push({ dia: g.data, itens: [g] }); });
    const filtro = filtroCatGasto ? `<div class="filtro-ativo">Mostrando <b>${esc(filtroCatGasto)}</b> · ${fmt(soma(lista, (g) => g.valor))}<button data-limpar-filtro aria-label="Limpar filtro">✕</button></div>` : "";
    $("#extrato").innerHTML = filtro + (grupos.length ? grupos.map((gr) => `
      <div class="dia-extrato"><span>${esc(rotuloDia(gr.dia))}</span><span>${fmt(soma(gr.itens, (g) => g.valor))}</span></div>
      <article class="card card-lista"><ul class="lista-cadastro">${gr.itens.map((g) => `
        <li class="swipe" data-swipe="gasto" data-id="${g.id}">${ACAO_EXCLUIR()}<button class="item" data-editar-gasto="${g.id}">
          <span class="bola-cat">${svg(iconeDe(g.categoria, g.descricao))}</span>
          <div><div class="nome">${esc(g.descricao)}</div><div class="meta">${esc(g.categoria)} · ${esc(g.responsavel)}${g.forma_pagamento ? " · " + esc(g.forma_pagamento) : ""}${g.parcelas > 1 ? ` · ${g.parcelas}x` : ""}</div></div>
          <span class="valor">−${fmt(g.valor)}</span><span class="seta">›</span>
        </button></li>`).join("")}</ul></article>`).join("") + `<p class="dica">Arraste um gasto para a esquerda para excluir.</p>`
      : `<article class="card card-lista"><ul class="lista-cadastro">${vazio("carrinho", "Nenhum gasto neste mês", "Registre mercado, delivery, lazer… e acompanhe o limite de cada categoria.", ["novo-gasto", "Registrar gasto"])}</ul></article>`);
  }

  function renderCadastroOrcamentos() {
    const el = $("#cad-orcamentos");
    if (!estado.migracao2) { el.innerHTML = vazio("carrinho", "Falta um passo no banco", "Rode supabase/migracao-02-gastos.sql no Supabase para usar orçamentos."); return; }
    const orcs = [...estado.orcamentos].sort((a, b) => (b.ativa - a.ativa) || a.categoria.localeCompare(b.categoria));
    el.innerHTML = orcs.length ? orcs.map((o) => `
      <li class="${o.ativa ? "" : "inativa"}">
        <button class="item" data-editar-orcamento="${o.id}">
          <span class="bola-cat">${svg(iconeDe(o.categoria))}</span>
          <div><div class="nome">${esc(o.categoria)}${o.ativa ? "" : ' <span class="badge inativa">Arquivada</span>'}</div><div class="meta">Limite mensal</div></div>
          <span class="valor">${fmt(o.limite)}</span><span class="seta">›</span>
        </button>
      </li>`).join("") + `<li class="total"><span>Total planejado por mês</span><span>${fmt(soma(orcs.filter((o) => o.ativa), (o) => o.limite))}</span></li>`
      : vazio("carrinho", "Nenhuma categoria de gasto", "Ex.: Mercado R$ 1.200, Lazer R$ 300.", ["novo-orcamento", "Nova categoria"]);
  }

  // ---------- Cartões de crédito ----------
  const diasNoMes = (a, m) => new Date(a, m, 0).getDate();
  const dataNoMes = (comp, dia) => { const [a, m] = comp.split("-").map(Number); return `${a}-${pad(m)}-${pad(Math.min(dia, diasNoMes(a, m)))}`; };
  const diasEntre = (de, ate) => Math.round((new Date(ate + "T12:00") - new Date(de + "T12:00")) / 864e5);
  const venceNoMesmoMes = (c) => c.dia_vencimento > c.dia_fechamento;

  /** Mês de vencimento ("AAAA-MM-01") da fatura em que entra uma compra feita em dataISO. */
  function competenciaFatura(c, dataISO) {
    const [a, m, d] = dataISO.split("-").map(Number);
    const fech = Math.min(c.dia_fechamento, diasNoMes(a, m));
    const mesFech = d <= fech ? compDe(new Date(a, m - 1, 1)) : compDe(new Date(a, m, 1));
    return venceNoMesmoMes(c) ? mesFech : somaMes(mesFech, 1);
  }
  const datasFatura = (c, comp) => ({
    fechamento: dataNoMes(venceNoMesmoMes(c) ? comp : somaMes(comp, -1), c.dia_fechamento),
    vencimento: dataNoMes(comp, c.dia_vencimento)
  });

  function itensFatura(c, comp) {
    const itens = [];
    estado.gastos.filter((g) => g.cartao_id === c.id).forEach((g) => {
      const n = Math.max(1, Number(g.parcelas) || 1);
      const k = (() => { const [a1, m1] = competenciaFatura(c, g.data).split("-").map(Number); const [a2, m2] = comp.split("-").map(Number); return (a2 - a1) * 12 + (m2 - m1); })();
      if (k < 0 || k >= n) return;
      const parcela = Math.floor((Number(g.valor) / n) * 100) / 100;
      const valor = k === n - 1 ? Math.round((Number(g.valor) - parcela * (n - 1)) * 100) / 100 : parcela;
      itens.push({ tipo: "gasto", id: g.id, data: g.data, descricao: g.descricao, categoria: g.categoria, valor, parcela: n > 1 ? `${k + 1}/${n}` : "" });
    });
    for (let i = -2; i <= 0; i++) {
      const mesConta = somaMes(comp, i);
      contasDoMes(mesConta).filter((x) => x.cartao_id === c.id).forEach((x) => {
        const data = dataNoMes(mesConta, x.dia_vencimento);
        if (competenciaFatura(c, data) === comp) itens.push({ tipo: "conta", id: x.id, data, descricao: x.nome, categoria: x.categoria, valor: x.valorMes, parcela: "", estimado: x.estimado, aDefinir: x.aDefinir });
      });
    }
    return itens.sort((a, b) => b.data.localeCompare(a.data));
  }

  const faturaPaga = (c, comp) => estado.faturas_pagas.find((f) => f.cartao_id === c.id && f.competencia === comp);

  function statusFatura(c, comp) {
    const pg = faturaPaga(c, comp);
    const { fechamento, vencimento } = datasFatura(c, comp);
    const hoje = hojeISO();
    if (pg) return { chave: "paga", texto: "✓ Paga", cls: "paga" };
    if (hoje <= fechamento) { const d = diasEntre(hoje, fechamento); return { chave: "aberta", texto: d === 0 ? "Aberta · fecha hoje" : `Aberta · fecha em ${d} dia${d > 1 ? "s" : ""}`, cls: "futura", dias: d }; }
    if (hoje <= vencimento) { const d = diasEntre(hoje, vencimento); return { chave: "fechada", texto: d === 0 ? "● Vence hoje" : `● Fechada · vence em ${d} dia${d > 1 ? "s" : ""}`, cls: d <= DIAS_ALERTA ? "breve" : "futura", dias: d }; }
    return { chave: "vencida", texto: "! Vencida", cls: "atrasada" };
  }

  function faturasDoMes(comp) {
    if (!estado.migracao3) return [];
    return estado.cartoes.filter((c) => c.ativo).map((c) => {
      const itens = itensFatura(c, comp);
      return { cartao: c, comp, itens, total: soma(itens, (i) => i.valor), status: statusFatura(c, comp), ...datasFatura(c, comp) };
    });
  }

  /** Quanto do limite está comprometido: faturas não pagas a partir da atual (inclui parcelas futuras). */
  function limiteUsado(c) {
    const atual = competenciaFatura(c, hojeISO());
    let total = 0;
    for (let i = -1; i < 48; i++) { const comp = somaMes(atual, i); if (!faturaPaga(c, comp)) total += soma(itensFatura(c, comp).filter((x) => x.tipo === "gasto"), (x) => x.valor); }
    return total;
  }

  const fmtData = (d, opts = { day: "numeric", month: "short" }) => new Date(d + "T12:00").toLocaleDateString("pt-BR", opts).replace(".", "");

  function renderFaturas() {
    const el = $("#faturas");
    const usaCartao = estado.migracao3 && estado.cartoes.length > 0;
    const segCartoes = $('#seg-gastos [data-g="cartoes"]');
    segCartoes.hidden = !usaCartao;
    if (!usaCartao && segCartoes.classList.contains("ativo")) { mostrarSubGastos("orcamento"); }
    if (!estado.migracao3) { el.innerHTML = avisoMigracao3(); return; }
    const fats = faturasDoMes(estado.mes);
    el.innerHTML = fats.length ? fats.map((f) => {
      const usado = f.cartao.limite ? limiteUsado(f.cartao) : 0;
      const pctLim = f.cartao.limite ? Math.min(100, (usado / f.cartao.limite) * 100) : 0;
      return `
      <button class="card fatura-card" data-abrir-fatura="${f.cartao.id}">
        <div class="fc-topo">
          <span class="bola-cat">${svg("cartao")}</span>
          <div class="fc-nome"><strong>${esc(f.cartao.nome)}</strong><small>Fatura de ${esc(nomeMes(f.comp, "mes"))} · ${esc(f.cartao.responsavel)}</small></div>
          <span class="seta">›</span>
        </div>
        <div class="fc-valor">${fmt(f.total)}</div>
        <div class="fc-linha"><span class="badge ${f.status.cls}">${f.status.texto}</span><span>Fecha ${esc(fmtData(f.fechamento))} · vence ${esc(fmtData(f.vencimento))}</span></div>
        ${f.cartao.limite ? `<div class="meter-orc ${pctLim > 90 ? "crit" : pctLim > 70 ? "warn" : "ok"}"><span style="width:${pctLim}%"></span></div>
        <div class="fc-linha neutro"><span>Limite usado ${fmt(usado)}</span><span>disponível ${fmt(Math.max(0, f.cartao.limite - usado))}</span></div>` : ""}
      </button>`;
    }).join("") : `<article class="card card-lista"><ul class="lista-cadastro">${vazio("cartao", "Nenhum cartão cadastrado", "Cadastre o cartão (dia de fechamento e vencimento) e escolha ele ao lançar gastos: a fatura é montada sozinha, com parcelas.", ["novo-cartao", "Cadastrar cartão"])}</ul></article>`;
  }

  let faturaAberta = null;
  function abrirFatura(cartaoId) {
    const c = estado.cartoes.find((x) => x.id === cartaoId); if (!c) return;
    faturaAberta = { cartao: c, comp: estado.mes };
    desenharFatura();
    $("#modal-fatura").showModal();
  }
  function desenharFatura() {
    const { cartao: c, comp } = faturaAberta;
    const itens = itensFatura(c, comp), total = soma(itens, (i) => i.valor), st = statusFatura(c, comp), dt = datasFatura(c, comp);
    const pg = faturaPaga(c, comp);
    $("#fatura-detalhe").innerHTML = `
      <div class="fd-topo"><span class="bola-cat">${svg("cartao")}</span><div><h2>${esc(c.nome)}</h2><small class="muted">Fatura de ${esc(nomeMes(comp))}</small></div></div>
      <div class="fd-total">${fmt(total)}</div>
      <div class="fc-linha"><span class="badge ${st.cls}">${st.texto}</span><span>Fecha ${esc(fmtData(dt.fechamento))} · vence ${esc(fmtData(dt.vencimento))}</span></div>
      ${pg ? `<p class="muted pequeno">Paga em ${esc(fmtData(pg.pago_em, { day: "numeric", month: "long" }))}${pg.pago_por ? " por " + esc(pg.pago_por) : ""} · ${fmt(Number(pg.valor_pago) || total)}</p>` : ""}
      <ul class="lista-cadastro fd-lista">${itens.length ? itens.map((i) => `
        <li><button class="item" ${i.tipo === "gasto" ? `data-editar-gasto="${i.id}"` : `data-editar-conta="${i.id}"`}>
          <span class="bola-cat">${svg(iconeDe(i.categoria, i.descricao))}</span>
          <div><div class="nome">${esc(i.descricao)}${i.parcela ? ` <span class="badge futura">${i.parcela}</span>` : ""}${i.tipo === "conta" ? ' <span class="badge futura">fixa</span>' : ""}</div><div class="meta">${esc(fmtData(i.data))} · ${esc(i.categoria)}</div></div>
          <span class="valor ${i.aDefinir ? "a-definir" : ""}">${i.aDefinir ? "a definir" : (i.estimado && !ocultar ? "~" : "") + fmt(i.valor)}</span><span class="seta">›</span>
        </button></li>`).join("") : vazio("cartao", "Nada nesta fatura", "Ao lançar um gasto, escolha este cartão em “Pagamento”.")}</ul>`;
    $("#btn-pagar-fatura").textContent = pg ? "Desmarcar pagamento" : "Marcar fatura como paga";
    $("#btn-pagar-fatura").classList.toggle("btn-primary", !pg);
    $("#btn-pagar-fatura").classList.toggle("btn-ghost", !!pg);
    $("#btn-pagar-fatura").disabled = !pg && !total;
  }
  async function alternarFatura() {
    const { cartao: c, comp } = faturaAberta;
    const pg = faturaPaga(c, comp);
    try {
      if (pg) { await db.remover("faturas_pagas", pg.id); estado.faturas_pagas = estado.faturas_pagas.filter((x) => x.id !== pg.id); toast("Pagamento da fatura desmarcado"); }
      else {
        const total = soma(itensFatura(c, comp), (i) => i.valor);
        estado.faturas_pagas.push(await db.inserir("faturas_pagas", { cartao_id: c.id, competencia: comp, valor_pago: total, pago_em: hojeISO(), pago_por: estado.usuario.nome.replace(" (demo)", "") }));
        toast(`Fatura ${c.nome} paga · ${fmt(total)}`);
      }
      render(); desenharFatura();
    } catch (e) { erro(e); }
  }

  function renderCadastroCartoes() {
    const el = $("#cad-cartoes");
    if (!estado.migracao3) { el.innerHTML = `<li>${avisoMigracao3()}</li>`; return; }
    const cs = [...estado.cartoes].sort((a, b) => (b.ativo - a.ativo) || a.nome.localeCompare(b.nome));
    el.innerHTML = cs.length ? cs.map((c) => `
      <li class="${c.ativo ? "" : "inativa"}">
        <button class="item" data-editar-cartao="${c.id}">
          <span class="bola-cat">${svg("cartao")}</span>
          <div><div class="nome">${esc(c.nome)}${c.ativo ? "" : ' <span class="badge inativa">Arquivado</span>'}</div><div class="meta">Fecha dia ${c.dia_fechamento} · vence dia ${c.dia_vencimento} · ${esc(c.responsavel)}</div></div>
          <span class="valor">${c.limite ? fmt(c.limite) : ""}</span><span class="seta">›</span>
        </button>
      </li>`).join("") : vazio("cartao", "Nenhum cartão", "Cadastre os cartões para acompanhar as faturas.", ["novo-cartao", "Novo cartão"]);
  }

  const avisoMigracao3 = () => `<div class="aviso-inline"><strong>Falta um passo no banco de dados</strong><span>Rode <code>supabase/migracao-03-metas-cartoes.sql</code> no SQL Editor do Supabase e recarregue o app.</span></div>`;

  // ---------- Metas ----------
  const guardadoEm = (meta) => soma(estado.aportes.filter((a) => a.meta_id === meta.id), (a) => a.valor);
  const mesesAte = (prazo) => { const [a1, m1] = compDe(new Date()).split("-").map(Number); const [a2, m2] = prazo.split("-").map(Number); return (a2 - a1) * 12 + (m2 - m1) + 1; };

  function infoMeta(meta) {
    const guardado = guardadoEm(meta), alvo = Number(meta.valor_alvo);
    const falta = Math.max(0, alvo - guardado), pct = Math.min(100, (guardado / alvo) * 100);
    const ultimos3 = [0, 1, 2].map((i) => somaMes(compDe(new Date()), -i - 1));
    const ritmo = soma(estado.aportes.filter((a) => a.meta_id === meta.id && ultimos3.includes(a.data.slice(0, 8) + "01")), (a) => a.valor) / 3;
    let plano = "", alerta = "";
    if (!falta) plano = "Meta alcançada! 🎉";
    else if (meta.prazo) {
      const meses = mesesAte(meta.prazo);
      if (meses <= 0) { plano = `Prazo passou (${nomeMes(meta.prazo, "curto")} ${meta.prazo.slice(0, 4)})`; alerta = "crit"; }
      else {
        const porMes = falta / meses;
        plano = `${fmt(porMes)}/mês até ${nomeMes(meta.prazo, "curto").toLowerCase()} ${meta.prazo.slice(0, 4)}`;
        if (ritmo > 0 && ritmo < porMes * 0.9) alerta = "warn";
      }
    } else if (ritmo > 0) {
      const meses = Math.ceil(falta / ritmo);
      const chega = somaMes(compDe(new Date()), meses);
      plano = `No ritmo atual, chegam lá em ${nomeMes(chega, "curto").toLowerCase()} ${chega.slice(0, 4)}`;
    } else plano = "Defina um prazo para saber quanto guardar por mês";
    return { guardado, alvo, falta, pct, ritmo, plano, alerta };
  }

  function renderMetas() {
    $("#aviso-migracao3").hidden = estado.migracao3;
    $("#aviso-migracao3").innerHTML = avisoMigracao3();
    if (!estado.migracao3) { $("#resumo-metas").innerHTML = ""; $("#lista-metas").innerHTML = ""; return; }
    const ativas = estado.metas.filter((m) => m.ativa);
    const aps = estado.aportes.filter(daPessoa);
    const total = soma(aps, (a) => a.valor);
    const totalCasal = soma(estado.metas, (m) => guardadoEm(m));
    const doMes = soma(aps.filter((a) => a.data.slice(0, 7) === estado.mes.slice(0, 7)), (a) => a.valor);
    const renda = soma(estado.rendas.filter((r) => r.ativa), (r) => r.valor);
    const sobra = renda - soma(contasDoMes(estado.mes), (c) => c.valorMes) - soma(gastosDoMes(estado.mes), (g) => g.valor);
    $("#resumo-metas").innerHTML = !estado.metas.length ? "" : pessoa !== "todos" ? `
      <div class="hero hero-metas">
        <div class="rotulo">Guardado por ${esc(pessoa)}</div>
        <div class="grande">${fmt(total)}</div>
        <div class="duas">
          <div><small>Em ${esc(nomeMes(estado.mes, "mes"))}</small><b>${doMes < 0 ? "−" : ""}${fmt(Math.abs(doMes))}</b></div>
          <div><small>Do total do casal</small><b>${totalCasal > 0 ? Math.round((total / totalCasal) * 100) + "%" : "—"}</b></div>
        </div>
      </div>` : `
      <div class="hero hero-metas">
        <div class="rotulo">Total guardado nas metas</div>
        <div class="grande">${fmt(total)}</div>
        <div class="duas">
          <div><small>Guardado em ${esc(nomeMes(estado.mes, "mes"))}</small><b>${doMes < 0 ? "−" : ""}${fmt(Math.abs(doMes))}</b></div>
          <div><small>${renda ? "Do que sobrou no mês" : "Metas ativas"}</small><b>${renda ? (sobra > 0 ? Math.round((doMes / sobra) * 100) + "%" : "—") : ativas.length}</b></div>
        </div>
        ${renda && sobra > 0 ? `<div class="renda-linha"><span>Sobra do mês, depois de contas e gastos</span><span>${fmt(sobra)}</span></div>` : ""}
      </div>`;
    const metas = [...estado.metas].sort((a, b) => (b.ativa - a.ativa) || infoMeta(b).pct - infoMeta(a).pct);
    $("#lista-metas").innerHTML = metas.length ? metas.map((m) => {
      const i = infoMeta(m);
      return `
      <button class="card meta-card ${m.ativa ? "" : "inativa"} ${i.falta ? "" : "completa"}" data-abrir-meta="${m.id}">
        <div class="mc-topo">
          <span class="bola-cat">${svg(iconeMeta(m))}</span>
          <div class="mc-nome"><strong>${esc(m.nome)}</strong><small>${esc(m.onde || (m.prazo ? "Até " + nomeMes(m.prazo) : "Sem prazo"))}${m.ativa ? "" : " · arquivada"}</small></div>
          <span class="mc-pct">${Math.floor(i.pct)}%</span>
        </div>
        <div class="mc-valores"><b>${fmt(i.guardado)}</b><span>de ${fmt(i.alvo)}</span></div>
        <div class="meter-orc ${i.falta ? "ok" : "bom"}"><span style="width:${i.pct}%"></span></div>
        ${pessoa !== "todos" ? `<div class="mc-pessoa"><span class="mini-avatar">${esc(pessoa.charAt(0))}</span>${esc(pessoa)} guardou ${fmt(soma(estado.aportes.filter((a) => a.meta_id === m.id && a.responsavel === pessoa), (a) => a.valor))} nesta meta</div>` : ""}
        <div class="mc-plano ${i.alerta}">${i.falta ? `Faltam ${fmt(i.falta)} · ` : ""}${esc(i.plano)}${i.alerta === "warn" ? " · ritmo abaixo do necessário" : ""}</div>
      </button>`;
    }).join("") : `<article class="card card-lista"><ul class="lista-cadastro">${vazio("alvo", "Nenhuma meta ainda", "Reserva de emergência, viagem, casa própria… defina quanto e até quando, e o app calcula quanto guardar por mês.", ["nova-meta", "Criar primeira meta"])}</ul></article>`;
  }

  let metaAberta = null;
  function abrirMetaDetalhe(id) {
    metaAberta = estado.metas.find((m) => m.id === id); if (!metaAberta) return;
    desenharMetaDetalhe();
    $("#modal-meta-detalhe").showModal();
  }
  function desenharMetaDetalhe() {
    const m = metaAberta, i = infoMeta(m);
    const R = 34, C = 2 * Math.PI * R;
    const hist = estado.aportes.filter((a) => a.meta_id === m.id && daPessoa(a)).sort((a, b) => b.data.localeCompare(a.data));
    $("#meta-detalhe").innerHTML = `
      <div class="md-topo">
        <div class="rosca rosca-meta" role="img" aria-label="${Math.floor(i.pct)}% da meta">
          <svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="${R}" class="trilho-r"/><circle cx="40" cy="40" r="${R}" class="arco-r" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - i.pct / 100)}"/></svg>
          <span>${Math.floor(i.pct)}%</span>
        </div>
        <div><h2>${esc(m.nome)}</h2><small class="muted">${esc(m.onde || "")}${m.onde && m.prazo ? " · " : ""}${m.prazo ? "até " + esc(nomeMes(m.prazo)) : ""}</small>
          <div class="md-valor">${fmt(i.guardado)} <span>de ${fmt(i.alvo)}</span></div></div>
      </div>
      <div class="md-plano ${i.alerta}">${i.falta ? `Faltam ${fmt(i.falta)} · ` : ""}${esc(i.plano)}</div>
      <h3 class="md-h">Histórico${pessoa !== "todos" ? ` de ${esc(pessoa)}` : ""}</h3>
      <ul class="lista-cadastro">${hist.length ? hist.map((a) => `
        <li class="swipe" data-swipe="aporte" data-id="${a.id}">${ACAO_EXCLUIR()}<button class="item" data-editar-aporte="${a.id}">
          <span class="bola-cat ${a.valor < 0 ? "retirada" : ""}">${svg(a.valor < 0 ? "sacola" : "porquinho")}</span>
          <div><div class="nome">${a.valor < 0 ? "Retirada" : "Guardou"}${a.observacao ? " · " + esc(a.observacao) : ""}</div><div class="meta">${esc(fmtData(a.data, { day: "numeric", month: "short", year: "numeric" }))} · ${esc(a.responsavel)}</div></div>
          <span class="valor ${a.valor < 0 ? "crit" : "bom-txt"}">${a.valor < 0 ? "−" : "+"}${fmt(Math.abs(a.valor))}</span><span class="seta">›</span>
        </button></li>`).join("") : vazio("porquinho", "Nenhum aporte ainda", "Toque em Guardar para registrar o primeiro.")}</ul>`;
  }

  // ================================================================
  // AÇÕES
  // ================================================================
  async function alternarPagamento(contaId) {
    const conta = estado.contas.find((c) => c.id === contaId);
    const pg = pagamentoDe(contaId, estado.mes);
    try {
      if (pg) {
        await db.remover("pagamentos", pg.id);
        estado.pagamentos = estado.pagamentos.filter((p) => p.id !== pg.id);
        render();
        toast(`${conta.nome}: pagamento desmarcado`, { rotulo: "Desfazer", acao: () => restaurarPagamento(pg) });
      } else if (conta.variavel) {
        abrirPagar(conta);
      } else {
        await registrarPagamento(conta, Number(conta.valor), hojeISO());
      }
    } catch (e) { erro(e); }
  }

  async function registrarPagamento(conta, valor, pagoEm) {
    const novo = await db.inserir("pagamentos", {
      conta_id: conta.id, competencia: estado.mes, valor_pago: valor,
      pago_em: pagoEm, pago_por: estado.usuario.nome.replace(" (demo)", "")
    });
    estado.pagamentos.push(novo);
    render();
    animarPago(conta.id);
    toast(`${conta.nome} paga · ${fmt(valor)}`, { rotulo: "Desfazer", acao: () => removerPagamento(novo) });
  }

  let pagandoConta = null;
  function abrirPagar(conta) {
    pagandoConta = conta;
    const f = $("#form-pagar");
    const prev = previsaoVariavel(conta, estado.mes);
    $("#titulo-modal-pagar").textContent = `Quanto veio ${conta.nome}?`;
    const ult = estado.pagamentos.filter((p) => p.conta_id === conta.id && p.competencia < estado.mes).sort((a, b) => b.competencia.localeCompare(a.competencia))[0];
    $("#dica-pagar").textContent = ult ? `Mês passado: ${brl.format(ult.valor_pago)} · média recente: ${brl.format(prev)}` : `Valor cadastrado: ${brl.format(conta.valor)}`;
    f.elements.valor.value = paraCampo(prev);
    f.elements.pago_em.value = hojeISO();
    $("#modal-pagar").showModal();
    setTimeout(() => { f.elements.valor.focus(); f.elements.valor.select(); }, 250);
  }

  async function confirmarPagar(ev) {
    ev.preventDefault();
    const f = ev.target.elements;
    const valor = parseValor(f.valor.value);
    if (Number.isNaN(valor)) return toast("Valor inválido");
    try { $("#modal-pagar").close(); await registrarPagamento(pagandoConta, valor, f.pago_em.value); } catch (e) { erro(e); }
  }

  async function removerPagamento(pg) {
    try {
      await db.remover("pagamentos", pg.id);
      estado.pagamentos = estado.pagamentos.filter((p) => p.id !== pg.id);
      render(); toast("Desfeito");
    } catch (e) { erro(e); }
  }

  async function restaurarPagamento(pg) {
    try {
      const { conta_id, competencia, valor_pago, pago_em, pago_por } = pg;
      estado.pagamentos.push(await db.inserir("pagamentos", { conta_id, competencia, valor_pago, pago_em, pago_por }));
      render(); toast("Desfeito");
    } catch (e) { erro(e); }
  }

  function animarPago(contaId) {
    $$(`[data-pagar="${contaId}"]`).forEach((b) => { b.classList.add("pop"); b.closest("li")?.classList.add("brilho"); });
    if (navigator.vibrate) try { navigator.vibrate(12); } catch {}
  }

  // ----- Modal conta -----
  let editandoConta = null;
  const FORMAS_CONTA = ["Pix", "Boleto", "Débito automático", "Dinheiro", "Cartão de crédito"];
  function abrirConta(id, prefill = {}) {
    const f = $("#form-conta");
    f.reset();
    f.querySelector(".mais-opcoes").open = false;
    editandoConta = id ? estado.contas.find((c) => c.id === id) : null;
    $("#titulo-modal-conta").textContent = editandoConta ? "Editar conta" : "Nova conta";
    $("#explica-conta").hidden = !!editandoConta || !estado.migracao2;
    const c = editandoConta || { ativa: true, responsavel: RESP_PADRAO(), inicio: estado.mes, ...prefill };
    f.elements.nome.value = c.nome || "";
    f.elements.dia_vencimento.value = c.dia_vencimento || "";
    f.elements.observacao.value = c.observacao || "";
    f.elements.valor.value = paraCampo(c.valor);
    if (c.responsavel && !RESPONSAVEIS.includes(c.responsavel)) $("#sel-responsavel-conta").insertAdjacentHTML("beforeend", `<option>${esc(c.responsavel)}</option>`);
    f.elements.responsavel.value = c.responsavel || RESP_PADRAO();
    f.elements.inicio.value = (c.inicio || estado.mes).slice(0, 7);
    f.elements.ativa.checked = c.ativa !== false;
    // valor muda?
    definirTipoConta(editandoConta ? (c.fim ? "unico" : c.variavel ? "variavel" : "fixo") : prefill.tipo || "");
    $('#tipos-conta [data-t="variavel"]').hidden = !estado.migracao2;
    // categoria
    const cats = [...new Set([...(CFG.CATEGORIAS || []), ...estado.contas.map((x) => x.categoria)].filter(Boolean))];
    if (c.categoria && !cats.includes(c.categoria)) cats.push(c.categoria);
    $("#sel-cat-conta").innerHTML = `<option value="" disabled ${c.categoria ? "" : "selected"}>Escolha…</option>` + cats.map((x) => `<option>${esc(x)}</option>`).join("") + `<option value="__outra">+ Outra categoria…</option>`;
    $("#sel-cat-conta").value = c.categoria || "";
    $("#lbl-cat-outra").hidden = true;
    f.elements.categoria_outra.required = false;
    // como paga (inclui os cartões)
    const cartoes = estado.migracao3 ? estado.cartoes.filter((x) => x.ativo || x.id === c.cartao_id) : [];
    const formas = FORMAS_CONTA.filter((x) => !(cartoes.length && x === "Cartão de crédito"));
    if (c.forma_pagamento && !c.cartao_id && !formas.includes(c.forma_pagamento)) formas.push(c.forma_pagamento);
    $("#sel-forma-conta").innerHTML = `<option value="">Não sei / tanto faz</option>` + formas.map((x) => `<option>${esc(x)}</option>`).join("") +
      (cartoes.length ? `<optgroup label="Cartão de crédito">${cartoes.map((x) => `<option value="cartao:${x.id}">💳 ${esc(x.nome)}</option>`).join("")}</optgroup>` : "");
    $("#sel-forma-conta").value = c.cartao_id ? "cartao:" + c.cartao_id : c.forma_pagamento || "";
    caixaEncerrar(f, {
      editando: !!editandoConta, ativo: c.ativa !== false, campo: "ativa", excluir: "#btn-excluir-conta",
      pergunta: "Parou de pagar esta conta? (ex.: cancelou a assinatura)", encerrar: "Encerrar conta",
      encerrada: "Esta conta está encerrada: não aparece mais nos meses seguintes. O histórico fica guardado.", reativar: "Voltar a cobrar",
      erro: "Cadastrou errado?"
    });
    $("#modal-conta").showModal();
  }

  const DICAS_TIPO = {
    fixo: "Aparece todo mês com o mesmo valor, até vocês encerrarem a conta.",
    variavel: "Aparece todo mês. Ao marcar como paga, o app pergunta quanto veio. Nos meses seguintes fica “a definir” e não entra no total até ser paga.",
    unico: "Aparece só no mês que está aberto no app e não se repete."
  };
  function definirTipoConta(t) {
    const f = $("#form-conta");
    f.elements.tipo.value = t;
    f.elements.variavel.checked = t === "variavel";
    $$("#tipos-conta [data-t]").forEach((x) => { x.classList.toggle("ativo", x.dataset.t === t); x.setAttribute("aria-checked", x.dataset.t === t); });
    $("#tipos-conta").classList.remove("erro");
    let dica = DICAS_TIPO[t] || "";
    if (t === "unico") dica = `Aparece só em ${nomeMes((f.elements.inicio.value || estado.mes.slice(0, 7)) + "-01")} e não se repete.` + (estado.migracao4 ? "" : " ⚠ Para usar, rode supabase/migracao-04-conta-unica.sql no Supabase.");
    $("#dica-tipo").textContent = dica;
    $("#dica-tipo").hidden = !dica;
  }

  async function salvarConta(ev) {
    ev.preventDefault();
    const f = ev.target.elements;
    const tipo = f.tipo.value;
    if (!tipo) {
      const tc = $("#tipos-conta"); tc.classList.remove("erro"); void tc.offsetWidth; tc.classList.add("erro");
      tc.scrollIntoView({ block: "center", behavior: "smooth" });
      return toast("Escolha como é essa conta");
    }
    if (tipo === "unico" && !estado.migracao4) return toast("Para “Só neste mês”, rode a migração 04 no Supabase");
    const catSel = f.categoria_sel.value;
    const categoria = catSel === "__outra" ? f.categoria_outra.value.trim() : catSel;
    if (!categoria) return toast("Escolha uma categoria");
    const forma = f.forma.value;
    const cartao = forma.startsWith("cartao:") ? estado.cartoes.find((x) => x.id === forma.slice(7)) : null;
    const dados = {
      nome: f.nome.value.trim(), valor: parseValor(f.valor.value), dia_vencimento: Number(f.dia_vencimento.value),
      categoria, responsavel: f.responsavel.value,
      forma_pagamento: cartao ? "Cartão " + cartao.nome : forma || null, observacao: f.observacao.value.trim() || null,
      inicio: (f.inicio.value || estado.mes.slice(0, 7)) + "-01", ativa: f.ativa.checked
    };
    if (estado.migracao2) dados.variavel = tipo === "variavel";
    if (estado.migracao4) dados.fim = tipo === "unico" ? dados.inicio : null;
    if (estado.migracao3) dados.cartao_id = cartao ? cartao.id : null;
    if (Number.isNaN(dados.valor)) return toast("Valor inválido");
    try {
      const eraAtiva = editandoConta ? editandoConta.ativa : true;
      if (editandoConta) Object.assign(editandoConta, await db.atualizar("contas", editandoConta.id, dados));
      else estado.contas.push(await db.inserir("contas", dados));
      $("#modal-conta").close();
      toast(eraAtiva && !dados.ativa ? "Conta encerrada" : !eraAtiva && dados.ativa ? "Conta reativada" : "Conta salva");
      render();
      if ($("#modal-fatura").open) desenharFatura();
    } catch (e) { erro(e); }
  }

  /** Caixa no fim do formulário: "Parou de pagar? [Encerrar]" e "Cadastrou errado? [Excluir]" (só ao editar). */
  function caixaEncerrar(form, o) {
    const box = form.querySelector("[data-encerrar]");
    const btnExcluir = $(o.excluir);
    btnExcluir.hidden = !o.editando;
    box.hidden = !o.editando;
    if (!o.editando) { form.appendChild(btnExcluir); return; }
    box.innerHTML = `
      <div class="be-linha"><span>${esc(o.ativo ? o.pergunta : o.encerrada)}</span>
        <button type="button" class="btn ${o.ativo ? "btn-ghost" : "btn-primary"}" data-alternar-ativo>${esc(o.ativo ? o.encerrar : o.reativar)}</button></div>
      <div class="be-linha"><span>${esc(o.erro)}</span><span data-slot-excluir></span></div>`;
    box.querySelector("[data-slot-excluir]").appendChild(btnExcluir);
    btnExcluir.textContent = "Excluir de vez";
    box.querySelector("[data-alternar-ativo]").onclick = () => {
      form.elements[o.campo].checked = !o.ativo;
      form.requestSubmit();
    };
  }

  async function excluirConta() {
    if (!editandoConta) return;
    if (!confirm(`Excluir “${editandoConta.nome}” e todo o histórico de pagamentos dela?\n\nSe você só parou de pagar, use “Encerrar conta”: ela some dos próximos meses e o histórico fica guardado.`)) return;
    try {
      await db.remover("contas", editandoConta.id);
      estado.contas = estado.contas.filter((c) => c.id !== editandoConta.id);
      estado.pagamentos = estado.pagamentos.filter((p) => p.conta_id !== editandoConta.id);
      if (DEMO) { demoDB().pagamentos = demoDB().pagamentos.filter((p) => p.conta_id !== editandoConta.id); demoStore.gravar(demoDB()); }
      $("#modal-conta").close();
      toast("Conta excluída");
      render();
    } catch (e) { erro(e); }
  }

  // ----- Modal renda -----
  let editandoRenda = null;
  function abrirRenda(id) {
    const f = $("#form-renda");
    f.reset();
    editandoRenda = id ? estado.rendas.find((r) => r.id === id) : null;
    $("#titulo-modal-renda").textContent = editandoRenda ? "Editar renda" : "Nova renda";

    const r = editandoRenda || { ativa: true, responsavel: PESSOAS[0] };
    f.elements.descricao.value = r.descricao || "";
    f.elements.valor.value = paraCampo(r.valor);
    f.elements.responsavel.value = r.responsavel;
    f.elements.ativa.checked = r.ativa !== false;
    caixaEncerrar(f, { editando: !!editandoRenda, ativo: r.ativa !== false, campo: "ativa", excluir: "#btn-excluir-renda",
      pergunta: "Parou de receber essa renda?", encerrar: "Encerrar renda",
      encerrada: "Esta renda está encerrada e não entra nas contas do mês.", reativar: "Voltar a contar", erro: "Cadastrou errado?" });
    $("#modal-renda").showModal();
  }

  async function salvarRenda(ev) {
    ev.preventDefault();
    const f = ev.target.elements;
    const dados = { descricao: f.descricao.value.trim(), valor: parseValor(f.valor.value), responsavel: f.responsavel.value, ativa: f.ativa.checked };
    if (Number.isNaN(dados.valor)) return toast("Valor inválido");
    try {
      if (editandoRenda) Object.assign(editandoRenda, await db.atualizar("rendas", editandoRenda.id, dados));
      else estado.rendas.push(await db.inserir("rendas", dados));
      $("#modal-renda").close();
      toast("Renda salva");
      render();
    } catch (e) { erro(e); }
  }

  async function excluirRenda() {
    if (!editandoRenda || !confirm(`Excluir a renda “${editandoRenda.descricao}”?`)) return;
    try {
      await db.remover("rendas", editandoRenda.id);
      estado.rendas = estado.rendas.filter((r) => r.id !== editandoRenda.id);
      $("#modal-renda").close();
      render();
    } catch (e) { erro(e); }
  }

  // ----- Modal gasto -----
  let editandoGasto = null;
  function chipsCategorias(atual) {
    const cats = estado.orcamentos.filter((o) => o.ativa).map((o) => o.categoria);
    if (atual && !cats.includes(atual)) cats.push(atual);
    if (!cats.includes("Outros")) cats.push("Outros");
    $("#chips-cat").innerHTML = cats.map((c) => `<button type="button" class="chip-cat ${c === atual ? "ativo" : ""}" data-cat="${esc(c)}">${svg(iconeDe(c))}<span>${esc(c)}</span></button>`).join("");
  }
  function abrirGasto(id, prefill = {}) {
    if (!estado.migracao2) { irPara("gastos"); return toast("Rode a migração 02 no Supabase primeiro"); }
    const f = $("#form-gasto");
    f.reset();
    editandoGasto = id ? estado.gastos.find((g) => g.id === id) : null;
    $("#titulo-modal-gasto").textContent = editandoGasto ? "Editar gasto" : "Novo gasto";
    $("#btn-excluir-gasto").hidden = !editandoGasto;
    $("#explica-gasto").hidden = !!editandoGasto;
    const g = editandoGasto || { data: estado.mes === compDe(new Date()) ? hojeISO() : estado.mes.slice(0, 8) + "01", responsavel: estado.usuario.nome.replace(" (demo)", ""), categoria: filtroCatGasto || "", ...prefill };
    f.elements.valor.value = paraCampo(g.valor);
    f.elements.descricao.value = g.descricao || "";
    f.elements.data.value = g.data;
    f.elements.responsavel.value = RESPONSAVEIS.includes(g.responsavel) ? g.responsavel : PESSOAS[0];
    preencherFormas(g);
    f.elements.categoria.value = g.categoria || "";
    chipsCategorias(g.categoria);
    $("#modal-gasto").showModal();
    if (!editandoGasto) setTimeout(() => f.elements.valor.focus(), 250);
  }

  const FORMAS = ["Pix", "Débito", "Dinheiro", "Boleto", "Cartão de crédito"];
  function preencherFormas(g) {
    const cartoes = estado.migracao3 ? estado.cartoes.filter((c) => c.ativo || c.id === g.cartao_id) : [];
    const formas = FORMAS.filter((x) => !(cartoes.length && x === "Cartão de crédito"));
    if (g.forma_pagamento && !g.cartao_id && !formas.includes(g.forma_pagamento)) formas.push(g.forma_pagamento);
    $("#sel-forma-gasto").innerHTML = `<option value="">—</option>` + formas.map((x) => `<option>${esc(x)}</option>`).join("") +
      (cartoes.length ? `<optgroup label="Cartão de crédito">${cartoes.map((c) => `<option value="cartao:${c.id}">💳 ${esc(c.nome)}</option>`).join("")}</optgroup>` : "");
    $("#sel-forma-gasto").value = g.cartao_id ? "cartao:" + g.cartao_id : g.forma_pagamento || "";
    $("#sel-parcelas").innerHTML = Array.from({ length: 24 }, (_, i) => `<option value="${i + 1}">${i ? i + 1 + "x" : "À vista"}</option>`).join("");
    $("#sel-parcelas").value = String(g.parcelas || 1);
    $("#lbl-parcelas").hidden = !String($("#sel-forma-gasto").value).startsWith("cartao:");
  }

  async function salvarGasto(ev) {
    ev.preventDefault();
    const f = ev.target.elements;
    const forma = f.forma.value;
    const cartao = forma.startsWith("cartao:") ? estado.cartoes.find((c) => c.id === forma.slice(7)) : null;
    const dados = {
      valor: parseValor(f.valor.value), descricao: f.descricao.value.trim(), categoria: f.categoria.value,
      data: f.data.value, responsavel: f.responsavel.value, forma_pagamento: cartao ? "Cartão " + cartao.nome : forma || null
    };
    if (estado.migracao3) { dados.cartao_id = cartao ? cartao.id : null; dados.parcelas = cartao ? Number(f.parcelas.value) || 1 : 1; }
    if (Number.isNaN(dados.valor) || !dados.valor) return toast("Informe o valor");
    if (!dados.categoria) {
      const ch = $("#chips-cat"); ch.classList.remove("erro"); void ch.offsetWidth; ch.classList.add("erro");
      ch.scrollIntoView({ block: "center", behavior: "smooth" });
      return toast("Escolha uma categoria (toque numa das opções)");
    }
    try {
      if (editandoGasto) Object.assign(editandoGasto, await db.atualizar("gastos", editandoGasto.id, dados));
      else estado.gastos.push(await db.inserir("gastos", dados));
      $("#modal-gasto").close();
      render();
      const l = linhasOrcamento().find((x) => x.categoria === dados.categoria);
      if (l && l.limite && l.gasto > l.limite) toast(`⚠ ${dados.categoria} passou do limite em ${fmt(l.gasto - l.limite)}`);
      else if (l && l.limite && l.gasto >= l.limite * 0.8) toast(`${dados.categoria}: restam ${fmt(l.limite - l.gasto)} no mês`);
      else toast(dados.parcelas > 1 ? `Gasto salvo · ${dados.parcelas}x de ${fmt(dados.valor / dados.parcelas)}` : "Gasto salvo");
      if ($("#modal-fatura").open) desenharFatura();
    } catch (e) { erro(e); }
  }

  async function excluirGasto() {
    if (!editandoGasto || !confirm(`Excluir o gasto “${editandoGasto.descricao}”?`)) return;
    $("#modal-gasto").close();
    await apagarGasto(editandoGasto);
  }
  async function apagarGasto(g) {
    try {
      await db.remover("gastos", g.id);
      estado.gastos = estado.gastos.filter((x) => x.id !== g.id);
      render();
      toast("Gasto excluído", { rotulo: "Desfazer", acao: async () => {
        const { id, created_at, created_by, ...resto } = g;
        estado.gastos.push(await db.inserir("gastos", resto)); render();
      } });
    } catch (e) { erro(e); }
  }

  // ----- Modal orçamento -----
  let editandoOrc = null;
  function abrirOrcamento(id) {
    if (!estado.migracao2) return toast("Rode a migração 02 no Supabase primeiro");
    const f = $("#form-orcamento");
    f.reset();
    editandoOrc = id ? estado.orcamentos.find((o) => o.id === id) : null;
    $("#titulo-modal-orcamento").textContent = editandoOrc ? "Editar categoria" : "Nova categoria de gasto";

    const o = editandoOrc || { ativa: true };
    f.elements.categoria.value = o.categoria || "";
    f.elements.limite.value = paraCampo(o.limite);
    f.elements.ativa.checked = o.ativa !== false;
    caixaEncerrar(f, { editando: !!editandoOrc, ativo: o.ativa !== false, campo: "ativa", excluir: "#btn-excluir-orcamento",
      pergunta: "Não quer mais acompanhar essa categoria?", encerrar: "Arquivar",
      encerrada: "Categoria arquivada: não aparece no orçamento.", reativar: "Reativar", erro: "Cadastrou errado?" });
    $("#modal-orcamento").showModal();
  }

  async function salvarOrcamento(ev) {
    ev.preventDefault();
    const f = ev.target.elements;
    const dados = { categoria: f.categoria.value.trim(), limite: parseValor(f.limite.value), ativa: f.ativa.checked };
    if (Number.isNaN(dados.limite)) return toast("Limite inválido");
    if (estado.orcamentos.some((o) => o.categoria.toLowerCase() === dados.categoria.toLowerCase() && o !== editandoOrc)) return toast("Essa categoria já existe");
    try {
      const antigo = editandoOrc?.categoria;
      if (editandoOrc) Object.assign(editandoOrc, await db.atualizar("orcamentos", editandoOrc.id, dados));
      else estado.orcamentos.push(await db.inserir("orcamentos", dados));
      // renomeou a categoria: leva os gastos junto
      if (antigo && antigo !== dados.categoria) {
        for (const g of estado.gastos.filter((x) => x.categoria === antigo)) Object.assign(g, await db.atualizar("gastos", g.id, { categoria: dados.categoria }));
      }
      $("#modal-orcamento").close();
      toast("Categoria salva");
      render();
    } catch (e) { erro(e); }
  }

  async function excluirOrcamento() {
    if (!editandoOrc || !confirm(`Excluir a categoria “${editandoOrc.categoria}”?\n\nOs gastos já lançados continuam, só sem limite.`)) return;
    try {
      await db.remover("orcamentos", editandoOrc.id);
      estado.orcamentos = estado.orcamentos.filter((o) => o.id !== editandoOrc.id);
      $("#modal-orcamento").close();
      render();
    } catch (e) { erro(e); }
  }

  // ----- Modal meta -----
  let editandoMeta = null;
  function abrirMeta(id) {
    if (!estado.migracao3) { irPara("metas"); return toast("Rode a migração 03 no Supabase primeiro"); }
    const f = $("#form-meta"); f.reset();
    editandoMeta = id ? estado.metas.find((m) => m.id === id) : null;
    $("#titulo-modal-meta").textContent = editandoMeta ? "Editar meta" : "Nova meta";

    const m = editandoMeta || { ativa: true };
    f.elements.nome.value = m.nome || "";
    f.elements.valor_alvo.value = paraCampo(m.valor_alvo);
    f.elements.prazo.value = m.prazo ? m.prazo.slice(0, 7) : "";
    f.elements.onde.value = m.onde || "";
    f.elements.ativa.checked = m.ativa !== false;
    caixaEncerrar(f, { editando: !!editandoMeta, ativo: m.ativa !== false, campo: "ativa", excluir: "#btn-excluir-meta",
      pergunta: "Pausou ou desistiu desta meta?", encerrar: "Arquivar meta",
      encerrada: "Meta arquivada: o que foi guardado continua contando.", reativar: "Reativar", erro: "Cadastrou errado?" });
    $("#modal-meta").showModal();
  }
  async function salvarMeta(ev) {
    ev.preventDefault();
    const f = ev.target.elements;
    const dados = { nome: f.nome.value.trim(), valor_alvo: parseValor(f.valor_alvo.value), prazo: f.prazo.value ? f.prazo.value + "-01" : null, onde: f.onde.value.trim() || null, ativa: f.ativa.checked };
    if (Number.isNaN(dados.valor_alvo) || !dados.valor_alvo) return toast("Informe quanto querem juntar");
    try {
      if (editandoMeta) Object.assign(editandoMeta, await db.atualizar("metas", editandoMeta.id, dados));
      else estado.metas.push(await db.inserir("metas", dados));
      $("#modal-meta").close();
      toast("Meta salva"); render();
      if (metaAberta && $("#modal-meta-detalhe").open) desenharMetaDetalhe();
    } catch (e) { erro(e); }
  }
  async function excluirMeta() {
    if (!editandoMeta || !confirm(`Excluir a meta “${editandoMeta.nome}” e todo o histórico de aportes dela?`)) return;
    try {
      await db.remover("metas", editandoMeta.id);
      estado.metas = estado.metas.filter((m) => m.id !== editandoMeta.id);
      estado.aportes = estado.aportes.filter((a) => a.meta_id !== editandoMeta.id);
      if (DEMO) { demoDB().aportes = demoDB().aportes.filter((a) => a.meta_id !== editandoMeta.id); demoStore.gravar(demoDB()); }
      $("#modal-meta").close(); $("#modal-meta-detalhe").close();
      toast("Meta excluída"); render();
    } catch (e) { erro(e); }
  }

  // ----- Modal aporte -----
  let editandoAporte = null, tipoAporte = "guardar";
  function definirTipoAporte(t) {
    tipoAporte = t;
    $$("#seg-tipo-aporte button").forEach((x) => x.classList.toggle("ativo", x.dataset.t === t));
    $("#titulo-modal-aporte").textContent = (editandoAporte ? "Editar " : "") + (t === "retirar" ? "retirada" : editandoAporte ? "aporte" : "Guardar dinheiro");
  }
  function abrirAporte(opcoes = {}) {
    if (!estado.migracao3) { irPara("metas"); return toast("Rode a migração 03 no Supabase primeiro"); }
    const ativas = estado.metas.filter((m) => m.ativa);
    if (!opcoes.id && !ativas.length) { toast("Crie uma meta primeiro"); return abrirMeta(); }
    const f = $("#form-aporte"); f.reset();
    editandoAporte = opcoes.id ? estado.aportes.find((a) => a.id === opcoes.id) : null;
    $("#btn-excluir-aporte").hidden = !editandoAporte;
    const a = editandoAporte || { data: hojeISO(), responsavel: estado.usuario.nome.replace(" (demo)", ""), meta_id: opcoes.metaId || (ativas.length === 1 ? ativas[0].id : "") };
    f.elements.valor.value = a.valor ? paraCampo(Math.abs(a.valor)) : "";
    f.elements.data.value = a.data;
    f.elements.responsavel.value = RESPONSAVEIS.includes(a.responsavel) ? a.responsavel : PESSOAS[0];
    f.elements.observacao.value = a.observacao || "";
    f.elements.meta_id.value = a.meta_id || "";
    const metasChips = [...ativas]; if (a.meta_id && !metasChips.some((m) => m.id === a.meta_id)) { const x = estado.metas.find((m) => m.id === a.meta_id); if (x) metasChips.push(x); }
    $("#chips-meta").innerHTML = metasChips.map((m) => `<button type="button" class="chip-cat ${m.id === a.meta_id ? "ativo" : ""}" data-meta="${m.id}">${svg(iconeMeta(m))}<span>${esc(m.nome)}</span></button>`).join("");
    definirTipoAporte(opcoes.tipo || (a.valor < 0 ? "retirar" : "guardar"));
    $("#modal-aporte").showModal();
    if (!editandoAporte) setTimeout(() => f.elements.valor.focus(), 250);
  }
  async function salvarAporte(ev) {
    ev.preventDefault();
    const f = ev.target.elements;
    const v = parseValor(f.valor.value);
    if (Number.isNaN(v) || !v) return toast("Informe o valor");
    if (!f.meta_id.value) return toast("Escolha a meta");
    const dados = { meta_id: f.meta_id.value, valor: tipoAporte === "retirar" ? -v : v, data: f.data.value, responsavel: f.responsavel.value, observacao: f.observacao.value.trim() || null };
    try {
      if (editandoAporte) Object.assign(editandoAporte, await db.atualizar("aportes", editandoAporte.id, dados));
      else estado.aportes.push(await db.inserir("aportes", dados));
      $("#modal-aporte").close();
      render();
      if ($("#modal-meta-detalhe").open) desenharMetaDetalhe();
      const meta = estado.metas.find((m) => m.id === dados.meta_id);
      const i = meta && infoMeta(meta);
      toast(i && !i.falta ? `🎉 ${meta.nome}: meta alcançada!` : tipoAporte === "retirar" ? "Retirada registrada" : `Guardado! ${meta ? meta.nome + " em " + Math.floor(i.pct) + "%" : ""}`);
    } catch (e) { erro(e); }
  }
  async function excluirAporte() {
    if (!editandoAporte || !confirm("Excluir este lançamento?")) return;
    try {
      await db.remover("aportes", editandoAporte.id);
      estado.aportes = estado.aportes.filter((a) => a.id !== editandoAporte.id);
      $("#modal-aporte").close(); render();
      if ($("#modal-meta-detalhe").open) desenharMetaDetalhe();
    } catch (e) { erro(e); }
  }

  // ----- Modal cartão -----
  let editandoCartao = null;
  function abrirCartao(id) {
    if (!estado.migracao3) return toast("Rode a migração 03 no Supabase primeiro");
    const f = $("#form-cartao"); f.reset();
    editandoCartao = id ? estado.cartoes.find((c) => c.id === id) : null;
    $("#titulo-modal-cartao").textContent = editandoCartao ? "Editar cartão" : "Novo cartão";

    const c = editandoCartao || { ativo: true, responsavel: RESP_PADRAO() };
    f.elements.nome.value = c.nome || "";
    f.elements.dia_fechamento.value = c.dia_fechamento || "";
    f.elements.dia_vencimento.value = c.dia_vencimento || "";
    f.elements.limite.value = paraCampo(c.limite);
    f.elements.responsavel.value = c.responsavel;
    f.elements.ativo.checked = c.ativo !== false;
    caixaEncerrar(f, { editando: !!editandoCartao, ativo: c.ativo !== false, campo: "ativo", excluir: "#btn-excluir-cartao",
      pergunta: "Cancelou este cartão?", encerrar: "Arquivar cartão",
      encerrada: "Cartão arquivado: não aparece para novas compras.", reativar: "Reativar", erro: "Cadastrou errado?" });
    $("#modal-cartao").showModal();
  }
  async function salvarCartao(ev) {
    ev.preventDefault();
    const f = ev.target.elements;
    const lim = f.limite.value.trim() ? parseValor(f.limite.value) : null;
    if (Number.isNaN(lim)) return toast("Limite inválido");
    const dados = { nome: f.nome.value.trim(), dia_fechamento: Number(f.dia_fechamento.value), dia_vencimento: Number(f.dia_vencimento.value), limite: lim, responsavel: f.responsavel.value, ativo: f.ativo.checked };
    try {
      if (editandoCartao) Object.assign(editandoCartao, await db.atualizar("cartoes", editandoCartao.id, dados));
      else estado.cartoes.push(await db.inserir("cartoes", dados));
      $("#modal-cartao").close(); toast("Cartão salvo"); render();
    } catch (e) { erro(e); }
  }
  async function excluirCartao() {
    if (!editandoCartao || !confirm(`Excluir o cartão “${editandoCartao.nome}”?\n\nOs gastos lançados nele continuam, mas deixam de aparecer na fatura. Para manter o histórico, use “Arquivar cartão”.`)) return;
    try {
      const id = editandoCartao.id;
      await db.remover("cartoes", id);
      estado.cartoes = estado.cartoes.filter((c) => c.id !== id);
      estado.gastos.forEach((g) => { if (g.cartao_id === id) g.cartao_id = null; });
      estado.contas.forEach((c) => { if (c.cartao_id === id) c.cartao_id = null; });
      if (DEMO) { demoDB().gastos.forEach((g) => { if (g.cartao_id === id) g.cartao_id = null; }); demoDB().contas.forEach((c) => { if (c.cartao_id === id) c.cartao_id = null; }); demoStore.gravar(demoDB()); }
      $("#modal-cartao").close(); render();
    } catch (e) { erro(e); }
  }

  // ----- Exportar -----
  function exportarCSV() {
    const linhas = [["conta", "categoria", "responsavel", "dia_vencimento", "valor_cadastrado", "competencia", "valor_pago", "pago_em", "pago_por"]];
    estado.contas.forEach((c) => {
      const pgs = estado.pagamentos.filter((p) => p.conta_id === c.id);
      if (!pgs.length) linhas.push([c.nome, c.categoria, c.responsavel, c.dia_vencimento, c.valor, "", "", "", ""]);
      pgs.sort((a, b) => a.competencia.localeCompare(b.competencia))
        .forEach((p) => linhas.push([c.nome, c.categoria, c.responsavel, c.dia_vencimento, c.valor, p.competencia.slice(0, 7), p.valor_pago, p.pago_em, p.pago_por || ""]));
    });
    const csv = "﻿" + linhas.map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `financas-casal-contas-${hojeISO()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    if (estado.gastos.length) {
      const lg = [["data", "descricao", "categoria", "quem_pagou", "forma_pagamento", "valor"],
        ...estado.gastos.slice().sort((x, y) => x.data.localeCompare(y.data)).map((g) => [g.data, g.descricao, g.categoria, g.responsavel, g.forma_pagamento || "", g.valor])];
      const csv2 = "\ufeff" + lg.map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
      const b = document.createElement("a");
      b.href = URL.createObjectURL(new Blob([csv2], { type: "text/csv;charset=utf-8" }));
      b.download = `financas-casal-gastos-${hojeISO()}.csv`;
      setTimeout(() => { b.click(); URL.revokeObjectURL(b.href); }, 400);
    }
  }

  // ================================================================
  // EVENTOS / UTILIDADES
  // ================================================================
  function preencherSelects() {
    const ops = (lista) => lista.map((p) => `<option>${esc(p)}</option>`).join("");
    $("#sel-responsavel-conta").innerHTML = ops(RESPONSAVEIS);
    $("#sel-responsavel-renda").innerHTML = ops(RESPONSAVEIS);
    $("#sel-responsavel-gasto").innerHTML = ops(RESPONSAVEIS);
    $("#sel-responsavel-aporte").innerHTML = ops(RESPONSAVEIS);
    $("#sel-responsavel-cartao").innerHTML = ops(RESPONSAVEIS);
    $("#lista-categorias").innerHTML = (CFG.CATEGORIAS || []).map((c) => `<option value="${esc(c)}"></option>`).join("");
  }

  let abaAtual = "inicio";
  let cadastroAtual = "contas";
  function irPara(aba) {
    abaAtual = aba;
    $$(".tabbar button").forEach((x) => x.setAttribute("aria-selected", x.dataset.aba === aba));
    $$(".aba").forEach((a) => (a.hidden = a.id !== "aba-" + aba));
    window.scrollTo({ top: 0 });
  }

  function segmento(seletor, attr, aoEscolher) {
    $(seletor).addEventListener("click", (ev) => {
      const b = ev.target.closest(`[data-${attr}]`); if (!b) return;
      $$(seletor + " button").forEach((x) => x.classList.toggle("ativo", x === b));
      aoEscolher(b.dataset[attr]);
    });
  }

  function ligarEventos() {
    let modoCadastro = false;
    const definirModo = (cad) => {
      modoCadastro = cad;
      $("#login-titulo").textContent = cad ? "Criar minha conta" : "Finanças do Casal";
      $("#login-sub").textContent = cad ? "Use o mesmo e-mail que recebeu o convite e escolha uma senha." : "Entre com o seu e-mail e senha.";
      $("#lbl-senha2").hidden = !cad; $("#form-login").elements.senha2.required = cad;
      $("#form-login").elements.senha.autocomplete = cad ? "new-password" : "current-password";
      $("#btn-login").textContent = cad ? "Criar conta" : "Entrar";
      $("#btn-esqueci").hidden = cad;
      $("#login-pergunta").textContent = cad ? "Já tem conta?" : "Recebeu um convite?";
      $("#btn-modo-cadastro").textContent = cad ? "Entrar" : "Criar minha conta";
      $("#login-erro").textContent = "";
    };
    $("#btn-modo-cadastro").addEventListener("click", () => definirModo(!modoCadastro));
    if (new URLSearchParams(location.search).get("convite") !== null) definirModo(true);
    $("#form-login").addEventListener("submit", travar(async (ev) => {
      const f = ev.target.elements;
      $("#login-erro").textContent = "";
      const email = f.email.value.trim();
      if (modoCadastro) {
        if (f.senha.value !== f.senha2.value) { $("#login-erro").textContent = "As senhas não são iguais."; return; }
        const { data, error } = await sb.auth.signUp({ email, password: f.senha.value, options: { emailRedirectTo: location.origin + location.pathname } });
        if (error) {
          const m = error.message || "";
          $("#login-erro").textContent = /already|registered|exists/i.test(m) ? "Já existe uma conta com este e-mail. Toque em “Entrar”."
            : /database|convite|saving/i.test(m) ? "Não encontramos convite para este e-mail. Confira com quem te convidou se o e-mail está certo."
            : /signup.*disabled|not allowed/i.test(m) ? "O cadastro está desligado no Supabase (Allow new users to sign up). Avise quem administra o app."
            : /password/i.test(m) ? "Senha fraca: use pelo menos 6 caracteres." : "Não foi possível criar a conta: " + m;
          return;
        }
        if (!data.session) {
          definirModo(false);
          $("#login-erro").textContent = "Conta criada! Enviamos um e-mail de confirmação: abra o link e depois entre aqui.";
          return;
        }
        await validarMembro();
        return;
      }
      const { error } = await sb.auth.signInWithPassword({ email, password: f.senha.value });
      if (error) { $("#login-erro").textContent = /confirm/i.test(error.message) ? "Confirme o seu e-mail primeiro (veja a caixa de entrada)." : "E-mail ou senha incorretos."; return; }
      await validarMembro();
    }));
    $("#btn-esqueci").addEventListener("click", async () => {
      const email = $("#form-login").elements.email.value.trim();
      if (!email) { $("#login-erro").textContent = "Digite seu e-mail acima primeiro."; return; }
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
      $("#login-erro").textContent = error ? error.message : "Se o e-mail existir, você receberá um link para criar nova senha.";
    });
    $("#btn-sair").addEventListener("click", () => (DEMO ? toast("No modo demonstração não há login.") : sb.auth.signOut()));

    $("#mes-anterior").addEventListener("click", () => { estado.mes = somaMes(estado.mes, -1); filtroCatGasto = null; render(); });
    $("#mes-proximo").addEventListener("click", () => { estado.mes = somaMes(estado.mes, 1); filtroCatGasto = null; render(); });

    $$(".tabbar button").forEach((b) => b.addEventListener("click", () => irPara(b.dataset.aba)));

    segmento("#filtro-status", "f", (f) => { estado.filtro = f; renderListaMes(contasDoMes(estado.mes)); });
    segmento("#seg-analise", "a", (a) => $$(".painel-analise").forEach((p) => (p.hidden = p.dataset.painel !== a)));
    segmento("#seg-cadastro", "c", (c) => { cadastroAtual = c; $$(".painel-cadastro").forEach((p) => (p.hidden = p.dataset.painel !== c)); });

    $("#btn-add-cadastro").addEventListener("click", () => (cadastroAtual === "rendas" ? abrirRenda() : cadastroAtual === "orcamentos" ? abrirOrcamento() : cadastroAtual === "cartoes" ? abrirCartao() : abrirConta()));
    segmento("#seg-gastos", "g", (g) => $$(".painel-gastos").forEach((p) => (p.hidden = p.dataset.painel !== g)));
    const mostrarExtrato = () => { $$("#seg-gastos button").forEach((x) => x.classList.toggle("ativo", x.dataset.g === "extrato")); $$(".painel-gastos").forEach((p) => (p.hidden = p.dataset.painel !== "extrato")); };
    $("#chips-cat").addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-cat]"); if (!b) return;
      $("#form-gasto").elements.categoria.value = b.dataset.cat;
      $("#chips-cat").classList.remove("erro");
      $$("#chips-cat .chip-cat").forEach((x) => x.classList.toggle("ativo", x === b));
    });
    document.addEventListener("click", (ev) => {
      const fc = ev.target.closest("[data-filtrar-cat]");
      if (fc) { filtroCatGasto = fc.dataset.filtrarCat; renderExtrato(gastosFiltrados()); mostrarExtrato(); window.scrollTo({ top: 0 }); }
      if (ev.target.closest("[data-limpar-filtro]")) { filtroCatGasto = null; renderExtrato(gastosFiltrados()); }
    });

    document.addEventListener("click", (ev) => {
      const t = ev.target.closest("[data-pagar],[data-editar-conta],[data-editar-renda],[data-editar-gasto],[data-editar-orcamento],[data-editar-cartao],[data-editar-aporte],[data-abrir-meta],[data-abrir-fatura],[data-fechar],[data-ir],[data-acao]");
      if (!t) return;
      if (t.dataset.pagar) alternarPagamento(t.dataset.pagar);
      else if (t.dataset.editarConta) abrirConta(t.dataset.editarConta);
      else if (t.dataset.editarRenda) abrirRenda(t.dataset.editarRenda);
      else if (t.dataset.editarGasto) abrirGasto(t.dataset.editarGasto);
      else if (t.dataset.editarOrcamento) abrirOrcamento(t.dataset.editarOrcamento);
      else if (t.dataset.editarCartao) abrirCartao(t.dataset.editarCartao);
      else if (t.dataset.editarAporte) abrirAporte({ id: t.dataset.editarAporte });
      else if (t.dataset.abrirMeta) abrirMetaDetalhe(t.dataset.abrirMeta);
      else if (t.dataset.abrirFatura) abrirFatura(t.dataset.abrirFatura);
      else if (t.dataset.acao === "novo-gasto") abrirGasto();
      else if (t.dataset.acao === "nova-meta") abrirMeta();
      else if (t.dataset.acao === "novo-aporte") abrirAporte();
      else if (t.dataset.acao === "novo-cartao") abrirCartao();
      else if (t.dataset.acao === "tutorial") abrirTutorial(0);
      else if (t.dataset.acao === "importar") abrirImportar();
      else if (t.dataset.acao === "trocar-para-gasto") {
        const f = $("#form-conta").elements;
        const pre = { descricao: f.nome.value.trim(), valor: parseValor(f.valor.value) || undefined };
        $("#modal-conta").close(); abrirGasto(null, pre);
      } else if (t.dataset.acao === "trocar-para-conta") {
        const f = $("#form-gasto").elements;
        const pre = { nome: f.descricao.value.trim(), valor: parseValor(f.valor.value) || undefined };
        $("#modal-gasto").close(); abrirConta(null, pre);
      }
      else if (t.dataset.acao === "novo-orcamento") abrirOrcamento();
      else if (t.dataset.ir) irPara(t.dataset.ir);
      else if (t.dataset.acao === "nova-conta") abrirConta();
      else if (t.dataset.acao === "nova-renda") abrirRenda();
      else if (t.hasAttribute("data-fechar")) t.closest("dialog").close();
    });

    // Filtro por pessoa
    document.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-pessoa]"); if (!b) return;
      pessoa = b.dataset.pessoa; gravarPref("pessoa", pessoa); filtroCatGasto = null;
      renderFiltroPessoa(); renderGastos(); renderMetas();
    });

    // Olho: esconder/mostrar valores
    document.addEventListener("click", (ev) => {
      if (!ev.target.closest("#btn-olho")) return;
      ocultar = !ocultar; gravarPref("ocultar", ocultar); totalAnterior = null; render();
    });

    // Arrastar o painel para baixo para fechar (celular)
    $$("dialog.sheet").forEach((d) => {
      let y0 = null, dy = 0;
      d.addEventListener("touchstart", (ev) => {
        if (d.scrollTop > 0 || ev.target.closest("input,select,textarea")) { y0 = null; return; }
        y0 = ev.touches[0].clientY; dy = 0; d.style.transition = "none";
      }, { passive: true });
      d.addEventListener("touchmove", (ev) => {
        if (y0 === null) return;
        dy = Math.max(0, ev.touches[0].clientY - y0);
        d.style.transform = `translateY(${dy}px)`;
      }, { passive: true });
      d.addEventListener("touchend", () => {
        if (y0 === null) return;
        d.style.transition = "transform .2s ease"; y0 = null;
        if (dy > 110) { d.style.transform = "translateY(100%)"; setTimeout(() => { d.close(); d.style.transform = ""; }, 180); }
        else d.style.transform = "";
      });
    });

    // Fechar o painel tocando fora dele
    $$("dialog").forEach((d) => d.addEventListener("click", (ev) => { if (ev.target === d) d.close(); }));

    $("#form-conta").addEventListener("submit", travar(salvarConta));
    $("#form-renda").addEventListener("submit", travar(salvarRenda));
    $("#form-gasto").addEventListener("submit", travar(salvarGasto));
    $("#form-orcamento").addEventListener("submit", travar(salvarOrcamento));
    $("#form-pagar").addEventListener("submit", travar(confirmarPagar));
    $("#btn-excluir-gasto").addEventListener("click", excluirGasto);
    $("#form-meta").addEventListener("submit", travar(salvarMeta));
    $("#form-aporte").addEventListener("submit", travar(salvarAporte));
    $("#form-cartao").addEventListener("submit", travar(salvarCartao));
    $("#btn-excluir-meta").addEventListener("click", excluirMeta);
    $("#btn-excluir-aporte").addEventListener("click", excluirAporte);
    $("#btn-excluir-cartao").addEventListener("click", excluirCartao);
    $("#btn-pagar-fatura").addEventListener("click", alternarFatura);
    $("#btn-editar-meta").addEventListener("click", () => abrirMeta(metaAberta.id));
    $("#btn-guardar-meta").addEventListener("click", () => abrirAporte({ metaId: metaAberta.id, tipo: "guardar" }));
    $("#btn-retirar-meta").addEventListener("click", () => abrirAporte({ metaId: metaAberta.id, tipo: "retirar" }));
    $("#seg-tipo-aporte").addEventListener("click", (ev) => { const b = ev.target.closest("[data-t]"); if (b) definirTipoAporte(b.dataset.t); });
    $("#chips-meta").addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-meta]"); if (!b) return;
      $("#form-aporte").elements.meta_id.value = b.dataset.meta;
      $$("#chips-meta .chip-cat").forEach((x) => x.classList.toggle("ativo", x === b));
    });
    $("#btn-aviso-contas").addEventListener("click", () => { gravarPref("aviso-contas-ok", true); renderAvisoContas(); });
    $("#tipos-conta").addEventListener("click", (ev) => { const b = ev.target.closest("[data-t]"); if (b) definirTipoConta(b.dataset.t); });
    $("#form-conta").elements.inicio.addEventListener("change", () => { const t = $("#form-conta").elements.tipo.value; if (t) definirTipoConta(t); });
    $("#sel-cat-conta").addEventListener("change", (ev) => {
      const outra = ev.target.value === "__outra";
      $("#lbl-cat-outra").hidden = !outra;
      $("#form-conta").elements.categoria_outra.required = outra;
      if (outra) setTimeout(() => $("#form-conta").elements.categoria_outra.focus(), 50);
    });
    $("#sel-forma-gasto").addEventListener("change", (ev) => { $("#lbl-parcelas").hidden = !ev.target.value.startsWith("cartao:"); });
    $("#btn-excluir-orcamento").addEventListener("click", excluirOrcamento);
    $("#resumo-gastos").addEventListener("keydown", (ev) => { if (ev.key === "Enter") irPara("gastos"); });
    $("#btn-excluir-conta").addEventListener("click", excluirConta);
    $("#btn-excluir-renda").addEventListener("click", excluirRenda);
    $("#btn-exportar").addEventListener("click", exportarCSV);

    // Tooltip dos gráficos (mouse) — no celular os valores já aparecem escritos
    const tip = $("#tooltip");
    document.addEventListener("pointermove", (ev) => {
      const alvo = ev.pointerType === "mouse" && ev.target.closest("[data-tip]");
      if (!alvo) { tip.hidden = true; return; }
      tip.textContent = alvo.dataset.tip;
      tip.hidden = false;
      tip.style.left = Math.min(ev.clientX + 14, innerWidth - tip.offsetWidth - 8) + "px";
      tip.style.top = ev.clientY + 16 + "px";
    });
  }

  // ================================================================
  // TUTORIAL
  // ================================================================
  const TUTORIAL = [
    { ic: "moeda", cor: "azul", titulo: "Bem-vindos ao Finanças do Casal",
      texto: "Um lugar só para as contas fixas, os gastos do dia a dia, os cartões e as metas de vocês dois. Tudo o que um lança, o outro vê na hora.",
      itens: ["Use as setas ‹ › no topo para mudar o mês", "Toque no ? a qualquer momento para rever este tutorial"] },
    { ic: "casa", cor: "azul", titulo: "Início: o resumo do mês", ir: "inicio",
      texto: "O cartão azul mostra o total das contas fixas do mês, quanto já foi pago e quanto falta.",
      itens: ["A rosca mostra o % já pago", "O 👁 esconde os valores (bom para abrir em público)", "“Sobram” = renda − contas fixas − gastos", "Os alertas avisam contas atrasadas, vencendo e faturas", "Atalhos: novo gasto, pagar, guardar e análises"] },
    { ic: "lista", cor: "azul", titulo: "Contas: marque o que pagou", ir: "contas",
      texto: "Contas fixas são as que se repetem todo mês (aluguel, luz, internet). O que é pago uma vez só, como mercado ou cabeleireiro, vai em Gastos.",
      itens: ["Toque no quadrado para marcar como paga — só isso, não precisa mexer no cadastro", "No mês seguinte ela volta sozinha como “a pagar”", "Conta de um mês só (uma fatura, IPVA)? Escolha “Só neste mês” no cadastro", "Errou? Aparece “Desfazer” por 5 segundos", "Contas que mudam de valor (luz, água) perguntam quanto veio; antes de pagar aparecem com “~” (estimativa)", "Cancelou algo (ex.: Netflix)? Abra a conta e toque em “Encerrar conta”"] },
    { ic: "carrinho", cor: "azul", titulo: "Gastos: o dia a dia com limite", ir: "gastos",
      texto: "Mercado, delivery, lazer, farmácia… lance cada gasto e acompanhe o limite de cada categoria.",
      itens: ["Para o que foi pago na hora, uma vez só", "Toque em + : digite o valor, escolha a categoria e salve", "Orçamento: quanto já foi gasto, quanto resta e quanto dá por dia", "Barra amarela a partir de 80%, vermelha quando passa", "Extrato: os lançamentos dia a dia, como no banco", "Lançou errado ou duplicado? Arraste para a esquerda para excluir", "Botão Importar: puxa as compras do extrato do banco (OFX ou CSV)", "{PESSOAS} filtra por pessoa"] },
    { ic: "cartao", cor: "azul", titulo: "Cartões (só se usarem crédito)", ir: "gastos", sub: "cartoes",
      texto: "Quem paga tudo no Pix ou débito pode pular esta parte. Se usarem cartão de crédito, cadastre com os dias de fechamento e vencimento e escolha o cartão em “Pagamento” ao lançar um gasto.",
      itens: ["Compras parceladas: cada parcela cai na fatura certa", "Contas fixas no cartão (streaming, internet) entram na fatura", "Status: aberta, fechada, vencida ou paga", "Toque na fatura para ver os itens e marcar como paga"] },
    { ic: "alvo", cor: "verde", titulo: "Metas: guardem para o que importa", ir: "metas",
      texto: "Reserva de emergência, viagem, apartamento… defina quanto e até quando.",
      itens: ["O app calcula quanto guardar por mês para chegar no prazo", "Sem prazo, mostra quando chegam lá no ritmo atual", "Toque na meta → Guardar ou Retirar", "Avisa quando o ritmo está abaixo do necessário"] },
    { ic: "etiqueta", cor: "azul", titulo: "Mais: cadastros e análises", ir: "mais",
      texto: "Tudo o que se cadastra uma vez fica aqui.",
      itens: ["Contas fixas, rendas (salários), orçamentos e cartões", "Análises e gráficos: categorias, quem paga o quê, 6 meses", "Exportar tudo em CSV (abre no Excel)", "Este tutorial também fica aqui"] },
    { ic: "festa", cor: "verde", titulo: "Primeiros passos", checklist: true,
      texto: "Façam nesta ordem e o painel fica completo. Os itens se marcam sozinhos." }
  ];

  function passosIniciais() {
    return [
      { ok: estado.rendas.some((r) => r.ativa), txt: "Cadastrar os salários", acao: () => { irPara("mais"); escolherCadastro("rendas"); abrirRenda(); } },
      { ok: estado.contas.length >= 3, txt: "Cadastrar as contas fixas", acao: () => { irPara("contas"); abrirConta(); } },
      { ok: !estado.migracao2 ? null : estado.orcamentos.some((o) => o.ativa), txt: "Ajustar os limites de gastos", acao: () => { irPara("mais"); escolherCadastro("orcamentos"); } },
      { ok: !estado.migracao3 ? null : estado.cartoes.length > 0, txt: "Cadastrar os cartões de crédito", acao: () => { irPara("mais"); escolherCadastro("cartoes"); abrirCartao(); } },
      { ok: !estado.migracao3 ? null : estado.metas.length > 0, txt: "Criar a primeira meta", acao: () => { irPara("metas"); abrirMeta(); } },
      { ok: estado.migracao2 ? estado.gastos.length > 0 : null, txt: "Lançar o primeiro gasto", acao: () => abrirGasto() },
      { ok: window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true, txt: "Instalar na tela de início do celular", dica: "iPhone: Safari → Compartilhar → Adicionar à Tela de Início. Android: Chrome → ⋮ → Instalar app." }
    ].filter((x) => x.ok !== null);
  }

  let tutIndice = 0;
  function abrirTutorial(inicio = 0) {
    const passos = passosIniciais();
    $("#tut-trilho").innerHTML = TUTORIAL.map((t, i) => `
      <section class="tut-slide" data-i="${i}" aria-label="${esc(t.titulo)}">
        <div class="tut-ilustra ${t.cor}"><span>${svg(t.ic)}</span></div>
        <h2>${esc(t.titulo)}</h2>
        <p>${esc(t.texto)}</p>
        ${t.itens ? `<ul class="tut-itens">${t.itens.filter((x) => !x.includes("{PESSOAS}") || PESSOAS.length > 1).map((x) => `<li>${esc(x.replace("{PESSOAS}", ["Todos", ...PESSOAS].join(" / ")))}</li>`).join("")}</ul>` : ""}
        ${t.checklist ? `<ul class="tut-check">${passos.map((x, k) => `
          <li class="${x.ok ? "feito" : ""}">
            <span class="tc-bola">${x.ok ? "✓" : k + 1}</span>
            <div><b>${esc(x.txt)}</b>${x.dica && !x.ok ? `<small>${esc(x.dica)}</small>` : ""}</div>
            ${!x.ok && x.acao ? `<button type="button" class="btn-link" data-passo="${k}">Fazer</button>` : ""}
          </li>`).join("")}</ul>
          <p class="tut-progresso">${passos.filter((x) => x.ok).length} de ${passos.length} concluídos</p>` : ""}
        ${t.ir ? `<button type="button" class="btn btn-ghost tut-ir" data-tut-ir="${t.ir}" data-tut-sub="${t.sub || ""}">Abrir esta tela</button>` : ""}
      </section>`).join("");
    $("#tut-pontos").innerHTML = TUTORIAL.map((_, i) => `<button type="button" role="tab" aria-label="Etapa ${i + 1}" data-tut="${i}"></button>`).join("");
    $("#tut-trilho").onclick = (ev) => {
      const ps = ev.target.closest("[data-passo]");
      if (ps) { fecharTutorial(); passos[Number(ps.dataset.passo)].acao(); return; }
      const ir = ev.target.closest("[data-tut-ir]");
      if (ir) { fecharTutorial(); irPara(ir.dataset.tutIr); if (ir.dataset.tutSub) mostrarSubGastos(ir.dataset.tutSub); }
    };
    $("#modal-tutorial").showModal();
    irSlide(inicio, false);
  }

  function irSlide(i, suave = true) {
    tutIndice = Math.max(0, Math.min(TUTORIAL.length - 1, i));
    const tr = $("#tut-trilho");
    tr.scrollTo({ left: tutIndice * tr.clientWidth, behavior: suave ? "smooth" : "instant" });
    atualizarTutorial();
  }
  function atualizarTutorial() {
    $$("#tut-pontos button").forEach((b, k) => b.setAttribute("aria-selected", k === tutIndice));
    $("#tut-contador").textContent = `${tutIndice + 1} de ${TUTORIAL.length}`;
    $("#tut-voltar").hidden = !tutIndice;
    const ultimo = tutIndice === TUTORIAL.length - 1;
    $("#tut-proximo").textContent = ultimo ? "Começar a usar" : tutIndice === 0 ? "Vamos lá" : "Próximo";
    $("#tut-fechar").style.visibility = ultimo ? "hidden" : "visible";
  }
  function fecharTutorial() { gravarPref("tutorial-visto", true); $("#modal-tutorial").close(); }

  function escolherCadastro(c) {
    cadastroAtual = c;
    $$("#seg-cadastro button").forEach((x) => x.classList.toggle("ativo", x.dataset.c === c));
    $$(".painel-cadastro").forEach((p) => (p.hidden = p.dataset.painel !== c));
  }
  function mostrarSubGastos(g) {
    $$("#seg-gastos button").forEach((x) => x.classList.toggle("ativo", x.dataset.g === g));
    $$(".painel-gastos").forEach((p) => (p.hidden = p.dataset.painel !== g));
  }

  function ligarTutorial() {
    $("#btn-ajuda").addEventListener("click", () => abrirTutorial(0));
    $("#tut-fechar").addEventListener("click", fecharTutorial);
    $("#tut-voltar").addEventListener("click", () => irSlide(tutIndice - 1));
    $("#tut-proximo").addEventListener("click", () => (tutIndice === TUTORIAL.length - 1 ? fecharTutorial() : irSlide(tutIndice + 1)));
    $("#tut-pontos").addEventListener("click", (ev) => { const b = ev.target.closest("[data-tut]"); if (b) irSlide(Number(b.dataset.tut)); });
    let t;
    $("#tut-trilho").addEventListener("scroll", () => {
      clearTimeout(t);
      t = setTimeout(() => { const tr = $("#tut-trilho"); const i = Math.round(tr.scrollLeft / tr.clientWidth); if (i !== tutIndice) { tutIndice = i; atualizarTutorial(); } }, 60);
    }, { passive: true });
    $("#modal-tutorial").addEventListener("keydown", (ev) => {
      if (ev.key === "ArrowRight") irSlide(tutIndice + 1);
      if (ev.key === "ArrowLeft") irSlide(tutIndice - 1);
    });
    $("#modal-tutorial").addEventListener("close", () => gravarPref("tutorial-visto", true));
    addEventListener("resize", () => { if ($("#modal-tutorial").open) irSlide(tutIndice, false); });
  }

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
  const msgConvite = (c) => `Oi, ${c.nome}! Te convidei para o app Finanças${c.familia_id ? ` (${estado.familia.nome})` : ""}.\n\n1. Abra: ${linkApp()}\n2. Toque em “Criar minha conta”\n3. Use este e-mail: ${c.email}\n4. Escolha uma senha e confirme pelo e-mail que vai chegar.`;

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

  // ================================================================
  // IMPORTAR EXTRATO (OFX / CSV)
  // ================================================================
  /** Lê o arquivo como texto: tenta UTF-8 e cai para Latin-1 (comum em OFX de banco brasileiro). */
  async function lerTexto(file) {
    const buf = await file.arrayBuffer();
    try { return new TextDecoder("utf-8", { fatal: true }).decode(buf); } catch { return new TextDecoder("iso-8859-1").decode(buf); }
  }
  /** Número com sinal: "-1.234,56", "1234.56", "R$ -45,90", "(45,90)". */
  function numeroComSinal(t) {
    let v = String(t ?? "").trim();
    let neg = /^\(.*\)$/.test(v) || /-/.test(v) || /\bD$/i.test(v);
    v = v.replace(/[^\d.,]/g, "");
    if (!v) return NaN;
    if (v.includes(",") && v.includes(".")) v = v.lastIndexOf(",") > v.lastIndexOf(".") ? v.replace(/\./g, "").replace(",", ".") : v.replace(/,/g, "");
    else if (v.includes(",")) v = v.replace(",", ".");
    else if (/^\d{1,3}(\.\d{3})+$/.test(v)) v = v.replace(/\./g, "");
    const n = Number(v);
    return Number.isFinite(n) ? (neg ? -n : n) : NaN;
  }
  /** Datas: 20261105..., 2026-11-05, 05/11/2026, 05/11/26, 05-11-2026. */
  function dataISO(t) {
    const v = String(t ?? "").trim();
    let m = v.match(/^(\d{4})(\d{2})(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
    m = v.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/); if (m) return `${m[3].length === 2 ? "20" + m[3] : m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
    return null;
  }

  function lerOFX(txt) {
    const tag = (bloco, nome) => { const m = bloco.match(new RegExp("<" + nome + ">([^<\\r\\n]*)", "i")); return m ? m[1].trim() : ""; };
    const blocos = txt.split(/<STMTTRN>/i).slice(1).map((b) => b.split(/<\/STMTTRN>/i)[0]);
    const cartao = /<CREDITCARDMSGSRSV1>|<CCSTMTRS>/i.test(txt);
    return { cartao, linhas: blocos.map((b) => ({
      data: dataISO(tag(b, "DTPOSTED")), valor: numeroComSinal(tag(b, "TRNAMT")),
      descricao: (tag(b, "MEMO") || tag(b, "NAME") || "Lançamento").replace(/\s+/g, " "), id: tag(b, "FITID")
    })).filter((l) => l.data && Number.isFinite(l.valor)) };
  }

  function dividirCSV(linha, sep) {
    const out = []; let cur = "", q = false;
    for (let i = 0; i < linha.length; i++) {
      const ch = linha[i];
      if (ch === '"') { if (q && linha[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (ch === sep && !q) { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out.map((x) => x.trim());
  }
  function lerCSV(txt) {
    const linhas = txt.replace(/^\ufeff/, "").split(/\r?\n/).filter((l) => l.trim());
    if (!linhas.length) return { linhas: [] };
    const seps = [";", ",", "\t"];
    const sep = seps.map((x) => [x, dividirCSV(linhas[0], x).length]).sort((a, b) => b[1] - a[1])[0][0];
    const tab = linhas.map((l) => dividirCSV(l, sep));
    // encontra a linha de cabeçalho (até a 10ª linha)
    const ehData = (x) => !!dataISO(x), ehNum = (x) => Number.isFinite(numeroComSinal(x)) && /\d/.test(x);
    const RE_VALOR = /valor|amount|value|quantia|credito|debito|entrada|saida|credit|debit/i;
    let ih = tab.findIndex((r, i) => i < 15 && r.some((c) => /data|date/i.test(c)) && r.some((c) => RE_VALOR.test(semAcento(c))));
    let iData, iDesc, iValor, iCred = -1, iDeb = -1;
    if (ih >= 0) {
      const cab = tab[ih].map((c) => semAcento(c));
      iData = cab.findIndex((c) => /^data|date|dt\b/.test(c));
      iValor = cab.findIndex((c) => /valor|amount|value|quantia/.test(c) && !/saldo|balance/.test(c));
      if (iValor < 0) {
        // colunas separadas de entrada e saída (crédito / débito)
        iCred = cab.findIndex((c) => /credito|entrada|credit/.test(c) && !/saldo|balance/.test(c));
        iDeb = cab.findIndex((c) => /debito|saida|debit/.test(c) && !/saldo|balance/.test(c));
        if (iCred >= 0 || iDeb >= 0) iValor = -2;
      }
      iDesc = -1;
      for (const re of [/descri/, /title|titulo/, /estabelecimento|loja|favorecido/, /historico/, /memo|detalhe|nome/, /transaction_type|tipo|operacao/, /lancamento/]) {
        iDesc = cab.findIndex((c, k) => k !== iData && k !== iValor && k !== iCred && k !== iDeb && re.test(c));
        if (iDesc >= 0) break;
      }
    } else {
      ih = -1;
      const amostra = tab.slice(0, 20);
      const col = (fn) => [...Array(tab[0].length).keys()].find((k) => amostra.filter((r) => fn(r[k] || "")).length >= amostra.length * 0.6);
      iData = col(ehData); iValor = [...Array(tab[0].length).keys()].reverse().find((k) => k !== iData && amostra.filter((r) => ehNum(r[k] || "")).length >= amostra.length * 0.6);
      iDesc = [...Array(tab[0].length).keys()].find((k) => k !== iData && k !== iValor);
    }
    if (iData < 0 || iData === undefined || iValor === undefined || iValor === -1) return { linhas: [], erro: "Não encontrei as colunas de data e valor neste CSV." };
    if (iDesc < 0 || iDesc === undefined) iDesc = [...tab[ih >= 0 ? ih : 0].keys()].find((k) => k !== iData && k !== iValor && k !== iCred && k !== iDeb);
    const valorDe = (r) => {
      if (iValor >= 0) return numeroComSinal(r[iValor]);
      const c = iCred >= 0 ? Math.abs(numeroComSinal(r[iCred]) || 0) : 0, d = iDeb >= 0 ? Math.abs(numeroComSinal(r[iDeb]) || 0) : 0;
      return c - d;
    };
    return { linhas: tab.slice(ih + 1).map((r) => ({ data: dataISO(r[iData]), valor: valorDe(r), descricao: (r[iDesc] || "Lançamento").replace(/\s+/g, " ") }))
      .filter((l) => l.data && Number.isFinite(l.valor) && l.valor !== 0) };
  }

  const NAO_E_COMPRA = /pagamento (recebido|da fatura|de fatura|efetuado)|pagto fatura|pag fatura|pagamento fatura|estorno|credito de|transferencia recebida|pix recebido|recebid|rendimento|resgate|aplicacao|deposito|salario|ted recebida|doc recebido|saldo|dinheiro reservado|reservad|cofrinho|caixinha|dinheiro guardado|guardado/;
  const SUGESTOES_CAT = [
    [/ifood|rappi|aiqfome|restaurante|lanchonete|burger|mcdonald|mc donald|bk |pizza|sushi|churrasc|cafe|cafeteria|starbucks|outback|habib|delivery|spoleto|subway|padoca|bar /, ["Restaurantes e delivery", "Restaurantes", "Alimentação"]],
    [/mercado|supermerc|carrefour|assai|atacad|extra |pao de acucar|hortifruti|sacolao|padaria|acougue|oba |hirota|dia brasil|sonda|swift/, ["Mercado", "Alimentação"]],
    [/uber|99app|99 |posto|shell|ipiranga|petrobras|combust|estaciona|sem parar|veloe|conectcar|metro|cptm|bilhete unico|ped[aá]gio/, ["Transporte"]],
    [/drogasil|droga raia|raia|pague menos|panvel|drogaria|farmacia|pacheco|ultrafarma/, ["Farmácia", "Saúde"]],
    [/cinema|cinemark|ingresso|sympla|eventim|show|steam|playstation|xbox|parque|teatro/, ["Lazer"]],
    [/amazon|mercado ?livre|mercadolivre|shopee|magalu|magazine|americanas|renner|riachuelo|c&a|zara|shein|aliexpress|centauro|netshoes|kabum/, ["Compras"]],
    [/leroy|telhanorte|tok ?& ?stok|tok stok|camicado|casas bahia|etna|c&c|madeira ?madeira/, ["Casa"]],
    [/hospital|clinica|laborat|dentista|unimed|consulta|exame/, ["Saúde", "Farmácia"]],
    [/netflix|spotify|disney|hbo|max |prime video|youtube|globoplay|deezer|apple\.com|google one|icloud/, ["Assinaturas", "Lazer"]]
  ];

  let importacao = null;
  function categoriasGasto() {
    const cats = estado.orcamentos.filter((o) => o.ativa).map((o) => o.categoria);
    estado.gastos.forEach((g) => { if (!cats.includes(g.categoria)) cats.push(g.categoria); });
    if (!cats.includes("Outros")) cats.push("Outros");
    return cats;
  }
  function sugerirCategoria(desc, cats) {
    const n = semAcento(desc).replace(/\d+\/\d+|parcela.*$/g, "").trim();
    // aprende com o histórico: mesma descrição (primeiras palavras) já categorizada
    const chave = n.split(/\s+/).slice(0, 2).join(" ");
    const visto = estado.gastos.slice().reverse().find((g) => semAcento(g.descricao).startsWith(chave) && chave.length >= 4);
    if (visto && cats.includes(visto.categoria)) return visto.categoria;
    for (const [re, nomes] of SUGESTOES_CAT) if (re.test(n + " ")) { const c = cats.find((x) => nomes.some((y) => semAcento(x) === semAcento(y))); if (c) return c; }
    return cats.includes("Outros") ? "Outros" : cats[0];
  }

  function abrirImportar() {
    if (!estado.migracao2) return toast("Rode a migração 02 no Supabase primeiro");
    importacao = null;
    $("#imp-passo1").hidden = false; $("#imp-passo2").hidden = true; $("#imp-erro").textContent = "";
    $("#imp-file").value = "";
    $("#modal-importar").showModal();
  }

  async function arquivoEscolhido(file) {
    $("#imp-erro").textContent = "";
    if (!file) return;
    try {
      const txt = await lerTexto(file);
      const ehOFX = /<OFX>|<STMTTRN>/i.test(txt) || /\.(ofx|qfx)$/i.test(file.name);
      const lido = ehOFX ? lerOFX(txt) : lerCSV(txt);
      if (!lido.linhas.length) { $("#imp-erro").textContent = lido.erro || "Não encontrei lançamentos neste arquivo. Ele é um extrato em OFX ou CSV?"; return; }
      montarImportacao(lido, file.name);
    } catch (e) { console.error(e); $("#imp-erro").textContent = "Não consegui ler o arquivo: " + (e.message || e); }
  }

  function montarImportacao(lido, nome) {
    const cats = categoriasGasto();
    // gasto = sinal da maioria dos lançamentos que não são pagamentos/entradas óbvias
    const candidatos = lido.linhas.filter((l) => !NAO_E_COMPRA.test(semAcento(l.descricao)));
    const neg = candidatos.filter((l) => l.valor < 0).length, pos = candidatos.length - neg;
    const sinalGasto = neg >= pos ? -1 : 1;
    const contasAtivas = estado.contas.filter((c) => c.ativa);
    const linhas = lido.linhas.map((l, i) => {
      const n = semAcento(l.descricao);
      const valor = Math.abs(l.valor);
      const motivo = [];
      if (NAO_E_COMPRA.test(n)) motivo.push("não é compra");
      const dup = estado.gastos.find((g) => g.data === l.data && Math.abs(Number(g.valor) - valor) < 0.005);
      if (dup) motivo.push("já lançado");
      const conta = contasAtivas.find((c) => { const cn = semAcento(c.nome); return cn.length >= 4 && (n.includes(cn) || cn.includes(n.slice(0, 8))); });
      if (conta) motivo.push(`parece a conta fixa “${conta.nome}”`);
      return { i, ...l, valor, bruto: l.valor, motivo, categoria: sugerirCategoria(l.descricao, cats), dup: !!dup };
    });
    importacao = { nome, cartao: lido.cartao, linhas, sinalGasto, cats };
    aplicarSinal();
    // opções
    const cartoes = estado.migracao3 ? estado.cartoes.filter((c) => c.ativo) : [];
    $("#imp-forma").innerHTML = `<option value="">Pix ou débito</option>` + cartoes.map((c) => `<option value="cartao:${c.id}">💳 Cartão ${esc(c.nome)}</option>`).join("");
    if (lido.cartao && cartoes.length === 1) $("#imp-forma").value = "cartao:" + cartoes[0].id;
    $("#imp-quem").innerHTML = RESPONSAVEIS.map((p) => `<option>${esc(p)}</option>`).join("");
    $("#imp-quem").value = estado.usuario.nome.replace(" (demo)", "");
    if (!RESPONSAVEIS.includes($("#imp-quem").value)) $("#imp-quem").value = PESSOAS[0];
    $("#imp-passo1").hidden = true; $("#imp-passo2").hidden = false;
    desenharImportacao();
  }

  /** Marca o que é gasto pelo sinal e desmarca pagamentos, entradas, duplicados e contas fixas. */
  function aplicarSinal() {
    importacao.linhas.forEach((l) => {
      const ehGasto = Math.sign(l.bruto) === importacao.sinalGasto;
      l.entrada = !ehGasto;
      l.marcado = ehGasto && !l.motivo.length;
    });
  }

  function desenharImportacao() {
    const L = importacao.linhas.slice().sort((a, b) => b.data.localeCompare(a.data));
    const opcoes = (atual) => importacao.cats.map((c) => `<option ${c === atual ? "selected" : ""}>${esc(c)}</option>`).join("");
    $("#imp-lista").innerHTML = L.map((l) => `
      <li class="imp-item ${l.marcado ? "on" : ""} ${l.entrada ? "entrada" : ""}" data-i="${l.i}">
        <label class="imp-chk"><input type="checkbox" ${l.marcado ? "checked" : ""} data-imp-chk="${l.i}" aria-label="Importar ${esc(l.descricao)}" /></label>
        <div class="imp-meio">
          <div class="imp-desc">${esc(l.descricao)}</div>
          <div class="imp-meta">${esc(fmtData(l.data, { day: "numeric", month: "short" }))}${l.entrada ? ' · <span class="badge futura">entrada</span>' : ""}${l.motivo.map((m) => ` · <span class="badge ${m === "já lançado" ? "paga" : "breve"}">${esc(m)}</span>`).join("")}</div>
          ${l.entrada ? "" : `<select class="imp-cat" data-imp-cat="${l.i}">${opcoes(l.categoria)}</select>`}
        </div>
        <span class="imp-valor ${l.entrada ? "bom-txt" : ""}">${l.entrada ? "+" : "−"}${brl.format(l.valor)}</span>
      </li>`).join("");
    atualizarResumoImp();
  }

  function atualizarResumoImp() {
    const sel = importacao.linhas.filter((l) => l.marcado);
    const ign = importacao.linhas.filter((l) => !l.marcado && !l.entrada);
    $("#imp-resumo").innerHTML = `<b>${sel.length}</b> gasto${sel.length !== 1 ? "s" : ""} selecionado${sel.length !== 1 ? "s" : ""} · <b>${brl.format(soma(sel, (l) => l.valor))}</b>
      <small>${importacao.linhas.length} lançamentos no arquivo${ign.length ? ` · ${ign.length} desmarcado${ign.length > 1 ? "s" : ""} (repetidos, pagamentos ou contas fixas)` : ""}</small>`;
    $("#imp-confirmar").textContent = sel.length ? `Importar ${sel.length} gasto${sel.length > 1 ? "s" : ""}` : "Nada selecionado";
    $("#imp-confirmar").disabled = !sel.length;
  }

  async function confirmarImportacao() {
    const sel = importacao.linhas.filter((l) => l.marcado);
    if (!sel.length) return;
    const forma = $("#imp-forma").value;
    const cartao = forma.startsWith("cartao:") ? estado.cartoes.find((c) => c.id === forma.slice(7)) : null;
    const quem = $("#imp-quem").value;
    const linhas = sel.map((l) => {
      const g = { data: l.data, descricao: l.descricao.slice(0, 80), valor: Math.round(l.valor * 100) / 100, categoria: l.categoria, responsavel: quem,
        forma_pagamento: cartao ? "Cartão " + cartao.nome : "Importado do extrato" };
      if (estado.migracao3) { g.cartao_id = cartao ? cartao.id : null; g.parcelas = 1; }
      return g;
    });
    const btn = $("#imp-confirmar"); btn.disabled = true; btn.textContent = "Importando…";
    try {
      const novos = await db.inserirVarios("gastos", linhas);
      estado.gastos.push(...novos);
      $("#modal-importar").close();
      render();
      const meses = [...new Set(linhas.map((l) => l.data.slice(0, 7)))];
      toast(`${novos.length} gasto${novos.length > 1 ? "s" : ""} importado${novos.length > 1 ? "s" : ""}${meses.length > 1 ? ` (${meses.length} meses)` : ""}`, { rotulo: "Desfazer", acao: async () => {
        for (const g of novos) await db.remover("gastos", g.id);
        const ids = new Set(novos.map((g) => g.id));
        estado.gastos = estado.gastos.filter((g) => !ids.has(g.id)); render(); toast("Importação desfeita");
      } });
      irPara("gastos"); mostrarSubGastos("extrato");
    } catch (e) { erro(e); btn.disabled = false; atualizarResumoImp(); }
  }

  function ligarImportar() {
    $("#imp-file").addEventListener("change", (ev) => arquivoEscolhido(ev.target.files[0]));
    $("#imp-voltar").addEventListener("click", () => { $("#imp-passo1").hidden = false; $("#imp-passo2").hidden = true; $("#imp-file").value = ""; });
    $("#imp-confirmar").addEventListener("click", confirmarImportacao);
    $("#imp-marcar").addEventListener("click", () => { importacao.linhas.forEach((l) => { if (!l.entrada) l.marcado = true; }); desenharImportacao(); });
    $("#imp-desmarcar").addEventListener("click", () => { importacao.linhas.forEach((l) => (l.marcado = false)); desenharImportacao(); });
    $("#imp-inverter").addEventListener("click", () => { importacao.sinalGasto *= -1; aplicarSinal(); desenharImportacao(); });
    $("#imp-lista").addEventListener("change", (ev) => {
      const c = ev.target.closest("[data-imp-chk]");
      if (c) { const l = importacao.linhas[+c.dataset.impChk]; l.marcado = c.checked; c.closest(".imp-item").classList.toggle("on", c.checked); atualizarResumoImp(); }
      const s2 = ev.target.closest("[data-imp-cat]");
      if (s2) {
        const l = importacao.linhas[+s2.dataset.impCat]; l.categoria = s2.value;
        // aplica a mesma categoria às outras linhas com a mesma descrição
        const chave = semAcento(l.descricao).split(/\s+/).slice(0, 2).join(" ");
        importacao.linhas.forEach((x) => { if (x !== l && semAcento(x.descricao).startsWith(chave)) x.categoria = s2.value; });
        desenharImportacao();
      }
    });
  }

  // ================================================================
  // ARRASTAR PARA EXCLUIR
  // ================================================================
  const LARG_ACAO = 88;
  let arraste = null, suprimirClique = false;
  const abrirSwipe = (li) => { li.classList.add("aberto"); li.querySelector(".item").style.transform = `translateX(-${LARG_ACAO}px)`; };
  const fecharSwipe = (li) => { li.classList.remove("aberto"); const it = li.querySelector(".item"); if (it) it.style.transform = ""; };

  async function excluirPorSwipe(li) {
    const { swipe: tipo, id } = li.dataset;
    const sumir = () => { li.style.height = li.offsetHeight + "px"; requestAnimationFrame(() => li.classList.add("saindo")); };
    try {
      if (tipo === "gasto") {
        const g = estado.gastos.find((x) => x.id === id); if (!g) return;
        sumir(); await new Promise((r) => setTimeout(r, 180)); await apagarGasto(g);
      } else if (tipo === "aporte") {
        const a = estado.aportes.find((x) => x.id === id); if (!a) return;
        sumir(); await new Promise((r) => setTimeout(r, 180));
        await db.remover("aportes", a.id);
        estado.aportes = estado.aportes.filter((x) => x.id !== a.id);
        render(); if ($("#modal-meta-detalhe").open) desenharMetaDetalhe();
        toast("Lançamento excluído", { rotulo: "Desfazer", acao: async () => {
          const { id: _i, created_at, created_by, ...resto } = a;
          estado.aportes.push(await db.inserir("aportes", resto)); render(); if ($("#modal-meta-detalhe").open) desenharMetaDetalhe();
        } });
      } else if (tipo === "renda") {
        const r = estado.rendas.find((x) => x.id === id); if (!r) return;
        sumir(); await new Promise((ok) => setTimeout(ok, 180));
        await db.remover("rendas", r.id);
        estado.rendas = estado.rendas.filter((x) => x.id !== r.id);
        render();
        toast("Renda excluída", { rotulo: "Desfazer", acao: async () => {
          const { id: _i, created_at, created_by, ...resto } = r;
          estado.rendas.push(await db.inserir("rendas", resto)); render();
        } });
      } else if (tipo === "conta") {
        const c = estado.contas.find((x) => x.id === id); if (!c) return;
        const npg = estado.pagamentos.filter((p) => p.conta_id === c.id).length;
        if (!confirm(`Excluir a conta “${c.nome}”${npg ? ` e os ${npg} pagamento${npg > 1 ? "s" : ""} registrados dela` : ""}?\n\nSe vocês só pararam de pagar, toque na conta e use “Encerrar conta” (o histórico fica guardado).`)) { fecharSwipe(li); return; }
        sumir(); await new Promise((ok) => setTimeout(ok, 180));
        await db.remover("contas", c.id);
        estado.contas = estado.contas.filter((x) => x.id !== c.id);
        estado.pagamentos = estado.pagamentos.filter((p) => p.conta_id !== c.id);
        if (DEMO) { demoDB().pagamentos = demoDB().pagamentos.filter((p) => p.conta_id !== c.id); demoStore.gravar(demoDB()); }
        render(); toast("Conta excluída");
      }
    } catch (e) { erro(e); render(); }
  }

  function ligarArraste() {
    document.addEventListener("click", (ev) => {
      if (suprimirClique) { ev.stopPropagation(); ev.preventDefault(); return; }
      const acao = ev.target.closest("[data-excluir-swipe]");
      if (acao) { ev.stopPropagation(); excluirPorSwipe(acao.closest(".swipe")); return; }
      const aberto = ev.target.closest(".swipe.aberto");
      if (aberto) { ev.stopPropagation(); ev.preventDefault(); fecharSwipe(aberto); }
    }, true);
    document.addEventListener("touchstart", (ev) => {
      const item = ev.target.closest(".swipe > .item");
      $$(".swipe.aberto").forEach((li) => { if (!item || li !== item.parentElement) fecharSwipe(li); });
      if (!item) return;
      const t = ev.touches[0];
      arraste = { li: item.parentElement, item, x0: t.clientX, y0: t.clientY, dx: 0, base: item.parentElement.classList.contains("aberto") ? -LARG_ACAO : 0, dir: null };
    }, { passive: true });
    document.addEventListener("touchmove", (ev) => {
      if (!arraste) return;
      const t = ev.touches[0], dx = t.clientX - arraste.x0, dy = t.clientY - arraste.y0;
      if (!arraste.dir) { if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return; arraste.dir = Math.abs(dx) > Math.abs(dy) ? "h" : "v"; if (arraste.dir === "h") { arraste.item.style.transition = "none"; arraste.li.classList.add("arrastando"); } }
      if (arraste.dir !== "h") return;
      arraste.dx = dx;
      arraste.item.style.transform = `translateX(${Math.min(0, Math.max(-LARG_ACAO * 2.2, arraste.base + dx))}px)`;
    }, { passive: true });
    document.addEventListener("touchend", () => {
      if (!arraste) return;
      const { li, item, dir, base, dx } = arraste;
      arraste = null;
      if (dir !== "h") return;
      item.style.transition = "";
      setTimeout(() => li.classList.remove("arrastando"), 250);
      suprimirClique = true; setTimeout(() => (suprimirClique = false), 350);
      const x = base + dx;
      if (x < -LARG_ACAO * 1.8) { item.style.transform = `translateX(-100%)`; excluirPorSwipe(li); }
      else if (x < -LARG_ACAO / 2) abrirSwipe(li);
      else fecharSwipe(li);
    });
  }

  /** Impede salvar duas vezes: trava o botão em "Salvando…" até terminar. */
  const travar = (fn) => async (ev) => {
    ev.preventDefault();
    const btn = ev.target.querySelector('[type="submit"]');
    if (btn?.disabled) return;
    const txt = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = "Salvando…"; }
    try { await fn(ev); } finally { if (btn) { btn.disabled = false; if (btn.textContent === "Salvando…") btn.textContent = txt; } }
  };

  let toastTimer;
  function toast(msg, opcoes) {
    const t = $("#toast");
    t.innerHTML = `<span>${esc(msg)}</span>${opcoes ? `<button type="button">${esc(opcoes.rotulo)}</button>` : ""}`;
    if (opcoes) t.querySelector("button").onclick = () => { t.hidden = true; clearTimeout(toastTimer); opcoes.acao(); };
    t.hidden = false;
    t.classList.remove("entra"); void t.offsetWidth; t.classList.add("entra");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), opcoes ? 5000 : 2600);
  }
  function erro(e) { console.error(e); toast("Erro: " + (e.message || e)); }

  // ---------- Dados de exemplo (só no modo demonstração) ----------
  function dadosExemplo() {
    const hoje = compDe(new Date());
    const ini = somaMes(hoje, -6);
    const [p1, p2] = PESSOAS;
    const contas = [
      ["Aluguel", 2200, 5, "Moradia", "Casal", "Pix"],
      ["Condomínio", 480, 10, "Condomínio", "Casal", "Boleto"],
      ["Energia", 210, 15, "Energia", "Casal", "Débito automático"],
      ["Água", 95, 18, "Água", "Casal", "Débito automático"],
      ["Internet", 120, 20, "Internet e telefone", "Casal", "Cartão de crédito"],
      ["Celular", 60, 12, "Internet e telefone", p1, "Cartão de crédito"],
      ["Celular", 55, 12, "Internet e telefone", p2, "Cartão de crédito"],
      ["Streaming", 55, 25, "Assinaturas", "Casal", "Cartão de crédito"],
      ["Academia", 110, 8, "Saúde", p2, "Cartão de crédito"],
      ["Seguro do carro", 230, 28, "Seguros", p1, "Boleto"]
    ].map(([nome, valor, dia, categoria, responsavel, forma]) => ({
      id: uid(), nome, valor, dia_vencimento: dia, categoria, responsavel, forma_pagamento: forma, observacao: null, inicio: ini, ativa: true
    }));
    const pagamentos = [];
    for (let i = -5; i <= 0; i++) {
      const m = somaMes(hoje, i);
      contas.forEach((c) => {
        if (i === 0 && c.dia_vencimento > new Date().getDate() - 3) return;
        const varia = c.categoria === "Energia" || c.categoria === "Água" ? 1 + (Math.sin(i * 3 + c.valor) * 0.15) : 1;
        pagamentos.push({ id: uid(), conta_id: c.id, competencia: m, valor_pago: Math.round(c.valor * varia * 100) / 100, pago_em: m.slice(0, 8) + pad(Math.min(c.dia_vencimento, 28)), pago_por: i % 2 ? p1 : p2 });
      });
    }
    contas.forEach((c) => (c.variavel = c.categoria === "Energia" || c.categoria === "Água"));
    const nubank = { id: uid(), nome: "Nubank", dia_fechamento: 3, dia_vencimento: 10, limite: 8000, responsavel: "Casal", ativo: true };
    const inter = { id: uid(), nome: "Inter", dia_fechamento: 25, dia_vencimento: 5, limite: 4000, responsavel: p2, ativo: true };
    const cartoes = [nubank, inter];
    contas.forEach((c) => { if (c.forma_pagamento === "Cartão de crédito") { c.cartao_id = nubank.id; c.forma_pagamento = "Cartão Nubank"; } });
    const orcamentos = [["Mercado", 1200], ["Restaurantes e delivery", 400], ["Lazer", 300], ["Farmácia", 150], ["Transporte", 300], ["Compras", 300]]
      .map(([categoria, limite]) => ({ id: uid(), categoria, limite, ativa: true }));
    const modelos = [["Mercado do mês", "Mercado", 420], ["Hortifruti", "Mercado", 85], ["Padaria", "Mercado", 32], ["iFood", "Restaurantes e delivery", 68],
      ["Jantar fora", "Restaurantes e delivery", 145], ["Cinema", "Lazer", 74], ["Café da tarde", "Lazer", 38], ["Farmácia", "Farmácia", 56],
      ["Uber", "Transporte", 27], ["Combustível", "Transporte", 180], ["Presente", "Compras", 120]];
    const gastos = [];
    for (let i = -2; i <= 0; i++) {
      const m = somaMes(hoje, i);
      const ultimo = i === 0 ? new Date().getDate() : 28;
      modelos.forEach(([descricao, categoria, valor], k) => {
        const dia = 1 + ((k * 5 + 3) % ultimo);
        gastos.push({ id: uid(), data: m.slice(0, 8) + pad(dia), descricao, categoria, valor: Math.round(valor * (0.8 + ((k * 7 + i * 3) % 5) / 10) * 100) / 100,
          responsavel: k % 3 ? p1 : p2, forma_pagamento: k % 2 ? "Cartão de crédito" : "Pix", created_at: m + "T1" + (k % 10) + ":00:00" });
      });
    }
    gastos.forEach((g, k) => {
      if (g.forma_pagamento === "Cartão de crédito") { const c = k % 4 ? nubank : inter; g.cartao_id = c.id; g.forma_pagamento = "Cartão " + c.nome; }
      g.parcelas = 1;
    });
    gastos.push({ id: uid(), data: somaMes(hoje, -1).slice(0, 8) + "18", descricao: "Air fryer", categoria: "Casa", valor: 540, responsavel: p1, forma_pagamento: "Cartão Nubank", cartao_id: nubank.id, parcelas: 6, created_at: "" });
    orcamentos.push({ id: uid(), categoria: "Casa", limite: 200, ativa: true });
    const faturas_pagas = [];
    cartoes.forEach((c) => { for (let i = -4; i <= 0; i++) {
      const comp = somaMes(hoje, i), venc = comp.slice(0, 8) + pad(Math.min(c.dia_vencimento, 28));
      if (venc < hojeISO()) faturas_pagas.push({ id: uid(), cartao_id: c.id, competencia: comp, valor_pago: 0, pago_em: comp.slice(0, 8) + pad(Math.max(1, Math.min(c.dia_vencimento, 28) - 1)), pago_por: c === inter ? p2 : p1 });
    } });
    const prazo = (meses) => somaMes(hoje, meses);
    const metas = [
      { id: uid(), nome: "Reserva de emergência", valor_alvo: 30000, prazo: prazo(14), onde: "Tesouro Selic", ativa: true },
      { id: uid(), nome: "Viagem para o Japão", valor_alvo: 25000, prazo: prazo(20), onde: "CDB 100% CDI", ativa: true },
      { id: uid(), nome: "Entrada do apartamento", valor_alvo: 80000, prazo: null, onde: "Fundo de investimento", ativa: true }
    ];
    const aportes = [];
    for (let i = -6; i <= 0; i++) {
      const m = somaMes(hoje, i);
      aportes.push({ id: uid(), meta_id: metas[0].id, data: m.slice(0, 8) + "06", valor: 1200 + (i % 2) * 200, responsavel: p1, observacao: null });
      if (i > -5) aportes.push({ id: uid(), meta_id: metas[1].id, data: m.slice(0, 8) + "12", valor: 700, responsavel: p2, observacao: null });
      if (i % 2 === 0) aportes.push({ id: uid(), meta_id: metas[2].id, data: m.slice(0, 8) + "20", valor: 1500, responsavel: i % 4 ? p1 : p2, observacao: null });
    }
    aportes.push({ id: uid(), meta_id: metas[0].id, data: somaMes(hoje, -6).slice(0, 8) + "01", valor: 2500, responsavel: p1, observacao: "Saldo inicial" });
    const rendas = [
      { id: uid(), descricao: "Salário", valor: 7500, responsavel: p1, ativa: true },
      { id: uid(), descricao: "Salário", valor: 6000, responsavel: p2, ativa: true }
    ];
    return { contas, pagamentos, rendas, gastos, orcamentos, metas, aportes, cartoes, faturas_pagas };
  }

  iniciar();
})();
