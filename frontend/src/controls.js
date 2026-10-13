const nomesDosMeses = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const diasDaSemana = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
let menuAberto = null;

const iconeCalendario = '<svg aria-hidden="true" viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="16" rx="2.5"></rect><path d="M7.5 3.5v3M16.5 3.5v3M3.5 9.5h17M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01"></path></svg>';
const iconeSeta = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"></path></svg>';

// Esconde o campo original, mas mantém seu valor no envio do formulário.
function adicionarRotuloDoCampo(campo, botao) {
  let grupoCampo = campo.closest(".field");
  if (grupoCampo?.tagName === "LABEL") {
    const bloco = document.createElement("div");
    for (const atributo of grupoCampo.attributes) bloco.setAttribute(atributo.name, atributo.value);
    while (grupoCampo.firstChild) bloco.append(grupoCampo.firstChild);
    grupoCampo.replaceWith(bloco);
    grupoCampo = bloco;
  }
  const rotuloAntigo = grupoCampo?.querySelector(":scope > span:first-child");
  if (!grupoCampo || !rotuloAntigo) return;
  const rotulo = document.createElement("label");
  rotulo.className = "field-label";
  rotulo.id = `${botao.id}-label`;
  rotulo.htmlFor = botao.id;
  while (rotuloAntigo.firstChild) rotulo.append(rotuloAntigo.firstChild);
  rotuloAntigo.replaceWith(rotulo);
  botao.setAttribute("aria-labelledby", rotulo.id);
}

function ocultarCampoOriginal(campo) {
  campo.classList.add("custom-control-source");
  campo.tabIndex = -1;
  campo.setAttribute("aria-hidden", "true");
}

function fecharMenu(devolverFoco = false) {
  if (!menuAberto) return;
  const botao = menuAberto._botao;
  menuAberto.remove();
  menuAberto = null;
  botao?.setAttribute("aria-expanded", "false");
  if (devolverFoco) botao?.focus();
}

function criarMenuFlutuante(nomeClasse, botao) {
  fecharMenu();
  const menu = document.createElement("div");
  menu.className = `control-popover ${nomeClasse}`;
  menu._botao = botao;
  document.body.append(menu);
  menuAberto = menu;
  return menu;
}

function posicionarMenu(menu, botao) {
  const retangulo = botao.getBoundingClientRect();
  const largura = menu.classList.contains("select-popover") ? retangulo.width : Math.max(retangulo.width, menu.offsetWidth);
  const esquerda = Math.min(Math.max(8, retangulo.left), window.innerWidth - largura - 8);
  const espacoAbaixo = window.innerHeight - retangulo.bottom;
  const topo = espacoAbaixo < menu.offsetHeight + 12 && retangulo.top > menu.offsetHeight + 12
    ? retangulo.top - menu.offsetHeight - 6
    : retangulo.bottom + 6;
  menu.style.left = `${esquerda}px`;
  menu.style.top = `${Math.max(8, topo)}px`;
  menu.style.width = `${Math.min(largura, window.innerWidth - 16)}px`;
}

function mostrarErroDoCampo(campo) {
  const grupoCampo = campo.closest(".field");
  if (!grupoCampo) return;
  grupoCampo.classList.add("has-error");
  let mensagemErro = grupoCampo.querySelector(":scope > .field-error");
  if (!mensagemErro) {
    mensagemErro = document.createElement("span");
    mensagemErro.className = "field-error";
    mensagemErro.textContent = "Preencha este campo para continuar.";
    grupoCampo.append(mensagemErro);
  }
  grupoCampo.querySelector(".custom-control-trigger")?.setAttribute("aria-invalid", "true");
  campo.setAttribute("aria-invalid", "true");
}

