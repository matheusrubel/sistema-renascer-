-- Sistema Renascer | Módulo 1: cadastro e recepção
-- Aplicar no SQL Editor do Supabase depois de revisar a configuração do projeto.
-- Não armazene conteúdo de atendimentos sociais/psicológicos nesta tabela.

create extension if not exists pgcrypto;

create table if not exists public.perfis_acesso (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  papel text not null check (papel in ('admin', 'recepcao', 'tecnico_social')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users (id)
);

create or replace function public.usuario_tem_papel(papeis text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.perfis_acesso p
    where p.user_id = (select auth.uid())
      and p.ativo
      and p.papel = any (papeis)
  );
$$;

revoke all on function public.usuario_tem_papel(text[]) from public;
grant execute on function public.usuario_tem_papel(text[]) to authenticated;

create table if not exists public.familias (
  id uuid primary key default gen_random_uuid(),
  endereco text,
  bairro text,
  ponto_referencia text,
  telefone text,
  quantidade_moradores smallint check (quantidade_moradores is null or quantidade_moradores > 0),
  criado_por uuid not null default auth.uid() references auth.users (id),
  atualizado_por uuid references auth.users (id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  ativo boolean not null default true
);

create table if not exists public.pessoas_atendidas (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid references public.familias (id) on delete set null,
  nome_completo text not null check (length(trim(nome_completo)) between 2 and 140),
  data_nascimento date not null,
  sexo text check (sexo is null or sexo in ('Feminino', 'Masculino', 'Outro', 'Não informado')),
  rg text,
  nis text,
  cpf text,
  telefone text,
  escola text,
  serie_ano text,
  turno text check (turno is null or turno in ('Manhã', 'Tarde', 'Noite', 'Integral')),
  foto_storage_path text,
  estado_civil text,
  carteira_trabalho boolean,
  forma_entrada text not null check (forma_entrada in (
    'Procura espontânea', 'Busca ativa', 'Escola', 'Conselho Tutelar',
    'Rede socioassistencial', 'Outra política pública', 'Outra instituição'
  )),
  encaminhado_por text,
  motivo_encaminhamento text,
  situacao_prioritaria text,
  observacoes_gerais text,
  status text not null default 'ativo' check (status in ('ativo', 'inativo')),
  criado_por uuid not null default auth.uid() references auth.users (id),
  atualizado_por uuid references auth.users (id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists pessoas_atendidas_nome_idx
  on public.pessoas_atendidas (lower(nome_completo));
create index if not exists pessoas_atendidas_familia_idx
  on public.pessoas_atendidas (familia_id);
create index if not exists pessoas_atendidas_nascimento_idx
  on public.pessoas_atendidas (data_nascimento);
create index if not exists familias_bairro_idx
  on public.familias (lower(bairro));

create table if not exists public.consentimentos_cadastro (
  id uuid primary key default gen_random_uuid(),
  pessoa_atendida_id uuid not null references public.pessoas_atendidas (id) on delete cascade,
  status text not null default 'pendente' check (status in ('pendente', 'assinado', 'nao_autorizado')),
  versao_termo text,
  assinado_em timestamptz,
  documento_storage_path text,
  observacao text,
  criado_por uuid not null default auth.uid() references auth.users (id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users (id),
  check (status <> 'assinado' or assinado_em is not null)
);
create index if not exists consentimentos_pessoa_idx
  on public.consentimentos_cadastro (pessoa_atendida_id, criado_em desc);

create table if not exists public.responsaveis_familiares (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null references public.familias (id) on delete cascade,
  pessoa_atendida_id uuid references public.pessoas_atendidas (id) on delete set null,
  nome_completo text not null check (length(trim(nome_completo)) between 2 and 140),
  parentesco text,
  data_nascimento date,
  trabalha boolean,
  trabalho_ou_fonte_renda text,
  criado_por uuid not null default auth.uid() references auth.users (id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.catalogo_atividades (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

insert into public.catalogo_atividades (nome) values
  ('Oficina de Música e Cultura'),
  ('Oficina de Judô'),
  ('Oficina de Informática'),
  ('Oficinas Lúdicas'),
  ('Oficina de Dança e Recreativa'),
  ('Oficina de Jogos Educativos e Interativos'),
  ('Oficina de Corte e Costura'),
  ('Grupo de Apoio à Criança - GAC'),
  ('Grupo de Apoio ao Adolescente - GAA'),
  ('Grupo de Apoio à Família - GAF')
on conflict (nome) do nothing;

create table if not exists public.pessoa_atividade_interesse (
  pessoa_atendida_id uuid not null references public.pessoas_atendidas (id) on delete cascade,
  atividade_id uuid not null references public.catalogo_atividades (id) on delete restrict,
  criado_por uuid not null default auth.uid() references auth.users (id),
  criado_em timestamptz not null default now(),
  primary key (pessoa_atendida_id, atividade_id)
);

create table if not exists public.catalogo_programas (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
insert into public.catalogo_programas (nome) values
  ('Programa de Promoção e Apoio Sócio Familiar'),
  ('Projeto Mãos que Transformam'),
  ('Projeto Entrelaços')
on conflict (nome) do nothing;

create table if not exists public.pessoa_programa_interesse (
  pessoa_atendida_id uuid not null references public.pessoas_atendidas (id) on delete cascade,
  programa_id uuid not null references public.catalogo_programas (id) on delete restrict,
  criado_por uuid not null default auth.uid() references auth.users (id),
  criado_em timestamptz not null default now(),
  primary key (pessoa_atendida_id, programa_id)
);

create table if not exists public.catalogo_beneficios (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

insert into public.catalogo_beneficios (nome) values
  ('Leite das Crianças'),
  ('Programa Auxílio Brasil'),
  ('Benefício de Prestação Continuada - BPC'),
  ('Outro benefício')
on conflict (nome) do nothing;

create table if not exists public.pessoa_beneficio (
  pessoa_atendida_id uuid not null references public.pessoas_atendidas (id) on delete cascade,
  beneficio_id uuid not null references public.catalogo_beneficios (id) on delete restrict,
  detalhe_outro text,
  criado_por uuid not null default auth.uid() references auth.users (id),
  criado_em timestamptz not null default now(),
  primary key (pessoa_atendida_id, beneficio_id),
  check (beneficio_id is not null)
);

-- Alterações relevantes podem ser rastreadas sem duplicar o conteúdo pessoal.
create or replace function public.atualizar_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em = now();
  new.atualizado_por = (select auth.uid());
  return new;
end;
$$;

drop trigger if exists familias_atualizado_em on public.familias;
create trigger familias_atualizado_em before update on public.familias
for each row execute function public.atualizar_atualizado_em();

drop trigger if exists pessoas_atendidas_atualizado_em on public.pessoas_atendidas;
create trigger pessoas_atendidas_atualizado_em before update on public.pessoas_atendidas
for each row execute function public.atualizar_atualizado_em();

drop trigger if exists consentimentos_cadastro_atualizado_em on public.consentimentos_cadastro;
create trigger consentimentos_cadastro_atualizado_em before update on public.consentimentos_cadastro
for each row execute function public.atualizar_atualizado_em();

drop trigger if exists perfis_acesso_atualizado_em on public.perfis_acesso;
create trigger perfis_acesso_atualizado_em before update on public.perfis_acesso
for each row execute function public.atualizar_atualizado_em();

alter table public.perfis_acesso enable row level security;
alter table public.familias enable row level security;
alter table public.pessoas_atendidas enable row level security;
alter table public.consentimentos_cadastro enable row level security;
alter table public.responsaveis_familiares enable row level security;
alter table public.catalogo_atividades enable row level security;
alter table public.pessoa_atividade_interesse enable row level security;
alter table public.catalogo_programas enable row level security;
alter table public.pessoa_programa_interesse enable row level security;
alter table public.catalogo_beneficios enable row level security;
alter table public.pessoa_beneficio enable row level security;

create policy "perfil pode ver a si ou admin pode ver perfis"
on public.perfis_acesso for select to authenticated
using (user_id = (select auth.uid()) or (select public.usuario_tem_papel(array['admin'])));

create policy "admin gerencia perfis"
on public.perfis_acesso for all to authenticated
using ((select public.usuario_tem_papel(array['admin'])))
with check ((select public.usuario_tem_papel(array['admin'])));

create policy "equipe autorizada acessa familias"
on public.familias for all to authenticated
using ((select public.usuario_tem_papel(array['admin', 'recepcao', 'tecnico_social'])))
with check ((select public.usuario_tem_papel(array['admin', 'recepcao', 'tecnico_social'])));

create policy "equipe autorizada acessa cadastros"
on public.pessoas_atendidas for all to authenticated
using ((select public.usuario_tem_papel(array['admin', 'recepcao', 'tecnico_social'])))
with check ((select public.usuario_tem_papel(array['admin', 'recepcao', 'tecnico_social'])));

create policy "equipe autorizada acessa consentimentos"
on public.consentimentos_cadastro for all to authenticated
using ((select public.usuario_tem_papel(array['admin', 'recepcao', 'tecnico_social'])))
with check ((select public.usuario_tem_papel(array['admin', 'recepcao', 'tecnico_social'])));

create policy "equipe autorizada acessa responsaveis"
on public.responsaveis_familiares for all to authenticated
using ((select public.usuario_tem_papel(array['admin', 'recepcao', 'tecnico_social'])))
with check ((select public.usuario_tem_papel(array['admin', 'recepcao', 'tecnico_social'])));

create policy "usuarios autenticados consultam atividades ativas"
on public.catalogo_atividades for select to authenticated using (ativo);
create policy "admin gerencia atividades"
on public.catalogo_atividades for all to authenticated
using ((select public.usuario_tem_papel(array['admin'])))
with check ((select public.usuario_tem_papel(array['admin'])));

create policy "equipe autorizada acessa interesses"
on public.pessoa_atividade_interesse for all to authenticated
using ((select public.usuario_tem_papel(array['admin', 'recepcao', 'tecnico_social'])))
with check ((select public.usuario_tem_papel(array['admin', 'recepcao', 'tecnico_social'])));

create policy "usuarios autenticados consultam programas ativos"
on public.catalogo_programas for select to authenticated using (ativo);
create policy "admin gerencia programas"
on public.catalogo_programas for all to authenticated
using ((select public.usuario_tem_papel(array['admin'])))
with check ((select public.usuario_tem_papel(array['admin'])));
create policy "equipe autorizada acessa programas de interesse"
on public.pessoa_programa_interesse for all to authenticated
using ((select public.usuario_tem_papel(array['admin', 'recepcao', 'tecnico_social'])))
with check ((select public.usuario_tem_papel(array['admin', 'recepcao', 'tecnico_social'])));

create policy "usuarios autenticados consultam beneficios ativos"
on public.catalogo_beneficios for select to authenticated using (ativo);
create policy "admin gerencia beneficios"
on public.catalogo_beneficios for all to authenticated
using ((select public.usuario_tem_papel(array['admin'])))
with check ((select public.usuario_tem_papel(array['admin'])));

create policy "equipe autorizada acessa beneficios informados"
on public.pessoa_beneficio for all to authenticated
using ((select public.usuario_tem_papel(array['admin', 'recepcao', 'tecnico_social'])))
with check ((select public.usuario_tem_papel(array['admin', 'recepcao', 'tecnico_social'])));

grant usage on schema public to authenticated;
grant select, insert, update on public.perfis_acesso to authenticated;
grant select, insert, update on public.familias to authenticated;
grant select, insert, update on public.pessoas_atendidas to authenticated;
grant select, insert, update on public.consentimentos_cadastro to authenticated;
grant select, insert, update on public.responsaveis_familiares to authenticated;
grant select, insert, update on public.catalogo_atividades to authenticated;
grant select, insert, update, delete on public.pessoa_atividade_interesse to authenticated;
grant select, insert, update on public.catalogo_programas to authenticated;
grant select, insert, update, delete on public.pessoa_programa_interesse to authenticated;
grant select, insert, update on public.catalogo_beneficios to authenticated;
grant select, insert, update, delete on public.pessoa_beneficio to authenticated;

-- Criação do primeiro administrador:
-- 1. Crie/convide a conta em Authentication > Users.
-- 2. Insira o UUID e nome em perfis_acesso usando a conta/projeto administrativo:
-- insert into public.perfis_acesso (user_id, nome, papel)
-- values ('UUID_DO_USUARIO_AUTH', 'Nome do administrador', 'admin');
-- Não habilite cadastro público de usuários para esta aplicação institucional.
