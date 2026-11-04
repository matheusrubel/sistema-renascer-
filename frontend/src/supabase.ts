const CHAVE_SESSAO = "renascer.supabase.session";

export type Papel = "admin" | "recepcao" | "psicologo" | "assistente_social";
export type AreaAtendimento = "social" | "psicologico";
const PAPEIS_VALIDOS: string[] = ["admin", "recepcao", "psicologo", "assistente_social"];
/** Perfis que somente consultam o cadastro (sem criar, editar ou inativar). */
export const PAPEIS_SO_LEITURA_CADASTRO: string[] = ["psicologo", "assistente_social"];
/** Perfis que abrem o módulo de atendimentos (a coordenação vê apenas a área social). */
export const PAPEIS_ATENDIMENTOS: string[] = ["psicologo", "assistente_social", "admin"];
export const AREA_DO_PAPEL: Record<string, AreaAtendimento | undefined> = { psicologo: "psicologico", assistente_social: "social" };
let configuracaoPromise;
type LinhaSupabase = Record<string, any>;

async function configuracao(): Promise<{ url: string; anonKey: string }> {
  configuracaoPromise ??= Promise.resolve({ url: "/api/supabase", anonKey: "server-managed" });
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

export function salvarSessao(sessao: any): void {
  if (sessao) sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao));
  else sessionStorage.removeItem(CHAVE_SESSAO);
  // Avisa a estrutura das páginas (barra lateral) para aparecer ou sumir na hora.
  window.dispatchEvent(new Event("renascer:sessao"));
}

async function requisicaoSupabase<T = any>(caminho: string, { token, metodo = "GET", corpo, preferencia, renovar = true }: { token?: string; metodo?: string; corpo?: any; preferencia?: string; renovar?: boolean } = {}): Promise<T> {
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
  return dados as T;
}

export async function entrar(email: string, senha: string): Promise<any> {
  const emailNormalizado = email.trim().toLowerCase();
  if (!emailNormalizado) throw new Error("Informe seu e-mail institucional.");
  if (!senha) throw new Error("Informe sua senha.");
  const sessao = await requisicaoSupabase("/auth/v1/token?grant_type=password", {
    metodo: "POST", corpo: { email: emailNormalizado, password: senha },
  });
  const perfis = await requisicaoSupabase(`/rest/v1/perfis_acesso?user_id=eq.${encodeURIComponent(sessao.user.id)}&select=nome,papel,ativo&limit=1`, { token: sessao.access_token });
  const perfil = perfis?.[0];
  if (!perfil?.ativo || !PAPEIS_VALIDOS.includes(perfil.papel)) {
    await requisicaoSupabase("/auth/v1/logout", { metodo: "POST", token: sessao.access_token }).catch(() => {});
    throw new Error("Este usuário ainda não tem um perfil institucional ativo. Peça à administração para liberar o acesso.");
  }
  try { sessionStorage.removeItem("renascer.ultima.rota"); } catch { /* sem armazenamento */ }
  salvarSessao({ ...sessao, perfil });
  return perfil;
}

export async function sair() {
  const sessao = obterSessao();
  try { sessionStorage.removeItem("renascer.ultima.rota"); } catch { /* sem armazenamento */ }
  salvarSessao(null);
  if (sessao?.access_token) await requisicaoSupabase("/auth/v1/logout", { metodo: "POST", token: sessao.access_token }).catch(() => {});
}

