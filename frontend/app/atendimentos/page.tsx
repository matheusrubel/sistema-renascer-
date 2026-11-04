"use client";

import { useCallback, useEffect, useState } from "react";
import { AuthPanel } from "../auth-panel";
import { useDialogos } from "@/components/dialogos";
import { BotaoIcone } from "../botao-icone";
import { MessageSquarePlus, Pencil, Plus, ShieldOff, Trash2 } from "lucide-react";
import {
  AREA_DO_PAPEL, PAPEIS_ATENDIMENTOS, SITUACOES_ENCAMINHAMENTO, atualizarSituacaoEncaminhamento, buscarPessoasParaAtendimento,
  concederAcessoTemporario, corrigirAtendimento, listarAcessosTemporarios, listarCatalogosAtendimento, listarHistoricoAtendimentos,
  listarPerfisAcesso, obterSessao, registrarAtendimento, registrarEmissaoHistorico, revogarAcessoTemporario,
  type AcessoTemporario, type AreaAtendimento, type Atendimento, type Encaminhamento,
} from "../../src/supabase";

type PessoaBusca = { id: string; nome_completo: string; data_nascimento: string; status: string };
type Catalogos = { tipos: { id: string; nome: string }[]; destinos: { id: string; nome: string }[] };
type LinhaEncaminhamento = { destino_id: string; destino_outro: string; data: string };
type Formulario = { atendimentoId?: string; dataHora: string; tipoId: string; motivo: string; relato: string; combinados: string; encaminhamentos: LinhaEncaminhamento[] };

const NOME_AREA: Record<AreaAtendimento, string> = { social: "Social", psicologico: "Psicológico" };
const ROTULO_PAPEL: Record<string, string> = { admin: "Coordenação", psicologo: "Psicologia", assistente_social: "Serviço social" };
const campo = "w-full rounded-xl border border-[#e8e3dc] bg-white px-3 py-1.5 text-sm";

const agoraLocal = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const hoje = () => new Date().toISOString().slice(0, 10);
const formatarDataHora = (valor: string) => new Date(valor).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
const formatarData = (valor?: string) => (valor ? new Date(`${valor.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "");
const escapar = (valor: unknown) => String(valor ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c] as string));
const formularioVazio = (): Formulario => ({ dataHora: agoraLocal(), tipoId: "", motivo: "", relato: "", combinados: "", encaminhamentos: [] });

function imprimirHistorico(pessoa: PessoaBusca, area: AreaAtendimento, atendimentos: Atendimento[], destinatario: string, emissor: string, janela: Window) {
  const blocos = atendimentos.map((a) => `<section><h3>${escapar(formatarDataHora(a.data_hora))} · ${escapar(a.tipo || "Atendimento")}</h3>
    <p class="meta">Profissional: ${escapar(a.profissional || "—")} · versão ${a.versao}</p>
    ${a.motivo ? `<p><strong>Motivo:</strong> ${escapar(a.motivo)}</p>` : ""}${a.relato ? `<p><strong>Relato e evolução:</strong><br>${escapar(a.relato).replace(/\n/g, "<br>")}</p>` : ""}
    ${a.combinados ? `<p><strong>Combinados:</strong> ${escapar(a.combinados)}</p>` : ""}
    ${a.encaminhamentos.length ? `<p><strong>Encaminhamentos:</strong> ${a.encaminhamentos.map((e) => `${escapar(e.destino)} (${formatarData(e.data)}, ${SITUACOES_ENCAMINHAMENTO[e.situacao]})`).join("; ")}</p>` : ""}</section>`).join("");
  janela.document.open();
  janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Histórico - ${escapar(pessoa.nome_completo)}</title><style>
body{font:13px/1.5 Arial,sans-serif;color:#292535;margin:30px 40px}header{border-bottom:2px solid #332652;padding-bottom:10px;margin-bottom:16px}h1{font-size:18px;margin:0;color:#332652}
h3{font-size:13px;margin:0 0 2px;color:#332652}.meta{color:#67766b;font-size:11px;margin:0 0 6px}section{border-bottom:1px solid #dce4dc;padding:10px 0;break-inside:avoid}p{margin:0 0 6px}
footer{margin-top:20px;color:#78847b;font-size:10px}@media print{body{margin:14mm}}</style></head><body>
<header><h1>Instituto de Ação Social Renascer</h1><p class="meta">Histórico de atendimentos (${NOME_AREA[area]}) · ${escapar(pessoa.nome_completo)} · nascimento ${escapar(formatarData(pessoa.data_nascimento))}</p>
<p class="meta">Emitido por ${escapar(emissor)} em ${escapar(new Date().toLocaleDateString("pt-BR"))} para ${escapar(destinatario)}</p></header>
${blocos || "<p>Nenhum atendimento registrado.</p>"}<footer>Documento sigiloso. Emissão registrada no sistema. Use apenas para a finalidade informada ao destinatário.</footer>
<script>window.onload=()=>window.print()<\/script></body></html>`);
  janela.document.close();
}

