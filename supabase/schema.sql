-- =====================================================================
-- Finanças do Casal — estrutura do banco (Supabase / PostgreSQL)
-- Cole TUDO isto em: Supabase → SQL Editor → New query → Run
-- =====================================================================

-- ---------- Quem pode acessar o painel ----------
create table if not exists public.membros (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nome    text not null
);

-- Função usada pelas regras de segurança: "o usuário logado é membro?"
create or replace function public.is_membro()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.membros where user_id = auth.uid());
$$;

-- ---------- Contas fixas ----------
create table if not exists public.contas (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null,
  categoria        text not null default 'Outros',
  valor            numeric(12,2) not null check (valor >= 0),
  dia_vencimento   smallint not null check (dia_vencimento between 1 and 31),
  responsavel      text not null default 'Casal',
  forma_pagamento  text,
  observacao       text,
  inicio           date not null default date_trunc('month', now())::date,
  ativa            boolean not null default true,
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid() references auth.users (id)
);

-- ---------- Pagamentos (um por conta por mês) ----------
create table if not exists public.pagamentos (
  id           uuid primary key default gen_random_uuid(),
  conta_id     uuid not null references public.contas (id) on delete cascade,
  competencia  date not null,                     -- sempre o dia 1 do mês (ex.: 2026-11-01)
  valor_pago   numeric(12,2) not null check (valor_pago >= 0),
  pago_em      date not null default current_date,
  pago_por     text,
  created_at   timestamptz not null default now(),
  created_by   uuid default auth.uid() references auth.users (id),
  unique (conta_id, competencia)
);
create index if not exists pagamentos_competencia_idx on public.pagamentos (competencia);

-- ---------- Rendas ----------
create table if not exists public.rendas (
  id           uuid primary key default gen_random_uuid(),
  descricao    text not null,
  valor        numeric(12,2) not null check (valor >= 0),
  responsavel  text not null,
  ativa        boolean not null default true,
  created_at   timestamptz not null default now(),
  created_by   uuid default auth.uid() references auth.users (id)
);

-- =====================================================================
-- SEGURANÇA (Row Level Security)
-- Só quem está na tabela "membros" lê ou altera qualquer dado.
-- =====================================================================
alter table public.membros    enable row level security;
alter table public.contas     enable row level security;
alter table public.pagamentos enable row level security;
alter table public.rendas     enable row level security;

drop policy if exists "membros leem membros" on public.membros;
create policy "membros leem membros" on public.membros
  for select to authenticated using (public.is_membro());
-- (ninguém insere/edita membros pelo site; isso é feito só aqui no SQL Editor)

drop policy if exists "membros gerenciam contas" on public.contas;
create policy "membros gerenciam contas" on public.contas
  for all to authenticated using (public.is_membro()) with check (public.is_membro());

drop policy if exists "membros gerenciam pagamentos" on public.pagamentos;
create policy "membros gerenciam pagamentos" on public.pagamentos
  for all to authenticated using (public.is_membro()) with check (public.is_membro());

drop policy if exists "membros gerenciam rendas" on public.rendas;
create policy "membros gerenciam rendas" on public.rendas
  for all to authenticated using (public.is_membro()) with check (public.is_membro());

-- =====================================================================
-- GASTOS VARIÁVEIS E ORÇAMENTOS (migração 02, já incluída aqui)
-- =====================================================================

-- Contas fixas cujo valor muda todo mês (luz, água, gás…)
alter table public.contas add column if not exists variavel boolean not null default false;

-- Limite mensal por categoria de gasto variável
create table if not exists public.orcamentos (
  id          uuid primary key default gen_random_uuid(),
  categoria   text not null unique,
  limite      numeric(12,2) not null check (limite >= 0),
  ativa       boolean not null default true,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid() references auth.users (id)
);

-- Cada gasto do dia a dia (mercado, lazer, farmácia…)
create table if not exists public.gastos (
  id               uuid primary key default gen_random_uuid(),
  data             date not null default current_date,
  descricao        text not null,
  valor            numeric(12,2) not null check (valor >= 0),
  categoria        text not null,
  responsavel      text not null,
  forma_pagamento  text,
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid() references auth.users (id)
);
create index if not exists gastos_data_idx on public.gastos (data);

