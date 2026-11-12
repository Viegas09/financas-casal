-- =====================================================================
-- Finanças do Casal — MIGRAÇÃO 05: várias famílias, só por convite
--
-- Rode UMA vez em: Supabase → SQL Editor → New query → Run
--
-- • Tudo roda numa transação só: se der erro em qualquer linha, NADA muda.
-- • Os dados que já existem vão para a primeira família, com os membros
--   atuais como donos. Quem já usa o app continua vendo tudo normalmente.
-- • Para voltar atrás: supabase/migracao-05-desfazer.sql
-- =====================================================================
begin;

-- ---------- Famílias ----------
create table if not exists public.familias (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  pessoas     text[] not null default '{}',        -- nomes que aparecem em "Quem paga"
  created_at  timestamptz not null default now()
);

-- Membros: cada pessoa pertence a UMA família (user_id já é a chave primária)
alter table public.membros add column if not exists familia_id uuid references public.familias (id) on delete cascade;
alter table public.membros add column if not exists papel text not null default 'membro' check (papel in ('dono', 'membro'));
alter table public.membros add column if not exists admin boolean not null default false;   -- pode convidar novas famílias
alter table public.membros add column if not exists email text;

-- Convites (cadastro só para e-mails convidados)
create table if not exists public.convites (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  nome          text not null,                       -- como a pessoa vai aparecer no app
  familia_id    uuid references public.familias (id) on delete cascade,   -- vazio = nova família
  familia_nome  text,                                -- nome da nova família (quando familia_id é vazio)
  criado_por    uuid default auth.uid() references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  aceito_em     timestamptz
);
create index if not exists convites_email_idx on public.convites (lower(email));

-- ---------- Funções usadas pelas regras de segurança ----------
create or replace function public.minha_familia()
returns uuid language sql stable security definer set search_path = public as $$
  select familia_id from public.membros where user_id = auth.uid();
$$;
create or replace function public.eh_dono()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.membros where user_id = auth.uid() and papel = 'dono');
$$;
create or replace function public.eh_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.membros where user_id = auth.uid() and admin);
$$;

-- ---------- Primeira família com os dados atuais ----------
do $$
declare f uuid;
begin
  if exists (select 1 from public.membros where familia_id is null) then
    insert into public.familias (nome, pessoas)
    values (
      coalesce((select string_agg(nome, ' & ' order by nome desc) from public.membros where familia_id is null), 'Minha família'),
      coalesce((select array_agg(nome order by nome desc) from public.membros where familia_id is null), '{}')
    )
    returning id into f;
    update public.membros m set familia_id = f, papel = 'dono',
      email = coalesce(m.email, (select u.email from auth.users u where u.id = m.user_id))
    where m.familia_id is null;
    -- quem já usava o app pode convidar novas famílias
    update public.membros set admin = true where familia_id = f;
    perform set_config('fc.familia_inicial', f::text, true);
  end if;
end $$;

-- ---------- familia_id em todas as tabelas de dados ----------
do $$
declare
  t text;
  f uuid := nullif(current_setting('fc.familia_inicial', true), '')::uuid;
begin
  foreach t in array array['contas', 'pagamentos', 'rendas', 'gastos', 'orcamentos', 'metas', 'aportes', 'cartoes', 'faturas_pagas'] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I add column if not exists familia_id uuid references public.familias (id) on delete cascade', t);
      if f is not null then
        execute format('update public.%I set familia_id = %L where familia_id is null', t, f);
      else
        -- instalação do zero: não há família ainda; descarta só as categorias de exemplo sem dono
        execute format('delete from public.%I where familia_id is null', t);
      end if;
      execute format('alter table public.%I alter column familia_id set default public.minha_familia()', t);
      execute format('alter table public.%I alter column familia_id set not null', t);
      execute format('create index if not exists %I on public.%I (familia_id)', t || '_familia_idx', t);
    end if;
  end loop;
end $$;

-- Categoria de orçamento passa a ser única por família (antes era única no app todo)
alter table public.orcamentos drop constraint if exists orcamentos_categoria_key;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'orcamentos_familia_categoria_key') then
    alter table public.orcamentos add constraint orcamentos_familia_categoria_key unique (familia_id, categoria);
  end if;
