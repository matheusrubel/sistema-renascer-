const CHAVE_SESSAO = "renascer.supabase.session";
let configuracaoPromise;

async function configuracao() {
  configuracaoPromise ??= fetch("/api/config").then(async (resposta) => {
    if (!resposta.ok) throw new Error("Não foi possível carregar a configuração do Supabase.");
    return resposta.json();
  });
  return configuracaoPromise;
}

export function obterSessao() {
  try {
    return JSON.parse(sessionStorage.getItem(CHAVE_SESSAO) || "null");
  } catch {
    sessionStorage.removeItem(CHAVE_SESSAO);
    return null;
  }
}

export function salvarSessao(sessao) {
  if (sessao) sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao));
  else sessionStorage.removeItem(CHAVE_SESSAO);
}

async function requisicaoSupabase(caminho, { token, metodo = "GET", corpo, preferencia, renovar = true } = {}) {
  const config = await configuracao();
  const resposta = await fetch(`${config.url}${caminho}`, {
    method: metodo,
    headers: {
      apikey: config.anonKey,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(corpo !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(preferencia ? { Prefer: preferencia } : {}),
    },
    ...(corpo !== undefined ? { body: JSON.stringify(corpo) } : {}),
  });
  const texto = await resposta.text();
  let dados;
  try { dados = texto ? JSON.parse(texto) : null; } catch { dados = null; }
  if (resposta.status === 401 && token && renovar) {
    const sessao = obterSessao();
    if (sessao?.access_token === token && sessao.refresh_token) {
      try {
        const renovada = await requisicaoSupabase("/auth/v1/token?grant_type=refresh_token", {
          metodo: "POST", corpo: { refresh_token: sessao.refresh_token }, renovar: false,
        });
        salvarSessao({ ...renovada, perfil: sessao.perfil });
        return requisicaoSupabase(caminho, { token: renovada.access_token, metodo, corpo, preferencia, renovar: false });
      } catch {
        salvarSessao(null);
      }
    }
  }
  if (!resposta.ok) {
    const mensagem = dados?.msg || dados?.message || dados?.error_description || dados?.error || "Falha ao comunicar com o Supabase.";
    throw new Error(mensagem);
  }
  return dados;
}

export async function entrar(email, senha) {
  const sessao = await requisicaoSupabase("/auth/v1/token?grant_type=password", {
    metodo: "POST", corpo: { email, password: senha },
  });
  const perfis = await requisicaoSupabase(`/rest/v1/perfis_acesso?user_id=eq.${encodeURIComponent(sessao.user.id)}&select=nome,papel,ativo&limit=1`, { token: sessao.access_token });
  const perfil = perfis?.[0];
  if (!perfil?.ativo || !["admin", "recepcao", "tecnico_social"].includes(perfil.papel)) {
    await requisicaoSupabase("/auth/v1/logout", { metodo: "POST", token: sessao.access_token }).catch(() => {});
    throw new Error("Este usuário ainda não tem um perfil institucional ativo. Peça à administração para liberar o acesso.");
  }
  salvarSessao({ ...sessao, perfil });
  return perfil;
}

export async function sair() {
  const sessao = obterSessao();
  salvarSessao(null);
  if (sessao?.access_token) await requisicaoSupabase("/auth/v1/logout", { metodo: "POST", token: sessao.access_token }).catch(() => {});
}

export async function solicitarRedefinicaoSenha(email) {
  const config = await configuracao();
  const redirectTo = `${window.location.origin}/alterar-senha.html`;
  const resposta = await fetch(`${config.url}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
    method: "POST",
    headers: { apikey: config.anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });
  if (!resposta.ok) {
    let erro;
    try { erro = await resposta.json(); } catch { erro = null; }
    throw new Error(erro?.msg || erro?.message || "Não foi possível solicitar a redefinição. Tente novamente.");
  }
}

export async function atualizarSenha(senha, token = obterSessao()?.access_token) {
  if (!token) throw new Error("Sua sessão de redefinição expirou. Solicite um novo link.");
  return requisicaoSupabase("/auth/v1/user", { token, metodo: "PUT", corpo: { password: senha } });
}

export async function solicitarAcesso({ nome, email, area }) {
  const config = await configuracao();
  const resposta = await fetch(`${config.url}/rest/v1/solicitacoes_acesso`, {
    method: "POST",
    headers: { apikey: config.anonKey, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ nome: nome.trim(), email: email.trim().toLowerCase(), area }),
  });
  if (!resposta.ok) {
    let erro;
    try { erro = await resposta.json(); } catch { erro = null; }
    throw new Error(erro?.message || "Não foi possível enviar a solicitação. Tente novamente mais tarde.");
  }
}

export async function listarPessoas(token) {
  const pessoas = await requisicaoSupabase("/rest/v1/pessoas_atendidas?select=*&status=eq.ativo&order=criado_em.desc", { token });
  if (!pessoas.length) return [];
  const idsFamilia = [...new Set(pessoas.map((pessoa) => pessoa.familia_id).filter(Boolean))];
  const queryFamilias = idsFamilia.map(encodeURIComponent).join(",");
  const familias = queryFamilias ? await requisicaoSupabase(`/rest/v1/familias?select=*&id=in.(${queryFamilias})`, { token }) : [];
  const porId = new Map(familias.map((familia) => [familia.id, familia]));
  const idsPessoa = pessoas.map((pessoa) => pessoa.id);
  const filtroPessoas = idsPessoa.map(encodeURIComponent).join(",");
  const [responsaveis, consentimentos, beneficios, atividades, programas] = await Promise.all([
    requisicaoSupabase(`/rest/v1/responsaveis_familiares?select=*&pessoa_atendida_id=in.(${filtroPessoas})`, { token }),
    requisicaoSupabase(`/rest/v1/consentimentos_cadastro?select=*&pessoa_atendida_id=in.(${filtroPessoas})&order=criado_em.desc`, { token }),
    carregarVinculos("pessoa_beneficio", "catalogo_beneficios", "beneficio_id", "nome", filtroPessoas, token),
    carregarVinculos("pessoa_atividade_interesse", "catalogo_atividades", "atividade_id", "nome", filtroPessoas, token),
    carregarVinculos("pessoa_programa_interesse", "catalogo_programas", "programa_id", "nome", filtroPessoas, token),
  ]);
  const porPessoaResponsaveis = agruparPor(responsaveis, "pessoa_atendida_id");
  const porPessoaConsentimento = agruparPor(consentimentos, "pessoa_atendida_id");
  return pessoas.map((pessoa) => {
    const familiares = porPessoaResponsaveis.get(pessoa.id) || [];
    const relacionados = {
      mae: familiares.find((item) => /mãe/i.test(item.parentesco || "")),
      pai: familiares.find((item) => /pai/i.test(item.parentesco || "")),
      consentimento: porPessoaConsentimento.get(pessoa.id)?.[0],
      benefits: beneficios.get(pessoa.id) || [],
      activities: atividades.get(pessoa.id) || [],
      programs: programas.get(pessoa.id) || [],
    };
    return converterPessoa(pessoa, porId.get(pessoa.familia_id), relacionados);
  });
}

function agruparPor(linhas, coluna) {
  const grupos = new Map();
  for (const linha of linhas) grupos.set(linha[coluna], [...(grupos.get(linha[coluna]) || []), linha]);
  return grupos;
}

async function carregarVinculos(tabelaVinculo, tabelaCatalogo, colunaId, colunaNome, filtroPessoas, token) {
  const vinculos = await requisicaoSupabase(`/rest/v1/${tabelaVinculo}?select=pessoa_atendida_id,${colunaId}&pessoa_atendida_id=in.(${filtroPessoas})`, { token });
  if (!vinculos.length) return new Map();
  const ids = [...new Set(vinculos.map((item) => item[colunaId]))].map(encodeURIComponent).join(",");
  const catalogo = await requisicaoSupabase(`/rest/v1/${tabelaCatalogo}?select=id,${colunaNome}&id=in.(${ids})`, { token });
  const nomes = new Map(catalogo.map((item) => [item.id, item[colunaNome]]));
  return agruparPor(vinculos.map((item) => ({ pessoa_atendida_id: item.pessoa_atendida_id, nome: nomes.get(item[colunaId]) })).filter((item) => item.nome), "pessoa_atendida_id");
}

function converterPessoa(pessoa, familia = {}, relacionados = {}) {
  return {
    ...pessoa,
    id: pessoa.id,
    name: pessoa.nome_completo,
    birthDate: pessoa.data_nascimento,
    sex: pessoa.sexo,
    rg: pessoa.rg,
    rgIssuer: pessoa.emissor_rg,
    nis: pessoa.nis,
    cpf: pessoa.cpf,
    phone: pessoa.telefone,
    phoneWhatsapp: pessoa.telefone_whatsapp == null ? "" : String(pessoa.telefone_whatsapp),
    email: pessoa.email,
    school: pessoa.escola,
    schoolStatus: pessoa.situacao_escolar,
    schoolInstitution: pessoa.instituicao_ensino,
    grade: pessoa.serie_ano,
    shift: pessoa.turno,
    neighborhood: familia.bairro,
    workCard: pessoa.carteira_trabalho == null ? "" : String(pessoa.carteira_trabalho),
    workCardSeries: pessoa.serie_carteira_trabalho,
    voterRegistration: pessoa.titulo_eleitor,
    maritalStatus: pessoa.estado_civil,
    religion: pessoa.religiao,
    birthplace: pessoa.naturalidade,
    nationality: pessoa.nacionalidade,
    canLeaveAlone: pessoa.pode_sair_sozinho == null ? "" : String(pessoa.pode_sair_sozinho),
    householdSize: familia.quantidade_moradores,
    motherName: relacionados.mae?.nome_completo,
    motherBirthDate: relacionados.mae?.data_nascimento,
    motherWorks: relacionados.mae?.trabalha == null ? "" : String(relacionados.mae.trabalha),
    motherIncome: relacionados.mae?.trabalho_ou_fonte_renda,
    mae_responsavel_id: relacionados.mae?.id,
    fatherName: relacionados.pai?.nome_completo,
    fatherBirthDate: relacionados.pai?.data_nascimento,
    fatherWorks: relacionados.pai?.trabalha == null ? "" : String(relacionados.pai.trabalha),
    fatherIncome: relacionados.pai?.trabalho_ou_fonte_renda,
    pai_responsavel_id: relacionados.pai?.id,
    address: familia.endereco,
    reference: familia.ponto_referencia,
    postalCode: familia.cep,
    cep: familia.cep,
    state: familia.estado,
    municipality: familia.municipio,
    street: familia.logradouro,
    addressNumber: familia.numero_endereco,
    addressComplement: familia.complemento,
    residenceSinceYear: familia.mora_desde_ano,
    riskArea: familia.area_risco == null ? "" : String(familia.area_risco),
    housingType: familia.tipo_moradia,
    roomCount: familia.numero_comodos,
    wallMaterial: familia.material_paredes,
    floorMaterial: familia.material_piso,
    roofMaterial: familia.material_telhado,
    waterSupply: familia.abastecimento_agua,
    lighting: familia.forma_iluminacao,
    sewageDestination: familia.destino_esgoto,
    garbageDestination: familia.destino_lixo,
    cadunico: familia.cadunico == null ? "" : String(familia.cadunico),
    expenseWater: familia.despesas_mensais?.agua_esgoto,
    expenseRent: familia.despesas_mensais?.aluguel,
    expenseElectricity: familia.despesas_mensais?.energia,
    expenseFood: familia.despesas_mensais?.alimentacao,
    expenseLoans: familia.despesas_mensais?.emprestimos,
    expenseFuel: familia.despesas_mensais?.combustivel,
    expenseMedication: familia.despesas_mensais?.medicamentos,
    expenseTransport: familia.despesas_mensais?.transporte,
    householdSubstanceUse: familia.uso_substancias_psicoativas,
    entryDate: pessoa.data_entrada,
    accessMethod: pessoa.forma_acesso,
    referralSource: pessoa.forma_entrada,
    referralDetail: pessoa.encaminhado_por,
    referralReason: pessoa.motivo_encaminhamento,
    priority: pessoa.situacao_prioritaria,
    healthConditions: pessoa.condicoes_saude || [],
    healthOther: pessoa.outra_condicao_saude,
    allergies: pessoa.alergias || [],
    allergyDetails: pessoa.detalhe_alergias,
    usesMedication: pessoa.usa_medicacao == null ? "" : String(pessoa.usa_medicacao),
    medications: pessoa.medicacoes,
    disabilities: pessoa.deficiencias || [],
    healthContactName: pessoa.contato_emergencia_nome,
    healthContactPhone: pessoa.contato_emergencia_telefone,
    substanceUse: pessoa.uso_substancias_psicoativas,
    demands: pessoa.demanda || [],
    desiredGroups: pessoa.grupos_desejados,
    otherRelationships: pessoa.outros_vinculos,
    additionalContactName: pessoa.contato_adicional_nome,
    additionalContactPhone: pessoa.contato_adicional_telefone,
    additionalContactRelation: pessoa.contato_adicional_vinculo,
    consentStatus: relacionados.consentimento?.status || "pendente",
    consentVersion: relacionados.consentimento?.versao_termo,
    seekingWork: pessoa.procura_trabalho == null ? "" : String(pessoa.procura_trabalho),
    currentProfession: pessoa.profissao_atual,
    currentEmployer: pessoa.empresa_atual,
    currentPay: pessoa.remuneracao_atual,
    workPhone: pessoa.telefone_trabalho,
    pastWorkHistory: pessoa.historico_profissional,
    notes: pessoa.observacoes_gerais,
    activities: (relacionados.activities || []).map((item) => item.nome),
    programs: (relacionados.programs || []).map((item) => ({ 'Projeto "Mãos que Transformam"': "Projeto Mãos que Transformam", 'Projeto "Entrelaços"': "Projeto Entrelaços" }[item.nome] || item.nome)),
    benefits: (relacionados.benefits || []).map((item) => ({ "Benefício de Prestação Continuada - BPC": "BPC", "Programa Auxílio Brasil": "Auxílio Brasil" }[item.nome] || item.nome)),
  };
}

const colunasFamilia = {
  address: "endereco", neighborhood: "bairro", reference: "ponto_referencia", phone: "telefone", householdSize: "quantidade_moradores",
  postalCode: "cep", state: "estado", municipality: "municipio", street: "logradouro", addressNumber: "numero_endereco", addressComplement: "complemento",
  residenceSinceYear: "mora_desde_ano", riskArea: "area_risco", housingType: "tipo_moradia", roomCount: "numero_comodos", wallMaterial: "material_paredes",
  floorMaterial: "material_piso", roofMaterial: "material_telhado", waterSupply: "abastecimento_agua", lighting: "forma_iluminacao",
  sewageDestination: "destino_esgoto", garbageDestination: "destino_lixo", cadunico: "cadunico", householdSubstanceUse: "uso_substancias_psicoativas",
};
const colunasPessoa = {
  name: "nome_completo", birthDate: "data_nascimento", sex: "sexo", rg: "rg", rgIssuer: "emissor_rg", nis: "nis", cpf: "cpf", phone: "telefone",
  phoneWhatsapp: "telefone_whatsapp", email: "email", school: "escola", schoolStatus: "situacao_escolar", schoolInstitution: "instituicao_ensino",
  grade: "serie_ano", shift: "turno", workCard: "carteira_trabalho", workCardSeries: "serie_carteira_trabalho", voterRegistration: "titulo_eleitor",
  maritalStatus: "estado_civil", religion: "religiao", birthplace: "naturalidade", nationality: "nacionalidade", canLeaveAlone: "pode_sair_sozinho",
  entryDate: "data_entrada", accessMethod: "forma_acesso", referralSource: "forma_entrada", referralDetail: "encaminhado_por", referralReason: "motivo_encaminhamento",
  priority: "situacao_prioritaria", healthOther: "outra_condicao_saude", allergyDetails: "detalhe_alergias", usesMedication: "usa_medicacao", medications: "medicacoes",
  healthContactName: "contato_emergencia_nome", healthContactPhone: "contato_emergencia_telefone", substanceUse: "uso_substancias_psicoativas", demands: "demanda",
  desiredGroups: "grupos_desejados", seekingWork: "procura_trabalho", currentProfession: "profissao_atual", currentEmployer: "empresa_atual", currentPay: "remuneracao_atual",
  workPhone: "telefone_trabalho", pastWorkHistory: "historico_profissional", notes: "observacoes_gerais",
  additionalContactName: "contato_adicional_nome", additionalContactPhone: "contato_adicional_telefone", additionalContactRelation: "contato_adicional_vinculo",
  otherRelationships: "outros_vinculos",
};

function traduzirFormulario(dados) {
  const familia = {};
  const pessoa = {};
  for (const [campo, coluna] of Object.entries(colunasFamilia)) if (dados[campo] !== undefined) familia[coluna] = dados[campo] === "" ? null : dados[campo];
  for (const [campo, coluna] of Object.entries(colunasPessoa)) if (dados[campo] !== undefined) pessoa[coluna] = dados[campo] === "" ? null : dados[campo];
  for (const campo of ["riskArea", "cadunico", "phoneWhatsapp", "workCard", "canLeaveAlone", "usesMedication", "seekingWork"]) {
    if (pessoa[colunasPessoa[campo]] !== undefined && pessoa[colunasPessoa[campo]] !== null) pessoa[colunasPessoa[campo]] = pessoa[colunasPessoa[campo]] === "true";
    if (familia[colunasFamilia[campo]] !== undefined && familia[colunasFamilia[campo]] !== null) familia[colunasFamilia[campo]] = familia[colunasFamilia[campo]] === "true";
  }
  for (const campo of ["residenceSinceYear", "roomCount", "householdSize"]) {
    const coluna = colunasFamilia[campo];
    if (familia[coluna] !== undefined && familia[coluna] !== null) familia[coluna] = Number(familia[coluna]);
  }
  const despesas = { agua_esgoto: "expenseWater", aluguel: "expenseRent", energia: "expenseElectricity", alimentacao: "expenseFood", emprestimos: "expenseLoans", combustivel: "expenseFuel", medicamentos: "expenseMedication", transporte: "expenseTransport" };
  familia.despesas_mensais = Object.fromEntries(Object.entries(despesas).filter(([, campo]) => dados[campo] !== undefined && dados[campo] !== "").map(([chave, campo]) => [chave, Number(dados[campo])]));
  pessoa.condicoes_saude = dados.healthConditions || [];
  pessoa.alergias = dados.allergies || [];
  pessoa.deficiencias = dados.disabilities || [];
  pessoa.demanda = dados.demands || [];
  pessoa.otherBenefits = dados.otherBenefits || null;
  if (dados.familia_id) familia.id = dados.familia_id;
  if (dados.id) pessoa.id = dados.id;
  return { familia, pessoa };
}

async function gravarLinha(tabela, dados, token, id) {
  const caminho = id ? `/rest/v1/${tabela}?id=eq.${encodeURIComponent(id)}` : `/rest/v1/${tabela}`;
  const linhas = await requisicaoSupabase(caminho, { token, metodo: id ? "PATCH" : "POST", corpo: dados, preferencia: "return=representation" });
  return linhas?.[0];
}

const catalogos = {
  pessoa_beneficio: { tabela: "catalogo_beneficios", chave: "beneficio_id", nomes: { BPC: "Benefício de Prestação Continuada - BPC", "Auxílio Brasil": "Programa Auxílio Brasil" } },
  pessoa_atividade_interesse: { tabela: "catalogo_atividades", chave: "atividade_id", dados: "activities", nomes: {} },
  pessoa_programa_interesse: { tabela: "catalogo_programas", chave: "programa_id", dados: "programs", nomes: { "Projeto Mãos que Transformam": 'Projeto "Mãos que Transformam"', "Projeto Entrelaços": 'Projeto "Entrelaços"' } },
};

async function sincronizarVinculos(tabelaVinculo, idPessoa, valores, token, detalheOutro = null) {
  const config = catalogos[tabelaVinculo];
  await requisicaoSupabase(`/rest/v1/${tabelaVinculo}?pessoa_atendida_id=eq.${encodeURIComponent(idPessoa)}`, { token, metodo: "DELETE" });
  const nomes = [...new Set((valores || []).filter(Boolean).map((nome) => config.nomes[nome] || nome))];
  if (!nomes.length) return;
  const parametros = nomes.map((nome) => `"${nome.replaceAll('"', '\\"')}"`).join(",");
  const opcoes = await requisicaoSupabase(`/rest/v1/${config.tabela}?select=id,nome&nome=in.(${encodeURIComponent(parametros)})`, { token });
  const porNome = new Map(opcoes.map((item) => [item.nome, item.id]));
  const vinculos = nomes.flatMap((nome) => porNome.has(nome) ? [{ pessoa_atendida_id: idPessoa, [config.chave]: porNome.get(nome), ...(tabelaVinculo === "pessoa_beneficio" && nome === "Outro benefício" && detalheOutro ? { detalhe_outro: detalheOutro } : {}) }] : []);
  if (vinculos.length) await requisicaoSupabase(`/rest/v1/${tabelaVinculo}`, { token, metodo: "POST", corpo: vinculos, preferencia: "return=minimal" });
}

async function sincronizarResponsaveis(dados, pessoaId, familiaId, token) {
  const responsaveis = [
    { id: dados.mae_responsavel_id, nome_completo: dados.motherName, parentesco: "Mãe/responsável", data_nascimento: dados.motherBirthDate || null, trabalha: dados.motherWorks === "" ? null : dados.motherWorks === "true", trabalho_ou_fonte_renda: dados.motherIncome, telefone: dados.phone || null, whatsapp: dados.phoneWhatsapp === "" ? null : dados.phoneWhatsapp === "true", email: dados.email || null },
    { id: dados.pai_responsavel_id, nome_completo: dados.fatherName, parentesco: "Pai/responsável", data_nascimento: dados.fatherBirthDate || null, trabalha: dados.fatherWorks === "" ? null : dados.fatherWorks === "true", trabalho_ou_fonte_renda: dados.fatherIncome, telefone: dados.phone || null, whatsapp: dados.phoneWhatsapp === "" ? null : dados.phoneWhatsapp === "true", email: dados.email || null },
  ].filter((responsavel) => responsavel.nome_completo?.trim());
  const idsMantidos = new Set(responsaveis.map((responsavel) => responsavel.id).filter(Boolean));
  for (const idAntigo of [dados.mae_responsavel_id, dados.pai_responsavel_id].filter(Boolean)) {
    if (!idsMantidos.has(idAntigo)) {
      await requisicaoSupabase(`/rest/v1/responsaveis_familiares?id=eq.${encodeURIComponent(idAntigo)}`, { token, metodo: "DELETE" });
    }
  }
  for (const responsavel of responsaveis) {
    const id = responsavel.id;
    delete responsavel.id;
    await gravarLinha("responsaveis_familiares", { ...responsavel, familia_id: familiaId, pessoa_atendida_id: pessoaId }, token, id);
  }
}

export async function salvarPessoa(dados, token) {
  const { familia, pessoa } = traduzirFormulario(dados);
  familia.criado_em_cadastro = pessoa.data_entrada;
  const responsaveis = [
    { nome_completo: dados.motherName, parentesco: "Mãe/responsável", data_nascimento: dados.motherBirthDate || null, trabalha: dados.motherWorks === "" ? null : dados.motherWorks === "true", trabalho_ou_fonte_renda: dados.motherIncome || null, telefone: dados.phone || null, whatsapp: dados.phoneWhatsapp === "" ? null : dados.phoneWhatsapp === "true", email: dados.email || null },
    { nome_completo: dados.fatherName, parentesco: "Pai/responsável", data_nascimento: dados.fatherBirthDate || null, trabalha: dados.fatherWorks === "" ? null : dados.fatherWorks === "true", trabalho_ou_fonte_renda: dados.fatherIncome || null, telefone: dados.phone || null, whatsapp: dados.phoneWhatsapp === "" ? null : dados.phoneWhatsapp === "true", email: dados.email || null },
  ].filter((responsavel) => responsavel.nome_completo?.trim());
  const id = await requisicaoSupabase("/rest/v1/rpc/salvar_cadastro_completo", {
    token,
    metodo: "POST",
    corpo: {
      p_familia: familia,
      p_pessoa: pessoa,
      p_responsaveis: responsaveis,
      p_beneficios: [...new Set(dados.benefits || [])],
      p_atividades: [...new Set(dados.activities || [])],
      p_programas: [...new Set(dados.programs || [])],
      p_consentimento: { status: dados.consentStatus || "pendente", versao_termo: dados.consentVersion || null },
    },
  });
  const registros = await listarPessoas(token);
  return registros.find((registro) => registro.id === id) || { ...dados, id, familia_id: dados.familia_id };
}
