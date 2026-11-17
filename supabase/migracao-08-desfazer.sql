-- Desfaz a migração 08 (desliga os avisos no celular; nenhum dado financeiro muda)
do $$ begin
  if to_regclass('cron.job') is not null then perform cron.unschedule(jobid) from cron.job where jobname = 'plinc-avisos'; end if;
end $$;
drop table if exists public.avisos_inscricoes;
drop table if exists public.avisos_config;
