import { PGlite } from "@electric-sql/pglite";
let falhas = 0;
import fs from "fs";
const R = new URL("../supabase/", import.meta.url).pathname;
const db = new PGlite();
const ok = (c, m) => { if (!c) falhas++; console.log((c ? "✅ " : "❌ ") + m); };
const q = async (sql, p) => (await db.query(sql, p)).rows;
const exec = (sql) => db.exec(sql);

// ---- simula o Supabase ----
await exec(`
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role authenticated;
  grant usage on schema public to authenticated;
  grant usage on schema auth to authenticated;
  grant execute on function auth.uid() to authenticated;
`);
await exec(fs.readFileSync(new URL("./fixtures/schema-antes-05.sql", import.meta.url).pathname, "utf8"));  // banco como está hoje em produção
await exec(`grant all on all tables in schema public to authenticated; alter default privileges in schema public grant all on tables to authenticated;`);
const [vini] = await q(`insert into auth.users (email) values ('vini@x.com') returning id`);
const [marcela] = await q(`insert into auth.users (email) values ('marcela@x.com') returning id`);
await q(`insert into membros (user_id, nome) values ($1,'Vinícius'),($2,'Marcela')`, [vini.id, marcela.id]);
await exec(`
  insert into contas (nome, categoria, valor, dia_vencimento) values ('Aluguel','Moradia',2200,5),('Luz','Energia',200,15);
  insert into gastos (descricao, valor, categoria, responsavel) values ('Mercado',300,'Mercado','Vinícius');
  insert into rendas (descricao, valor, responsavel) values ('Salário', 7000, 'Vinícius');
  insert into metas (nome, valor_alvo) values ('Reserva', 30000);
`);
const [conta1] = await q(`select id from contas where nome='Aluguel'`);
await q(`insert into pagamentos (conta_id, competencia, valor_pago) values ($1,'2026-11-01',2200)`, [conta1.id]);
const antes = (await q(`select (select count(*) from contas) c, (select count(*) from gastos) g, (select count(*) from orcamentos) o, (select count(*) from pagamentos) p`))[0];

// ---- MIGRAÇÃO 05 ----
await exec(fs.readFileSync(R + "migracao-05-familias.sql", "utf8"));
await exec(`grant all on all tables in schema public to authenticated;`);
const fam = await q(`select * from familias`);
ok(fam.length === 1 && fam[0].nome === "Vinícius & Marcela", `família criada: "${fam[0]?.nome}" pessoas=${JSON.stringify(fam[0]?.pessoas)}`);
const semFam = await q(`select (select count(*) from contas where familia_id is null)+(select count(*) from gastos where familia_id is null)+(select count(*) from orcamentos where familia_id is null) n`);
ok(Number(semFam[0].n) === 0, "todos os dados atuais ligados à família");
const mem = await q(`select nome, papel, admin, email from membros order by nome`);
ok(mem.every((m) => m.papel === "dono" && m.admin && m.email), "membros atuais viraram donos/admin com e-mail: " + mem.map((m) => m.nome + ":" + m.email).join(", "));

