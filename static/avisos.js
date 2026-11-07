/* Avisos do dia — o último dia útil inteiro + o andamento de hoje (1ª coleta do dia → agora). VWAJ 2026 */
const Avisos = (() => {
  let dados = null;
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  const n = v => (v ?? 0).toLocaleString('pt-BR');

  const SITE = !!window.ESTATICO;            // site de leitura: cada navegador lembra a sua última visita
  const CHAVE = 'avVistoDia';
  const DSEM = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const ler = () => { try { return localStorage.getItem(CHAVE); } catch (e) { return null; } };
  const gravar = v => { try { localStorage.setItem(CHAVE, v); } catch (e) {} };
  const dm = iso => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  const dmh = iso => `${dm(iso)} ${iso.slice(11, 16)}`;

  // Site: monta o mesmo resumo do painel a partir de dados/avisos.json (só números, sem nomes)
  function montarSite(j) {
    const cs = (j.coletas || []).slice().sort((a, b) => a.t < b.t ? -1 : 1);
    if (!cs.length) return {tem: false};
    const cur = cs[cs.length - 1], hoje = j.hoje, U = j.ultimo_dia, visto = ler();
    const rot = iso => { const dt = new Date(iso + 'T12:00:00'); return `${DSEM[dt.getDay()]} ${dm(iso)}`; };
    const dias = (j.dias || []).filter(x => x.dia >= U && x.dia < hoje && (x.util || x.acoes)).map(x => ({...x, rot: rot(x.dia), sem: x.sem || 0, pouca: [], top: []}));
    const tot = {fiscalizou: 0, criou: 0, fechou: 0}, tipos = {};
    dias.forEach(x => { for (const k in tot) tot[k] += x[k] || 0; for (const [t, v] of Object.entries(x.tipos || {})) tipos[t] = (tipos[t] || 0) + v; });
    const prim = dia => { const d = cs.filter(c => c.t.slice(0, 10) === dia); return d.length ? d[0] : [...cs].reverse().find(c => c.t.slice(0, 10) < dia); };
    const h = (j.dias || []).find(x => x.dia === hoje), c1 = prim(hoje);
    const hojeBl = h ? {...h, rot: rot(hoje), de: c1 && c1.t.slice(0, 10) === hoje ? c1.t.slice(11, 16) : null,
      ate: cur.t.slice(0, 10) === hoje ? cur.t.slice(11, 16) : null, aberto_ini: c1 && c1.t.slice(0, 10) === hoje ? c1.total : null, aberto_agora: cur.total} : null;
    const cu = prim(U);
    const aberto = cu && cu.t !== cur.t ? {antes: cu.total, agora: cur.total, dif: (cur.total || 0) - (cu.total || 0)} : null;
    const Ur = rot(U), dest = [];
    const ontemD = new Date(hoje + 'T12:00:00'); ontemD.setDate(ontemD.getDate() - 1);
    const ehOntem = ontemD.toISOString().slice(0, 10) === U, quando = ehOntem ? 'ontem' : `na ${Ur.split(' ')[0]}`;
    const lotes = (j.fiscais || []).map(f => {
      const nd = (f.dias || {})[U] || 0, hj = (f.dias || {})[hoje] || 0, tt = f.total || 0;
      return {nome: `${f.n_dem} demanda${f.n_dem === 1 ? '' : 's'} pendente${f.n_dem === 1 ? '' : 's'}`, resp: f.resp, entrega: null, total: tt, feitos: f.feitos,
              no_dia: nd, hoje: hj, pct: f.pct, pct_antes: tt ? Math.max(Math.round((f.feitos - nd - hj) / tt * 100), 0) : 0, falta: f.falta, prazo: null, ult_avanco: f.ultimo};
    }).sort((a, b) => (b.no_dia + b.hoje) - (a.no_dia + a.hoje) || b.falta - a.falta);
    dias.forEach(x => {
      const R = x.rot.charAt(0).toUpperCase() + x.rot.slice(1);
      if (x.util && x.completo) dest.push(x.sem ? {nivel: 'alerta', txt: `${R}: ${x.fiscais - x.sem} de ${x.fiscais} fiscais trabalharam (${x.fiscalizou} fiscalizações)`}
                                                : {nivel: 'ok', txt: `${R}: todos os ${x.fiscais} fiscais trabalharam (${x.fiscalizou} fiscalizações, ${x.criou} criados)`});
      else if (!x.util) dest.push({nivel: 'info', txt: `${R}: ${x.ativos} fiscal(is) trabalharam ${x.feriado ? 'no feriado (' + x.feriado + ')' : 'no fim de semana'}`});
    });
    const parados = [];
    lotes.forEach(l => { if (l.no_dia || l.hoje) dest.push({nivel: 'ok', txt: `${l.resp}: ${[l.no_dia ? `+${l.no_dia} ${quando}` : '', l.hoje ? `+${l.hoje} hoje` : ''].filter(Boolean).join(' · ')} nas demandas · faltam ${l.falta}`});
      else if (l.falta) parados.push(`${l.resp} (${l.falta})`); });
    if (parados.length) dest.push({nivel: 'alerta', txt: `Sem avanço nas demandas ${quando}: ${parados.slice(0, 8).join(', ')}${parados.length > 8 ? '…' : ''}`});
    return {tem: true, novo: visto !== U, visto_chave: U, ultimo_dia: U, ultimo_rot: Ur, ontem: ehOntem, de: cu ? dmh(cu.t) : null, ate: dmh(cur.t),
            dias, tot, tipos: Object.entries(tipos).sort((a, b) => b[1] - a[1]).slice(0, 8), hoje: hojeBl, aberto, lotes: lotes.slice(0, 10), destaques: dest.slice(0, 12)};
  }

  async function carregar() {
    try {
      dados = SITE ? montarSite(await (await fetch('dados/avisos.json', {cache: 'no-store'})).json())
                   : await (await fetch('/api/avisos', {cache: 'no-store'})).json();
    } catch (e) { dados = {tem: false}; }
    const novo = !!(dados && dados.tem && dados.novo);
    $('avPonto').hidden = !novo;
    $('avSelo').classList.toggle('novo', novo);            // pisca em vermelho até a pessoa abrir
    return dados;
  }

  function diaHtml(d) {
    const tag = d.util ? (d.completo ? '<span class="av-tag ok">dia completo</span>' : '<span class="av-tag and">em andamento</span>')
                       : `<span class="av-tag fds">${d.feriado ? 'feriado · ' + esc(d.feriado) : 'fim de semana'}</span>`;
    const nSem = typeof d.sem === 'number' ? d.sem : d.sem.length;
    const sem = typeof d.sem === 'number' ? (d.sem ? `<div class="av-sem"><b>${d.sem} fiscal(is) sem atividade</b> neste dia.</div>` : (d.util && !d.completo ? '<div class="av-pouca">Dia ainda em andamento: os números fecham com a coleta depois das 17h.</div>' : ''))
      : d.sem.length ? `<div class="av-sem"><b>Sem atividade (${d.sem.length}):</b> ${d.sem.map(esc).join(', ')}</div>` : (d.util && !d.completo ? '<div class="av-pouca">Dia ainda em andamento: os números fecham com a coleta depois das 17h.</div>' : '');
    const pouca = d.pouca.length ? `<div class="av-pouca"><b>Pouca atividade:</b> ${d.pouca.map(esc).join(', ')}</div>` : '';
    const top = d.top.length ? `<details class="av-top"><summary>conferir a atividade (${d.ativos} fiscal${d.ativos === 1 ? '' : 'is'})</summary><div>${d.top.map(f =>
      `<span><b>${esc(f.nome)}</b> ${f.n}<small>${f.fisc ? ` · ${f.fisc} fisc.` : ''}${f.criou ? ` · ${f.criou} criados` : ''}</small></span>`).join('')}</div></details>` : '';
    return `<div class="av-dia ${d.util ? '' : 'fds'} ${nSem && d.completo ? 'falta' : ''}">
      <div class="av-dia-cab"><b>${esc(d.rot)}</b>${tag}
        <a href="${SITE ? 'desempenho.html' : '/desempenho?dia=' + d.dia}" class="av-link">${SITE ? 'Desempenho ›' : 'abrir o dia ›'}</a></div>
      <div class="av-nums"><span><b>${n(d.fiscalizou)}</b> fiscalizações</span><span><b>${n(d.criou)}</b> criados</span>
        <span><b>${n(d.fechou)}</b> finalizados</span><span><b>${d.ativos}/${d.fiscais}</b> fiscais ativos</span>${d.horas && d.horas !== '—' ? `<span>jornada média <b>${esc(d.horas)}</b></span>` : ''}</div>
      ${sem}${pouca}${top}</div>`;
  }

  function render(d) {
    const quem = d.ontem ? 'Ontem' : 'Último dia trabalhado';
    if ($('avTit')) $('avTit').textContent = d.tem ? `${quem} e hoje` : 'Avisos do dia';
    $('avPeriodo').textContent = d.tem ? `${quem}: ${d.ultimo_rot} inteiro · hoje: ${d.hoje && d.hoje.de ? 'da 1ª coleta (' + d.hoje.de + ') até ' + (d.hoje.ate || 'agora') : 'ainda sem coleta'}` : '';
    if (!d.tem) { $('avCorpo').innerHTML = '<div class="av-carregando">Ainda não há coletas para resumir.</div>'; return; }
    const dest = d.destaques.length ? `<ul class="av-dest">${d.destaques.map(x => `<li class="${x.nivel}">${esc(x.txt)}</li>`).join('')}</ul>` : '';
    const a = d.aberto, H = d.hoje;
    const hoje = H ? `<div class="av-hoje"><div class="av-hoje-t"><b>Andamento de hoje</b><span>${esc(H.rot)}${H.de ? ` · da 1ª coleta (${H.de}) até ${H.ate || 'agora'}` : ' · ainda sem coleta hoje'}</span></div>
      <div class="av-hoje-n"><span><b>${n(H.fiscalizou)}</b> fiscalizações</span><span><b>${n(H.criou)}</b> criados</span><span><b>${n(H.fechou)}</b> finalizados</span>
        <span><b>${H.ativos}/${H.fiscais}</b> fiscais com registro</span>${H.aberto_ini != null ? `<span>em aberto <b>${n(H.aberto_ini)} → ${n(H.aberto_agora)}</b></span>` : ''}</div></div>` : '';
    const kpis = `<h3>${d.ontem ? 'Ontem · ' : 'Último dia trabalhado · '}${esc(d.ultimo_rot || '')}${d.dias.length > 1 ? ' e o fim de semana/feriado seguinte' : ''}</h3><div class="av-kpis">
      <div><b>${n(d.tot.fiscalizou)}</b><span>fiscalizações</span></div>
      <div><b>${n(d.tot.criou)}</b><span>IDs criados</span></div>
      <div><b>${n(d.tot.fechou)}</b><span>finalizados</span></div>
      ${a ? `<div class="${a.dif > 0 ? 'sobe' : a.dif < 0 ? 'desce' : ''}"><b>${n(a.antes)} → ${n(a.agora)}</b><span>em aberto · 1ª coleta de ${esc((d.ultimo_rot || '').split(' ')[0])} → agora</span></div>` : ''}
    </div>`;
    const mx = Math.max(1, ...d.tipos.map(t => t[1]));
    const tipos = d.tipos.length ? `<h3>Serviços ${d.ontem ? 'de ontem' : 'no último dia trabalhado'}</h3><div class="av-tipos">${d.tipos.map(([t, v]) =>
      `<span>${esc(t)}</span><div><i style="width:${Math.round(v / mx * 100)}%"></i></div><b>${n(v)}</b>`).join('')}</div>` : '';
    const lotes = d.lotes.length ? `<h3>Demandas por fiscal</h3><div class="av-lotes">${d.lotes.map(l =>
      `<div class="av-lote"><div class="av-lote-cab"><b>${esc(l.resp || l.nome)}</b><small class="av-lote-nome">${l.entrega ? 'demanda ' + dm(l.entrega) + ' · ' : ''}${esc(l.nome)}</small><span>${l.no_dia || l.hoje ? `${l.no_dia ? `<em>+${l.no_dia}</em> ${d.ontem ? 'ontem' : 'no último dia trabalhado'}` : ''}${l.no_dia && l.hoje ? ' · ' : ''}${l.hoje ? `<em>+${l.hoje}</em> hoje` : ''} · ` : 'sem avanço · '}${l.pct}% · faltam ${n(l.falta)} de ${n(l.total)}${l.prazo ? ` · prazo ${l.prazo.slice(8, 10)}/${l.prazo.slice(5, 7)}` : ''}</span></div>
        <div class="av-barra"><i class="antes" style="width:${l.pct_antes}%"></i><i class="novo" style="width:${Math.max(l.pct - l.pct_antes, 0)}%"></i></div></div>`).join('')}</div>` : '';
    const dias = d.dias.length ? `<h3>Conferir o dia</h3>${d.dias.slice().reverse().map(diaHtml).join('')}` : '';
    const hojeAndou = H && (H.fiscalizou || H.criou || H.fechou);
    $('avCorpo').innerHTML = (hojeAndou ? hoje + dest : dest + hoje) + kpis + `<div class="av-grade"><div>${dias}</div><div>${lotes}${tipos}</div></div>` +
      `<p class="av-nota">O aviso olha o dia inteiro, não coleta por coleta. Um dia útil só fica “completo” com coleta depois das 17h dele
       (ou com a conferência do dia com o SIGA). Volta a piscar no dia seguinte.</p>`;
  }

  async function abrir() {
    $('avFundo').hidden = false;
    document.body.classList.add('av-aberto');
    if (!dados) { $('avCorpo').innerHTML = '<div class="av-carregando">Montando o resumo…</div>'; await carregar(); }
    render(dados);
  }
  function fechar() {
    $('avFundo').hidden = true; document.body.classList.remove('av-aberto');
    if (SITE && dados && dados.tem) { gravar(dados.visto_chave); $('avPonto').hidden = true; $('avSelo').classList.remove('novo'); }   // site: ver = visto
  }
  async function entendi() {
    if (SITE) { fechar(); return; }
    try { await fetch('/api/avisos/visto', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({dia: dados && dados.visto_chave})}); } catch (e) {}
    $('avPonto').hidden = true; $('avSelo').classList.remove('novo');
    if (dados) dados.novo = false;
    fechar();
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('avFundo').hidden) fechar(); });
  window.addEventListener('load', async () => {
    const d = await carregar();
    // painel local: abre sozinho na Visão geral uma vez por dia; no site de leitura só pisca (quem quiser, clica)
    if (!SITE && d && d.tem && d.novo && window.PAGINA === 'geral') abrir();
  });
  return {abrir, fechar, entendi, carregar};
})();
