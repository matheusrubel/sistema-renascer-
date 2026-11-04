import { Body, Controller, Get, Headers, HttpException, Param, Patch, Post } from "@nestjs/common";
import { randomInt } from "node:crypto";
import { obterConfiguracaoSupabase } from "./env";

const PAPEIS = ["admin", "recepcao", "psicologo", "assistente_social"] as const;
type Papel = (typeof PAPEIS)[number];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Configuracao { url: string; anonKey: string; serviceRoleKey: string }
interface Resposta { ok: boolean; status: number; dados: any }

function falhar(status: number, mensagem: string): never {
  throw new HttpException({ message: mensagem }, status);
}

/** Exige a chave administrativa, que existe somente no backend. */
function configuracaoAdmin(): Configuracao {
  let configuracao: ReturnType<typeof obterConfiguracaoSupabase>;
  try { configuracao = obterConfiguracaoSupabase(); }
  catch { return falhar(503, "Supabase não configurado no backend/.env."); }
  if (!configuracao.serviceRoleKey) return falhar(503, "Configure SUPABASE_SERVICE_ROLE_KEY em backend/.env para gerenciar usuários.");
  return { url: configuracao.url.replace(/\/$/, ""), anonKey: configuracao.anonKey, serviceRoleKey: configuracao.serviceRoleKey };
}

