import readline from "node:readline";

const rl = readline.createInterface({ input: process.stdin });
const linhas = rl[Symbol.asyncIterator]();

async function perguntar(texto: string): Promise<string> {
  process.stdout.write(texto + " ");
  const { value } = await linhas.next();
  return (value ?? "").trim();
}

async function escolher(titulo: string, opcoes: string[]): Promise<string> {
  console.log(`\n${titulo}`);
  opcoes.forEach((o, i) => console.log(`  ${i + 1}) ${o}`));
  const r = await perguntar("Número:");
  return opcoes[Number(r) - 1] ?? "";
}

async function escolherVarios(titulo: string, opcoes: string[]): Promise<string[]> {
  console.log(`\n${titulo} (números separados por vírgula, Enter para nenhum)`);
  opcoes.forEach((o, i) => console.log(`  ${i + 1}) ${o}`));
  const r = await perguntar("Números:");
  return r
    .split(",")
    .map((n) => opcoes[Number(n.trim()) - 1])
    .filter(Boolean);
}

async function simNao(texto: string): Promise<string> {
  const r = (await perguntar(`${texto} (s/n):`)).toLowerCase();
  if (r.startsWith("s")) return "Sim";
  if (r.startsWith("n")) return "Não";
  return "";
}

const formasAcesso = [
  "Procura Espontânea",
  "Busca Ativa",
  "Encaminhamento da Rede Socioassistencial",
  "Encaminhamento das demais Políticas Públicas",
];

const oficinasGrupos = [
  "Oficina: Atividade Artística e Cultural",
  "Oficina: Cultural Digital",
  "Oficina: Corpo e Movimento",
  "Oficina: Corte e Costura",
  "Grupo de Apoio à Família - GAF",
  "Grupo de Apoio à Criança - GAC",
  "Grupo de Apoio ao Adolescente - GAA",
];

const programasProjetos = [
  "Programa de Promoção e Apoio Sócio Familiar",
  'Projeto "Mãos que Transformam"',
  'Projeto "Entrelaços"',
];

const beneficios = [
  "Leite das Crianças",
  "Programa Auxílio Brasil",
  "Benefício de Prestação Continuada - BPC",
];

