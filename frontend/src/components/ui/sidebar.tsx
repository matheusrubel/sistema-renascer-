"use client";

import Link from "next/link";
import React, { createContext, useContext, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Largura da barra recolhida; as páginas usam a mesma medida como margem do conteúdo. */
export const LARGURA_RECOLHIDA = 64;
export const LARGURA_EXPANDIDA = 232;

interface SidebarContextProps {
  open: boolean;
  setOpen: (aberto: boolean) => void;
  animate: boolean;
  /** Menu fixado expandido: continua aberto sem precisar do mouse. */
  fixa: boolean;
  alternarFixa: () => void;
}

const CHAVE_FIXA = "renascer.sidebar.fixa";
const lerFixa = () => { try { return typeof window !== "undefined" && window.localStorage.getItem(CHAVE_FIXA) === "1"; } catch { return false; } };
/** O atributo no <html> deixa o CSS mover o painel junto com a barra, na mesma animação. */
const aplicarAberta = (aberta: boolean) => {
  if (typeof document === "undefined") return;
  if (aberta) document.documentElement.dataset.sidebar = "aberta"; else delete document.documentElement.dataset.sidebar;
};

const SidebarContext = createContext<SidebarContextProps | undefined>(undefined);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) throw new Error("useSidebar deve ser usado dentro de <Sidebar>.");
  return context;
};

export const Sidebar = ({ children, animate = true }: { children: React.ReactNode; animate?: boolean }) => {
  const [hover, setHover] = useState(false);
  const [fixa, setFixa] = useState(lerFixa);
  const aberta = fixa || hover;
  useEffect(() => { aplicarAberta(aberta); }, [aberta]);
  const alternarFixa = () => {
    const proxima = !fixa;
    setFixa(proxima);
    try { window.localStorage.setItem(CHAVE_FIXA, proxima ? "1" : "0"); } catch { /* sem armazenamento: vale só nesta página */ }
  };
  return <SidebarContext.Provider value={{ open: aberta, setOpen: setHover, animate, fixa, alternarFixa }}>{children}</SidebarContext.Provider>;
};

/** Desktop: barra fixa que se expande ao passar o mouse (ou receber foco) sem empurrar o conteúdo. Celular: gaveta. */
export const SidebarBody = ({ children, topoMobile, className }: { children: React.ReactNode; topoMobile?: React.ReactNode; className?: string }) => (
  <>
    <DesktopSidebar className={className}>{children}</DesktopSidebar>
    <MobileSidebar topo={topoMobile} className={className}>{children}</MobileSidebar>
  </>
);

export const DesktopSidebar = ({ className, children }: { className?: string; children: React.ReactNode }) => {
  const { open, setOpen, animate } = useSidebar();
  return (
    <aside
      aria-label="Navegação principal"
      className={cn(
        "fixed inset-y-0 left-0 z-30 hidden flex-col bg-[#2f2450] px-3 py-5 text-white transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none md:flex print:hidden",
        className,
      )}
      style={{ width: animate && !open ? LARGURA_RECOLHIDA : LARGURA_EXPANDIDA }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={(evento) => { if (!evento.currentTarget.contains(evento.relatedTarget as Node | null)) setOpen(false); }}
    >
      {children}
    </aside>
  );
};

export const MobileSidebar = ({ className, children, topo }: { className?: string; children: React.ReactNode; topo?: React.ReactNode }) => {
  const [aberta, setAberta] = useState(false);
  return (
    <div className="sticky top-0 z-30 flex h-14 items-center justify-between bg-[#2f2450] px-4 text-white md:hidden print:hidden">
      <div className="flex items-center gap-3">{topo}</div>
      <button type="button" aria-label="Abrir menu" aria-expanded={aberta} onClick={() => setAberta(true)} className="grid h-10 w-10 place-items-center rounded-xl hover:bg-white/10"><Menu size={22} /></button>
      <AnimatePresence>
        {aberta && (
          <motion.div
            role="dialog" aria-modal="true" aria-label="Menu"
            initial={{ x: "-100%", opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: "-100%", opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            onClick={(evento) => { if ((evento.target as HTMLElement).closest("a")) setAberta(false); }}
            className={cn("fixed inset-0 z-100 flex flex-col justify-between bg-[#2f2450] p-6", className)}
          >
            <button type="button" aria-label="Fechar menu" onClick={() => setAberta(false)} className="absolute right-5 top-5 grid h-10 w-10 place-items-center rounded-xl hover:bg-white/10"><X size={22} /></button>
            <SidebarContext.Provider value={{ open: true, setOpen: () => {}, animate: false, fixa: false, alternarFixa: () => {} }}>{children}</SidebarContext.Provider>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/** Texto que aparece quando a barra está expandida. */
export const SidebarLabel = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  const { open, animate } = useSidebar();
  const visivel = !animate || open;
  return (
    <motion.span
      initial={false}
      animate={{ opacity: visivel ? 1 : 0, x: visivel ? 0 : -6 }}
      transition={{ duration: 0.2, delay: visivel ? 0.1 : 0 }}
      className={cn("min-w-0 flex-1 overflow-hidden whitespace-nowrap", className)}
      aria-hidden={!visivel}
    >
      {children}
    </motion.span>
  );
};

const estiloItem = (ativo: boolean) =>
  cn(
    "group/item relative flex h-10 w-full items-center gap-3 rounded-xl px-2.5 text-left text-sm font-medium transition-colors",
    ativo ? "bg-white/14 text-white" : "text-white/70 hover:bg-white/8 hover:text-white",
  );

const BarraAtiva = () => <span aria-hidden="true" className="absolute -left-3 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-[#f5d66c]" />;

export interface LinkSidebar { label: string; href: string; icon: React.ReactNode }

export const SidebarLink = ({ link, ativo = false, className }: { link: LinkSidebar; ativo?: boolean; className?: string }) => {
  const { open, animate } = useSidebar();
  return (
    <Link href={link.href} aria-current={ativo ? "page" : undefined} className={cn(estiloItem(ativo), className)}>
      {ativo && <BarraAtiva />}
      <span className="shrink-0">{link.icon}</span>
      <SidebarLabel>{link.label}</SidebarLabel>
    </Link>
  );
};

/** Item de ação (botão) com o mesmo visual dos links. */
export const SidebarAction = ({ label, icon, onClick, ativo = false, className }: { label: string; icon: React.ReactNode; onClick: () => void; ativo?: boolean; className?: string }) => {
  const { open, animate } = useSidebar();
  return (
    <button type="button" onClick={onClick} aria-pressed={ativo || undefined} className={cn(estiloItem(false), ativo && "text-[#f5d66c] hover:text-[#f5d66c]", className)}>
      <span className="shrink-0">{icon}</span>
      <SidebarLabel>{label}</SidebarLabel>
    </button>
  );
};
