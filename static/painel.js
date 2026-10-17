/* painel.js — utilidades compartilhadas do Painel de Acompanhamento de Fiscais */
const CORES = {VERDE:"#2E9D57",AMARELO:"#E8B524",LARANJA:"#EE7D22",VERMELHO:"#D63B32",VINHO:"#7A1F3D",CINZA:"#9AA5B1"};
const LEGENDA = {
  fiscalizacao: [["VERDE","Em dia"],["AMARELO","Atenção"],["LARANJA","Atrasado"],["VERMELHO","Crítico / nunca fiscalizado"]],
  tempo: [["VERDE","até 7 dias"],["AMARELO","8–30 dias"],["LARANJA","31–60 dias"],["VERMELHO","61–90 dias"],["VINHO","+90 dias ou nunca"]],
  criacao: [["VERDE","até 30 dias"],["AMARELO","31–60 dias"],["LARANJA","61–90 dias"],["VERMELHO","91–180 dias"],["VINHO","mais de 180 dias"]],
};
const ORDEM_COR = {fiscalizacao:["VERMELHO","LARANJA","AMARELO","VERDE"], tempo:["VINHO","VERMELHO","LARANJA","AMARELO","VERDE"], criacao:["VINHO","VERMELHO","LARANJA","AMARELO","VERDE","CINZA"]};
const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

const fmt = n => (n ?? 0).toLocaleString("pt-BR");
const pct = (a,b) => b ? Math.round(a/b*100) : 0;
const dataBR = iso => iso ? iso.slice(8,10)+"/"+iso.slice(5,7)+"/"+iso.slice(0,4) : "—";
const mesRot = ym => MESES[+ym.slice(5,7)-1]+"/"+ym.slice(0,4);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const unico = arr => [...new Set(arr)];
function fimDoMes(ym){ const [a,m]=ym.split("-").map(Number); const d=new Date(Date.UTC(a,m,0)); return d.toISOString().slice(0,10); }

function toast(msg, ms=2600){ const t=document.getElementById("toast"); t.textContent=msg; t.style.display="block"; clearTimeout(t._t); t._t=setTimeout(()=>t.style.display="none",ms); }

/* ── Versão de leitura: as chamadas /api viram arquivos .json publicados junto ── */
if(window.ESTATICO){
  const _fetch=window.fetch.bind(window);
  const naoTem=msg=>Promise.resolve(new Response(JSON.stringify({erro:msg||"Disponível só no painel local."}),{status:200,headers:{"Content-Type":"application/json"}}));
  window.fetch=(u,o)=>{
    if(typeof u!=="string"||!u.startsWith("/")) return _fetch(u,o);
    const [cam,qs]=u.split("?"), p=new URLSearchParams(qs||"");
    let m=cam.match(/^\/api\/ordens\/(\d+)$/); if(m) return _fetch(`dados/ordens_${m[1]}.json`,o);
    m=cam.match(/^\/api\/desempenho\/(dia|semana)$/);
    if(m){ const t=p.getAll("tipo"); const tk=!t.length?"todos":(t.length===1&&/buraco\s*siga/i.test(t[0]))?"buraco":null;
      if(!tk) return naoTem("Na versão de leitura o filtro de tipo tem só “Todos” e “Só Buraco Siga”.");
      const chave=m[1]==="dia"?p.get("dia"):p.get("semana");
      return _fetch(`dados/${m[1]}_${chave}_${p.get("natureza")||"todas"}_${tk}.json`,o).then(r=>r.ok?r:naoTem("Esse dia não foi publicado na versão de leitura.")); }
    if(cam==="/api/tempo_real"){ const t=(p.get("tipo")||"").toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g,"_");
      return _fetch(`dados/tempo_real_${t}.json`,o).then(r=>r.ok?r:naoTem("Painel não publicado.")); }
    if(cam==="/api/desempenho/evolucao"){ const t=p.getAll("tipo"); const tk=!t.length?"todos":(t.length===1&&/buraco\s*siga/i.test(t[0]))?"buraco":null;
      if(!tk) return naoTem("Na versão de leitura o filtro de tipo tem só “Todos” e “Só Buraco Siga”.");
      return _fetch(`dados/evolucao_${p.get("gran")||"semana"}_${p.get("natureza")||"todas"}_${tk}.json`,o).then(r=>r.ok?r:naoTem()); }
    return naoTem();
  };
}

