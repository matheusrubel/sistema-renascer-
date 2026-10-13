import { entrar, obterSessao, solicitarAcesso, solicitarRedefinicaoSenha } from "./supabase.js";

const form = document.querySelector("#login-form, #register-form");
const mensagem = document.querySelector("#auth-message");

function mostrarMensagem(texto, erro = true) {
  mensagem.hidden = false;
  mensagem.textContent = texto;
  mensagem.classList.toggle("success", !erro);
}

if (form?.id === "login-form" && obterSessao()?.access_token) {
  window.location.replace("/");
}

document.querySelector("#forgot-password")?.addEventListener("click", async (evento) => {
  evento.preventDefault();
  const email = form?.elements.email.value.trim();
  if (!email) {
    mostrarMensagem("Informe seu e-mail acima para receber o link de redefinição.");
    form?.elements.email.focus();
    return;
  }
  const link = evento.currentTarget;
  link.setAttribute("aria-disabled", "true");
  mensagem.hidden = true;
  try {
    await solicitarRedefinicaoSenha(email);
    mostrarMensagem("Se esse e-mail estiver cadastrado, você receberá um link para criar uma nova senha.", false);
  } catch (erro) {
    mostrarMensagem(erro.message || "Não foi possível solicitar a redefinição. Tente novamente.");
  } finally {
    link.removeAttribute("aria-disabled");
  }
});

if (form?.id === "login-form" && new URLSearchParams(window.location.search).get("senha") === "alterada") {
  mostrarMensagem("Senha alterada. Entre com a nova senha.", false);
}

form?.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const botao = form.querySelector("button[type='submit']");
  botao.disabled = true;
  mensagem.hidden = true;
  try {
    const dados = new FormData(form);
    if (form.id === "register-form") {
      await solicitarAcesso({ nome: dados.get("name"), email: dados.get("email"), area: dados.get("role") });
      form.reset();
      mostrarMensagem("Solicitação enviada. A administração do Instituto entrará em contato após analisar o pedido.", false);
      return;
    }
    await entrar(dados.get("email"), dados.get("password"));
    window.location.replace("/");
  } catch (erro) {
    mostrarMensagem(erro.message || "Não foi possível concluir a solicitação.");
  } finally {
    botao.disabled = false;
  }
});