/** `chave: "service"` age como administrador; `token` age como o usuário logado. */
async function chamar(config: Configuracao, caminho: string, opcoes: { metodo?: string; chave?: "service"; token?: string; corpo?: unknown; prefer?: string } = {}): Promise<Resposta> {
  const bearer = opcoes.chave === "service" ? config.serviceRoleKey : opcoes.token;
  const resposta = await fetch(`${config.url}${caminho}`, {
    method: opcoes.metodo ?? "GET",
    headers: {
      apikey: opcoes.chave === "service" ? config.serviceRoleKey : config.anonKey,
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      ...(opcoes.corpo !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(opcoes.prefer ? { Prefer: opcoes.prefer } : {}),
    },
    ...(opcoes.corpo !== undefined ? { body: JSON.stringify(opcoes.corpo) } : {}),
  }).catch(() => null);
  if (!resposta) return { ok: false, status: 502, dados: null };
  const texto = await resposta.text();
  let dados: any = null;
  try { dados = texto ? JSON.parse(texto) : null; } catch { dados = null; }
  return { ok: resposta.ok, status: resposta.status, dados };
}

/** Confirma, no Supabase, que quem chamou é um administrador ativo. Devolve o id dele. */
async function exigirAdministrador(config: Configuracao, autorizacao?: string): Promise<string> {
  const token = autorizacao?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return falhar(401, "Entre no sistema para continuar.");
  const usuario = await chamar(config, "/auth/v1/user", { token });
  if (!usuario.ok || !UUID.test(String(usuario.dados?.id))) return falhar(401, "Sessão expirada. Entre novamente.");
  const perfil = await chamar(config, `/rest/v1/perfis_acesso?select=papel,ativo&user_id=eq.${usuario.dados.id}`, { token });
  if (!perfil.ok || perfil.dados?.[0]?.papel !== "admin" || !perfil.dados[0].ativo) return falhar(403, "Somente a coordenação gerencia usuários.");
  return usuario.dados.id as string;
}

function gerarSenhaTemporaria(): string {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const caracteres = Array.from({ length: 12 }, () => alfabeto[randomInt(alfabeto.length)]);
  caracteres.push("!@#$%"[randomInt(5)], String(randomInt(10)));
  return caracteres.join("");
}

function validarNome(valor: unknown): string {
  const nome = String(valor ?? "").trim();
  if (nome.length < 2 || nome.length > 140) return falhar(400, "Informe o nome (2 a 140 caracteres).");
  return nome;
}

function validarPapel(valor: unknown): Papel {
  if (!PAPEIS.includes(valor as Papel)) return falhar(400, "Perfil de acesso inválido.");
  return valor as Papel;
}

function validarId(valor: string): string {
  if (!UUID.test(valor)) return falhar(400, "Usuário inválido.");
  return valor;
}

@Controller("admin/usuarios")
export class UsuariosController {
  @Get()
  async listar(@Headers("authorization") autorizacao?: string) {
    const config = configuracaoAdmin();
    await exigirAdministrador(config, autorizacao);
    const [contas, perfis] = await Promise.all([
      chamar(config, "/auth/v1/admin/users?per_page=200", { chave: "service" }),
      chamar(config, "/rest/v1/perfis_acesso?select=user_id,nome,papel,ativo", { chave: "service" }),
    ]);
    if (!contas.ok || !perfis.ok) return falhar(502, "Não foi possível consultar os usuários.");
    const porId = new Map<string, any>((perfis.dados ?? []).map((perfil: any) => [perfil.user_id, perfil]));
    return ((contas.dados?.users ?? []) as any[])
      .map((conta) => {
        const perfil = porId.get(conta.id);
        return {
          id: conta.id,
          email: conta.email ?? "",
          nome: perfil?.nome ?? conta.user_metadata?.nome ?? "",
          papel: perfil?.papel ?? null,
          ativo: perfil?.ativo ?? false,
          ultimoAcesso: conta.last_sign_in_at ?? null,
          criadoEm: conta.created_at ?? null,
        };
      })
      .sort((a, b) => (a.nome || a.email).localeCompare(b.nome || b.email, "pt-BR"));
  }

  /** Cria a conta de login com senha temporária e o perfil de acesso. */
  @Post()
  async criar(@Headers("authorization") autorizacao: string | undefined, @Body() corpo: { nome?: string; email?: string; papel?: string }) {
    const config = configuracaoAdmin();
    const administrador = await exigirAdministrador(config, autorizacao);
    const nome = validarNome(corpo?.nome);
    const email = String(corpo?.email ?? "").trim().toLowerCase();
    if (!EMAIL.test(email) || email.length > 180) return falhar(400, "Informe um e-mail válido.");
    const papel = validarPapel(corpo?.papel);

    const senha = gerarSenhaTemporaria();
    const conta = await chamar(config, "/auth/v1/admin/users", {
      metodo: "POST", chave: "service", corpo: { email, password: senha, email_confirm: true, user_metadata: { nome } },
    });
    if (!conta.ok) {
      if (conta.status === 422 || /already|registered|exists/i.test(JSON.stringify(conta.dados))) {
        return falhar(409, "Já existe uma conta com este e-mail. Encontre-a na lista e defina o perfil dela.");
      }
      return falhar(502, "Não foi possível criar a conta de login.");
    }
    const perfil = await chamar(config, "/rest/v1/perfis_acesso", {
      metodo: "POST", chave: "service", prefer: "return=minimal",
      corpo: { user_id: conta.dados.id, nome, papel, ativo: true, atualizado_por: administrador },
    });
    if (!perfil.ok) {
      await chamar(config, `/auth/v1/admin/users/${conta.dados.id}`, { metodo: "DELETE", chave: "service" });
      return falhar(502, "Não foi possível criar o perfil de acesso. Nada foi salvo.");
    }
    return { id: conta.dados.id, email, senhaTemporaria: senha };
  }

  /** Altera nome, perfil ou situação; cria o perfil se a conta ainda não tiver um. */
  @Patch(":id")
  async atualizar(@Headers("authorization") autorizacao: string | undefined, @Param("id") idBruto: string, @Body() corpo: { nome?: string; papel?: string; ativo?: boolean }) {
    const config = configuracaoAdmin();
    const administrador = await exigirAdministrador(config, autorizacao);
    const id = validarId(idBruto);
    const alteracoes: Record<string, unknown> = {};
    if (corpo?.nome !== undefined) alteracoes.nome = validarNome(corpo.nome);
    if (corpo?.papel !== undefined) alteracoes.papel = validarPapel(corpo.papel);
    if (corpo?.ativo !== undefined) {
      if (typeof corpo.ativo !== "boolean") return falhar(400, "Situação inválida.");
      alteracoes.ativo = corpo.ativo;
    }
    if (!Object.keys(alteracoes).length) return falhar(400, "Nada para alterar.");
    if (id === administrador && ((alteracoes.papel && alteracoes.papel !== "admin") || alteracoes.ativo === false)) {
      return falhar(400, "Você não pode retirar o próprio acesso de administrador. Peça a outro administrador.");
    }

    const existente = await chamar(config, `/rest/v1/perfis_acesso?select=user_id&user_id=eq.${id}`, { chave: "service" });
    if (!existente.ok) return falhar(502, "Não foi possível consultar o perfil.");
    const registro = { ...alteracoes, atualizado_por: administrador, atualizado_em: new Date().toISOString() };
    let resultado: Resposta;
    if (existente.dados?.length) {
      resultado = await chamar(config, `/rest/v1/perfis_acesso?user_id=eq.${id}`, { metodo: "PATCH", chave: "service", prefer: "return=minimal", corpo: registro });
    } else {
      if (!alteracoes.nome || !alteracoes.papel) return falhar(400, "Para criar o perfil, informe nome e perfil de acesso.");
      resultado = await chamar(config, "/rest/v1/perfis_acesso", { metodo: "POST", chave: "service", prefer: "return=minimal", corpo: { user_id: id, ativo: true, ...registro } });
    }
    if (!resultado.ok) return falhar(resultado.status === 400 ? 409 : 502, resultado.dados?.message || "Não foi possível salvar a alteração.");
    return { ok: true };
  }

  /** Define uma nova senha temporária (mostrada uma única vez ao administrador). */
  @Post(":id/senha")
  async novaSenha(@Headers("authorization") autorizacao: string | undefined, @Param("id") idBruto: string) {
    const config = configuracaoAdmin();
    await exigirAdministrador(config, autorizacao);
    const id = validarId(idBruto);
    const senha = gerarSenhaTemporaria();
    const resultado = await chamar(config, `/auth/v1/admin/users/${id}`, { metodo: "PUT", chave: "service", corpo: { password: senha } });
    if (!resultado.ok) return falhar(502, "Não foi possível definir a nova senha.");
    return { senhaTemporaria: senha };
  }
}
