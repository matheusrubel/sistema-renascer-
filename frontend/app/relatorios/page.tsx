"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AuthPanel } from "../auth-panel";
import { listarDadosRelatorio, obterSessao } from "../../src/supabase";

type Pessoa = { id: string; name: string; birthDate?: string; sex?: string; referralSource?: string; referralReason?: string; priority?: string; school?: string; neighborhood?: string; entryDate?: string; family_id?: string; [key: string]: any };
type Linha = [string, number];
type Secao = { id: string; titulo: string; linhas: Linha[] };
type Filtros = { desde: string; ate: string; faixa: string; sexo: string; territorio: string; escola: string; origem: string; prioridade: string };

const NAO_INFORMADO = "Não informado";
const SEM_PRIORIDADE = "Sem situação prioritária";
const FILTROS_VAZIOS: Filtros = { desde: "", ate: "", faixa: "", sexo: "", territorio: "", escola: "", origem: "", prioridade: "" };
const FAIXAS = ["0 a 5 anos", "6 a 11 anos", "12 a 17 anos", "18 anos ou mais", "Sem data de nascimento"];
const SEXOS = ["Feminino", "Masculino", "Outro", NAO_INFORMADO];

function idade(data?: string): number | null {
  if (!data) return null;
  const nascimento = new Date(`${data}T12:00:00`);
  if (Number.isNaN(nascimento.getTime())) return null;
  const hoje = new Date();
  let anos = hoje.getFullYear() - nascimento.getFullYear();
  if (hoje.getMonth() < nascimento.getMonth() || (hoje.getMonth() === nascimento.getMonth() && hoje.getDate() < nascimento.getDate())) anos--;
  return anos < 0 ? null : anos;
}

function faixaEtaria(data?: string): string {
  const anos = idade(data);
  if (anos === null) return "Sem data de nascimento";
  if (anos <= 5) return "0 a 5 anos";
  if (anos <= 11) return "6 a 11 anos";
  if (anos <= 17) return "12 a 17 anos";
  return "18 anos ou mais";
}

const chave = (valor: string) => valor.trim().toLocaleLowerCase("pt-BR");
const texto = (valor: unknown, padrao = NAO_INFORMADO) => String(valor ?? "").trim() || padrao;

const extratores: Record<string, (pessoa: Pessoa) => string> = {
  faixa: pessoa => faixaEtaria(pessoa.birthDate),
  sexo: pessoa => texto(pessoa.sex),
  territorio: pessoa => texto(pessoa.neighborhood),
  escola: pessoa => texto(pessoa.school),
  origem: pessoa => texto(pessoa.referralSource),
  prioridade: pessoa => texto(pessoa.priority, SEM_PRIORIDADE),
  motivo: pessoa => texto(pessoa.referralReason),
};