function limparErroDoCampo(campo) {
  const grupoCampo = campo.closest(".field");
  if (!grupoCampo) return;
  grupoCampo.classList.remove("has-error");
  grupoCampo.querySelector(":scope > .field-error")?.remove();
  grupoCampo.querySelector(".custom-control-trigger")?.removeAttribute("aria-invalid");
  campo.removeAttribute("aria-invalid");
}

function atualizarListaDeOpcoes(lista) {
  const botao = lista._botaoPersonalizado;
  if (!botao) return;
  const opcaoSelecionada = lista.selectedOptions[0];
  botao.querySelector(".custom-control-value").textContent = opcaoSelecionada?.textContent ?? "Selecione";
  botao.classList.toggle("is-placeholder", !lista.value);
  botao.setAttribute("aria-label", lista.getAttribute("aria-label") || opcaoSelecionada?.textContent || "Selecionar opção");
}

function abrirListaDeOpcoes(lista) {
  const botao = lista._botaoPersonalizado;
  const menu = criarMenuFlutuante("select-popover", botao);
  menu.id = `${botao.id}-options`;
  menu.setAttribute("role", "listbox");
  botao.setAttribute("aria-controls", menu.id);
  botao.setAttribute("aria-expanded", "true");

  for (const opcao of lista.options) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "select-option";
    item.setAttribute("role", "option");
    item.setAttribute("aria-selected", String(opcao.selected));
    item.disabled = opcao.disabled;
    item.textContent = opcao.textContent;
    item.addEventListener("click", () => {
      lista.value = opcao.value;
      lista.dispatchEvent(new Event("input", { bubbles: true }));
      lista.dispatchEvent(new Event("change", { bubbles: true }));
      atualizarListaDeOpcoes(lista);
      limparErroDoCampo(lista);
      fecharMenu();
      botao.focus();
    });
    menu.append(item);
  }

  posicionarMenu(menu, botao);
  const indiceMarcado = [...menu.children].findIndex((item) => item.getAttribute("aria-selected") === "true");
  const itemAtivo = menu.children[Math.max(0, indiceMarcado)];
  itemAtivo?.classList.add("keyboard-active");
  itemAtivo?.focus();
}

function iniciarListaDeOpcoes(lista, indice) {
  const envoltorio = document.createElement("div");
  envoltorio.className = `custom-control custom-select${lista.closest(".filters-row") ? " filter-select" : ""}`;
  lista.after(envoltorio);
  envoltorio.append(lista);

  const botao = document.createElement("button");
  botao.type = "button";
  botao.id = `custom-select-${lista.id || lista.name || indice}`;
  botao.className = "custom-control-trigger select-trigger";
  botao.setAttribute("aria-haspopup", "listbox");
  botao.setAttribute("aria-expanded", "false");
  botao.innerHTML = '<span class="custom-control-value"></span><span class="custom-control-icon">' + iconeSeta + "</span>";
  envoltorio.append(botao);
  lista._botaoPersonalizado = botao;
  adicionarRotuloDoCampo(lista, botao);
  ocultarCampoOriginal(lista);
  atualizarListaDeOpcoes(lista);

  botao.addEventListener("click", () => menuAberto?._botao === botao ? fecharMenu() : abrirListaDeOpcoes(lista));
  botao.addEventListener("keydown", (evento) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(evento.key)) {
      evento.preventDefault();
      abrirListaDeOpcoes(lista);
    }
  });
  lista.addEventListener("change", () => { atualizarListaDeOpcoes(lista); limparErroDoCampo(lista); });
}

function converterParaDataIso(data) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

function converterDeDataIso(valor) {
  if (!valor) return null;
  const [ano, mes, dia] = valor.split("-").map(Number);
  return new Date(ano, mes - 1, dia);
}

function atualizarCampoDeData(campoData) {
  const botao = campoData._botaoPersonalizado;
  if (!botao) return;
  const valor = campoData.value ? converterDeDataIso(campoData.value).toLocaleDateString("pt-BR") : "Selecionar data";
  botao.querySelector(".custom-control-value").textContent = valor;
  botao.classList.toggle("is-placeholder", !campoData.value);
  const rotulo = campoData.closest(".field")?.querySelector(".field-label")?.textContent.trim() || "Data";
  botao.setAttribute("aria-label", `${rotulo}: ${valor}`);
}

