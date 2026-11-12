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
-- DEPOIS de criar os dois usuários em Authentication → Users,
-- rode as linhas abaixo trocando pelos e-mails de vocês:
-- =====================================================================
-- insert into public.membros (user_id, nome)
--   select id, 'Vinícius' from auth.users where email = 'SEU_EMAIL@exemplo.com';
-- insert into public.membros (user_id, nome)
--   select id, 'Marcela'  from auth.users where email = 'EMAIL_DA_MARCELA@exemplo.com';
--
-- Conferir:  select m.nome, u.email from public.membros m join auth.users u on u.id = m.user_id;
