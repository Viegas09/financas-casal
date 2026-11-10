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
  const fmt = (v) => brl.format(Number(v) || 0);
  const brlCurto = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 });
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
    } catch (e) {
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

  function renderHero(lista) {
    const total = soma(lista, (c) => c.valorMes);
    const pago = soma(lista.filter((c) => c.pagamento), (c) => c.valorMes);
    const pct = total ? Math.round((pago / total) * 100) : 0;
    const renda = soma(estado.rendas.filter((r) => r.ativa), (r) => r.valor);
    const pctRenda = renda ? Math.round((total / renda) * 100) : null;
    $("#hero").innerHTML = `
      <div class="rotulo">Contas fixas de ${esc(nomeMes(estado.mes, "mes"))}</div>
      <div class="grande">${fmt(total)}</div>
      <div class="meter" role="img" aria-label="${pct}% pago"><span style="width:${pct}%"></span></div>
      <div class="duas">
        <div><small>Já pago · ${pct}%</small><b>${fmt(pago)}</b></div>
        <div><small>Falta pagar</small><b>${fmt(total - pago)}</b></div>
      </div>
      <div class="renda-linha">${renda
        ? `<span><b>${pctRenda}%</b> da renda do casal</span><span>Sobram ${fmt(renda - total)}</span>`
        : `<span>Cadastre as rendas em Mais → Rendas para ver quanto sobra</span>`}</div>`;
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
        <button class="pagar ${c.pagamento ? "on" : ""}" data-pagar="${c.id}" aria-label="${c.pagamento ? "Desmarcar pagamento de" : "Marcar como paga:"} ${esc(c.nome)}" title="${esc(titulo)}">${c.pagamento ? "✓" : ""}</button>
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
      : `<li class="vazio">${estado.contas.length ? "Nenhuma conta pendente neste mês 🎉" : "Toque em + para cadastrar a primeira conta."}</li>`;
  }

  function renderListaMes(lista) {
    const f = estado.filtro;
    const itens = lista.filter((c) => f === "todas" || (f === "pagas" ? c.pagamento : !c.pagamento));
    $("#lista-mes").innerHTML = itens.length
      ? itens.map(itemConta).join("")
      : `<li class="vazio">${!estado.contas.length ? "Nenhuma conta cadastrada. Toque em + para começar." : f === "pendentes" ? "Nada a pagar neste mês 🎉" : "Nenhuma conta aqui."}</li>`;
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
      : `<p class="vazio">Sem contas neste mês.</p>`;
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
            <div><div class="nome">${esc(c.nome)}${c.ativa ? "" : ' <span class="badge inativa">Inativa</span>'}</div>
            <div class="meta">Dia ${c.dia_vencimento} · ${esc(c.categoria)} · ${esc(c.responsavel)}${c.forma_pagamento ? " · " + esc(c.forma_pagamento) : ""}</div></div>
            <span class="valor">${fmt(c.valor)}</span><span class="seta">›</span>
          </button>
        </li>`).join("") + `<li class="total"><span>Total mensal (ativas)</span><span>${fmt(soma(ativas, (c) => c.valor))}</span></li>`
      : `<li class="vazio">Nenhuma conta ainda. Toque em + para cadastrar.</li>`;
  }

  function renderCadastroRendas() {
    const rendas = [...estado.rendas].sort((a, b) => b.ativa - a.ativa);
    $("#cad-rendas").innerHTML = rendas.length
      ? rendas.map((r) => `
        <li class="${r.ativa ? "" : "inativa"}">
          <button class="item" data-editar-renda="${r.id}">
            <div><div class="nome">${esc(r.descricao)}${r.ativa ? "" : ' <span class="badge inativa">Inativa</span>'}</div><div class="meta">${esc(r.responsavel)}</div></div>
            <span class="valor">${fmt(r.valor)}</span><span class="seta">›</span>
          </button>
        </li>`).join("") + `<li class="total"><span>Total mensal (ativas)</span><span>${fmt(soma(rendas.filter((r) => r.ativa), (r) => r.valor))}</span></li>`
      : `<li class="vazio">Nenhuma renda ainda. Toque em + para cadastrar.</li>`;
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
        toast(`${conta.nome}: pagamento desmarcado`);
      } else {
        const novo = await db.inserir("pagamentos", {
          conta_id: contaId, competencia: estado.mes, valor_pago: conta.valor,
          pago_em: hojeISO(), pago_por: estado.usuario.nome.replace(" (demo)", "")
        });
        estado.pagamentos.push(novo);
        toast(`${conta.nome} marcada como paga ✓`);
      }
      render();
    } catch (e) { erro(e); }
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
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 2800);
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