/* ── Dados ───────────────────────────────────────────── */
async function carregarColeta(cid){
  const r = await fetch(`/api/ordens/${cid}`); const j = await r.json();
  const cols = j.dados.cols;
  const rows = j.dados.rows.map(v => { const o={}; cols.forEach((c,i)=>o[c]=v[i]); o.via=o.logradouro+" · "+o.bairro; return o; });
  return {coleta:j.coleta, rows};
}

/* Filtro rápido ("foco"), ligado pelos cards da Visão geral. Vale também no PDF/WhatsApp/Excel da demanda. */
function focoInfo(base, f){
  const fo=f.foco; if(!fo) return null;
  const modo=modoCor(f);
  if(fo==="crit"){ const c=modo==="fiscalizacao"?["VERMELHO"]:["VINHO","VERMELHO"];
    return {rot: modo==="fiscalizacao"?"Críticos no prazo SIGA":modo==="tempo"?"Mais de 60 dias sem fiscalizar":"Criados há mais de 90 dias", fn:o=>c.includes(corDe(o,modo))}; }
  if(fo==="nunca") return {rot:"Nunca fiscalizados", fn:o=>!o.ult_fiscal};
  if(fo==="acima"){ const s=base.filter(o=>o.ult_fiscal), m=s.length?Math.round(s.reduce((a,o)=>a+o.dias_fiscal,0)/s.length):0;
    return {rot:`Sem fiscalizar há mais de ${m} dias (acima da média)`, fn:o=>o.ult_fiscal&&o.dias_fiscal>m}; }
  if(fo==="principais") return {rot:"Só vias arteriais e coletoras", fn:o=>o.tipo_via!=="Local"};
  if(fo==="novos") return f._antIdx ? {rot:"OS novas desde a coleta anterior", fn:o=>!f._antIdx.has(o.os_id)} : {rot:"OS novas desde a coleta anterior", fn:()=>true};
  if(fo.startsWith("mes:")){ const m=fo.slice(4), campo=f.modo==="criacao"?"data_abertura":"ult_fiscal";
    return {rot:(f.modo==="criacao"?"Criados em ":"Última fiscalização em ")+mesRot(m), fn:o=>(o[campo]||"").startsWith(m)}; }
  return null;
}

function filtrar(rows, f){
  const base=filtrarBase(rows,f), fi=focoInfo(base,f);
  return fi ? base.filter(fi.fn) : base;
}
function filtrarBase(rows, f){
  const setT=new Set(f.tipos), setR=new Set(f.rpas), setB=new Set(f.bairros), setF=new Set(f.fiscais), setV=new Set(f.vias);
  return rows.filter(o=>{
    if(setT.size && !setT.has(o.tipo_servico)) return false;
    if(setR.size && !setR.has(o.rpa)) return false;
    if(setB.size && !setB.has(o.bairro)) return false;
    if(setF.size && !setF.has(o.fiscal_nome)) return false;
    if(setV.size && !setV.has(o.tipo_via)) return false;
    if(f.ate){
      if(f.modo==="criacao"){ if(!o.data_abertura || o.data_abertura > f.ate) return false; }
      else { if(o.ult_fiscal){ if(o.ult_fiscal > f.ate) return false; } else if(!f.nunca) return false; }
    }
    return true;
  });
}

function corTempo(d){ if(d==null) return "VINHO"; return d<=7?"VERDE":d<=30?"AMARELO":d<=60?"LARANJA":d<=90?"VERMELHO":"VINHO"; }
function corDe(o, modo){ return modo==="criacao" ? o.cor_criacao : modo==="tempo" ? corTempo(o.dias_fiscal) : o.cor_fiscal; }
function modoCor(f){ return f.modo==="criacao" ? "criacao" : (f.cor==="tempo" ? "tempo" : "fiscalizacao"); }

function agrupar(rows, chave, modo){
  const m=new Map();
  for(const o of rows){
    const k = typeof chave==="function" ? chave(o) : o[chave];
    let g=m.get(k); if(!g){ g={chave:k,total:0,cores:{},nunca:0,ids:[]}; m.set(k,g); }
    g.total++; const c=corDe(o,modo); g.cores[c]=(g.cores[c]||0)+1; if(!o.ult_fiscal) g.nunca++; g.ids.push(o.os_id);
  }
  return [...m.values()].sort((a,b)=>b.total-a.total || String(a.chave).localeCompare(String(b.chave)));
}

function barraPilha(cores, total, modo){
  return `<div class="barra-pilha" title="${ORDEM_COR[modo].filter(c=>cores[c]).map(c=>c+": "+cores[c]).join(" · ")}">`+
    ORDEM_COR[modo].filter(c=>cores[c]).map(c=>`<i style="width:${cores[c]/total*100}%;background:${CORES[c]}"></i>`).join("")+`</div>`;
}

