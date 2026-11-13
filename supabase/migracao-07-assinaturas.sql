-- =====================================================================
-- Plinc — MIGRAÇÃO 07: assinatura (Mercado Pago) e cadastro aberto
--
-- Rode UMA vez em: Supabase → SQL Editor → New query → Run
--
-- • Tudo numa transação: se der erro em qualquer linha, NADA muda.
-- • As famílias que já existem (vocês, a irmã…) viram CORTESIA: nada muda para elas.
-- • Cadastro sem convite passa a ser aceito: cria uma família nova "pendente",
--   que só pode lançar dados depois que a assinatura for paga.
-- • Assinatura vencida: 7 dias de tolerância (depois do primeiro pagamento);
--   passado isso, a família continua VENDO tudo, mas não grava até pagar.
-- • Quem muda a assinatura é só o servidor (avisos do Mercado Pago);
--   pelo app ninguém consegue se dar acesso.
-- • Para voltar atrás: supabase/migracao-07-desfazer.sql
-- =====================================================================
begin;

-- ---------- Assinatura de cada família ----------
create table if not exists public.assinaturas (
  familia_id         uuid primary key references public.familias (id) on delete cascade,
  status             text not null default 'pendente'
                     check (status in ('cortesia', 'pendente', 'ativa', 'atrasada', 'pausada', 'cancelada')),
  valido_ate         timestamptz,                 -- pago até (próxima cobrança)
  pago               boolean not null default false,  -- já pagou alguma vez (libera a tolerância de 7 dias)
  mp_preapproval_id  text,                        -- assinatura no Mercado Pago
  mp_email           text,                        -- e-mail usado no Mercado Pago
  atualizado_em      timestamptz not null default now(),
  created_at         timestamptz not null default now()
);
alter table public.assinaturas enable row level security;

-- a família vê a própria assinatura; ninguém grava pelo app (só o servidor, com a chave de serviço)
drop policy if exists "familia ve assinatura" on public.assinaturas;
create policy "familia ve assinatura" on public.assinaturas
  for select to authenticated using (familia_id = public.minha_familia());

-- famílias que já existem: cortesia
insert into public.assinaturas (familia_id, status)
select id, 'cortesia' from public.familias
on conflict (familia_id) do nothing;

-- ---------- Regra: a família pode gravar? ----------
create or replace function public.familia_liberada(f uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select a.status = 'cortesia'
        or (a.status in ('ativa', 'atrasada', 'pausada')
            and a.valido_ate is not null
            and now() <= a.valido_ate + case when a.pago then interval '7 days' else interval '0 days' end)
        or (a.status = 'cancelada' and a.valido_ate is not null and now() <= a.valido_ate)
    from public.assinaturas a where a.familia_id = f
  ), false);
$$;

-- para o app mostrar a situação (calculada aqui no servidor, com o relógio certo)
create or replace function public.minha_assinatura()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'status', a.status,
    'valido_ate', a.valido_ate,
    'pago', a.pago,
    'liberada', public.familia_liberada(a.familia_id),
    'tolerancia_ate', case when a.pago and a.valido_ate is not null and a.status <> 'cancelada' then a.valido_ate + interval '7 days' else a.valido_ate end,
    'mp_email', a.mp_email
  )
  from public.assinaturas a where a.familia_id = public.minha_familia();
$$;
grant execute on function public.familia_liberada(uuid) to authenticated;
grant execute on function public.minha_assinatura() to authenticated;

-- ---------- Sem assinatura em dia: só consulta ----------
-- Regras "restritivas" somam às que já existem: continua valendo "cada família só vê o que é dela"
-- e, para criar/alterar/apagar, a família também precisa estar liberada. Ler continua sempre liberado.
do $$
declare t text;
begin
  foreach t in array array['contas', 'pagamentos', 'rendas', 'gastos', 'orcamentos', 'metas', 'aportes', 'cartoes', 'faturas_pagas', 'valores_mes'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists "assinatura em dia (criar)" on public.%I', t);
      execute format('drop policy if exists "assinatura em dia (alterar)" on public.%I', t);
      execute format('drop policy if exists "assinatura em dia (apagar)" on public.%I', t);
      execute format('create policy "assinatura em dia (criar)" on public.%I as restrictive for insert to authenticated with check (public.familia_liberada(public.minha_familia()))', t);
      execute format('create policy "assinatura em dia (alterar)" on public.%I as restrictive for update to authenticated using (public.familia_liberada(public.minha_familia())) with check (public.familia_liberada(public.minha_familia()))', t);
      execute format('create policy "assinatura em dia (apagar)" on public.%I as restrictive for delete to authenticated using (public.familia_liberada(public.minha_familia()))', t);
    end if;
  end loop;
end $$;

-- ---------- Cadastro: com convite (como antes) ou aberto ----------
-- Com convite para uma família: entra nela. Com convite de família nova (feito por um admin): família nova em CORTESIA.
-- Sem convite: família nova com a pessoa como dona e assinatura PENDENTE (paga para começar a lançar).
create or replace function public.ao_criar_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
declare c record; f uuid; nome_pessoa text; tem_convite boolean;
begin
  select * into c from public.convites
  where lower(email) = lower(new.email) and aceito_em is null
  order by created_at desc limit 1;
  tem_convite := found;   -- guardado: o FOUND muda a cada comando abaixo

  if tem_convite and c.familia_id is not null then
    insert into public.membros (user_id, nome, familia_id, papel, email) values (new.id, c.nome, c.familia_id, 'membro', new.email);
    update public.familias set pessoas = array_append(pessoas, c.nome) where id = c.familia_id and not (c.nome = any (pessoas));
    update public.convites set aceito_em = now() where id = c.id;
    return new;
  end if;

  if tem_convite then
    nome_pessoa := c.nome;
  else
    nome_pessoa := coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), initcap(split_part(new.email, '@', 1)));
    nome_pessoa := left(nome_pessoa, 40);
  end if;

  insert into public.familias (nome, pessoas)
  values (coalesce(nullif(case when tem_convite then c.familia_nome end, ''), 'Família de ' || nome_pessoa), array[nome_pessoa])
  returning id into f;
  insert into public.membros (user_id, nome, familia_id, papel, email) values (new.id, nome_pessoa, f, 'dono', new.email);
  insert into public.assinaturas (familia_id, status) values (f, case when tem_convite then 'cortesia' else 'pendente' end);
  if to_regclass('public.orcamentos') is not null then
    insert into public.orcamentos (familia_id, categoria, limite) values
      (f, 'Mercado', 1000), (f, 'Restaurantes e delivery', 300), (f, 'Lazer', 300),
      (f, 'Farmácia', 150), (f, 'Transporte', 300), (f, 'Compras', 300), (f, 'Casa', 200);
  end if;
  if tem_convite then update public.convites set aceito_em = now() where id = c.id; end if;
  return new;
end $$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario after insert on auth.users
  for each row execute function public.ao_criar_usuario();

commit;
