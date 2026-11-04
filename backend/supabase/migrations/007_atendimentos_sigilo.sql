-- Sistema Renascer | Módulo 3: atendimentos sociais e psicológicos
-- Aplicar no SQL Editor do Supabase depois da migration 006.
-- Regras baseadas na "Proposta de sigilo e perfis" (recomendações aprovadas):
--   * psicóloga: registra e lê o registro psicológico; lê o cadastro; não vê o social
--   * assistente social: registra e lê o registro social; lê o cadastro; não vê o psicológico
--   * coordenação (admin): lê o registro social e seus encaminhamentos; não vê o psicológico
--   * recepção: não acessa atendimentos
--   * nada é apagado: correções viram novas versões; só quem escreveu corrige
--   * quem abre o histórico fica registrado; pedidos externos (ex.: Vara da Infância) ficam registrados
--   * ausência: a coordenação libera acesso temporário de leitura a uma área
-- Não use dados reais de atendimento antes da validação final com a equipe.

-- 1. Novos perfis -----------------------------------------------------------
alter table public.perfis_acesso drop constraint if exists perfis_acesso_papel_check;
alter table public.perfis_acesso add constraint perfis_acesso_papel_check
  check (papel in ('admin', 'recepcao', 'tecnico_social', 'psicologo', 'assistente_social'));
-- 'tecnico_social' continua válido para quem já usa o cadastro; ele não acessa atendimentos.
-- Para liberar o módulo, troque o papel do usuário para 'psicologo' ou 'assistente_social'.

-- 2. Tabelas ---------------------------------------------------------------
create table if not exists public.tipos_atendimento (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ativo boolean not null default true
);

create table if not exists public.destinos_encaminhamento (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ativo boolean not null default true
);

insert into public.tipos_atendimento (nome) values
  ('Individual'), ('Família'), ('Visita domiciliar'), ('Contato com a rede')
on conflict (nome) do nothing;

insert into public.destinos_encaminhamento (nome) values
  ('CRAS'), ('CREAS'), ('Saúde (UBS/CAPS)'), ('Conselho Tutelar'), ('Escola'), ('Outro')
on conflict (nome) do nothing;

create table if not exists public.atendimentos (
  id uuid primary key default gen_random_uuid(),
  pessoa_atendida_id uuid not null references public.pessoas_atendidas (id) on delete restrict,
  area text not null check (area in ('social', 'psicologico')),
  profissional_id uuid not null default auth.uid() references auth.users (id),
  data_hora timestamptz not null default now(),
  tipo_id uuid references public.tipos_atendimento (id),
  criado_em timestamptz not null default now()
);
create index if not exists atendimentos_pessoa_idx on public.atendimentos (pessoa_atendida_id, data_hora desc);

-- Conteúdo em versões: o registro nunca é sobrescrito nem apagado.
create table if not exists public.atendimento_versoes (
  id uuid primary key default gen_random_uuid(),
  atendimento_id uuid not null references public.atendimentos (id) on delete restrict,
  versao integer not null check (versao > 0),
  motivo text,
  relato text,
  combinados text,
  criado_por uuid not null default auth.uid() references auth.users (id),
  criado_em timestamptz not null default now(),
  unique (atendimento_id, versao)
);

create table if not exists public.encaminhamentos (
  id uuid primary key default gen_random_uuid(),
  atendimento_id uuid not null references public.atendimentos (id) on delete restrict,
  destino_id uuid references public.destinos_encaminhamento (id),
  destino_outro text,
  data_encaminhamento date not null default current_date,
  criado_por uuid not null default auth.uid() references auth.users (id),
  criado_em timestamptz not null default now(),
  check (destino_id is not null or nullif(trim(destino_outro), '') is not null)
);
create index if not exists encaminhamentos_atendimento_idx on public.encaminhamentos (atendimento_id);

-- Situação e retorno do encaminhamento: cada mudança é um novo evento.
create table if not exists public.encaminhamento_eventos (
  id uuid primary key default gen_random_uuid(),
  encaminhamento_id uuid not null references public.encaminhamentos (id) on delete restrict,
  situacao text not null check (situacao in ('encaminhado', 'em_andamento', 'concluido', 'sem_retorno')),
  retorno text,
  criado_por uuid not null default auth.uid() references auth.users (id),
  criado_em timestamptz not null default now()
);
create index if not exists encaminhamento_eventos_idx on public.encaminhamento_eventos (encaminhamento_id, criado_em desc);