function legendaHTML(modo){ return LEGENDA[modo].map(([c,t])=>`<span><i class="bolinha" style="background:${CORES[c]}"></i>${t}</span>`).join(""); }

/* ── Mapa ─────────────────────────────────────────────── */
function criarMapa(id){
  const m = L.map(id,{preferCanvas:true, zoomControl:true}).setView([-8.06,-34.92],12);
  const C=window.CARTO||{}, est=(C.estilo||"light_all");
  const url = C.osm ? "https://tile.openstreetmap.org/{z}/{x}/{y}.png" : C.key ? `https://basemaps.cartocdn.com/rastertiles/${est}/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(C.key)}`
                    : `https://{s}.basemaps.cartocdn.com/${est}/{z}/{x}/{y}{r}.png`;
  L.tileLayer(url,
    {maxZoom:19, attribution: C.osm ? '&copy; OpenStreetMap' : '&copy; OpenStreetMap &copy; CARTO'}).addTo(m);
  m._camada = L.layerGroup().addTo(m);
  return m;
}
function popupHTML(o, extra=""){
  const cf=CORES[o.cor_fiscal]||"#999";
  const gm = o.lat ? `<a href="https://www.google.com/maps?q=${o.lat},${o.lng}" target="_blank">Abrir no Google Maps ↗</a>` : "";
  return `<div><span class="pop-id">ID ${esc(o.os_id)}</span><span class="pop-tag" style="background:${cf}">${o.ult_fiscal? o.dias_fiscal+" d sem fiscalizar":"nunca fiscalizado"}</span>
  <div style="margin-top:4px"><b>${esc(o.tipo_servico)}</b></div>
  <div>${esc(o.logradouro)} ${o.trecho? "· "+esc(o.trecho):""}</div>
  <div style="color:#5F7180">${esc(o.bairro)} · ${esc(o.rpa)} · via ${esc(o.tipo_via)}</div>
  <div style="margin-top:4px">Última fiscalização: <b>${dataBR(o.ult_fiscal)}</b><br>Criada em: <b>${dataBR(o.data_abertura)}</b> (${o.dias_criacao ?? "?"} dias)<br>Fiscal: ${esc(o.fiscal_nome)}</div>
  ${extra}<div style="margin-top:4px">${gm}${window.ESTATICO?"":` · <a href="#" onclick="abrirHistorico('${esc(o.os_id)}');return false">histórico do ID</a>`}</div></div>`;
}
function plotar(mapa, rows, modo, ajustar=true, extraFn=null){
  mapa._camada.clearLayers();
  const pts=[];
  const ordem = ORDEM_COR[modo].slice().reverse();   // críticos por cima
  const ordenado = rows.filter(o=>o.lat).sort((a,b)=>ordem.indexOf(corDe(a,modo))-ordem.indexOf(corDe(b,modo)));
  for(const o of ordenado){
    const c=CORES[corDe(o,modo)]||"#999";
    L.circleMarker([o.lat,o.lng],{radius:5.5,color:"#fff",weight:1.2,fillColor:c,fillOpacity:.92})
      .bindPopup(()=>popupHTML(o, extraFn? extraFn(o):"")).addTo(mapa._camada);
    pts.push([o.lat,o.lng]);
  }
  if(ajustar && pts.length) mapa.fitBounds(pts,{padding:[24,24],maxZoom:16});
  return ordenado.length;
}

