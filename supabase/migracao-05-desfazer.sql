-- =====================================================================
-- Finanças do Casal — DESFAZER a migração 05 (volta a ser um app de uma família só)
-- Use só se algo não ficou certo logo depois de rodar a migração 05.
-- ATENÇÃO: apaga as outras famílias e os convites. Os dados da primeira família ficam.
-- =====================================================================
begin;

drop trigger if exists ao_criar_usuario on auth.users;
drop function if exists public.ao_criar_usuario();

do $$
declare t text; pol text; f uuid;
begin
  select familia_id into f from public.membros where admin order by familia_id limit 1;
  -- mantém só a primeira família
  if f is not null then
    create temp table _sair on commit drop as select user_id from public.membros where familia_id <> f;
    delete from public.familias where id <> f;          -- apaga os dados das outras famílias (em cascata)
    update public.contas set created_by = null where created_by in (select user_id from _sair);
    delete from auth.users where id in (select user_id from _sair);
  end if;
  foreach t in array array['contas', 'pagamentos', 'rendas', 'gastos', 'orcamentos', 'metas', 'aportes', 'cartoes', 'faturas_pagas'] loop
    if to_regclass('public.' || t) is not null then
      for pol in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
        execute format('drop policy %I on public.%I', pol, t);
      end loop;
      execute format('create policy "membros gerenciam %s" on public.%I for all to authenticated using (public.is_membro()) with check (public.is_membro())', t, t);
      execute format('alter table public.%I drop column if exists familia_id', t);
    end if;
  end loop;
end $$;

alter table public.orcamentos drop constraint if exists orcamentos_familia_categoria_key;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'orcamentos_categoria_key') then
    alter table public.orcamentos add constraint orcamentos_categoria_key unique (categoria);
  end if;
end $$;

drop policy if exists "membros da familia" on public.membros;
drop policy if exists "dono remove membro" on public.membros;
drop policy if exists "membros leem membros" on public.membros;
create policy "membros leem membros" on public.membros for select to authenticated using (public.is_membro());

drop table if exists public.convites;
alter table public.membros drop column if exists familia_id, drop column if exists papel, drop column if exists admin, drop column if exists email;
drop table if exists public.familias;
drop function if exists public.minha_familia();
drop function if exists public.eh_dono();
drop function if exists public.eh_admin();

commit;