export async function solicitarRedefinicaoSenha(email: string): Promise<void> {
  const config = await configuracao();
  const redirectTo = `${window.location.origin}/alterar-senha`;
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

export async function atualizarSenha(senha: string, token = obterSessao()?.access_token): Promise<any> {
  if (!token) throw new Error("Sua sessão de redefinição expirou. Solicite um novo link.");
  return requisicaoSupabase("/auth/v1/user", { token, metodo: "PUT", corpo: { password: senha } });
}

export async function solicitarAcesso({ nome, email, area }: { nome: string; email: string; area: string }): Promise<void> {
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

const SELECT_CADASTRO = "*,familia:familias(*),responsaveis:responsaveis_familiares(*),consentimentos:consentimentos_cadastro(*),beneficios:pessoa_beneficio(detalhe_outro,catalogo:catalogo_beneficios(nome)),atividades:pessoa_atividade_interesse(catalogo:catalogo_atividades(nome)),programas:pessoa_programa_interesse(catalogo:catalogo_programas(nome))";

/** Converte a linha com tudo embutido (uma única consulta) no formato usado pela interface. */
function montarPessoa(linha: LinhaSupabase): any {
  const { familia, responsaveis, consentimentos, beneficios, atividades, programas, ...pessoa } = linha;
  const familiares: LinhaSupabase[] = responsaveis || [];
  const consentimento = [...(consentimentos || [])].sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)))[0];
  const nomes = (lista?: LinhaSupabase[]) => (lista || []).map((item) => ({ nome: item.catalogo?.nome })).filter((item) => item.nome);
  return converterPessoa(pessoa, familia || {}, {
    mae: familiares.find((item) => /mãe/i.test(item.parentesco || "")),
    pai: familiares.find((item) => /pai/i.test(item.parentesco || "")),
    consentimento,
    benefits: nomes(beneficios),
    activities: nomes(atividades),
    programs: nomes(programas),
  });
}

async function carregarCadastros(filtro: string, token: string): Promise<any[]> {
  const linhas = await requisicaoSupabase<LinhaSupabase[]>(`/rest/v1/pessoas_atendidas?select=${encodeURIComponent(SELECT_CADASTRO)}${filtro}`, { token });
  return linhas.map(montarPessoa);
}

export async function obterPessoa(id: string, token: string): Promise<any | null> {
  return (await carregarCadastros(`&id=eq.${encodeURIComponent(id)}&limit=1`, token))[0] ?? null;
}

export type FiltrosCadastro = { status: "ativo" | "inativo" | "todos"; busca: string; faixa: "all" | "child" | "teen" | "adult"; prioridade: "all" | "priority" | "regular" };
export const TAMANHO_PAGINA_CADASTROS = 50;

async function idsDaPagina(filtros: FiltrosCadastro, offset: number, limite: number, token: string): Promise<{ total: number; ids: string[] }> {
  return requisicaoSupabase("/rest/v1/rpc/listar_cadastros_ids", {
    token, metodo: "POST",
    corpo: { p_status: filtros.status, p_busca: filtros.busca, p_faixa: filtros.faixa, p_prioridade: filtros.prioridade, p_limite: limite, p_offset: offset },
  });
}

/** Uma página da listagem: duas consultas, não importa quantos cadastros existam. */
export async function listarCadastrosPagina(filtros: FiltrosCadastro, offset: number, token: string, limite = TAMANHO_PAGINA_CADASTROS): Promise<{ itens: any[]; total: number }> {
  const { total, ids } = await idsDaPagina(filtros, offset, limite, token);
  if (!ids.length) return { itens: [], total };
  const ordem = new Map(ids.map((id, indice) => [id, indice]));
  const itens = await carregarCadastros(`&id=in.(${ids.join(",")})`, token);
  itens.sort((a, b) => (ordem.get(a.id) ?? 0) - (ordem.get(b.id) ?? 0));
  return { itens, total };
}

export async function estatisticasCadastro(status: FiltrosCadastro["status"], token: string): Promise<{ total: number; menores: number; prioritarios: number; familias: number }> {
  return requisicaoSupabase("/rest/v1/rpc/estatisticas_cadastro", { token, metodo: "POST", corpo: { p_status: status } });
}

/** Todos os cadastros do filtro, em lotes enxutos, para exportação. */
export async function listarCadastrosParaExportar(filtros: FiltrosCadastro, token: string): Promise<any[]> {
  const ids: string[] = [];
  for (let offset = 0; ; offset += 200) {
    const pagina = await idsDaPagina(filtros, offset, 200, token);
    ids.push(...pagina.ids);
    if (pagina.ids.length < 200 || ids.length >= pagina.total) break;
  }
  const colunas = "id,nome_completo,data_nascimento,escola,forma_entrada,situacao_prioritaria,status,familia:familias(bairro)";
  const lotes: string[][] = [];
  for (let i = 0; i < ids.length; i += 100) lotes.push(ids.slice(i, i + 100));
  const linhas: LinhaSupabase[] = [];
  for (let i = 0; i < lotes.length; i += 4) {
    const grupo = await Promise.all(lotes.slice(i, i + 4).map((lote) => requisicaoSupabase<LinhaSupabase[]>(`/rest/v1/pessoas_atendidas?select=${encodeURIComponent(colunas)}&id=in.(${lote.join(",")})`, { token })));
    linhas.push(...grupo.flat());
  }
  const ordem = new Map(ids.map((id, indice) => [id, indice]));
  linhas.sort((a, b) => (ordem.get(a.id) ?? 0) - (ordem.get(b.id) ?? 0));
  return linhas.map((linha) => ({ name: linha.nome_completo, birthDate: linha.data_nascimento, school: linha.escola, neighborhood: linha.familia?.bairro, referralSource: linha.forma_entrada, priority: linha.situacao_prioritaria, status: linha.status }));
}

