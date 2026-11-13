/* Plinc — Carregar dados e cálculos do mês. */
"use strict";

// ================================================================
// CARREGAR E CALCULAR
// ================================================================
/** Busca tudo no banco. silencioso: atualização automática (sem tutorial). Devolve true se deu certo. */
async function carregar({ silencioso = false } = {}) {
  try {
    const opcional = (t, flag) => db.listar(t).catch((e) => { if (ehErroDeRede(e)) throw e; console.warn(t, e); estado[flag] = false; return []; });
    estado.migracao2 = true; estado.migracao3 = true; estado.migracao6 = true;
    const [contas, pagamentos, rendas, gastos, orcamentos, metas, aportes, cartoes, faturas_pagas, valores_mes] = await Promise.all([
      db.listar("contas"), db.listar("pagamentos"), db.listar("rendas"),
      opcional("gastos", "migracao2"), opcional("orcamentos", "migracao2"),
      opcional("metas", "migracao3"), opcional("aportes", "migracao3"), opcional("cartoes", "migracao3"), opcional("faturas_pagas", "migracao3"),
      opcional("valores_mes", "migracao6")
    ]);
    Object.assign(estado, { contas, pagamentos, rendas, gastos, orcamentos, metas, aportes, cartoes, faturas_pagas, valores_mes });
    estado.migracao4 = DEMO ? true : contas.length ? "fim" in contas[0] : !(await sb.from("contas").select("fim").limit(1)).error;
    if (!DEMO && estado.familia) {
      const [mb, cv] = await Promise.all([db.listar("membros").catch(() => []), db.listar("convites").catch(() => [])]);
      estado.membrosFamilia = mb; estado.convites = cv;
    }
    estado.doCache = false; estado.salvoEm = new Date().toISOString();
    modoOffline(false);
    cacheLocal.salvar();
    aoVivo.carregadoEm = Date.now();
    render();
    esconderSplash();
    if (!silencioso && !lerPref("tutorial-visto", false)) setTimeout(() => abrirTutorial(0), 500);
    return true;
  } catch (e) {
    esconderSplash();
    if (!DEMO && ehErroDeRede(e)) {
      if (estado.doCache || silencioso) { modoOffline(true); return false; }   // segue mostrando os dados que já estão na tela
      toast("Sem internet: não foi possível carregar os dados. Tente de novo quando a conexão voltar.");
      return false;
    }
    console.error(e);
    toast("Não foi possível carregar os dados: " + (e.message || e));
    return false;
  }
}

const pagamentoDe = (contaId, comp) => estado.pagamentos.find((p) => p.conta_id === contaId && p.competencia === comp);

/** Contas que valem para a competência: ativas e iniciadas até o mês, ou que tenham pagamento registrado nele. */
function contasDoMes(comp) {
  return estado.contas
    .filter((c) => pagamentoDe(c.id, comp) || (c.ativa && (c.inicio || "0000-00-00") <= comp && (!c.fim || comp <= c.fim)))
    .map((c) => {
      const pg = pagamentoDe(c.id, comp);
      // conta de valor variável em mês futuro: não projeta valor ("a definir") e não soma no total
      // (no primeiro mês da conta vale o valor que a pessoa cadastrou: é o valor real daquele mês)
      const primeiroMes = (c.inicio || "").slice(0, 7) === comp.slice(0, 7);
      // valor informado para o mês (ex.: a fatura de dezembro) vale mais que qualquer estimativa
      const vm = !pg && c.variavel ? valorInformado(c.id, comp) : null;
      const aDefinir = !pg && !vm && !!c.variavel && comp > compDe(new Date()) && !primeiroMes;
      const prev = !pg && !vm && c.variavel && !aDefinir && !primeiroMes ? previsaoVariavel(c, comp) : null;
      return { ...c, pagamento: pg || null, estimado: prev !== null, aDefinir, informado: !!vm,
        valorMes: pg ? Number(pg.valor_pago) : vm ? Number(vm.valor) : aDefinir ? 0 : prev ?? Number(c.valor), status: statusDe(c, comp, pg) };
    })
    .sort((a, b) => a.dia_vencimento - b.dia_vencimento || a.nome.localeCompare(b.nome));
}

const valorInformado = (contaId, comp) => estado.valores_mes.find((v) => v.conta_id === contaId && v.competencia === comp) || null;

/** Média dos últimos 3 pagamentos antes do mês; sem histórico, o valor cadastrado. */
function previsaoVariavel(conta, comp) {
  const ult = estado.pagamentos.filter((p) => p.conta_id === conta.id && p.competencia < comp)
    .sort((a, b) => b.competencia.localeCompare(a.competencia)).slice(0, 3);
  return ult.length ? Math.round((soma(ult, (p) => p.valor_pago) / ult.length) * 100) / 100 : Number(conta.valor);
}

const gastosDoMes = (comp) => estado.gastos.filter((g) => g.data.slice(0, 7) === comp.slice(0, 7));

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
