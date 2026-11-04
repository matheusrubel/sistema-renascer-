"use client";

import { useEffect } from "react";

/**
 * Calendário próprio para todos os campos de data do sistema (inclusive os do formulário de cadastro).
 * O seletor nativo do navegador fica oculto; digitar a data nos campos continua funcionando.
 */
export function CalendarioGlobal() {
  useEffect(() => iniciarCalendario(), []);
  return null;
}

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const MESES_CURTOS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];
const ICONE_ANTERIOR = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>`;
const ICONE_PROXIMO = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>`;

type Visao = "dias" | "meses" | "anos";
interface Data { a: number; m: number; d: number }

const pad = (n: number) => String(n).padStart(2, "0");
const paraISO = (a: number, m: number, d: number) => `${a}-${pad(m + 1)}-${pad(d)}`;
function lerISO(valor: string): Data | null {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  return partes ? { a: Number(partes[1]), m: Number(partes[2]) - 1, d: Number(partes[3]) } : null;
}
const hojeData = (): Data => { const agora = new Date(); return { a: agora.getFullYear(), m: agora.getMonth(), d: agora.getDate() }; };
const diasNoMes = (a: number, m: number) => new Date(a, m + 1, 0).getDate();

function iniciarCalendario(): () => void {
  let popover: HTMLDivElement | null = null;
  let alvo: HTMLInputElement | null = null;
  let visao: Visao = "dias";
  let ano = 0;
  let mes = 0;
  let suprimirFoco = false;

  const valorNativo = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;

  const campoDeData = (elemento: EventTarget | null): HTMLInputElement | null =>
    elemento instanceof HTMLInputElement && elemento.type === "date" && !elemento.disabled && !elemento.readOnly ? elemento : null;

  function limites() {
    return { min: alvo?.min ? lerISO(alvo.min) : null, max: alvo?.max ? lerISO(alvo.max) : null };
  }
  const comparar = (x: Data, y: Data) => (x.a - y.a) || (x.m - y.m) || (x.d - y.d);
  function fora(data: Data): boolean {
    const { min, max } = limites();
    return Boolean((min && comparar(data, min) < 0) || (max && comparar(data, max) > 0));
  }

  function fechar() { popover?.remove(); popover = null; alvo = null; }

  function posicionar() {
    if (!popover || !alvo) return;
    const caixa = alvo.getBoundingClientRect();
    const largura = popover.offsetWidth;
    const altura = popover.offsetHeight;
    const esquerda = Math.min(Math.max(8, caixa.left), window.innerWidth - largura - 8);
    let topo = caixa.bottom + 6;
    if (topo + altura > window.innerHeight - 8 && caixa.top - altura - 6 > 8) topo = caixa.top - altura - 6;
    popover.style.left = `${esquerda}px`;
    popover.style.top = `${Math.max(8, topo)}px`;
  }

  function definirValor(valor: string) {
    if (!alvo) return;
    valorNativo?.call(alvo, valor);
    alvo.dispatchEvent(new Event("input", { bubbles: true }));
    alvo.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function escolher(data: Data) {
    if (fora(data)) return;
    const campo = alvo;
    definirValor(paraISO(data.a, data.m, data.d));
    fechar();
    if (campo) { suprimirFoco = true; campo.focus(); suprimirFoco = false; }
  }

  function desenhar() {
    if (!popover || !alvo) return;
    const selecionada = lerISO(alvo.value);
    const hoje = hojeData();
    let titulo = "";
    let corpo = "";

    if (visao === "dias") {
      titulo = `${MESES[mes]} ${ano}`;
      const primeiro = new Date(ano, mes, 1).getDay();
      const total = diasNoMes(ano, mes);
      const anterior = diasNoMes(ano, mes - 1 < 0 ? 11 : mes - 1);
      const celulas: string[] = SEMANA.map((letra) => `<div class="cal-semana">${letra}</div>`);
      for (let i = 0; i < 42; i++) {
        const numero = i - primeiro + 1;
        let data: Data;
        let classe = "cal-celula";
        if (numero < 1) { data = { a: mes === 0 ? ano - 1 : ano, m: mes === 0 ? 11 : mes - 1, d: anterior + numero }; classe += " cal-fora"; }
        else if (numero > total) { data = { a: mes === 11 ? ano + 1 : ano, m: mes === 11 ? 0 : mes + 1, d: numero - total }; classe += " cal-fora"; }
        else data = { a: ano, m: mes, d: numero };
        if (comparar(data, hoje) === 0) classe += " cal-hoje";
        if (selecionada && comparar(data, selecionada) === 0) classe += " cal-escolhida";
        celulas.push(`<button type="button" class="${classe}" data-dia="${paraISO(data.a, data.m, data.d)}" ${fora(data) ? "disabled" : ""}>${data.d}</button>`);
      }
      corpo = `<div class="cal-grade">${celulas.join("")}</div>`;
    } else if (visao === "meses") {
      titulo = String(ano);
      corpo = `<div class="cal-grade cal-grade-larga">${MESES_CURTOS.map((nome, indice) =>
        `<button type="button" class="cal-celula${selecionada && selecionada.a === ano && selecionada.m === indice ? " cal-escolhida" : ""}${hoje.a === ano && hoje.m === indice ? " cal-hoje" : ""}" data-mes="${indice}">${nome}</button>`).join("")}</div>`;
    } else {
      const inicio = Math.floor(ano / 12) * 12;
      titulo = `${inicio} – ${inicio + 11}`;
      const { min, max } = limites();
      corpo = `<div class="cal-grade cal-grade-larga">${Array.from({ length: 12 }, (_, i) => inicio + i).map((valor) =>
        `<button type="button" class="cal-celula${selecionada && selecionada.a === valor ? " cal-escolhida" : ""}${hoje.a === valor ? " cal-hoje" : ""}" data-ano="${valor}" ${(min && valor < min.a) || (max && valor > max.a) ? "disabled" : ""}>${valor}</button>`).join("")}</div>`;
    }

    popover.innerHTML = `
      <div class="cal-topo">
        <button type="button" class="cal-nav" data-nav="-1" aria-label="Anterior">${ICONE_ANTERIOR}</button>
        <button type="button" class="cal-titulo" data-titulo aria-label="Trocar de visão">${titulo}</button>
        <button type="button" class="cal-nav" data-nav="1" aria-label="Próximo">${ICONE_PROXIMO}</button>
      </div>
      ${corpo}
      <div class="cal-rodape"><button type="button" data-hoje ${fora(hoje) ? "disabled" : ""}>Hoje</button>${alvo.required ? "<span></span>" : `<button type="button" data-limpar>Limpar</button>`}</div>`;
    posicionar();
  }

  function abrir(campo: HTMLInputElement) {
    if (alvo === campo && popover) return;
    fechar();
    alvo = campo;
    const atual = lerISO(campo.value);
    const base = atual ?? (() => { const hoje = hojeData(); const { max, min } = limites(); if (max && comparar(hoje, max) > 0) return max; if (min && comparar(hoje, min) < 0) return min; return hoje; })();
    ano = base.a; mes = base.m; visao = "dias";
    popover = document.createElement("div");
    popover.className = "cal-pop";
    popover.setAttribute("role", "dialog");
    popover.setAttribute("aria-label", "Escolher data");
    document.body.appendChild(popover);
    desenhar();
  }

  function aoClicarNoPopover(evento: MouseEvent) {
    const botao = (evento.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!botao || !popover?.contains(botao) || botao.disabled) return;
    evento.preventDefault();
    if (botao.dataset.dia) { escolher(lerISO(botao.dataset.dia) as Data); return; }
    if (botao.dataset.mes) { mes = Number(botao.dataset.mes); visao = "dias"; desenhar(); return; }
    if (botao.dataset.ano) { ano = Number(botao.dataset.ano); visao = "meses"; desenhar(); return; }
    if (botao.dataset.nav) {
      const passo = Number(botao.dataset.nav);
      if (visao === "dias") { mes += passo; if (mes < 0) { mes = 11; ano--; } if (mes > 11) { mes = 0; ano++; } }
      else if (visao === "meses") ano += passo;
      else ano += passo * 12;
      desenhar(); return;
    }
    if (botao.hasAttribute("data-titulo")) { visao = visao === "dias" ? "anos" : visao === "anos" ? "dias" : "anos"; desenhar(); return; }
    if (botao.hasAttribute("data-hoje")) { escolher(hojeData()); return; }
    if (botao.hasAttribute("data-limpar")) { const campo = alvo; definirValor(""); fechar(); if (campo) { suprimirFoco = true; campo.focus(); suprimirFoco = false; } }
  }

  const aoFocar = (evento: FocusEvent) => { const campo = campoDeData(evento.target); if (campo && !suprimirFoco) abrir(campo); };
  const aoClicar = (evento: MouseEvent) => { const campo = campoDeData(evento.target); if (campo) abrir(campo); };
  const aoDigitar = (evento: Event) => { const campo = alvo; if (popover && campo && evento.target === campo) { const data = lerISO(campo.value); if (data) { ano = data.a; mes = data.m; } desenhar(); } };
  const aoApertarTecla = (evento: KeyboardEvent) => {
    if (!popover) return;
    if (evento.key === "Escape") { evento.stopPropagation(); const campo = alvo; fechar(); if (campo) { suprimirFoco = true; campo.focus(); suprimirFoco = false; } }
    else if (evento.key === "Tab") fechar();
  };
  const aoApertarMouse = (evento: MouseEvent) => {
    if (!popover) return;
    const dentro = evento.target instanceof Node && (popover.contains(evento.target) || evento.target === alvo);
    if (!dentro) fechar();
  };
  const aoRolar = () => posicionar();

  document.addEventListener("focusin", aoFocar);
  document.addEventListener("click", aoClicar);
  document.addEventListener("input", aoDigitar);
  document.addEventListener("keydown", aoApertarTecla, true);
  document.addEventListener("mousedown", aoApertarMouse);
  document.addEventListener("click", aoClicarPopoverGlobal);
  window.addEventListener("resize", aoRolar);
  document.addEventListener("scroll", aoRolar, true);

  // O popover é criado depois da inicialização; o clique é tratado por delegação no documento.
  function aoClicarPopoverGlobal(evento: MouseEvent) {
    if (popover && evento.target instanceof Node && popover.contains(evento.target)) aoClicarNoPopover(evento);
  }

  return () => {
    fechar();
    document.removeEventListener("focusin", aoFocar);
    document.removeEventListener("click", aoClicar);
    document.removeEventListener("input", aoDigitar);
    document.removeEventListener("keydown", aoApertarTecla, true);
    document.removeEventListener("mousedown", aoApertarMouse);
    document.removeEventListener("click", aoClicarPopoverGlobal);
    window.removeEventListener("resize", aoRolar);
    document.removeEventListener("scroll", aoRolar, true);
  };
}
