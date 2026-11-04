"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Sidebar, type ItemMenu } from "./sidebar";
import { obterSessao } from "../src/supabase";

const ITEM_DA_ROTA: Record<string, ItemMenu> = {
  "/": "cadastros",
  "/relatorios": "relatorios",
  "/atendimentos": "atendimentos",
  "/usuarios": "usuarios",
};

function assinarSessao(aoMudar: () => void) {
  window.addEventListener("renascer:sessao", aoMudar);
  return () => window.removeEventListener("renascer:sessao", aoMudar);
}

/**
 * Estrutura das páginas internas (barra lateral + painel).
 * Fica montada entre as páginas: ao navegar, só o conteúdo do painel troca, sem piscar.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const caminho = usePathname();
  // No servidor e durante a hidratação o valor é "falso"; no navegador passa a refletir a sessão na hora.
  const logada = useSyncExternalStore(assinarSessao, () => Boolean(obterSessao()?.access_token), () => false);
  const painel = useRef<HTMLDivElement>(null);
  const item = ITEM_DA_ROTA[caminho];

  // Como o painel rola por dentro, cada página nova começa no topo.
  useEffect(() => { painel.current?.scrollTo({ top: 0 }); }, [caminho]);

  // Guarda a última página interna para a tela de alterar senha saber para onde voltar.
  useEffect(() => { if (item && logada) { try { sessionStorage.setItem("renascer.ultima.rota", caminho); } catch { /* sem armazenamento */ } } }, [caminho, item, logada]);

  if (!item || !logada) return <>{children}</>;

  return (
    <main className="min-h-screen bg-[#2f2450] text-[#302942] md:h-screen md:overflow-hidden print:h-auto print:overflow-visible print:bg-white">
      <Sidebar ativo={item} />
      <div ref={painel} className="painel-principal min-h-screen bg-[#f7f5f2] md:h-screen md:overflow-y-auto print:h-auto print:overflow-visible">
        <div key={caminho} className="animar-pagina">{children}</div>
      </div>
    </main>
  );
}