function abrirCalendario(campoData) {
  const botao = campoData._botaoPersonalizado;
  const dataEscolhida = converterDeDataIso(campoData.value);
  const dataVisivel = dataEscolhida ?? new Date();
  let anoVisivel = dataVisivel.getFullYear();
  let mesVisivel = dataVisivel.getMonth();
  const calendario = criarMenuFlutuante("calendar-popover", botao);
  calendario.setAttribute("role", "dialog");
  calendario.setAttribute("aria-label", "Calendário para selecionar data");
  botao.setAttribute("aria-expanded", "true");

  function desenharCalendario() {
    calendario.replaceChildren();
    const cabecalho = document.createElement("div");
    cabecalho.className = "calendar-header";
    const anoAnterior = document.createElement("button");
    anoAnterior.type = "button";
    anoAnterior.className = "calendar-nav calendar-year-nav";
    anoAnterior.setAttribute("aria-label", "Ano anterior");
    anoAnterior.textContent = "«";
    const anterior = document.createElement("button");
    anterior.type = "button";
    anterior.className = "calendar-nav";
    anterior.setAttribute("aria-label", "Mês anterior");
    anterior.textContent = "‹";
    const titulo = document.createElement("strong");
    titulo.textContent = nomesDosMeses.format(new Date(anoVisivel, mesVisivel, 1));
    const proximo = document.createElement("button");
    proximo.type = "button";
    proximo.className = "calendar-nav";
    proximo.setAttribute("aria-label", "Próximo mês");
    proximo.textContent = "›";
    const proximoAno = document.createElement("button");
    proximoAno.type = "button";
    proximoAno.className = "calendar-nav calendar-year-nav";
    proximoAno.setAttribute("aria-label", "Próximo ano");
    proximoAno.textContent = "»";
    proximoAno.disabled = anoVisivel >= new Date().getFullYear();
    anoAnterior.addEventListener("click", () => { anoVisivel--; desenharCalendario(); });
    anterior.addEventListener("click", () => { mesVisivel--; if (mesVisivel < 0) { mesVisivel = 11; anoVisivel--; } desenharCalendario(); });
    proximo.addEventListener("click", () => { mesVisivel++; if (mesVisivel > 11) { mesVisivel = 0; anoVisivel++; } desenharCalendario(); });
    proximoAno.addEventListener("click", () => { anoVisivel++; desenharCalendario(); });
    cabecalho.append(anoAnterior, anterior, titulo, proximo, proximoAno);

    const grade = document.createElement("div");
    grade.className = "calendar-grid";
    grade.setAttribute("role", "grid");
    for (const diaSemana of diasDaSemana) {
      const rotuloDia = document.createElement("span");
      rotuloDia.className = "calendar-weekday";
      rotuloDia.textContent = diaSemana;
      grade.append(rotuloDia);
    }
    const primeiroDia = new Date(anoVisivel, mesVisivel, 1);
    const deslocamento = (primeiroDia.getDay() + 6) % 7;
    const quantidadeDias = new Date(anoVisivel, mesVisivel + 1, 0).getDate();
    for (let indice = 0; indice < deslocamento; indice++) {
      const espacoVazio = document.createElement("span");
      espacoVazio.className = "calendar-empty";
      grade.append(espacoVazio);
    }
    for (let dia = 1; dia <= quantidadeDias; dia++) {
      const data = new Date(anoVisivel, mesVisivel, dia);
      const dataIso = converterParaDataIso(data);
      const botaoDia = document.createElement("button");
      botaoDia.type = "button";
      botaoDia.className = "calendar-day";
      botaoDia.setAttribute("role", "gridcell");
      botaoDia.textContent = String(dia);
      botaoDia.setAttribute("aria-label", data.toLocaleDateString("pt-BR", { dateStyle: "full" }));
      if (dataIso === campoData.value) { botaoDia.classList.add("selected"); botaoDia.setAttribute("aria-selected", "true"); }
      if (dataIso === converterParaDataIso(new Date())) botaoDia.classList.add("today");
      botaoDia.disabled = Boolean(campoData.max && dataIso > campoData.max);
      botaoDia.addEventListener("click", () => {
        campoData.value = dataIso;
        campoData.dispatchEvent(new Event("input", { bubbles: true }));
        campoData.dispatchEvent(new Event("change", { bubbles: true }));
        atualizarCampoDeData(campoData);
        limparErroDoCampo(campoData);
        fecharMenu();
        botao.focus();
      });
      grade.append(botaoDia);
    }
    calendario.append(cabecalho, grade);
    posicionarMenu(calendario, botao);
  }

  desenharCalendario();
  calendario.querySelector(".calendar-day:not(:disabled)")?.focus();
}

