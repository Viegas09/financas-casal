/* Finanças do Casal — Ligação dos botões e eventos. */
"use strict";

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
  $("#form-valor-mes").addEventListener("submit", travar(salvarValorMes));
  $("#btn-remover-valor-mes").addEventListener("click", removerValorMes);
  document.addEventListener("click", (ev) => { const b = ev.target.closest("[data-informar]"); if (b) { ev.stopPropagation(); abrirValorMes(b.dataset.informar); } }, true);
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
