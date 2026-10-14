"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { alterarStatusPessoa, listarPessoas, obterSessao, sair, salvarPessoa } from "../src/supabase";
import { AuthPanel } from "./auth-panel";
import { recordFormMarkup } from "./form-markup";

type Person = { id: string; name: string; birthDate?: string; school?: string; neighborhood?: string; priority?: string; family_id?: string; [field: string]: any };

function calcularIdade(date?: string) {
  if (!date) return null;
  const birth = new Date(`${date}T12:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
}

function imprimirFicha(person: any) {
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
  win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Ficha cadastral - ${escape(person.name)}</title><style>body{font:14px Arial,sans-serif;color:#292535;margin:32px}header{border-bottom:2px solid #332652;padding-bottom:14px;margin-bottom:20px}h1{font-size:22px;margin:0 0 4px;color:#332652}p{color:#67766b;font-size:12px;margin:0}table{width:100%;border-collapse:collapse}th,td{text-align:left;border-bottom:1px solid #dce4dc;padding:9px 8px;vertical-align:top}th{width:28%;color:#516755;font-weight:600}footer{margin-top:28px;border-top:1px solid #dce4dc;padding-top:12px;color:#78847b;font-size:11px}@media print{body{margin:15mm}}</style></head><body><header><h1>Instituto de Ação Social Renascer</h1><p>Ficha de entrada e cadastro — impressão para uso institucional</p></header><table>${rows.map(([label, value]) => `<tr><th>${escape(label)}</th><td>${escape(value)}</td></tr>`).join("")}</table><footer>Documento com dados pessoais. Manter sob acesso autorizado.</footer><script>window.onload=()=>window.print()<\/script></body></html>`);
  win.document.close();
}

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);
  const [ageFilter, setAgeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [recordStatus, setRecordStatus] = useState<"ativo" | "inativo" | "todos">("ativo");
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  useEffect(() => {
    setSession(obterSessao());
    setSessionChecked(true);
  }, []);
  useEffect(() => {
    if (!session?.access_token) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    listarPessoas(session.access_token, recordStatus)
      .then((records) => { if (!cancelled) setPeople(records); })
      .catch((e: Error) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [session, recordStatus]);
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
    const updatePhoto = () => {
      const file = photoInput?.files?.[0];
      if (photoPreview) { photoPreview.hidden = !file; photoPreview.textContent = file ? `Foto selecionada: ${file.name} (não enviada)` : ""; }
    };
    photoInput?.addEventListener("change", updatePhoto);
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
      if (invalid >= 0) { showStep(invalid); sections[invalid].querySelector<HTMLElement>(":invalid")?.focus(); return; }
      const fd = new FormData(form);
      const data: Record<string, any> = { ...(editing || {}), ...Object.fromEntries(fd.entries()) };
      delete data.photo;
      for (const key of ["activities", "programs", "benefits", "healthConditions", "allergies", "disabilities", "demands"]) data[key] = fd.getAll(key);
      data.consentSignedAt = data.consentStatus === "assinado" ? new Date().toISOString() : null;
      data.priority = String(data.priority || "").trim();
      try {
        await salvarPessoa(data, session.access_token);
        setPeople(await listarPessoas(session.access_token, recordStatus));
        setShowForm(false); setEditing(null); setError("");
      } catch (e) { setError(`Não foi possível salvar o cadastro: ${(e as Error).message}`); }
    };
    const nextHandler = () => {
      const invalid = Array.from(sections[current].querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input,select,textarea")).find(field => field.required && !field.value);
      if (invalid) { invalid.focus(); invalid.reportValidity(); return; }
      showStep(current + 1);
    };
    const prevHandler = () => showStep(current - 1);
    const cancelHandler = () => { setShowForm(false); setEditing(null); };
    form.addEventListener("submit", saveHandler);
    next.addEventListener("click", nextHandler);
    previous.addEventListener("click", prevHandler);
    cancel.addEventListener("click", cancelHandler);
    showStep(0);
    return () => { form.removeEventListener("submit", saveHandler); next.removeEventListener("click", nextHandler); previous.removeEventListener("click", prevHandler); cancel.removeEventListener("click", cancelHandler); benefitInputs.forEach(input => input.removeEventListener("change", updateOtherBenefit)); photoInput?.removeEventListener("change", updatePhoto); };
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
  const filtered = useMemo(() => people.filter(p => {
    const textMatch = [p.name, p.school, p.neighborhood].join(" ").toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"));
    const age = calcularIdade(p.birthDate);
    const ageMatch = ageFilter === "all" || (ageFilter === "child" && age !== null && age <= 11) || (ageFilter === "teen" && age !== null && age >= 12 && age <= 17) || (ageFilter === "adult" && age !== null && age >= 18);
    const statusMatch = statusFilter === "all" || (statusFilter === "priority" && Boolean(p.priority)) || (statusFilter === "regular" && !p.priority);
    return textMatch && ageMatch && statusMatch;
  }), [people, search, ageFilter, statusFilter]);
  const peopleUnder18 = people.filter(person => { const age = calcularIdade(person.birthDate); return age !== null && age < 18; }).length;
  const familyCount = new Set(people.map(person => person.family_id || person.id).filter(Boolean)).size;
  const priorityCount = people.filter(person => Boolean(person.priority)).length;

  async function atualizarStatus(person: Person) {
    const novoStatus = person.status === "inativo" ? "ativo" : "inativo";
    const acao = novoStatus === "inativo" ? "inativar" : "reativar";
    if (!window.confirm(`Deseja ${acao} o cadastro de ${person.name}?`)) return;
    try {
      await alterarStatusPessoa(person.id, novoStatus, session.access_token);
      setPeople(await listarPessoas(session.access_token, recordStatus));
      setError("");
    } catch (e) {
      setError(`Não foi possível ${acao} o cadastro: ${(e as Error).message}`);
    }
  }

  function exportarCsv() {
    const colunas = [["Nome", "name"], ["Nascimento", "birthDate"], ["Escola", "school"], ["Bairro", "neighborhood"], ["Forma de entrada", "referralSource"], ["Prioridade", "priority"], ["Status", "status"]] as const;
    const celula = (valor: unknown) => {
      let texto = String(valor ?? "");
      if (/^[\s]*[=+@-]/.test(texto)) texto = `'${texto}`;
      return `"${texto.replaceAll('"', '""')}"`;
    };
    const csv = [colunas.map(([rotulo]) => celula(rotulo)).join(";"), ...filtered.map((person) => colunas.map(([, campo]) => celula(person[campo])).join(";"))].join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "cadastros-renascer.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!sessionChecked) return <main className="grid min-h-screen place-items-center bg-[#f7f5f2] text-sm text-[#817b89]">Carregando...</main>;
  if (!session?.access_token) return <AuthPanel onLogin={()=>setSession(obterSessao())}/>;

  return <main className="min-h-screen bg-[#f7f5f2] text-[#302942]"><aside className="fixed inset-y-0 hidden w-64 flex-col bg-[#332652] p-7 text-white md:flex"><div className="mb-14 flex items-center gap-3"><img src="/assets/logo-renascer.png" alt="Instituto Renascer" className="h-12 w-12 rounded-full bg-white object-contain p-1"/><span className="font-semibold">Instituto Renascer</span></div><p className="mb-3 text-xs tracking-widest text-white/50">GESTÃO SOCIAL</p><a className="rounded-xl bg-white/15 px-4 py-3 text-sm" href="#cadastros">Cadastros</a><Link className="mt-2 rounded-xl px-4 py-3 text-sm text-white/75 hover:bg-white/10" href="/relatorios">Relatórios cadastrais</Link><div className="mt-auto"><p className="mb-5 text-xs leading-5 text-white/60">Cada história importa.<br/>Cuidar dos dados também é cuidar das pessoas.</p><div className="relative border-t border-white/15 pt-4"><button type="button" aria-expanded={profileMenuOpen} aria-haspopup="menu" onClick={() => setProfileMenuOpen(open => !open)} className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left hover:bg-white/10"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#f5d66c] text-sm font-bold text-[#332652]">{(session?.perfil?.nome || "ER").slice(0,1).toUpperCase()}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{session?.perfil?.nome || "Equipe Renascer"}</strong><small className="mt-1 block truncate text-xs text-white/60">Administrador</small></span><span aria-hidden="true" className="text-white/70">&#8964;</span></button>{profileMenuOpen && <div role="menu" className="absolute bottom-full left-0 mb-2 w-full overflow-hidden rounded-xl border border-white/10 bg-[#29203f] p-1 shadow-xl"><a role="menuitem" href="/alterar-senha" className="block rounded-lg px-3 py-3 text-sm hover:bg-white/10">Alterar senha</a><button role="menuitem" type="button" onClick={async()=>{setProfileMenuOpen(false);await sair();setSession(null);}} className="block w-full rounded-lg px-3 py-3 text-left text-sm text-white/90 hover:bg-white/10">Sair</button></div>}</div></div></aside><section className="px-5 py-8 md:ml-64 md:px-12"><header className="mb-10 flex justify-between border-b border-[#e8e3dc] pb-5 text-sm"><span className="text-[#817b89]">Gestão social / <strong className="text-[#302942]">Cadastros</strong></span></header><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm text-[#8b6f48]">ACOLHIMENTO E RECEPÇÃO</p><h1 className="mt-2 text-3xl font-semibold">Cadastros</h1><p className="mt-2 text-sm text-gray-500">Consulte e mantenha os cadastros das pessoas atendidas.</p></div><button onClick={()=>{if(showForm){setShowForm(false);setEditing(null);}else{setEditing(null);setShowForm(true);}}} className="rounded-xl bg-[#332652] px-5 py-3 text-sm font-medium text-white">{showForm ? "Fechar formulário" : "+ Novo cadastro"}</button></div>
    {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Pessoas atendidas",people.length],["Menores de 18 anos",peopleUnder18],["Famílias acompanhadas",familyCount],["Acompanhamento prioritário",priorityCount]].map(([label,value])=><article key={String(label)} className="rounded-2xl border border-[#eee9e2] bg-white p-5"><p className="text-sm text-gray-500">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></article>)}</div>
    {showForm && <div className="modal-backdrop" role="presentation" onClick={event => { if (event.target === event.currentTarget) { setShowForm(false); setEditing(null); } }}><section id="record-form-container" role="dialog" aria-modal="true" aria-labelledby="form-title" className="form-modal"><div className="modal-header"><div><h2 id="form-title">{editing ? "Atualizar cadastro" : "Vamos começar pelo acolhimento"}</h2><div className="step-progress mt-5 flex flex-wrap gap-3" aria-label="Etapa 1 de 7">{["Identificação","Família","Endereço","Domicílio","Benefícios","Saúde","Acompanhamento"].map((label,index)=><span key={label} className={`step ${index===0?"active":""}`}><i>{index+1}</i> {label}</span>)}</div></div><button type="button" aria-label="Fechar formulário" onClick={()=>{setShowForm(false);setEditing(null);}} className="close-modal text-2xl text-gray-500">×</button></div><div className="form-body" dangerouslySetInnerHTML={{ __html: recordFormMarkup }} /></section></div>}
    <div className="mt-8 flex flex-wrap gap-3">
      <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por nome, escola ou bairro" className="w-full max-w-lg rounded-xl border border-[#e8e3dc] bg-white px-4 py-3 text-sm" />
      <select value={recordStatus} onChange={event => setRecordStatus(event.target.value as typeof recordStatus)} aria-label="Situação do cadastro" className="rounded-xl border bg-white px-3 text-sm">
        <option value="ativo">Cadastros ativos</option><option value="inativo">Cadastros inativos</option><option value="todos">Todos os cadastros</option>
      </select>
      <select value={ageFilter} onChange={event => setAgeFilter(event.target.value)} aria-label="Filtrar por idade" className="rounded-xl border bg-white px-3 text-sm">
        <option value="all">Todas as idades</option><option value="child">Até 11 anos</option><option value="teen">12 a 17 anos</option><option value="adult">18 anos ou mais</option>
      </select>
      <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} aria-label="Filtrar por acompanhamento" className="rounded-xl border bg-white px-3 text-sm">
        <option value="all">Todas as prioridades</option><option value="priority">Prioritária</option><option value="regular">Acompanhamento</option>
      </select>
      <span className="self-center text-sm text-gray-500">{filtered.length} cadastros</span>
      <button onClick={exportarCsv} disabled={!filtered.length} className="rounded-xl border px-4 py-2 text-sm disabled:opacity-50">Exportar CSV</button>
    </div>
    <div className="mt-4 overflow-x-auto rounded-2xl border border-[#eee9e2] bg-white">
      <table className="w-full min-w-[850px] text-left text-sm">
        <thead className="bg-[#faf9f7] text-xs text-gray-500"><tr><th className="p-4">Nome</th><th className="p-4">Nascimento</th><th className="p-4">Escola</th><th className="p-4">Bairro</th><th className="p-4">Situação</th><th className="p-4">Ações</th></tr></thead>
        <tbody>
          {filtered.map(person => <tr key={person.id} className="border-t border-[#f0ede8]">
            <td className="p-4 font-medium">{person.name}</td>
            <td className="p-4">{person.birthDate ? new Date(`${person.birthDate}T12:00:00`).toLocaleDateString("pt-BR") : "—"}</td>
            <td className="p-4">{person.school || "—"}</td>
            <td className="p-4">{person.neighborhood || "—"}</td>
            <td className="p-4">{person.status === "inativo" ? "Inativo" : person.priority ? "Prioritária" : "Acompanhamento"}</td>
            <td className="flex gap-3 p-4"><button onClick={() => { setEditing(person); setShowForm(true); }} className="text-[#574778]">Editar</button><button onClick={() => imprimirFicha(person)} className="text-[#574778]">Imprimir</button><button onClick={() => void atualizarStatus(person)} className="text-[#574778]">{person.status === "inativo" ? "Reativar" : "Inativar"}</button></td>
          </tr>)}
          {loading && <tr><td colSpan={6} className="p-10 text-center text-gray-500">Carregando cadastros…</td></tr>}
          {!loading && !filtered.length && <tr><td colSpan={6} className="p-10 text-center text-gray-500">{people.length ? "Nenhum cadastro corresponde à busca." : "Nenhum cadastro disponível para este perfil."}</td></tr>}
        </tbody>
      </table>
    </div>
  </section></main>;
}


