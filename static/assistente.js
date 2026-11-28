/* Assistente do Painel — “Pergunte ao painel” (VWAJ, nov/2026).
   Janela no canto, em todas as telas. Fala com /api/assistente (regras, sem IA, sem internet).
   A conversa fica guardada nesta aba (sessionStorage) para continuar ao mudar de página. */
(function () {
  if (window.ESTATICO || !document.body) return;
  const API = "/api/assistente", AJ = "/api/assistente/ajustes";
  const NOME = (window.ASSIST_NOME || "").trim();
  const LOGO = "/static/logo_n.png", NC = "/static/marcas_gefp/nc_branco.png", EM = "/static/marcas_gefp/emlurb_branco.png";
  let aj = { modo: "direto", obs: true, sugestoes: true, exemplos: true, tom: "auto", intro: true, animacao: true };
  const reduz = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
  let ctx = {}, hist = [];
  const semFotos = (m) => (m.r ? { r: Object.assign({}, m.r, { blocos: (m.r.blocos || []).filter((b) => b.t !== "foto") }) } : m);
  const guardar = () => { try { sessionStorage.setItem("assist", JSON.stringify({ ctx, hist: hist.slice(-40).map(semFotos), aberto: !painel.hidden })); } catch (e) {} };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const IC = {
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    eng: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>',
    lixo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>',
    env: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    pessoa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M17 11l2 2 3.5-3.5"/></svg>',
    relogio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
    pino: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    agua: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/></svg>',
    busca: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
  };
  const TEMAS = [
    { rot: "Quem trabalhou", dica: "hoje, ontem, um dia", p: "quem tá trabalhando hoje?", ic: "pessoa", c: "verde" },
    { rot: "Horários e horas", dica: "começou, largou, total", p: "horário de todos hoje", ic: "relogio", c: "azul" },
    { rot: "Demandas", dica: "quem tem, quanto andou", p: "como estão as demandas?", ic: "doc", c: "laranja" },
    { rot: "Buracos em aberto", dica: "por fiscal ou RPA", p: "quantos buracos em aberto?", ic: "pino", c: "vermelho" },
    { rot: "Estacionárias", dica: "quantidade nos canais", p: "quantas estacionárias tem hoje?", ic: "agua", c: "ciano" },
    { rot: "Fibra de vidro", dica: "andamento, quebrados", p: "como estão os tampões de fibra?", ic: "doc", c: "laranja" },
    { rot: "Drenagem", dica: "limpeza, grelhas, tampões", p: "como estão os serviços de drenagem?", ic: "agua", c: "azul" },
    { rot: "Um ID", dica: "digite o número", p: "", ic: "busca", c: "cinza" },
  ];
  const EXEMPLOS = ["quem tá trabalhando hoje?", "como estão os tampões de fibra?", "como tá a limpeza de canais?"];

  // ── montagem ──
  const bola = document.createElement("button");
  bola.type = "button"; bola.className = "as-bola"; bola.title = "Pergunte ao painel"; bola.setAttribute("aria-label", "Abrir o assistente");
  bola.innerHTML = IC.chat;
  const painel = document.createElement("section");
  painel.className = "as-painel"; painel.hidden = true; painel.setAttribute("aria-label", "Assistente do Painel");
  painel.innerHTML = `
    <header class="as-cab">
      <div class="as-topo"><span class="as-av"><img src="${LOGO}" alt=""></span>
        <div class="as-nome"><b>Assistente do Painel</b><span><i></i><em id="asAte">dados do SIGA</em></span></div>
        <div class="as-acoes"><button type="button" data-a="limpar" title="Nova conversa">${IC.lixo}</button>
          <button type="button" data-a="ajustes" title="Ajustes">${IC.eng}</button><button type="button" data-a="fechar" title="Fechar">${IC.x}</button></div></div>
      <div class="as-logos"><img src="${NC}" alt="Norconsult"><span></span><img src="${EM}" alt="Emlurb"><small>Fiscalização · Recife</small></div>
    </header>
    <div class="as-corpo" id="asCorpo" aria-live="polite"></div>
    <div class="as-aj" id="asAj" hidden></div>
    <div class="as-ctx" id="asCtx" hidden></div>
    <form class="as-pe" id="asForm"><div class="as-entrada"><input id="asTxt" autocomplete="off" placeholder="Escreva sua pergunta…" maxlength="200">
      <button class="as-enviar" type="submit" aria-label="Enviar">${IC.env}</button></div>
      <small>Respostas com os dados do SIGA, até a última coleta.</small></form>`;
  document.body.append(bola, painel);
  const ctxBox = painel.querySelector("#asCtx");
  // etiqueta do contexto: de quem e de quando a conversa está falando ("ele", "e ontem?" usam isso)
  function mostrarCtx() {
    if (!ctx.pessoa && !ctx.servico_rot) { ctxBox.hidden = true; return; }
    const nm = ctx.pessoa ? ctx.pessoa.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()) : "";
    const partes = [nm && `<b>${esc(nm)}</b>`, ctx.servico_rot && (nm ? esc(ctx.servico_rot) : `<b>${esc(ctx.servico_rot)}</b>`), ctx.rot && esc(ctx.rot)].filter(Boolean);
    ctxBox.innerHTML = `<span>Falando de ${partes.join(" · ")}</span><button type="button" title="Esquecer e começar outro assunto">✕</button>`;
    ctxBox.hidden = false;
    ctxBox.querySelector("button").onclick = () => { ["pessoa", "dias", "rot", "servico", "servico_rot", "intencao"].forEach((k) => delete ctx[k]); mostrarCtx(); guardar(); };
  }
  const corpo = painel.querySelector("#asCorpo"), entrada = painel.querySelector("#asTxt"), ajBox = painel.querySelector("#asAj");

  const saud = () => { const h = new Date().getHours(); return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"; };
  function boasVindas() {
    const d = document.createElement("div");
    d.className = "as-bv";
    d.innerHTML = `<h3>${saud()}${NOME ? ", " + esc(NOME.split(" ")[0]) : ""} 👋</h3><p>Pergunte do seu jeito ou escolha um assunto.</p>
      <div class="as-temas">${TEMAS.map((t, i) => `<button type="button" class="as-tema" data-i="${i}"><span class="ic ${t.c}">${IC[t.ic]}</span><b>${t.rot}</b><span>${t.dica}</span></button>`).join("")}</div>
      ${aj.exemplos ? `<div class="as-ex"><small>Experimente perguntar</small>${EXEMPLOS.map((e) => `<button type="button" class="as-exb">${esc(e)}</button>`).join("")}</div>` : ""}`;
    d.querySelectorAll(".as-tema").forEach((b) => b.addEventListener("click", () => {
      const t = TEMAS[+b.dataset.i];
      if (!t.p) { entrada.focus(); entrada.placeholder = "Digite o número do ID…"; return; }
      perguntar(t.p);
    }));
    d.querySelectorAll(".as-exb").forEach((b) => b.addEventListener("click", () => perguntar(b.textContent)));
    corpo.appendChild(d);
  }

  // ── blocos da resposta ──
  function val(v) {
    if (v && typeof v === "object") return `<span class="as-tag ${v.cor || ""}">${esc(v.tag)}</span>`;
    return esc(v);
  }
  function bloco(b) {
    switch (b.t) {
      case "titulo": return `<p class="as-tit">${esc(b.txt)}</p>`;
      case "texto": return (b.detalhe && aj.modo !== "detalhado") ? "" : `<p class="${b.pequeno ? "as-peq" : ""}${b.lead ? " as-lead" : ""}" data-ty>${esc(b.txt)}</p>`;
      case "grande": return `<div class="as-grande"><b>${esc(b.n)}</b><span>${esc(b.rot)}</span></div>`;
      case "linhas": return `<dl class="as-linhas">${b.itens.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${val(v)}</dd>`).join("")}</dl>`;
      case "grupo": return `<div class="as-grupo"><span class="as-tag ${b.cor || ""}">${esc(b.rot)}</span><p>${esc(b.txt)}</p></div>`;
      case "obs": return aj.obs ? `<div class="as-obs ${b.cor || ""}">${b.cor === "alerta" ? "⚠" : "📌"} <span><b>Obs:</b> ${esc(b.txt)}</span></div>` : "";
      case "progresso": return `<div class="as-trilho"><i style="width:${Math.max(0, Math.min(100, b.pct))}%"></i></div>`;
      case "barras": {
        const mx = Math.max(1, ...b.itens.map((i) => +i.n || 0));
        return `<div class="as-barras">${b.itens.map((i) => `<div class="${i.hj ? "hj" : ""}${+i.n ? "" : " z"}"><b>${esc(i.txt != null ? i.txt : i.n)}</b><i style="height:${+i.n ? Math.max(6, (i.n / mx) * 100) : 4}%"></i><span>${esc(i.rot)}</span></div>`).join("")}</div>${b.rot ? `<p class="as-peq">${esc(b.rot)}</p>` : ""}`;
      }
      case "hbarras": return `${b.rot ? `<p class="as-peq">${esc(b.rot)}</p>` : ""}<div class="as-hbarras">${b.itens.map((i) => `<div><em>${esc(i.rot)}</em><u style="width:${Math.max(3, i.n)}%"></u><b>${esc(i.txt)}</b></div>`).join("")}</div>`;
      case "qtds": {
        return `<div class="as-qtds">${b.itens.map((i) => `<div class="${i.n ? "" : "zero"}"><span>${esc(i.rot)} <small>${esc(i.dica || "")}</small></span><span class="pts">${i.n ? "<i></i>".repeat(Math.min(i.n, 10)) : '<i class="v"></i>'}</span><b>${i.n}</b></div>`).join("")}</div>`;
      }
      case "tabela": return `<table class="as-tab"><thead><tr>${b.cab.map((c, k) => `<th class="${b.esq && k > 0 && k < b.cab.length - 1 ? "e" : ""}">${esc(c)}</th>`).join("")}</tr></thead><tbody>${b.linhas.map((l) => `<tr>${l.map((c, k) => `<td class="${k && !(b.esq && k < l.length - 1) ? "n" : ""}">${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
      case "foto": return `<figure class="as-foto"><img src="${b.uri}" alt=""><figcaption>${esc(b.txt || "")}</figcaption></figure>`;
      case "link": return `<a class="as-link" href="${esc(b.url)}"${b.fora ? ' target="_blank" rel="noopener"' : ""}>${esc(b.txt)} →</a>`;
    }
    return "";
  }
  function msgUsuario(t) {
    const d = document.createElement("div"); d.className = "as-u"; d.textContent = t; corpo.appendChild(d); return d;
  }
  function msgPainel(r, animar) {
    const d = document.createElement("div"); d.className = "as-b";
    let h = (r.blocos || []).map(bloco).join("");
    if (r.escolha) h += `<div class="as-chips">${r.escolha.opcoes.map((o, i) => `<button type="button" class="as-chip ${i === 0 ? "forte" : ""}" data-e="${i}">${esc(o.rot)}${o.dica ? `<span>${esc(o.dica)}</span>` : ""}</button>`).join("")}</div>`;
    if (r.temas) h += `<div class="as-temas-mini">${TEMAS.map((t, i) => `<button type="button" class="as-tm" data-t="${i}"><span class="ic ${t.c}">${IC[t.ic]}</span>${esc(t.rot)}</button>`).join("")}</div>`;
    if (aj.sugestoes && (r.sugestoes || []).length)
      h += `<div class="as-quer"><small>${esc(r.quer || "Quer saber mais?")}</small><div class="as-chips">${r.sugestoes.map((s, i) => `<button type="button" class="as-chip" data-s="${i}">${esc(s.rot)}</button>`).join("")}</div></div>`;
    d.innerHTML = `<span class="as-mini"><img src="${LOGO}" alt=""></span><div class="as-balao">${h || "<p>…</p>"}</div>`;
    d.querySelectorAll("[data-e]").forEach((b) => b.addEventListener("click", async () => {
      const o = r.escolha.opcoes[+b.dataset.e];
      if (o.todos) { for (const p of o.todos) await perguntar(p, o.rot); } else perguntar(o.pergunta, o.rot);
    }));
    d.querySelectorAll("[data-t]").forEach((b) => b.addEventListener("click", () => {
      const t = TEMAS[+b.dataset.t];
      if (!t.p) { entrada.focus(); entrada.placeholder = "Digite o número do ID…"; return; }
      perguntar(t.p, t.rot);
    }));
    d.querySelectorAll("[data-s]").forEach((b) => b.addEventListener("click", () => {
      const s = r.sugestoes[+b.dataset.s];
      if (s.pergunta.startsWith("/")) { guardar(); location.href = s.pergunta; } else perguntar(s.pergunta, s.rot);
    }));
    corpo.appendChild(d);
    if (animar && aj.animacao && !reduz) return revelar(d, r);
    return Promise.resolve();
  }
  // aparece por etapas: texto "digitado" nas respostas de papo, blocos surgindo um a um nas de dados
  async function revelar(d, r) {
    const bal = d.querySelector(".as-balao");
    const filhos = Array.from(bal.children);
    filhos.forEach((f) => f.classList.add("as-oculto"));
    for (const f of filhos) {
      f.classList.remove("as-oculto"); f.classList.add("as-surge");
      const p = f.matches("p[data-ty]") ? f : null;
      if (p && p.textContent.length < 260) {
        const t = p.textContent; p.textContent = "";
        const passo = Math.max(8, Math.min(18, 550 / t.length));
        for (let i = 1; i <= t.length; i++) { p.textContent = t.slice(0, i); if (i % 3 === 0) { seguir(); await espera(passo); } }
        p.textContent = t;
      } else await espera(r.temas ? 50 : r.papo ? 70 : 85);
      seguir(true);
    }
  }
  const rolar = () => { corpo.scrollTop = corpo.scrollHeight; };
  let ancora = null;
  // acompanha a resposta descendo, mas nunca deixa a pergunta sair do topo da janela
  function seguir(suave) {
    if (!ancora) return rolar();
    const topoPergunta = ancora.getBoundingClientRect().top - corpo.getBoundingClientRect().top + corpo.scrollTop - 10;
    const fundo = corpo.scrollHeight - corpo.clientHeight;
    const alvo = Math.max(0, Math.min(fundo, topoPergunta));
    if (alvo > corpo.scrollTop + 1) corpo.scrollTo({ top: alvo, behavior: suave && !reduz ? "smooth" : "auto" });
  }

  async function perguntar(texto, mostrar) {
    texto = (texto || "").trim(); if (!texto) return;
    ancora = msgUsuario(mostrar || texto); hist.push({ u: mostrar || texto });
    const pensando = document.createElement("div"); pensando.className = "as-b as-pensa";
    pensando.innerHTML = `<span class="as-mini"><img src="${LOGO}" alt=""></span><div class="as-balao"><i></i><i></i><i></i></div>`;
    corpo.appendChild(pensando); seguir(true);
    let r;
    const minimo = (aj.animacao && !reduz) ? 260 + Math.min(300, texto.length * 6) + Math.random() * 160 : 0;   // ágil, mas não seco
    const t0 = Date.now();
    try {
      const resp = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ texto, ctx, nome: NOME }) });
      r = await resp.json();
      if (!resp.ok) r = { blocos: [{ t: "texto", txt: r.erro || "Não consegui responder agora." }] };
    } catch (e) { r = { blocos: [{ t: "texto", txt: "Não consegui falar com o painel. Ele está aberto?" }] }; }
    const resta = minimo - (Date.now() - t0);
    if (resta > 0) await espera(resta);
    pensando.remove();
    if (r.ir) { guardar(); location.href = r.ir; return; }
    if (r.temas && !(r.blocos || []).length) r.blocos = [{ t: "texto", txt: "Escolha um assunto:" }];
    hist.push({ r });
    ctx = Object.assign({}, ctx, r.ctx || {});
    if (r.dados_ate) painel.querySelector("#asAte").textContent = "dados até " + r.dados_ate;
    mostrarCtx(); guardar();
    await msgPainel(r, true);
    seguir(true); guardar();
  }

  // ── ajustes ──
  function chave(id, rot, sub, on) {
    return `<label class="as-aj-l"><span>${rot}<small>${sub}</small></span><input type="checkbox" data-k="${id}" ${on ? "checked" : ""}><i class="as-sw"></i></label>`;
  }
  function abrirAjustes() {
    ajBox.innerHTML = `<div class="as-aj-cx">
      <p class="as-tit">Ajustes do assistente <small>só para o seu acesso</small></p>
      <div class="as-aj-l"><span>Jeito de responder<small>direto: só os números</small></span>
        <span class="as-seg"><button type="button" data-m="direto" class="${aj.modo === "direto" ? "on" : ""}">Direto</button><button type="button" data-m="detalhado" class="${aj.modo === "detalhado" ? "on" : ""}">Detalhado</button></span></div>
      <div class="as-aj-l"><span>Jeito de falar<small>automático acompanha o seu jeito de escrever</small></span>
        <span class="as-seg as-seg4">${[["auto", "Auto"], ["formal", "Formal"], ["normal", "Normal"], ["informal", "Solto"]].map(([k, n]) => `<button type="button" data-t="${k}" class="${aj.tom === k ? "on" : ""}">${n}</button>`).join("")}</span></div>
      ${chave("intro", "Frases de abertura", "“Aqui está:”, “Segue a informação:”…", aj.intro)}
      ${chave("animacao", "Animação de digitando", "pausa curta antes de responder", aj.animacao)}
      ${chave("obs", "Observações", "férias, substituições, logins", aj.obs)}
      ${chave("sugestoes", "Sugestões “Quer saber mais?”", "até 3 botões por resposta", aj.sugestoes)}
      ${chave("exemplos", "Exemplos ao abrir", "perguntas para experimentar", aj.exemplos)}
      <button type="button" class="as-ok">Pronto</button></div>`;
    ajBox.hidden = false;
    ajBox.querySelectorAll("[data-m]").forEach((b) => b.addEventListener("click", () => { aj.modo = b.dataset.m; salvarAj(); abrirAjustes(); }));
    ajBox.querySelectorAll("[data-t]").forEach((b) => b.addEventListener("click", () => { aj.tom = b.dataset.t; delete ctx.tom_cmd; salvarAj(); abrirAjustes(); }));
    ajBox.querySelectorAll("[data-k]").forEach((c) => c.addEventListener("change", () => { aj[c.dataset.k] = c.checked; salvarAj(); }));
    ajBox.querySelector(".as-ok").addEventListener("click", () => { ajBox.hidden = true; });
  }
  function salvarAj() { fetch(AJ, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(aj) }).catch(() => {}); }

  // ── abrir / fechar ──
  function abrir() {
    painel.hidden = false; bola.classList.add("aberto");
    if (!corpo.children.length) boasVindas();
    setTimeout(() => entrada.focus(), 50); rolar(); guardar();
  }
  function fechar() { painel.hidden = true; bola.classList.remove("aberto"); guardar(); }
  bola.addEventListener("click", () => (painel.hidden ? abrir() : fechar()));
  painel.querySelector("[data-a=fechar]").addEventListener("click", fechar);
  painel.querySelector("[data-a=ajustes]").addEventListener("click", () => (ajBox.hidden ? abrirAjustes() : (ajBox.hidden = true)));
  painel.querySelector("[data-a=limpar]").addEventListener("click", () => { corpo.innerHTML = ""; ctx = {}; hist = []; boasVindas(); mostrarCtx(); guardar(); });
  painel.querySelector("#asForm").addEventListener("submit", (e) => { e.preventDefault(); const t = entrada.value; entrada.value = ""; entrada.placeholder = "Escreva sua pergunta…"; perguntar(t); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !painel.hidden) fechar(); });

  setTimeout(() => {
    try {
      const ult = +sessionStorage.getItem("assist_aq") || 0;
      if (Date.now() - ult < 300000) return;
      sessionStorage.setItem("assist_aq", String(Date.now()));
    } catch (e) {}
    fetch("/api/assistente/aquecer", { method: "POST" }).catch(() => {});
  }, 1500);
  fetch(AJ).then((r) => r.json()).then((a) => { aj = Object.assign(aj, a || {}); }).catch(() => {}).finally(() => {
    try {                                        // a conversa desta aba continua ao mudar de página
      const s = JSON.parse(sessionStorage.getItem("assist") || "null");
      if (s) {
        ctx = s.ctx || {}; hist = s.hist || [];
        if (hist.length) hist.forEach((m) => (m.u ? msgUsuario(m.u) : msgPainel(m.r)));
        mostrarCtx();
        if (s.aberto) abrir();
      }
    } catch (e) {}
  });
})();