function iniciarCampoDeData(campoData, indice) {
  const envoltorio = document.createElement("div");
  envoltorio.className = "custom-control custom-date";
  campoData.after(envoltorio);
  envoltorio.append(campoData);

  const botao = document.createElement("button");
  botao.type = "button";
  botao.id = `custom-date-${campoData.name || indice}`;
  botao.className = "custom-control-trigger date-trigger";
  botao.setAttribute("aria-haspopup", "dialog");
  botao.setAttribute("aria-expanded", "false");
  botao.innerHTML = '<span class="custom-control-value"></span><span class="custom-control-icon">' + iconeCalendario + "</span>";
  envoltorio.append(botao);
  campoData._botaoPersonalizado = botao;
  adicionarRotuloDoCampo(campoData, botao);
  ocultarCampoOriginal(campoData);
  atualizarCampoDeData(campoData);
  botao.addEventListener("click", () => menuAberto?._botao === botao ? fecharMenu() : abrirCalendario(campoData));
  campoData.addEventListener("change", () => { atualizarCampoDeData(campoData); limparErroDoCampo(campoData); });
}

export function iniciarControlesPersonalizados() {
  document.querySelectorAll('input[type="date"]').forEach(iniciarCampoDeData);
  document.addEventListener("pointerdown", (evento) => {
    if (menuAberto && !menuAberto.contains(evento.target) && !menuAberto._botao?.contains(evento.target)) fecharMenu();
  });
  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape" && menuAberto) { evento.preventDefault(); fecharMenu(true); return; }
    if (!menuAberto?.classList.contains("select-popover")) return;
    const opcoes = [...menuAberto.querySelectorAll(".select-option:not(:disabled)")];
    const atual = opcoes.indexOf(document.activeElement);
    if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
      evento.preventDefault();
      const direcao = evento.key === "ArrowDown" ? 1 : -1;
      opcoes[(atual + direcao + opcoes.length) % opcoes.length]?.focus();
    } else if (evento.key === "Home" || evento.key === "End") {
      evento.preventDefault();
      (evento.key === "Home" ? opcoes[0] : opcoes.at(-1))?.focus();
    }
  });
  window.addEventListener("resize", () => { if (menuAberto?._botao) posicionarMenu(menuAberto, menuAberto._botao); });
  window.addEventListener("scroll", () => fecharMenu(), true);
}

export function sincronizarControlesPersonalizados(escopo = document) {
  escopo.querySelectorAll('input[type="date"]').forEach(atualizarCampoDeData);
}

export function mostrarErroDoControle(campo) { mostrarErroDoCampo(campo); }
export function limparErroDoControle(campo) { limparErroDoCampo(campo); }
export function focarControle(campo) { (campo._botaoPersonalizado ?? campo).focus(); }
