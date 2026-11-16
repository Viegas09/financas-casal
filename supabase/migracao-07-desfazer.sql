-- =====================================================================
-- Plinc — DESFAZER a migração 07 (assinaturas e cadastro aberto)
-- Volta ao cadastro só por convite e tira o bloqueio por assinatura.
-- Famílias criadas pelo cadastro aberto continuam existindo (com os dados delas).
-- Tudo numa transação: se der erro, nada muda.
-- =====================================================================
begin;

do $$
declare t text;
begin
  foreach t in array array['contas', 'pagamentos', 'rendas', 'gastos', 'orcamentos', 'metas', 'aportes', 'cartoes', 'faturas_pagas', 'valores_mes'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists "assinatura em dia (criar)" on public.%I', t);
      execute format('drop policy if exists "assinatura em dia (alterar)" on public.%I', t);
      execute format('drop policy if exists "assinatura em dia (apagar)" on public.%I', t);
    end if;
  end loop;
end $$;

drop function if exists public.minha_assinatura();
drop function if exists public.familia_liberada(uuid);
drop table if exists public.assinaturas;

-- cadastro volta a ser só por convite (igual à migração 05)
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

commit;