alter table public.orcamentos enable row level security;
alter table public.gastos     enable row level security;

drop policy if exists "membros gerenciam orcamentos" on public.orcamentos;
create policy "membros gerenciam orcamentos" on public.orcamentos
  for all to authenticated using (public.is_membro()) with check (public.is_membro());

drop policy if exists "membros gerenciam gastos" on public.gastos;
create policy "membros gerenciam gastos" on public.gastos
  for all to authenticated using (public.is_membro()) with check (public.is_membro());

-- Orçamentos iniciais sugeridos (ajuste os valores depois pelo app)
insert into public.orcamentos (categoria, limite) values
  ('Mercado', 1200), ('Restaurantes e delivery', 400), ('Lazer', 300),
  ('Farmácia', 150), ('Transporte', 300), ('Compras', 300), ('Casa', 200)
on conflict (categoria) do nothing;

-- =====================================================================
-- METAS, INVESTIMENTOS E CARTÕES (migração 03, já incluída aqui)
-- =====================================================================

-- ---------- Metas e aportes ----------
create table if not exists public.metas (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  valor_alvo  numeric(12,2) not null check (valor_alvo > 0),
  prazo       date,                                   -- opcional (mês/ano alvo)
  onde        text,                                   -- onde o dinheiro está (ex.: CDB, Tesouro, poupança)
  ativa       boolean not null default true,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid() references auth.users (id)
);

create table if not exists public.aportes (
  id           uuid primary key default gen_random_uuid(),
  meta_id      uuid not null references public.metas (id) on delete cascade,
  data         date not null default current_date,
  valor        numeric(12,2) not null,                -- positivo = guardou, negativo = retirou
  responsavel  text not null,
  observacao   text,
  created_at   timestamptz not null default now(),
  created_by   uuid default auth.uid() references auth.users (id)
);
create index if not exists aportes_meta_idx on public.aportes (meta_id);

-- ---------- Cartões de crédito ----------
create table if not exists public.cartoes (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null,
  dia_fechamento   smallint not null check (dia_fechamento between 1 and 31),
  dia_vencimento   smallint not null check (dia_vencimento between 1 and 31),
  limite           numeric(12,2),
  responsavel      text not null default 'Casal',
  ativo            boolean not null default true,
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid() references auth.users (id)
);

create table if not exists public.faturas_pagas (
  id           uuid primary key default gen_random_uuid(),
  cartao_id    uuid not null references public.cartoes (id) on delete cascade,
  competencia  date not null,                         -- mês do vencimento (dia 1)
  valor_pago   numeric(12,2) not null,
  pago_em      date not null default current_date,
  pago_por     text,
  created_at   timestamptz not null default now(),
  unique (cartao_id, competencia)
);

-- Compras e contas no cartão
alter table public.gastos add column if not exists cartao_id uuid references public.cartoes (id) on delete set null;
alter table public.gastos add column if not exists parcelas smallint not null default 1 check (parcelas between 1 and 48);
alter table public.contas add column if not exists cartao_id uuid references public.cartoes (id) on delete set null;

-- ---------- Segurança ----------
alter table public.metas         enable row level security;
alter table public.aportes       enable row level security;
alter table public.cartoes       enable row level security;
alter table public.faturas_pagas enable row level security;

drop policy if exists "membros gerenciam metas" on public.metas;
create policy "membros gerenciam metas" on public.metas
  for all to authenticated using (public.is_membro()) with check (public.is_membro());
drop policy if exists "membros gerenciam aportes" on public.aportes;
create policy "membros gerenciam aportes" on public.aportes
  for all to authenticated using (public.is_membro()) with check (public.is_membro());
drop policy if exists "membros gerenciam cartoes" on public.cartoes;
create policy "membros gerenciam cartoes" on public.cartoes
  for all to authenticated using (public.is_membro()) with check (public.is_membro());
drop policy if exists "membros gerenciam faturas" on public.faturas_pagas;
create policy "membros gerenciam faturas" on public.faturas_pagas
  for all to authenticated using (public.is_membro()) with check (public.is_membro());

