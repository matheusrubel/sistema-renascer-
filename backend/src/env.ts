import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const caminhoEnv = fileURLToPath(new URL("../.env", import.meta.url));

/** Carrega backend/.env sem substituir variáveis definidas pelo ambiente de execução. */
export async function carregarVariaveisBackend(): Promise<void> {
  let conteudo: string;
  try {
    conteudo = await readFile(caminhoEnv, "utf8");
  } catch (erro) {
    if ((erro as NodeJS.ErrnoException).code === "ENOENT") return;
    throw erro;
  }

  for (const linha of conteudo.split(/\r?\n/)) {
    const correspondencia = linha.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!correspondencia) continue;
    const [, chave, valorBruto] = correspondencia;
    if (process.env[chave] !== undefined) continue;
    const valor = valorBruto.replace(/^(["'])(.*)\1$/, "$2").replace(/\s+#.*$/, "");
    process.env[chave] = valor;
  }
}

export interface ConfiguracaoSupabase {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
}

/** Valida as variáveis do Supabase sem incluir valores secretos nas mensagens de erro. */
export function obterConfiguracaoSupabase(): ConfiguracaoSupabase {
  const url = process.env.SUPABASE_URL?.trim();
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !anonKey) {
    throw new Error("Configure SUPABASE_URL e SUPABASE_ANON_KEY em backend/.env.");
  }
  try {
    new URL(url);
  } catch {
    throw new Error("SUPABASE_URL precisa ser uma URL válida.");
  }
  return { url, anonKey, ...(serviceRoleKey ? { serviceRoleKey } : {}) };
}
