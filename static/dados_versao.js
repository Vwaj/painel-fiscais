/* v70 · Dados novos sem travar o site (painel completo e simplificado) · VWAJ 2026
   - Enquanto uma coleta roda, o site continua mostrando a última coleta (tudo já calculado) e aparece um aviso discreto.
   - Quando a coleta termina, o painel prepara os números novos em segundo plano e só então publica.
   - Aí aparece o botão “Dados novos — Atualizar”: um clique e a página volta no mesmo lugar (rolagem e aba).
   Uso em outros scripts: DadosVersao.quandoPronto(fn) · DadosVersao.atualizar()                                   */
(function () {
  if (window.ESTATICO || window.DadosVersao) return;
  const inicial = Number(window.DADOS_VERSAO || 0);
  let ult = null, timer = null, esperando = [], querAtualizar = false;
  const hhmm = iso => iso ? iso.slice(11, 16) : "";
  const dm = iso => iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) : "";

  const css = document.createElement("style");
  css.textContent = `
  .dv-pilula{position:fixed;left:16px;bottom:16px;z-index:9998;display:flex;align-items:center;gap:8px;max-width:min(460px,calc(100vw - 32px));
    background:#10442F;color:#FBF4E8;border-radius:999px;padding:8px 14px;font:600 13px Inter,system-ui,sans-serif;box-shadow:0 8px 22px rgba(0,0,0,.22);
    transform:translateY(140%);transition:transform .35s ease;pointer-events:none}
  .dv-pilula.on{transform:none}
  .dv-pilula i{width:14px;height:14px;border-radius:50%;border:2px solid rgba(255,255,255,.35);border-top-color:#E0B84F;animation:dvgira 1s linear infinite;flex:none}
  @keyframes dvgira{to{transform:rotate(360deg)}}
  .dv-novo{position:fixed;right:16px;bottom:16px;z-index:9999;display:flex;align-items:center;gap:12px;flex-wrap:wrap;max-width:calc(100vw - 32px);
    background:#fff;color:#10442F;border:2px solid #E0B84F;border-radius:18px;padding:12px 14px 12px 16px;font:500 14px Inter,system-ui,sans-serif;
    box-shadow:0 16px 36px rgba(16,68,47,.28);transform:translateY(150%);transition:transform .4s cubic-bezier(.2,.9,.3,1.2)}
  .dv-novo.on{transform:none}
  .dv-novo b{display:block;font-size:15px}
  .dv-novo small{color:#6B5B45}
  .dv-novo button{border:none;cursor:pointer;border-radius:999px;padding:9px 16px;font:700 14px Inter,system-ui,sans-serif}
  .dv-novo .sim{background:#10442F;color:#fff}.dv-novo .sim:hover{filter:brightness(1.15)}
  .dv-novo .nao{background:transparent;color:#6B5B45;padding:9px 8px}
  @media (prefers-reduced-motion:reduce){.dv-pilula,.dv-novo{transition:none}.dv-pilula i{animation:none}}`;
  document.head.appendChild(css);

  const pil = document.createElement("div"); pil.className = "dv-pilula"; pil.setAttribute("role", "status");
  const novo = document.createElement("div"); novo.className = "dv-novo"; novo.setAttribute("role", "alert");
  document.addEventListener("DOMContentLoaded", () => { document.body.append(pil, novo); });

  function guardaLugar() {
    try { sessionStorage.setItem("dv_lugar", JSON.stringify({ u: location.pathname + location.search + location.hash, y: scrollY })); } catch (e) {}
  }
  function voltaLugar() {
    try {
      const l = JSON.parse(sessionStorage.getItem("dv_lugar") || "null"); sessionStorage.removeItem("dv_lugar");
      if (l && l.u === location.pathname + location.search + location.hash) {
        const ir = () => scrollTo(0, l.y); ir(); setTimeout(ir, 400); setTimeout(ir, 1200);   // depois dos gráficos
      }
    } catch (e) {}
  }
  voltaLugar();

  function recarrega() { guardaLugar(); location.reload(); }

  function mostra(v) {
    // aviso discreto: coleta rodando ou versão nova sendo preparada
    if (v.coleta || v.preparando || (querAtualizar && v.versao === inicial)) {
      const b = v.busca || {};
      pil.innerHTML = `<i></i><span>${v.coleta ? `${b.titulo ? b.titulo.replace(/ \(.*\)/, "") : "Busca no SIGA"}${b.pct != null ? " · " + b.pct + "%" : ""} — o painel segue com a coleta ${v.coleta_mostrada ? "das " + hhmm(v.coleta_mostrada) : "anterior"}`
        : "Preparando os números novos…"}</span>`;
      pil.classList.add("on");
    } else pil.classList.remove("on");
    if (v.versao !== inicial) {
      if (querAtualizar) return recarrega();
      novo.innerHTML = `<div><b>✓ Dados novos prontos</b><small>${v.coleta_mostrada ? `Coleta de ${dm(v.coleta_mostrada)} às ${hhmm(v.coleta_mostrada)}` : "Os números foram atualizados"} · a página volta neste mesmo ponto</small></div>
        <div><button type="button" class="sim">Atualizar</button><button type="button" class="nao">Depois</button></div>`;
      novo.querySelector(".sim").onclick = recarrega;
      novo.querySelector(".nao").onclick = () => { novo.classList.remove("on"); };
      if (!novo.dataset.v || novo.dataset.v !== String(v.versao)) { novo.dataset.v = v.versao; novo.classList.add("on"); }
      esperando.splice(0).forEach(fn => { try { fn(v); } catch (e) {} });
    }
  }

  async function ver() {
    clearTimeout(timer);
    if (!document.hidden) {
      try { const r = await fetch("/api/dados_versao", { cache: "no-store" }); if (r.ok) { ult = await r.json(); mostra(ult); } } catch (e) {}
    }
    const ativo = ult && (ult.coleta || ult.preparando || ult.aquecendo || esperando.length || querAtualizar);
    timer = setTimeout(ver, ativo ? 3000 : 25000);
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden) ver(); });
  setTimeout(ver, 1500);

  window.DadosVersao = {
    /** chama fn quando a versão nova for publicada (depois de uma coleta) */
    quandoPronto(fn) { esperando.push(fn); ver(); },
    /** atualiza agora se já estiver pronto; senão, assim que ficar pronto (sem recarregar com números pela metade) */
    atualizar() {
      if (ult && ult.versao !== inicial) return recarrega();
      querAtualizar = true; pil.innerHTML = "<i></i><span>Preparando os números novos… a página atualiza sozinha.</span>"; pil.classList.add("on");
      ver();
      setTimeout(() => { if (querAtualizar && !(ult && (ult.coleta || ult.aquecendo || ult.preparando))) recarrega(); }, 6000);
    },
    get estado() { return ult; }
  };
})();
