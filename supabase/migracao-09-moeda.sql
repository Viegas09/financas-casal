-- =====================================================================
-- Plinc — MIGRAÇÃO 09: moeda de cada família (ex.: real, coroa sueca, euro)
-- Quem é dono da família escolhe em Mais → Família. Os valores não são convertidos:
-- só o símbolo e o formato mudam. Todas as famílias de hoje continuam em real (BRL).
-- Rode UMA vez em: Supabase → SQL Editor → New query → Run. Pode rodar de novo sem problema.
-- Desfazer: migracao-09-desfazer.sql
-- =====================================================================
begin;
alter table public.familias add column if not exists moeda text not null default 'BRL';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'familias_moeda_codigo') then
    alter table public.familias add constraint familias_moeda_codigo check (moeda ~ '^[A-Z]{3}$');
  end if;
end $$;
commit;