create table if not exists public.acessos_temporarios (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users (id) on delete cascade,
  area text not null check (area in ('social', 'psicologico')),
  valido_ate timestamptz not null,
  revogado boolean not null default false,
  concedido_por uuid not null default auth.uid() references auth.users (id),
  concedido_em timestamptz not null default now(),
  check (valido_ate > concedido_em)
);

-- Quem abriu o histórico de uma pessoa (sem conteúdo).
create table if not exists public.acessos_historico (
  id uuid primary key default gen_random_uuid(),
  pessoa_atendida_id uuid not null references public.pessoas_atendidas (id) on delete restrict,
  area text not null check (area in ('social', 'psicologico')),
  usuario_id uuid not null default auth.uid() references auth.users (id),
  acessado_em timestamptz not null default now()
);
create index if not exists acessos_historico_pessoa_idx on public.acessos_historico (pessoa_atendida_id, acessado_em desc);

-- Emissões de histórico para terceiros (ex.: Vara da Infância).
create table if not exists public.emissoes_historico (
  id uuid primary key default gen_random_uuid(),
  pessoa_atendida_id uuid not null references public.pessoas_atendidas (id) on delete restrict,
  area text not null check (area in ('social', 'psicologico')),
  destinatario text not null check (length(trim(destinatario)) > 1),
  emitido_por uuid not null default auth.uid() references auth.users (id),
  emitido_em timestamptz not null default now()
);

-- 3. Funções de apoio para as regras de acesso ------------------------------
create or replace function public.papel_atual()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.papel from public.perfis_acesso p
  where p.user_id = (select auth.uid()) and p.ativo
  limit 1;
$$;

-- Leitura: psicologia só para psicóloga; social para assistente social e coordenação;
-- ou acesso temporário concedido pela coordenação.
create or replace function public.pode_ler_atendimentos(p_area text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    case p_area
      when 'psicologico' then (select public.papel_atual()) = 'psicologo'
      when 'social' then (select public.papel_atual()) in ('assistente_social', 'admin')
      else false
    end, false)
  or exists (
    select 1 from public.acessos_temporarios t
    where t.usuario_id = (select auth.uid()) and t.area = p_area
      and not t.revogado and t.valido_ate > now()
  );
$$;

-- Escrita: somente a profissional da própria área (acesso temporário é só leitura).
create or replace function public.pode_escrever_area(p_area text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    case p_area
      when 'psicologico' then (select public.papel_atual()) = 'psicologo'
      when 'social' then (select public.papel_atual()) = 'assistente_social'
      else false
    end, false);
$$;

