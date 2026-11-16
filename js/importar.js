/* Plinc — Importar extrato do banco (OFX / CSV). */
"use strict";

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
    return { i, ...l, valor, bruto: l.valor, motivo, categoria: sugerirCategoria(l.descricao, cats), dup: !!dup, dupId: dup ? dup.id : null };
  });
  // parece fatura de cartão? (OFX de cartão, nome do arquivo ou linha de pagamento de fatura)
  const pareceCartao = lido.cartao || /fatura|cart[aã]o|credit/i.test(nome) || lido.linhas.some((l) => /pagamento (recebido|de fatura|da fatura)/.test(semAcento(l.descricao)));
  importacao = { nome, cartao: pareceCartao, linhas, sinalGasto, cats };
  aplicarSinal();
  preencherFormaImp();
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

/** Opções de "Esses gastos foram no" e o aviso para cadastrar o cartão quando ainda não há nenhum. */
function preencherFormaImp(selecionar = null) {
  const cartoes = estado.migracao3 ? estado.cartoes.filter((c) => c.ativo) : [];
  $("#imp-forma").innerHTML = `<option value="">Pix ou débito</option>` + cartoes.map((c) => `<option value="cartao:${c.id}">💳 Cartão ${esc(c.nome)}</option>`).join("");
  if (selecionar) $("#imp-forma").value = "cartao:" + selecionar;
  else if (importacao.cartao && cartoes.length === 1) $("#imp-forma").value = "cartao:" + cartoes[0].id;
  const aviso = $("#imp-aviso-cartao");
  aviso.hidden = !estado.migracao3 || cartoes.length > 0;
  aviso.innerHTML = `<span>${importacao.cartao ? "<b>Parece uma fatura de cartão.</b> " : "<b>É fatura de cartão?</b> "}Cadastre o cartão (dia de fechamento e vencimento) e escolha ele aqui: assim a fatura aparece em Contas para vocês marcarem como paga.</span>
    <button type="button" class="btn btn-primary" data-acao="novo-cartao">Cadastrar cartão</button>`;
  marcarMovidos();
}

const cartaoDaImportacao = () => { const f = $("#imp-forma").value; return f.startsWith("cartao:") ? estado.cartoes.find((c) => c.id === f.slice(7)) : null; };

