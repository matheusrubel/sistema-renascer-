"use client";

import { useCallback, useEffect, useState } from "react";
import { AuthPanel } from "../auth-panel";
import { BotaoIcone } from "../botao-icone";
import { useDialogos } from "@/components/dialogos";
import { KeyRound, ShieldCheck, UserCheck, UserPlus, UserX, X } from "lucide-react";
import {
  atualizarUsuario, criarUsuario, gerarNovaSenhaTemporaria, listarSolicitacoesAcesso, listarUsuarios, obterSessao, resolverSolicitacaoAcesso,
  type Papel, type SolicitacaoAcesso, type UsuarioSistema,
} from "../../src/supabase";

const PAPEIS: { valor: Papel; rotulo: string; descricao: string }[] = [
  { valor: "admin", rotulo: "Coordenação (administrador)", descricao: "Gerencia usuários e acessos, edita o cadastro e lê o registro social. Não vê o psicológico." },
  { valor: "recepcao", rotulo: "Recepção", descricao: "Cria e edita cadastros. Não acessa atendimentos." },
  { valor: "psicologo", rotulo: "Psicologia", descricao: "Registra e lê o atendimento psicológico. Consulta o cadastro." },
  { valor: "assistente_social", rotulo: "Serviço social", descricao: "Registra e lê o atendimento social. Consulta o cadastro." },
];
const ROTULO = Object.fromEntries(PAPEIS.map((p) => [p.valor, p.rotulo])) as Record<string, string>;
const PAPEL_SUGERIDO: Record<string, Papel> = { "Recepção": "recepcao", "Administração": "admin", "Equipe técnica social": "assistente_social" };
const campo = "w-full rounded-xl border border-[#e8e3dc] bg-white px-3 py-1.5 text-sm";

const formatarData = (valor?: string | null) => (valor ? new Date(valor).toLocaleDateString("pt-BR") : "—");