/** Dados enxutos para os relatórios, lidos em páginas de 1.000 (limite da API). */
export async function listarDadosRelatorio(token: string): Promise<any[]> {
  const colunas = "id,data_nascimento,sexo,forma_entrada,motivo_encaminhamento,situacao_prioritaria,escola,data_entrada,familia_id,familia:familias(bairro)";
  const tamanho = 1000;
  const resultado: any[] = [];
  for (let offset = 0; offset < 200000; offset += tamanho) {
    const lote = await requisicaoSupabase<LinhaSupabase[]>(`/rest/v1/pessoas_atendidas?select=${encodeURIComponent(colunas)}&status=eq.ativo&order=id.asc&limit=${tamanho}&offset=${offset}`, { token });
    if (!lote.length) break;
    resultado.push(...lote.map((linha) => ({
      id: linha.id, birthDate: linha.data_nascimento, sex: linha.sexo, referralSource: linha.forma_entrada, referralReason: linha.motivo_encaminhamento,
      priority: linha.situacao_prioritaria, school: linha.escola, entryDate: linha.data_entrada, family_id: linha.familia_id, neighborhood: linha.familia?.bairro,
    })));
  }
  return resultado;
}

export async function alterarStatusPessoa(id: string, status: "ativo" | "inativo", token: string): Promise<void> {
	await requisicaoSupabase(`/rest/v1/pessoas_atendidas?id=eq.${encodeURIComponent(id)}`, {
		token,
		metodo: "PATCH",
		corpo: { status },
		preferencia: "return=minimal",
	});
}

const BUCKET_CADASTROS = "cadastros-privados";
export const LIMITE_ARQUIVO_BYTES = 5 * 1024 * 1024;
export const TIPOS_FOTO = ["image/jpeg", "image/png"];
export const TIPOS_TERMO = ["application/pdf", "image/jpeg", "image/png"];

const extensaoDoTipo = (tipo: string) => (tipo === "application/pdf" ? "pdf" : tipo === "image/png" ? "png" : "jpg");

/** Valida tipo e tamanho antes do envio; devolve a mensagem de erro ou uma string vazia. */
export function validarArquivo(arquivo: File, tiposAceitos: string[]): string {
  if (!tiposAceitos.includes(arquivo.type)) return `Formato não aceito (${arquivo.name}). Use ${tiposAceitos.map((tipo) => extensaoDoTipo(tipo).toUpperCase()).join(", ")}.`;
  if (arquivo.size > LIMITE_ARQUIVO_BYTES) return `O arquivo ${arquivo.name} passa de 5 MB.`;
  return "";
}

async function enviarArquivo(caminho: string, arquivo: File, token: string): Promise<void> {
  const config = await configuracao();
  const resposta = await fetch(`${config.url}/storage/v1/object/${BUCKET_CADASTROS}/${caminho}`, {
    method: "POST",
    headers: { apikey: config.anonKey, Authorization: `Bearer ${token}`, "Content-Type": arquivo.type },
    body: arquivo,
  });
  if (!resposta.ok) {
    let erro;
    try { erro = await resposta.json(); } catch { erro = null; }
    throw new Error(erro?.message || erro?.error || "Não foi possível enviar o arquivo.");
  }
}

export async function baixarArquivoCadastro(caminho: string, token: string): Promise<Blob> {
  const config = await configuracao();
  const resposta = await fetch(`${config.url}/storage/v1/object/authenticated/${BUCKET_CADASTROS}/${caminho}`, {
    headers: { apikey: config.anonKey, Authorization: `Bearer ${token}` },
  });
  if (!resposta.ok) throw new Error("Não foi possível abrir o arquivo.");
  return resposta.blob();
}

