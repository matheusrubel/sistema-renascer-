"use client";

import { FormEvent, useState } from "react";
import { entrar, solicitarAcesso, solicitarRedefinicaoSenha } from "../src/supabase";

export function AuthPanel({ onLogin, initialMode = "login" }: { onLogin: () => void; initialMode?: "login" | "request" }) {
  const [mode, setMode] = useState<"login" | "request" | "recover">(initialMode);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(""); setSuccess(false);
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      if (mode === "login") { await entrar(String(data.get("email")), String(data.get("password"))); onLogin(); }
      else if (mode === "request") { await solicitarAcesso({ nome: String(data.get("name")), email: String(data.get("email")), area: String(data.get("role")) }); form.reset(); setMessage("Solicitação enviada. A administração do Instituto entrará em contato após analisar o pedido."); setSuccess(true); }
      else { await solicitarRedefinicaoSenha(String(data.get("email"))); setMessage("Se esse e-mail estiver cadastrado, você receberá um link para criar uma nova senha."); setSuccess(true); }
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }
  return <main className="auth-page auth-login"><div className="auth-shell"><section className="auth-aside"><img className="auth-full-image" src="/assets/images/wallpaper_renascer_1920x1080.png" alt="Crianças sorrindo com a marca do Instituto de Ação Social Renascer centralizada."/></section><section className="auth-panel"><form onSubmit={submit} className="auth-card"><img src="/assets/logo-renascer.png" alt="Instituto Renascer" className="mb-6 h-14 w-14 object-contain"/><span className="auth-eyebrow">INSTITUTO RENASCER</span><h1 className="mt-2 text-3xl font-semibold">{mode === "login" ? "Entrar" : mode === "request" ? "Solicitar acesso" : "Recuperar senha"}</h1><p className="auth-intro">{mode === "login" ? "Informe seu e-mail institucional e sua senha." : mode === "request" ? "A administração aprova e cria os acessos." : "Enviaremos um link se o e-mail estiver cadastrado."}</p>
    {mode === "request" && <><label className="auth-field"><span>Nome completo</span><input required name="name" maxLength={140} autoComplete="name"/></label><label className="auth-field"><span>Área de atuação</span><select required name="role"><option value="">Selecione</option><option>Recepção</option><option>Equipe técnica social</option><option>Administração</option></select></label></>}
    <label className="auth-field"><span>E-mail institucional</span><input required type="email" name="email" autoComplete="username" placeholder="voce@instituto.org.br"/></label>
    {mode === "login" && <label className="auth-field"><span>Senha</span><input required type="password" name="password" autoComplete="current-password" minLength={8}/></label>}
    {mode === "login" && <button type="button" onClick={()=>{setMode("recover");setMessage("");}} className="auth-forgot">Esqueci minha senha</button>}
    {message && <p role="status" aria-live="polite" className={`auth-message ${success ? "success" : ""}`}>{message}</p>}
    <button disabled={busy} className="auth-submit">{busy ? "Aguarde…" : mode === "login" ? "Entrar" : mode === "request" ? "Enviar solicitação" : "Enviar link de recuperação"}</button>
    <div className="auth-switch">{mode !== "login" ? <button type="button" onClick={()=>{setMode("login");setMessage("");}}>← Voltar ao login</button> : <button type="button" onClick={()=>setMode("request")}>Precisa de acesso? Solicitar cadastro</button>}</div></form></section></div></main>;
}
