import {
  iniciarControlesPersonalizados,
  sincronizarControlesPersonalizados,
  mostrarErroDoControle,
  limparErroDoControle,
  focarControle,
} from "./controls.js";

// Esta prévia mantém os cadastros apenas enquanto a página estiver aberta.
const cadastros = [];
const janelaCadastro = document.querySelector("#record-modal");
const formulario = document.querySelector("#record-form");
const aviso = document.querySelector("#toast");
const etapasFormulario = [...document.querySelectorAll(".form-section")];
const etapasDoProgresso = [...document.querySelectorAll(".step-progress .step")];
let etapaAtual = 0;
let temporizadorDoAviso;
let idEmEdicao = null;

iniciarControlesPersonalizados();

function escaparHtml(valor = "") {
  return String(valor).replace(/[&<>"']/g, (caractere) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[caractere]);
}

function mostrarAviso(mensagem) {
  aviso.textContent = mensagem;
  aviso.classList.add("show");
  clearTimeout(temporizadorDoAviso);
  temporizadorDoAviso = setTimeout(() => aviso.classList.remove("show"), 3200);
}

function definirEtapa(indice) {
  etapaAtual = Math.max(0, Math.min(indice, etapasFormulario.length - 1));
  etapasFormulario.forEach((secao, indiceSecao) => { secao.hidden = indiceSecao !== etapaAtual; });
  etapasDoProgresso.forEach((etapa, indiceEtapa) => {
    etapa.classList.toggle("active", indiceEtapa === etapaAtual);
    etapa.classList.toggle("complete", indiceEtapa < etapaAtual);
    etapa.setAttribute("aria-current", indiceEtapa === etapaAtual ? "step" : "false");
  });
  document.querySelector(".step-progress")?.setAttribute("aria-label", `Etapa ${etapaAtual + 1} de ${etapasFormulario.length}`);
  document.querySelector("#previous-step").hidden = etapaAtual === 0;
  document.querySelector("#next-step").hidden = etapaAtual === etapasFormulario.length - 1;
  document.querySelector("#save-record").hidden = etapaAtual !== etapasFormulario.length - 1;
  document.querySelector(".required-note").hidden = etapaAtual !== 0;
  document.querySelector(".form-scroll").scrollTop = 0;
}

function abrirJanelaCadastro(cadastro = null) {
  idEmEdicao = cadastro?.id ?? null;
  formulario.reset();
  if (cadastro) {
    for (const campo of formulario.elements) {
      if (!campo.name || campo.type === "file") continue;
      if (campo.type === "checkbox") campo.checked = (cadastro[campo.name] ?? []).includes(campo.value);
      else if (Object.hasOwn(cadastro, campo.name)) campo.value = cadastro[campo.name] ?? "";
    }
  }
  sincronizarControlesPersonalizados(formulario);
  formulario.querySelectorAll(".has-error").forEach((campo) => {
    campo.classList.remove("has-error");
    campo.querySelector(":scope > .field-error")?.remove();
  });
  atualizarCampoOutroBeneficio();
  document.querySelector("#form-title").textContent = cadastro ? "Atualizar cadastro" : "Vamos começar pelo acolhimento";
  document.querySelector("#save-record").innerHTML = cadastro ? "Salvar alterações <span>→</span>" : "Salvar cadastro <span>→</span>";
  janelaCadastro.hidden = false;
  document.body.style.overflow = "hidden";
  definirEtapa(0);
  formulario.querySelector('[name="name"]').focus();
}

function fecharJanelaCadastro() {
  janelaCadastro.hidden = true;
  document.body.style.overflow = "";
  formulario.reset();
  sincronizarControlesPersonalizados(formulario);
  idEmEdicao = null;
  atualizarCampoOutroBeneficio();
  document.querySelector("#photo-preview").hidden = true;
  document.querySelector("#photo-preview").textContent = "";
}

function calcularIdade(dataNascimento) {
  if (!dataNascimento) return null;
  const nascimento = new Date(`${dataNascimento}T12:00:00`);
  if (Number.isNaN(nascimento.getTime())) return null;
  const hoje = new Date();
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  if (hoje.getMonth() < nascimento.getMonth() || (hoje.getMonth() === nascimento.getMonth() && hoje.getDate() < nascimento.getDate())) idade--;
  return idade >= 0 ? idade : null;
}

function formatarData(data) {
  if (!data) return "";
  const [ano, mes, dia] = data.split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : data;
}

function atualizarCampoOutroBeneficio() {
  const outroBeneficioMarcado = formulario.querySelector('input[name="benefits"][value="Outro benefício"]')?.checked;
  const campo = document.querySelector("#other-benefit-field");
  campo.hidden = !outroBeneficioMarcado;
  if (!outroBeneficioMarcado) campo.querySelector("input").value = "";
}

function exibirCadastros() {
  const busca = document.querySelector("#search").value.trim().toLocaleLowerCase("pt-BR");
  const filtroIdade = document.querySelector("#age-filter").value;
  const filtroSituacao = document.querySelector("#status-filter").value;
  const cadastrosFiltrados = cadastros.filter((cadastro) => {
    const textoBusca = [cadastro.name, cadastro.school, cadastro.neighborhood].join(" ").toLocaleLowerCase("pt-BR");
    const idade = calcularIdade(cadastro.birthDate);
    const idadeCorresponde = filtroIdade === "all" || (filtroIdade === "child" && idade !== null && idade <= 11) || (filtroIdade === "teen" && idade !== null && idade >= 12 && idade <= 17) || (filtroIdade === "adult" && idade !== null && idade >= 18);
    const situacaoCorresponde = filtroSituacao === "all" || (filtroSituacao === "prioritaria" && Boolean(cadastro.priority)) || (filtroSituacao === "regular" && !cadastro.priority);
    return textoBusca.includes(busca) && idadeCorresponde && situacaoCorresponde;
  });

  document.querySelector("#records-body").innerHTML = cadastrosFiltrados.map((cadastro) => {
    const idade = calcularIdade(cadastro.birthDate);
    const iniciais = cadastro.name.trim().split(/\s+/).slice(0, 2).map((parte) => parte[0]).join("").toLocaleUpperCase("pt-BR");
    const local = [cadastro.school, cadastro.neighborhood].filter(Boolean).join(" · ") || "Não informado";
    const situacao = cadastro.priority ? '<span class="status-chip priority">Prioritária</span>' : '<span class="status-chip regular">Acompanhamento</span>';
    return `<tr><td><div class="person-cell"><span class="person-avatar">${escaparHtml(iniciais)}</span><div><div class="person-name">${escaparHtml(cadastro.name)}</div><div class="person-meta">Incluído nesta sessão</div></div></div></td><td><span class="age-chip">${idade === null ? "—" : `${idade} anos`}</span></td><td>${escaparHtml(local)}</td><td>${escaparHtml(cadastro.referralSource || "—")}</td><td>${situacao}</td><td><button class="row-menu" type="button" data-edit-id="${cadastro.id}" aria-label="Editar cadastro de ${escaparHtml(cadastro.name)}" title="Editar cadastro">✎</button><button class="row-menu" type="button" data-print-id="${cadastro.id}" aria-label="Imprimir ficha de ${escaparHtml(cadastro.name)}" title="Imprimir ficha">⎙</button></td></tr>`;
  }).join("");

  const quantidade = cadastrosFiltrados.length;
  document.querySelector("#result-count").textContent = `${quantidade} ${quantidade === 1 ? "cadastro" : "cadastros"}${busca || filtroIdade !== "all" || filtroSituacao !== "all" ? " encontrados" : ""}`;
  document.querySelector("#empty-state").hidden = quantidade !== 0;
  document.querySelector("#stat-total").textContent = cadastros.length;
  document.querySelector("#stat-young").textContent = cadastros.filter((cadastro) => (calcularIdade(cadastro.birthDate) ?? 100) < 18).length;
  document.querySelector("#stat-recent").textContent = cadastros.length;
  document.querySelector("#nav-count").textContent = cadastros.length;
}

function criarCadastro(dadosFormulario) {
  const cadastro = Object.fromEntries(dadosFormulario.entries());
  delete cadastro.photo;
  cadastro.activities = dadosFormulario.getAll("activities");
  cadastro.programs = dadosFormulario.getAll("programs");
  cadastro.benefits = dadosFormulario.getAll("benefits");
  cadastro.consentSignedAt = cadastro.consentStatus === "assinado" ? new Date().toISOString() : null;
  cadastro.priority = cadastro.priority?.trim() || "";
  cadastro.id = idEmEdicao ?? crypto.randomUUID();
  return cadastro;
}

function validarEtapa(secao) {
  const campoInvalido = [...secao.querySelectorAll("input,select,textarea")]
    .find((campo) => campo.required && !campo.value);
  if (!campoInvalido) return true;
  mostrarErroDoControle(campoInvalido);
  focarControle(campoInvalido);
  return false;
}

document.querySelectorAll("#new-record, #empty-new").forEach((botao) => botao.addEventListener("click", () => abrirJanelaCadastro()));
document.querySelector(".close-modal").addEventListener("click", fecharJanelaCadastro);
document.querySelector(".cancel-modal").addEventListener("click", fecharJanelaCadastro);
janelaCadastro.addEventListener("click", (evento) => { if (evento.target === janelaCadastro) fecharJanelaCadastro(); });
document.addEventListener("keydown", (evento) => { if (evento.key === "Escape" && !janelaCadastro.hidden) fecharJanelaCadastro(); });
document.querySelector("#dismiss-banner").addEventListener("click", () => document.querySelector(".demo-banner").remove());
document.querySelector("#previous-step").addEventListener("click", () => definirEtapa(etapaAtual - 1));
document.querySelector("#next-step").addEventListener("click", () => {
  if (!validarEtapa(etapasFormulario[etapaAtual])) return;
  definirEtapa(etapaAtual + 1);
});

formulario.addEventListener("submit", (evento) => {
  evento.preventDefault();
  const etapaInvalida = etapasFormulario.find((secao) => !validarEtapa(secao));
  if (etapaInvalida) {
    definirEtapa(etapasFormulario.indexOf(etapaInvalida));
    validarEtapa(etapaInvalida);
    return;
  }
  const dadosFormulario = new FormData(formulario);
  const cadastro = criarCadastro(dadosFormulario);
  const indiceExistente = cadastros.findIndex((item) => item.id === idEmEdicao);
  if (indiceExistente >= 0) cadastros[indiceExistente] = cadastro;
  else cadastros.unshift(cadastro);
  exibirCadastros();
  fecharJanelaCadastro();
  mostrarAviso(indiceExistente >= 0 ? "Cadastro atualizado nesta sessão de demonstração." : "Cadastro adicionado nesta sessão de demonstração.");
});

document.querySelectorAll("#search, #age-filter, #status-filter").forEach((campo) => campo.addEventListener("input", exibirCadastros));
formulario.addEventListener("input", (evento) => {
  if (evento.target.matches(":required")) limparErroDoControle(evento.target);
});

const hoje = new Date();
const dataDeHoje = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
document.querySelectorAll('input[type="date"]').forEach((campo) => { campo.max = dataDeHoje; });
document.querySelector('[name="photo"]').addEventListener("change", (evento) => {
  const arquivo = evento.target.files?.[0];
  const previa = document.querySelector("#photo-preview");
  previa.hidden = !arquivo;
  previa.textContent = arquivo ? `Foto selecionada: ${arquivo.name} (não enviada)` : "";
});
formulario.querySelectorAll('input[name="benefits"]').forEach((marcador) => marcador.addEventListener("change", atualizarCampoOutroBeneficio));

document.querySelector("#export-csv").addEventListener("click", () => {
  if (!cadastros.length) { mostrarAviso("Não há cadastros nesta sessão para exportar."); return; }
  const colunas = [
    ["Nome", "name"], ["Nascimento", "birthDate"], ["Escola", "school"], ["Bairro", "neighborhood"],
    ["Forma de entrada", "referralSource"], ["Situação prioritária", "priority"],
  ];
  const protegerCelulaCsv = (valor) => {
    let texto = String(valor ?? "");
    if (/^[\s]*[=+@-]/.test(texto)) texto = `'${texto}`;
    return `"${texto.replaceAll('"', '""')}"`;
  };
  const conteudoCsv = [colunas.map(([rotulo]) => protegerCelulaCsv(rotulo)).join(";"), ...cadastros.map((cadastro) => colunas.map(([, chave]) => protegerCelulaCsv(cadastro[chave])).join(";"))].join("\r\n");
  const enderecoTemporario = URL.createObjectURL(new Blob(["\uFEFF", conteudoCsv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = enderecoTemporario;
  link.download = "cadastros-sessao-renascer.csv";
  link.click();
  URL.revokeObjectURL(enderecoTemporario);
  mostrarAviso("Lista da sessão exportada. O arquivo contém dados pessoais.");
});

document.querySelector("#records-body").addEventListener("click", (evento) => {
  const botaoEditar = evento.target.closest("[data-edit-id]");
  if (botaoEditar) {
    const cadastroEditado = cadastros.find((item) => item.id === botaoEditar.dataset.editId);
    if (cadastroEditado) abrirJanelaCadastro(cadastroEditado);
    return;
  }
  const botaoImprimir = evento.target.closest("[data-print-id]");
  const cadastro = cadastros.find((item) => item.id === botaoImprimir?.dataset.printId);
  if (!cadastro) return;
  const janelaImpressao = window.open("", "_blank", "width=850,height=900");
  if (!janelaImpressao) { mostrarAviso("Permita a janela de impressão para abrir a ficha."); return; }
  const linhas = [
    ["Nome", cadastro.name], ["Nascimento", formatarData(cadastro.birthDate)], ["Sexo", cadastro.sex], ["Estado civil", cadastro.maritalStatus], ["RG", cadastro.rg], ["CPF", cadastro.cpf], ["NIS", cadastro.nis], ["Carteira de trabalho", cadastro.workCard === "true" ? "Sim" : cadastro.workCard === "false" ? "Não" : ""],
    ["Escola", cadastro.school], ["Série/ano", cadastro.grade], ["Turno", cadastro.shift], ["Bairro/território", cadastro.neighborhood], ["Telefone", cadastro.phone],
    ["Endereço", cadastro.address], ["Ponto de referência", cadastro.reference], ["Mãe/responsável", cadastro.motherName], ["Nascimento da mãe/responsável", formatarData(cadastro.motherBirthDate)], ["Mãe trabalha", cadastro.motherWorks === "true" ? "Sim" : cadastro.motherWorks === "false" ? "Não" : ""], ["Trabalho/renda da mãe", cadastro.motherIncome], ["Pai/responsável", cadastro.fatherName], ["Nascimento do pai/responsável", formatarData(cadastro.fatherBirthDate)], ["Pai trabalha", cadastro.fatherWorks === "true" ? "Sim" : cadastro.fatherWorks === "false" ? "Não" : ""], ["Trabalho/renda do pai", cadastro.fatherIncome], ["Moradores", cadastro.householdSize],
    ["Forma de entrada", cadastro.referralSource], ["Encaminhado por", cadastro.referralDetail], ["Motivo", cadastro.referralReason], ["Situação prioritária", cadastro.priority],
    ["Atividades", cadastro.activities.join(", ")], ["Programas/projetos", cadastro.programs.join(", ")], ["Benefícios", cadastro.benefits.join(", ")], ["Consentimento", cadastro.consentStatus], ["Observações", cadastro.notes],
  ].filter(([, valor]) => valor);
  janelaImpressao.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Ficha cadastral - ${escaparHtml(cadastro.name)}</title><style>body{font:14px Arial,sans-serif;color:#292535;margin:32px}header{border-bottom:2px solid #332652;padding-bottom:14px;margin-bottom:20px}h1{font-size:22px;margin:0 0 4px;color:#332652}p{color:#67766b;font-size:12px;margin:0}table{width:100%;border-collapse:collapse}th,td{text-align:left;border-bottom:1px solid #dce4dc;padding:9px 8px;vertical-align:top}th{width:28%;color:#516755;font-weight:600}footer{margin-top:28px;border-top:1px solid #dce4dc;padding-top:12px;color:#78847b;font-size:11px}@media print{body{margin:15mm}}</style></head><body><header><h1>Instituto de Ação Social Renascer</h1><p>Ficha de entrada e cadastro · impressão para uso institucional</p></header><table>${linhas.map(([rotulo, valor]) => `<tr><th>${escaparHtml(rotulo)}</th><td>${escaparHtml(valor)}</td></tr>`).join("")}</table><footer>Documento com dados pessoais. Manter sob acesso autorizado.</footer><script>window.onload=()=>window.print()<\/script></body></html>`);
  janelaImpressao.document.close();
});

exibirCadastros();