create or replace function public.area_do_atendimento(p_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$ select a.area from public.atendimentos a where a.id = p_id; $$;

create or replace function public.atendimento_e_meu(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.atendimentos a where a.id = p_id and a.profissional_id = (select auth.uid()));
$$;

create or replace function public.area_do_encaminhamento(p_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select a.area from public.encaminhamentos e
  join public.atendimentos a on a.id = e.atendimento_id
  where e.id = p_id;
$$;

create or replace function public.encaminhamento_e_meu(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.encaminhamentos e
    join public.atendimentos a on a.id = e.atendimento_id
    where e.id = p_id and a.profissional_id = (select auth.uid())
  );
$$;

create or replace function public.nome_profissional(p_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$ select p.nome from public.perfis_acesso p where p.user_id = p_id; $$;

do $$
declare f text;
begin
  foreach f in array array[
    'papel_atual()', 'pode_ler_atendimentos(text)', 'pode_escrever_area(text)',
    'area_do_atendimento(uuid)', 'atendimento_e_meu(uuid)', 'area_do_encaminhamento(uuid)',
    'encaminhamento_e_meu(uuid)', 'nome_profissional(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- O primeiro evento do encaminhamento ("encaminhado") nasce junto com ele.
create or replace function public.criar_evento_inicial_encaminhamento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.encaminhamento_eventos (encaminhamento_id, situacao, criado_por)
  values (new.id, 'encaminhado', new.criado_por);
  return new;
end;
$$;

drop trigger if exists encaminhamentos_evento_inicial on public.encaminhamentos;
create trigger encaminhamentos_evento_inicial
after insert on public.encaminhamentos
for each row execute function public.criar_evento_inicial_encaminhamento();

-- 4. Segurança em nível de linha ----------------------------------------------
alter table public.tipos_atendimento enable row level security;
alter table public.destinos_encaminhamento enable row level security;
alter table public.atendimentos enable row level security;
alter table public.atendimento_versoes enable row level security;
alter table public.encaminhamentos enable row level security;
alter table public.encaminhamento_eventos enable row level security;
alter table public.acessos_temporarios enable row level security;
alter table public.acessos_historico enable row level security;
alter table public.emissoes_historico enable row level security;

-- Catálogos: leitura para quem acessa atendimentos; coordenação gerencia.
drop policy if exists "consulta tipos de atendimento" on public.tipos_atendimento;
create policy "consulta tipos de atendimento" on public.tipos_atendimento
for select to authenticated using (ativo);
drop policy if exists "admin gerencia tipos de atendimento" on public.tipos_atendimento;
create policy "admin gerencia tipos de atendimento" on public.tipos_atendimento
for all to authenticated
using ((select public.usuario_tem_papel(array['admin'])))
with check ((select public.usuario_tem_papel(array['admin'])));

drop policy if exists "consulta destinos de encaminhamento" on public.destinos_encaminhamento;
create policy "consulta destinos de encaminhamento" on public.destinos_encaminhamento
for select to authenticated using (ativo);
drop policy if exists "admin gerencia destinos de encaminhamento" on public.destinos_encaminhamento;
create policy "admin gerencia destinos de encaminhamento" on public.destinos_encaminhamento
for all to authenticated
using ((select public.usuario_tem_papel(array['admin'])))
with check ((select public.usuario_tem_papel(array['admin'])));

-- Atendimentos: só se insere (como profissional da própria área). Sem update nem delete.
drop policy if exists "le atendimentos da area permitida" on public.atendimentos;
create policy "le atendimentos da area permitida" on public.atendimentos
for select to authenticated using ((select public.pode_ler_atendimentos(area)));
drop policy if exists "profissional registra atendimento da propria area" on public.atendimentos;
create policy "profissional registra atendimento da propria area" on public.atendimentos
for insert to authenticated
with check (profissional_id = (select auth.uid()) and (select public.pode_escrever_area(area)));

drop policy if exists "le versoes da area permitida" on public.atendimento_versoes;
create policy "le versoes da area permitida" on public.atendimento_versoes
for select to authenticated using ((select public.pode_ler_atendimentos(public.area_do_atendimento(atendimento_id))));
drop policy if exists "autor registra versao do proprio atendimento" on public.atendimento_versoes;
create policy "autor registra versao do proprio atendimento" on public.atendimento_versoes
for insert to authenticated
with check (criado_por = (select auth.uid()) and (select public.atendimento_e_meu(atendimento_id)));

drop policy if exists "le encaminhamentos da area permitida" on public.encaminhamentos;
create policy "le encaminhamentos da area permitida" on public.encaminhamentos
for select to authenticated using ((select public.pode_ler_atendimentos(public.area_do_atendimento(atendimento_id))));
drop policy if exists "autor registra encaminhamento do proprio atendimento" on public.encaminhamentos;
create policy "autor registra encaminhamento do proprio atendimento" on public.encaminhamentos
for insert to authenticated
with check (criado_por = (select auth.uid()) and (select public.atendimento_e_meu(atendimento_id)));

drop policy if exists "le eventos da area permitida" on public.encaminhamento_eventos;
create policy "le eventos da area permitida" on public.encaminhamento_eventos
for select to authenticated using ((select public.pode_ler_atendimentos(public.area_do_encaminhamento(encaminhamento_id))));
drop policy if exists "autor registra evento do proprio encaminhamento" on public.encaminhamento_eventos;
create policy "autor registra evento do proprio encaminhamento" on public.encaminhamento_eventos
for insert to authenticated
with check (criado_por = (select auth.uid()) and (select public.encaminhamento_e_meu(encaminhamento_id)));

-- Acessos temporários: somente a coordenação concede, consulta e revoga.
drop policy if exists "admin gerencia acessos temporarios" on public.acessos_temporarios;
create policy "admin gerencia acessos temporarios" on public.acessos_temporarios
for all to authenticated
using ((select public.usuario_tem_papel(array['admin'])))
with check ((select public.usuario_tem_papel(array['admin'])));

-- Registro de acesso: cada pessoa só registra o próprio; lê quem pode ler a área.
drop policy if exists "registra o proprio acesso ao historico" on public.acessos_historico;
create policy "registra o proprio acesso ao historico" on public.acessos_historico
for insert to authenticated
with check (usuario_id = (select auth.uid()) and (select public.pode_ler_atendimentos(area)));
drop policy if exists "le acessos da area permitida" on public.acessos_historico;
create policy "le acessos da area permitida" on public.acessos_historico
for select to authenticated using ((select public.pode_ler_atendimentos(area)));

drop policy if exists "profissional registra emissao da propria area" on public.emissoes_historico;
create policy "profissional registra emissao da propria area" on public.emissoes_historico
for insert to authenticated
with check (emitido_por = (select auth.uid()) and (select public.pode_escrever_area(area)));
drop policy if exists "le emissoes da area permitida" on public.emissoes_historico;
create policy "le emissoes da area permitida" on public.emissoes_historico
for select to authenticated using ((select public.pode_ler_atendimentos(area)));

-- Privilégios: nenhuma tabela de atendimento tem update ou delete (nada é apagado).
grant select on public.tipos_atendimento, public.destinos_encaminhamento to authenticated;
grant insert, update on public.tipos_atendimento, public.destinos_encaminhamento to authenticated;
grant select, insert on public.atendimentos, public.atendimento_versoes to authenticated;
grant select, insert on public.encaminhamentos, public.encaminhamento_eventos to authenticated;
grant select, insert, update on public.acessos_temporarios to authenticated;
grant select, insert on public.acessos_historico, public.emissoes_historico to authenticated;

-- 5. Psicóloga e assistente social leem o cadastro (sem editar) ------------------
do $$
declare t text;
begin
  foreach t in array array[
    'familias', 'pessoas_atendidas', 'consentimentos_cadastro', 'responsaveis_familiares',
    'pessoa_atividade_interesse', 'pessoa_programa_interesse', 'pessoa_beneficio'
  ] loop
    execute format('drop policy if exists "profissionais leem cadastro" on public.%I', t);
    execute format(
      'create policy "profissionais leem cadastro" on public.%I for select to authenticated using ((select public.usuario_tem_papel(array[''psicologo'', ''assistente_social''])))',
      t);
  end loop;
end $$;

-- Foto de identificação e termo: leitura também para esses dois perfis.
drop policy if exists "profissionais leem arquivos de cadastro" on storage.objects;
create policy "profissionais leem arquivos de cadastro"
on storage.objects for select to authenticated
using (
  bucket_id = 'cadastros-privados'
  and (select public.usuario_tem_papel(array['psicologo', 'assistente_social']))
);

-- 6. Operações atômicas -----------------------------------------------------------
create or replace function public.registrar_atendimento(
  p_pessoa uuid,
  p_area text,
  p_data_hora timestamptz,
  p_tipo uuid,
  p_motivo text,
  p_relato text,
  p_combinados text,
  p_encaminhamentos jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_item jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'É necessário entrar no sistema.' using errcode = '42501';
  end if;
  if not (select public.pode_escrever_area(p_area)) then
    raise exception 'Seu perfil não registra atendimentos desta área.' using errcode = '42501';
  end if;

  insert into public.atendimentos (pessoa_atendida_id, area, data_hora, tipo_id)
  values (p_pessoa, p_area, coalesce(p_data_hora, now()), p_tipo)
  returning id into v_id;

  insert into public.atendimento_versoes (atendimento_id, versao, motivo, relato, combinados)
  values (v_id, 1, nullif(trim(p_motivo), ''), nullif(trim(p_relato), ''), nullif(trim(p_combinados), ''));

  for v_item in select * from jsonb_array_elements(coalesce(p_encaminhamentos, '[]'::jsonb)) loop
    insert into public.encaminhamentos (atendimento_id, destino_id, destino_outro, data_encaminhamento)
    values (
      v_id,
      nullif(v_item->>'destino_id', '')::uuid,
      nullif(trim(v_item->>'destino_outro'), ''),
      coalesce(nullif(v_item->>'data', '')::date, current_date)
    );
  end loop;

  return v_id;
end;
$$;

-- Correção = nova versão. Somente quem registrou o atendimento corrige.
create or replace function public.corrigir_atendimento(
  p_atendimento uuid,
  p_motivo text,
  p_relato text,
  p_combinados text
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_proxima integer;
begin
  if not (select public.atendimento_e_meu(p_atendimento)) then
    raise exception 'Somente quem registrou o atendimento pode corrigi-lo.' using errcode = '42501';
  end if;
  select coalesce(max(versao), 0) + 1 into v_proxima
  from public.atendimento_versoes where atendimento_id = p_atendimento;

  insert into public.atendimento_versoes (atendimento_id, versao, motivo, relato, combinados)
  values (p_atendimento, v_proxima, nullif(trim(p_motivo), ''), nullif(trim(p_relato), ''), nullif(trim(p_combinados), ''));
  return v_proxima;
end;
$$;

-- Histórico da pessoa: devolve somente o que o perfil pode ver e registra o acesso.
create or replace function public.listar_historico_atendimentos(p_pessoa uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_area text;
  v_resultado jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'É necessário entrar no sistema.' using errcode = '42501';
  end if;

  foreach v_area in array array['social', 'psicologico'] loop
    if (select public.pode_ler_atendimentos(v_area)) then
      insert into public.acessos_historico (pessoa_atendida_id, area) values (p_pessoa, v_area);
    end if;
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id,
    'area', a.area,
    'data_hora', a.data_hora,
    'tipo', t.nome,
    'profissional', (select public.nome_profissional(a.profissional_id)),
    'meu', a.profissional_id = (select auth.uid()),
    'versao', v.versao,
    'total_versoes', (select count(*) from public.atendimento_versoes x where x.atendimento_id = a.id),
    'atualizado_em', v.criado_em,
    'motivo', v.motivo,
    'relato', v.relato,
    'combinados', v.combinados,
    'encaminhamentos', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', e.id,
        'destino', coalesce(d.nome, e.destino_outro),
        'destino_outro', e.destino_outro,
        'data', e.data_encaminhamento,
        'situacao', ev.situacao,
        'retorno', ev.retorno
      ) order by e.criado_em), '[]'::jsonb)
      from public.encaminhamentos e
      left join public.destinos_encaminhamento d on d.id = e.destino_id
      left join lateral (
        select situacao, retorno from public.encaminhamento_eventos
        where encaminhamento_id = e.id order by criado_em desc limit 1
      ) ev on true
      where e.atendimento_id = a.id
    )
  ) order by a.data_hora desc), '[]'::jsonb)
  into v_resultado
  from public.atendimentos a
  join lateral (
    select * from public.atendimento_versoes where atendimento_id = a.id order by versao desc limit 1
  ) v on true
  left join public.tipos_atendimento t on t.id = a.tipo_id
  where a.pessoa_atendida_id = p_pessoa;

  return v_resultado;
end;
$$;

revoke all on function public.registrar_atendimento(uuid, text, timestamptz, uuid, text, text, text, jsonb) from public;
revoke all on function public.corrigir_atendimento(uuid, text, text, text) from public;
revoke all on function public.listar_historico_atendimentos(uuid) from public;
grant execute on function public.registrar_atendimento(uuid, text, timestamptz, uuid, text, text, text, jsonb) to authenticated;
grant execute on function public.corrigir_atendimento(uuid, text, text, text) to authenticated;
grant execute on function public.listar_historico_atendimentos(uuid) to authenticated;

notify pgrst, 'reload schema';