-- =====================================================================
-- CONTAS "SÓ NESTE MÊS" (migração 04, já incluída aqui)
-- =====================================================================
alter table public.contas add column if not exists fim date;

-- =====================================================================
-- VÁRIAS FAMÍLIAS, SÓ POR CONVITE (migração 05, já incluída aqui)
-- =====================================================================
begin;

-- ---------- Famílias ----------
create table if not exists public.familias (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  pessoas     text[] not null default '{}',        -- nomes que aparecem em "Quem paga"
  created_at  timestamptz not null default now()
);

-- Membros: cada pessoa pertence a UMA família (user_id já é a chave primária)
alter table public.membros add column if not exists familia_id uuid references public.familias (id) on delete cascade;
alter table public.membros add column if not exists papel text not null default 'membro' check (papel in ('dono', 'membro'));
alter table public.membros add column if not exists admin boolean not null default false;   -- pode convidar novas famílias
alter table public.membros add column if not exists email text;

-- Convites (cadastro só para e-mails convidados)
create table if not exists public.convites (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  nome          text not null,                       -- como a pessoa vai aparecer no app
  familia_id    uuid references public.familias (id) on delete cascade,   -- vazio = nova família
  familia_nome  text,                                -- nome da nova família (quando familia_id é vazio)
  criado_por    uuid default auth.uid() references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  aceito_em     timestamptz
);
create index if not exists convites_email_idx on public.convites (lower(email));

-- ---------- Funções usadas pelas regras de segurança ----------
create or replace function public.minha_familia()
returns uuid language sql stable security definer set search_path = public as $$
  select familia_id from public.membros where user_id = auth.uid();
$$;
create or replace function public.eh_dono()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.membros where user_id = auth.uid() and papel = 'dono');
$$;
create or replace function public.eh_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.membros where user_id = auth.uid() and admin);
$$;

-- ---------- Primeira família com os dados atuais ----------
do $$
declare f uuid;
begin
  if exists (select 1 from public.membros where familia_id is null) then
    insert into public.familias (nome, pessoas)
    values (
      coalesce((select string_agg(nome, ' & ' order by nome desc) from public.membros where familia_id is null), 'Minha família'),
      coalesce((select array_agg(nome order by nome desc) from public.membros where familia_id is null), '{}')
    )
    returning id into f;
    update public.membros m set familia_id = f, papel = 'dono',
      email = coalesce(m.email, (select u.email from auth.users u where u.id = m.user_id))
    where m.familia_id is null;
    -- quem já usava o app pode convidar novas famílias
    update public.membros set admin = true where familia_id = f;
    perform set_config('fc.familia_inicial', f::text, true);
  end if;
end $$;

-- ---------- familia_id em todas as tabelas de dados ----------
do $$
declare
  t text;
  f uuid := nullif(current_setting('fc.familia_inicial', true), '')::uuid;
begin
  foreach t in array array['contas', 'pagamentos', 'rendas', 'gastos', 'orcamentos', 'metas', 'aportes', 'cartoes', 'faturas_pagas'] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I add column if not exists familia_id uuid references public.familias (id) on delete cascade', t);
      if f is not null then
        execute format('update public.%I set familia_id = %L where familia_id is null', t, f);
      else
        -- instalação do zero: não há família ainda; descarta só as categorias de exemplo sem dono
        execute format('delete from public.%I where familia_id is null', t);
      end if;
      execute format('alter table public.%I alter column familia_id set default public.minha_familia()', t);
      execute format('alter table public.%I alter column familia_id set not null', t);
      execute format('create index if not exists %I on public.%I (familia_id)', t || '_familia_idx', t);
    end if;
  end loop;
end $$;

-- Categoria de orçamento passa a ser única por família (antes era única no app todo)
alter table public.orcamentos drop constraint if exists orcamentos_categoria_key;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'orcamentos_familia_categoria_key') then
    alter table public.orcamentos add constraint orcamentos_familia_categoria_key unique (familia_id, categoria);
  end if;
end $$;

-- ---------- Regras de segurança: cada família só vê o que é dela ----------
alter table public.familias enable row level security;
alter table public.convites enable row level security;