async function removerArquivo(caminho: string, token: string): Promise<void> {
  const config = await configuracao();
  await fetch(`${config.url}/storage/v1/object/${BUCKET_CADASTROS}/${caminho}`, {
    method: "DELETE",
    headers: { apikey: config.anonKey, Authorization: `Bearer ${token}` },
  });
}

/** Envia a foto para o bucket privado, grava o caminho no cadastro e remove a foto anterior. */
export async function anexarFoto(pessoaId: string, arquivo: File, caminhoAnterior: string | null | undefined, token: string): Promise<string> {
  const erro = validarArquivo(arquivo, TIPOS_FOTO);
  if (erro) throw new Error(erro);
  const caminho = `fotos/${pessoaId}/${crypto.randomUUID()}.${extensaoDoTipo(arquivo.type)}`;
  await enviarArquivo(caminho, arquivo, token);
  try {
    await requisicaoSupabase(`/rest/v1/pessoas_atendidas?id=eq.${encodeURIComponent(pessoaId)}`, {
      token, metodo: "PATCH", corpo: { foto_storage_path: caminho }, preferencia: "return=minimal",
    });
  } catch (falha) {
    await removerArquivo(caminho, token).catch(() => {});
    throw falha;
  }
  if (caminhoAnterior) await removerArquivo(caminhoAnterior, token).catch(() => {});
  return caminho;
}

/** Envia o termo assinado e só então marca o consentimento como assinado. */
export async function anexarTermoAssinado(pessoaId: string, consentimentoId: string, arquivo: File, versaoTermo: string | null, caminhoAnterior: string | null | undefined, token: string): Promise<string> {
  const erro = validarArquivo(arquivo, TIPOS_TERMO);
  if (erro) throw new Error(erro);
  const caminho = `termos/${pessoaId}/${crypto.randomUUID()}.${extensaoDoTipo(arquivo.type)}`;
  await enviarArquivo(caminho, arquivo, token);
  try {
    await requisicaoSupabase(`/rest/v1/consentimentos_cadastro?id=eq.${encodeURIComponent(consentimentoId)}`, {
      token, metodo: "PATCH", preferencia: "return=minimal",
      corpo: { status: "assinado", assinado_em: new Date().toISOString(), documento_storage_path: caminho, versao_termo: versaoTermo || null },
    });
  } catch (falha) {
    await removerArquivo(caminho, token).catch(() => {});
    throw falha;
  }
  if (caminhoAnterior) await removerArquivo(caminhoAnterior, token).catch(() => {});
  return caminho;
}

function converterPessoa(pessoa: any, familia: any = {}, relacionados: any = {}): any {
  const nomesProgramas: Record<string, string> = { 'Projeto "Mãos que Transformam"': "Projeto Mãos que Transformam", 'Projeto "Entrelaços"': "Projeto Entrelaços" };
  const nomesBeneficios: Record<string, string> = { "Benefício de Prestação Continuada - BPC": "BPC", "Programa Auxílio Brasil": "Auxílio Brasil" };
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
    consentId: relacionados.consentimento?.id,
    consentDocumentPath: relacionados.consentimento?.documento_storage_path,
    photoPath: pessoa.foto_storage_path,
    seekingWork: pessoa.procura_trabalho == null ? "" : String(pessoa.procura_trabalho),
    currentProfession: pessoa.profissao_atual,
    currentEmployer: pessoa.empresa_atual,
    currentPay: pessoa.remuneracao_atual,
    workPhone: pessoa.telefone_trabalho,
    pastWorkHistory: pessoa.historico_profissional,
    notes: pessoa.observacoes_gerais,
    activities: (relacionados.activities || []).map((item: any) => item.nome),
    programs: (relacionados.programs || []).map((item: any) => nomesProgramas[item.nome] || item.nome),
    benefits: (relacionados.benefits || []).map((item: any) => nomesBeneficios[item.nome] || item.nome),
  };
}

