/* Plinc — Lembretes de vencimento no calendário do celular (arquivo .ics).
 * Cada conta vira um evento de dia inteiro que se repete todo mês no dia do vencimento,
 * com aviso na véspera e no dia, às 9h. Dias 29, 30 e 31 caem no último dia em meses mais curtos.
 * Contas pagas no cartão ficam de fora (entram na fatura do cartão).
 */
"use strict";

let calQuem = "todas";

const icsEsc = (t) => String(t ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
/** Linhas longas são quebradas (o padrão pede no máximo 75 bytes por linha). */
const icsDobrar = (linha) => { const p = []; let l = linha; while (l.length > 60) { p.push(l.slice(0, 60)); l = " " + l.slice(60); } p.push(l); return p.join("\r\n"); };
const icsData = (iso) => iso.replace(/-/g, "");
const ultimoDiaDoMes = (a, m) => new Date(a, m, 0).getDate();

/** Regra de repetição mensal. Ex.: dia 31 → 28,29,30,31 com BYSETPOS=-1 (o último que existir no mês). */
function regraMensal(dia) {
  if (dia <= 28) return `FREQ=MONTHLY;BYMONTHDAY=${dia}`;
  const dias = []; for (let d = 28; d <= dia; d++) dias.push(d);
  return `FREQ=MONTHLY;BYMONTHDAY=${dias.join(",")};BYSETPOS=-1`;
}

/** Data do vencimento numa competência ("AAAA-MM-01"), respeitando meses curtos. */
function vencimentoEm(comp, dia) {
  const [a, m] = comp.split("-").map(Number);
  return `${a}-${pad(m)}-${pad(Math.min(dia, ultimoDiaDoMes(a, m)))}`;
}

function evento({ uid, titulo, lembrete, descricao, inicio, regra, ate, agora }) {
  const fim = new Date(inicio + "T12:00:00"); fim.setDate(fim.getDate() + 1);
  const fimISO = `${fim.getFullYear()}-${pad(fim.getMonth() + 1)}-${pad(fim.getDate())}`;
  const l = ["BEGIN:VEVENT", `UID:${uid}`, `DTSTAMP:${agora}`, `SEQUENCE:${Math.floor(Date.now() / 60000) % 2147483647}`,
    `DTSTART;VALUE=DATE:${icsData(inicio)}`, `DTEND;VALUE=DATE:${icsData(fimISO)}`,
    `SUMMARY:${icsEsc(titulo)}`, `DESCRIPTION:${icsEsc(descricao)}`, "TRANSP:TRANSPARENT"];
  if (regra) l.push(`RRULE:${regra}${ate ? ";UNTIL=" + icsData(ate) : ""}`);
  l.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsEsc("Amanhã vence: " + lembrete)}`, "TRIGGER:-PT15H", "END:VALARM");
  l.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsEsc("Hoje vence: " + lembrete)}`, "TRIGGER:PT9H", "END:VALARM");
  l.push("END:VEVENT");
  return l;
}

/** Contas e cartões que entram no calendário. quem: "todas" ou "minhas" (minhas + do casal). */
function itensDoCalendario(quem = "todas", comCartoes = true) {
  const hoje = compDe(new Date());
  const eu = (estado.usuario?.nome || "").replace(" (demo)", "");
  const meu = (r) => quem === "todas" || r === "Casal" || r === eu;
  const contas = estado.contas.filter((c) => c.ativa && !c.cartao_id && (!c.fim || c.fim.slice(0, 7) >= hoje.slice(0, 7)) && meu(c.responsavel));
  const cartoes = comCartoes ? estado.cartoes.filter((c) => c.ativo !== false && meu(c.responsavel)) : [];
  return { contas, cartoes };
}

/** Monta o arquivo .ics (texto). */
function gerarICS({ contas, cartoes }) {
  const d = new Date();
  const agora = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  const hoje = compDe(new Date());
  const linhas = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Plinc//Vencimentos//PT-BR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "X-WR-CALNAME:Plinc · vencimentos", "X-WR-TIMEZONE:America/Sao_Paulo"];
  for (const c of contas) {
    const inicioComp = ((c.inicio || hoje).slice(0, 7) > hoje.slice(0, 7) ? c.inicio.slice(0, 7) : hoje.slice(0, 7)) + "-01";
    const primeiro = vencimentoEm(inicioComp, c.dia_vencimento);
    const soUmMes = c.fim && c.fim.slice(0, 7) === inicioComp.slice(0, 7);
    const ate = c.fim && !soUmMes ? vencimentoEm(c.fim.slice(0, 7) + "-01", c.dia_vencimento) : null;
    const valor = c.variavel ? "valor varia" : fmt(Number(c.valor)).replace(/\u00a0/g, " ");
    linhas.push(...evento({
      uid: `conta-${c.id}@plinc`, agora, inicio: primeiro, ate,
      regra: soUmMes ? null : regraMensal(c.dia_vencimento),
      titulo: `Vence: ${c.nome} (${valor})`, lembrete: `${c.nome} (${valor})`,
      descricao: `${c.categoria || "Conta"} · quem paga: ${c.responsavel}.${c.variavel ? " O valor muda todo mês: confira no Plinc." : ""} Marque como paga no Plinc.`
    }));
  }
  for (const k of cartoes) {
    linhas.push(...evento({
      uid: `cartao-${k.id}@plinc`, agora, inicio: vencimentoEm(hoje, k.dia_vencimento), regra: regraMensal(k.dia_vencimento),
      titulo: `Vence: fatura do ${k.nome}`, lembrete: `fatura do ${k.nome}`,
      descricao: `Fatura do cartão ${k.nome} · quem paga: ${k.responsavel}. Veja o valor da fatura no Plinc.`
    }));
  }
  linhas.push("END:VCALENDAR");
  return linhas.map(icsDobrar).join("\r\n") + "\r\n";
}

function atualizarResumoCalendario() {
  const { contas, cartoes } = itensDoCalendario(calQuem, $("#form-calendario").elements.cartoes.checked);
  const partes = [`${contas.length} conta${contas.length !== 1 ? "s" : ""}`];
  if (cartoes.length) partes.push(`${cartoes.length} fatura${cartoes.length !== 1 ? "s" : ""} de cartão`);
  $("#cal-resumo").textContent = contas.length + cartoes.length ? `Vão entrar ${partes.join(" e ")}.` : "Nenhuma conta para lembrar com essa escolha.";
  $("#cal-baixar").disabled = !(contas.length + cartoes.length);
}

function abrirCalendario() {
  calQuem = "todas";
  $$("#seg-cal-quem button").forEach((b) => b.classList.toggle("ativo", b.dataset.q === "todas"));
  $("#seg-cal-quem").hidden = PESSOAS.length < 2;
  $("#lbl-cal-cartoes").hidden = !estado.cartoes.some((c) => c.ativo !== false);
  atualizarResumoCalendario();
  $("#modal-calendario").showModal();
}

function baixarCalendario(ev) {
  ev.preventDefault();
  const ics = gerarICS(itensDoCalendario(calQuem, $("#form-calendario").elements.cartoes.checked));
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  a.download = "plinc-vencimentos.ics";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  $("#modal-calendario").close();
  toast("Arquivo baixado: abra e toque em “Adicionar” no calendário");
}

function ligarCalendario() {
  segmento("#seg-cal-quem", "q", (q) => { calQuem = q; atualizarResumoCalendario(); });
  $("#form-calendario").elements.cartoes.addEventListener("change", atualizarResumoCalendario);
  $("#form-calendario").addEventListener("submit", baixarCalendario);
  $("#btn-calendario").addEventListener("click", abrirCalendario);
}