drop policy if exists "membros leem membros" on public.membros;
drop policy if exists "membros da familia" on public.membros;
create policy "membros da familia" on public.membros
  for select to authenticated using (familia_id = public.minha_familia());
drop policy if exists "dono remove membro" on public.membros;
create policy "dono remove membro" on public.membros
  for delete to authenticated using (familia_id = public.minha_familia() and public.eh_dono() and user_id <> auth.uid() and papel <> 'dono');

drop policy if exists "ver minha familia" on public.familias;
create policy "ver minha familia" on public.familias
  for select to authenticated using (id = public.minha_familia());
drop policy if exists "dono edita familia" on public.familias;
create policy "dono edita familia" on public.familias
  for update to authenticated using (id = public.minha_familia() and public.eh_dono()) with check (id = public.minha_familia());

drop policy if exists "ver convites" on public.convites;
create policy "ver convites" on public.convites
  for select to authenticated using (familia_id = public.minha_familia() or (familia_id is null and criado_por = auth.uid()));
drop policy if exists "criar convites" on public.convites;
create policy "criar convites" on public.convites
  for insert to authenticated with check (
    (familia_id = public.minha_familia() and familia_nome is null)
    or (familia_id is null and public.eh_admin())
  );
drop policy if exists "apagar convites" on public.convites;
create policy "apagar convites" on public.convites
  for delete to authenticated using (aceito_em is null and (familia_id = public.minha_familia() or (familia_id is null and criado_por = auth.uid())));

do $$
declare t text; antiga text;
begin
  foreach t in array array['contas', 'pagamentos', 'rendas', 'gastos', 'orcamentos', 'metas', 'aportes', 'cartoes', 'faturas_pagas'] loop
    if to_regclass('public.' || t) is not null then
      -- remove as regras antigas ("membros gerenciam ...")
      for antiga in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
        execute format('drop policy %I on public.%I', antiga, t);
      end loop;
      execute format('create policy "familia gerencia %s" on public.%I for all to authenticated using (familia_id = public.minha_familia()) with check (familia_id = public.minha_familia())', t, t);
    end if;
  end loop;
end $$;

-- ---------- Cadastro só por convite ----------
-- Ao criar um usuário (pelo app ou pelo painel do Supabase), procura um convite para o e-mail.
-- Sem convite, o cadastro é recusado. Com convite: entra na família do convite ou cria a nova família.
create or replace function public.ao_criar_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
declare c record; f uuid;
begin
  select * into c from public.convites
  where lower(email) = lower(new.email) and aceito_em is null
  order by created_at desc limit 1;
  if not found then
    raise exception 'Cadastro somente por convite (%)', new.email using errcode = 'P0001';
  end if;
  if c.familia_id is null then
    insert into public.familias (nome, pessoas) values (coalesce(nullif(c.familia_nome, ''), 'Família de ' || c.nome), array[c.nome])
    returning id into f;
    insert into public.membros (user_id, nome, familia_id, papel, email) values (new.id, c.nome, f, 'dono', new.email);
    -- categorias de gasto iniciais para a família nova
    if to_regclass('public.orcamentos') is not null then
      insert into public.orcamentos (familia_id, categoria, limite) values
        (f, 'Mercado', 1000), (f, 'Restaurantes e delivery', 300), (f, 'Lazer', 300),
        (f, 'Farmácia', 150), (f, 'Transporte', 300), (f, 'Compras', 300), (f, 'Casa', 200);
    end if;
  else
    insert into public.membros (user_id, nome, familia_id, papel, email) values (new.id, c.nome, c.familia_id, 'membro', new.email);
    update public.familias set pessoas = array_append(pessoas, c.nome) where id = c.familia_id and not (c.nome = any (pessoas));
  end if;
  update public.convites set aceito_em = now() where id = c.id;
  return new;
end $$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario after insert on auth.users
  for each row execute function public.ao_criar_usuario();

commit;

-- Conferir depois de rodar:
--   select f.nome, f.pessoas, m.nome as membro, m.papel, m.admin from familias f join membros m on m.familia_id = f.id;


-- =====================================================================
-- VALOR DO MÊS EM CONTAS VARIÁVEIS (migração 06, já incluída aqui)
-- =====================================================================
begin;

