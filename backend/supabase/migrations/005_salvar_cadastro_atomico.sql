-- Salva uma ficha e seus vínculos em uma única transação sob as políticas RLS.
create or replace function public.salvar_cadastro_completo(
  p_familia jsonb,
  p_pessoa jsonb,
  p_responsaveis jsonb default '[]'::jsonb,
  p_beneficios jsonb default '[]'::jsonb,
  p_atividades jsonb default '[]'::jsonb,
  p_programas jsonb default '[]'::jsonb,
  p_consentimento jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_familia public.familias%rowtype;
  v_pessoa public.pessoas_atendidas%rowtype;
  v_guardiao public.responsaveis_familiares%rowtype;
  v_id uuid;
  v_nome text;
  v_beneficio_id uuid;
  v_consentimento_id uuid;
  v_criado_em timestamptz := now();
begin
  if (select auth.uid()) is null then
    raise exception 'É necessário entrar no sistema para salvar um cadastro.' using errcode = '42501';
  end if;

  if nullif(p_familia->>'id', '') is not null then
    select * into v_familia from public.familias
    where id = (p_familia->>'id')::uuid for update;
    if not found then raise exception 'Família não encontrada ou sem acesso.'; end if;
    v_familia := jsonb_populate_record(v_familia, p_familia);
  else
    v_familia := jsonb_populate_record(null::public.familias, p_familia);
    v_familia.id := gen_random_uuid();
    v_familia.criado_por := (select auth.uid());
    v_familia.criado_em := v_criado_em;
    v_familia.atualizado_em := v_criado_em;
    v_familia.atualizado_por := (select auth.uid());
    v_familia.ativo := true;
    v_familia.despesas_mensais := coalesce(v_familia.despesas_mensais, '{}'::jsonb);
  end if;
  v_familia.criado_em_cadastro := coalesce(v_familia.criado_em_cadastro, (p_pessoa->>'data_entrada')::date);

  insert into public.familias select (v_familia).*
  on conflict (id) do update set
    endereco = excluded.endereco, bairro = excluded.bairro, ponto_referencia = excluded.ponto_referencia,
    telefone = excluded.telefone, quantidade_moradores = excluded.quantidade_moradores,
    cep = excluded.cep, estado = excluded.estado, municipio = excluded.municipio,
    logradouro = excluded.logradouro, numero_endereco = excluded.numero_endereco, complemento = excluded.complemento,
    mora_desde_ano = excluded.mora_desde_ano, area_risco = excluded.area_risco, tipo_moradia = excluded.tipo_moradia,
    numero_comodos = excluded.numero_comodos, material_paredes = excluded.material_paredes,
    material_piso = excluded.material_piso, material_telhado = excluded.material_telhado,
    abastecimento_agua = excluded.abastecimento_agua, forma_iluminacao = excluded.forma_iluminacao,
    destino_esgoto = excluded.destino_esgoto, destino_lixo = excluded.destino_lixo,
    cadunico = excluded.cadunico, despesas_mensais = excluded.despesas_mensais,
    uso_substancias_psicoativas = excluded.uso_substancias_psicoativas,
    criado_em_cadastro = excluded.criado_em_cadastro;

  if nullif(p_pessoa->>'id', '') is not null then
    select * into v_pessoa from public.pessoas_atendidas
    where id = (p_pessoa->>'id')::uuid for update;
    if not found then raise exception 'Pessoa atendida não encontrada ou sem acesso.'; end if;
    v_pessoa := jsonb_populate_record(v_pessoa, p_pessoa);
  else
    v_pessoa := jsonb_populate_record(null::public.pessoas_atendidas, p_pessoa);
    v_pessoa.id := gen_random_uuid();
    v_pessoa.criado_por := (select auth.uid());
    v_pessoa.criado_em := v_criado_em;
    v_pessoa.atualizado_em := v_criado_em;
    v_pessoa.atualizado_por := (select auth.uid());
    v_pessoa.status := 'ativo';
  end if;
  v_pessoa.familia_id := v_familia.id;

  insert into public.pessoas_atendidas select (v_pessoa).*
  on conflict (id) do update set
    familia_id = excluded.familia_id, nome_completo = excluded.nome_completo,
    data_nascimento = excluded.data_nascimento, sexo = excluded.sexo, rg = excluded.rg,
    emissor_rg = excluded.emissor_rg, nis = excluded.nis, cpf = excluded.cpf, telefone = excluded.telefone,
    telefone_whatsapp = excluded.telefone_whatsapp, email = excluded.email, escola = excluded.escola,
    situacao_escolar = excluded.situacao_escolar, instituicao_ensino = excluded.instituicao_ensino,
    serie_ano = excluded.serie_ano, turno = excluded.turno, serie_carteira_trabalho = excluded.serie_carteira_trabalho,
    titulo_eleitor = excluded.titulo_eleitor, estado_civil = excluded.estado_civil,
    religiao = excluded.religiao, naturalidade = excluded.naturalidade, nacionalidade = excluded.nacionalidade,
    pode_sair_sozinho = excluded.pode_sair_sozinho, carteira_trabalho = excluded.carteira_trabalho,
    forma_entrada = excluded.forma_entrada, encaminhado_por = excluded.encaminhado_por,
    motivo_encaminhamento = excluded.motivo_encaminhamento, situacao_prioritaria = excluded.situacao_prioritaria,
    observacoes_gerais = excluded.observacoes_gerais, data_entrada = excluded.data_entrada,
    condicoes_saude = excluded.condicoes_saude,
    outra_condicao_saude = excluded.outra_condicao_saude, alergias = excluded.alergias,
    detalhe_alergias = excluded.detalhe_alergias, deficiencias = excluded.deficiencias,
    usa_medicacao = excluded.usa_medicacao, medicacoes = excluded.medicacoes,
    contato_emergencia_nome = excluded.contato_emergencia_nome,
    contato_emergencia_telefone = excluded.contato_emergencia_telefone,
    uso_substancias_psicoativas = excluded.uso_substancias_psicoativas,
    demanda = excluded.demanda, forma_acesso = excluded.forma_acesso,
    grupos_desejados = excluded.grupos_desejados, outros_vinculos = excluded.outros_vinculos,
    contato_adicional_nome = excluded.contato_adicional_nome,
    contato_adicional_telefone = excluded.contato_adicional_telefone,
    contato_adicional_vinculo = excluded.contato_adicional_vinculo,
    procura_trabalho = excluded.procura_trabalho, profissao_atual = excluded.profissao_atual,
    empresa_atual = excluded.empresa_atual, remuneracao_atual = excluded.remuneracao_atual,
    telefone_trabalho = excluded.telefone_trabalho, historico_profissional = excluded.historico_profissional;
  v_id := v_pessoa.id;

  delete from public.responsaveis_familiares
  where pessoa_atendida_id = v_id
    and (lower(parentesco) like 'mãe%' or lower(parentesco) like 'pai%');
  for v_guardiao in
    select * from jsonb_populate_recordset(null::public.responsaveis_familiares, coalesce(p_responsaveis, '[]'::jsonb))
  loop
    if nullif(trim(v_guardiao.nome_completo), '') is null then continue; end if;
    v_guardiao.id := gen_random_uuid();
    v_guardiao.familia_id := v_familia.id;
    v_guardiao.pessoa_atendida_id := v_id;
    v_guardiao.criado_por := (select auth.uid());
    v_guardiao.criado_em := v_criado_em;
    v_guardiao.atualizado_em := v_criado_em;
    insert into public.responsaveis_familiares select (v_guardiao).*;
  end loop;

  delete from public.pessoa_beneficio where pessoa_atendida_id = v_id;
  for v_nome in select jsonb_array_elements_text(coalesce(p_beneficios, '[]'::jsonb)) loop
    v_nome := case v_nome
      when 'BPC' then 'Benefício de Prestação Continuada - BPC'
      when 'Auxílio Brasil' then 'Programa Auxílio Brasil'
      else v_nome end;
    select id into v_beneficio_id from public.catalogo_beneficios where nome = v_nome and ativo limit 1;
    if v_beneficio_id is not null then
      insert into public.pessoa_beneficio (pessoa_atendida_id, beneficio_id, detalhe_outro)
      values (v_id, v_beneficio_id, case when v_nome = 'Outro benefício' then nullif(p_pessoa->>'otherBenefits', '') end);
    end if;
  end loop;

  delete from public.pessoa_atividade_interesse where pessoa_atendida_id = v_id;
  insert into public.pessoa_atividade_interesse (pessoa_atendida_id, atividade_id)
  select v_id, atividade.id
  from public.catalogo_atividades atividade
  where atividade.ativo and atividade.nome in (select jsonb_array_elements_text(coalesce(p_atividades, '[]'::jsonb)));

  delete from public.pessoa_programa_interesse where pessoa_atendida_id = v_id;
  insert into public.pessoa_programa_interesse (pessoa_atendida_id, programa_id)
  select v_id, programa.id
  from public.catalogo_programas programa
  where programa.ativo and programa.nome in (
    select case nomes.nome
      when 'Projeto Mãos que Transformam' then 'Projeto "Mãos que Transformam"'
      when 'Projeto Entrelaços' then 'Projeto "Entrelaços"'
      else nomes.nome end
    from jsonb_array_elements_text(coalesce(p_programas, '[]'::jsonb)) as nomes(nome)
  );

  if coalesce(p_consentimento->>'status', '') <> '' then
    select id into v_consentimento_id from public.consentimentos_cadastro
    where pessoa_atendida_id = v_id order by criado_em desc limit 1 for update;
    if v_consentimento_id is null then
      insert into public.consentimentos_cadastro (pessoa_atendida_id, status, versao_termo, assinado_em)
      values (v_id, p_consentimento->>'status', nullif(p_consentimento->>'versao_termo', ''),
        case when p_consentimento->>'status' = 'assinado' then now() end);
    else
      update public.consentimentos_cadastro set
        status = p_consentimento->>'status',
        versao_termo = nullif(p_consentimento->>'versao_termo', ''),
        assinado_em = case when p_consentimento->>'status' = 'assinado' then coalesce(assinado_em, now()) else null end
      where id = v_consentimento_id;
    end if;
  end if;

  return v_id;
end;
$$;

revoke all on function public.salvar_cadastro_completo(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) from public;
grant execute on function public.salvar_cadastro_completo(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;
