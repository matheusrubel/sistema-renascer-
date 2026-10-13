-- Dados fictícios de validação visual. Não representam pessoas reais.
-- Reexecutável: usa IDs fixos com prefixo 00000000-0000-4000-8000-... e atualiza só esses registros.
-- Execute depois das migrations 001 e 002 no SQL Editor do Supabase.
-- A conta admin precisa existir em Auth e em perfis_acesso antes da execução.

do $$
declare
  v_autor uuid;
begin
  select user_id into v_autor
  from public.perfis_acesso
  where ativo and papel in ('admin', 'recepcao', 'tecnico_social')
  order by case papel when 'admin' then 1 when 'recepcao' then 2 else 3 end
  limit 1;

  if v_autor is null then
    raise exception 'Crie primeiro um usuário autenticado e um perfil ativo em public.perfis_acesso.';
  end if;

  insert into public.familias (
    id, endereco, bairro, ponto_referencia, telefone, quantidade_moradores,
    cep, estado, municipio, logradouro, numero_endereco, complemento,
    mora_desde_ano, area_risco, tipo_moradia, numero_comodos,
    material_paredes, material_piso, material_telhado, abastecimento_agua,
    forma_iluminacao, destino_esgoto, destino_lixo, cadunico, despesas_mensais,
    criado_em_cadastro, criado_por
  ) values
    ('00000000-0000-4000-8000-000000000101', 'Rua das Araucárias, 145', 'Morro Alto', 'Próximo à escola municipal', '(42) 99900-0101', 4,
     '85065-370', 'Paraná', 'Guarapuava', 'Rua das Araucárias', '145', 'Casa dos fundos',
     2018, false, 'Alugada', 5, 'Alvenaria', 'Cerâmica', 'Fibrocimento', 'Rede pública', 'Energia elétrica', 'Rede pública', 'Coleta pública', true,
     '{"agua_esgoto":92.50,"aluguel":650,"energia":118.40,"alimentacao":780,"emprestimos":0,"combustivel":95,"medicamentos":65,"transporte":120}',
     current_date - 40, v_autor),
    ('00000000-0000-4000-8000-000000000102', 'Rua das Palmeiras, 82', 'Vila Bela', 'Em frente ao campo', '(42) 99900-0102', 3,
     '85070-120', 'Paraná', 'Guarapuava', 'Rua das Palmeiras', '82', null,
     2021, false, 'Própria', 4, 'Madeira', 'Cimento', 'Telha cerâmica', 'Poço', 'Energia elétrica', 'Fossa séptica', 'Coleta pública', true,
     '{"agua_esgoto":45,"aluguel":0,"energia":96.20,"alimentacao":620,"emprestimos":150,"combustivel":80,"medicamentos":0,"transporte":90}',
     current_date - 24, v_autor),
    ('00000000-0000-4000-8000-000000000103', 'Avenida dos Ipês, 930', 'Conradinho', 'Perto da unidade de saúde', '(42) 99900-0103', 5,
     '85055-210', 'Paraná', 'Guarapuava', 'Avenida dos Ipês', '930', 'Bloco B',
     2016, true, 'Cedida', 6, 'Alvenaria', 'Cerâmica', 'Laje', 'Rede pública', 'Energia elétrica', 'Rede pública', 'Coleta pública', false,
     '{"agua_esgoto":110,"aluguel":0,"energia":154.80,"alimentacao":980,"emprestimos":230,"combustivel":0,"medicamentos":120,"transporte":180}',
     current_date - 12, v_autor)
  on conflict (id) do update set
    endereco = excluded.endereco, bairro = excluded.bairro,
    ponto_referencia = excluded.ponto_referencia, telefone = excluded.telefone,
    quantidade_moradores = excluded.quantidade_moradores, cep = excluded.cep,
    estado = excluded.estado, municipio = excluded.municipio,
    logradouro = excluded.logradouro, numero_endereco = excluded.numero_endereco,
    complemento = excluded.complemento, mora_desde_ano = excluded.mora_desde_ano,
    area_risco = excluded.area_risco, tipo_moradia = excluded.tipo_moradia,
    numero_comodos = excluded.numero_comodos, material_paredes = excluded.material_paredes,
    material_piso = excluded.material_piso, material_telhado = excluded.material_telhado,
    abastecimento_agua = excluded.abastecimento_agua, forma_iluminacao = excluded.forma_iluminacao,
    destino_esgoto = excluded.destino_esgoto, destino_lixo = excluded.destino_lixo,
    cadunico = excluded.cadunico, despesas_mensais = excluded.despesas_mensais,
    criado_em_cadastro = excluded.criado_em_cadastro;

  insert into public.pessoas_atendidas (
    id, familia_id, nome_completo, data_nascimento, sexo, rg, emissor_rg,
    nis, cpf, telefone, telefone_whatsapp, email, escola, situacao_escolar,
    instituicao_ensino, serie_ano, turno, titulo_eleitor, estado_civil,
    religiao, naturalidade, nacionalidade, pode_sair_sozinho, carteira_trabalho,
    situacao_prioritaria, forma_entrada, encaminhado_por, motivo_encaminhamento,
    condicoes_saude, alergias, deficiencias, usa_medicacao, medicacoes,
    contato_emergencia_nome, contato_emergencia_telefone, forma_acesso,
    data_entrada, demanda, grupos_desejados, procura_trabalho, profissao_atual,
    empresa_atual, remuneracao_atual, telefone_trabalho, historico_profissional,
    observacoes_gerais, criado_por
  ) values
    ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000101', 'Ana Luiza Ferreira', '2016-03-12', 'Feminino', '12.345.678-9', 'SESP/PR',
     '12345678901', null, '(42) 99900-0101', true, 'familia.ferreira@example.test', 'Escola Municipal Hildegard Burjan', 'Cursando',
     'Escola Municipal Hildegard Burjan', '5º ano', 'Tarde', null, null,
     null, 'Guarapuava/PR', 'Brasileira', false, false,
     'Acompanhamento prioritário', 'Escola', 'Escola Municipal Hildegard Burjan', 'Apoio para participação em atividades no contraturno',
     '{"Desnutrição"}', '{}', '{}', false, null,
     'Mariana Ferreira', '(42) 99900-0101', 'Encaminhamento',
     current_date - 40, '{"Grupos de Convivência"}', 'Música e cultura; Grupo de Apoio à Criança - GAC', false, null,
     null, null, null, null, 'Registro fictício para visualizar a listagem.', v_autor),
    ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000101', 'Pedro Henrique Ferreira', '2012-08-20', 'Masculino', '23.456.789-0', 'SESP/PR',
     '23456789012', null, '(42) 99900-0101', true, 'familia.ferreira@example.test', 'Colégio Estadual do Bairro', 'Cursando',
     'Colégio Estadual do Bairro', '8º ano', 'Manhã', null, null,
     null, 'Guarapuava/PR', 'Brasileira', true, false,
     null, 'Procura espontânea', null, null,
     '{}', '{"Intolerância à lactose"}', '{}', false, null,
     'Mariana Ferreira', '(42) 99900-0101', 'Demanda espontânea',
     current_date - 40, '{"Serviços Socioassistenciais"}', 'Judô; Informática', false, null,
     null, null, null, null, 'Registro fictício para visualizar a listagem.', v_autor),
    ('00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000102', 'Gabriel Santos Lima', '2018-11-05', 'Masculino', null, null,
     null, null, '(42) 99900-0102', false, 'familia.lima@example.test', 'Escola Municipal Vila Bela', 'Cursando',
     'Escola Municipal Vila Bela', '2º ano', 'Manhã', null, null,
     null, 'Guarapuava/PR', 'Brasileira', false, false,
     null, 'Busca ativa', 'Equipe do Instituto', null,
     '{}', '{}', '{"Intelectual"}', true, 'Medicação contínua (dado fictício)',
     'Rafael Lima', '(42) 99900-0102', 'Busca ativa',
     current_date - 24, '{"Acesso a benefícios eventuais"}', 'Oficinas lúdicas; Dança e recreação', false, null,
     null, null, null, null, 'Registro fictício para visualizar a listagem.', v_autor),
    ('00000000-0000-4000-8000-000000000204', '00000000-0000-4000-8000-000000000103', 'Júlia Martins Costa', '2009-06-21', 'Feminino', '34.567.890-1', 'SESP/PR',
     '34567890123', null, '(42) 99900-0103', true, 'familia.costa@example.test', 'Colégio Estadual do Centro', 'Cursando',
     'Colégio Estadual do Centro', '1º ano do ensino médio', 'Noite', null, null,
     null, 'Guarapuava/PR', 'Brasileira', true, false,
     null, 'Rede socioassistencial', 'CRAS', 'Participação em grupo e atividades de convivência',
     '{"Asma"}', '{"Medicamentos"}', '{}', true, 'Medicação de exemplo',
     'Patrícia Costa', '(42) 99900-0103', 'Encaminhamento',
     current_date - 12, '{"Grupos de Convivência"}', 'Grupo de Apoio ao Adolescente - GAA', true, 'Jovem aprendiz',
     'Mercado Exemplo', 850.00, '(42) 3333-0103', 'Experiência fictícia: jovem aprendiz, 2025–2026.',
     'Registro fictício para visualizar a listagem.', v_autor)
  on conflict (id) do update set
    familia_id = excluded.familia_id, nome_completo = excluded.nome_completo,
    data_nascimento = excluded.data_nascimento, sexo = excluded.sexo,
    rg = excluded.rg, emissor_rg = excluded.emissor_rg, nis = excluded.nis,
    cpf = excluded.cpf, telefone = excluded.telefone,
    telefone_whatsapp = excluded.telefone_whatsapp, email = excluded.email,
    escola = excluded.escola, situacao_escolar = excluded.situacao_escolar,
    instituicao_ensino = excluded.instituicao_ensino, serie_ano = excluded.serie_ano,
    turno = excluded.turno, titulo_eleitor = excluded.titulo_eleitor,
    estado_civil = excluded.estado_civil, religiao = excluded.religiao,
    naturalidade = excluded.naturalidade, nacionalidade = excluded.nacionalidade,
    pode_sair_sozinho = excluded.pode_sair_sozinho, carteira_trabalho = excluded.carteira_trabalho,
    situacao_prioritaria = excluded.situacao_prioritaria, forma_entrada = excluded.forma_entrada,
    encaminhado_por = excluded.encaminhado_por, motivo_encaminhamento = excluded.motivo_encaminhamento,
    condicoes_saude = excluded.condicoes_saude, alergias = excluded.alergias,
    deficiencias = excluded.deficiencias, usa_medicacao = excluded.usa_medicacao,
    medicacoes = excluded.medicacoes, contato_emergencia_nome = excluded.contato_emergencia_nome,
    contato_emergencia_telefone = excluded.contato_emergencia_telefone,
    forma_acesso = excluded.forma_acesso, data_entrada = excluded.data_entrada,
    demanda = excluded.demanda, grupos_desejados = excluded.grupos_desejados,
    procura_trabalho = excluded.procura_trabalho, profissao_atual = excluded.profissao_atual,
    empresa_atual = excluded.empresa_atual, remuneracao_atual = excluded.remuneracao_atual,
    telefone_trabalho = excluded.telefone_trabalho, historico_profissional = excluded.historico_profissional,
    observacoes_gerais = excluded.observacoes_gerais;

  -- Acrescenta 12 famílias e 20 pessoas fictícias (total: 15 famílias, 24 pessoas).
  insert into public.familias (
    id, endereco, bairro, ponto_referencia, telefone, quantidade_moradores,
    cep, estado, municipio, logradouro, numero_endereco, mora_desde_ano,
    area_risco, tipo_moradia, numero_comodos, material_paredes, material_piso,
    material_telhado, abastecimento_agua, forma_iluminacao, destino_esgoto,
    destino_lixo, cadunico, despesas_mensais, criado_em_cadastro, criado_por
  )
  select
    ('00000000-0000-4000-8000-' || lpad((100 + n)::text, 12, '0'))::uuid,
    'Rua das Flores, ' || (40 + n * 7),
    (array['Morro Alto', 'Vila Bela', 'Conradinho', 'Industrial', 'Batel', 'Boqueirão'])[1 + ((n - 1) % 6)],
    'Próximo ao equipamento comunitário', '(42) 90000-' || lpad((200 + n)::text, 4, '0'),
    3 + (n % 5), '850' || lpad((50 + n)::text, 2, '0') || '-' || lpad(((n * 13) % 1000)::text, 3, '0'), 'Paraná', 'Guarapuava',
    'Rua das Flores', (40 + n * 7)::text, 2010 + (n % 15), (n % 5 = 0),
    (array['Alugada', 'Própria', 'Cedida'])[1 + (n % 3)], 3 + (n % 4),
    (array['Alvenaria', 'Madeira'])[1 + (n % 2)], (array['Cerâmica', 'Cimento'])[1 + (n % 2)],
    (array['Fibrocimento', 'Telha cerâmica', 'Laje'])[1 + (n % 3)], 'Rede pública',
    'Energia elétrica', 'Rede pública', 'Coleta pública', (n % 4 <> 0),
    jsonb_build_object('agua_esgoto', 55 + n * 3, 'aluguel', (n % 3) * 250,
      'energia', 80 + n * 4, 'alimentacao', 500 + n * 35, 'emprestimos', (n % 4) * 60,
      'combustivel', 40 + n * 5, 'medicamentos', (n % 5) * 25, 'transporte', 60 + n * 8),
    current_date - n * 6, v_autor
  from generate_series(4, 15) as series(n)
  on conflict (id) do update set
    endereco = excluded.endereco, bairro = excluded.bairro, ponto_referencia = excluded.ponto_referencia,
    telefone = excluded.telefone, quantidade_moradores = excluded.quantidade_moradores,
    cep = excluded.cep, estado = excluded.estado, municipio = excluded.municipio,
    logradouro = excluded.logradouro, numero_endereco = excluded.numero_endereco,
    mora_desde_ano = excluded.mora_desde_ano, area_risco = excluded.area_risco,
    tipo_moradia = excluded.tipo_moradia, numero_comodos = excluded.numero_comodos,
    material_paredes = excluded.material_paredes, material_piso = excluded.material_piso,
    material_telhado = excluded.material_telhado, abastecimento_agua = excluded.abastecimento_agua,
    forma_iluminacao = excluded.forma_iluminacao, destino_esgoto = excluded.destino_esgoto,
    destino_lixo = excluded.destino_lixo, cadunico = excluded.cadunico,
    despesas_mensais = excluded.despesas_mensais, criado_em_cadastro = excluded.criado_em_cadastro;

  insert into public.pessoas_atendidas (
    id, familia_id, nome_completo, data_nascimento, sexo, telefone, escola,
    situacao_escolar, serie_ano, turno, forma_entrada, encaminhado_por,
    situacao_prioritaria, condicoes_saude, alergias, deficiencias, usa_medicacao,
    contato_emergencia_nome, contato_emergencia_telefone, forma_acesso, data_entrada,
    demanda, grupos_desejados, criado_por
  )
  select
    ('00000000-0000-4000-8000-' || lpad((204 + n)::text, 12, '0'))::uuid,
    ('00000000-0000-4000-8000-' || lpad((104 + ((n - 1) % 12))::text, 12, '0'))::uuid,
    (array['Larissa Oliveira', 'Mateus Ribeiro', 'Beatriz Almeida', 'Enzo Carvalho', 'Helena Martins',
      'Samuel Rodrigues', 'Isabela Souza', 'Davi Fernandes', 'Laura Costa', 'Miguel Gomes',
      'Valentina Lopes', 'Theo Barbosa', 'Manuela Rocha', 'Arthur Dias', 'Lívia Nunes',
      'Bernardo Moreira', 'Clara Alves', 'Heitor Monteiro', 'Alice Cardoso', 'Ravi Teixeira'])[n],
    case when n in (7, 14, 20) then date '2002-01-01' + n * 31 else date '2008-01-01' + n * 170 end,
    (array['Feminino', 'Masculino'])[1 + (n % 2)],
    '(42) 90000-' || lpad((300 + n)::text, 4, '0'),
    (array['Escola Municipal do Campo', 'Escola Municipal Vila Bela', 'Colégio Estadual do Centro',
      'Escola Municipal Hildegard Burjan'])[1 + (n % 4)],
    (array['Cursando', 'Cursando', 'Cursando', 'Interrompido'])[1 + (n % 4)],
    (1 + (n % 9))::text || 'º ano',
    (array['Manhã', 'Tarde', 'Noite', 'Integral'])[1 + (n % 4)],
    (array['Escola', 'Busca ativa', 'Rede socioassistencial', 'Procura espontânea', 'Conselho Tutelar'])[1 + (n % 5)],
    (array['Escola municipal', 'Equipe do Instituto', 'CRAS', null, 'Conselho Tutelar'])[1 + (n % 5)],
    case when n % 6 = 0 then 'Acompanhamento prioritário' else null end,
    case when n % 7 = 0 then array['Asma']::text[] when n % 5 = 0 then array['Intolerância à lactose']::text[] else '{}'::text[] end,
    case when n % 8 = 0 then array['Medicamentos']::text[] else '{}'::text[] end,
    case when n % 11 = 0 then array['Física']::text[] else '{}'::text[] end,
    n % 7 = 0,
    (array['Renata Oliveira', 'Carlos Ribeiro', 'Patrícia Almeida', 'Marcos Carvalho', 'Sandra Martins'])[1 + (n % 5)],
    '(42) 90000-' || lpad((300 + n)::text, 4, '0'),
    (array['Encaminhamento', 'Busca ativa', 'Demanda espontânea', 'Encaminhamento'])[1 + (n % 4)],
    current_date - n * 5,
    case when n % 2 = 0 then array['Grupos de Convivência']::text[] else array['Serviços Socioassistenciais']::text[] end,
    (array['Oficina de Música', 'Judô', 'Informática', 'Atividades de convivência'])[1 + (n % 4)],
    v_autor
  from generate_series(1, 20) as series(n)
  on conflict (id) do update set
    familia_id = excluded.familia_id, nome_completo = excluded.nome_completo,
    data_nascimento = excluded.data_nascimento, sexo = excluded.sexo, telefone = excluded.telefone,
    escola = excluded.escola, situacao_escolar = excluded.situacao_escolar,
    serie_ano = excluded.serie_ano, turno = excluded.turno, forma_entrada = excluded.forma_entrada,
    encaminhado_por = excluded.encaminhado_por, situacao_prioritaria = excluded.situacao_prioritaria,
    condicoes_saude = excluded.condicoes_saude, alergias = excluded.alergias,
    deficiencias = excluded.deficiencias, usa_medicacao = excluded.usa_medicacao,
    contato_emergencia_nome = excluded.contato_emergencia_nome,
    contato_emergencia_telefone = excluded.contato_emergencia_telefone,
    forma_acesso = excluded.forma_acesso, data_entrada = excluded.data_entrada,
    demanda = excluded.demanda, grupos_desejados = excluded.grupos_desejados;

  insert into public.responsaveis_familiares (
    id, familia_id, pessoa_atendida_id, nome_completo, parentesco,
    data_nascimento, trabalha, trabalho_ou_fonte_renda, telefone, whatsapp, email, criado_por
  ) values
    ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000201', 'Mariana Ferreira', 'Mãe', '1989-02-14', true, 'Auxiliar de cozinha', '(42) 99900-0101', true, 'familia.ferreira@example.test', v_autor),
    ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000203', 'Rafael Lima', 'Pai', '1985-07-09', true, 'Serviços gerais', '(42) 99900-0102', false, 'familia.lima@example.test', v_autor),
    ('00000000-0000-4000-8000-000000000303', '00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000204', 'Patrícia Costa', 'Mãe', '1987-12-03', false, 'Procura de trabalho', '(42) 99900-0103', true, 'familia.costa@example.test', v_autor)
  on conflict (id) do update set
    familia_id = excluded.familia_id, pessoa_atendida_id = excluded.pessoa_atendida_id,
    nome_completo = excluded.nome_completo, parentesco = excluded.parentesco,
    data_nascimento = excluded.data_nascimento, trabalha = excluded.trabalha,
    trabalho_ou_fonte_renda = excluded.trabalho_ou_fonte_renda,
    telefone = excluded.telefone, whatsapp = excluded.whatsapp, email = excluded.email;

  insert into public.consentimentos_cadastro (id, pessoa_atendida_id, status, versao_termo, assinado_em, criado_por)
  values
    ('00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000201', 'pendente', 'mock-v1', null, v_autor),
    ('00000000-0000-4000-8000-000000000402', '00000000-0000-4000-8000-000000000202', 'assinado', 'mock-v1', now(), v_autor)
  on conflict (id) do update set
    pessoa_atendida_id = excluded.pessoa_atendida_id,
    status = excluded.status,
    versao_termo = excluded.versao_termo,
    assinado_em = excluded.assinado_em;

  insert into public.pessoa_beneficio (pessoa_atendida_id, beneficio_id, detalhe_outro, criado_por)
  select dados.pessoa_id, beneficio.id, null, v_autor
  from (values
    ('00000000-0000-4000-8000-000000000201'::uuid, 'Bolsa Família'),
    ('00000000-0000-4000-8000-000000000201'::uuid, 'Leite das Crianças'),
    ('00000000-0000-4000-8000-000000000202'::uuid, 'Benefício de Prestação Continuada - BPC'),
    ('00000000-0000-4000-8000-000000000203'::uuid, 'Cartão Alimentação')
  ) as dados(pessoa_id, beneficio_nome)
  join lateral (
    select id from public.catalogo_beneficios
    where lower(nome) = lower(dados.beneficio_nome)
       or (dados.beneficio_nome like '%BPC%' and nome like '%BPC%')
    order by ativo desc limit 1
  ) beneficio on true
  on conflict (pessoa_atendida_id, beneficio_id) do nothing;

  insert into public.pessoa_atividade_interesse (pessoa_atendida_id, atividade_id, criado_por)
  select dados.pessoa_id, atividade.id, v_autor
  from (values
    ('00000000-0000-4000-8000-000000000201'::uuid, 'Oficina de Música e Cultura'),
    ('00000000-0000-4000-8000-000000000202'::uuid, 'Oficina de Judô'),
    ('00000000-0000-4000-8000-000000000202'::uuid, 'Oficina de Informática'),
    ('00000000-0000-4000-8000-000000000203'::uuid, 'Oficinas Lúdicas'),
    ('00000000-0000-4000-8000-000000000203'::uuid, 'Oficina de Dança e Recreativa'),
    ('00000000-0000-4000-8000-000000000204'::uuid, 'Grupo de Apoio ao Adolescente - GAA')
  ) as dados(pessoa_id, atividade_nome)
  join public.catalogo_atividades atividade on atividade.nome = dados.atividade_nome
  on conflict (pessoa_atendida_id, atividade_id) do nothing;

  insert into public.pessoa_programa_interesse (pessoa_atendida_id, programa_id, criado_por)
  select dados.pessoa_id, programa.id, v_autor
  from (values
    ('00000000-0000-4000-8000-000000000201'::uuid, 'Programa de Promoção e Apoio Sócio Familiar'),
    ('00000000-0000-4000-8000-000000000204'::uuid, 'Projeto Entrelaços')
  ) as dados(pessoa_id, programa_nome)
  join public.catalogo_programas programa on programa.nome = dados.programa_nome
  on conflict (pessoa_atendida_id, programa_id) do nothing;

  insert into public.responsaveis_familiares (
    id, familia_id, pessoa_atendida_id, nome_completo, parentesco, data_nascimento,
    trabalha, trabalho_ou_fonte_renda, telefone, whatsapp, email, criado_por
  )
  select
    ('00000000-0000-4000-8000-' || lpad((304 + n)::text, 12, '0'))::uuid,
    ('00000000-0000-4000-8000-' || lpad((104 + ((n - 1) % 12))::text, 12, '0'))::uuid,
    ('00000000-0000-4000-8000-' || lpad((204 + n)::text, 12, '0'))::uuid,
    (array['Renata Oliveira', 'Carlos Ribeiro', 'Patrícia Almeida', 'Marcos Carvalho', 'Sandra Martins'])[1 + (n % 5)],
    case when n % 2 = 0 then 'Mãe' else 'Pai' end,
    date '1980-01-01' + n * 300, n % 3 <> 0,
    (array['Comércio', 'Serviços gerais', 'Cozinha', 'Autônomo', 'Procura de trabalho'])[1 + (n % 5)],
    '(42) 90000-' || lpad((300 + n)::text, 4, '0'), n % 2 = 0,
    'responsavel' || n || '@example.test', v_autor
  from generate_series(1, 20) as series(n)
  on conflict (id) do update set
    familia_id = excluded.familia_id, pessoa_atendida_id = excluded.pessoa_atendida_id,
    nome_completo = excluded.nome_completo, parentesco = excluded.parentesco,
    data_nascimento = excluded.data_nascimento, trabalha = excluded.trabalha,
    trabalho_ou_fonte_renda = excluded.trabalho_ou_fonte_renda,
    telefone = excluded.telefone, whatsapp = excluded.whatsapp, email = excluded.email;

  insert into public.consentimentos_cadastro (
    id, pessoa_atendida_id, status, versao_termo, assinado_em, criado_por
  )
  select
    ('00000000-0000-4000-8000-' || lpad((402 + n)::text, 12, '0'))::uuid,
    ('00000000-0000-4000-8000-' || lpad((204 + n)::text, 12, '0'))::uuid,
    case when n % 3 = 0 then 'assinado' when n % 3 = 1 then 'pendente' else 'nao_autorizado' end,
    'mock-v1', case when n % 3 = 0 then now() else null end, v_autor
  from generate_series(1, 20) as series(n)
  on conflict (id) do update set
    pessoa_atendida_id = excluded.pessoa_atendida_id, status = excluded.status,
    versao_termo = excluded.versao_termo, assinado_em = excluded.assinado_em;

  insert into public.pessoa_beneficio (pessoa_atendida_id, beneficio_id, detalhe_outro, criado_por)
  select dados.pessoa_id, beneficio.id,
    case when dados.nome = 'Outro benefício' then 'Benefício fictício para teste' else null end, v_autor
  from (
    select ('00000000-0000-4000-8000-' || lpad((204 + n)::text, 12, '0'))::uuid as pessoa_id,
      (array['Bolsa Família', 'Leite das Crianças', 'Benefício de Prestação Continuada - BPC',
        'Cartão Alimentação', 'Programa Auxílio Brasil', 'Outro benefício'])[1 + (n % 6)] as nome
    from generate_series(1, 20) as series(n)
  ) dados
  join public.catalogo_beneficios beneficio on beneficio.nome = dados.nome
  on conflict (pessoa_atendida_id, beneficio_id) do update set detalhe_outro = excluded.detalhe_outro;

  insert into public.pessoa_atividade_interesse (pessoa_atendida_id, atividade_id, criado_por)
  select dados.pessoa_id, atividade.id, v_autor
  from (
    select ('00000000-0000-4000-8000-' || lpad((204 + n)::text, 12, '0'))::uuid as pessoa_id,
      (array['Oficina de Música e Cultura', 'Oficina de Judô', 'Oficina de Informática',
        'Oficinas Lúdicas', 'Oficina de Dança e Recreativa', 'Oficina de Jogos Educativos e Interativos',
        'Oficina de Corte e Costura', 'Grupo de Apoio à Criança - GAC',
        'Grupo de Apoio ao Adolescente - GAA', 'Grupo de Apoio à Família - GAF'])[1 + (n % 10)] as nome
    from generate_series(1, 20) as series(n)
  ) dados
  join public.catalogo_atividades atividade on atividade.nome = dados.nome
  on conflict (pessoa_atendida_id, atividade_id) do nothing;

  insert into public.pessoa_programa_interesse (pessoa_atendida_id, programa_id, criado_por)
  select dados.pessoa_id, programa.id, v_autor
  from (
    select ('00000000-0000-4000-8000-' || lpad((204 + n)::text, 12, '0'))::uuid as pessoa_id,
      (array['Programa de Promoção e Apoio Sócio Familiar', 'Projeto Mãos que Transformam',
        'Projeto Entrelaços'])[1 + (n % 3)] as nome
    from generate_series(1, 20) as series(n)
  ) dados
  join public.catalogo_programas programa on programa.nome = dados.nome
  on conflict (pessoa_atendida_id, programa_id) do nothing;
