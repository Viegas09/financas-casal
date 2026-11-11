-- =====================================================================
-- Finanças do Casal — MIGRAÇÃO 03: metas, investimentos e cartões
-- Rode UMA vez em: Supabase → SQL Editor → New query → Run
-- (pode rodar de novo sem problema: nada é apagado)
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