/* ── Dropdown de múltipla escolha ─────────────────────── */
function criarMulti(el, rotulo, opcoes, selecionados, onChange){
  // opcoes: [{valor, qt}]
  el.classList.add("dropdown");
  const sel=new Set(selecionados);
  el.innerHTML = `<button type="button" class="btn"><span class="txt"></span><span>▾</span></button>
    <div class="dd-painel"><div class="dd-acoes"><input type="search" placeholder="Buscar…"><button type="button" class="btn peq" data-a="todos">Todos</button><button type="button" class="btn peq" data-a="limpar">Limpar</button></div><div class="lista"></div></div>`;
  const btn=el.querySelector("button"), txt=el.querySelector(".txt"), lista=el.querySelector(".lista"), busca=el.querySelector("input");
  function rot(){ txt.textContent = sel.size===0 ? `${rotulo}: todos` : sel.size===1 ? [...sel][0] : `${rotulo}: ${sel.size} selecionados`; }
  function desenhar(){
    const q=busca.value.toLowerCase();
    lista.innerHTML = opcoes.filter(o=>!q || String(o.valor).toLowerCase().includes(q)).map(o=>
      `<label><input type="checkbox" value="${esc(o.valor)}" ${sel.has(o.valor)?"checked":""}> ${esc(o.valor)} <span class="qt">${o.qt!=null?fmt(o.qt):""}</span></label>`).join("") || `<div class="vazio" style="padding:12px">Nada encontrado</div>`;
  }
  btn.onclick=e=>{ e.stopPropagation(); document.querySelectorAll(".dropdown.aberto").forEach(d=>d!==el&&d.classList.remove("aberto")); el.classList.toggle("aberto"); busca.focus(); };
  el.querySelector(".dd-painel").onclick=e=>e.stopPropagation();
  busca.oninput=desenhar;
  lista.onchange=e=>{ const v=e.target.value; e.target.checked?sel.add(v):sel.delete(v); rot(); onChange([...sel]); };
  el.querySelectorAll("[data-a]").forEach(b=>b.onclick=()=>{ sel.clear(); if(b.dataset.a==="todos"){ /* vazio = todos */ } desenhar(); rot(); onChange([]); });
  rot(); desenhar();
  return {set:(vals)=>{ sel.clear(); vals.forEach(v=>sel.add(v)); rot(); desenhar(); }, atualizarOpcoes:(op)=>{ opcoes=op; desenhar(); }};
}
document.addEventListener("click",()=>document.querySelectorAll(".dropdown.aberto").forEach(d=>d.classList.remove("aberto")));

/* ── Barra de filtros reutilizável ────────────────────── */
function lerFiltrosURL(){
  const p=new URLSearchParams(location.search);
  return {modo:p.get("modo")||"fiscalizacao", ate:p.get("ate")||null, tipos:p.getAll("tipo"), rpas:p.getAll("rpa"),
          bairros:p.getAll("bairro"), fiscais:p.getAll("fiscal"), vias:p.getAll("via"), nunca:p.get("nunca")!=="0", cor:p.get("cor")||"siga", foco:p.get("foco")||null, _temURL:p.has("modo")||p.has("ate")};
}
function filtrosParaQuery(f){
  const p=new URLSearchParams(); p.set("modo",f.modo); if(f.ate) p.set("ate",f.ate);
  f.tipos.forEach(v=>p.append("tipo",v)); f.rpas.forEach(v=>p.append("rpa",v)); f.bairros.forEach(v=>p.append("bairro",v));
  f.fiscais.forEach(v=>p.append("fiscal",v)); f.vias.forEach(v=>p.append("via",v)); p.set("nunca",f.nunca?"1":"0"); if(f.cor==="tempo") p.set("cor","tempo"); if(f.foco) p.set("foco",f.foco);
  return p.toString();
}
function descreverFiltro(f){
  const p=[];
  if(f.ate){ p.push(f.modo==="criacao" ? `Criados até ${dataBR(f.ate)}` : `Última fiscalização até ${dataBR(f.ate)}${f.nunca?" + nunca fiscalizados":""}`); }
  else p.push("Todos em aberto");
  if(f.tipos.length) p.push(f.tipos.length<=3? f.tipos.join(", ") : f.tipos.length+" tipos");
  if(f.rpas.length) p.push(f.rpas.join(", "));
  if(f.bairros.length) p.push(f.bairros.length<=3? f.bairros.join(", ") : f.bairros.length+" bairros");
  if(f.fiscais.length) p.push("Fiscal: "+f.fiscais.join(", "));
  if(f.vias.length) p.push("Via "+f.vias.join("/"));
  const fi=f.foco? focoInfo([],f):null; if(fi) p.push("Filtro: "+fi.rot.replace(/ \(acima da média\)/,""));
  return p.join(" · ");
}

