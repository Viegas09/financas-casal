-- =====================================================================
-- Plinc — MIGRAÇÃO 08: avisos de vencimento no celular (notificação push)
-- • avisos_inscricoes: cada aparelho que ligou os avisos (cada pessoa só vê/apaga os próprios)
-- • avisos_config: código secreto que o agendador usa para chamar a função (só o servidor lê)
-- • agendamento diário às 8h (Brasília) que chama a função "avisos"
-- Rode UMA vez em: Supabase → SQL Editor → New query → Run. Pode rodar de novo sem problema.
-- Desfazer: migracao-08-desfazer.sql
-- =====================================================================
begin;

create table if not exists public.avisos_inscricoes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  familia_id  uuid references public.familias (id) on delete cascade default public.minha_familia(),
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  aparelho    text,
  created_at  timestamptz not null default now()
);
create index if not exists avisos_inscricoes_familia_idx on public.avisos_inscricoes (familia_id);
alter table public.avisos_inscricoes enable row level security;
drop policy if exists "cada um gerencia os proprios avisos" on public.avisos_inscricoes;
create policy "cada um gerencia os proprios avisos" on public.avisos_inscricoes
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and familia_id = public.minha_familia());

-- código do agendador: tabela com segurança ligada e SEM regras = só a chave de serviço (servidor) lê
create table if not exists public.avisos_config (
  id     smallint primary key default 1 check (id = 1),
  token  text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
);
alter table public.avisos_config enable row level security;
revoke all on public.avisos_config from authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then execute 'revoke all on public.avisos_config from anon'; end if;
end $$;
insert into public.avisos_config (id) values (1) on conflict (id) do nothing;

commit;

-- agendamento (só existe no Supabase; em outro banco esta parte é pulada)
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') and exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_cron;
    create extension if not exists pg_net;
    perform cron.unschedule(jobid) from cron.job where jobname = 'plinc-avisos';
    perform cron.schedule('plinc-avisos', '0 11 * * *', $cron$
      select net.http_post(
        url := 'https://bfpysalsisszdhzceade.supabase.co/functions/v1/avisos',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-plinc-cron', (select token from public.avisos_config where id = 1)),
        body := '{"acao":"enviar"}'::jsonb
      );
    $cron$);
  end if;
end $$;
