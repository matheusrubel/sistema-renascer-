"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Dica } from "@/components/ui/dica";
import { BarChart3, ChevronUp, HeartHandshake, KeyRound, LogOut, Pin, PinOff, UserCog, Users } from "lucide-react";
import { Sidebar as BarraLateral, SidebarBody, SidebarLabel, SidebarLink, useSidebar } from "@/components/ui/sidebar";
import { obterSessao, sair } from "../src/supabase";

export type ItemMenu = "cadastros" | "relatorios" | "atendimentos" | "usuarios";

const ROTULO_PAPEL: Record<string, string> = {
  admin: "Coordenação", recepcao: "Recepção", psicologo: "Psicologia", assistente_social: "Serviço social",
};

const ICONE = "h-5 w-5";
const ITENS: { id: ItemMenu; label: string; href: string; icon: React.ReactNode; somenteAdmin?: boolean }[] = [
  { id: "cadastros", label: "Cadastros", href: "/", icon: <Users className={ICONE} /> },
  { id: "relatorios", label: "Relatórios cadastrais", href: "/relatorios", icon: <BarChart3 className={ICONE} /> },
  { id: "atendimentos", label: "Atendimentos", href: "/atendimentos", icon: <HeartHandshake className={ICONE} /> },
  { id: "usuarios", label: "Usuários e acessos", href: "/usuarios", icon: <UserCog className={ICONE} />, somenteAdmin: true },
];

function Marca({ comNome = true }: { comNome?: boolean }) {
  return <div className="flex min-w-0 items-center gap-3">
    <img src="/assets/logo-renascer.png" alt="Instituto Renascer" className="h-10 w-10 shrink-0 rounded-xl bg-white object-contain p-1 shadow-md" />
    {comNome && <SidebarLabel><span className="block text-[15px] font-semibold leading-tight">Instituto Renascer</span><span className="block text-xs font-normal text-white/55">Gestão social</span></SidebarLabel>}
  </div>;
}

function Conteudo({ ativo, nome, papel, aoSair }: { ativo: ItemMenu; nome: string; papel: string; aoSair: () => void }) {
  const { open, animate, fixa, alternarFixa } = useSidebar();
  const expandida = !animate || open;
  const [menu, setMenu] = useState(false);
  // O menu do perfil fecha junto com a barra recolhida.
  useEffect(() => { if (!open) setMenu(false); }, [open]);
  const itens = ITENS.filter((item) => !item.somenteAdmin || papel === "admin");
  return <>
    <div className="flex min-h-0 flex-1 flex-col">
      <Marca />
      <nav className="mt-12 flex flex-col gap-1.5">
        {itens.map((item) => <SidebarLink key={item.id} ativo={item.id === ativo} link={{ label: item.label, href: item.href, icon: item.icon }} />)}
      </nav>
    </div>

    <div className="mt-4 flex flex-col gap-1 border-t border-white/10 pt-4" onKeyDown={(evento) => { if (evento.key === "Escape") setMenu(false); }}>
      <div className="relative flex items-center gap-1">
      <button type="button" aria-expanded={menu} aria-haspopup="menu" onClick={() => setMenu((aberto) => !aberto)} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-0.5 py-2 text-left transition-colors hover:bg-white/8">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f5d66c] text-sm font-bold text-[#332652] ring-2 ring-white/20">{nome.slice(0, 1).toUpperCase()}</span>
        <SidebarLabel><strong className="block truncate text-sm font-semibold">{nome}</strong><small className="block truncate text-xs text-white/55">{ROTULO_PAPEL[papel] || "Equipe"}</small></SidebarLabel>
        {expandida && <ChevronUp aria-hidden="true" className={`h-4 w-4 shrink-0 text-white/60 transition-transform ${menu ? "" : "rotate-180"}`} />}
      </button>
      {expandida && animate && <Dica texto={fixa ? "Soltar menu" : "Fixar menu aberto"}><button type="button" onClick={alternarFixa} aria-pressed={fixa} aria-label={fixa ? "Soltar menu" : "Fixar menu aberto"} className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors hover:bg-white/10 ${fixa ? "text-[#f5d66c]" : "text-white/60 hover:text-white"}`}>{fixa ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}</button></Dica>}
      {menu && <div role="menu" className="absolute bottom-full left-0 z-40 mb-2 w-52 rounded-xl border border-white/10 bg-[#2a2045] p-1.5 shadow-2xl">
        <Link role="menuitem" href="/alterar-senha" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/85 hover:bg-white/10 hover:text-white"><KeyRound className="h-4 w-4" />Alterar senha</Link>
        <button role="menuitem" type="button" onClick={aoSair} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-white/85 hover:bg-white/10 hover:text-white"><LogOut className="h-4 w-4" />Sair</button>
      </div>}
      </div>
    </div>
  </>;
}

/** Barra lateral única do sistema: fixa em todas as páginas internas, recolhida em ícones e expandida ao passar o mouse. */
export function Sidebar({ ativo }: { ativo: ItemMenu }) {
  const [sessao, setSessao] = useState<any>(null);
  useEffect(() => { setSessao(obterSessao()); }, []);

  const papel: string = sessao?.perfil?.papel || "";
  const nome: string = sessao?.perfil?.nome || "Equipe Renascer";

  async function aoSair() {
    await sair();
    window.location.replace("/");
  }

  return <BarraLateral>
    <SidebarBody topoMobile={<Marca comNome={false} />}>
      <Conteudo ativo={ativo} nome={nome} papel={papel} aoSair={() => void aoSair()} />
    </SidebarBody>
  </BarraLateral>;
}
