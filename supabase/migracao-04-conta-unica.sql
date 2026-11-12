-- =====================================================================
-- Finanças do Casal — MIGRAÇÃO 04: contas "só neste mês"
-- Rode UMA vez em: Supabase → SQL Editor → New query → Run
-- (pode rodar de novo sem problema: nada é apagado)
-- =====================================================================

-- Último mês em que a conta vale (vazio = repete todo mês).
-- Contas "só neste mês" têm fim = início.
alter table public.contas add column if not exists fim date;
