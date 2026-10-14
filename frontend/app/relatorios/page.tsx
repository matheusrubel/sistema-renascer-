"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AuthPanel } from "../auth-panel";
import { listarPessoas, obterSessao, sair } from "../../src/supabase";

type Pessoa = { id: string; name: string; birthDate?: string; sex?: string; referralSource?: string; priority?: string; entryDate?: string; [key: string]: any };

function idade(data?: string): number | null {
  if (!data) return null;
  const nascimento = new Date(`${data}T12:00:00`);
  if (Number.isNaN(nascimento.getTime())) return null;
  const hoje = new Date();
  let anos = hoje.getFullYear() - nascimento.getFullYear();
  if (hoje.getMonth() < nascimento.getMonth() || (hoje.getMonth() === nascimento.getMonth() && hoje.getDate() < nascimento.getDate())) anos--;
  return anos < 0 ? null : anos;
}

function exportarCsv(linhas: [string, number][]) {
  const csv = [["Indicador", "Quantidade"], ...linhas].map(linha => linha.map(valor => `"${String(valor).replaceAll('"', '""')}"`).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
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

  useEffect(() => { setSessao(obterSessao()); setSessaoVerificada(true); }, []);
  useEffect(() => {
    if (!sessao?.access_token) return;
    let cancelado = false;
    setCarregando(true);
    listarPessoas(sessao.access_token, "ativo")
      .then(dados => { if (!cancelado) setPessoas(dados); })
      .catch((falha: Error) => { if (!cancelado) setErro(falha.message); })
      .finally(() => { if (!cancelado) setCarregando(false); });
    return () => { cancelado = true; };
  }, [sessao]);

  const indicadores = useMemo(() => {
    const faixas = [["0 a 5 anos", (a: number | null) => a !== null && a <= 5], ["6 a 11 anos", (a: number | null) => a !== null && a >= 6 && a <= 11], ["12 a 17 anos", (a: number | null) => a !== null && a >= 12 && a <= 17], ["18 anos ou mais", (a: number | null) => a !== null && a >= 18], ["Sem data de nascimento", (a: number | null) => a === null]] as const;
    const porFaixa = faixas.map(([nome, regra]) => [nome, pessoas.filter(pessoa => regra(idade(pessoa.birthDate))).length] as [string, number]);
    const origens = new Map<string, number>();
    for (const pessoa of pessoas) {
      const origem = pessoa.referralSource?.trim() || "Não informado";
      origens.set(origem, (origens.get(origem) || 0) + 1);
    }
    const porOrigem = [...origens.entries()].sort((a, b) => b[1] - a[1]);
    const prioritarios = pessoas.filter(pessoa => Boolean(pessoa.priority)).length;
    const porSexo = ["Feminino", "Masculino", "Outro", "Não informado"].map(sexo => [sexo, pessoas.filter(pessoa => (pessoa.sex || "Não informado") === sexo).length] as [string, number]);
    return { porFaixa, porOrigem, porSexo, prioritarios };
  }, [pessoas]);

  if (!sessaoVerificada) return <main className="grid min-h-screen place-items-center bg-[#f7f5f2] text-sm text-[#817b89]">Carregando...</main>;
  if (!sessao?.access_token) return <AuthPanel onLogin={() => setSessao(obterSessao())} />;
  const linhasExportacao = [["Pessoas atendidas ativas", pessoas.length] as [string, number], ["Acompanhamentos prioritários", indicadores.prioritarios] as [string, number], ...indicadores.porFaixa.map(([nome, total]) => [`Idade: ${nome}`, total] as [string, number]), ...indicadores.porSexo.map(([nome, total]) => [`Sexo: ${nome}`, total] as [string, number]), ...indicadores.porOrigem.map(([nome, total]) => [`Origem: ${nome}`, total] as [string, number])];

  return <main className="min-h-screen bg-[#f7f5f2] px-5 py-8 text-[#302942] md:px-12">
    <div className="mx-auto max-w-6xl">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-[#e8e3dc] pb-5">
        <div><Link href="/" className="text-sm text-[#574778]">← Voltar aos cadastros</Link><h1 className="mt-3 text-3xl font-semibold">Relatórios cadastrais</h1><p className="mt-2 text-sm text-gray-500">Resumo agregado dos cadastros ativos. Não exibe informações individuais de saúde ou atendimento.</p></div>
        <div className="flex flex-wrap gap-3"><button onClick={() => exportarCsv(linhasExportacao)} disabled={carregando} className="rounded-xl border border-[#ded8ce] bg-white px-4 py-3 text-sm disabled:opacity-50">Exportar CSV</button><button onClick={() => window.print()} className="rounded-xl bg-[#332652] px-4 py-3 text-sm text-white">Imprimir</button><button onClick={async () => { await sair(); setSessao(null); }} className="px-2 text-sm text-[#574778]">Sair</button></div>
      </header>
      {erro && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{erro}</p>}
      {carregando && <p role="status" className="mb-5 text-sm text-gray-500">Carregando dados…</p>}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <article className="rounded-2xl border border-[#eee9e2] bg-white p-6"><p className="text-sm text-gray-500">Cadastros ativos</p><p className="mt-3 text-3xl font-semibold">{pessoas.length}</p></article>
        <article className="rounded-2xl border border-[#eee9e2] bg-white p-6"><p className="text-sm text-gray-500">Acompanhamentos prioritários</p><p className="mt-3 text-3xl font-semibold">{indicadores.prioritarios}</p></article>
        <article className="rounded-2xl border border-[#eee9e2] bg-white p-6"><p className="text-sm text-gray-500">Famílias acompanhadas</p><p className="mt-3 text-3xl font-semibold">{new Set(pessoas.map(pessoa => pessoa.family_id || pessoa.id)).size}</p></article>
      </section>
      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <RelatorioTabela titulo="Pessoas por faixa etária" linhas={indicadores.porFaixa} total={pessoas.length} />
        <RelatorioTabela titulo="Pessoas por sexo informado" linhas={indicadores.porSexo} total={pessoas.length} />
        <RelatorioTabela titulo="Pessoas por forma de entrada" linhas={indicadores.porOrigem} total={pessoas.length} />
      </section>
      <p className="mt-8 text-xs leading-5 text-gray-500">Os números consideram os cadastros ativos disponíveis para seu perfil de acesso. Confirme os critérios institucionais antes de usar estes totais em prestação de contas.</p>
    </div>
  </main>;
}

function RelatorioTabela({ titulo, linhas, total }: { titulo: string; linhas: [string, number][]; total: number }) {
  return <article className="rounded-2xl border border-[#eee9e2] bg-white p-6"><h2 className="text-lg font-semibold">{titulo}</h2><div className="mt-5 space-y-4">{linhas.map(([nome, quantidade]) => <div key={nome}><div className="mb-1 flex justify-between gap-4 text-sm"><span>{nome}</span><span className="font-medium">{quantidade}</span></div><div className="h-2 overflow-hidden rounded-full bg-[#f0ede8]"><div className="h-full rounded-full bg-[#8b6f48]" style={{ width: `${total ? quantidade / total * 100 : 0}%` }} /></div></div>)}</div></article>;
}
