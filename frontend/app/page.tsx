"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { alterarStatusPessoa, anexarFoto, anexarTermoAssinado, baixarArquivoCadastro, estatisticasCadastro, listarCadastrosPagina, listarCadastrosParaExportar, obterSessao, PAPEIS_SO_LEITURA_CADASTRO, sair, salvarPessoa, type FiltrosCadastro, TIPOS_FOTO, TIPOS_TERMO, validarArquivo } from "../src/supabase";
import { imprimirTermo, TERMO_VERSAO } from "./termo-consentimento";
import { AuthPanel } from "./auth-panel";
import { BotaoIcone } from "./botao-icone";
import { useDialogos } from "@/components/dialogos";
import { ChevronLeft, ChevronRight, FileCheck2, FileText, Pencil, Printer, UserCheck, UserX } from "lucide-react";
import { recordFormMarkup } from "./form-markup";

type Person = { id: string; name: string; birthDate?: string; school?: string; neighborhood?: string; priority?: string; family_id?: string; [field: string]: any };

/** Marca o campo e mostra a mensagem dentro da página (no lugar da bolha padrão do navegador). */
function mostrarErroCampo(campo: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, mensagem = "Preencha este campo.") {
  const caixa = campo.closest("label") ?? campo.parentElement;
  if (!caixa || caixa.querySelector(".erro-campo")) return;
  campo.classList.add("campo-invalido");
  campo.setAttribute("aria-invalid", "true");
  const aviso = document.createElement("small");
  aviso.className = "erro-campo";
  aviso.setAttribute("role", "alert");
  aviso.textContent = mensagem;
  caixa.appendChild(aviso);
  const limpar = () => {
    campo.classList.remove("campo-invalido");
    campo.removeAttribute("aria-invalid");
    aviso.remove();
    campo.removeEventListener("input", limpar);
    campo.removeEventListener("change", limpar);
  };
  campo.addEventListener("input", limpar);
  campo.addEventListener("change", limpar);
}

/** Números de página exibidos, com reticências quando há muitas (ex.: 1 … 4 5 6 … 20). */
function paginasVisiveis(atual: number, ultima: number): (number | "…")[] {
  if (ultima <= 7) return Array.from({ length: ultima }, (_, i) => i + 1);
  const itens: (number | "…")[] = [1];
  const inicio = Math.max(2, atual - 1);
  const fim = Math.min(ultima - 1, atual + 1);
  if (inicio > 2) itens.push("…");
  for (let p = inicio; p <= fim; p++) itens.push(p);
  if (fim < ultima - 1) itens.push("…");
  itens.push(ultima);
  return itens;
}