end $$;

-- ---------- Regras de segurança: cada família só vê o que é dela ----------
alter table public.familias enable row level security;
alter table public.convites enable row level security;

drop policy if exists "membros leem membros" on public.membros;
drop policy if exists "membros da familia" on public.membros;
create policy "membros da familia" on public.membros
  for select to authenticated using (familia_id = public.minha_familia());
drop policy if exists "dono remove membro" on public.membros;
create policy "dono remove membro" on public.membros
  for delete to authenticated using (familia_id = public.minha_familia() and public.eh_dono() and user_id <> auth.uid() and papel <> 'dono');

drop policy if exists "ver minha familia" on public.familias;
create policy "ver minha familia" on public.familias
  for select to authenticated using (id = public.minha_familia());
drop policy if exists "dono edita familia" on public.familias;
create policy "dono edita familia" on public.familias
  for update to authenticated using (id = public.minha_familia() and public.eh_dono()) with check (id = public.minha_familia());

drop policy if exists "ver convites" on public.convites;
create policy "ver convites" on public.convites
  for select to authenticated using (familia_id = public.minha_familia() or (familia_id is null and criado_por = auth.uid()));
drop policy if exists "criar convites" on public.convites;
create policy "criar convites" on public.convites
  for insert to authenticated with check (
    (familia_id = public.minha_familia() and familia_nome is null)
    or (familia_id is null and public.eh_admin())
  );
drop policy if exists "apagar convites" on public.convites;
create policy "apagar convites" on public.convites
  for delete to authenticated using (aceito_em is null and (familia_id = public.minha_familia() or (familia_id is null and criado_por = auth.uid())));

do $$
declare t text; antiga text;
begin
  foreach t in array array['contas', 'pagamentos', 'rendas', 'gastos', 'orcamentos', 'metas', 'aportes', 'cartoes', 'faturas_pagas'] loop
    if to_regclass('public.' || t) is not null then
      -- remove as regras antigas ("membros gerenciam ...")
      for antiga in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
        execute format('drop policy %I on public.%I', antiga, t);
      end loop;
      execute format('create policy "familia gerencia %s" on public.%I for all to authenticated using (familia_id = public.minha_familia()) with check (familia_id = public.minha_familia())', t, t);
    end if;
  end loop;
end $$;

-- ---------- Cadastro só por convite ----------
-- Ao criar um usuário (pelo app ou pelo painel do Supabase), procura um convite para o e-mail.
-- Sem convite, o cadastro é recusado. Com convite: entra na família do convite ou cria a nova família.
create or replace function public.ao_criar_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
declare c record; f uuid;
begin
  select * into c from public.convites
  where lower(email) = lower(new.email) and aceito_em is null
  order by created_at desc limit 1;
  if not found then
    raise exception 'Cadastro somente por convite (%)', new.email using errcode = 'P0001';
  end if;
  if c.familia_id is null then
    insert into public.familias (nome, pessoas) values (coalesce(nullif(c.familia_nome, ''), 'Família de ' || c.nome), array[c.nome])
    returning id into f;
    insert into public.membros (user_id, nome, familia_id, papel, email) values (new.id, c.nome, f, 'dono', new.email);
    -- categorias de gasto iniciais para a família nova
    if to_regclass('public.orcamentos') is not null then
      insert into public.orcamentos (familia_id, categoria, limite) values
        (f, 'Mercado', 1000), (f, 'Restaurantes e delivery', 300), (f, 'Lazer', 300),
        (f, 'Farmácia', 150), (f, 'Transporte', 300), (f, 'Compras', 300), (f, 'Casa', 200);
    end if;
  else
    insert into public.membros (user_id, nome, familia_id, papel, email) values (new.id, c.nome, c.familia_id, 'membro', new.email);
    update public.familias set pessoas = array_append(pessoas, c.nome) where id = c.familia_id and not (c.nome = any (pessoas));
  end if;
  update public.convites set aceito_em = now() where id = c.id;
  return new;
end $$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario after insert on auth.users
  for each row execute function public.ao_criar_usuario();

commit;

-- Conferir depois de rodar:
--   select f.nome, f.pessoas, m.nome as membro, m.papel, m.admin from familias f join membros m on m.familia_id = f.id;
