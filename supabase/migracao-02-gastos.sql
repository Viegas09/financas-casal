-- =====================================================================
-- Finanças do Casal — MIGRAÇÃO 02: gastos variáveis e orçamentos
-- Rode UMA vez em: Supabase → SQL Editor → New query → Run
-- (pode rodar de novo sem problema: nada é apagado)
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