create table if not exists public.valores_mes (
  id           uuid primary key default gen_random_uuid(),
  conta_id     uuid not null references public.contas (id) on delete cascade,
  competencia  date not null,                     -- mês (dia 1)
  valor        numeric(12,2) not null check (valor >= 0),
  created_at   timestamptz not null default now(),
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  unique (conta_id, competencia)
);

alter table public.valores_mes enable row level security;

do $$
begin
  if to_regclass('public.familias') is not null then
    -- app com famílias (migração 05): cada família só vê os próprios valores
    alter table public.valores_mes add column if not exists familia_id uuid references public.familias (id) on delete cascade;
    alter table public.valores_mes alter column familia_id set default public.minha_familia();
    update public.valores_mes v set familia_id = c.familia_id from public.contas c where c.id = v.conta_id and v.familia_id is null;
    alter table public.valores_mes alter column familia_id set not null;
    create index if not exists valores_mes_familia_idx on public.valores_mes (familia_id);
    drop policy if exists "familia gerencia valores_mes" on public.valores_mes;
    create policy "familia gerencia valores_mes" on public.valores_mes
      for all to authenticated using (familia_id = public.minha_familia()) with check (familia_id = public.minha_familia());
  else
    drop policy if exists "membros gerenciam valores_mes" on public.valores_mes;
    create policy "membros gerenciam valores_mes" on public.valores_mes
      for all to authenticated using (public.is_membro()) with check (public.is_membro());
  end if;
end $$;

commit;

-- =====================================================================
-- ASSINATURAS E CADASTRO ABERTO (migração 07, já incluída aqui)
-- =====================================================================
begin;

-- ---------- Assinatura de cada família ----------
create table if not exists public.assinaturas (
  familia_id         uuid primary key references public.familias (id) on delete cascade,
  status             text not null default 'pendente'
                     check (status in ('cortesia', 'pendente', 'ativa', 'atrasada', 'pausada', 'cancelada')),
  valido_ate         timestamptz,                 -- pago até (próxima cobrança)
  pago               boolean not null default false,  -- já pagou alguma vez (libera a tolerância de 7 dias)
  mp_preapproval_id  text,                        -- assinatura no Mercado Pago
  mp_email           text,                        -- e-mail usado no Mercado Pago
  atualizado_em      timestamptz not null default now(),
  created_at         timestamptz not null default now()
);
alter table public.assinaturas enable row level security;

-- a família vê a própria assinatura; ninguém grava pelo app (só o servidor, com a chave de serviço)
drop policy if exists "familia ve assinatura" on public.assinaturas;
create policy "familia ve assinatura" on public.assinaturas
  for select to authenticated using (familia_id = public.minha_familia());

-- famílias que já existem: cortesia
insert into public.assinaturas (familia_id, status)
select id, 'cortesia' from public.familias
on conflict (familia_id) do nothing;

-- ---------- Regra: a família pode gravar? ----------
create or replace function public.familia_liberada(f uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select a.status = 'cortesia'
        or (a.status in ('ativa', 'atrasada', 'pausada')
            and a.valido_ate is not null
            and now() <= a.valido_ate + case when a.pago then interval '7 days' else interval '0 days' end)
        or (a.status = 'cancelada' and a.valido_ate is not null and now() <= a.valido_ate)
    from public.assinaturas a where a.familia_id = f
  ), false);
$$;

-- para o app mostrar a situação (calculada aqui no servidor, com o relógio certo)
create or replace function public.minha_assinatura()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'status', a.status,
    'valido_ate', a.valido_ate,
    'pago', a.pago,
    'liberada', public.familia_liberada(a.familia_id),
    'tolerancia_ate', case when a.pago and a.valido_ate is not null and a.status <> 'cancelada' then a.valido_ate + interval '7 days' else a.valido_ate end,
    'mp_email', a.mp_email
  )
  from public.assinaturas a where a.familia_id = public.minha_familia();
$$;
grant execute on function public.familia_liberada(uuid) to authenticated;
grant execute on function public.minha_assinatura() to authenticated;