// helper para agir como um usuário logado
async function como(uid, fn) {
  await exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`);
  try { return await fn(); } finally { await exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); }
}
const tenta = async (fn) => { try { await fn(); return null; } catch (e) { return e.message; } };

// app de vocês continua funcionando igual
await como(vini.id, async () => {
  const d = (await q(`select (select count(*) from contas) c, (select count(*) from gastos) g, (select count(*) from orcamentos) o, (select count(*) from pagamentos) p`))[0];
  ok(JSON.stringify(d) === JSON.stringify(antes), `Vinícius vê tudo que via antes ${JSON.stringify(d)}`);
  const [n] = await q(`insert into gastos (descricao, valor, categoria, responsavel) values ('Padaria',20,'Mercado','Vinícius') returning familia_id`);
  ok(n.familia_id === fam[0].id, "gasto novo (sem informar família, como o app atual faz) cai na família certa");
  await q(`insert into convites (email, nome, familia_nome, familia_id) values ('irma@x.com','Ana','Família da Ana', null)`);
  ok(true, "admin criou convite para nova família");
});
await como(marcela.id, async () => {
  const g = await q(`select descricao from gastos`);
  ok(g.length === 2, "Marcela vê os gastos do casal (inclusive o novo do Vinícius)");
});

// cadastro sem convite é recusado
const semConvite = await tenta(() => q(`insert into auth.users (email) values ('estranho@x.com')`));
ok(semConvite && /convite/.test(semConvite), "cadastro sem convite recusado: " + semConvite);

// irmã se cadastra com convite -> família nova
const [ana] = await q(`insert into auth.users (email) values ('IRMA@x.com') returning id`);
const famAna = (await q(`select f.* from familias f join membros m on m.familia_id=f.id where m.user_id=$1`, [ana.id]))[0];
ok(famAna && famAna.nome === "Família da Ana" && famAna.id !== fam[0].id, `Ana caiu numa família nova: "${famAna?.nome}" (e-mail com maiúsculas funcionou)`);

await como(ana.id, async () => {
  const d = (await q(`select (select count(*) from contas) c, (select count(*) from gastos) g, (select count(*) from pagamentos) p, (select count(*) from rendas) r, (select count(*) from metas) m, (select count(*) from membros) mb, (select count(*) from familias) f`))[0];
  ok(d.c == 0 && d.g == 0 && d.p == 0 && d.r == 0 && d.m == 0 && d.mb == 1 && d.f == 1, "Ana NÃO vê nada do casal " + JSON.stringify(d));
  const o = await q(`select categoria from orcamentos`);
  ok(o.length === 7, "Ana começa com as 7 categorias de gasto padrão");
  await q(`insert into contas (nome, categoria, valor, dia_vencimento) values ('Aluguel Ana','Moradia',1500,10)`);
  await q(`insert into orcamentos (categoria, limite) values ('Pets', 100)`);
  ok(true, "Ana cadastra conta e categoria 'Pets' (mesmo nome de categoria pode existir em outra família)");
  const forca = await tenta(() => q(`insert into contas (nome, categoria, valor, dia_vencimento, familia_id) values ('invasão','x',1,1,$1)`, [fam[0].id]));
  ok(!!forca, "Ana não consegue gravar dados na família do casal");
  const up = await q(`update contas set valor = 0 where nome = 'Aluguel' returning id`);
  ok(up.length === 0, "Ana não consegue alterar contas do casal");
  const del = await q(`delete from gastos returning id`);
  ok(del.length === 0, "Ana não consegue apagar gastos do casal");
  const pg = await tenta(() => q(`insert into pagamentos (conta_id, competencia, valor_pago) values ($1,'2026-12-01',1)`, [conta1.id]));
  // insere com familia_id da Ana apontando para conta do casal: verificamos que o casal não enxerga
  const c1 = await tenta(() => q(`insert into convites (email, nome, familia_id) values ('x@x.com','X',$1)`, [fam[0].id]));
  ok(!!c1, "Ana não consegue convidar pessoas para a família do casal");
  const c2 = await tenta(() => q(`insert into convites (email, nome, familia_nome) values ('y@x.com','Y','Outra')`));
  ok(!!c2, "Ana (não admin) não consegue criar convite de família nova");
  await q(`insert into convites (email, nome, familia_id) values ('marido@x.com','Carlos', minha_familia())`);
  ok(true, "Ana convida o marido para a família dela");
  const updFam = await q(`update familias set nome = 'hack' where id = $1 returning id`, [fam[0].id]);
  ok(updFam.length === 0, "Ana não consegue renomear a família do casal");
});
const [carlos] = await q(`insert into auth.users (email) values ('marido@x.com') returning id`);
await como(carlos.id, async () => {
  const m = await q(`select nome, papel from membros order by nome`);
  const f = (await q(`select nome, pessoas from familias`))[0];
  ok(m.length === 2 && f.nome === "Família da Ana" && f.pessoas.includes("Carlos"), `Carlos entrou na família da Ana: ${JSON.stringify(m)} pessoas=${JSON.stringify(f.pessoas)}`);
  const c = await q(`select nome from contas`);
  ok(c.length === 1 && c[0].nome === "Aluguel Ana", "Carlos vê só as contas da família dele");
  await q(`select 1`);
  const rm = await q(`delete from membros where nome = 'Ana' returning user_id`);
  ok(rm.length === 0, "Carlos (membro) não consegue remover a Ana");
});
await como(vini.id, async () => {
  const rm = await q(`delete from membros where nome = 'Marcela' returning user_id`);
  ok(rm.length === 0, "um dono não consegue remover o outro dono (Vinícius x Marcela)");
});
await como(ana.id, async () => {
  const rm = await q(`delete from membros where nome = 'Carlos' returning user_id`);
  ok(rm.length === 1, "dono remove membro convidado (Ana remove Carlos)");
  await q(`insert into convites (email, nome, familia_id) values ('marido2@x.com','Carlos', minha_familia())`);
});
await como(vini.id, async () => {
  const c = await q(`select nome from contas order by nome`);
  ok(c.map((x) => x.nome).join() === "Aluguel,Luz", "Vinícius continua vendo só as contas do casal");
  const o = await q(`select count(*) n from orcamentos where categoria = 'Pets'`);
  ok(o[0].n == 0, "categoria 'Pets' da Ana não aparece para o casal");
  const cv = await q(`select email from convites`);
  ok(cv.length === 1 && cv[0].email === "irma@x.com", "Vinícius vê só os convites que ele criou");
});
// ---- migração 06: valor do mês (depois da 05) ----
await exec(fs.readFileSync(R + "migracao-06-valor-do-mes.sql", "utf8"));
await exec(`grant all on all tables in schema public to authenticated;`);
await como(vini.id, async () => {
  const [v] = await q(`insert into valores_mes (conta_id, competencia, valor) values ($1, '2026-12-01', 1234.56) returning familia_id`, [conta1.id]);
  ok(v.familia_id === fam[0].id, "06: valor do mês informado cai na família do casal");
  ok((await q(`select count(*) n from valores_mes`))[0].n == 1, "06: casal vê o valor informado");
});
await como(ana.id, async () => {
  ok((await q(`select count(*) n from valores_mes`))[0].n == 0, "06: Ana não vê os valores do casal");
  const up = await q(`update valores_mes set valor = 0 returning id`);
  ok(up.length === 0, "06: Ana não altera os valores do casal");
});
const dup06 = await tenta(() => exec(fs.readFileSync(R + "migracao-06-valor-do-mes.sql", "utf8")));
ok(!dup06, "06: rodar de novo é seguro " + (dup06 || ""));

// ---- migração 07: assinaturas e cadastro aberto ----
await exec(fs.readFileSync(R + "migracao-07-assinaturas.sql", "utf8"));
await exec(`grant all on all tables in schema public to authenticated;`);
const ass = await q(`select status from assinaturas order by status`);
ok(ass.length === 2 && ass.every((a) => a.status === "cortesia"), "07: as famílias que já existem (casal e Ana) viram cortesia");
await como(vini.id, async () => {
  const [m] = await q(`select minha_assinatura() a`);
  ok(m.a.status === "cortesia" && m.a.liberada === true, "07: casal em cortesia, liberado " + JSON.stringify(m.a));
  await q(`insert into gastos (descricao, valor, categoria, responsavel) values ('Feira',50,'Mercado','Vinícius')`);
  const up = await q(`update gastos set valor = 51 where descricao = 'Feira' returning id`);
  const del = await q(`delete from gastos where descricao = 'Feira' returning id`);
  ok(up.length === 1 && del.length === 1, "07: casal continua criando, alterando e apagando normalmente");
  const fura = await q(`update assinaturas set status = 'cortesia' returning familia_id`);
  ok(fura.length === 0, "07: ninguém altera a própria assinatura pelo app");
});
// cadastro aberto (sem convite)
const [bia] = await q(`insert into auth.users (email, raw_user_meta_data) values ('bia@x.com', '{"nome":"Bia"}') returning id`);
const famBia = (await q(`select f.nome, f.pessoas, m.papel, a.status, (select count(*) from orcamentos o where o.familia_id=f.id) orc
  from membros m join familias f on f.id=m.familia_id join assinaturas a on a.familia_id=f.id where m.user_id=$1`, [bia.id]))[0];
ok(famBia && famBia.nome === "Família de Bia" && famBia.papel === "dono" && famBia.status === "pendente" && famBia.orc == 7,
  "07: cadastro sem convite cria família nova pendente, com a pessoa como dona e categorias padrão " + JSON.stringify(famBia));
const [semNome] = await q(`insert into auth.users (email) values ('joao@x.com') returning id`);
ok((await q(`select nome from membros where user_id=$1`, [semNome.id]))[0]?.nome === "Joao", "07: sem nome informado, usa o começo do e-mail");
const comoBia = (fn) => como(bia.id, fn);
const podeGravar = async () => !(await tenta(() => q(`insert into contas (nome, categoria, valor, dia_vencimento) values ('Teste','Outros',10,5)`)));
await comoBia(async () => {
  const [m] = await q(`select minha_assinatura() a`);
  ok(m.a.status === "pendente" && m.a.liberada === false, "07: família nova ainda não liberada " + JSON.stringify(m.a));
  ok((await q(`select count(*) n from orcamentos`))[0].n == 7, "07: sem pagar, a família consegue VER os dados");
  ok(!(await podeGravar()), "07: sem pagar, não consegue criar conta");
  ok((await q(`update orcamentos set limite = 1 returning id`)).length === 0, "07: sem pagar, não consegue alterar");
  ok((await q(`delete from orcamentos returning id`)).length === 0, "07: sem pagar, não consegue apagar");
  ok((await q(`select count(*) n from assinaturas`))[0].n == 1, "07: cada família só vê a própria assinatura");
  ok(!!(await tenta(() => q(`insert into assinaturas (familia_id, status) values (minha_familia(), 'cortesia')`))), "07: não consegue se dar cortesia");
  await q(`insert into convites (email, nome, familia_id) values ('par@x.com', 'Duda', minha_familia())`);
});
const fBia = (await q(`select familia_id from membros where user_id=$1`, [bia.id]))[0].familia_id;
const setAss = (campos) => q(`update assinaturas set ${campos} where familia_id = $1`, [fBia]);
await setAss(`status='ativa', valido_ate = now() + interval '1 month', pago = true`);
ok(await comoBia(podeGravar), "07: pagou (servidor marcou ativa): grava normalmente");
await setAss(`status='atrasada', valido_ate = now() - interval '3 days', pago = true`);
ok(await comoBia(podeGravar), "07: pagamento atrasado há 3 dias: ainda dentro da tolerância de 7 dias");
await setAss(`status='atrasada', valido_ate = now() - interval '8 days', pago = true`);
ok(!(await comoBia(podeGravar)) && (await comoBia(() => q(`select count(*) n from contas`)))[0].n >= 1, "07: passou da tolerância: só consulta (vê os dados, não grava)");
await setAss(`status='ativa', valido_ate = now() - interval '1 hour', pago = false`);
ok(!(await comoBia(podeGravar)), "07: nunca pagou e o prazo passou: sem tolerância");
await setAss(`status='cancelada', valido_ate = now() + interval '10 days', pago = true`);
ok(await comoBia(podeGravar), "07: cancelou: usa até o fim do período pago");
await setAss(`status='cancelada', valido_ate = now() - interval '1 day', pago = true`);
ok(!(await comoBia(podeGravar)), "07: cancelou e o período acabou: só consulta (sem tolerância)");
// convidado entra na família pendente (não cria outra assinatura)
const [duda] = await q(`insert into auth.users (email) values ('par@x.com') returning id`);
ok((await q(`select familia_id from membros where user_id=$1`, [duda.id]))[0].familia_id === fBia && (await q(`select count(*) n from assinaturas where familia_id=$1`, [fBia]))[0].n == 1,
  "07: convidado entra na família de quem convidou (mesma assinatura)");
// convite de família nova feito pelo admin: cortesia
await como(vini.id, () => q(`insert into convites (email, nome, familia_nome) values ('amiga@x.com','Lu','Família da Lu')`));
const [lu] = await q(`insert into auth.users (email) values ('amiga@x.com') returning id`);
ok((await q(`select a.status from membros m join assinaturas a on a.familia_id=m.familia_id where m.user_id=$1`, [lu.id]))[0]?.status === "cortesia", "07: família nova convidada pelo admin vem como cortesia");
const dup07 = await tenta(() => exec(fs.readFileSync(R + "migracao-07-assinaturas.sql", "utf8")));
ok(!dup07 && (await q(`select status from assinaturas where familia_id=$1`, [fBia]))[0].status === "cancelada", "07: rodar de novo é seguro e não mexe nas assinaturas " + (dup07 || ""));
// desfazer 07
await exec(fs.readFileSync(R + "migracao-07-desfazer.sql", "utf8"));
ok(!!(await tenta(() => q(`insert into auth.users (email) values ('outro@x.com')`))), "07 DESFAZER: cadastro volta a ser só por convite");
ok(await comoBia(podeGravar), "07 DESFAZER: sem bloqueio por assinatura");
ok((await q(`select to_regclass('public.assinaturas') t`))[0].t === null, "07 DESFAZER: tabela de assinaturas removida");

// reconvite: e-mail que já usou o convite não reaproveita
const dup = await tenta(() => q(`insert into auth.users (email) values ('irma@x.com')`));
ok(!!dup, "convite usado não vale de novo");
// rodar a migração 2x não quebra nada
const nFam = (await q(`select count(*) n from familias`))[0].n;
await exec(fs.readFileSync(R + "migracao-05-familias.sql", "utf8"));
ok((await q(`select count(*) n from familias`))[0].n == nFam, "rodar a migração de novo é seguro (mesmas famílias)");
// desfazer
await exec(fs.readFileSync(R + "migracao-05-desfazer.sql", "utf8"));
await exec(`grant all on all tables in schema public to authenticated;`);
await como(vini.id, async () => {
  const d = (await q(`select (select count(*) from contas) c, (select count(*) from gastos) g, (select count(*) from pagamentos) p`))[0];
  ok(d.c == 2 && d.g == 2 && d.p == 1, "DESFAZER: volta ao app de uma família com os dados do casal " + JSON.stringify(d));
});
const cols = await q(`select count(*) n from information_schema.columns where table_schema='public' and column_name='familia_id'`);
ok(cols[0].n == 0, "DESFAZER: colunas de família removidas");
const reaplica = await tenta(() => exec(fs.readFileSync(R + "migracao-05-familias.sql", "utf8")));
ok(!reaplica, "depois de desfazer, dá para aplicar a migração de novo " + (reaplica || ""));

// ---- instalação do zero (schema.sql) ----
{
  const db2 = new PGlite(); const q2 = async (s, p) => (await db2.query(s, p)).rows;
  await db2.exec(`create schema auth; create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create role authenticated; grant usage on schema public to authenticated; grant usage on schema auth to authenticated;`);
  await db2.exec(fs.readFileSync(R + "schema.sql", "utf8"));
  await q2(`insert into public.convites (email, nome, familia_nome) values ('eu@x.com', 'Eu', 'Nossa família')`);
  await q2(`insert into auth.users (email) values ('eu@x.com')`);
  const m = await q2(`select m.papel, (select count(*) from orcamentos o where o.familia_id=m.familia_id) orc, (select status from assinaturas a where a.familia_id=m.familia_id) st from membros m`);
  ok(m.length === 1 && m[0].papel === "dono" && m[0].orc == 7 && m[0].st === "cortesia", "instalação do zero: primeiro usuário vira dono, com categorias padrão e cortesia " + JSON.stringify(m[0]));
  await q2(`insert into auth.users (email, raw_user_meta_data) values ('cliente@x.com', '{"nome":"Cliente"}')`);
  ok((await q2(`select a.status from membros m join assinaturas a on a.familia_id=m.familia_id where m.email='cliente@x.com'`))[0]?.status === "pendente", "instalação do zero: cadastro aberto cria família pendente");
}
console.log(falhas ? `\n${falhas} FALHA(S) no banco` : "\nBanco: tudo certo");
process.exit(falhas ? 1 : 0);