function montarBarraFiltros(cont, rows, f, onChange, opts={}){
  const meses = m => unico(rows.map(o=>(m==="criacao"?o.data_abertura:o.ult_fiscal)||"").filter(Boolean).map(d=>d.slice(0,7))).sort().reverse();
  const contar = k => agrupar(rows,k,"fiscalizacao").map(g=>({valor:g.chave,qt:g.total})).sort((a,b)=>String(a.valor).localeCompare(String(b.valor),"pt-BR"));
  const rpas = unico(rows.map(o=>o.rpa)).sort();
  cont.innerHTML = `
   <div class="campo"><label>Analisar por</label>
     <div class="seg" id="fModo"><button data-v="fiscalizacao">Prazo da última fiscalização</button><button data-v="criacao">Data de criação</button></div></div>
   <div class="campo" id="fCorCampo"><label>Colorir por</label>
     <div class="seg" id="fCor"><button data-v="siga">Prazo SIGA</button><button data-v="tempo">Tempo sem fiscalizar</button></div></div>
   <div class="campo"><label id="fAteRot"></label>
     <div style="display:flex;gap:6px"><select id="fMes"></select><input type="date" id="fData" style="display:none"></div></div>
   <div class="campo"><label>Tipo de serviço</label><div id="fTipos"></div></div>
   <div class="campo"><label>RPA</label><div class="chips" id="fRpas">${rpas.map(r=>`<span class="chip" data-v="${esc(r)}">${esc(r.replace("RPA ","")) }</span>`).join("")}</div></div>
   <div class="campo"><label>Bairro</label><div id="fBairros"></div></div>
   <div class="campo"><label>Tipo de via</label><div class="chips" id="fVias">${["Arterial","Coletora","Local"].map(v=>`<span class="chip" data-v="${v}">${v}</span>`).join("")}</div></div>
   <div class="campo"><label>Fiscal</label><div id="fFiscais"></div></div>
   <div class="campo" id="fNuncaCampo"><label>Nunca fiscalizados</label><label style="display:flex;gap:6px;align-items:center;min-height:36px;font-size:13px"><input type="checkbox" id="fNunca"> incluir</label></div>`;
  const $=s=>cont.querySelector(s);
  const disparar=()=>onChange(f);

  function desenharMeses(){
    const ms=meses(f.modo);
    $("#fAteRot").textContent = f.modo==="criacao" ? "Criados até o fim de" : "Sem fiscalização desde (até o fim de)";
    const opcoesMes = ms.map(m=>`<option value="${fimDoMes(m)}">${mesRot(m)} e anteriores</option>`).join("");
    $("#fMes").innerHTML = `<option value="">Todos (sem corte)</option>${opcoesMes}<option value="__data">Data exata…</option>`;
    const casa = f.ate && [...$("#fMes").options].some(o=>o.value===f.ate);
    if(f.ate && !casa){ $("#fMes").value="__data"; $("#fData").style.display=""; $("#fData").value=f.ate; }
    else { $("#fMes").value=f.ate||""; $("#fData").style.display="none"; }
    $("#fNuncaCampo").style.display = f.modo==="criacao" ? "none":"";
    $("#fCorCampo").style.display = f.modo==="criacao" ? "none":"";
  }
  $("#fModo").querySelectorAll("button").forEach(b=>{ b.classList.toggle("on",b.dataset.v===f.modo);
    b.onclick=()=>{ f.modo=b.dataset.v; $("#fModo").querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b)); desenharMeses(); disparar(); }; });
  $("#fCor").querySelectorAll("button").forEach(b=>{ b.classList.toggle("on",b.dataset.v===(f.cor||"siga"));
    b.onclick=()=>{ f.cor=b.dataset.v; $("#fCor").querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b)); disparar(); }; });
  $("#fMes").onchange=e=>{ if(e.target.value==="__data"){ $("#fData").style.display=""; $("#fData").focus(); return; } $("#fData").style.display="none"; f.ate=e.target.value||null; disparar(); };
  $("#fData").onchange=e=>{ f.ate=e.target.value||null; disparar(); };
  $("#fNunca").checked=f.nunca; $("#fNunca").onchange=e=>{ f.nunca=e.target.checked; disparar(); };
  const chips=(id,key)=>{ $(id).querySelectorAll(".chip").forEach(c=>{ c.classList.toggle("on",f[key].includes(c.dataset.v));
    c.onclick=()=>{ c.classList.toggle("on"); f[key]=[...$(id).querySelectorAll(".chip.on")].map(x=>x.dataset.v); disparar(); }; }); };
  chips("#fRpas","rpas"); chips("#fVias","vias");
  const mT=criarMulti($("#fTipos"),"Tipos",contar("tipo_servico"),f.tipos,v=>{f.tipos=v;disparar();});
  const mB=criarMulti($("#fBairros"),"Bairros",contar("bairro"),f.bairros,v=>{f.bairros=v;disparar();});
  const mF=criarMulti($("#fFiscais"),"Fiscais",contar("fiscal_nome"),f.fiscais,v=>{f.fiscais=v;disparar();});
  desenharMeses();
  return {
    setBairro:(b)=>{ f.bairros=b?[b]:[]; mB.set(f.bairros); disparar(); },
    setRpa:(r)=>{ f.rpas=r?[r]:[]; chips("#fRpas","rpas"); disparar(); },
    setTipo:(t)=>{ f.tipos=t?[t]:[]; mT.set(f.tipos); disparar(); },
    setFiscal:(x)=>{ f.fiscais=x?[x]:[]; mF.set(f.fiscais); disparar(); },
  };
}

