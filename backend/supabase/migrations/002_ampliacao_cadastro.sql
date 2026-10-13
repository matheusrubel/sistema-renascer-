-- Amplia o cadastro para os campos das fichas de referência.
-- Migration aditiva: preserva os cadastros já existentes.

alter table public.familias
  add column if not exists cep text,
  add column if not exists estado text,
  add column if not exists municipio text,
  add column if not exists logradouro text,
  add column if not exists numero_endereco text,
  add column if not exists complemento text,
  add column if not exists mora_desde_ano smallint,
  add column if not exists area_risco boolean,
  add column if not exists tipo_moradia text,
  add column if not exists numero_comodos smallint,
  add column if not exists material_paredes text,
  add column if not exists material_piso text,
  add column if not exists material_telhado text,
  add column if not exists abastecimento_agua text,
  add column if not exists forma_iluminacao text,
  add column if not exists destino_esgoto text,
  add column if not exists destino_lixo text,
  add column if not exists cadunico boolean,
  add column if not exists despesas_mensais jsonb not null default '{}'::jsonb,
  add column if not exists uso_substancias_psicoativas text,
  add column if not exists criado_em_cadastro date;

alter table public.pessoas_atendidas
  add column if not exists emissor_rg text,
  add column if not exists serie_carteira_trabalho text,
  add column if not exists titulo_eleitor text,
  add column if not exists email text,
  add column if not exists telefone_whatsapp boolean,
  add column if not exists situacao_escolar text,
  add column if not exists instituicao_ensino text,
  add column if not exists religiao text,
  add column if not exists naturalidade text,
  add column if not exists nacionalidade text,
  add column if not exists pode_sair_sozinho boolean,
  add column if not exists condicoes_saude text[] not null default '{}',
  add column if not exists outra_condicao_saude text,
  add column if not exists alergias text[] not null default '{}',
  add column if not exists detalhe_alergias text,
  add column if not exists usa_medicacao boolean,
  add column if not exists medicacoes text,
  add column if not exists deficiencias text[] not null default '{}',
  add column if not exists contato_emergencia_nome text,
  add column if not exists contato_emergencia_telefone text,
  add column if not exists uso_substancias_psicoativas text,
  add column if not exists demanda text[] not null default '{}',
  add column if not exists forma_acesso text,
  add column if not exists data_entrada date,
  add column if not exists grupos_desejados text,
  add column if not exists outros_vinculos text,
  add column if not exists contato_adicional_nome text,
  add column if not exists contato_adicional_telefone text,
  add column if not exists contato_adicional_vinculo text,
  add column if not exists procura_trabalho boolean,
  add column if not exists profissao_atual text,
  add column if not exists empresa_atual text,
  add column if not exists remuneracao_atual numeric(12,2) check (remuneracao_atual is null or remuneracao_atual >= 0),
  add column if not exists telefone_trabalho text,
  add column if not exists historico_profissional text;

alter table public.responsaveis_familiares
  add column if not exists telefone text,
  add column if not exists whatsapp boolean,
  add column if not exists email text;

alter table public.catalogo_beneficios
  add column if not exists categoria text not null default 'social';

insert into public.catalogo_beneficios (nome, categoria) values
  ('Aluguel Social', 'social'),
  ('Aposentadoria', 'previdenciario'),
  ('Auxílio Acidente', 'previdenciario'),
  ('Auxílio Doença', 'previdenciario'),
  ('Auxílio Reclusão', 'previdenciario'),
  ('Bolsa Família', 'social'),
  ('Cartão Alimentação', 'social'),
  ('Pensão por Morte', 'previdenciario')
on conflict (nome) do nothing;

create index if not exists familias_municipio_bairro_idx
  on public.familias (lower(municipio), lower(bairro));
create index if not exists pessoas_atendidas_escola_idx
  on public.pessoas_atendidas (lower(escola));

comment on column public.pessoas_atendidas.condicoes_saude is
  'Informações declaradas para o cadastro. Não armazenar notas de atendimento clínico ou psicológico.';
comment on column public.familias.despesas_mensais is
  'Valores mensais informados por categoria: água_esgoto, aluguel, energia, alimentação, empréstimos, combustível, medicamentos e transporte.';