/** Com um cartão escolhido, o que já foi lançado como Pix/débito (ex.: importado antes sem cartão) vai para o cartão. */
function marcarMovidos() {
  const cartao = cartaoDaImportacao();
  importacao.linhas.forEach((l) => {
    const g = l.dupId && estado.gastos.find((x) => x.id === l.dupId);
    l.mover = !!(cartao && g && !g.cartao_id && !l.entrada);
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
        <div class="imp-meta">${esc(fmtData(l.data, { day: "numeric", month: "short" }))}${l.entrada ? ' · <span class="badge futura">entrada</span>' : ""}${l.motivo.map((m) => m === "já lançado" && l.mover ? ` · <span class="badge futura">já lançado · vai para o cartão</span>` : ` · <span class="badge ${m === "já lançado" ? "paga" : "breve"}">${esc(m)}</span>`).join("")}</div>
        ${l.entrada ? "" : `<select class="imp-cat" data-imp-cat="${l.i}">${opcoes(l.categoria)}</select>`}
      </div>
      <span class="imp-valor ${l.entrada ? "bom-txt" : ""}">${l.entrada ? "+" : "−"}${brl.format(l.valor)}</span>
    </li>`).join("");
  atualizarResumoImp();
}

function atualizarResumoImp() {
  const sel = importacao.linhas.filter((l) => l.marcado);
  const ign = importacao.linhas.filter((l) => !l.marcado && !l.entrada);
  const mov = movidosDaImportacao();
  const cartao = cartaoDaImportacao();
  $("#imp-resumo").innerHTML = `<b>${sel.length}</b> gasto${sel.length !== 1 ? "s" : ""} selecionado${sel.length !== 1 ? "s" : ""} · <b>${brl.format(soma(sel, (l) => l.valor))}</b>
    <small>${importacao.linhas.length} lançamentos no arquivo${ign.length ? ` · ${ign.length} desmarcado${ign.length > 1 ? "s" : ""} (repetidos, pagamentos ou contas fixas)` : ""}</small>
    ${mov.length ? `<small>↪ <b>${mov.length}</b> já lançado${mov.length > 1 ? "s" : ""} sem cartão ${mov.length > 1 ? "vão" : "vai"} para o cartão ${esc(cartao.nome)}</small>` : ""}`;
  const partes = [];
  if (sel.length) partes.push(`Importar ${sel.length} gasto${sel.length > 1 ? "s" : ""}`);
  if (mov.length) partes.push(`${sel.length ? "mover" : "Mover"} ${mov.length} para o cartão`);
  $("#imp-confirmar").textContent = partes.length ? partes.join(" e ") : "Nada selecionado";
  $("#imp-confirmar").disabled = !partes.length;
}

/** Gastos já lançados (sem cartão) que serão movidos para o cartão escolhido — sem repetir o mesmo gasto. */
function movidosDaImportacao() {
  const ids = new Set();
  importacao.linhas.forEach((l) => { if (l.mover && !l.marcado) ids.add(l.dupId); });
  return [...ids].map((id) => estado.gastos.find((g) => g.id === id)).filter(Boolean);
}

async function confirmarImportacao() {
  const sel = importacao.linhas.filter((l) => l.marcado);
  const cartao = cartaoDaImportacao();
  const mover = cartao ? movidosDaImportacao() : [];
  if (!sel.length && !mover.length) return;
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
    // move para o cartão o que já estava lançado sem cartão
    const antes = mover.map((g) => ({ g, forma_pagamento: g.forma_pagamento, parcelas: g.parcelas }));
    for (const g of mover) Object.assign(g, await db.atualizar("gastos", g.id, { cartao_id: cartao.id, forma_pagamento: "Cartão " + cartao.nome }));
    $("#modal-importar").close();
    render();
    const meses = [...new Set(linhas.map((l) => l.data.slice(0, 7)))];
    const msg = [novos.length ? `${novos.length} gasto${novos.length > 1 ? "s" : ""} importado${novos.length > 1 ? "s" : ""}${meses.length > 1 ? ` (${meses.length} meses)` : ""}` : "",
      mover.length ? `${mover.length} movido${mover.length > 1 ? "s" : ""} para o cartão ${cartao.nome}` : ""].filter(Boolean).join(" · ");
    toast(msg, { rotulo: "Desfazer", acao: async () => {
      try {
        for (const g of novos) await db.remover("gastos", g.id);
        const ids = new Set(novos.map((g) => g.id));
        estado.gastos = estado.gastos.filter((g) => !ids.has(g.id));
        for (const a of antes) Object.assign(a.g, await db.atualizar("gastos", a.g.id, { cartao_id: null, forma_pagamento: a.forma_pagamento }));
        render(); toast("Importação desfeita");
      } catch (e) { erro(e); }
    } });
    irPara("gastos"); mostrarSubGastos(cartao ? "cartoes" : "extrato");
  } catch (e) { erro(e); btn.disabled = false; atualizarResumoImp(); }
}

function ligarImportar() {
  $("#imp-file").addEventListener("change", (ev) => arquivoEscolhido(ev.target.files[0]));
  $("#imp-voltar").addEventListener("click", () => { $("#imp-passo1").hidden = false; $("#imp-passo2").hidden = true; $("#imp-file").value = ""; });
  $("#imp-confirmar").addEventListener("click", confirmarImportacao);
  $("#imp-forma").addEventListener("change", () => { if (!importacao) return; marcarMovidos(); desenharImportacao(); });
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
