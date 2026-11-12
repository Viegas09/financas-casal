/* Finanças do Casal — Metas e aportes. */
"use strict";

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
