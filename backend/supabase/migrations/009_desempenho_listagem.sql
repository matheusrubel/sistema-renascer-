-- Desempenho da listagem de cadastros e dos relatórios.
-- Aplicar no SQL Editor do Supabase depois da migration 008. É segura para repetir.

-- 1. Busca por trecho do nome, escola e bairro sem varrer a tabela inteira.
create extension if not exists pg_trgm with schema extensions;

create index if not exists pessoas_atendidas_nome_trgm_idx
  on public.pessoas_atendidas using gin (nome_completo extensions.gin_trgm_ops);
create index if not exists pessoas_atendidas_escola_trgm_idx
  on public.pessoas_atendidas using gin (escola extensions.gin_trgm_ops);
create index if not exists familias_bairro_trgm_idx
  on public.familias using gin (bairro extensions.gin_trgm_ops);

-- 2. Listagem ordenada por situação e data de criação.
create index if not exists pessoas_atendidas_status_criado_idx
  on public.pessoas_atendidas (status, criado_em desc);

-- 3. Chaves estrangeiras que o banco consulta ao montar a ficha completa.
create index if not exists responsaveis_pessoa_idx on public.responsaveis_familiares (pessoa_atendida_id);
create index if not exists responsaveis_familia_idx on public.responsaveis_familiares (familia_id);
create index if not exists pessoa_atividade_atividade_idx on public.pessoa_atividade_interesse (atividade_id);
create index if not exists pessoa_programa_programa_idx on public.pessoa_programa_interesse (programa_id);
create index if not exists pessoa_beneficio_beneficio_idx on public.pessoa_beneficio (beneficio_id);

-- 4. Uma página da listagem: filtra, conta e devolve só os ids da página pedida.
--    Roda com as permissões de quem chama (as políticas de acesso continuam valendo).
create or replace function public.listar_cadastros_ids(
  p_status text default 'ativo',
  p_busca text default '',
  p_faixa text default 'all',
  p_prioridade text default 'all',
  p_limite integer default 50,
  p_offset integer default 0
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with termo as (
    select '%' || replace(replace(replace(trim(coalesce(p_busca, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%' as padrao,
           nullif(trim(coalesce(p_busca, '')), '') is not null as filtrar
  ),
  filtrados as (
    select p.id, p.criado_em
    from public.pessoas_atendidas p
    left join public.familias f on f.id = p.familia_id
    cross join termo t
    where (p_status = 'todos' or p.status = p_status)
      and (not t.filtrar
           or p.nome_completo ilike t.padrao
           or p.escola ilike t.padrao
           or f.bairro ilike t.padrao)
      and (p_faixa = 'all'
           or (p_faixa = 'child' and p.data_nascimento > current_date - interval '12 years')
           or (p_faixa = 'teen' and p.data_nascimento <= current_date - interval '12 years'
                                and p.data_nascimento > current_date - interval '18 years')
           or (p_faixa = 'adult' and p.data_nascimento <= current_date - interval '18 years'))
      and (p_prioridade = 'all'
           or (p_prioridade = 'priority' and nullif(trim(p.situacao_prioritaria), '') is not null)
           or (p_prioridade = 'regular' and nullif(trim(p.situacao_prioritaria), '') is null))
  )
  select jsonb_build_object(
    'total', (select count(*) from filtrados),
    'ids', coalesce((
      select jsonb_agg(x.id order by x.criado_em desc, x.id)
      from (
        select id, criado_em from filtrados
        order by criado_em desc, id
        limit greatest(least(p_limite, 200), 1)
        offset greatest(p_offset, 0)
      ) x
    ), '[]'::jsonb)
  );
$$;

-- 5. Números dos cartões do topo, calculados no banco.
create or replace function public.estatisticas_cadastro(p_status text default 'ativo')
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'total', count(*),
    'menores', count(*) filter (where p.data_nascimento > current_date - interval '18 years'),
    'prioritarios', count(*) filter (where nullif(trim(p.situacao_prioritaria), '') is not null),
    'familias', count(distinct coalesce(p.familia_id, p.id))
  )
  from public.pessoas_atendidas p
  where p_status = 'todos' or p.status = p_status;
$$;

revoke all on function public.listar_cadastros_ids(text, text, text, text, integer, integer) from public;
revoke all on function public.estatisticas_cadastro(text) from public;
grant execute on function public.listar_cadastros_ids(text, text, text, text, integer, integer) to authenticated;
grant execute on function public.estatisticas_cadastro(text) to authenticated;

notify pgrst, 'reload schema';
