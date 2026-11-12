/* Finanças do Casal — Tutorial do app. */
"use strict";

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
    itens: ["Toque no quadrado para marcar como paga — só isso, não precisa mexer no cadastro", "No mês seguinte ela volta sozinha como “a pagar”", "Conta de um mês só (uma fatura, IPVA)? Escolha “Só neste mês” no cadastro", "Errou? Aparece “Desfazer” por 5 segundos", "Contas que mudam de valor (luz, água, cartão): toque no valor (✎) para informar quanto veio no mês, mesmo antes de pagar", "Cancelou algo (ex.: Netflix)? Abra a conta e toque em “Encerrar conta”"] },
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