function calcularIdade(date?: string) {
  if (!date) return null;
  const birth = new Date(`${date}T12:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
}

function blobParaDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result));
    leitor.onerror = () => reject(leitor.error);
    leitor.readAsDataURL(blob);
  });
}

async function imprimirFicha(person: any, token: string) {
  const rows = [
    ["Nome", person.name], ["Nascimento", person.birthDate], ["Sexo", person.sex], ["Estado civil", person.maritalStatus], ["RG", person.rg], ["CPF", person.cpf], ["NIS", person.nis], ["Carteira de trabalho", person.workCard === "true" ? "Sim" : person.workCard === "false" ? "Não" : ""],
    ["Escola", person.school], ["Série/ano", person.grade], ["Turno", person.shift], ["Bairro/território", person.neighborhood], ["Telefone", person.phone], ["Endereço", person.address], ["Ponto de referência", person.reference],
    ["Mãe/responsável", person.motherName], ["Nascimento da mãe/responsável", person.motherBirthDate], ["Mãe trabalha", person.motherWorks === "true" ? "Sim" : person.motherWorks === "false" ? "Não" : ""], ["Trabalho/renda da mãe", person.motherIncome],
    ["Pai/responsável", person.fatherName], ["Nascimento do pai/responsável", person.fatherBirthDate], ["Pai trabalha", person.fatherWorks === "true" ? "Sim" : person.fatherWorks === "false" ? "Não" : ""], ["Trabalho/renda do pai", person.fatherIncome], ["Moradores", person.householdSize],
    ["Forma de entrada", person.referralSource], ["Encaminhado por", person.referralDetail], ["Motivo", person.referralReason], ["Situação prioritária", person.priority], ["Atividades", person.activities?.join(", ")], ["Programas/projetos", person.programs?.join(", ")], ["Benefícios", person.benefits?.join(", ")], ["Consentimento", person.consentStatus], ["Observações", person.notes],
  ].filter(([, value]) => value) as [string, any][];
  const escape = (value: unknown) => { const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }; return String(value ?? "").replace(/[&<>"']/g, char => map[char] ?? char); };
  const win = window.open("", "_blank", "width=850,height=900");
  if (!win) return;
  let fotoUrl = "";
  if (person.photoPath) {
    try { fotoUrl = await blobParaDataUrl(await baixarArquivoCadastro(person.photoPath, token)); } catch { fotoUrl = ""; }
  }
  win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Ficha cadastral - ${escape(person.name)}</title><style>body{font:14px Arial,sans-serif;color:#292535;margin:32px}header{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;border-bottom:2px solid #332652;padding-bottom:14px;margin-bottom:20px}img.foto{width:96px;height:120px;object-fit:cover;border:1px solid #dce4dc;border-radius:4px}h1{font-size:22px;margin:0 0 4px;color:#332652}p{color:#67766b;font-size:12px;margin:0}table{width:100%;border-collapse:collapse}th,td{text-align:left;border-bottom:1px solid #dce4dc;padding:9px 8px;vertical-align:top}th{width:28%;color:#516755;font-weight:600}footer{margin-top:28px;border-top:1px solid #dce4dc;padding-top:12px;color:#78847b;font-size:11px}@media print{body{margin:15mm}}</style></head><body><header><div><h1>Instituto de Ação Social Renascer</h1><p>Ficha de entrada e cadastro — impressão para uso institucional</p></div>${fotoUrl ? `<img class="foto" alt="Foto de identificação" src="${fotoUrl}">` : ""}</header><table>${rows.map(([label, value]) => `<tr><th>${escape(label)}</th><td>${escape(value)}</td></tr>`).join("")}</table><footer>Documento com dados pessoais. Manter sob acesso autorizado.</footer><script>window.onload=()=>window.print()<\/script></body></html>`);
  win.document.close();
}

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const { confirmar } = useDialogos();
  const [sessionChecked, setSessionChecked] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [search, setSearch] = useState("");
  const [busca, setBusca] = useState("");
  const [total, setTotal] = useState(0);
  const [estatisticas, setEstatisticas] = useState<{ total: number; menores: number; prioritarios: number; familias: number } | null>(null);
  const [versaoDados, setVersaoDados] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(10);
  const [exportando, setExportando] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);
  const [ageFilter, setAgeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [recordStatus, setRecordStatus] = useState<"ativo" | "inativo" | "todos">("ativo");
  useEffect(() => {
    setSession(obterSessao());
    setSessionChecked(true);
  }, []);
  const filtros: FiltrosCadastro = { status: recordStatus, busca, faixa: ageFilter as FiltrosCadastro["faixa"], prioridade: statusFilter as FiltrosCadastro["prioridade"] };
  useEffect(() => {
    if (!session?.access_token) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    listarCadastrosPagina(filtros, (pagina - 1) * porPagina, session.access_token, porPagina)
      .then(({ itens, total: quantidade }) => {
        if (cancelled) return;
        // Se a página ficou vazia (ex.: último item inativado), volta uma página.
        if (!itens.length && pagina > 1) { setPagina(atual => Math.max(1, atual - 1)); return; }
        setPeople(itens); setTotal(quantidade);
      })
      .catch((e: Error) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, recordStatus, busca, ageFilter, statusFilter, pagina, porPagina, versaoDados]);
  // Qualquer mudança de filtro ou de tamanho da página volta para a primeira página.
  useEffect(() => { setPagina(1); }, [recordStatus, busca, ageFilter, statusFilter, porPagina]);
  useEffect(() => {
    if (!session?.access_token) return;
    let cancelled = false;
    estatisticasCadastro(recordStatus, session.access_token)
      .then((valores) => { if (!cancelled) setEstatisticas(valores); })
      .catch(() => { if (!cancelled) setEstatisticas(null); });
    return () => { cancelled = true; };
  }, [session, recordStatus, versaoDados]);
  // Espera a pessoa parar de digitar antes de consultar o servidor.
  useEffect(() => {
    const espera = setTimeout(() => setBusca(search.trim()), 350);
    return () => clearTimeout(espera);
  }, [search]);
  useEffect(() => {
    if (!showForm) return;
    const container = document.querySelector<HTMLElement>("#record-form-container");
    if (!container) return;
    const form = container.querySelector<HTMLFormElement>("#record-form");
    if (!form) return;
    const values: Record<string, any> = editing ? { ...editing } : {};
    if (!values.entryDate) values.entryDate = new Date().toISOString().slice(0, 10);
    for (const field of Array.from(form.elements) as HTMLInputElement[]) {
      if (!field.name || field.type === "file") continue;
      const value = values[field.name];
      if (field.type === "checkbox") field.checked = Array.isArray(value) && value.includes(field.value);
      else if (value !== undefined && value !== null) field.value = String(value);
    }
    const formTitle = container.querySelector<HTMLElement>("#form-title");
    if (formTitle) formTitle.textContent = editing ? "Atualizar cadastro" : "Vamos começar pelo acolhimento";
    const saveButton = form.querySelector<HTMLElement>("#save-record");
    if (saveButton) saveButton.innerHTML = editing ? "Salvar alterações <span>→</span>" : "Salvar cadastro <span>→</span>";
    const otherBenefit = form.querySelector<HTMLElement>("#other-benefit-field");
    const updateOtherBenefit = () => {
      const marked = form.querySelector<HTMLInputElement>('input[name="benefits"][value="Outro benefício"]')?.checked ?? false;
      if (otherBenefit) otherBenefit.hidden = !marked;
      if (!marked) { const input = otherBenefit?.querySelector<HTMLInputElement>("input"); if (input) input.value = ""; }
    };
    const benefitInputs = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="benefits"]'));
    benefitInputs.forEach(input => input.addEventListener("change", updateOtherBenefit));
    updateOtherBenefit();
    const photoInput = form.querySelector<HTMLInputElement>('input[name="photo"]');
    const photoPreview = form.querySelector<HTMLElement>("#photo-preview");
    const mostrarStatusArquivo = (elemento: HTMLElement | null, mensagem: string, erro = false) => {
      if (!elemento) return;
      elemento.hidden = !mensagem;
      elemento.textContent = mensagem;
      elemento.style.color = erro ? "#a33a2c" : "";
    };
    const updatePhoto = () => {
      const file = photoInput?.files?.[0];
      const invalido = file ? validarArquivo(file, TIPOS_FOTO) : "";
      mostrarStatusArquivo(photoPreview, invalido || (file ? `Foto selecionada: ${file.name} (será enviada ao salvar)` : editing?.photoPath ? "Foto cadastrada. Escolha outra para substituir." : ""), Boolean(invalido));
    };
    photoInput?.addEventListener("change", updatePhoto);
    updatePhoto();
    const documentInput = form.querySelector<HTMLInputElement>('input[name="consentDocument"]');
    const documentStatus = form.querySelector<HTMLElement>("#consent-document-status");
    const updateDocument = () => {
      const file = documentInput?.files?.[0];
      const invalido = file ? validarArquivo(file, TIPOS_TERMO) : "";
      mostrarStatusArquivo(documentStatus, invalido || (file ? `Arquivo selecionado: ${file.name} (será enviado ao salvar)` : editing?.consentDocumentPath ? "Termo assinado já anexado. Escolha outro arquivo para substituir." : ""), Boolean(invalido));
    };
    documentInput?.addEventListener("change", updateDocument);
    updateDocument();
    const versionInput = form.querySelector<HTMLInputElement>('input[name="consentVersion"]');
    if (!editing && versionInput && !versionInput.value) versionInput.value = TERMO_VERSAO;
    const printConsent = form.querySelector<HTMLButtonElement>("#print-consent");
    const printConsentHandler = () => {
      const dados = { ...(editing || {}), ...Object.fromEntries(new FormData(form).entries()) };
      if (versionInput && !versionInput.value) versionInput.value = TERMO_VERSAO;
      imprimirTermo(dados);
    };
    printConsent?.addEventListener("click", printConsentHandler);
    const today = new Date().toISOString().slice(0, 10);
    form.querySelectorAll<HTMLInputElement>('input[type="date"]').forEach(input => { input.max = today; });
    const sections = Array.from(form.querySelectorAll<HTMLElement>(".form-section"));
    const steps = Array.from(container.querySelectorAll<HTMLElement>(".step-progress .step"));
    let current = 0;
    const showStep = (index: number) => {
      current = Math.max(0, Math.min(index, sections.length - 1));
      sections.forEach((section, i) => { section.hidden = i !== current; });
      steps.forEach((step, i) => { step.classList.toggle("active", i === current); step.classList.toggle("complete", i < current); });
      container.querySelector(".step-progress")?.setAttribute("aria-label", `Etapa ${current + 1} de ${sections.length}`);
      form.querySelector<HTMLElement>("#previous-step")!.hidden = current === 0;
      form.querySelector<HTMLElement>("#next-step")!.hidden = current === sections.length - 1;
      form.querySelector<HTMLElement>("#save-record")!.hidden = current !== sections.length - 1;
      form.querySelector<HTMLElement>(".required-note")!.hidden = current !== 0;
      sections[current].scrollTop = 0;
    };
    const previous = form.querySelector<HTMLButtonElement>("#previous-step")!;
    const next = form.querySelector<HTMLButtonElement>("#next-step")!;
    const cancel = form.querySelector<HTMLButtonElement>(".cancel-modal")!;
    const saveHandler = async (event: SubmitEvent) => {
      event.preventDefault();
      const invalid = sections.findIndex(section => Array.from(section.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input,select,textarea")).some(field => field.required && !field.value));
      if (invalid >= 0) { showStep(invalid); { const campoInvalido = sections[invalid].querySelector<HTMLInputElement>(":invalid"); if (campoInvalido) { campoInvalido.focus(); mostrarErroCampo(campoInvalido); } } return; }
      const photoFile = photoInput?.files?.[0];
      const documentFile = documentInput?.files?.[0];
      const consentSelect = form.querySelector<HTMLSelectElement>('select[name="consentStatus"]');
      const erroFoto = photoFile ? validarArquivo(photoFile, TIPOS_FOTO) : "";
      const exigeTermo = consentSelect?.value === "assinado" && editing?.consentStatus !== "assinado" && !documentFile;
      const erroTermo = documentFile ? validarArquivo(documentFile, TIPOS_TERMO) : exigeTermo ? "Anexe o termo assinado e digitalizado para marcar como “Assinado e recebido”." : "";
      const bloqueio = erroFoto ? { campo: photoInput, area: photoPreview, mensagem: erroFoto } : erroTermo ? { campo: documentInput, area: documentStatus, mensagem: erroTermo } : null;
      if (bloqueio) {
        mostrarStatusArquivo(bloqueio.area, bloqueio.mensagem, true);
        const indice = sections.findIndex(section => bloqueio.campo && section.contains(bloqueio.campo));
        if (indice >= 0) showStep(indice);
        bloqueio.area?.scrollIntoView({ block: "center" });
        return;
      }
      const fd = new FormData(form);
      const data: Record<string, any> = { ...(editing || {}), ...Object.fromEntries(fd.entries()) };
      delete data.photo;
      delete data.consentDocument;
      // O status só vira "assinado" depois que o documento é gravado com sucesso.
      if (documentFile && editing?.consentStatus !== "assinado") data.consentStatus = "pendente";
      for (const key of ["activities", "programs", "benefits", "healthConditions", "allergies", "disabilities", "demands"]) data[key] = fd.getAll(key);
      data.consentSignedAt = data.consentStatus === "assinado" ? new Date().toISOString() : null;
      data.priority = String(data.priority || "").trim();
      try {
        const salvo = await salvarPessoa(data, session.access_token);
        const falhas: string[] = [];
        if (photoFile) {
          try { await anexarFoto(salvo.id, photoFile, editing?.photoPath, session.access_token); }
          catch (e) { falhas.push(`foto (${(e as Error).message})`); }
        }
        if (documentFile) {
          try {
            if (!salvo.consentId) throw new Error("registro de consentimento não encontrado");
            await anexarTermoAssinado(salvo.id, salvo.consentId, documentFile, data.consentVersion || null, editing?.consentDocumentPath, session.access_token);
          } catch (e) { falhas.push(`termo assinado (${(e as Error).message})`); }
        }
        // Recarrega só o cadastro salvo (não a lista inteira) e o mescla à lista atual.
        if (!editing) setPagina(1);
        setVersaoDados(versao => versao + 1);
        setShowForm(false); setEditing(null);
        setError(falhas.length ? `Cadastro salvo, mas não foi possível enviar: ${falhas.join("; ")}. Abra o cadastro em Editar e tente novamente.` : "");
      } catch (e) { setError(`Não foi possível salvar o cadastro: ${(e as Error).message}`); }
    };
    const nextHandler = () => {
      const invalid = Array.from(sections[current].querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input,select,textarea")).find(field => field.required && !field.value);
      if (invalid) { invalid.focus(); mostrarErroCampo(invalid); return; }
      showStep(current + 1);
    };
    const prevHandler = () => showStep(current - 1);
    const cancelHandler = () => { setShowForm(false); setEditing(null); };
    form.addEventListener("submit", saveHandler);
    next.addEventListener("click", nextHandler);
    previous.addEventListener("click", prevHandler);
    cancel.addEventListener("click", cancelHandler);
    showStep(0);
    return () => { form.removeEventListener("submit", saveHandler); next.removeEventListener("click", nextHandler); previous.removeEventListener("click", prevHandler); cancel.removeEventListener("click", cancelHandler); benefitInputs.forEach(input => input.removeEventListener("change", updateOtherBenefit)); photoInput?.removeEventListener("change", updatePhoto); documentInput?.removeEventListener("change", updateDocument); printConsent?.removeEventListener("click", printConsentHandler); };
  }, [showForm, editing, session, recordStatus]);

  useEffect(() => {
    if (!showForm) return;
    const elementoAnterior = document.activeElement as HTMLElement | null;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const fecharComEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowForm(false);
        setEditing(null);
      }
    };
    window.addEventListener("keydown", fecharComEscape);
    document.querySelector<HTMLInputElement>('#record-form [name="name"]')?.focus();
    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener("keydown", fecharComEscape);
      elementoAnterior?.focus();
    };
  }, [showForm]);

  function irParaPagina(destino: number) {
    setPagina(Math.min(Math.max(1, destino), Math.max(1, Math.ceil(total / porPagina))));
    // O painel rola por dentro: leva o usuário de volta ao início da lista.
    document.querySelector(".painel-principal")?.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function atualizarStatus(person: Person) {
    const novoStatus = person.status === "inativo" ? "ativo" : "inativo";
    const acao = novoStatus === "inativo" ? "inativar" : "reativar";
    if (!(await confirmar({ titulo: novoStatus === "inativo" ? "Inativar cadastro" : "Reativar cadastro", mensagem: `Deseja ${acao} o cadastro de ${person.name}?`, confirmar: novoStatus === "inativo" ? "Inativar" : "Reativar", perigo: novoStatus === "inativo" }))) return;
    try {
      await alterarStatusPessoa(person.id, novoStatus, session.access_token);
      setVersaoDados(versao => versao + 1);
      setError("");
    } catch (e) {
      setError(`Não foi possível ${acao} o cadastro: ${(e as Error).message}`);
    }
  }

  async function abrirTermoAssinado(person: Person) {
    const win = window.open("", "_blank");
    if (!win) { setError("Permita pop-ups neste site para abrir o documento."); return; }
    try {
      const blob = await baixarArquivoCadastro(person.consentDocumentPath, session.access_token);
      win.location.href = URL.createObjectURL(blob);
      setError("");
    } catch (e) {
      win.close();
      setError(`Não foi possível abrir o termo assinado: ${(e as Error).message}`);
    }
  }

  async function exportarCsv() {
    setExportando(true);
    let linhas: any[];
    try { linhas = await listarCadastrosParaExportar(filtros, session.access_token); }
    catch (e) { setError(`Não foi possível exportar: ${(e as Error).message}`); setExportando(false); return; }
    const colunas = [["Nome", "name"], ["Nascimento", "birthDate"], ["Escola", "school"], ["Bairro", "neighborhood"], ["Forma de entrada", "referralSource"], ["Prioridade", "priority"], ["Status", "status"]] as const;
    const celula = (valor: unknown) => {
      let texto = String(valor ?? "");
      if (/^[\s]*[=+@-]/.test(texto)) texto = `'${texto}`;
      return `"${texto.replaceAll('"', '""')}"`;
    };
    const csv = [colunas.map(([rotulo]) => celula(rotulo)).join(";"), ...linhas.map((person) => colunas.map(([, campo]) => celula(person[campo])).join(";"))].join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "cadastros-renascer.csv";
    link.click();
    URL.revokeObjectURL(url);
    setExportando(false);
  }

  if (!sessionChecked) return <main className="grid min-h-screen place-items-center bg-[#f7f5f2] text-sm text-[#817b89]">Carregando...</main>;
  if (!session?.access_token) return <AuthPanel onLogin={()=>setSession(obterSessao())}/>;

  const papel: string = session?.perfil?.papel || "";
  const somenteLeitura = PAPEIS_SO_LEITURA_CADASTRO.includes(papel);

  return <section className="px-5 py-8 md:px-12"><header className="mb-10 flex justify-between border-b border-[#e8e3dc] pb-5 text-sm"><span className="text-[#817b89]">Gestão social / <strong className="text-[#302942]">Cadastros</strong></span></header><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm text-[#8b6f48]">ACOLHIMENTO E RECEPÇÃO</p><h1 className="mt-2 text-3xl font-semibold">Cadastros</h1><p className="mt-2 text-sm text-gray-500">Consulte e mantenha os cadastros das pessoas atendidas.</p></div>{!somenteLeitura && <button onClick={()=>{if(showForm){setShowForm(false);setEditing(null);}else{setEditing(null);setShowForm(true);}}} className="btn btn-primario">{showForm ? "Fechar formulário" : "+ Novo cadastro"}</button>}</div>
    {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Pessoas atendidas",estatisticas?.total ?? "—"],["Menores de 18 anos",estatisticas?.menores ?? "—"],["Famílias acompanhadas",estatisticas?.familias ?? "—"],["Acompanhamento prioritário",estatisticas?.prioritarios ?? "—"]].map(([label,value])=><article key={String(label)} className="rounded-2xl border border-[#eee9e2] bg-white p-5"><p className="text-sm text-gray-500">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></article>)}</div>
    {showForm && <div className="modal-backdrop" role="presentation" onClick={event => { if (event.target === event.currentTarget) { setShowForm(false); setEditing(null); } }}><section id="record-form-container" role="dialog" aria-modal="true" aria-labelledby="form-title" className="form-modal"><div className="modal-header"><div><h2 id="form-title">{editing ? "Atualizar cadastro" : "Vamos começar pelo acolhimento"}</h2><div className="step-progress mt-5 flex flex-wrap gap-3" aria-label="Etapa 1 de 7">{["Identificação","Família","Endereço","Domicílio","Benefícios","Saúde","Acompanhamento"].map((label,index)=><span key={label} className={`step ${index===0?"active":""}`}><i>{index+1}</i> {label}</span>)}</div></div><button type="button" aria-label="Fechar formulário" onClick={()=>{setShowForm(false);setEditing(null);}} className="close-modal text-2xl text-gray-500">×</button></div><div className="form-body" dangerouslySetInnerHTML={{ __html: recordFormMarkup }} /></section></div>}
    <div className="mt-8 flex flex-wrap gap-3">
      <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por nome, escola ou bairro" className="w-full max-w-lg rounded-xl border border-[#e8e3dc] bg-white px-3.5 py-2 text-sm" />
      <select value={recordStatus} onChange={event => setRecordStatus(event.target.value as typeof recordStatus)} aria-label="Situação do cadastro" className="btn btn-secundario">
        <option value="ativo">Cadastros ativos</option><option value="inativo">Cadastros inativos</option><option value="todos">Todos os cadastros</option>
      </select>
      <select value={ageFilter} onChange={event => setAgeFilter(event.target.value)} aria-label="Filtrar por idade" className="btn btn-secundario">
        <option value="all">Todas as idades</option><option value="child">Até 11 anos</option><option value="teen">12 a 17 anos</option><option value="adult">18 anos ou mais</option>
      </select>
      <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} aria-label="Filtrar por acompanhamento" className="btn btn-secundario">
        <option value="all">Todas as prioridades</option><option value="priority">Prioritária</option><option value="regular">Acompanhamento</option>
      </select>
      <span className="self-center text-sm text-gray-500">{total} {total === 1 ? "cadastro" : "cadastros"}</span>
      <button onClick={() => void exportarCsv()} disabled={!total || exportando} className="btn btn-secundario">{exportando ? "Exportando…" : "Exportar CSV"}</button>
    </div>
    <div className="mt-4 overflow-x-auto rounded-2xl border border-[#eee9e2] bg-white">
      <table className="w-full min-w-[850px] text-left text-sm">
        <thead className="bg-[#faf9f7] text-xs text-gray-500"><tr><th className="p-4">Nome</th><th className="p-4">Nascimento</th><th className="p-4">Escola</th><th className="p-4">Bairro</th><th className="p-4">Situação</th><th className="p-4">Ações</th></tr></thead>
        <tbody>
          {people.map(person => <tr key={person.id} className="border-t border-[#f0ede8]">
            <td className="p-4 font-medium">{person.name}</td>
            <td className="p-4">{person.birthDate ? new Date(`${person.birthDate}T12:00:00`).toLocaleDateString("pt-BR") : "—"}</td>
            <td className="p-4">{person.school || "—"}</td>
            <td className="p-4">{person.neighborhood || "—"}</td>
            <td className="p-4">{person.status === "inativo" ? "Inativo" : person.priority ? "Prioritária" : "Acompanhamento"}</td>
            <td className="p-3"><div className="flex items-center gap-0.5">
              {!somenteLeitura && <BotaoIcone rotulo="Editar cadastro" icone={<Pencil size={16} />} aoClicar={() => { setEditing(person); setShowForm(true); }} />}
              <BotaoIcone rotulo="Imprimir ficha" icone={<Printer size={16} />} aoClicar={() => void imprimirFicha(person, session.access_token)} />
              <BotaoIcone rotulo="Imprimir termo de consentimento" icone={<FileText size={16} />} aoClicar={() => imprimirTermo(person)} />
              {person.consentDocumentPath && <BotaoIcone rotulo="Ver termo assinado" icone={<FileCheck2 size={16} />} tom="sucesso" aoClicar={() => void abrirTermoAssinado(person)} />}
              {!somenteLeitura && <BotaoIcone rotulo={person.status === "inativo" ? "Reativar cadastro" : "Inativar cadastro"} icone={person.status === "inativo" ? <UserCheck size={16} /> : <UserX size={16} />} tom={person.status === "inativo" ? "sucesso" : "perigo"} aoClicar={() => void atualizarStatus(person)} />}
            </div></td>
          </tr>)}
          {loading && <tr><td colSpan={6} className="p-10 text-center text-gray-500">Carregando cadastros…</td></tr>}
          {!loading && !people.length && <tr><td colSpan={6} className="p-10 text-center text-gray-500">{busca || ageFilter !== "all" || statusFilter !== "all" ? "Nenhum cadastro corresponde à busca." : "Nenhum cadastro disponível para este perfil."}</td></tr>}
        </tbody>
      </table>
    </div>
    {total > 0 && <nav aria-label="Paginação" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
      <div className="flex flex-wrap items-center gap-3">
        <span>Mostrando {(pagina - 1) * porPagina + 1}–{Math.min(pagina * porPagina, total)} de {total}</span>
        <select value={porPagina} onChange={event => { setPorPagina(Number(event.target.value)); setPagina(1); }} aria-label="Cadastros por página" className="rounded-lg border border-[#e8e3dc] bg-white px-2 py-1 text-sm text-[#302942]">
          {[10, 25, 50].map(quantidade => <option key={quantidade} value={quantidade}>{quantidade} por página</option>)}
        </select>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => irParaPagina(pagina - 1)} disabled={pagina <= 1 || loading} aria-label="Página anterior" className="grid h-8 w-8 place-items-center rounded-lg border border-[#e8e3dc] bg-white text-[#332652] disabled:opacity-40"><ChevronLeft size={16} /></button>
        {paginasVisiveis(pagina, Math.max(1, Math.ceil(total / porPagina))).map((item, indice) => item === "…"
          ? <span key={`reticencias-${indice}`} className="px-1">…</span>
          : <button key={item} onClick={() => irParaPagina(item)} disabled={loading} aria-label={`Página ${item}`} aria-current={item === pagina ? "page" : undefined} className={`h-8 min-w-8 rounded-lg border px-2 ${item === pagina ? "border-[#332652] bg-[#332652] text-white" : "border-[#e8e3dc] bg-white text-[#332652]"}`}>{item}</button>)}
        <button onClick={() => irParaPagina(pagina + 1)} disabled={pagina >= Math.ceil(total / porPagina) || loading} aria-label="Próxima página" className="grid h-8 w-8 place-items-center rounded-lg border border-[#e8e3dc] bg-white text-[#332652] disabled:opacity-40"><ChevronRight size={16} /></button>
      </div>
    </nav>}
  </section>;
}