/** Agrupa ignorando diferenças de caixa e espaços; mantém a primeira grafia encontrada. */
function agrupar(pessoas: Pessoa[], campo: string, ordemFixa?: string[]): Linha[] {
  const extrair = extratores[campo];
  const grupos = new Map<string, Linha>();
  for (const pessoa of pessoas) {
    const rotulo = extrair(pessoa);
    const atual = grupos.get(chave(rotulo));
    if (atual) atual[1]++;
    else grupos.set(chave(rotulo), [rotulo, 1]);
  }
  if (ordemFixa) return ordemFixa.map(rotulo => [rotulo, grupos.get(chave(rotulo))?.[1] ?? 0] as Linha);
  return [...grupos.values()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"));
}

function opcoes(pessoas: Pessoa[], campo: string): string[] {
  return agrupar(pessoas, campo).map(([rotulo]) => rotulo).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function descreverFiltros(filtros: Filtros): string[] {
  const rotulos: [keyof Filtros, string][] = [["desde", "Entrada a partir de"], ["ate", "Entrada até"], ["faixa", "Faixa etária"], ["sexo", "Sexo"], ["territorio", "Território"], ["escola", "Escola"], ["origem", "Forma de entrada"], ["prioridade", "Situação prioritária"]];
  return rotulos.filter(([campo]) => filtros[campo]).map(([campo, rotulo]) => `${rotulo}: ${filtros[campo]}`);
}

function celula(valor: unknown): string {
  let conteudo = String(valor ?? "");
  if (/^[\s]*[=+@-]/.test(conteudo)) conteudo = `'${conteudo}`;
  return `"${conteudo.replaceAll('"', '""')}"`;
}

function exportarCsv(secoes: Secao[], filtros: string[]) {
  const linhas: unknown[][] = [["Relatório", "Indicador", "Quantidade"]];
  if (filtros.length) filtros.forEach(filtro => linhas.push(["Filtro aplicado", filtro, ""]));
  for (const secao of secoes) for (const [rotulo, quantidade] of secao.linhas) linhas.push([secao.titulo, rotulo, quantidade]);
  const csv = linhas.map(linha => linha.map(celula).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "relatorio-cadastros-renascer.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export default function RelatoriosPage() {
  const [sessao, setSessao] = useState<any>(null);
  const [sessaoVerificada, setSessaoVerificada] = useState(false);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VAZIOS);
  const [ocultas, setOcultas] = useState<Set<string>>(new Set());

  useEffect(() => { setSessao(obterSessao()); setSessaoVerificada(true); }, []);
  useEffect(() => {
    if (!sessao?.access_token) return;
    let cancelado = false;
    setCarregando(true);
    listarDadosRelatorio(sessao.access_token)
      .then((dados: Pessoa[]) => { if (!cancelado) setPessoas(dados); })
      .catch((falha: Error) => { if (!cancelado) setErro(falha.message); })
      .finally(() => { if (!cancelado) setCarregando(false); });
    return () => { cancelado = true; };
  }, [sessao]);

  const filtradas = useMemo(() => pessoas.filter(pessoa => {
    if (filtros.desde && !(pessoa.entryDate && pessoa.entryDate >= filtros.desde)) return false;
    if (filtros.ate && !(pessoa.entryDate && pessoa.entryDate <= filtros.ate)) return false;
    for (const campo of ["faixa", "sexo", "territorio", "escola", "origem", "prioridade"] as const) {
      if (filtros[campo] && chave(extratores[campo](pessoa)) !== chave(filtros[campo])) return false;
    }
    return true;
  }), [pessoas, filtros]);

  const listas = useMemo(() => ({
    territorio: opcoes(pessoas, "territorio"),
    escola: opcoes(pessoas, "escola"),
    origem: opcoes(pessoas, "origem"),
    prioridade: opcoes(pessoas, "prioridade"),
  }), [pessoas]);

  const secoes: Secao[] = useMemo(() => {
    const prioritarios = filtradas.filter(pessoa => Boolean(pessoa.priority?.trim())).length;
    const familias = new Set(filtradas.map(pessoa => pessoa.family_id || pessoa.id)).size;
    return [
      { id: "resumo", titulo: "Resumo", linhas: [["Cadastros ativos", filtradas.length], ["Famílias acompanhadas", familias], ["Acompanhamentos prioritários", prioritarios]] },
      { id: "faixa", titulo: "Faixa etária", linhas: agrupar(filtradas, "faixa", FAIXAS) },
      { id: "sexo", titulo: "Sexo informado", linhas: agrupar(filtradas, "sexo", SEXOS) },
      { id: "origem", titulo: "Forma de entrada", linhas: agrupar(filtradas, "origem") },
      { id: "territorio", titulo: "Território (bairro)", linhas: agrupar(filtradas, "territorio") },
      { id: "escola", titulo: "Escola", linhas: agrupar(filtradas, "escola") },
      { id: "prioridade", titulo: "Situação prioritária", linhas: agrupar(filtradas, "prioridade") },
      { id: "motivo", titulo: "Motivo de encaminhamento", linhas: agrupar(filtradas, "motivo") },
    ];
  }, [filtradas]);

  if (!sessaoVerificada) return <main className="grid min-h-screen place-items-center bg-[#f7f5f2] text-sm text-[#817b89]">Carregando...</main>;
  if (!sessao?.access_token) return <AuthPanel onLogin={() => setSessao(obterSessao())} />;

  const filtrosAplicados = descreverFiltros(filtros);
  const secoesSelecionadas = secoes.filter(secao => !ocultas.has(secao.id));
  const alterarFiltro = (campo: keyof Filtros, valor: string) => setFiltros(atual => ({ ...atual, [campo]: valor }));
  const alternarSecao = (id: string) => setOcultas(atual => { const novo = new Set(atual); if (novo.has(id)) novo.delete(id); else novo.add(id); return novo; });
  const resumo = secoes[0].linhas;
  const classeCampo = "w-full rounded-xl border border-[#e8e3dc] bg-white px-3 py-1.5 text-sm";

  return <div className="px-5 py-8 md:px-12">
    <div className="mx-auto max-w-6xl">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-[#e8e3dc] pb-5">
        <div><h1 className="mt-3 text-3xl font-semibold">Relatórios cadastrais</h1><p className="mt-2 text-sm text-gray-500">Resumo agregado dos cadastros ativos. Não exibe informações individuais de saúde ou atendimento.</p></div>
        <div className="flex flex-wrap gap-3 print:hidden"><button onClick={() => exportarCsv(secoesSelecionadas, filtrosAplicados)} disabled={carregando || !secoesSelecionadas.length} className="btn btn-secundario">Exportar CSV</button><button onClick={() => window.print()} className="btn btn-primario">Imprimir</button></div>
      </header>
      {erro && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{erro}</p>}
      {carregando && <p role="status" className="mb-5 text-sm text-gray-500">Carregando dados…</p>}

      <section aria-label="Filtros" className="mb-6 rounded-2xl border border-[#eee9e2] bg-white p-5 print:hidden">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">Filtros</h2><button type="button" onClick={() => setFiltros(FILTROS_VAZIOS)} disabled={!filtrosAplicados.length} className="text-sm text-[#574778] disabled:opacity-40">Limpar filtros</button></div>
        <div className="form-grade sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm">Entrada a partir de<input type="date" value={filtros.desde} max={filtros.ate || undefined} onChange={e => alterarFiltro("desde", e.target.value)} className={classeCampo} /></label>
          <label className="text-sm">Entrada até<input type="date" value={filtros.ate} min={filtros.desde || undefined} onChange={e => alterarFiltro("ate", e.target.value)} className={classeCampo} /></label>
          <label className="text-sm">Faixa etária<select value={filtros.faixa} onChange={e => alterarFiltro("faixa", e.target.value)} className={classeCampo}><option value="">Todas</option>{FAIXAS.map(f => <option key={f}>{f}</option>)}</select></label>
          <label className="text-sm">Sexo<select value={filtros.sexo} onChange={e => alterarFiltro("sexo", e.target.value)} className={classeCampo}><option value="">Todos</option>{SEXOS.map(s => <option key={s}>{s}</option>)}</select></label>
          <label className="text-sm">Território<select value={filtros.territorio} onChange={e => alterarFiltro("territorio", e.target.value)} className={classeCampo}><option value="">Todos</option>{listas.territorio.map(v => <option key={v}>{v}</option>)}</select></label>
          <label className="text-sm">Escola<select value={filtros.escola} onChange={e => alterarFiltro("escola", e.target.value)} className={classeCampo}><option value="">Todas</option>{listas.escola.map(v => <option key={v}>{v}</option>)}</select></label>
          <label className="text-sm">Forma de entrada<select value={filtros.origem} onChange={e => alterarFiltro("origem", e.target.value)} className={classeCampo}><option value="">Todas</option>{listas.origem.map(v => <option key={v}>{v}</option>)}</select></label>
          <label className="text-sm">Situação prioritária<select value={filtros.prioridade} onChange={e => alterarFiltro("prioridade", e.target.value)} className={classeCampo}><option value="">Todas</option>{listas.prioridade.map(v => <option key={v}>{v}</option>)}</select></label>
        </div>
        <fieldset className="mt-5 border-t border-[#f0ede8] pt-4"><legend className="text-sm font-medium">Dados incluídos na exportação e na impressão</legend>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">{secoes.map(secao => <label key={secao.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!ocultas.has(secao.id)} onChange={() => alternarSecao(secao.id)} />{secao.titulo}</label>)}</div>
        </fieldset>
      </section>

      {filtrosAplicados.length > 0 && <p className="mb-4 text-sm text-gray-600">Filtros aplicados: {filtrosAplicados.join(" · ")}. Mostrando {filtradas.length} de {pessoas.length} cadastros ativos.</p>}

      {!ocultas.has("resumo") && <section className="form-grade sm:grid-cols-2 lg:grid-cols-3">
        {resumo.map(([rotulo, valor]) => <article key={rotulo} className="rounded-2xl border border-[#eee9e2] bg-white p-6"><p className="text-sm text-gray-500">{rotulo}</p><p className="mt-3 text-3xl font-semibold">{valor}</p></article>)}
      </section>}
      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        {secoesSelecionadas.filter(secao => secao.id !== "resumo").map(secao => <RelatorioTabela key={secao.id} titulo={secao.titulo} linhas={secao.linhas} total={filtradas.length} />)}
      </section>
      {!carregando && !filtradas.length && <p className="mt-6 rounded-xl bg-white p-6 text-center text-sm text-gray-500">Nenhum cadastro corresponde aos filtros.</p>}
      <p className="mt-8 text-xs leading-5 text-gray-500">Os números consideram os cadastros ativos disponíveis para seu perfil de acesso. Situação prioritária e motivo de encaminhamento são campos de texto livre: grafias diferentes aparecem em linhas separadas. Confirme os critérios institucionais antes de usar estes totais em prestação de contas.</p>
    </div></div>;
}

function RelatorioTabela({ titulo, linhas, total }: { titulo: string; linhas: Linha[]; total: number }) {
  return <article className="rounded-2xl border border-[#eee9e2] bg-white p-6 print:break-inside-avoid"><h2 className="text-lg font-semibold">{titulo}</h2><div className="mt-5 space-y-4">{linhas.length ? linhas.map(([nome, quantidade]) => <div key={nome}><div className="mb-1 flex justify-between gap-4 text-sm"><span>{nome}</span><span className="font-medium">{quantidade}</span></div><div className="h-2 overflow-hidden rounded-full bg-[#f0ede8]"><div className="h-full rounded-full bg-[#8b6f48]" style={{ width: `${total ? quantidade / total * 100 : 0}%` }} /></div></div>) : <p className="text-sm text-gray-500">Sem dados.</p>}</div></article>;
}
