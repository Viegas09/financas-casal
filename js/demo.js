/* Plinc — Dados de exemplo do modo demonstração. */
"use strict";

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
