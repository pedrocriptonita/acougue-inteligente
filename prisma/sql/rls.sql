-- ============================================================================
--  AÇOUGUE INTELIGENTE — Row Level Security (RLS)
--  Fase 2 · Isolamento multi-tenant por loja_id no Postgres (Supabase)
--
--  COMO APLICAR:
--    Rode este script no SQL Editor do Supabase (ou via `psql` na DIRECT_URL)
--    SEMPRE DEPOIS de `prisma migrate deploy` ter criado as tabelas.
--    O Prisma não gerencia RLS — este arquivo é a fonte da verdade das políticas.
--
--  MODELO DE ACESSO:
--    - Cada usuário do Supabase Auth (auth.uid()) está vinculado a UMA loja
--      via public.usuarios.auth_user_id -> usuarios.loja_id.
--    - As políticas restringem toda leitura/escrita à loja do usuário logado.
--    - A conexão `service_role` (usada pelo N8N e por jobs server-side) IGNORA
--      RLS por padrão no Supabase — por isso o webhook do WhatsApp consegue
--      escrever em qualquer loja.
--    - O onboarding (criar a 1ª loja+usuário) roda via Prisma na conexão direta
--      do banco (owner), que também ignora RLS — necessário porque, naquele
--      momento, auth_loja_id() ainda seria NULL.
-- ============================================================================

-- ----------------------------------------------------------------------------
--  Função auxiliar: a loja do usuário autenticado.
--  SECURITY DEFINER para conseguir ler `usuarios` mesmo com RLS ativo, sem
--  cair em recursão de política (a função roda como owner).
-- ----------------------------------------------------------------------------
create or replace function public.auth_loja_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select loja_id
  from public.usuarios
  where auth_user_id = auth.uid()
    and deleted_at is null
  limit 1
$$;

revoke all on function public.auth_loja_id() from public;
grant execute on function public.auth_loja_id() to authenticated, service_role;

-- ----------------------------------------------------------------------------
--  Habilita RLS em todas as tabelas operacionais.
-- ----------------------------------------------------------------------------
alter table public.lojas        enable row level security;
alter table public.usuarios     enable row level security;
alter table public.clientes     enable row level security;
alter table public.pedidos      enable row level security;
alter table public.itens_pedido enable row level security;
alter table public.conversas    enable row level security;
alter table public.produtos     enable row level security;

-- Garante reexecução idempotente: derruba políticas antigas antes de recriar.
drop policy if exists loja_isolada        on public.lojas;
drop policy if exists usuarios_isolados   on public.usuarios;
drop policy if exists clientes_isolados   on public.clientes;
drop policy if exists pedidos_isolados    on public.pedidos;
drop policy if exists itens_isolados      on public.itens_pedido;
drop policy if exists conversas_isoladas  on public.conversas;
drop policy if exists produtos_isolados   on public.produtos;

-- ----------------------------------------------------------------------------
--  Políticas (FOR ALL = select/insert/update/delete) escopadas por loja.
--  USING filtra as linhas visíveis; WITH CHECK valida o que pode ser gravado.
-- ----------------------------------------------------------------------------
create policy loja_isolada on public.lojas
  for all to authenticated
  using (id = public.auth_loja_id())
  with check (id = public.auth_loja_id());

create policy usuarios_isolados on public.usuarios
  for all to authenticated
  using (loja_id = public.auth_loja_id())
  with check (loja_id = public.auth_loja_id());

create policy clientes_isolados on public.clientes
  for all to authenticated
  using (loja_id = public.auth_loja_id())
  with check (loja_id = public.auth_loja_id());

create policy pedidos_isolados on public.pedidos
  for all to authenticated
  using (loja_id = public.auth_loja_id())
  with check (loja_id = public.auth_loja_id());

create policy conversas_isoladas on public.conversas
  for all to authenticated
  using (loja_id = public.auth_loja_id())
  with check (loja_id = public.auth_loja_id());

create policy produtos_isolados on public.produtos
  for all to authenticated
  using (loja_id = public.auth_loja_id())
  with check (loja_id = public.auth_loja_id());

-- itens_pedido não tem loja_id próprio: herda o isolamento pelo pedido pai.
create policy itens_isolados on public.itens_pedido
  for all to authenticated
  using (
    exists (
      select 1 from public.pedidos p
      where p.id = pedido_id
        and p.loja_id = public.auth_loja_id()
    )
  )
  with check (
    exists (
      select 1 from public.pedidos p
      where p.id = pedido_id
        and p.loja_id = public.auth_loja_id()
    )
  );

-- ----------------------------------------------------------------------------
--  Realtime (Fase 5): o painel assina mudanças em `pedidos` via Supabase
--  Realtime. A tabela precisa estar na publicação `supabase_realtime`. O RLS
--  acima garante que cada usuário só recebe eventos da própria loja.
--  Idempotente: ignora o erro caso a tabela já esteja na publicação.
-- ----------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.pedidos;
exception
  when duplicate_object then null;
end $$;

-- REPLICA IDENTITY FULL: faz o Postgres enviar a LINHA INTEIRA (não só a PK)
-- nos eventos de UPDATE/DELETE. Necessário para o filtro `loja_id=eq.<loja>`
-- do Realtime funcionar em remoções — sem isso, DELETEs não chegam ao painel.
alter table public.pedidos replica identity full;