end;
$$;

-- Confirme a quantidade inserida antes de usar a interface.
select 'familias' as tabela, count(*) as quantidade from public.familias where id::text like '00000000-0000-4000-8000-0000000001%'
union all
select 'pessoas_atendidas', count(*) from public.pessoas_atendidas where id::text like '00000000-0000-4000-8000-0000000002%'
union all
select 'responsaveis_familiares', count(*) from public.responsaveis_familiares where id::text like '00000000-0000-4000-8000-0000000003%'
union all
select 'consentimentos_cadastro', count(*) from public.consentimentos_cadastro where id::text like '00000000-0000-4000-8000-0000000004%'
union all
select 'pessoa_beneficio', count(*) from public.pessoa_beneficio where pessoa_atendida_id::text like '00000000-0000-4000-8000-0000000002%'
union all
select 'pessoa_atividade_interesse', count(*) from public.pessoa_atividade_interesse where pessoa_atendida_id::text like '00000000-0000-4000-8000-0000000002%'
union all
select 'pessoa_programa_interesse', count(*) from public.pessoa_programa_interesse where pessoa_atendida_id::text like '00000000-0000-4000-8000-0000000002%'
union all
select 'catalogo_beneficios', count(*) from public.catalogo_beneficios
union all
select 'catalogo_atividades', count(*) from public.catalogo_atividades
union all
select 'catalogo_programas', count(*) from public.catalogo_programas
union all
select 'perfis_acesso', count(*) from public.perfis_acesso where ativo;