export default function AtendimentosPage() {
  const [sessao, setSessao] = useState<any>(null);
  const [verificada, setVerificada] = useState(false);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<PessoaBusca[]>([]);
  const [pessoa, setPessoa] = useState<PessoaBusca | null>(null);
  const [historico, setHistorico] = useState<Atendimento[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [catalogos, setCatalogos] = useState<Catalogos>({ tipos: [], destinos: [] });
  const [form, setForm] = useState<Formulario | null>(null);
  const [salvando, setSalvando] = useState(false);
  const { perguntar } = useDialogos();

  const token: string = sessao?.access_token;
  const papel: string = sessao?.perfil?.papel || "";
  const area = AREA_DO_PAPEL[papel];
  const podeAbrir = PAPEIS_ATENDIMENTOS.includes(papel);

  useEffect(() => { setSessao(obterSessao()); setVerificada(true); }, []);
  useEffect(() => {
    if (!token) return;
    listarCatalogosAtendimento(token).then(setCatalogos).catch((e: Error) => setErro(e.message));
  }, [token]);

  useEffect(() => {
    if (!token || busca.trim().length < 2) { setResultados([]); return; }
    const espera = setTimeout(() => {
      buscarPessoasParaAtendimento(busca, token).then(setResultados).catch((e: Error) => setErro(e.message));
    }, 300);
    return () => clearTimeout(espera);
  }, [busca, token]);

  const carregarHistorico = useCallback(async (alvo: PessoaBusca) => {
    setCarregando(true); setErro("");
    try { setHistorico(await listarHistoricoAtendimentos(alvo.id, token)); }
    catch (e) { setErro(`Não foi possível abrir o histórico: ${(e as Error).message}`); setHistorico([]); }
    finally { setCarregando(false); }
  }, [token]);

  function selecionar(alvo: PessoaBusca) {
    setPessoa(alvo); setForm(null); setResultados([]); setBusca("");
    void carregarHistorico(alvo);
  }

  async function salvar() {
    if (!form || !pessoa || !area) return;
    if (!form.motivo.trim() && !form.relato.trim()) { setErro("Preencha ao menos o motivo ou o relato do atendimento."); return; }
    setSalvando(true); setErro("");
    try {
      if (form.atendimentoId) await corrigirAtendimento(form.atendimentoId, form, token);
      else await registrarAtendimento({ pessoaId: pessoa.id, area, dataHora: form.dataHora, tipoId: form.tipoId || null, motivo: form.motivo, relato: form.relato, combinados: form.combinados, encaminhamentos: form.encaminhamentos }, token);
      setForm(null);
      await carregarHistorico(pessoa);
    } catch (e) { setErro(`Não foi possível salvar: ${(e as Error).message}`); }
    finally { setSalvando(false); }
  }

  async function mudarSituacao(encaminhamento: Encaminhamento, situacao: Encaminhamento["situacao"], retorno = encaminhamento.retorno || "") {
    try { await atualizarSituacaoEncaminhamento(encaminhamento.id, situacao, retorno, token); if (pessoa) await carregarHistorico(pessoa); }
    catch (e) { setErro(`Não foi possível atualizar o encaminhamento: ${(e as Error).message}`); }
  }

  async function emitirHistorico() {
    if (!pessoa || !area) return;
    const destinatario = (await perguntar({ titulo: "Emitir histórico", mensagem: "Para quem este histórico será emitido? A emissão fica registrada no sistema.", rotulo: "Ex.: Vara da Infância", obrigatorio: true, confirmar: "Emitir" }))?.trim();
    if (!destinatario) return;
    const janela = window.open("", "_blank", "width=850,height=900");
    if (!janela) { setErro("Permita pop-ups neste site para imprimir."); return; }
    try {
      await registrarEmissaoHistorico(pessoa.id, area, destinatario, token);
      imprimirHistorico(pessoa, area, historico.filter((a) => a.area === area), destinatario, sessao?.perfil?.nome || "Equipe", janela);
    } catch (e) { janela.close(); setErro(`Não foi possível registrar a emissão: ${(e as Error).message}`); }
  }

  if (!verificada) return <main className="grid min-h-screen place-items-center bg-[#f7f5f2] text-sm text-[#817b89]">Carregando...</main>;
  if (!token) return <AuthPanel onLogin={() => setSessao(obterSessao())} />;

  const cabecalho = <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-[#e8e3dc] pb-5">
    <div><h1 className="mt-3 text-3xl font-semibold">Atendimentos</h1>
      <p className="mt-2 text-sm text-gray-500">Registros sigilosos de atendimento e encaminhamentos.</p></div>
    
  </header>;


  return <div className="px-5 py-8 md:px-12"><div className="mx-auto max-w-5xl">
    {cabecalho}
    {!podeAbrir && <p className="mb-5 rounded-xl bg-[#f3eef9] p-4 text-sm text-[#4b3b73]">Seu perfil não acessa atendimentos. Você só verá registros de uma área se a coordenação liberar um acesso temporário.</p>}
    {papel === "admin" && <p className="mb-5 rounded-xl bg-[#f3eef9] p-4 text-sm text-[#4b3b73]">Como coordenação, você visualiza somente os atendimentos sociais, em modo de leitura.</p>}
    {erro && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{erro}</p>}

    <section aria-label="Buscar pessoa" className="rounded-2xl border border-[#eee9e2] bg-white p-5">
      <label className="block text-sm font-medium text-[#3a3254]" htmlFor="busca-pessoa">Buscar pessoa atendida pelo nome</label>
      <input id="busca-pessoa" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Digite ao menos 2 letras" className={`${campo} mt-2 block max-w-lg`} />
      {resultados.length > 0 && <ul className="mt-3 divide-y divide-[#f0ede8] rounded-xl border border-[#eee9e2]">
        {resultados.map((r) => <li key={r.id}><button onClick={() => selecionar(r)} className="flex w-full justify-between px-3.5 py-2 text-left text-sm hover:bg-[#faf9f7]"><span className="font-medium">{r.nome_completo}</span><span className="text-gray-500">{formatarData(r.data_nascimento)}{r.status === "inativo" ? " · inativo" : ""}</span></button></li>)}
      </ul>}
      {busca.trim().length >= 2 && !resultados.length && <p className="mt-3 text-sm text-gray-500">Nenhuma pessoa encontrada.</p>}
    </section>

    {pessoa && <section aria-label="Histórico" className="mt-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-xl font-semibold">{pessoa.nome_completo}</h2><p className="text-sm text-gray-500">Nascimento: {formatarData(pessoa.data_nascimento)}</p></div>
        {area && <div className="flex gap-3">
          <button onClick={() => void emitirHistorico()} disabled={carregando} className="btn btn-secundario">Emitir histórico</button>
          <button onClick={() => setForm(formularioVazio())} className="btn btn-primario">+ Novo atendimento</button>
        </div>}
      </div>

      {form && <article className="mb-6 rounded-2xl border border-[#d9d0ea] bg-white p-5">
        <h3 className="text-lg font-semibold">{form.atendimentoId ? "Corrigir atendimento (nova versão)" : `Novo atendimento — ${area ? NOME_AREA[area] : ""}`}</h3>
        {form.atendimentoId && <p className="mt-1 text-sm text-gray-500">A versão anterior continua guardada no histórico.</p>}
        <div className="mt-4 form-grade sm:grid-cols-2">
          {!form.atendimentoId && <>
            <div className="grid grid-cols-[1fr_130px] gap-3">
              <label className="text-sm">Data<input type="date" value={form.dataHora.slice(0, 10)} max={hoje()} onChange={(e) => setForm({ ...form, dataHora: `${e.target.value || hoje()}T${form.dataHora.slice(11, 16) || "00:00"}` })} className={campo} /></label>
              <label className="text-sm">Hora<input type="time" value={form.dataHora.slice(11, 16)} onChange={(e) => setForm({ ...form, dataHora: `${form.dataHora.slice(0, 10)}T${e.target.value || "00:00"}` })} className={campo} /></label>
            </div>
            <label className="text-sm">Tipo<select value={form.tipoId} onChange={(e) => setForm({ ...form, tipoId: e.target.value })} className={campo}><option value="">Selecione</option>{catalogos.tipos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}</select></label>
          </>}
          <label className="text-sm sm:col-span-2">Motivo ou demanda<input value={form.motivo} maxLength={300} onChange={(e) => setForm({ ...form, motivo: e.target.value })} className={campo} /></label>
          <label className="text-sm sm:col-span-2">Relato e evolução<textarea value={form.relato} rows={6} onChange={(e) => setForm({ ...form, relato: e.target.value })} className={campo} /></label>
          <label className="text-sm sm:col-span-2">Combinados e próximos passos<textarea value={form.combinados} rows={3} onChange={(e) => setForm({ ...form, combinados: e.target.value })} className={campo} /></label>
        </div>
        {!form.atendimentoId && <div className="mt-5"><div className="flex items-center justify-between"><h4 className="text-sm font-semibold">Encaminhamentos</h4>
          <button type="button" onClick={() => setForm({ ...form, encaminhamentos: [...form.encaminhamentos, { destino_id: "", destino_outro: "", data: hoje() }] })} className="btn btn-secundario"><Plus size={15} />Adicionar encaminhamento</button></div>
          {form.encaminhamentos.map((linha, indice) => {
            const outro = catalogos.destinos.find((d) => d.id === linha.destino_id)?.nome === "Outro";
            const alterar = (parcial: Partial<LinhaEncaminhamento>) => setForm({ ...form, encaminhamentos: form.encaminhamentos.map((item, i) => (i === indice ? { ...item, ...parcial } : item)) });
            return <div key={indice} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_160px_auto]">
              <select aria-label="Destino" value={linha.destino_id} onChange={(e) => alterar({ destino_id: e.target.value })} className={campo}><option value="">Destino</option>{catalogos.destinos.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}</select>
              {outro || !linha.destino_id ? <input aria-label="Outro destino" placeholder={outro ? "Qual destino?" : "Ou informe outro destino"} value={linha.destino_outro} onChange={(e) => alterar({ destino_outro: e.target.value })} className={campo} /> : <span />}
              <input aria-label="Data do encaminhamento" type="date" value={linha.data} max={hoje()} onChange={(e) => alterar({ data: e.target.value })} className={campo} />
              <BotaoIcone rotulo="Remover encaminhamento" icone={<Trash2 size={16} />} tom="perigo" aoClicar={() => setForm({ ...form, encaminhamentos: form.encaminhamentos.filter((_, i) => i !== indice) })} />
            </div>;
          })}
        </div>}
        <div className="mt-6 flex gap-3"><button onClick={() => void salvar()} disabled={salvando} className="btn btn-primario">{salvando ? "Salvando…" : "Salvar"}</button>
          <button onClick={() => setForm(null)} disabled={salvando} className="btn btn-secundario">Cancelar</button></div>
      </article>}

      {carregando && <p role="status" className="text-sm text-gray-500">Carregando histórico…</p>}
      {!carregando && !historico.length && <p className="rounded-xl bg-white p-6 text-center text-sm text-gray-500">Nenhum atendimento visível para o seu perfil.</p>}
      <div className="space-y-4">{historico.map((a) => <article key={a.id} className="rounded-2xl border border-[#eee9e2] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">{formatarDataHora(a.data_hora)} · {a.tipo || "Atendimento"} <span className="ml-2 rounded-full bg-[#f3eef9] px-2 py-0.5 text-xs font-normal text-[#4b3b73]">{NOME_AREA[a.area]}</span></p>
          <p className="text-xs text-gray-500">{a.profissional || "Profissional"} · versão {a.versao} de {a.total_versoes}</p>
        </div>
        {a.motivo && <p className="mt-3 text-sm"><strong>Motivo:</strong> {a.motivo}</p>}
        {a.relato && <p className="mt-2 whitespace-pre-wrap text-sm"><strong>Relato e evolução:</strong> {a.relato}</p>}
        {a.combinados && <p className="mt-2 text-sm"><strong>Combinados:</strong> {a.combinados}</p>}
        {a.encaminhamentos.length > 0 && <div className="mt-3 border-t border-[#f0ede8] pt-3"><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Encaminhamentos</p>
          {a.encaminhamentos.map((e) => <div key={e.id} className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            <span className="font-medium">{e.destino}</span><span className="text-gray-500">{formatarData(e.data)}</span>
            {a.meu ? <select aria-label="Situação do encaminhamento" value={e.situacao} onChange={(ev) => void mudarSituacao(e, ev.target.value as Encaminhamento["situacao"])} className="rounded-lg border border-[#e8e3dc] bg-white px-2 py-1 text-sm">
              {Object.entries(SITUACOES_ENCAMINHAMENTO).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}</select> : <span>{SITUACOES_ENCAMINHAMENTO[e.situacao]}</span>}
            {e.retorno && <span className="text-gray-600">Retorno: {e.retorno}</span>}
            {a.meu && <BotaoIcone rotulo="Anotar retorno" icone={<MessageSquarePlus size={16} />} aoClicar={async () => { const retorno = await perguntar({ titulo: "Retorno do encaminhamento", mensagem: "Anote o retorno recebido do serviço para onde a pessoa foi encaminhada.", rotulo: "Retorno", valorInicial: e.retorno || "" }); if (retorno !== null) void mudarSituacao(e, e.situacao, retorno); }} />}
          </div>)}</div>}
        {a.meu && !form && <div className="mt-3 flex justify-end"><BotaoIcone rotulo="Corrigir (nova versão)" icone={<Pencil size={16} />} aoClicar={() => setForm({ atendimentoId: a.id, dataHora: a.data_hora, tipoId: "", motivo: a.motivo || "", relato: a.relato || "", combinados: a.combinados || "", encaminhamentos: [] })} /></div>}
      </article>)}</div>
    </section>}

    {papel === "admin" && <AcessosTemporarios token={token} meuId={sessao?.user?.id} onErro={setErro} />}
  </div></div>;
}

function AcessosTemporarios({ token, meuId, onErro }: { token: string; meuId?: string; onErro: (mensagem: string) => void }) {
  const [perfis, setPerfis] = useState<{ user_id: string; nome: string; papel: string }[]>([]);
  const [acessos, setAcessos] = useState<AcessoTemporario[]>([]);
  const [usuario, setUsuario] = useState("");
  const [areaEscolhida, setAreaEscolhida] = useState<AreaAtendimento>("social");
  const [dias, setDias] = useState(7);

  const recarregar = useCallback(async () => {
    try { setAcessos(await listarAcessosTemporarios(token)); } catch (e) { onErro((e as Error).message); }
  }, [token, onErro]);
  useEffect(() => {
    listarPerfisAcesso(token).then(setPerfis).catch((e: Error) => onErro(e.message));
    void recarregar();
  }, [token, onErro, recarregar]);

  const nome = (id: string) => perfis.find((p) => p.user_id === id)?.nome || "Usuário";

  return <section aria-label="Acessos temporários" className="mt-10 rounded-2xl border border-[#eee9e2] bg-white p-5">
    <h2 className="text-lg font-semibold">Acessos temporários</h2>
    <p className="mt-1 text-sm text-gray-500">Para ausências (férias, licença): libera a leitura de uma área por um período. O acesso termina sozinho e pode ser revogado.</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_160px_110px_auto]">
      <select aria-label="Usuário" value={usuario} onChange={(e) => setUsuario(e.target.value)} className={campo}><option value="">Escolha o usuário</option>{perfis.filter((p) => p.user_id !== meuId).map((p) => <option key={p.user_id} value={p.user_id}>{p.nome} ({ROTULO_PAPEL[p.papel] || p.papel})</option>)}</select>
      <select aria-label="Área" value={areaEscolhida} onChange={(e) => setAreaEscolhida(e.target.value as AreaAtendimento)} className={campo}><option value="social">Social</option><option value="psicologico">Psicológico</option></select>
      <input aria-label="Dias de validade" type="number" min={1} max={60} value={dias} onChange={(e) => setDias(Math.min(60, Math.max(1, Number(e.target.value) || 1)))} className={campo} />
      <button disabled={!usuario} onClick={async () => { try { await concederAcessoTemporario(usuario, areaEscolhida, dias, token); setUsuario(""); await recarregar(); } catch (e) { onErro((e as Error).message); } }} className="btn btn-primario">Liberar</button>
    </div>
    {acessos.length > 0 && <ul className="mt-4 divide-y divide-[#f0ede8] text-sm">{acessos.map((a) => <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
      <span>{nome(a.usuario_id)} · {NOME_AREA[a.area]} · até {formatarData(a.valido_ate)}</span>
      <BotaoIcone rotulo="Revogar acesso" icone={<ShieldOff size={16} />} tom="perigo" aoClicar={async () => { try { await revogarAcessoTemporario(a.id, token); await recarregar(); } catch (e) { onErro((e as Error).message); } }} /></li>)}</ul>}
  </section>;
}