-- ---------- Sem assinatura em dia: só consulta ----------
-- Regras "restritivas" somam às que já existem: continua valendo "cada família só vê o que é dela"
-- e, para criar/alterar/apagar, a família também precisa estar liberada. Ler continua sempre liberado.
do $$
declare t text;
begin
  foreach t in array array['contas', 'pagamentos', 'rendas', 'gastos', 'orcamentos', 'metas', 'aportes', 'cartoes', 'faturas_pagas', 'valores_mes'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists "assinatura em dia (criar)" on public.%I', t);
      execute format('drop policy if exists "assinatura em dia (alterar)" on public.%I', t);
      execute format('drop policy if exists "assinatura em dia (apagar)" on public.%I', t);
      execute format('create policy "assinatura em dia (criar)" on public.%I as restrictive for insert to authenticated with check (public.familia_liberada(public.minha_familia()))', t);
      execute format('create policy "assinatura em dia (alterar)" on public.%I as restrictive for update to authenticated using (public.familia_liberada(public.minha_familia())) with check (public.familia_liberada(public.minha_familia()))', t);
      execute format('create policy "assinatura em dia (apagar)" on public.%I as restrictive for delete to authenticated using (public.familia_liberada(public.minha_familia()))', t);
    end if;
  end loop;
end $$;

-- ---------- Cadastro: com convite (como antes) ou aberto ----------
-- Com convite para uma família: entra nela. Com convite de família nova (feito por um admin): família nova em CORTESIA.
-- Sem convite: família nova com a pessoa como dona e assinatura PENDENTE (paga para começar a lançar).
create or replace function public.ao_criar_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
declare c record; f uuid; nome_pessoa text; tem_convite boolean;
begin
  select * into c from public.convites
  where lower(email) = lower(new.email) and aceito_em is null
  order by created_at desc limit 1;
  tem_convite := found;   -- guardado: o FOUND muda a cada comando abaixo

  if tem_convite and c.familia_id is not null then
    insert into public.membros (user_id, nome, familia_id, papel, email) values (new.id, c.nome, c.familia_id, 'membro', new.email);
    update public.familias set pessoas = array_append(pessoas, c.nome) where id = c.familia_id and not (c.nome = any (pessoas));
    update public.convites set aceito_em = now() where id = c.id;
    return new;
  end if;

  if tem_convite then
    nome_pessoa := c.nome;
  else
    nome_pessoa := coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), initcap(split_part(new.email, '@', 1)));
    nome_pessoa := left(nome_pessoa, 40);
  end if;

  insert into public.familias (nome, pessoas)
  values (coalesce(nullif(case when tem_convite then c.familia_nome end, ''), 'Família de ' || nome_pessoa), array[nome_pessoa])
  returning id into f;
  insert into public.membros (user_id, nome, familia_id, papel, email) values (new.id, nome_pessoa, f, 'dono', new.email);
  insert into public.assinaturas (familia_id, status) values (f, case when tem_convite then 'cortesia' else 'pendente' end);
  if to_regclass('public.orcamentos') is not null then
    insert into public.orcamentos (familia_id, categoria, limite) values
      (f, 'Mercado', 1000), (f, 'Restaurantes e delivery', 300), (f, 'Lazer', 300),
      (f, 'Farmácia', 150), (f, 'Transporte', 300), (f, 'Compras', 300), (f, 'Casa', 200);
  end if;
  if tem_convite then update public.convites set aceito_em = now() where id = c.id; end if;
  return new;
end $$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario after insert on auth.users
  for each row execute function public.ao_criar_usuario();

commit;

-- =====================================================================
-- PRIMEIRO ACESSO (instalação do zero)
-- Crie o convite do primeiro usuário aqui (convite de família nova = cortesia, sem cobrança),
-- trocando nome, e-mail e nome da família, e rode:
-- =====================================================================
-- insert into public.convites (email, nome, familia_nome) values ('seu@email.com', 'Seu nome', 'Nossa família');
--
-- Depois crie o usuário em Authentication → Users → Add user (mesmo e-mail, marque Auto Confirm User)
-- e dê a ele permissão de convidar novas famílias:
-- update public.membros set admin = true where email = 'seu@email.com';
--
-- O resto (cônjuge, outras famílias) se convida pelo próprio app: Mais → Família.
