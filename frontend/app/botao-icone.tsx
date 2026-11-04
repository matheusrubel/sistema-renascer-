"use client";

import type { ReactNode } from "react";
import { Dica } from "@/components/ui/dica";

const TONS = {
  padrao: "text-[#574778] hover:bg-[#f0ecf7] hover:text-[#332652]",
  perigo: "text-[#8f3b3b] hover:bg-[#fbebeb] hover:text-[#a12a2a]",
  sucesso: "text-[#2b6038] hover:bg-[#e5f4e4] hover:text-[#1f4a2a]",
} as const;

/** Botão só com ícone e dica (tooltip) ao passar o mouse ou receber foco pelo teclado. */
export function BotaoIcone({ rotulo, icone, aoClicar, tom = "padrao", desabilitado = false }: {
  rotulo: string; icone: ReactNode; aoClicar: () => void; tom?: keyof typeof TONS; desabilitado?: boolean;
}) {
  return (
    <Dica texto={rotulo}>
      <button
        type="button"
        onClick={aoClicar}
        disabled={desabilitado}
        aria-label={rotulo}
        className={`grid h-8 w-8 place-items-center rounded-lg transition-colors disabled:opacity-40 ${TONS[tom]}`}
      >
        {icone}
      </button>
    </Dica>
  );
}
