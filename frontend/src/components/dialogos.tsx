"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

export interface OpcoesConfirmacao { titulo?: string; mensagem: string; confirmar?: string; cancelar?: string; perigo?: boolean }
export interface OpcoesPergunta { titulo?: string; mensagem: string; rotulo?: string; valorInicial?: string; confirmar?: string; cancelar?: string; obrigatorio?: boolean }

type Pedido =
  | { tipo: "confirmar"; opcoes: OpcoesConfirmacao; resolver: (valor: boolean) => void }
  | { tipo: "perguntar"; opcoes: OpcoesPergunta; resolver: (valor: string | null) => void };

interface Dialogos {
  /** Substitui window.confirm: resolve true ao confirmar e false ao cancelar. */
  confirmar: (opcoes: OpcoesConfirmacao | string) => Promise<boolean>;
  /** Substitui window.prompt: resolve o texto digitado ou null ao cancelar. */
  perguntar: (opcoes: OpcoesPergunta) => Promise<string | null>;
}

const Contexto = createContext<Dialogos | null>(null);

export function useDialogos(): Dialogos {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error("useDialogos deve ser usado dentro de <DialogosProvider>.");
  return contexto;
}

/** Diálogos do sistema (no lugar de confirm e prompt do navegador). */
export function DialogosProvider({ children }: { children: React.ReactNode }) {
  const [fila, setFila] = useState<Pedido[]>([]);
  const atual = fila[0];

  const confirmar = useCallback((opcoes: OpcoesConfirmacao | string) => new Promise<boolean>((resolver) => {
    setFila((anterior) => [...anterior, { tipo: "confirmar", opcoes: typeof opcoes === "string" ? { mensagem: opcoes } : opcoes, resolver }]);
  }), []);
  const perguntar = useCallback((opcoes: OpcoesPergunta) => new Promise<string | null>((resolver) => {
    setFila((anterior) => [...anterior, { tipo: "perguntar", opcoes, resolver }]);
  }), []);

  const encerrar = useCallback(() => setFila((anterior) => anterior.slice(1)), []);

  return (
    <Contexto.Provider value={{ confirmar, perguntar }}>
      {children}
      {atual && <Caixa key={fila.length + atual.opcoes.mensagem} pedido={atual} aoEncerrar={encerrar} />}
    </Contexto.Provider>
  );
}

function Caixa({ pedido, aoEncerrar }: { pedido: Pedido; aoEncerrar: () => void }) {
  const [texto, setTexto] = useState(pedido.tipo === "perguntar" ? pedido.opcoes.valorInicial ?? "" : "");
  const caixa = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const anterior = useRef<HTMLElement | null>(null);
  const perigo = pedido.tipo === "confirmar" && pedido.opcoes.perigo;
  const invalido = pedido.tipo === "perguntar" && Boolean(pedido.opcoes.obrigatorio) && !texto.trim();

  const cancelar = () => { if (pedido.tipo === "confirmar") pedido.resolver(false); else pedido.resolver(null); aoEncerrar(); };
  const confirmar = () => {
    if (invalido) return;
    if (pedido.tipo === "confirmar") pedido.resolver(true); else pedido.resolver(texto);
    aoEncerrar();
  };

  useEffect(() => {
    anterior.current = document.activeElement as HTMLElement | null;
    (campo.current ?? caixa.current?.querySelector<HTMLButtonElement>("[data-confirmar]"))?.focus();
    return () => anterior.current?.focus?.();
  }, []);

  function aoTeclar(evento: React.KeyboardEvent) {
    if (evento.key === "Escape") { evento.preventDefault(); cancelar(); }
    else if (evento.key === "Enter" && !(evento.target instanceof HTMLButtonElement)) { evento.preventDefault(); confirmar(); }
    else if (evento.key === "Tab") {
      // mantém o foco dentro do diálogo
      const itens = Array.from(caixa.current?.querySelectorAll<HTMLElement>("input, button:not(:disabled)") ?? []);
      if (!itens.length) return;
      const primeiro = itens[0], ultimo = itens[itens.length - 1];
      if (evento.shiftKey && document.activeElement === primeiro) { evento.preventDefault(); ultimo.focus(); }
      else if (!evento.shiftKey && document.activeElement === ultimo) { evento.preventDefault(); primeiro.focus(); }
    }
  }

  const { opcoes } = pedido;
  return (
    <div className="dlg-fundo" onMouseDown={(evento) => { if (evento.target === evento.currentTarget) cancelar(); }}>
      <div ref={caixa} role="dialog" aria-modal="true" aria-labelledby="dlg-titulo" aria-describedby="dlg-mensagem" className="dlg" onKeyDown={aoTeclar}>
        <h2 id="dlg-titulo">{opcoes.titulo ?? (pedido.tipo === "confirmar" ? "Confirmar ação" : "Informe o valor")}</h2>
        <p id="dlg-mensagem">{opcoes.mensagem}</p>
        {pedido.tipo === "perguntar" && <input ref={campo} value={texto} onChange={(evento) => setTexto(evento.target.value)} aria-label={pedido.opcoes.rotulo ?? "Valor"} placeholder={pedido.opcoes.rotulo} />}
        <div className="dlg-acoes">
          <button type="button" className="btn btn-secundario" onClick={cancelar}>{opcoes.cancelar ?? "Cancelar"}</button>
          <button type="button" data-confirmar className={`btn ${perigo ? "btn-perigo" : "btn-primario"}`} onClick={confirmar} disabled={invalido}>{opcoes.confirmar ?? "Confirmar"}</button>
        </div>
      </div>
    </div>
  );
}
