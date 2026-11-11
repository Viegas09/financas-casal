/* Finanças do Casal — dashboard de contas fixas
 * HTML + JS puro, sem etapa de build. Dados e login no Supabase.
 */
(() => {
  "use strict";

  const CFG = window.CONFIG || {};
  const DEMO = !CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY;
  const PESSOAS = CFG.PESSOAS || ["Pessoa 1", "Pessoa 2"];
  const RESPONSAVEIS = [...PESSOAS, "Casal"];
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
    moeda: '<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .9-3 2s1 1.7 3 2 3 .9 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6.5v11"/>'
  };
  const svg = (nome, cls = "") => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONES[nome] || ICONES.etiqueta}</svg>`;
  const semAcento = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const REGRAS_ICONE = [
    [/aluguel|moradia|casa|financiamento|iptu/, "casa"], [/condominio/, "predio"],
    [/energia|luz|eletric/, "raio"], [/agua|saneamento|sabesp/, "gota"], [/gas\b|gas$|comgas/, "chama"],
    [/celular|telefone|vivo|claro|tim\b/, "telefone"], [/internet|wifi|fibra/, "wifi"],
    [/transporte|carro|combust|gasolina|uber|onibus|estacion|ipva/, "carro"],
    [/saude|academia|farmacia|plano|medic|dentista|terapia/, "coracao"], [/seguro/, "escudo"],
    [/assinatura|streaming|netflix|spotify|disney|prime|youtube|hbo|max\b/, "play"],
    [/educa|curso|escola|faculdade|livro/, "livro"], [/pet|cachorro|gato|veterin|racao/, "pata"],
    [/invest|poupanca|reserva|aporte|tesouro/, "grafico"], [/mercado|aliment|feira|padaria/, "carrinho"],
    [/cartao|fatura|nubank/, "cartao"]
  ];
  const iconeDe = (...textos) => {
    for (const t of textos) { const n = semAcento(t); for (const [re, ic] of REGRAS_ICONE) if (re.test(n)) return ic; }
    return "etiqueta";
  };
  const bolaIcone = (conta) => `<span class="bola-cat" aria-hidden="true">${svg(iconeDe(conta.categoria, conta.nome))}</span>`;
  const vazio = (icone, titulo, texto, acao) => `
    <li class="estado-vazio">
      <span class="ev-ic">${svg(icone)}</span>
      <strong>${titulo}</strong>
      ${texto ? `<span>${texto}</span>` : ""}
      ${acao ? `<button class="btn btn-primary" data-acao="${acao[0]}">${acao[1]}</button>` : ""}
    </li>`;
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
      if (!d) { d = dadosExemplo(); this.gravar(d); }
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
    mes: compDe(new Date()),
    filtro: "pendentes"
  };

  // ================================================================
  // AUTENTICAÇÃO
  // ================================================================
  async function iniciar() {
    preencherSelects();
    ligarEventos();

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
    const { data, error } = await sb.from("membros").select("nome").eq("user_id", user.id).maybeSingle();
    if (error || !data) {
      await sb.auth.signOut();
      $("#login-erro").textContent = "Este usuário não tem acesso ao painel. Peça para ser adicionado na tabela “membros”.";
      return mostrarLogin();
    }
    estado.usuario = { nome: data.nome };
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
      const [contas, pagamentos, rendas] = await Promise.all([db.listar("contas"), db.listar("pagamentos"), db.listar("rendas")]);
      Object.assign(estado, { contas, pagamentos, rendas });
      render();
      esconderSplash();
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
      .filter((c) => pagamentoDe(c.id, comp) || (c.ativa && (c.inicio || "0000-00-00") <= comp))
      .map((c) => {
        const pg = pagamentoDe(c.id, comp);
        return { ...c, pagamento: pg || null, valorMes: pg ? Number(pg.valor_pago) : Number(c.valor), status: statusDe(c, comp, pg) };
      })
      .sort((a, b) => a.dia_vencimento - b.dia_vencimento || a.nome.localeCompare(b.nome));
  }

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
    renderProximas(lista);
    renderListaMes(lista);
    renderCategorias(lista);
    renderDivisao(lista);
    renderHistorico();
    renderCadastroContas();
    renderCadastroRendas();
  }

  let totalAnterior = null;
  function renderHero(lista) {
    const total = soma(lista, (c) => c.valorMes);
    const pago = soma(lista.filter((c) => c.pagamento), (c) => c.valorMes);
    const pct = total ? Math.round((pago / total) * 100) : 0;
    const renda = soma(estado.rendas.filter((r) => r.ativa), (r) => r.valor);
    const pctRenda = renda ? Math.round((total / renda) * 100) : null;
    const R = 26, C = 2 * Math.PI * R;
    $("#hero").innerHTML = `
      <div class="hero-topo">
        <div>
          <div class="rotulo">Contas fixas de ${esc(nomeMes(estado.mes, "mes"))}
            <button class="olho" id="btn-olho" aria-label="${ocultar ? "Mostrar valores" : "Esconder valores"}" aria-pressed="${ocultar}">${svg(ocultar ? "olhoFechado" : "olho")}</button>
          </div>
          <div class="grande" id="hero-total">${fmt(total)}</div>
        </div>
        <div class="rosca" role="img" aria-label="${pct}% pago">
          <svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="${R}" class="trilho-r"/>
            <circle cx="32" cy="32" r="${R}" class="arco-r" stroke-dasharray="${C}" stroke-dashoffset="${C}" data-alvo="${C * (1 - pct / 100)}"/></svg>
          <span>${pct}%<small>pago</small></span>
        </div>
      </div>
      <div class="duas">
        <div><small>Já pago</small><b>${fmt(pago)}</b></div>
        <div><small>Falta pagar</small><b>${fmt(total - pago)}</b></div>
      </div>
      <div class="renda-linha">${renda
        ? `<span><b>${pctRenda}%</b> da renda do casal</span><span>Sobram ${fmt(renda - total)}</span>`
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
          <div class="meta">Dia ${c.dia_vencimento} · ${esc(c.categoria)} · ${esc(c.responsavel)}</div>
        </div>
        <div class="dir">
          <span class="valor">${fmt(c.valorMes)}</span>
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

  function renderListaMes(lista) {
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
    const ativas = contas.filter((c) => c.ativa);
    $("#cad-contas").innerHTML = contas.length
      ? contas.map((c) => `
        <li class="${c.ativa ? "" : "inativa"}">
          <button class="item" data-editar-conta="${c.id}">
            ${bolaIcone(c)}
            <div><div class="nome">${esc(c.nome)}${c.ativa ? "" : ' <span class="badge inativa">Inativa</span>'}</div>
            <div class="meta">Dia ${c.dia_vencimento} · ${esc(c.categoria)} · ${esc(c.responsavel)}${c.forma_pagamento ? " · " + esc(c.forma_pagamento) : ""}</div></div>
            <span class="valor">${fmt(c.valor)}</span><span class="seta">›</span>
          </button>
        </li>`).join("") + `<li class="total"><span>Total mensal (ativas)</span><span>${fmt(soma(ativas, (c) => c.valor))}</span></li>`
      : vazio("lista", "Nenhuma conta fixa", "Toque em + para cadastrar a primeira.", ["nova-conta", "Nova conta"]);
  }

  function renderCadastroRendas() {
    const rendas = [...estado.rendas].sort((a, b) => b.ativa - a.ativa);
    $("#cad-rendas").innerHTML = rendas.length
      ? rendas.map((r) => `
        <li class="${r.ativa ? "" : "inativa"}">
          <button class="item" data-editar-renda="${r.id}">
            <span class="bola-cat" aria-hidden="true">${svg("moeda")}</span>
            <div><div class="nome">${esc(r.descricao)}${r.ativa ? "" : ' <span class="badge inativa">Inativa</span>'}</div><div class="meta">${esc(r.responsavel)}</div></div>
            <span class="valor">${fmt(r.valor)}</span><span class="seta">›</span>
          </button>
        </li>`).join("") + `<li class="total"><span>Total mensal (ativas)</span><span>${fmt(soma(rendas.filter((r) => r.ativa), (r) => r.valor))}</span></li>`
      : vazio("moeda", "Nenhuma renda cadastrada", "Com as rendas, o painel mostra quanto sobra depois das contas.", ["nova-renda", "Nova renda"]);
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
      } else {
        const novo = await db.inserir("pagamentos", {
          conta_id: contaId, competencia: estado.mes, valor_pago: conta.valor,
          pago_em: hojeISO(), pago_por: estado.usuario.nome.replace(" (demo)", "")
        });
        estado.pagamentos.push(novo);
        render();
        animarPago(contaId);
        toast(`${conta.nome} marcada como paga`, { rotulo: "Desfazer", acao: () => removerPagamento(novo) });
      }
    } catch (e) { erro(e); }
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
  function abrirConta(id) {
    const f = $("#form-conta");
    f.reset();
    editandoConta = id ? estado.contas.find((c) => c.id === id) : null;
    $("#titulo-modal-conta").textContent = editandoConta ? "Editar conta" : "Nova conta";
    $("#btn-excluir-conta").hidden = !editandoConta;
    const c = editandoConta || { ativa: true, responsavel: "Casal", inicio: estado.mes };
    ["nome", "valor", "dia_vencimento", "categoria", "responsavel", "forma_pagamento", "observacao"].forEach((k) => (f.elements[k].value = c[k] ?? ""));
    if (!editandoConta) f.elements.responsavel.value = "Casal";
    f.elements.inicio.value = (c.inicio || estado.mes).slice(0, 7);
    f.elements.ativa.checked = !!c.ativa;
    $("#modal-conta").showModal();
  }

  async function salvarConta(ev) {
    ev.preventDefault();
    const f = ev.target.elements;
    const dados = {
      nome: f.nome.value.trim(), valor: Number(f.valor.value), dia_vencimento: Number(f.dia_vencimento.value),
      categoria: f.categoria.value.trim(), responsavel: f.responsavel.value,
      forma_pagamento: f.forma_pagamento.value.trim() || null, observacao: f.observacao.value.trim() || null,
      inicio: f.inicio.value + "-01", ativa: f.ativa.checked
    };
    try {
      if (editandoConta) Object.assign(editandoConta, await db.atualizar("contas", editandoConta.id, dados));
      else estado.contas.push(await db.inserir("contas", dados));
      $("#modal-conta").close();
      toast("Conta salva");
      render();
    } catch (e) { erro(e); }
  }

  async function excluirConta() {
    if (!editandoConta) return;
    if (!confirm(`Excluir “${editandoConta.nome}” e todo o histórico de pagamentos dela?\n\nDica: se ela só deixou de existir, desmarque “Conta ativa” para manter o histórico.`)) return;
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
    $("#btn-excluir-renda").hidden = !editandoRenda;
    const r = editandoRenda || { ativa: true, responsavel: PESSOAS[0] };
    f.elements.descricao.value = r.descricao || "";
    f.elements.valor.value = r.valor ?? "";
    f.elements.responsavel.value = r.responsavel;
    f.elements.ativa.checked = !!r.ativa;
    $("#modal-renda").showModal();
  }

  async function salvarRenda(ev) {
    ev.preventDefault();
    const f = ev.target.elements;
    const dados = { descricao: f.descricao.value.trim(), valor: Number(f.valor.value), responsavel: f.responsavel.value, ativa: f.ativa.checked };
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
    a.download = `financas-casal-${hojeISO()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ================================================================
  // EVENTOS / UTILIDADES
  // ================================================================
  function preencherSelects() {
    const ops = (lista) => lista.map((p) => `<option>${esc(p)}</option>`).join("");
    $("#sel-responsavel-conta").innerHTML = ops(RESPONSAVEIS);
    $("#sel-responsavel-renda").innerHTML = ops(RESPONSAVEIS);
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
    $("#form-login").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const f = ev.target.elements;
      $("#login-erro").textContent = "";
      const { error } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.senha.value });
      if (error) { $("#login-erro").textContent = "E-mail ou senha incorretos."; return; }
      await validarMembro();
    });
    $("#btn-esqueci").addEventListener("click", async () => {
      const email = $("#form-login").elements.email.value.trim();
      if (!email) { $("#login-erro").textContent = "Digite seu e-mail acima primeiro."; return; }
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
      $("#login-erro").textContent = error ? error.message : "Se o e-mail existir, você receberá um link para criar nova senha.";
    });
    $("#btn-sair").addEventListener("click", () => (DEMO ? toast("No modo demonstração não há login.") : sb.auth.signOut()));

    $("#mes-anterior").addEventListener("click", () => { estado.mes = somaMes(estado.mes, -1); render(); });
    $("#mes-proximo").addEventListener("click", () => { estado.mes = somaMes(estado.mes, 1); render(); });

    $$(".tabbar button").forEach((b) => b.addEventListener("click", () => irPara(b.dataset.aba)));

    segmento("#filtro-status", "f", (f) => { estado.filtro = f; renderListaMes(contasDoMes(estado.mes)); });
    segmento("#seg-analise", "a", (a) => $$(".painel-analise").forEach((p) => (p.hidden = p.dataset.painel !== a)));
    segmento("#seg-cadastro", "c", (c) => { cadastroAtual = c; $$(".painel-cadastro").forEach((p) => (p.hidden = p.dataset.painel !== c)); });

    $("#btn-add-cadastro").addEventListener("click", () => (cadastroAtual === "rendas" ? abrirRenda() : abrirConta()));

    document.addEventListener("click", (ev) => {
      const t = ev.target.closest("[data-pagar],[data-editar-conta],[data-editar-renda],[data-fechar],[data-ir],[data-acao]");
      if (!t) return;
      if (t.dataset.pagar) alternarPagamento(t.dataset.pagar);
      else if (t.dataset.editarConta) abrirConta(t.dataset.editarConta);
      else if (t.dataset.editarRenda) abrirRenda(t.dataset.editarRenda);
      else if (t.dataset.ir) irPara(t.dataset.ir);
      else if (t.dataset.acao === "nova-conta") abrirConta();
      else if (t.dataset.acao === "nova-renda") abrirRenda();
      else if (t.hasAttribute("data-fechar")) t.closest("dialog").close();
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

    $("#form-conta").addEventListener("submit", salvarConta);
    $("#form-renda").addEventListener("submit", salvarRenda);
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
    const rendas = [
      { id: uid(), descricao: "Salário", valor: 7500, responsavel: p1, ativa: true },
      { id: uid(), descricao: "Salário", valor: 6000, responsavel: p2, ativa: true }
    ];
    return { contas, pagamentos, rendas };
  }

  iniciar();
})();
