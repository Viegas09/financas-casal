-- Desfaz a migração 06 (apaga os valores informados por mês; contas e pagamentos não mudam)
drop table if exists public.valores_mes;