async function main() {
  console.log("=== Cadastro - Serviços Institucionais ===");
  console.log("(Enter pula o campo)\n");

  const hoje = new Date().toLocaleDateString("pt-BR");
  const dataPreenchimento = (await perguntar(`Data de preenchimento [${hoje}]:`)) || hoje;

  // Dados dos atendimentos
  const formaAcesso = await escolher("Forma de acesso ao serviço:", formasAcesso);
  let detalheAcesso = "";
  if (formaAcesso === formasAcesso[2] || formaAcesso === formasAcesso[3]) {
    detalheAcesso = await perguntar("Qual?");
  }
  const oficinas = await escolherVarios("Oficinas e Grupos de Convívio:", oficinasGrupos);
  const programas = await escolherVarios("Programas e Projetos Institucionais:", programasProjetos);
  const orientador = await perguntar("\nOrientador(a) Social dos Grupos e Atividades:");

  // Dados pessoais do usuário
  console.log("\n--- Dados Pessoais do Usuário ---");
  const nome = await perguntar("Nome:");
  const nascimento = await perguntar("Data de nascimento (dd/mm/aaaa):");
  const sexo = await escolher("Sexo:", ["Feminino", "Masculino", "Outro"]);
  const estadoCivil = await escolher("Estado civil:", [
    "Solteiro(a)",
    "Casado(a)",
    "União estável",
    "Separado(a)",
    "Divorciado(a)",
    "Viúvo(a)",
  ]);
  const nis = await perguntar("\nNº do NIS:");
  const endereco = await perguntar("Endereço:");
  const bairro = await perguntar("Bairro:");
  const pontoReferencia = await perguntar("Ponto de referência:");
  const telefone = await perguntar("Telefone:");
  const rg = await perguntar("RG:");
  const cpf = await perguntar("CPF:");
  const carteiraTrabalho = await simNao("Carteira de trabalho");
  const escola = await perguntar("Escola:");
  const serie = await perguntar("Série:");
  const turno = await escolher("Turno:", ["Manhã", "Tarde", "Noite", "Integral"]);

  // Dados familiares
  console.log("\n--- Dados Familiares ---");
  const maeNome = await perguntar("Nome da mãe:");
  const maeNascimento = await perguntar("Data de nascimento da mãe:");
  const maeTrabalha = await simNao("Mãe trabalha");
  const maeLocal = await perguntar("Local de trabalho ou fonte de renda da mãe:");

  const paiNome = await perguntar("\nNome do pai:");
  const paiNascimento = await perguntar("Data de nascimento do pai:");
  const paiTrabalha = await simNao("Pai trabalha");
  const paiLocal = await perguntar("Local de trabalho ou fonte de renda do pai:");

  const pessoasCasa = await perguntar("\nQuantas pessoas moram na casa:");

  // Informações gerais
  console.log("\n--- Informações Gerais ---");
  const beneficiosRecebidos = await escolherVarios("A família recebe algum benefício social do governo?", beneficios);
  const outrosBeneficios = await perguntar("Outros benefícios:");

  // Situação e observações
  console.log("\n--- Situação do Usuário e Observações ---");
  const observacoes = await perguntar("Observações:");

  rl.close();

  // ---------- resultado ----------
  const v = (s: string) => s || "-";
  const lista = (l: string[]) => (l.length ? l.join(", ") : "-");

  console.log("\n\n==================================================");
  console.log("         FICHA CADASTRAL CADASTRADA");
  console.log("==================================================");
  console.log(`Data de preenchimento: ${dataPreenchimento}`);

  console.log("\n--- Dados dos Atendimentos ---");
  console.log(`Forma de acesso: ${v(formaAcesso)}`);
  if (detalheAcesso) console.log(`  Qual: ${detalheAcesso}`);
  console.log(`Oficinas e grupos: ${lista(oficinas)}`);
  console.log(`Programas e projetos: ${lista(programas)}`);
  console.log(`Orientador(a) social: ${v(orientador)}`);

  console.log("\n--- Dados Pessoais do Usuário ---");
  console.log(`Nome: ${v(nome)}`);
  console.log(`Data de nascimento: ${v(nascimento)}`);
  console.log(`Sexo: ${v(sexo)}`);
  console.log(`Estado civil: ${v(estadoCivil)}`);
  console.log(`NIS: ${v(nis)}`);
  console.log(`Endereço: ${v(endereco)}`);
  console.log(`Bairro: ${v(bairro)}`);
  console.log(`Ponto de referência: ${v(pontoReferencia)}`);
  console.log(`Telefone: ${v(telefone)}`);
  console.log(`RG: ${v(rg)}`);
  console.log(`CPF: ${v(cpf)}`);
  console.log(`Carteira de trabalho: ${v(carteiraTrabalho)}`);
  console.log(`Escola: ${v(escola)}`);
  console.log(`Série: ${v(serie)}`);
  console.log(`Turno: ${v(turno)}`);

  console.log("\n--- Dados Familiares ---");
  console.log(`Mãe: ${v(maeNome)}`);
  console.log(`  Nascimento: ${v(maeNascimento)}`);
  console.log(`  Trabalha: ${v(maeTrabalha)}`);
  console.log(`  Local de trabalho/renda: ${v(maeLocal)}`);
  console.log(`Pai: ${v(paiNome)}`);
  console.log(`  Nascimento: ${v(paiNascimento)}`);
  console.log(`  Trabalha: ${v(paiTrabalha)}`);
  console.log(`  Local de trabalho/renda: ${v(paiLocal)}`);
  console.log(`Pessoas na casa: ${v(pessoasCasa)}`);

  console.log("\n--- Informações Gerais ---");
  console.log(`Benefícios: ${lista(beneficiosRecebidos)}`);
  if (outrosBeneficios) console.log(`Outros: ${outrosBeneficios}`);

  console.log("\n--- Situação do Usuário e Observações ---");
  console.log(v(observacoes));
  console.log("\n==================================================\n");
}

main();
