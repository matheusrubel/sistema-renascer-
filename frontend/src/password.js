import { atualizarSenha, obterSessao, sair } from "./supabase.js";

const form = document.querySelector("#password-form");
const mensagem = document.querySelector("#auth-message");
const parametros = new URLSearchParams(window.location.hash.slice(1));
const tokenRecuperacao = parametros.get("access_token");
const modoRecuperacao = parametros.get("type") === "recovery" && Boolean(tokenRecuperacao);
const token = tokenRecuperacao || obterSessao()?.access_token;

function mostrarMensagem(texto, erro = true) {
  mensagem.hidden = false;
  mensagem.textContent = texto;
  mensagem.classList.toggle("success", !erro);
}

if (window.location.hash) history.replaceState(null, document.title, window.location.pathname);

if (!token) {
  form.querySelector("button[type='submit']").disabled = true;
  mostrarMensagem("O link expirou ou não é válido. Solicite uma nova redefinição pela tela de login.");
}

form.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  if (!token) return;
  const senha = form.elements.password.value;
  if (senha !== form.elements.confirmPassword.value) {
    mostrarMensagem("As senhas não coincidem.");
    form.elements.confirmPassword.focus();
    return;
  }

  const botao = form.querySelector("button[type='submit']");
  botao.disabled = true;
  mensagem.hidden = true;
  try {
    await atualizarSenha(senha, token);
    if (modoRecuperacao) {
      await sair();
      window.location.replace("/login.html?senha=alterada");
      return;
    }
    mostrarMensagem("Senha alterada com sucesso.", false);
    botao.textContent = "Senha salva";
    const voltar = document.createElement("a");
    voltar.className = "auth-back";
    voltar.href = "/";
    voltar.textContent = "← Voltar ao sistema";
    form.append(voltar);
  } catch (erro) {
    mostrarMensagem(erro.message || "Não foi possível alterar a senha. Tente novamente.");
  } finally {
    botao.disabled = false;
  }
});