const colunasFamilia: Record<string, string> = {
  address: "endereco", neighborhood: "bairro", reference: "ponto_referencia", phone: "telefone", householdSize: "quantidade_moradores",
  postalCode: "cep", state: "estado", municipality: "municipio", street: "logradouro", addressNumber: "numero_endereco", addressComplement: "complemento",
  residenceSinceYear: "mora_desde_ano", riskArea: "area_risco", housingType: "tipo_moradia", roomCount: "numero_comodos", wallMaterial: "material_paredes",
  floorMaterial: "material_piso", roofMaterial: "material_telhado", waterSupply: "abastecimento_agua", lighting: "forma_iluminacao",
  sewageDestination: "destino_esgoto", garbageDestination: "destino_lixo", cadunico: "cadunico", householdSubstanceUse: "uso_substancias_psicoativas",
};
const colunasPessoa: Record<string, string> = {
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

function traduzirFormulario(dados: Record<string, any>): { familia: Record<string, any>; pessoa: Record<string, any> } {
  const familia: Record<string, any> = {};
  const pessoa: Record<string, any> = {};
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

async function gravarLinha(tabela: string, dados: any, token: string, id?: string): Promise<any> {
  const caminho = id ? `/rest/v1/${tabela}?id=eq.${encodeURIComponent(id)}` : `/rest/v1/${tabela}`;
  const linhas = await requisicaoSupabase(caminho, { token, metodo: id ? "PATCH" : "POST", corpo: dados, preferencia: "return=representation" });
  return linhas?.[0];
}

const catalogos: Record<string, { tabela: string; chave: string; nomes: Record<string, string> }> = {
  pessoa_beneficio: { tabela: "catalogo_beneficios", chave: "beneficio_id", nomes: { BPC: "Benefício de Prestação Continuada - BPC", "Auxílio Brasil": "Programa Auxílio Brasil" } },
  pessoa_atividade_interesse: { tabela: "catalogo_atividades", chave: "atividade_id", nomes: {} },
  pessoa_programa_interesse: { tabela: "catalogo_programas", chave: "programa_id", nomes: { "Projeto Mãos que Transformam": 'Projeto "Mãos que Transformam"', "Projeto Entrelaços": 'Projeto "Entrelaços"' } },
};

async function sincronizarVinculos(tabelaVinculo: keyof typeof catalogos, idPessoa: string, valores: string[], token: string, detalheOutro: string | null = null): Promise<void> {
  const config = catalogos[tabelaVinculo];
  await requisicaoSupabase(`/rest/v1/${tabelaVinculo}?pessoa_atendida_id=eq.${encodeURIComponent(idPessoa)}`, { token, metodo: "DELETE" });
  const nomes = [...new Set((valores || []).filter(Boolean).map((nome) => config.nomes[nome] || nome))];
  if (!nomes.length) return;
  const parametros = nomes.map((nome) => `"${nome.replaceAll('"', '\\"')}"`).join(",");
  const opcoes = await requisicaoSupabase<LinhaSupabase[]>(`/rest/v1/${config.tabela}?select=id,nome&nome=in.(${encodeURIComponent(parametros)})`, { token });
  const porNome = new Map(opcoes.map((item) => [item.nome, item.id]));
  const vinculos = nomes.flatMap((nome) => porNome.has(nome) ? [{ pessoa_atendida_id: idPessoa, [config.chave]: porNome.get(nome), ...(tabelaVinculo === "pessoa_beneficio" && nome === "Outro benefício" && detalheOutro ? { detalhe_outro: detalheOutro } : {}) }] : []);
  if (vinculos.length) await requisicaoSupabase(`/rest/v1/${tabelaVinculo}`, { token, metodo: "POST", corpo: vinculos, preferencia: "return=minimal" });
}

async function sincronizarResponsaveis(dados: Record<string, any>, pessoaId: string, familiaId: string, token: string): Promise<void> {
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

export async function salvarPessoa(dados: Record<string, any>, token: string): Promise<any> {
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
  return (await obterPessoa(id, token)) || { ...dados, id, familia_id: dados.familia_id };
}



// ---------------------------------------------------------------------------
// Atendimentos sociais e psicológicos (migration 007)
// As regras de acesso valem no banco; a interface apenas reflete o perfil.
// ---------------------------------------------------------------------------

export type Encaminhamento = { id: string; destino: string; destino_outro?: string | null; data: string; situacao: "encaminhado" | "em_andamento" | "concluido" | "sem_retorno"; retorno?: string | null };
export type Atendimento = {
  id: string; area: AreaAtendimento; data_hora: string; tipo?: string | null; profissional?: string | null; meu: boolean;
  versao: number; total_versoes: number; atualizado_em: string; motivo?: string | null; relato?: string | null; combinados?: string | null;
  encaminhamentos: Encaminhamento[];
};
export type NovoAtendimento = {
  pessoaId: string; area: AreaAtendimento; dataHora: string; tipoId: string | null; motivo: string; relato: string; combinados: string;
  encaminhamentos: { destino_id: string; destino_outro: string; data: string }[];
};

export const SITUACOES_ENCAMINHAMENTO: Record<Encaminhamento["situacao"], string> = {
  encaminhado: "Encaminhado", em_andamento: "Em andamento", concluido: "Concluído", sem_retorno: "Sem retorno",
};

export async function buscarPessoasParaAtendimento(termo: string, token: string): Promise<{ id: string; nome_completo: string; data_nascimento: string; status: string }[]> {
  const texto = termo.trim().replace(/[*,()%]/g, " ").trim();
  if (texto.length < 2) return [];
  return requisicaoSupabase(`/rest/v1/pessoas_atendidas?select=id,nome_completo,data_nascimento,status&nome_completo=ilike.${encodeURIComponent(`*${texto}*`)}&order=nome_completo.asc&limit=20`, { token });
}

export async function listarCatalogosAtendimento(token: string): Promise<{ tipos: { id: string; nome: string }[]; destinos: { id: string; nome: string }[] }> {
  const [tipos, destinos] = await Promise.all([
    requisicaoSupabase<{ id: string; nome: string }[]>("/rest/v1/tipos_atendimento?select=id,nome&ativo=eq.true&order=nome.asc", { token }),
    requisicaoSupabase<{ id: string; nome: string }[]>("/rest/v1/destinos_encaminhamento?select=id,nome&ativo=eq.true&order=nome.asc", { token }),
  ]);
  return { tipos, destinos };
}

/** Devolve só o que o perfil pode ver e registra no banco quem abriu o histórico. */
export async function listarHistoricoAtendimentos(pessoaId: string, token: string): Promise<Atendimento[]> {
  return (await requisicaoSupabase("/rest/v1/rpc/listar_historico_atendimentos", { token, metodo: "POST", corpo: { p_pessoa: pessoaId } })) || [];
}

export async function registrarAtendimento(dados: NovoAtendimento, token: string): Promise<string> {
  return requisicaoSupabase("/rest/v1/rpc/registrar_atendimento", {
    token, metodo: "POST",
    corpo: {
      p_pessoa: dados.pessoaId, p_area: dados.area, p_data_hora: new Date(dados.dataHora).toISOString(), p_tipo: dados.tipoId || null,
      p_motivo: dados.motivo, p_relato: dados.relato, p_combinados: dados.combinados,
      p_encaminhamentos: dados.encaminhamentos.filter((item) => item.destino_id || item.destino_outro.trim()),
    },
  });
}

/** Correção = nova versão; a anterior continua no histórico. */
export async function corrigirAtendimento(atendimentoId: string, dados: { motivo: string; relato: string; combinados: string }, token: string): Promise<number> {
  return requisicaoSupabase("/rest/v1/rpc/corrigir_atendimento", {
    token, metodo: "POST",
    corpo: { p_atendimento: atendimentoId, p_motivo: dados.motivo, p_relato: dados.relato, p_combinados: dados.combinados },
  });
}

export async function atualizarSituacaoEncaminhamento(encaminhamentoId: string, situacao: Encaminhamento["situacao"], retorno: string, token: string): Promise<void> {
  await requisicaoSupabase("/rest/v1/encaminhamento_eventos", {
    token, metodo: "POST", preferencia: "return=minimal",
    corpo: { encaminhamento_id: encaminhamentoId, situacao, retorno: retorno.trim() || null },
  });
}

/** Registra para quem o histórico foi emitido (ex.: Vara da Infância). */
export async function registrarEmissaoHistorico(pessoaId: string, area: AreaAtendimento, destinatario: string, token: string): Promise<void> {
  await requisicaoSupabase("/rest/v1/emissoes_historico", {
    token, metodo: "POST", preferencia: "return=minimal",
    corpo: { pessoa_atendida_id: pessoaId, area, destinatario: destinatario.trim() },
  });
}

// Acessos temporários (somente coordenação)
export type AcessoTemporario = { id: string; usuario_id: string; area: AreaAtendimento; valido_ate: string; revogado: boolean };

export async function listarPerfisAcesso(token: string): Promise<{ user_id: string; nome: string; papel: string; ativo: boolean }[]> {
  return requisicaoSupabase("/rest/v1/perfis_acesso?select=user_id,nome,papel,ativo&ativo=eq.true&order=nome.asc", { token });
}

export async function listarAcessosTemporarios(token: string): Promise<AcessoTemporario[]> {
  return requisicaoSupabase("/rest/v1/acessos_temporarios?select=id,usuario_id,area,valido_ate,revogado&revogado=eq.false&valido_ate=gt." + encodeURIComponent(new Date().toISOString()) + "&order=valido_ate.asc", { token });
}

export async function concederAcessoTemporario(usuarioId: string, area: AreaAtendimento, dias: number, token: string): Promise<void> {
  const validoAte = new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString();
  await requisicaoSupabase("/rest/v1/acessos_temporarios", {
    token, metodo: "POST", preferencia: "return=minimal", corpo: { usuario_id: usuarioId, area, valido_ate: validoAte },
  });
}

export async function revogarAcessoTemporario(id: string, token: string): Promise<void> {
  await requisicaoSupabase(`/rest/v1/acessos_temporarios?id=eq.${encodeURIComponent(id)}`, {
    token, metodo: "PATCH", preferencia: "return=minimal", corpo: { revogado: true },
  });
}

// ---------------------------------------------------------------------------
// Gerenciamento de usuários (somente coordenação)
// Criar conta e redefinir senha passam pelo backend, que guarda a chave administrativa.
// ---------------------------------------------------------------------------

export type UsuarioSistema = { id: string; email: string; nome: string; papel: Papel | null; ativo: boolean; ultimoAcesso: string | null; criadoEm: string | null };
export type SolicitacaoAcesso = { id: string; nome: string; email: string; area: string; criado_em: string };

async function requisicaoApi<T = any>(caminho: string, token: string, { metodo = "GET", corpo }: { metodo?: string; corpo?: unknown } = {}): Promise<T> {
  const resposta = await fetch(`/api/admin/usuarios${caminho}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, ...(corpo !== undefined ? { "Content-Type": "application/json" } : {}) },
    ...(corpo !== undefined ? { body: JSON.stringify(corpo) } : {}),
  }).catch(() => null);
  if (!resposta) throw new Error("Não foi possível falar com o servidor. Verifique se a API está em execução.");
  const texto = await resposta.text();
  let dados: any = null;
  try { dados = texto ? JSON.parse(texto) : null; } catch { dados = null; }
  if (!resposta.ok) throw new Error(dados?.message || "Não foi possível concluir a operação.");
  return dados as T;
}

export const listarUsuarios = (token: string) => requisicaoApi<UsuarioSistema[]>("", token);
export const criarUsuario = (dados: { nome: string; email: string; papel: Papel }, token: string) =>
  requisicaoApi<{ id: string; email: string; senhaTemporaria: string }>("", token, { metodo: "POST", corpo: dados });
export const atualizarUsuario = (id: string, dados: { nome?: string; papel?: Papel; ativo?: boolean }, token: string) =>
  requisicaoApi<{ ok: boolean }>(`/${encodeURIComponent(id)}`, token, { metodo: "PATCH", corpo: dados });
export const gerarNovaSenhaTemporaria = (id: string, token: string) =>
  requisicaoApi<{ senhaTemporaria: string }>(`/${encodeURIComponent(id)}/senha`, token, { metodo: "POST" });

export async function listarSolicitacoesAcesso(token: string): Promise<SolicitacaoAcesso[]> {
  return requisicaoSupabase("/rest/v1/solicitacoes_acesso?select=id,nome,email,area,criado_em&status=eq.pendente&order=criado_em.asc", { token });
}

export async function resolverSolicitacaoAcesso(id: string, status: "aprovada" | "recusada", revisorId: string, token: string): Promise<void> {
  await requisicaoSupabase(`/rest/v1/solicitacoes_acesso?id=eq.${encodeURIComponent(id)}`, {
    token, metodo: "PATCH", preferencia: "return=minimal",
    corpo: { status, revisado_em: new Date().toISOString(), revisado_por: revisorId },
  });
}
