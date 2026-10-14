"use client";

import { FormEvent, useEffect, useState } from "react";
import { atualizarSenha, obterSessao, sair } from "../../src/supabase";

export default function PasswordForm() {
  const [token, setToken] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(()=>{const params=new URLSearchParams(window.location.hash.slice(1));const recoveryToken=params.get("access_token");setRecovery(params.get("type")==="recovery"&&Boolean(recoveryToken));setToken(recoveryToken||obterSessao()?.access_token||"");if(window.location.hash)history.replaceState(null,document.title,window.location.pathname);},[]);
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();const data=new FormData(event.currentTarget);const password=String(data.get("password"));if(password!==data.get("confirmPassword")){setMessage("As senhas não coincidem.");return;}setBusy(true);setMessage("");try{await atualizarSenha(password,token);if(recovery){await sair();window.location.replace("/login?senha=alterada");return;}setSuccess(true);setMessage("Senha alterada com sucesso.");}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
  return <main className="flex min-h-screen items-center justify-center bg-[#f6f4f0] px-5"><form onSubmit={submit} className="w-full max-w-md rounded-3xl bg-white p-9 shadow-sm"><h1 className="text-3xl font-semibold">Alterar senha</h1><p className="mt-2 text-sm text-gray-500">Use uma senha com pelo menos oito caracteres.</p><label className="mt-7 block text-sm">Nova senha<input required minLength={8} type="password" name="password" autoComplete="new-password" disabled={!token} className="mt-2 w-full rounded-xl border p-3"/></label><label className="mt-4 block text-sm">Confirmar senha<input required minLength={8} type="password" name="confirmPassword" autoComplete="new-password" disabled={!token} className="mt-2 w-full rounded-xl border p-3"/></label>{message&&<p role="status" className={`mt-4 text-sm ${success?"text-green-700":"text-red-700"}`}>{message}</p>}{!token&&<p className="mt-4 text-sm text-red-700">O link expirou ou não é válido. Solicite uma nova redefinição pela tela de login.</p>}<button disabled={busy||!token} className="mt-6 w-full rounded-xl bg-[#332652] p-3 text-white">{busy?"Salvando…":success?"Senha salva":"Salvar nova senha"}</button><a href="/" className="mt-5 block text-sm text-[#574778]">← Voltar ao sistema</a></form></main>;
}
