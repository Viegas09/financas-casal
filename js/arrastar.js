/* Plinc — Arrastar para excluir, trava de envio, avisos (toast). */
"use strict";

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