/* ── Gráficos (Chart.js) ─────────────────────────────── */
if(window.Chart){
  Chart.defaults.font.family="Inter, system-ui, sans-serif"; Chart.defaults.font.size=12; Chart.defaults.color="#5F7180";
  Chart.defaults.plugins.legend.labels.boxWidth=10; Chart.defaults.plugins.legend.labels.boxHeight=10;
}
function grafLinha(canvas, rotulos, valores){
  if(canvas._g) canvas._g.destroy();
  canvas._g=new Chart(canvas,{type:"line",data:{labels:rotulos,datasets:[{data:valores,borderColor:"#1C4250",backgroundColor:"rgba(28,66,80,.08)",fill:true,tension:.25,pointRadius:0,borderWidth:2}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{mode:"index",intersect:false,callbacks:{label:c=>fmt(c.parsed.y)+" em aberto"}}},
      scales:{x:{display:false},y:{grid:{color:"#EEF1F4"},ticks:{maxTicksLimit:4}}}}});
  return canvas._g;
}
function grafBarras(canvas, rotulos, series, opts={}){
  if(canvas._g) canvas._g.destroy();
  canvas._g = new Chart(canvas,{type:"bar",data:{labels:rotulos,datasets:series.map(s=>({borderRadius:3,maxBarThickness:38,...s}))},
    options:{responsive:true,maintainAspectRatio:false,indexAxis:opts.horizontal?"y":"x",
      plugins:{legend:{display:series.length>1,position:"bottom"},tooltip:{callbacks:{label:c=>`${c.dataset.label||""}: ${fmt(c.parsed[opts.horizontal?"x":"y"])}`}}},
      scales:{x:{stacked:!!opts.empilhado,grid:{display:!!opts.horizontal,color:"#EEF1F4"}},y:{stacked:!!opts.empilhado,grid:{display:!opts.horizontal,color:"#EEF1F4"},beginAtZero:true}},
      onClick:opts.onClick? (e,el)=>{ if(el.length) opts.onClick(el[0].index); }:undefined}});
  return canvas._g;
}

