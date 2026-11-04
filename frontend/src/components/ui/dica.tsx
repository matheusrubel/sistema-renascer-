"use client";

import type { ReactNode } from "react";

/** Dica (tooltip) própria: aparece ao passar o mouse ou receber foco. Alinhada à direita para não ultrapassar bordas. */
export function Dica({ texto, children, className = "" }: { texto: string; children: ReactNode; className?: string }) {
  return (
    <span className={`group relative inline-flex ${className}`}>
      {children}
      <span role="tooltip" className="pointer-events-none absolute bottom-full right-0 z-50 mb-1.5 whitespace-nowrap rounded-md bg-[#2f2450] px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg ring-1 ring-white/10 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
        {texto}
      </span>
    </span>
  );
}
