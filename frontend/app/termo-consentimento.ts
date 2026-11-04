/** Versão registrada no cadastro enquanto o Instituto não aprovar o texto definitivo. */
export const TERMO_VERSAO = "provisorio-v0.1";

type DadosTermo = Record<string, any>;

const mapaEscape: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
const escapar = (valor: unknown) => String(valor ?? "").replace(/[&<>"']/g, (caractere) => mapaEscape[caractere] ?? caractere);

function formatarData(data?: string): string {
  if (!data) return "";
  const parsed = new Date(`${data}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toLocaleDateString("pt-BR");
}

const linhaEmBranco = (largura = "100%") => `<span class="linha" style="min-width:${largura}"></span>`;
const campo = (valor: unknown, largura = "220px") => (String(valor ?? "").trim() ? `<strong>${escapar(valor)}</strong>` : linhaEmBranco(largura));

export function montarTermoHtml(dados: DadosTermo): string {
  const responsavel = dados.motherName?.trim() || dados.fatherName?.trim() || "";
  const nascimento = formatarData(dados.birthDate);
  const documento = [dados.rg ? `RG ${dados.rg}` : "", dados.cpf ? `CPF ${dados.cpf}` : ""].filter(Boolean).join(" · ");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Termo de consentimento - ${escapar(dados.name)}</title><style>
body{font:13px/1.55 Arial,sans-serif;color:#292535;margin:30px 40px}
.aviso{border:1px solid #c9a23d;background:#fbf4dc;color:#6d5514;padding:8px 12px;border-radius:4px;font-size:11px;margin-bottom:18px}
header{border-bottom:2px solid #332652;padding-bottom:12px;margin-bottom:16px}
h1{font-size:18px;margin:0 0 4px;color:#332652}header p{margin:0;color:#67766b;font-size:11px}
h2{font-size:13px;margin:16px 0 4px;color:#332652}p{margin:0 0 6px}
.linha{display:inline-block;border-bottom:1px solid #444;height:14px;vertical-align:baseline}
.opcoes span{display:inline-block;margin-right:28px}
.assinaturas{display:flex;gap:40px;margin-top:46px}.assinaturas div{flex:1;text-align:center;font-size:11px}.assinaturas .traco{border-top:1px solid #444;padding-top:4px}
footer{margin-top:26px;border-top:1px solid #dce4dc;padding-top:8px;color:#78847b;font-size:10px}
@media print{body{margin:14mm}}
</style></head><body>
<div class="aviso"><strong>MODELO PROVISÓRIO (${escapar(TERMO_VERSAO)}).</strong> Texto sujeito a revisão e aprovação do Instituto antes do uso oficial.</div>
<header><h1>Instituto de Ação Social Renascer</h1><p>Termo de consentimento para tratamento de dados pessoais e uso de imagem</p></header>
<p>Eu, ${campo(responsavel, "280px")}, ${campo(documento, "180px")}, responsável legal por ${campo(dados.name, "280px")}, nascido(a) em ${campo(nascimento, "90px")}, declaro que fui informado(a) sobre o tratamento dos dados descrito abaixo e <strong>consinto de forma específica e destacada</strong>, nos termos do art. 14, §1º, da Lei nº 13.709/2018 (LGPD).</p>
<h2>1. Finalidade</h2>
<p>Os dados serão usados para cadastro, acolhimento, acompanhamento e organização das atividades do Instituto, e para elaborar relatórios e prestações de contas dos projetos.</p>
<h2>2. Dados tratados</h2>
<p>Dados de identificação, escola, endereço e contato, composição familiar, benefícios, atividades escolhidas, origem do encaminhamento e as informações de saúde e situação social informadas no cadastro.</p>
<h2>3. Sigilo e acesso</h2>
<p>O acesso aos dados é restrito à equipe autorizada do Instituto, de acordo com a função de cada pessoa. Informações sociais e psicológicas são tratadas com sigilo reforçado.</p>
<h2>4. Relatórios</h2>
<p>Relatórios e estatísticas usam dados agregados, sem identificar a criança ou a família, salvo quando houver obrigação legal ou nova autorização.</p>
<h2>5. Uso de imagem (opcional)</h2>
<p class="opcoes"><span>(&nbsp;&nbsp;&nbsp;) Autorizo</span><span>(&nbsp;&nbsp;&nbsp;) Não autorizo</span></p>
<p>o uso da imagem da criança em registros das atividades e em materiais institucionais do Instituto, sem fins comerciais.</p>
<h2>6. Direitos e revogação</h2>
<p>Posso, a qualquer momento e mediante solicitação ao Instituto, confirmar a existência de tratamento, acessar e corrigir os dados, e revogar este consentimento, conforme os arts. 8º, §5º, e 18 da LGPD. A revogação não afeta o tratamento já realizado.</p>
<h2>7. Guarda</h2>
<p>Os dados são mantidos enquanto durar o vínculo com o Instituto e pelo prazo que for definido pelo Instituto ou exigido em lei.</p>
<p style="margin-top:18px">Local e data: ${linhaEmBranco("200px")}, ${linhaEmBranco("40px")} de ${linhaEmBranco("110px")} de ${linhaEmBranco("60px")}.</p>
<div class="assinaturas"><div><div class="traco">Assinatura do(a) responsável legal</div></div><div><div class="traco">Representante do Instituto</div></div></div>
<footer>Documento com dados pessoais. Após a assinatura, digitalize e anexe ao cadastro no sistema.</footer>
<script>window.onload=()=>window.print()<\/script></body></html>`;
}

/** Abre o termo pré-preenchido em uma nova janela, pronto para impressão. */
export function imprimirTermo(dados: DadosTermo, janela: Window | null = window.open("", "_blank", "width=850,height=900")): void {
  if (!janela) return;
  janela.document.open();
  janela.document.write(montarTermoHtml(dados));
  janela.document.close();
}
