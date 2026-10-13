import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pastaBase = path.dirname(fileURLToPath(import.meta.url));
const porta = Number(process.env.PORT) || 4173;
const arquivosPublicos = new Map([
  ["/", "index.html"],
  ["/index.html", "index.html"],
  ["/login.html", "pages/login.html"],
  ["/cadastro-usuario.html", "pages/cadastro-usuario.html"],
  ["/alterar-senha.html", "pages/alterar-senha.html"],
  ["/em-desenvolvimento.html", "pages/em-desenvolvimento.html"],
  ["/assets/logo-renascer.png", "assets/logo-renascer.png"],
  ["/favicon.png", "assets/logo-renascer.png"],
  ["/src/app.js", "src/app.js"],
  ["/src/controls.js", "src/controls.js"],
  ["/src/styles.css", "src/styles.css"],
  ["/src/auth.css", "src/auth.css"],
  ["/src/auth.js", "src/auth.js"],
  ["/src/password.js", "src/password.js"],
  ["/src/supabase.js", "src/supabase.js"],
]);

async function carregarConfiguracaoSupabase() {
  let conteudo = "";
  try {
    conteudo = await readFile(path.resolve(pastaBase, "../backend/.env"), "utf8");
  } catch (erro) {
    if (erro.code !== "ENOENT") throw erro;
  }
  for (const linha of conteudo.split(/\r?\n/)) {
    const correspondencia = linha.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!correspondencia || process.env[correspondencia[1]] !== undefined) continue;
    process.env[correspondencia[1]] = correspondencia[2].replace(/^("|')(.*)\1$/, "$2").replace(/\s+#.*$/, "");
  }
  const url = process.env.SUPABASE_URL?.trim();
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") return null;
  } catch {
    return null;
  }
  return { url: url.replace(/\/$/, ""), anonKey };
}
const configuracaoSupabase = await carregarConfiguracaoSupabase();
const tiposDeArquivo = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".json": "application/json; charset=utf-8",
};

// O servidor só entrega as páginas e imagens da pasta pública do front-end.
const servidor = createServer(async (requisicao, resposta) => {
  if (requisicao.method !== "GET" && requisicao.method !== "HEAD") {
    resposta.writeHead(405, { Allow: "GET, HEAD", "Content-Type": "text/plain; charset=utf-8" }).end("Método não permitido");
    return;
  }

  const endereco = new URL(requisicao.url ?? "/", `http://${requisicao.headers.host ?? "localhost"}`);
  if (endereco.pathname === "/api/config" && (requisicao.method === "GET" || requisicao.method === "HEAD")) {
    if (!configuracaoSupabase) {
      resposta.writeHead(503, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
      resposta.end(JSON.stringify({ error: "Supabase não configurado no backend/.env." }));
      return;
    }
    resposta.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    resposta.end(JSON.stringify(configuracaoSupabase));
    return;
  }
  let caminhoSolicitado;
  try {
    caminhoSolicitado = decodeURIComponent(endereco.pathname === "/" ? "/index.html" : endereco.pathname);
  } catch {
    resposta.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" }).end("Requisição inválida");
    return;
  }

  const caminhoDaImagem = caminhoSolicitado.match(/^\/assets\/images\/([a-z0-9][a-z0-9._-]*\.(?:png|jpe?g|webp|gif|svg|ico))$/i);
  const arquivoPublico = arquivosPublicos.get(caminhoSolicitado) ?? (caminhoDaImagem ? path.join("assets", "images", caminhoDaImagem[1]) : null);
  if (!arquivoPublico) {
    resposta.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Arquivo não encontrado");
    return;
  }

  try {
    const caminhoDoArquivo = path.join(pastaBase, arquivoPublico);
    const conteudo = await readFile(caminhoDoArquivo);
    resposta.writeHead(200, {
      "Content-Type": tiposDeArquivo[path.extname(caminhoDoArquivo)] ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    });
    resposta.end(conteudo);
  } catch {
    resposta.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Arquivo não encontrado");
  }
});

servidor.on("error", (erro) => {
  if (erro.code === "EADDRINUSE") console.error(`A porta ${porta} já está em uso. Encerre a outra instância e tente novamente.`);
  else console.error("Não foi possível iniciar o servidor local.", erro);
  process.exitCode = 1;
});

servidor.listen(porta, "127.0.0.1", () => {
  console.log(`Sistema Renascer disponível em http://127.0.0.1:${porta}`);
});