export default function UsuariosPage() {
  const [sessao, setSessao] = useState<any>(null);
  const [verificada, setVerificada] = useState(false);
  const [usuarios, setUsuarios] = useState<UsuarioSistema[]>([]);
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoAcesso[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [senhaGerada, setSenhaGerada] = useState<{ para: string; senha: string } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [novo, setNovo] = useState<{ nome: string; email: string; papel: Papel | ""; solicitacaoId?: string }>({ nome: "", email: "", papel: "" });
  const [salvando, setSalvando] = useState(false);
  const [rascunhos, setRascunhos] = useState<Record<string, { nome: string; papel: Papel | "" }>>({});
  const { confirmar } = useDialogos();

  const token: string = sessao?.access_token;
  const meuId: string | undefined = sessao?.user?.id;
  const ehAdmin = sessao?.perfil?.papel === "admin";

  useEffect(() => { setSessao(obterSessao()); setVerificada(true); }, []);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [lista, pedidos] = await Promise.all([listarUsuarios(token), listarSolicitacoesAcesso(token)]);
      setUsuarios(lista); setSolicitacoes(pedidos);
    } catch (e) { setErro((e as Error).message); }
    finally { setCarregando(false); }
  }, [token]);
  useEffect(() => { if (token && ehAdmin) void recarregar(); }, [token, ehAdmin, recarregar]);

  async function executar(acao: () => Promise<void>) {
    setErro(""); setSalvando(true);
    try { await acao(); await recarregar(); }
    catch (e) { setErro((e as Error).message); }
    finally { setSalvando(false); }
  }

  const mostrarSenha = (para: string, senha: string) => { setSenhaGerada({ para, senha }); setCopiado(false); };

  async function criar() {
    if (!novo.nome.trim() || !novo.email.trim() || !novo.papel) { setErro("Preencha nome, e-mail e perfil."); return; }
    await executar(async () => {
      const criado = await criarUsuario({ nome: novo.nome, email: novo.email, papel: novo.papel as Papel }, token);
      if (novo.solicitacaoId && meuId) await resolverSolicitacaoAcesso(novo.solicitacaoId, "aprovada", meuId, token).catch(() => {});
      mostrarSenha(criado.email, criado.senhaTemporaria);
      setNovo({ nome: "", email: "", papel: "" });
    });
  }

  async function copiarSenha() {
    if (!senhaGerada) return;
    try { await navigator.clipboard.writeText(senhaGerada.senha); setCopiado(true); } catch { setErro("Não foi possível copiar. Selecione a senha e copie manualmente."); }
  }

  if (!verificada) return <main className="grid min-h-screen place-items-center bg-[#f7f5f2] text-sm text-[#817b89]">Carregando...</main>;
  if (!token) return <AuthPanel onLogin={() => { const nova = obterSessao(); if (nova?.perfil?.papel !== "admin") window.location.replace("/"); else setSessao(nova); }} />;

  const cabecalho = <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-[#e8e3dc] pb-5">
    <div><h1 className="mt-3 text-3xl font-semibold">Usuários e acessos</h1>
      <p className="mt-2 text-sm text-gray-500">Crie contas, defina o perfil de cada pessoa e desative acessos.</p></div>
    
  </header>;

  if (!ehAdmin) return <div className="px-5 py-8 md:px-12"><div className="mx-auto max-w-4xl">{cabecalho}
    <p role="alert" className="rounded-xl bg-white p-6 text-sm text-gray-600">Somente a coordenação gerencia usuários.</p></div></div>;

  return <div className="px-5 py-8 md:px-12"><div className="mx-auto max-w-5xl">
    {cabecalho}
    {erro && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{erro}</p>}

    {senhaGerada && <div role="status" className="mb-6 rounded-2xl border border-[#e6d28a] bg-[#fbf4dc] p-5">
      <p className="text-sm font-semibold text-[#6d5514]">Senha temporária de {senhaGerada.para}</p>
      <p className="mt-2 flex flex-wrap items-center gap-3"><code className="rounded-lg bg-white px-3 py-1.5 text-base tracking-wide">{senhaGerada.senha}</code>
        <button onClick={() => void copiarSenha()} className="btn btn-secundario">{copiado ? "Copiada" : "Copiar"}</button></p>
      <p className="mt-3 text-sm text-[#6d5514]">Ela aparece apenas agora e não fica guardada. Entregue à pessoa por um meio seguro e peça que troque a senha no primeiro acesso (menu do perfil → Alterar senha).</p>
      <button onClick={() => setSenhaGerada(null)} className="mt-3 text-sm text-[#574778]">Já entreguei, fechar</button>
    </div>}

    {solicitacoes.length > 0 && <section aria-label="Pedidos de acesso" className="mb-6 rounded-2xl border border-[#eee9e2] bg-white p-5">
      <h2 className="text-lg font-semibold">Pedidos de acesso ({solicitacoes.length})</h2>
      <ul className="mt-3 divide-y divide-[#f0ede8] text-sm">{solicitacoes.map((s) => <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
        <span><strong>{s.nome}</strong> · {s.email} · {s.area} · {formatarData(s.criado_em)}</span>
        <span className="flex items-center gap-0.5">
          <BotaoIcone rotulo="Criar usuário deste pedido" icone={<UserPlus size={16} />} aoClicar={() => setNovo({ nome: s.nome, email: s.email, papel: PAPEL_SUGERIDO[s.area] || "", solicitacaoId: s.id })} />
          <BotaoIcone rotulo="Recusar pedido" icone={<X size={16} />} tom="perigo" desabilitado={salvando || !meuId} aoClicar={async () => { if (await confirmar(`Recusar o pedido de ${s.nome}?`)) void executar(() => resolverSolicitacaoAcesso(s.id, "recusada", meuId as string, token)); }} />
        </span></li>)}</ul>
    </section>}

    <section aria-label="Novo usuário" className="mb-6 rounded-2xl border border-[#eee9e2] bg-white p-5">
      <h2 className="text-lg font-semibold">Novo usuário</h2>
      <div className="mt-4 form-grade sm:grid-cols-3">
        <label className="text-sm">Nome<input value={novo.nome} maxLength={140} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} className={campo} /></label>
        <label className="text-sm">E-mail<input type="email" value={novo.email} maxLength={180} onChange={(e) => setNovo({ ...novo, email: e.target.value })} className={campo} /></label>
        <label className="text-sm">Perfil de acesso<select value={novo.papel} onChange={(e) => setNovo({ ...novo, papel: e.target.value as Papel })} className={campo}><option value="">Selecione</option>{PAPEIS.map((p) => <option key={p.valor} value={p.valor}>{p.rotulo}</option>)}</select></label>
      </div>
      {novo.papel && <p className="mt-3 text-sm text-gray-500">{PAPEIS.find((p) => p.valor === novo.papel)?.descricao}</p>}
      <div className="form-acoes"><button onClick={() => void criar()} disabled={salvando} className="btn btn-primario">{salvando ? "Salvando…" : "Criar usuário"}</button><p className="form-ajuda">A conta é criada com uma senha temporária, mostrada uma única vez.</p></div>
    </section>

    <section aria-label="Usuários" className="rounded-2xl border border-[#eee9e2] bg-white">
      <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-[#faf9f7] text-xs text-gray-500"><tr><th className="p-4">Nome</th><th className="p-4">Perfil</th><th className="p-4">Situação</th><th className="p-4">Último acesso</th><th className="p-4">Ações</th></tr></thead>
        <tbody>
          {usuarios.map((u) => {
            const eu = u.id === meuId;
            if (!u.papel) {
              const r = rascunhos[u.id] || { nome: u.nome || u.email.split("@")[0], papel: "" as const };
              return <tr key={u.id} className="border-t border-[#f0ede8] bg-[#fffaf0]">
                <td className="p-4"><input aria-label={`Nome de ${u.email}`} value={r.nome} onChange={(e) => setRascunhos({ ...rascunhos, [u.id]: { ...r, nome: e.target.value } })} className={campo} /><span className="mt-1 block text-xs text-gray-500">{u.email} · sem perfil de acesso</span></td>
                <td className="p-4"><select aria-label={`Perfil de ${u.email}`} value={r.papel} onChange={(e) => setRascunhos({ ...rascunhos, [u.id]: { ...r, papel: e.target.value as Papel } })} className={campo}><option value="">Selecione</option>{PAPEIS.map((p) => <option key={p.valor} value={p.valor}>{p.rotulo}</option>)}</select></td>
                <td className="p-4 text-gray-500">Sem acesso</td><td className="p-4">{formatarData(u.ultimoAcesso)}</td>
                <td className="p-3"><div className="flex items-center gap-0.5"><BotaoIcone rotulo="Definir perfil de acesso" icone={<ShieldCheck size={16} />} desabilitado={salvando || !r.papel || !r.nome.trim()} aoClicar={() => void executar(() => atualizarUsuario(u.id, { nome: r.nome, papel: r.papel as Papel, ativo: true }, token).then(() => undefined))} /></div></td>
              </tr>;
            }
            return <tr key={u.id} className="border-t border-[#f0ede8]">
              <td className="p-4"><span className="font-medium">{u.nome || "—"}{eu ? " (você)" : ""}</span><span className="block text-xs text-gray-500">{u.email}</span></td>
              <td className="p-4"><select aria-label={`Perfil de ${u.nome}`} value={u.papel} disabled={salvando || eu} onChange={async (e) => {
                const papel = e.target.value as Papel;
                if (await confirmar(`Mudar o perfil de ${u.nome} para "${ROTULO[papel]}"?`)) void executar(() => atualizarUsuario(u.id, { papel }, token).then(() => undefined));
              }} className="rounded-lg border border-[#e8e3dc] bg-white px-2 py-1 text-sm disabled:opacity-60">{PAPEIS.map((p) => <option key={p.valor} value={p.valor}>{p.rotulo}</option>)}</select></td>
              <td className="p-4"><span className={`rounded-full px-2 py-0.5 text-xs ${u.ativo ? "bg-[#e5f4e4] text-[#2b6038]" : "bg-[#fbebeb] text-[#9a2f2f]"}`}>{u.ativo ? "Ativo" : "Inativo"}</span></td>
              <td className="p-4">{formatarData(u.ultimoAcesso)}</td>
              <td className="p-3"><div className="flex items-center gap-0.5">
                {!eu && <BotaoIcone rotulo={u.ativo ? "Desativar acesso" : "Reativar acesso"} icone={u.ativo ? <UserX size={16} /> : <UserCheck size={16} />} tom={u.ativo ? "perigo" : "sucesso"} desabilitado={salvando} aoClicar={async () => { if (await confirmar(`${u.ativo ? "Desativar" : "Reativar"} o acesso de ${u.nome}?`)) void executar(() => atualizarUsuario(u.id, { ativo: !u.ativo }, token).then(() => undefined)); }} />}
                <BotaoIcone rotulo="Gerar nova senha temporária" icone={<KeyRound size={16} />} desabilitado={salvando} aoClicar={async () => { if (await confirmar(`Gerar uma nova senha temporária para ${u.nome}? A senha atual deixa de valer.`)) void executar(async () => { const r = await gerarNovaSenhaTemporaria(u.id, token); mostrarSenha(u.email, r.senhaTemporaria); }); }} />
              </div></td>
            </tr>;
          })}
          {carregando && <tr><td colSpan={5} className="p-8 text-center text-gray-500">Carregando…</td></tr>}
          {!carregando && !usuarios.length && <tr><td colSpan={5} className="p-8 text-center text-gray-500">Nenhum usuário encontrado.</td></tr>}
        </tbody>
      </table></div>
    </section>

    <section aria-label="Perfis de acesso" className="mt-6 rounded-2xl border border-[#eee9e2] bg-white p-5">
      <h2 className="text-lg font-semibold">O que cada perfil acessa</h2>
      <dl className="mt-3 space-y-2 text-sm">{PAPEIS.map((p) => <div key={p.valor}><dt className="inline font-medium">{p.rotulo}: </dt><dd className="inline text-gray-600">{p.descricao}</dd></div>)}</dl>
      <p className="mt-3 text-xs text-gray-500">Desativar um acesso bloqueia a pessoa imediatamente nos dados, sem apagar o histórico. O sistema sempre mantém ao menos um administrador ativo.</p>
    </section>
  </div></div>;
}
