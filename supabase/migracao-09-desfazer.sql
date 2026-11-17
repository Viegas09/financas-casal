-- Desfaz a migração 09 (todas as famílias voltam a usar real; nenhum valor muda)
alter table public.familias drop constraint if exists familias_moeda_codigo;
alter table public.familias drop column if exists moeda;
