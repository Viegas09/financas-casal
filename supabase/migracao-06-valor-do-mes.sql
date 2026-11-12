-- =====================================================================
-- Finanças do Casal — MIGRAÇÃO 06: informar o valor de uma conta variável num mês
-- (ex.: a fatura do cartão de dezembro), antes de pagar e sem mexer no cadastro.
-- Rode UMA vez em: Supabase → SQL Editor → New query → Run
-- Tudo numa transação: se der erro, nada muda. Desfazer: migracao-06-desfazer.sql
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
