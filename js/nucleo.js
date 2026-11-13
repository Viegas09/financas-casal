/* Plinc — Configuração, utilidades, ícones, datas, camada de dados (Supabase / demonstração) e estado. */
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

// ---------- Sem internet ----------
const MSG_SEM_REDE = "Sem internet: não deu para salvar. Tente de novo quando a conexão voltar.";
const ehErroDeRede = (e) => !navigator.onLine || e?.rede || e?.name === "AuthRetryableFetchError" ||
  /failed to fetch|networkerror|load failed|network request failed|internet connection/i.test(String(e?.message || e || ""));
/** Antes de gravar: sem internet, avisa em vez de tentar. Depois: erro de rede vira mensagem clara; sucesso atualiza a cópia do aparelho. */
const exigirRede = () => { if (!navigator.onLine) throw Object.assign(new Error(MSG_SEM_REDE), { rede: true }); };
const falhou = (error) => (ehErroDeRede(error) ? Object.assign(new Error(MSG_SEM_REDE), { rede: true }) : error);

const db = {
  async listar(tabela) {
    if (DEMO) return structuredClone(demoDB()[tabela] || []);
    const { data, error } = await sb.from(tabela).select("*");
    if (error) throw error;
    return data;
  },
  async inserir(tabela, linha) {
    if (DEMO) { const r = { id: uid(), ...linha }; (demoDB()[tabela] ||= []).push(r); demoStore.gravar(demoDB()); return r; }
    exigirRede();
    const { data, error } = await sb.from(tabela).insert(linha).select().single();
    if (error) throw falhou(error);
    salvarCacheDepois();
    return data;
  },
  async inserirVarios(tabela, linhas) {
    if (!linhas.length) return [];
    if (DEMO) { const rs = linhas.map((l) => ({ id: uid(), ...l })); (demoDB()[tabela] ||= []).push(...rs); demoStore.gravar(demoDB()); return rs; }
    exigirRede();
    const { data, error } = await sb.from(tabela).insert(linhas).select();
    if (error) throw falhou(error);
    salvarCacheDepois();
    return data;
  },
  async atualizar(tabela, id, campos) {
    if (DEMO) { const r = demoDB()[tabela].find((x) => x.id === id); Object.assign(r, campos); demoStore.gravar(demoDB()); return r; }
    exigirRede();
    const { data, error } = await sb.from(tabela).update(campos).eq("id", id).select().single();
    if (error) throw falhou(error);
    salvarCacheDepois();
    return data;
  },
  async remover(tabela, id) {
    if (DEMO) { const t = demoDB()[tabela]; t.splice(t.findIndex((x) => x.id === id), 1); demoStore.gravar(demoDB()); return; }
    exigirRede();
    const { error } = await sb.from(tabela).delete().eq("id", id);
    if (error) throw falhou(error);
    salvarCacheDepois();
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
  valores_mes: [],
  migracao6: true,        // tabela valores_mes (valor informado de conta variável) existe?
  mes: compDe(new Date()),
  filtro: "pendentes"
};