/* ── Coleta (botão "Atualizar do SIGA") ──────────────── */
const Coleta = {
  async iniciar(){
    if(!confirm("Abrir o SIGA agora e puxar TUDO que está em aberto?\n\nO navegador vai abrir nesta máquina e a planilha chega por e-mail (alguns minutos).")) return;
    const r=await fetch("/api/coletar",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
    const j=await r.json(); if(!r.ok){ toast(j.erro||"Não foi possível iniciar", 5000); return; }
    this.acompanhar();
  },
  acompanhar(){
    const box=document.getElementById("statusColeta"), txt=document.getElementById("statusTexto"), btn=document.getElementById("btnColetar");
    box.style.display="flex"; btn.disabled=true;
    const t=setInterval(async()=>{
      const s=await (await fetch("/api/coleta/status")).json();
      txt.textContent=s.etapa||"…";
      if(s.estado==="ok"){ clearInterval(t); toast("Coleta concluída! Recarregando…"); setTimeout(()=>location.reload(),1200); }
      if(s.estado==="erro"||s.estado==="ocupado"){ clearInterval(t); btn.disabled=false; box.style.display="none"; alert((s.estado==="ocupado"?"":"A coleta falhou:\n")+s.etapa); }
      if(s.estado==="parado"){ clearInterval(t); btn.disabled=false; box.style.display="none"; }
    },2500);
  },
  async verificar(){ try{ const s=await (await fetch("/api/coleta/status")).json(); if(s.estado==="rodando") this.acompanhar(); }catch(e){} }
};
if(!window.ESTATICO) Coleta.verificar();

/* ── WhatsApp modal ───────────────────────────────────── */
async function abrirWhatsApp(query){
  const r=await fetch("/demanda/gerar?formato=whatsapp&"+query); const j=await r.json();
  let m=document.getElementById("modalWa");
  if(!m){ m=document.createElement("div"); m.id="modalWa"; m.className="modal-fundo"; document.body.appendChild(m);
    m.onclick=e=>{ if(e.target===m) m.classList.remove("aberto"); }; }
  m.innerHTML=`<div class="modal"><div class="card-cab"><h3>Texto para WhatsApp</h3><span class="sub">${fmt(j.total)} IDs</span>
    <div class="dir"><button class="btn peq" onclick="this.closest('.modal-fundo').classList.remove('aberto')">Fechar</button></div></div>
    <div class="card-corpo"><textarea id="waTexto">${esc(j.texto)}</textarea>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn prim" id="waCopiar">Copiar texto</button>
    <a class="btn wa" target="_blank" id="waAbrir">Abrir no WhatsApp</a>
    <span style="color:#8A99A6;font-size:12px;align-self:center">${j.texto.length>6000?"Texto longo: prefira enviar o PDF.":""}</span></div></div></div>`;
  m.classList.add("aberto");
  document.getElementById("waCopiar").onclick=async()=>{ await navigator.clipboard.writeText(j.texto); toast("Texto copiado"); };
  document.getElementById("waAbrir").href="https://wa.me/?text="+encodeURIComponent(j.texto.slice(0,6000));
}

/* ── Menu do topo: barrinha arrastável embaixo dos nomes ─ */
(function(){
  const nav=document.querySelector(".nav"); if(!nav) return;
  const caixa=document.createElement("div"); caixa.className="nav-caixa"; nav.parentNode.insertBefore(caixa,nav); caixa.appendChild(nav);
  const trilho=document.createElement("div"); trilho.className="nav-trilho"; trilho.title="Arraste para ver o resto do menu";
  const pol=document.createElement("div"); pol.className="nav-polegar"; trilho.appendChild(pol); caixa.appendChild(trilho);
  function marcar(){
    const rola=nav.scrollWidth>nav.clientWidth+2; caixa.classList.toggle("rola",rola);
    nav.classList.toggle("fade-esq",rola&&nav.scrollLeft>4); nav.classList.toggle("fade-dir",rola&&nav.scrollLeft+nav.clientWidth<nav.scrollWidth-4);
    if(!rola) return;
    const T=trilho.clientWidth, w=Math.max(40,T*nav.clientWidth/nav.scrollWidth), max=nav.scrollWidth-nav.clientWidth;
    pol.style.width=w+"px"; pol.style.left=(max? nav.scrollLeft/max*(T-w):0)+"px";
  }
  // arrastar a barrinha
  pol.addEventListener("pointerdown",e=>{ e.preventDefault(); pol.setPointerCapture(e.pointerId); pol.classList.add("arrastando");
    const x0=e.clientX, s0=nav.scrollLeft, T=trilho.clientWidth-pol.clientWidth, max=nav.scrollWidth-nav.clientWidth;
    const mv=ev=>{ nav.scrollLeft=s0+(ev.clientX-x0)*(T? max/T:0); };
    const up=()=>{ pol.classList.remove("arrastando"); pol.removeEventListener("pointermove",mv); pol.removeEventListener("pointerup",up); };
    pol.addEventListener("pointermove",mv); pol.addEventListener("pointerup",up); });
  // clicar no trilho pula para aquele ponto
  trilho.addEventListener("pointerdown",e=>{ if(e.target!==trilho) return; const r=trilho.getBoundingClientRect();
    nav.scrollTo({left:(e.clientX-r.left)/r.width*(nav.scrollWidth-nav.clientWidth),behavior:"smooth"}); });
  // arrastar os próprios nomes e rodinha do mouse também rolam
  let ini=null,x0=0,s0=0,moveu=false;
  nav.addEventListener("pointerdown",e=>{ if(e.button!==0||!caixa.classList.contains("rola")) return; ini=e.pointerId; x0=e.clientX; s0=nav.scrollLeft; moveu=false; });
  nav.addEventListener("pointermove",e=>{ if(ini!==e.pointerId) return; const dx=e.clientX-x0;
    if(Math.abs(dx)>5&&!moveu){ moveu=true; nav.classList.add("arrastando"); nav.setPointerCapture(e.pointerId); }
    if(moveu) nav.scrollLeft=s0-dx; });
  const fim=e=>{ if(ini!==e.pointerId) return; ini=null; setTimeout(()=>nav.classList.remove("arrastando"),0); };
  nav.addEventListener("pointerup",fim); nav.addEventListener("pointercancel",fim);
  nav.addEventListener("wheel",e=>{ if(!caixa.classList.contains("rola")||Math.abs(e.deltaY)<Math.abs(e.deltaX)) return; e.preventDefault(); nav.scrollLeft+=e.deltaY; },{passive:false});
  nav.addEventListener("scroll",marcar); window.addEventListener("resize",marcar);
  const at=nav.querySelector("a.ativo"); if(at && at.offsetLeft+at.offsetWidth>nav.clientWidth) nav.scrollLeft=at.offsetLeft-nav.clientWidth/2+at.offsetWidth/2;
  marcar(); setTimeout(marcar,600); document.fonts&&document.fonts.ready.then(marcar);
})();

/* ── Histórico de um ID (tudo que as coletas já viram dele) ── */
async function abrirHistorico(id){
  id=String(id||"").trim(); if(!id) return;
  const h=await (await fetch("/api/historico/"+encodeURIComponent(id))).json();
  let m=document.getElementById("modalHist");
  if(!m){ m=document.createElement("div"); m.id="modalHist"; m.className="modal-fundo"; document.body.appendChild(m); m.onclick=e=>{ if(e.target===m) m.classList.remove("aberto"); }; }
  const c=h.cadastro, ROT={criou:"Criado",fiscalizou:"Fiscalizado",fechou:"Saiu do aberto"}, COR={criou:"#2F6FB3",fiscalizou:"#2E9D57",fechou:"#9AA5B1"};
  m.innerHTML=`<div class="modal" style="width:min(720px,100%)"><div class="card-cab"><h3>Histórico do ID ${esc(id)}</h3>
    <div class="dir"><button class="btn peq" onclick="this.closest('.modal-fundo').classList.remove('aberto')">Fechar</button></div></div>
    <div class="card-corpo">${!c?`<div class="vazio">Esse ID nunca apareceu nas coletas do painel.</div>`:`
      <div><b style="color:var(--navy);font-size:15px">${esc(c.tipo_servico)}</b> · ${esc(c.logradouro)} ${c.trecho?"· "+esc(c.trecho):""}<br>
        <span style="color:var(--suave)">${esc(c.bairro)} · ${esc(c.rpa)} · login de ${esc(c.fiscal_nome)}</span><br>
        ${c.fechada_em?`<span class="tag">fora do aberto desde ${dataBR(c.fechada_em.slice(0,10))}</span>`:`<span class="tag verde">aberto na última coleta</span>`}
        <span style="font-size:12px;color:var(--muito-suave)"> · visto de ${dataBR((c.primeira_vez||"").slice(0,10))} a ${dataBR((c.ultima_vez||"").slice(0,10))} · ${h.fotos_guardadas} foto(s) guardada(s)</span></div>
      <table class="tabela"><thead><tr><th>Quando</th><th>O quê</th><th>Login (quem estava)</th><th></th></tr></thead><tbody>
      ${h.eventos.map(e=>`<tr><td class="num">${dataBR(e.dia)} ${e.hora||""}</td><td><i class="bolinha" style="background:${COR[e.acao]}"></i> ${ROT[e.acao]||e.acao}</td><td>${esc(e.fiscal_nome||"")}</td><td style="font-size:12px;color:var(--muito-suave)">${e.janela?"entre "+esc(e.janela):""}</td></tr>`).join("")}
      </tbody></table>
      <div style="font-size:12px;color:var(--muito-suave)">Cada visita aparece quando alguma coleta a pega como “última fiscalização”. Com coletas frequentes, quase todas ficam registradas.</div>`}</div></div>`;
  m.classList.add("aberto");
}

/* ── Andamento de uma coleta / publicação (etapas) ─────── */
const Progresso = {
  etapas: [["SIGA", /Iniciando|Entrando|Abrindo|Filtrando/], ["Exportação", /exporta|Muitos IDs|Sem confirmação/i],
           ["E-mail", /Aguardando o e-mail/], ["Planilha", /baixada/i], ["Histórico", /Tratando|Gravando/], ["Pronto", /Conclu/]],
  indice(et){ for(let i=this.etapas.length-1;i>=0;i--) if(this.etapas[i][1].test(et||"")) return i; return 0; },
  html(st, titulo){
    if(!st || st.estado==="parado" || !st.estado) return "";
    const rod=st.estado==="rodando", erro=st.estado==="erro"||st.estado==="ocupado", i=st.estado==="ok"?this.etapas.length-1:this.indice(st.etapa);
    const desde=st.atualizado? ` · ${st.atualizado.slice(11,16)}`:"";
    return `<div class="prog ${rod?"rodando":erro?"erro":"ok"}">
      <div class="prog-cab">${rod?'<div class="spin"></div>':erro?"⚠":"✓"}<b>${esc(titulo||"")}</b><span>${esc(st.etapa||"")}${desde}</span></div>
      <div class="prog-etapas">${this.etapas.map((e,k)=>`<i class="${k<i||st.estado==="ok"?"feito":k===i&&rod?"atual":k===i&&erro?"falhou":""}">${e[0]}</i>`).join("")}</div></div>`;
  }
};
