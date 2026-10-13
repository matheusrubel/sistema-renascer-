-- Recebe pedidos de acesso sem criar automaticamente usuários autenticados.
create table if not exists public.solicitacoes_acesso (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) between 2 and 140),
  email text not null check (length(trim(email)) <= 180),
  area text not null check (area in ('Recepção', 'Equipe técnica social', 'Administração')),
  status text not null default 'pendente' check (status in ('pendente', 'aprovada', 'recusada')),
  criado_em timestamptz not null default now(),
  revisado_em timestamptz,
  revisado_por uuid references auth.users (id)
);

create unique index if not exists solicitacoes_acesso_email_pendente_idx
  on public.solicitacoes_acesso (lower(email)) where status = 'pendente';

alter table public.solicitacoes_acesso enable row level security;

create policy "solicitantes podem pedir acesso"
  on public.solicitacoes_acesso for insert to anon
  with check (status = 'pendente');

create policy "admin consulta e revisa pedidos de acesso"
  on public.solicitacoes_acesso for all to authenticated
  using ((select public.usuario_tem_papel(array['admin'])))
  with check ((select public.usuario_tem_papel(array['admin'])));

grant insert (nome, email, area) on public.solicitacoes_acesso to anon;
grant select, update on public.solicitacoes_acesso to authenticated;
