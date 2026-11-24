/* ==========================================================================
   SinucaON! - javinhas.js (a tela e o jogo: mesa em canvas, mira, força, efeito, robô, resultado, salvamento)
   Física: fisica.js e mesa.js. Regras: jogo.js e regras-*.js. Robô: bot.js (roda em robo.js, em segundo plano).
   Esses arquivos não mexem na tela e são testados no Node. Menu, sons, vibração e estatísticas do menu: on.js.

   Índice
   1. Dados, preferências e salvamento
   2. Geometria da tela (mesa de cima, deitada ou em pé) e desenho da mesa
   3. Bolas: orientação, sombreado por pixel e desenho
   4. Guia de mira, sobreposições e quadro completo
   5. Entrada: mira, força, efeito, bola na mão, caçapa cantada
   6. Tacada e animação (sons, vibração, fim da jogada)
   7. Andamento da partida (vez, robô, decisões, fim do quadro e da partida)
   8. Painel, placar e telas
   9. Nova partida, Como Jogar e início
   ========================================================================== */
(function () {
  'use strict';

  const F = window.Fisica, MS = window.Mesa, J = window.Jogo, BT = window.Bot, SO = window.Sorteio, TX = window.STXT || {};
  const $ = (s) => document.querySelector(s);

  /* ==========================================================================
     1. Dados, preferências e salvamento
     ========================================================================== */
  const LS = { prefs: 'sinucaon.prefs', jogo: 'sinucaon.jogo', stats: 'sinucaon.stats', visto: 'sinucaon.visto' };
  const sget = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const sset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sem espaço ou bloqueado */ } };
  const sdel = (k) => { try { localStorage.removeItem(k); } catch (e) { /* ignora */ } };

  const INFO = {
    brasileira: { nome: 'Sinuca Brasileira', sub: '7 bolas, bola da vez', desc: 'A clássica dos bares: bola da vez, numeradas e pontos de 1 a 7. Mesa de snooker.', dif: 'Regulamento da AMB' },
    snooker: { nome: 'Snooker', sub: '15 vermelhas e 6 cores', desc: 'Uma vermelha, uma cor, e assim até a preta. A mesa mais exigente do mundo.', dif: 'Regras da WPBSA' },
    bola8: { nome: 'Bola 8', sub: 'Lisas contra listradas', desc: 'Encaçape o seu grupo e depois a bola 8, cantando a caçapa. Mesa de pool.', dif: 'Regras da WPA' },
    bola9: { nome: 'Bola 9', sub: 'Sempre a bola mais baixa', desc: 'Acerte a menor bola da mesa e encaçape a 9 para vencer. Vale combinação.', dif: 'Regras da WPA' }
  };
  const ORDEM = ['brasileira', 'snooker', 'bola8', 'bola9'];
  const NIVEL_DESC = {
    1: 'Erra mais a mira e a força, e joga sem pensar muito no que deixa para você.',
    2: 'Mira com cuidado, escolhe bem o que encaçapar e às vezes joga de segurança.',
    3: 'Quase não erra a execução, usa efeito e procura deixar a mesa difícil para você.'
  };
  const VEL = { real: 1, normal: 1.7, rapido: 3.2 };

  const prefs = Object.assign({ modo: 'brasileira', adv: 'robo', nivel: 2, fim: 1, cac: 1, guia: 'linha', vel: 'normal' }, sget(LS.prefs, {}));
  if (!INFO[prefs.modo]) prefs.modo = 'brasileira';
  if (prefs.adv !== 'humano') prefs.adv = 'robo';
  if (!(prefs.nivel >= 1 && prefs.nivel <= 3)) prefs.nivel = 2;
  if (![1, 3, 5].includes(+prefs.fim)) prefs.fim = 1;
  if (![1, 1.2].includes(+prefs.cac)) prefs.cac = 1;
  if (!['nenhum', 'linha', 'completo'].includes(prefs.guia)) prefs.guia = 'linha';
  if (!VEL[prefs.vel]) prefs.vel = 'normal';
  const gravarPrefs = () => sset(LS.prefs, prefs);

  let S = null;     // estado do jogo (o mesmo que as regras usam)
  let U = null;     // estado da tela
  const novoU = () => ({
    adv: prefs.adv, nivel: prefs.nivel, nomes: ['Você', prefs.adv === 'robo' ? 'Robô' : 'Jogador 2'], diario: [],
    ang: Math.PI / 2, fino: 0, forca: 0.4, a: 0, b: 0, cac: null, empurrar: false, ori: {}, anim: null, ocupado: false,
    tela: null, arrasto: null, pointer: null, semAlvo: false, jogadas: 0, pots: 0, mudo: false
  });

  /* ---------- estatísticas ---------- */
  const novaStats = () => ({ jogos: {}, melhorSerie: 0, tacadas: 0, encacapadas: 0 });
  const statsAtual = () => Object.assign(novaStats(), sget(LS.stats, {}));
  function somarStats(fn) { const s = statsAtual(); fn(s); sset(LS.stats, s); }
  function estatisticas() {
    const s = statsAtual(), linhas = [];
    let p = 0, v = 0;
    ORDEM.forEach((m) => { const j = s.jogos[m] || { p: 0, v: 0 }; p += j.p; v += j.v; });
    linhas.push({ rotulo: 'Partidas jogadas', valor: p }, { rotulo: 'Vitórias', valor: v });
    ORDEM.forEach((m) => { const j = s.jogos[m] || { p: 0, v: 0 }; linhas.push({ rotulo: INFO[m].nome, valor: j.v + ' vitórias em ' + j.p }); });
    linhas.push({ rotulo: 'Tacadas', valor: s.tacadas }, { rotulo: 'Bolas encaçapadas', valor: s.encacapadas }, { rotulo: 'Maior série no snooker', valor: s.melhorSerie + ' pontos' });
    return linhas;
  }

  const el = {
    area: $('#game-area'), caixa: $('#mesa-box'), cv: $('#mesa'), taco: $('#taco'), tela: $('#tela'), dica: $('#dica'), acao: $('#painel-acao'), msg: $('#message-area'),
    chips: $('#chips-jog'), diario: $('#diario'), forca: $('#forca'), forcaTxt: $('#forca-txt'), fino: $('#mira-fina'), tacar: $('#tacar-btn'),
    efMini: $('#efeito-mini'), empurrar: $('#empurrar-btn'), desistir: $('#desistir-btn'), modoNome: $('#modo-nome'), modoSub: $('#modo-sub'), modoMini: $('#modo-mini')
  };
  const modoAtual = () => J.modo(S.modo);
  const mesaAtual = () => J.mesaDe(S.mesa, S.largura);
  const vezHumana = () => S && !S.fim && !U.ocupado && (U.adv === 'humano' || S.vez === 0);

  /* ==========================================================================
     2. Geometria da tela (mesa de cima, deitada ou em pé) e desenho da mesa
     ========================================================================== */
  // O mundo: x ao longo da largura, y ao longo do comprimento, em metros. Em pé, o fundo (y pequeno) fica embaixo.
  // Deitada, o fundo fica à esquerda. As duas visões são vistas de cima (sem espelhar).
  const V = { w: 0, h: 0, dpr: 1, s: 1, ox: 0, oy: 0, rot: false, mg: 0.14, m: null, estatico: null };
  const ctx = el.cv.getContext('2d'), ctxT = el.taco.getContext('2d');
  // o taco é desenhado numa tela transparente maior que a mesa, para poder passar da moldura (sem cortar seco)
  function ajustarTaco() {
    const pad = Math.round(0.26 * V.s); V.padT = pad;
    el.taco.style.width = (V.w + 2 * pad) + 'px'; el.taco.style.height = (V.h + 2 * pad) + 'px';
    el.taco.width = Math.round((V.w + 2 * pad) * V.dpr); el.taco.height = Math.round((V.h + 2 * pad) * V.dpr);
    el.taco.style.left = (el.cv.offsetLeft - pad) + 'px'; el.taco.style.top = (el.cv.offsetTop - pad) + 'px';
  }

  function aTela(x, y) { return V.rot ? [V.ox + y * V.s, V.oy + x * V.s] : [V.ox + x * V.s, V.oy + (V.m.L - y) * V.s]; }
  function dePixel(px, py) {
    return V.rot ? { x: (py - V.oy) / V.s, y: (px - V.ox) / V.s } : { x: (px - V.ox) / V.s, y: V.m.L - (py - V.oy) / V.s };
  }
  // direção do mundo para direção da tela (vetor unitário)
  function dirTela(dx, dy) { return V.rot ? [dy, dx] : [dx, -dy]; }
  function dirMundo(sx, sy) { return V.rot ? [sy, sx] : [sx, -sy]; }
  const deitado = () => window.innerWidth >= 540 && window.innerWidth > window.innerHeight;
  const escuro = () => document.documentElement.getAttribute('data-tema') === 'escuro';

  function layout() {
    if (!S) return;
    const m = mesaAtual(); V.m = m;
    const mg = V.mg, Wt = m.W + 2 * mg, Lt = m.L + 2 * mg;
    V.rot = deitado();
    const lay = !V.rot ? 'retrato' : (window.innerHeight < 560 ? 'compacto' : 'palco');
    if (el.area.dataset.lay !== lay) el.area.dataset.lay = lay;
    const caixaW = Math.max(200, el.caixa.clientWidth || el.area.clientWidth || 300);
    const cab = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 60;
    let w, h;
    if (V.rot) {
      const topo = el.caixa.getBoundingClientRect().top + window.scrollY;
      const reserva = lay === 'palco' ? ((document.querySelector('#entrada') || {}).offsetHeight || 120) + 24 : 8;
      const hJan = Math.max(200, window.innerHeight - topo - reserva);
      w = Math.min(caixaW, hJan * Lt / Wt); h = w * Wt / Lt;
    } else {
      const entH = (document.querySelector('#entrada') || {}).offsetHeight || 221;
      const hMax = Math.max(340, window.innerHeight - cab - entH - 16);
      h = Math.min(hMax, caixaW * Lt / Wt); w = h * Wt / Lt;
      el.area.dataset.fluxo = (cab + 340 + entH + 16 > window.innerHeight) ? 'livre' : 'fixo';
    }
    w = Math.floor(w); h = Math.floor(h);
    V.dpr = Math.min(3, window.devicePixelRatio || 1);
    V.w = w; V.h = h;
    el.cv.style.width = w + 'px'; el.cv.style.height = h + 'px';
    el.cv.width = Math.round(w * V.dpr); el.cv.height = Math.round(h * V.dpr);
    V.s = V.rot ? w / Lt : w / Wt;
    V.ox = V.oy = mg * V.s;
    ajustarTaco();
    V.estatico = null; V.sprites = {};
    pintar();
  }

  // retrato: leva a mesa para a faixa visível entre o cabeçalho e o painel de ação grudado
  function rolarParaMesa() {
    if (V.rot) return;
    const hh = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 60;
    const entH = (document.querySelector('#entrada') || {}).offsetHeight || 221;
    const r = el.cv.getBoundingClientRect();
    if (r.top < hh + 2 || r.bottom > window.innerHeight - (el.area.dataset.fluxo === 'livre' ? 0 : entH) + 2) {
      const reduz = (window.ON && ON.cfg && ON.cfg.reduzir) || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
      window.scrollBy({ top: r.top - hh - 6, behavior: reduz ? 'auto' : 'smooth' });
    }
  }

  function cores() {
    const sn = S.mesa === 'snooker12', e = escuro();
    return {
      pano: sn ? (e ? '#17653a' : '#1f8a4c') : (e ? '#115f84' : '#1783b2'),
      almofada: sn ? (e ? '#12552f' : '#197a45') : (e ? '#0e5170' : '#13709b'),
      almofadaClara: sn ? (e ? '#23814b' : '#34a867') : (e ? '#1b7aa3' : '#2aa1d0'),
      almofadaEscura: sn ? (e ? '#0a321c' : '#0e4a28') : (e ? '#08323f' : '#0a4560'),
      madeira: e ? '#3a2412' : '#6d4423', madeira2: e ? '#24160a' : '#4a2d16', tinta: e ? '#5a3320' : '#9a5a30',
      linha: 'rgba(255,255,255,0.5)', caca: '#05090c'
    };
  }

  function caminho(pts) { ctx.beginPath(); pts.forEach((p, i) => { const q = aTela(p[0], p[1]); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }); ctx.closePath(); }

  /* ---------- texturas prontas (assets/tex): bolas, feltro, madeira e couro ---------- */
  const TEX = { bola: {}, pano: null, madeira: null, couro: null, pronto: false };
  function carregarTexturas() {
    const lista = [['pano', 'assets/tex/pano.jpg'], ['madeira', 'assets/tex/madeira.jpg'], ['couro', 'assets/tex/couro.jpg']];
    for (let n = 1; n <= 15; n++) lista.push(['b' + n, 'assets/tex/b' + n + '.png']);
    let falta = lista.length;
    const fim = () => { if (--falta === 0) { TEX.pronto = true; if (V) { V.estatico = null; V.sprites = {}; } if (S) pintar(); } };
    lista.forEach((it) => {
      const im = new Image();
      im.onload = () => {
        if (it[0][0] === 'b') {
          const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
          const g = c.getContext('2d'); g.drawImage(im, 0, 0);
          TEX.bola[it[0].slice(1)] = { w: c.width, h: c.height, d: g.getImageData(0, 0, c.width, c.height).data };
        } else TEX[it[0]] = im;
        fim();
      };
      im.onerror = fim;
      im.src = it[1];
    });
  }

  function desenharEstatico() {
    const c = document.createElement('canvas'); c.width = el.cv.width; c.height = el.cv.height;
    const g = c.getContext('2d'); g.scale(V.dpr, V.dpr);
    const m = V.m, K = cores(), s = V.s, aT = aTela, e = escuro(), sn = S.mesa === 'snooker12';
    const cw = 0.075;   // largura da almofada em metros
    const p0 = aT(0, 0), p1 = aT(m.W, m.L);
    const cx0 = Math.min(p0[0], p1[0]), cy0 = Math.min(p0[1], p1[1]), cwid = Math.abs(p1[0] - p0[0]), chei = Math.abs(p1[1] - p0[1]);
    const raio = Math.min(V.w, V.h) * 0.035;
    const rr = (x, y, w, h, r) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); };
    const padrao = (img, escala, girar) => { const p = g.createPattern(img, 'repeat'); if (p && p.setTransform && window.DOMMatrix) { const mt = new DOMMatrix(); if (girar) mt.rotateSelf(90); mt.scaleSelf(escala, escala); p.setTransform(mt); } return p; };
    const lumin = (h, k) => { const [r, gg, b] = hexRgb(h); const f = (x) => Math.max(0, Math.min(255, Math.round(x * k))); return 'rgb(' + f(r) + ',' + f(gg) + ',' + f(b) + ')'; };

    /* 1. moldura de madeira envernizada */
    rr(0, 0, V.w, V.h, raio);
    g.fillStyle = K.madeira; g.fill();
    if (TEX.madeira) {
      g.save(); rr(0, 0, V.w, V.h, raio); g.clip();
      const esc = (Math.max(V.w, V.h) / 1.6) / 512;
      g.globalAlpha = 1; g.fillStyle = padrao(TEX.madeira, esc, !V.rot); g.fillRect(0, 0, V.w, V.h);
      g.globalCompositeOperation = 'multiply'; g.fillStyle = K.tinta; g.fillRect(0, 0, V.w, V.h);
      g.restore();
    }
    g.save(); rr(0, 0, V.w, V.h, raio); g.clip();
    const verniz = g.createLinearGradient(0, 0, V.w * 0.6, V.h);
    verniz.addColorStop(0, 'rgba(255,225,190,0.30)'); verniz.addColorStop(0.35, 'rgba(255,225,190,0.04)'); verniz.addColorStop(0.7, 'rgba(0,0,0,0.12)'); verniz.addColorStop(1, 'rgba(0,0,0,0.38)');
    g.fillStyle = verniz; g.fillRect(0, 0, V.w, V.h);
    // quina arredondada da moldura: faixas de luz e sombra
    const bis = (inset, larg, c1, c2) => { const gr = g.createLinearGradient(0, 0, V.w, V.h); gr.addColorStop(0, c1); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, c2); g.strokeStyle = gr; g.lineWidth = larg; rr(inset, inset, V.w - 2 * inset, V.h - 2 * inset, Math.max(2, raio - inset)); g.stroke(); };
    bis(1.5, 3, 'rgba(255,240,215,0.55)', 'rgba(0,0,0,0.55)');
    bis(0.012 * s + 4, Math.max(2, 0.010 * s), 'rgba(255,235,200,0.22)', 'rgba(0,0,0,0.30)');
    g.restore();

    /* 2. sulco escuro entre a madeira e a almofada */
    const gx0 = cx0 - cw * s, gy0 = cy0 - cw * s, gw = cwid + 2 * cw * s, gh = chei + 2 * cw * s;
    g.fillStyle = 'rgba(0,0,0,0.55)'; rr(gx0 - 3, gy0 - 3, gw + 6, gh + 6, 6); g.fill();
    g.fillStyle = K.almofadaEscura; rr(gx0, gy0, gw, gh, 4); g.fill();

    /* 3. feltro: cor, trama e luz de cima */
    g.save(); g.beginPath(); g.rect(cx0, cy0, cwid, chei); g.clip();
    g.fillStyle = K.pano; g.fillRect(cx0, cy0, cwid, chei);
    if (TEX.pano) {
      const esc = (0.34 * s) / 512;
      g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.5; g.fillStyle = padrao(TEX.pano, esc, false); g.fillRect(cx0, cy0, cwid, chei);
      g.globalAlpha = 0.07; g.globalCompositeOperation = 'overlay'; g.fillStyle = padrao(TEX.pano, esc * 3.1, false); g.fillRect(cx0, cy0, cwid, chei);
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
    const lx = cx0 + cwid * 0.42, ly = cy0 + chei * 0.40, rmax = Math.hypot(cwid, chei) * 0.62;
    const luz = g.createRadialGradient(lx, ly, 0, lx, ly, rmax);
    luz.addColorStop(0, 'rgba(255,255,235,0.26)'); luz.addColorStop(0.45, 'rgba(255,255,235,0.06)'); luz.addColorStop(1, 'rgba(0,10,0,0.46)');
    g.fillStyle = luz; g.fillRect(cx0, cy0, cwid, chei);
    g.restore();

    /* 4. marcas do pano (antes das sombras das almofadas) */
    g.strokeStyle = K.linha; g.fillStyle = K.linha; g.lineWidth = Math.max(1, s * 0.005);
    const marca = (x, y) => { const q = aT(x, y); g.beginPath(); g.arc(q[0], q[1], Math.max(1.4, s * 0.009), 0, 6.3); g.fill(); };
    if (sn) {
      const mk = m.marcas, a = aT(0, mk.baulk), b = aT(m.W, mk.baulk);
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
      g.beginPath(); const N = 40;
      for (let i = 0; i <= N; i++) { const t = Math.PI * i / N, q = aT(mk.xc + Math.cos(t) * mk.rD, mk.baulk - Math.sin(t) * mk.rD); if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }
      g.stroke();
      [mk.amarela, mk.verde, mk.marrom, mk.azul, mk.rosa, mk.preta].forEach((p) => marca(p.x, p.y));
    } else {
      const mk = m.marcas, a = aT(0, mk.cabeca), b = aT(m.W, mk.cabeca);
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
      marca(m.W / 2, mk.cabeca); marca(m.W / 2, mk.centro.y); marca(m.W / 2, mk.pe);
    }

    /* 5. sombra das almofadas sobre o feltro */
    g.save(); g.beginPath(); g.rect(cx0, cy0, cwid, chei); g.clip();
    m.segs.forEach((sg) => {
      const nx = sg.nx, ny = sg.ny, d = 0.05;    // (nx,ny) aponta para dentro da mesa
      const a = aT(sg.x1, sg.y1), b = aT(sg.x2, sg.y2), f = aT(sg.x1 + nx * d, sg.y1 + ny * d);
      const gr = g.createLinearGradient(a[0], a[1], f[0], f[1]); gr.addColorStop(0, 'rgba(0,0,0,0.5)'); gr.addColorStop(0.35, 'rgba(0,0,0,0.2)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      const a2 = aT(sg.x1 + nx * d, sg.y1 + ny * d), b2 = aT(sg.x2 + nx * d, sg.y2 + ny * d);
      g.fillStyle = gr; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(b2[0], b2[1]); g.lineTo(a2[0], a2[1]); g.closePath(); g.fill();
    });
    g.restore();

    /* 6. almofadas de borracha com o "nariz" iluminado */
    m.segs.forEach((sg) => {
      const nx = -sg.nx, ny = -sg.ny, ch = cw;
      const A = [sg.x1, sg.y1], B = [sg.x2, sg.y2], C = [sg.x2 + nx * ch + sg.tx * ch * 0.8, sg.y2 + ny * ch + sg.ty * ch * 0.8], D = [sg.x1 + nx * ch - sg.tx * ch * 0.8, sg.y1 + ny * ch - sg.ty * ch * 0.8];
      const a = aT(A[0], A[1]), f = aT(A[0] + nx * ch, A[1] + ny * ch);
      const gr = g.createLinearGradient(a[0], a[1], f[0], f[1]);
      gr.addColorStop(0, K.almofadaClara); gr.addColorStop(0.12, K.almofada); gr.addColorStop(1, K.almofadaEscura);
      g.beginPath(); [A, B, C, D].forEach((p, i) => { const q = aT(p[0], p[1]); if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }); g.closePath();
      g.fillStyle = gr; g.fill();
      const q1 = aT(A[0], A[1]), q2 = aT(B[0], B[1]);
      g.strokeStyle = 'rgba(255,255,255,0.30)'; g.lineWidth = Math.max(1, s * 0.0045); g.beginPath(); g.moveTo(q1[0], q1[1]); g.lineTo(q2[0], q2[1]); g.stroke();
    });

    /* 7. caçapas: aro de couro, boca escura com profundidade e brilho na borda */
    m.vis.forEach((v) => {
      const rb = v.larg * 0.62, cxm = v.x + v.nx * v.larg * 0.28, cym = v.y + v.ny * v.larg * 0.28, q = aT(cxm, cym), R0 = rb * s;
      g.save();
      g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = R0 * 0.35; g.shadowOffsetY = R0 * 0.12;
      g.fillStyle = '#1b1411'; g.beginPath(); g.arc(q[0], q[1], R0 * 1.18, 0, 6.3); g.fill(); g.restore();
      if (TEX.couro) { g.save(); g.beginPath(); g.arc(q[0], q[1], R0 * 1.18, 0, 6.3); g.clip(); g.globalAlpha = 0.9; g.fillStyle = padrao(TEX.couro, (R0 * 3) / 256, false); g.fillRect(q[0] - R0 * 1.4, q[1] - R0 * 1.4, R0 * 2.8, R0 * 2.8); g.restore(); }
      const gb = g.createRadialGradient(q[0] - R0 * 0.1, q[1] - R0 * 0.15, R0 * 0.1, q[0], q[1], R0 * 1.02);
      gb.addColorStop(0, '#000'); gb.addColorStop(0.7, '#05080a'); gb.addColorStop(1, '#1d2226');
      g.fillStyle = gb; g.beginPath(); g.arc(q[0], q[1], R0, 0, 6.3); g.fill();
      const lb = g.createLinearGradient(q[0] - R0, q[1] - R0, q[0] + R0, q[1] + R0); lb.addColorStop(0, 'rgba(0,0,0,0.6)'); lb.addColorStop(0.5, 'rgba(0,0,0,0)'); lb.addColorStop(1, 'rgba(255,255,255,0.35)');
      g.strokeStyle = lb; g.lineWidth = Math.max(1.5, R0 * 0.09); g.beginPath(); g.arc(q[0], q[1], R0 * 0.98, 0, 6.3); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = Math.max(1, R0 * 0.05); g.beginPath(); g.arc(q[0], q[1], R0 * 1.18, 0, 6.3); g.stroke();
    });

    /* 8. losangos de madrepérola nas laterais */
    const dm = 0.5 * (cw + V.mg) * 0.9, rd = Math.max(1.8, s * 0.014);
    const losango = (q) => {
      g.save(); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = rd; g.shadowOffsetY = rd * 0.4;
      const gr = g.createRadialGradient(q[0] - rd * 0.3, q[1] - rd * 0.35, rd * 0.1, q[0], q[1], rd);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.6, '#e8dcc4'); gr.addColorStop(1, '#a89574');
      g.fillStyle = gr; g.beginPath(); g.arc(q[0], q[1], rd, 0, 6.3); g.fill(); g.restore();
    };
    [1, 2, 3, 5, 6, 7].forEach((k) => { [[0, -1], [1, 1]].forEach((l) => losango(aT(l[0] === 0 ? -dm * 1.05 : m.W + dm * 1.05, m.L * k / 8))); });
    [1, 2, 3].forEach((k) => { [0, m.L].forEach((yy) => losango(aT(m.W * k / 4, yy + (yy === 0 ? -dm * 1.05 : dm * 1.05)))); });

    if (e) { g.fillStyle = 'rgba(0,6,16,0.26)'; rr(0, 0, V.w, V.h, raio); g.fill(); }
    V.estatico = c;
  }

  /* ==========================================================================
     3. Bolas: orientação, sombreado por pixel e desenho
     ========================================================================== */
  const qMul = (a, b) => [a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3], a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
    a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1], a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0]];
  function qNorm(q) { const n = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0] / n, q[1] / n, q[2] / n, q[3] / n]; }
  function qRot(q, v) {   // gira o vetor v pelo quaternion q
    const w = q[0], x = q[1], y = q[2], z = q[3];
    const tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0]);
    return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)];
  }
  const qConj = (q) => [q[0], -q[1], -q[2], -q[3]];
  function integrarQ(q, wx, wy, wz, dt) {
    const mag = Math.hypot(wx, wy, wz), ang = mag * dt;
    if (ang < 1e-5) return q;
    const k = Math.sin(ang / 2) / mag;
    return qNorm(qMul([Math.cos(ang / 2), wx * k, wy * k, wz * k], q));
  }
  function oriDe(id) {
    if (!U.ori[id]) {
      const r = SO ? SO.criar(SO.novaSemente()) : null, rnd = () => (r ? r.real() : Math.random()), a = () => rnd() * 2 - 1;
      if ((S.modo === 'bola8' || S.modo === 'bola9') && id > 0) {   // número virado para cima, girado ao acaso
        const fi = rnd() * 2 * Math.PI;
        U.ori[id] = qNorm(qMul([Math.cos(fi / 2), 0, 0, Math.sin(fi / 2)], [0.70710678, 0, -0.70710678, 0]));
      } else U.ori[id] = qNorm([a() + 1.5, a(), a(), a()]);
    }
    return U.ori[id];
  }

  const COR_POOL = ['#f5f5f0', '#f9d71c', '#1e50a2', '#d32f2f', '#6a1b9a', '#f57c00', '#2e7d32', '#7b1f1f', '#111111'];
  function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  const COR_SNK = { 1: '#c62828', 16: '#f9d71c', 17: '#2e7d32', 18: '#6d4c41', 19: '#1565c0', 20: '#f48fb1', 21: '#111111' };
  const COR_BRA = ['#f5f5f0', '#c62828', '#f9d71c', '#2e7d32', '#6d4c41', '#1565c0', '#f48fb1', '#111111'];

  // aparência da bola: { base:[r,g,b], tipo:'cue'|'solida'|'listra'|'oito', num }
  function aparencia(id) {
    const m = S.modo;
    if (id === 0) return { base: [245, 245, 238], tipo: 'cue' };
    if (m === 'bola8' || m === 'bola9') {
      const n = id > 8 ? id - 8 : id;
      return { base: hexRgb(COR_POOL[n]), tipo: id > 8 ? 'listra' : (id === 8 ? 'oito' : 'solida'), num: id, tex: TEX.bola[String(id)] ? String(id) : null };
    }
    if (m === 'snooker') return { base: hexRgb(id < 16 ? COR_SNK[1] : COR_SNK[id]), tipo: 'solida' };
    return { base: hexRgb(COR_BRA[id]), tipo: 'solida', num: id };
  }

  const LUZ = (() => { const l = [-0.40, 0.55, 0.73], n = Math.hypot(l[0], l[1], l[2]); return [l[0] / n, l[1] / n, l[2] / n]; })();
  const LUZ_H = (() => { const h = [LUZ[0], LUZ[1], LUZ[2] + 1], n = Math.hypot(h[0], h[1], h[2]); return [h[0] / n, h[1] / n, h[2] / n]; })();
  const JANELA = (() => { const l = [-0.34, 0.50, 0.80], n = Math.hypot(l[0], l[1], l[2]); return [l[0] / n, l[1] / n, l[2] / n]; })();
  const REFLEXO2 = (() => { const l = [0.52, -0.58, 0.63], n = Math.hypot(l[0], l[1], l[2]); return [l[0] / n, l[1] / n, l[2] / n]; })();
  const suave = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  // cor da textura (equiretangular) num ponto p da esfera, em coordenadas do corpo da bola. +x é o centro do número, z é o eixo da listra.
  function amostra(tx, p) {
    const lon = Math.atan2(p[1], p[0]), lat = Math.asin(Math.max(-1, Math.min(1, p[2])));
    let fx = (0.5 + lon / (2 * Math.PI)) * tx.w - 0.5, fy = (0.5 - lat / Math.PI) * tx.h - 0.5;
    fy = Math.max(0, Math.min(tx.h - 1.001, fy));
    let x0 = Math.floor(fx); const ax = fx - x0, y0 = Math.floor(fy), ay = fy - y0;
    x0 = ((x0 % tx.w) + tx.w) % tx.w; const x1 = (x0 + 1) % tx.w, d = tx.d, w = tx.w;
    const i00 = (y0 * w + x0) * 4, i10 = (y0 * w + x1) * 4, i01 = ((y0 + 1) * w + x0) * 4, i11 = ((y0 + 1) * w + x1) * 4;
    const o = [0, 0, 0];
    for (let k = 0; k < 3; k++) o[k] = (d[i00 + k] * (1 - ax) + d[i10 + k] * ax) * (1 - ay) + (d[i01 + k] * (1 - ax) + d[i11 + k] * ax) * ay;
    return o;
  }

  // sprite da bola: cada pixel do disco vira um ponto da esfera, girado de volta para o corpo da bola
  function sprite(id, q) {
    const d = Math.max(6, Math.round(2 * V.m.P.R * V.s * V.dpr)), pad = 2, tam = d + 2 * pad;
    const cache = V.sprites[id];
    if (cache && cache.tam === tam && cache.q && Math.abs(cache.q[0] * q[0] + cache.q[1] * q[1] + cache.q[2] * q[2] + cache.q[3] * q[3]) > 0.99995) return cache;
    const ap = aparencia(id), cvs = (cache && cache.cv) || document.createElement('canvas');
    cvs.width = tam; cvs.height = tam;
    const g = cvs.getContext('2d'), im = g.createImageData(tam, tam), dat = im.data, qc = qConj(q), r = d / 2, rot = V.rot;
    const tx = ap.tex ? TEX.bola[ap.tex] : null, pano = ap.pano;
    for (let j = 0; j < tam; j++) for (let i = 0; i < tam; i++) {
      const u = (i + 0.5 - tam / 2) / r, v = -(j + 0.5 - tam / 2) / r, rr = u * u + v * v;
      if (rr >= 1.12) continue;
      const w = Math.sqrt(Math.max(0, 1 - rr)), uu = Math.min(1, rr);
      const mundo = rot ? [-v, u, w] : [u, v, w], p = qRot(qc, mundo);
      let cr = ap.base[0], cg = ap.base[1], cb = ap.base[2];
      if (tx) { const t = amostra(tx, p); cr = t[0]; cg = t[1]; cb = t[2]; }
      else if (ap.tipo === 'cue') {
        if (Math.abs(p[0]) > 0.965) { cr = p[0] > 0 ? 210 : 30; cg = p[0] > 0 ? 40 : 70; cb = p[0] > 0 ? 40 : 190; }
        else if (p[1] > 0.965) { cr = 60; cg = 60; cb = 60; }
      }
      // luz: difusa envolvente, sombra no lado oposto e rebatimento verde do pano embaixo
      const nd = u * LUZ[0] + v * LUZ[1] + w * LUZ[2];
      let inten = 0.20 + 0.92 * Math.max(0, nd * 0.78 + 0.22);
      const baixo = Math.max(0, -v) * 0.16;
      // brilho: ponto da luz principal, reflexo da janela e reflexo fraco do pano
      const hd = u * LUZ_H[0] + v * LUZ_H[1] + w * LUZ_H[2];
      let esp = Math.pow(Math.max(0, hd), 120) * 1.0 + Math.pow(Math.max(0, hd), 18) * 0.10;
      const Rz = 2 * w * w - 1, Rx = 2 * w * u, Ry = 2 * w * v;
      esp += suave(0.955, 0.985, Rx * JANELA[0] + Ry * JANELA[1] + Rz * JANELA[2]) * 0.42;
      esp += suave(0.975, 0.995, Rx * REFLEXO2[0] + Ry * REFLEXO2[1] + Rz * REFLEXO2[2]) * 0.10;
      const borda = Math.pow(1 - w, 2.6);
      let rr2 = cr * inten + esp * 255, gg2 = cg * inten + esp * 255, bb2 = cb * inten + esp * 255;
      rr2 += (30 - 0) * baixo + 55 * borda * 0.35; gg2 += 70 * baixo + 70 * borda * 0.35; bb2 += 40 * baixo + 80 * borda * 0.35;   // rebatimento e reflexo do ambiente na borda
      const escurece = 1 - 0.38 * Math.pow(uu, 4);
      const k = (j * tam + i) * 4, a = Math.max(0, Math.min(1, (1 - Math.sqrt(rr)) * r + 0.5));
      dat[k] = Math.min(255, rr2 * escurece); dat[k + 1] = Math.min(255, gg2 * escurece); dat[k + 2] = Math.min(255, bb2 * escurece); dat[k + 3] = a * 255;
    }
    g.putImageData(im, 0, 0);
    return (V.sprites[id] = { cv: cvs, tam: tam, q: q.slice() });
  }

  function desenharBola(id, x, y, q, escala, alfa, alvoDestaque) {
    const sp = sprite(id, q), p = aTela(x, y), R = V.m.P.R * V.s * (escala == null ? 1 : escala);
    ctx.save();
    if (alfa != null && alfa < 1) ctx.globalAlpha = Math.max(0, alfa);
    // sombra projetada (luz vem de cima à esquerda) e escurecimento de contato
    const gx = p[0] + R * 0.34, gy = p[1] + R * 0.42;
    const sb = ctx.createRadialGradient(gx, gy, R * 0.25, gx, gy, R * 1.5);
    sb.addColorStop(0, 'rgba(0,0,0,0.55)'); sb.addColorStop(0.55, 'rgba(0,0,0,0.30)'); sb.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sb; ctx.beginPath(); ctx.arc(gx, gy, R * 1.55, 0, 6.3); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.beginPath(); ctx.ellipse(p[0] + R * 0.07, p[1] + R * 0.10, R * 0.98, R * 0.94, 0, 0, 6.3); ctx.fill();
    const dd = (sp.tam / V.dpr) * (escala == null ? 1 : escala);
    ctx.drawImage(sp.cv, p[0] - dd / 2, p[1] - dd / 2, dd, dd);
    const ap = aparencia(id);
    if (S.modo === 'brasileira' && id > 0 && R >= 6) {   // na sinuca brasileira o número aparece fixo, pequeno
      ctx.fillStyle = id === 2 || id === 6 || id === 0 ? '#111' : '#fff'; ctx.font = '700 ' + (R * 0.9) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(id), p[0] - R * 0.05, p[1]);
    } else if (ap.num && !ap.tex && ap.tipo !== 'cue' && R >= 6 && S.modo !== 'snooker') {
      ctx.fillStyle = '#fff'; ctx.font = '700 ' + (R * 0.8) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(ap.num), p[0], p[1]);
    }
    if (alvoDestaque) {
      ctx.globalAlpha = 1; ctx.strokeStyle = alvoDestaque; ctx.lineWidth = Math.max(2, V.s * 0.008);
      ctx.beginPath(); ctx.arc(p[0], p[1], R * 1.55, 0, 6.3); ctx.stroke();
    }
    ctx.restore();
  }

  /* ==========================================================================
     4. Guia de mira, sobreposições e quadro completo
     ========================================================================== */
  function cueBola() { return J.bolaPorId(S, 0); }
  const angFinal = () => U.ang - U.fino * Math.PI / 180;   // slider para a direita = mira gira para a direita do atirador

  // primeiro contato do centro da branca em linha reta: bola ou tabela
  function raio(cx, cy, ang) {
    const m = V.m, R = m.P.R, dx = Math.cos(ang), dy = Math.sin(ang);
    let best = { t: Infinity, tipo: null };
    S.bolas.forEach((b) => {
      if (b.id === 0 || b.fora) return;
      const fx = b.x - cx, fy = b.y - cy, proj = fx * dx + fy * dy;
      if (proj <= 0) return;
      const perp2 = fx * fx + fy * fy - proj * proj;
      if (perp2 >= 4 * R * R) return;
      const t = proj - Math.sqrt(4 * R * R - perp2);
      if (t < best.t) best = { t: t, tipo: 'bola', id: b.id, bx: b.x, by: b.y };
    });
    m.segs.forEach((sg) => {
      const dn = dx * sg.nx + dy * sg.ny;
      if (dn >= -1e-9) return;
      const t = (R - ((cx - sg.x1) * sg.nx + (cy - sg.y1) * sg.ny)) / dn;
      if (t <= 0 || t >= best.t) return;
      const hx = cx + dx * t, hy = cy + dy * t, s = (hx - sg.x1) * sg.tx + (hy - sg.y1) * sg.ty;
      if (s < -R * 0.5 || s > sg.len + R * 0.5) return;
      best = { t: t, tipo: 'tabela', sg: sg };
    });
    if (best.tipo === null) best.t = 6;
    return best;
  }

  function linhaMundo(x1, y1, x2, y2) { const a = aTela(x1, y1), b = aTela(x2, y2); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }

  function ehAlvoLegal(id) {
    const info = modoAtual().alvos(S);
    return !info.ids || info.ids.indexOf(id) >= 0;
  }

  function desenharTaco(cue, ang, recuo) {
    const ctx = ctxT, pad = V.padT || 0;
    const R = V.m.P.R, dx = Math.cos(ang), dy = Math.sin(ang), px = -dy, py = dx, ini = R * 1.2 + recuo;
    // ponto do taco: t metros atrás da branca, lado metros para o lado
    const P = (t, lado) => aTela(cue.x - dx * (ini + t) + px * lado, cue.y - dy * (ini + t) + py * lado);
    const forma = (t0, t1, w0, w1) => [P(t0, -w0), P(t1, -w1), P(t1, w1), P(t0, w0)];
    const rgb = (c, k) => 'rgb(' + c.map((x) => Math.max(0, Math.min(255, Math.round(x * k)))).join(',') + ')';
    // seção cilíndrica: gradiente atravessando o taco (luz de cima à esquerda)
    const sec = (t0, t1, w0, w1, cor) => {
      const tm = (t0 + t1) / 2, wm = (w0 + w1) / 2, a = P(tm, -wm), b = P(tm, wm);
      const gr = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
      gr.addColorStop(0, rgb(cor, 0.50)); gr.addColorStop(0.30, rgb(cor, 1.18)); gr.addColorStop(0.55, rgb(cor, 0.95)); gr.addColorStop(1, rgb(cor, 0.42));
      const f = forma(t0, t1, w0, w1);
      ctx.fillStyle = gr; ctx.beginPath(); f.forEach((q, i) => { if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }); ctx.closePath(); ctx.fill();
    };
    const L = 1.45, wp = 0.0062, wf = 0.0068, wb = 0.0145;
    ctx.save();
    // sombra do taco inteiro no pano
    const sombra = forma(0, L, wp, wb);
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = Math.max(4, V.s * 0.02); ctx.shadowOffsetX = V.s * 0.012; ctx.shadowOffsetY = V.s * 0.02;
    ctx.fillStyle = '#d8b27a'; ctx.beginPath(); sombra.forEach((q, i) => { if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }); ctx.closePath(); ctx.fill();
    ctx.shadowColor = 'transparent';
    sec(0.000, 0.012, wp * 0.95, wp, [60, 110, 190]);          // sola azul (giz)
    sec(0.012, 0.040, wp, wf, [246, 242, 230]);                // virola branca
    sec(0.040, 0.800, wf, 0.0100, [230, 196, 140]);            // ponta clara de bordo
    sec(0.800, 0.830, 0.0100, 0.0105, [30, 20, 14]);           // anel
    sec(0.830, L, 0.0105, wb, [92, 48, 24]);                   // base escura
    sec(0.960, 1.060, 0.0120, 0.0128, [24, 18, 18]);           // empunhadura
    sec(1.380, 1.395, 0.0140, 0.0142, [214, 178, 90]);         // anel dourado
    // a parte que passa do limite da tela do taco esmaece em vez de ser cortada
    const t0 = P(0, 0), t1 = P(1, 0), ul = Math.hypot(t1[0] - t0[0], t1[1] - t0[1]) || 1, ux = (t1[0] - t0[0]) / ul, uy = (t1[1] - t0[1]) / ul;
    let tEx = Infinity;
    if (ux > 1e-6) tEx = Math.min(tEx, (V.w + pad - t0[0]) / ux); else if (ux < -1e-6) tEx = Math.min(tEx, (-pad - t0[0]) / ux);
    if (uy > 1e-6) tEx = Math.min(tEx, (V.h + pad - t0[1]) / uy); else if (uy < -1e-6) tEx = Math.min(tEx, (-pad - t0[1]) / uy);
    if (tEx < L * V.s) {
      const f = Math.min(tEx, V.s * 0.2), a = [t0[0] + ux * (tEx - f), t0[1] + uy * (tEx - f)], b = [t0[0] + ux * tEx, t0[1] + uy * tEx];
      const gr = ctx.createLinearGradient(a[0], a[1], b[0], b[1]); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = gr; ctx.fillRect(-pad - 2, -pad - 2, V.w + 2 * pad + 4, V.h + 2 * pad + 4);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }

  function desenharGuia() {
    const cue = cueBola(); if (!cue || cue.fora) return;
    const m = V.m, R = m.P.R, ang = angFinal(), dx = Math.cos(ang), dy = Math.sin(ang), modoG = prefs.guia;
    const hit = raio(cue.x, cue.y, ang);
    const hx = cue.x + dx * hit.t, hy = cue.y + dy * hit.t;
    desenharTaco(cue, ang, 0.03 + 0.28 * U.forca);
    if (modoG === 'nenhum') return;
    ctx.save(); ctx.lineCap = 'round';
    ctx.setLineDash([Math.max(4, V.s * 0.03), Math.max(4, V.s * 0.025)]); ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = Math.max(1.4, V.s * 0.007);
    linhaMundo(cue.x + dx * R, cue.y + dy * R, hx, hy);
    ctx.setLineDash([]);
    // bola fantasma: onde a branca fica no instante do choque
    const p = aTela(hx, hy);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = Math.max(1.4, V.s * 0.007);
    ctx.beginPath(); ctx.arc(p[0], p[1], R * V.s, 0, 6.3); ctx.stroke();
    if (hit.tipo === 'bola') {
      const nx = (hit.bx - hx) / (2 * R), ny = (hit.by - hy) / (2 * R);
      const legal = ehAlvoLegal(hit.id);
      // rota da bola alvo (até a tabela mais próxima)
      const rb = raioDeBola(hit.bx, hit.by, nx, ny, hit.id);
      ctx.strokeStyle = legal ? 'rgba(255,235,120,0.95)' : 'rgba(255,120,100,0.95)'; ctx.lineWidth = Math.max(1.6, V.s * 0.008);
      linhaMundo(hit.bx + nx * R, hit.by + ny * R, hit.bx + nx * rb, hit.by + ny * rb);
      if (modoG === 'completo') {
        // a branca segue pela tangente (sem efeito): componente do movimento perpendicular à linha dos centros
        const dot = dx * nx + dy * ny, tx = dx - dot * nx, ty = dy - dot * ny, tn = Math.hypot(tx, ty);
        if (tn > 0.04) {
          ctx.strokeStyle = 'rgba(160,220,255,0.9)'; ctx.setLineDash([6, 5]);
          const len = Math.min(0.9, tn * 0.9);
          linhaMundo(hx + tx / tn * R, hy + ty / tn * R, hx + tx / tn * (R + len), hy + ty / tn * (R + len));
          ctx.setLineDash([]);
        }
      }
    } else if (hit.tipo === 'tabela' && modoG === 'completo') {
      const sg = hit.sg, dn = dx * sg.nx + dy * sg.ny, rx = dx - 2 * dn * sg.nx, ry = dy - 2 * dn * sg.ny;
      const rr = raio(hx, hy, Math.atan2(ry, rx)); ctx.strokeStyle = 'rgba(160,220,255,0.8)'; ctx.setLineDash([6, 5]);
      linhaMundo(hx, hy, hx + rx * Math.min(rr.t, 1.2), hy + ry * Math.min(rr.t, 1.2)); ctx.setLineDash([]);
    }
    ctx.restore();
  }

  // distância da bola alvo até a tabela, na direção n (para não desenhar a linha atravessando a mesa)
  function raioDeBola(x, y, nx, ny, ignorar) {
    const m = V.m, R = m.P.R; let t = 2.6;
    S.bolas.forEach((b) => {
      if (b.id === 0 || b.fora || b.id === ignorar) return;
      const fx = b.x - x, fy = b.y - y, proj = fx * nx + fy * ny;
      if (proj <= 0) return;
      const perp2 = fx * fx + fy * fy - proj * proj;
      if (perp2 >= 4 * R * R) return;
      t = Math.min(t, proj - Math.sqrt(4 * R * R - perp2));
    });
    m.segs.forEach((sg) => {
      const dn = nx * sg.nx + ny * sg.ny;
      if (dn >= -1e-9) return;
      const tt = (R - ((x - sg.x1) * sg.nx + (y - sg.y1) * sg.ny)) / dn;
      if (tt > 0 && tt < t) t = tt;
    });
    return Math.max(0.05, t);
  }

  function desenharZonaMao() {
    const m = V.m, mk = m.marcas, zona = modoAtual().zonaMao ? modoAtual().zonaMao(S) : 'livre';
    ctx.save(); ctx.fillStyle = 'rgba(255,235,120,0.16)'; ctx.strokeStyle = 'rgba(255,235,120,0.85)'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
    if (zona === 'D') {
      ctx.beginPath(); const N = 40;
      for (let i = 0; i <= N; i++) { const t = Math.PI * i / N, q = aTela(mk.xc + Math.cos(t) * mk.rD, mk.baulk - Math.sin(t) * mk.rD); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (zona === 'cabeca') {
      caminho([[0, 0], [m.W, 0], [m.W, mk.cabeca], [0, mk.cabeca]]); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  function desenharCacapasCantar() {
    const m = V.m;
    ctx.save();
    m.cacapas.forEach((c, k) => {
      const v = m.vis[k], q = aTela(v.x + v.nx * 0.01, v.y + v.ny * 0.01), sel = U.cac === k;
      ctx.beginPath(); ctx.arc(q[0], q[1], Math.max(8, v.larg * 0.55 * V.s), 0, 6.3);
      ctx.strokeStyle = sel ? '#ffd54f' : 'rgba(255,255,255,0.85)'; ctx.lineWidth = sel ? 3 : 1.6;
      if (sel) { ctx.fillStyle = 'rgba(255,213,79,0.35)'; ctx.fill(); } else ctx.setLineDash([4, 4]);
      ctx.stroke(); ctx.setLineDash([]);
    });
    ctx.restore();
  }

  function precisaCantar() {
    const md = modoAtual();
    return !!(md.chamar && U.alvoMira != null && md.chamar(S, U.alvoMira) && S.fase !== 'quebra');
  }

  // lista das bolas a desenhar agora: a animação manda, senão o estado do jogo
  function bolasParaDesenhar() {
    if (U.anim && U.anim.quadro) return U.anim.quadro;
    return S.bolas.filter((b) => !b.fora).map((b) => ({ id: b.id, x: b.x, y: b.y, esc: 1, alfa: 1 }));
  }

  function desenharLupa() {
    const p = U.pointer; if (!p || !p.toque || !p.mira || U.anim || !vezHumana()) return;
    const cue = cueBola(), ang = angFinal(), hit = raio(cue.x, cue.y, ang), hx = cue.x + Math.cos(ang) * Math.min(hit.t, 6), hy = cue.y + Math.sin(ang) * Math.min(hit.t, 6);
    const tam = Math.min(110, V.w * 0.38), esc = 3.6, pad = 6;
    const cx = (p.px < V.w / 2) ? V.w - tam / 2 - pad : tam / 2 + pad, cy = tam / 2 + pad;
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, tam / 2, 0, 6.3); ctx.clip();
    ctx.fillStyle = cores().pano; ctx.fillRect(cx - tam / 2, cy - tam / 2, tam, tam);
    const q = aTela(hx, hy), z = ctx.getTransform();
    ctx.translate(cx - q[0] * esc, cy - q[1] * esc); ctx.scale(esc, esc);
    ctx.drawImage(V.estatico, 0, 0, V.w, V.h);
    const salvo = V.s; ctx.lineWidth = 1;
    S.bolas.forEach((b) => { if (b.fora) return; const pp = aTela(b.x, b.y); ctx.fillStyle = aparenciaCss(b.id); ctx.beginPath(); ctx.arc(pp[0], pp[1], V.m.P.R * V.s, 0, 6.3); ctx.fill(); });
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1 / esc * 1.5; ctx.setLineDash([4 / esc, 3 / esc]);
    linhaMundo(cue.x, cue.y, hx, hy); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(q[0], q[1], V.m.P.R * V.s, 0, 6.3); ctx.stroke();
    ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, tam / 2, 0, 6.3); ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.restore();
  }
  function aparenciaCss(id) { const a = aparencia(id); return a.tipo === 'listra' ? '#f5f5ee' : 'rgb(' + a.base.join(',') + ')'; }

  function pintar() {
    if (!S || !V.m || !V.w) return;
    ctx.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
    ctx.clearRect(0, 0, V.w, V.h);
    ctxT.setTransform(V.dpr, 0, 0, V.dpr, (V.padT || 0) * V.dpr, (V.padT || 0) * V.dpr); ctxT.clearRect(-(V.padT || 0), -(V.padT || 0), V.w + 2 * (V.padT || 0), V.h + 2 * (V.padT || 0));
    if (!V.estatico) desenharEstatico();
    ctx.drawImage(V.estatico, 0, 0, V.w, V.h);
    const humano = vezHumana() && !U.tela;
    if (humano && !U.anim) { const c0 = cueBola(); const h0 = c0 && !c0.fora ? raio(c0.x, c0.y, angFinal()) : null; U.alvoMira = h0 && h0.tipo === 'bola' ? h0.id : null; }
    if (humano && S.mao) desenharZonaMao();
    const bolas = bolasParaDesenhar(), alvoId = humano && !U.anim ? U.alvoMira : null;
    const ordem = bolas.slice().sort((a, b) => (a.id === 0 ? 1 : 0) - (b.id === 0 ? 1 : 0));
    ordem.forEach((b) => {
      const q = oriDe(b.id);
      const dest = (alvoId === b.id && prefs.guia !== 'nenhum') ? (ehAlvoLegal(b.id) ? 'rgba(129,199,132,0.95)' : 'rgba(255,138,128,0.95)') : null;
      if (b.alfa > 0.02) desenharBola(b.id, b.x, b.y, q, b.esc, b.alfa, dest);
    });
    if (humano && !U.anim) { desenharGuia(); if (precisaCantar()) desenharCacapasCantar(); }
    if (humano && !U.anim) desenharLupa();
    if (U.anim && U.anim.confete) { /* reservado */ }
  }

  /* ==========================================================================
     5. Entrada: mira, força, efeito, bola na mão, caçapa cantada
     ========================================================================== */
  const velBola = (p) => 0.25 + 10.5 * p * p;                 // m/s da bola branca logo depois da tacada
  function rotuloForca(p) { return p < 0.12 ? 'Toque' : p < 0.3 ? 'Suave' : p < 0.55 ? 'Média' : p < 0.8 ? 'Forte' : 'Máxima'; }

  function pxDoEvento(ev) { const r = el.cv.getBoundingClientRect(); return [(ev.clientX - r.left) * (V.w / r.width), (ev.clientY - r.top) * (V.h / r.height)]; }

  function apontarPara(x, y) {
    const cue = cueBola(); if (!cue) return;
    if (Math.hypot(x - cue.x, y - cue.y) < 1.4 * V.m.P.R) return;
    U.ang = Math.atan2(y - cue.y, x - cue.x); U.fino = 0; el.fino.value = '0';
    pintar();
  }
  function apontarPadrao() {
    const cue = cueBola(), info = modoAtual().alvos(S);
    const alvo = J.bolaPorId(S, info.padrao);
    if (cue && alvo && !alvo.fora) U.ang = Math.atan2(alvo.y - cue.y, alvo.x - cue.x);
    U.fino = 0; el.fino.value = '0';
  }

  function posicionarBranca(x, y) {
    const cue = cueBola(), md = modoAtual();
    if (md.maoValida(S, x, y)) { cue.x = x; cue.y = y; return; }
    let lo = 0, hi = 1; const ax = cue.x, ay = cue.y;
    for (let i = 0; i < 14; i++) { const mid = (lo + hi) / 2; if (md.maoValida(S, ax + (x - ax) * mid, ay + (y - ay) * mid)) lo = mid; else hi = mid; }
    cue.x = ax + (x - ax) * lo; cue.y = ay + (y - ay) * lo;
  }

  function cacapaPerto(px, py) {
    const m = V.m; let melhor = null, d0 = 1e9;
    m.vis.forEach((v, k) => { const q = aTela(v.x, v.y), d = Math.hypot(q[0] - px, q[1] - py); const lim = Math.max(16, v.larg * V.s * 0.75); if (d < lim && d < d0) { d0 = d; melhor = k; } });
    return melhor;
  }

  el.cv.addEventListener('pointerdown', (ev) => {
    if (U && U.anim) { pularAnim(); ev.preventDefault(); return; }
    if (!S || !vezHumana() || U.tela) return;
    const [px, py] = pxDoEvento(ev), w = dePixel(px, py), cue = cueBola();
    ON.audio && ON.audio();
    if (precisaCantar()) { const k = cacapaPerto(px, py); if (k !== null) { U.cac = k; ON.som('toque'); pintar(); atualizarPainel(); ev.preventDefault(); return; } }
    U.pointer = { px: px, py: py, toque: ev.pointerType !== 'mouse', mira: false };
    if (S.mao && Math.hypot(w.x - cue.x, w.y - cue.y) < 2.4 * V.m.P.R) U.arrasto = 'bola';
    else { U.arrasto = 'mira'; U.pointer.mira = true; apontarPara(w.x, w.y); }
    try { el.cv.setPointerCapture(ev.pointerId); } catch (e) { /* ignora */ }
    ev.preventDefault();
  });
  el.cv.addEventListener('pointermove', (ev) => {
    if (!U || !U.arrasto || !S) return;
    const [px, py] = pxDoEvento(ev), w = dePixel(px, py);
    if (U.pointer) { U.pointer.px = px; U.pointer.py = py; }
    if (U.arrasto === 'bola') { posicionarBranca(w.x, w.y); pintar(); }
    else apontarPara(w.x, w.y);
    ev.preventDefault();
  });
  const soltar = () => { if (!U) return; U.arrasto = null; U.pointer = null; if (S) { pintar(); atualizarPainel(); } };
  el.cv.addEventListener('pointerup', soltar);
  el.cv.addEventListener('pointercancel', soltar);
  el.cv.style.touchAction = 'none';

  /* controles do painel */
  function ajustarFino(delta) { U.fino = Math.max(-5, Math.min(5, Math.round((U.fino + delta) * 100) / 100)); el.fino.value = String(U.fino); pintar(); }
  el.fino.addEventListener('input', () => { U.fino = +el.fino.value; pintar(); });
  $('#mira-menos').addEventListener('click', () => ajustarFino(-0.1));
  $('#mira-mais').addEventListener('click', () => ajustarFino(0.1));
  el.forca.addEventListener('input', () => { U.forca = +el.forca.value / 100; atualizarForca(); pintar(); });
  function atualizarForca() { el.forca.value = String(Math.round(U.forca * 1000) / 10); el.forcaTxt.textContent = rotuloForca(U.forca); }
  el.tacar.addEventListener('click', () => tacarHumano());
  el.empurrar.addEventListener('click', () => { U.empurrar = !U.empurrar; atualizarPainel(); });
  el.desistir.addEventListener('click', () => {
    ON.confirmar({ titulo: 'Desistir do quadro?', texto: 'O quadro fica com o adversário e começa outro (ou termina a partida).', sim: 'Desistir', nao: 'Continuar jogando' }).then((ok) => {
      if (!ok || !vezHumana()) return;
      S = modoAtual().desistir(S, S.vez); registrarLog(S.log); seguir(true);
    });
  });

  /* efeito (ponto de contato do taco na bola) */
  const EF_MAX = 0.62;        // fração do raio da bola; acima disso o taco costuma escorregar (miscue)
  const efCv = $('#efeito-cv'), efCtx = efCv.getContext('2d');
  function desenharEfeito() {
    const g = efCtx, c = efCv.width / 2, r = c - 10;
    g.clearRect(0, 0, efCv.width, efCv.height);
    const gr = g.createRadialGradient(c - r * 0.3, c - r * 0.35, r * 0.1, c, c, r); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#cfd8dc');
    g.fillStyle = gr; g.beginPath(); g.arc(c, c, r, 0, 6.3); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1.5; g.stroke();
    g.setLineDash([4, 4]); g.beginPath(); g.arc(c, c, r * EF_MAX, 0, 6.3); g.stroke(); g.setLineDash([]);
    g.beginPath(); g.moveTo(c - r, c); g.lineTo(c + r, c); g.moveTo(c, c - r); g.lineTo(c, c + r); g.strokeStyle = 'rgba(0,0,0,0.12)'; g.stroke();
    const R = V.m ? V.m.P.R : 0.0286, px = c + (U.a / R) * r, py = c - (U.b / R) * r;
    g.fillStyle = '#c62828'; g.beginPath(); g.arc(px, py, 8, 0, 6.3); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke();
  }
  function textoEfeito() {
    const R = V.m ? V.m.P.R : 0.0286, u = U.a / R, v = U.b / R, mag = Math.hypot(u, v);
    if (mag < 0.04) return { t: 'Ponto central', mini: 'Centro' };
    const partes = [];
    if (v > 0.08) partes.push('em cima (corre)'); else if (v < -0.08) partes.push('embaixo (volta)');
    if (u > 0.08) partes.push('à direita'); else if (u < -0.08) partes.push('à esquerda');
    return { t: 'Taco ' + partes.join(', ') + ', ' + Math.round(mag / EF_MAX * 100) + '% do limite', mini: (v > 0.08 ? '↑' : v < -0.08 ? '↓' : '') + (u > 0.08 ? '→' : u < -0.08 ? '←' : '') };
  }
  function atualizarEfeito() { const t = textoEfeito(); $('#efeito-txt').textContent = t.t; el.efMini.textContent = t.mini; desenharEfeito(); }
  function efetoDe(ev) {
    const r = efCv.getBoundingClientRect(), c = efCv.width / 2, rad = c - 10;
    const x = (ev.clientX - r.left) * (efCv.width / r.width), y = (ev.clientY - r.top) * (efCv.height / r.height);
    let u = (x - c) / rad, v = -(y - c) / rad; const mag = Math.hypot(u, v);
    if (mag > EF_MAX) { u *= EF_MAX / mag; v *= EF_MAX / mag; }
    const R = V.m ? V.m.P.R : 0.0286; U.a = u * R; U.b = v * R; atualizarEfeito();
  }
  let efAtivo = false;
  efCv.addEventListener('pointerdown', (ev) => { efAtivo = true; efCv.setPointerCapture(ev.pointerId); efetoDe(ev); ev.preventDefault(); });
  efCv.addEventListener('pointermove', (ev) => { if (efAtivo) efetoDe(ev); });
  efCv.addEventListener('pointerup', () => { efAtivo = false; });
  efCv.style.touchAction = 'none';
  $('#efeito-zerar').addEventListener('click', () => { U.a = 0; U.b = 0; atualizarEfeito(); });
  $('#efeito-btn').addEventListener('click', () => { setTimeout(atualizarEfeito, 0); });

  document.addEventListener('keydown', (ev) => {
    if (!S || ON.modal.aberto() || U.tela) return;
    const t = ev.target;
    if (t && t.closest && t.closest('input,textarea,select,button,[role="dialog"]')) { if (!(t === el.cv)) return; }
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (U.anim) { if (ev.key === ' ' || ev.key === 'Enter' || ev.key === 'Escape') { pularAnim(); ev.preventDefault(); } return; }
    if (!vezHumana()) return;
    const passo = ev.shiftKey ? 1 : 0.1;
    const k = ev.key;
    if (k === 'ArrowLeft') { U.ang += passo * Math.PI / 180; pintar(); ev.preventDefault(); }
    else if (k === 'ArrowRight') { U.ang -= passo * Math.PI / 180; pintar(); ev.preventDefault(); }
    else if (k === 'ArrowUp') { U.forca = Math.min(1, U.forca + 0.02); atualizarForca(); pintar(); ev.preventDefault(); }
    else if (k === 'ArrowDown') { U.forca = Math.max(0, U.forca - 0.02); atualizarForca(); pintar(); ev.preventDefault(); }
    else if (k === ' ' || k === 'Enter') { tacarHumano(); ev.preventDefault(); }
    else if (k.toLowerCase() === 'e') { ON.modal.abrir('efeito-modal'); setTimeout(atualizarEfeito, 0); ev.preventDefault(); }
  });

  /* ==========================================================================
     6. Tacada e animação (sons, vibração, fim da jogada)
     ========================================================================== */
  function tomSom(freq, dur, tipo, vol, atraso, fim) {
    const c = ON.audio(); if (!c) return;
    const t0 = c.currentTime + (atraso || 0), o = c.createOscillator(), g = c.createGain();
    o.type = tipo || 'sine'; o.frequency.setValueAtTime(freq, t0);
    if (fim) o.frequency.exponentialRampToValueAtTime(fim, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  let orcSom = 0, orcT = 0;
  function liberarSom() { const n = performance.now(); if (n - orcT > 60) { orcT = n; orcSom = 0; } return ++orcSom <= 7; }
  function somBolaBola(v) { if (!ON.cfg.som || !liberarSom()) return; const vol = Math.min(0.3, 0.03 + v * 0.03); tomSom(2200 + Math.random() * 900, 0.05, 'triangle', vol); tomSom(310, 0.05, 'sine', vol * 0.8); }
  function somTabela(v) { if (!ON.cfg.som || !liberarSom()) return; const vol = Math.min(0.28, 0.02 + v * 0.045); tomSom(150, 0.11, 'triangle', vol, 0, 90); tomSom(700, 0.03, 'square', vol * 0.18); }
  function somCacapa() { if (!ON.cfg.som) return; tomSom(260, 0.28, 'sine', 0.2, 0, 70); tomSom(1400, 0.03, 'triangle', 0.08, 0.05); tomSom(1100, 0.03, 'triangle', 0.06, 0.12); }
  function somTaco(v0) { if (!ON.cfg.som) return; const vol = Math.min(0.3, 0.05 + v0 * 0.035); tomSom(1000, 0.03, 'square', vol * 0.35); tomSom(200, 0.07, 'sine', vol, 0, 120); }

  function velAnim() { return VEL[prefs.vel] || 1.7; }
  function tacarHumano() {
    if (!vezHumana()) return;
    const cue = cueBola(), md = modoAtual(), P = V.m.P;
    if (S.mao && !md.maoValida(S, cue.x, cue.y)) { dizer('A bola branca precisa ficar na área marcada. Arraste-a para um ponto livre.'); return; }
    { const h0 = !cue.fora ? raio(cue.x, cue.y, angFinal()) : null; U.alvoMira = h0 && h0.tipo === 'bola' ? h0.id : null; }
    const cantar = precisaCantar();
    if (cantar && U.cac === null) { dizer('Cante a caçapa da bola 8: toque na caçapa em que ela vai cair.'); pintar(); return; }
    const acao = { ang: angFinal(), v0: BT.tacoPara(P, velBola(U.forca)), a: U.a, b: U.b, alvo: U.alvoMira == null ? undefined : U.alvoMira, cac: cantar ? U.cac : undefined, empurrar: !!(U.empurrar && S.empurrarOk) };
    U.cac = null; U.empurrar = false;
    executarTacada(acao);
  }

  function executarTacada(acao) {
    U.ocupado = true; U.arrasto = null; U.pointer = null; atualizarPainel();
    const antes = { partida: S.partida, vez: S.vez, placar: (S.placar || []).slice() };
    let r;
    try { r = J.executar(S, acao); } catch (e) { U.ocupado = false; dizer('Não foi possível calcular essa tacada.'); return; }
    const P = V.m.P, ids = r.ids, hist = r.sim.hist, ev = r.sim.eventos;
    const tCap = {}; ev.forEach((e) => { if (e.tipo === 'cacapa') tCap[e.i] = { t: e.t, k: e.k }; });
    const ultimo = ev.length ? ev[ev.length - 1].t : 0;
    U.anim = { r: r, antes: antes, t0: 0, tSim: 0, ult: 0, evi: 0, ids: ids, hist: hist, ev: ev, tCap: tCap, ultimoEv: ultimo, fator: velAnim(), quadro: null, pulou: false, P: P };
    somTaco(acao.v0); ON.vibrar('leve');
    U.anim.quadro = quadroEm(0);
    U.anim.ult = performance.now();
    requestAnimationFrame(passoAnim);
  }

  function quadroEm(t) {
    const a = U.anim, P = a.P, mesa = V.m, out = [];
    for (let i = 0; i < a.ids.length; i++) {
      const id = a.ids[i], st = F.estadoEm(P, a.hist[i], t), c = a.tCap[id];
      let x = st.x, y = st.y, esc = 1, alfa = 1;
      if (c && t >= c.t) {
        const k = Math.min(1, (t - c.t) / 0.22), cp = mesa.cacapas[c.k];
        x = st.x + (cp.x - st.x) * k; y = st.y + (cp.y - st.y) * k; esc = 1 - 0.55 * k; alfa = 1 - k;
      }
      out.push({ id: id, x: x, y: y, esc: esc, alfa: alfa, st: st });
    }
    return out;
  }

  function passoAnim(now) {
    const a = U.anim; if (!a) return;
    const dtReal = Math.min(0.05, (now - a.ult) / 1000); a.ult = now;
    const dt = dtReal * a.fator;
    a.tSim += dt;
    a.quadro = quadroEm(a.tSim);
    let vmax = 0;
    a.quadro.forEach((b) => {
      const st = b.st, q = oriDe(b.id);
      U.ori[b.id] = integrarQ(q, st.wx, st.wy, st.wz, dt);
      const v = Math.hypot(st.vx, st.vy); if (v > vmax) vmax = v;
    });
    while (a.evi < a.ev.length && a.ev[a.evi].t <= a.tSim) {
      const e = a.ev[a.evi++];
      if (e.tipo === 'bola') somBolaBola(e.v);
      else if (e.tipo === 'tabela') somTabela(e.v);
      else if (e.tipo === 'cacapa') { somCacapa(); if (e.i !== 0) ON.vibrar('captura'); else ON.vibrar('erro'); }
    }
    pintar();
    if (a.tSim >= a.r.sim.fim || (a.tSim > a.ultimoEv + 0.2 && vmax < 0.012)) { terminarAnim(); return; }
    requestAnimationFrame(passoAnim);
  }
  function pularAnim() { const a = U.anim; if (!a) return; a.pulou = true; terminarAnim(); }

  function terminarAnim() {
    const a = U.anim; if (!a) return;
    const r = a.r, antes = a.antes;
    U.anim = null; U.ocupado = false; U.arrasto = null; U.jogadas++;
    S = r.S;
    // contas para as estatísticas
    const pots = r.rel.encacapadasObj.length;
    somarStats((s) => { s.tacadas++; s.encacapadas += pots; if (S.modo === 'snooker' && S.maior) s.melhorSerie = Math.max(s.melhorSerie, Math.max(S.maior[0], S.maior[1])); });
    registrarLog(S.log);
    if (!(S.log && S.log.length) && !S.fim && S.partida === antes.partida) {
      registrarLog([S.vez !== antes.vez ? U.nomes[antes.vez] + ' não encaçapou. Vez de ' + U.nomes[S.vez] + '.' : U.nomes[antes.vez] + ' continua na mesa.']);
    }
    const falta = r.res && r.res.foul;
    if (falta) { ON.vibrar('erro'); ON.som('erro'); }
    seguir(false, antes);
  }

  /* ==========================================================================
     7. Andamento da partida (vez, robô, decisões, fim do quadro e da partida)
     ========================================================================== */
  let tMsg = 0;
  function dizer(t) {
    el.msg.textContent = t || '';
    el.msg.classList.remove('some'); clearTimeout(tMsg);
    // na mesa deitada a mensagem fica sobre a mesa: some depois de alguns segundos (o diário guarda tudo)
    if (t && el.area.dataset.lay && el.area.dataset.lay !== 'retrato') tMsg = setTimeout(() => el.msg.classList.add('some'), Math.min(9000, 3500 + t.length * 45));
  }
  function registrarLog(linhas) {
    (linhas || []).forEach((t) => { U.diario.push({ t: t, falta: /^Falta|perde o quadro|Falta de/.test(t) }); });
    if (U.diario.length > 80) U.diario.splice(0, U.diario.length - 80);
    if (linhas && linhas.length) dizer(linhas.join(' '));
  }

  /* o robô roda num Web Worker; se o navegador não permitir, roda aqui mesmo */
  let worker = null, seq = 0; const pend = {};
  function criarWorker() {
    try {
      worker = new Worker('robo.js');
      worker.onmessage = (e) => { const p = pend[e.data.id]; if (!p) return; delete pend[e.data.id]; clearTimeout(p.t); if (e.data.erro) p.local(); else p.res(e.data.r); };
      worker.onerror = () => { worker = null; Object.keys(pend).forEach((k) => { const p = pend[k]; delete pend[k]; clearTimeout(p.t); p.local(); }); };
    } catch (e) { worker = null; }
  }
  function perguntar(tipo) {
    return new Promise((res) => {
      const semente = (SO ? SO.criar(SO.novaSemente()).prox() : Math.floor(Math.random() * 4e9)) >>> 0;
      const local = () => {
        setTimeout(() => {
          const rng = (() => { let a = semente >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
          if (tipo === 'escolher') { const d = BT.escolher(S, { nivel: U.nivel, rng: rng, orcamento: 1200 }); res({ acao: d.acao, v: d.v }); }
          else if (tipo === 'mao') res(BT.posicionarMao(S, { rng: rng }));
          else res(BT.recusar(S, { rng: rng }));
        }, 20);
      };
      if (!worker) { local(); return; }
      const id = ++seq;
      pend[id] = { res: res, local: local, t: setTimeout(() => { if (pend[id]) { delete pend[id]; local(); } }, 20000) };
      worker.postMessage({ id: id, tipo: tipo, S: S, nivel: U.nivel, semente: semente, orcamento: 1500 });
    });
  }

  function seguir(semSalvar, antes) {
    atualizarPainel(); pintar();
    if (!semSalvar) gravar();
    if (S.fim) { fimDaPartida(); return; }
    if (antes && S.partida !== antes.partida) { telaQuadro(antes); return; }
    if (S.recusa) { tratarRecusa(); return; }
    iniciarVez();
  }

  function iniciarVez() {
    if (!S || S.fim) return;
    const humano = U.adv === 'humano' || S.vez === 0;
    U.cac = null; U.empurrar = false;
    if (S.mao) { const c = cueBola(); if (c && c.fora) { const p = modoAtual().posicaoMao(S); c.fora = false; c.x = p.x; c.y = p.y; } }
    if (humano) {
      if (/está (pensando|decidindo)/.test(el.msg.textContent)) dizer('');
      if (S.fase === 'quebra') { U.forca = 0.85; atualizarForca(); }
      apontarPadrao(); atualizarPainel(); pintar(); rolarParaMesa();
      return;
    }
    U.ocupado = true; atualizarPainel(); dizer(U.nomes[S.vez] + ' está pensando...');
    const vezAntes = S.vez, partidaAntes = S.partida, trava = S.bolas.length;
    const mao = S.mao ? perguntar('mao').then((p) => { if (S.vez !== vezAntes) return; const c = cueBola(); c.fora = false; c.x = p.x; c.y = p.y; S.mao = null; pintar(); }) : Promise.resolve();
    mao.then(() => perguntar('escolher')).then((d) => {
      if (!S || S.vez !== vezAntes || S.partida !== partidaAntes || S.fim) { U.ocupado = false; return; }
      const cue = cueBola(); U.ang = d.acao.ang; U.forca = Math.min(1, Math.sqrt(Math.max(0, (BT.bolaDoTaco(V.m.P, d.acao.v0) - 0.25) / 10.5)));
      atualizarForca();
      setTimeout(() => { if (S && !S.fim) executarTacada(d.acao); }, prefs.vel === 'rapido' ? 250 : 650);
    });
  }

  function tratarRecusa() {
    const r = S.recusa, quem = r.quem, humano = U.adv === 'humano' || quem === 0;
    const md = modoAtual();
    const aplicar = (esc) => { const antes = S.partida; S = md.decidir(S, esc); registrarLog(S.log); U.tela = null; esconderTela(); seguir(false); };
    if (!humano) {
      U.ocupado = true; atualizarPainel(); dizer(U.nomes[quem] + ' está decidindo...');
      perguntar('recusar').then((esc) => { U.ocupado = false; aplicar(esc); });
      return;
    }
    let tit = 'Sua decisão', txt = '', b1 = 'Jogar', b2 = 'Mandar repetir', e1 = 'jogar', e2 = 'recusar';
    const ultimo = (S.log && S.log.length) ? S.log.join(' ') : '';
    if (r.tipo === 'saida') { tit = 'Saída sem fino'; txt = 'A branca não consegue tirar fino dos dois lados da bola 1. Você pode jogar assim mesmo ou mandar repetir a saída.'; b1 = 'Jogar assim'; b2 = 'Repetir a saída'; e2 = 'repetir'; }
    else if (r.tipo === 'quebra') { tit = 'Quebra fraca'; txt = 'A quebra não encaçapou bola nem levou 4 bolas à tabela. Você pode jogar com a mesa como ficou ou mandar quebrar de novo.'; b1 = 'Jogar assim'; b2 = 'Quebrar de novo'; e2 = 'repetir'; }
    else if (r.tipo === 'empurrar') { tit = 'Empurrada'; txt = 'O adversário fez uma empurrada. Jogue a partir de onde a branca parou ou devolva a vez para ele jogar dali.'; b1 = 'Jogar daqui'; b2 = 'Devolver a vez'; }
    else if (r.tipo === 'numerada') { tit = 'Numerada sem encaçapar'; txt = 'Você pode aceitar a mesa como ficou ou mandar o adversário jogar de novo da posição atual.'; b1 = 'Aceitar e jogar'; b2 = 'Mandar repetir'; }
    else { tit = 'Falta do adversário'; txt = (ultimo ? ultimo + ' ' : '') + 'Você pode jogar da posição atual ou mandar o adversário jogar de novo.'; b1 = 'Aceitar e jogar'; b2 = 'Mandar repetir'; }
    mostrarTela(tit, '<p>' + esc(txt) + '</p>', b1, () => aplicar(e1), b2, () => aplicar(e2));
  }

  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function telaQuadro(antes) {
    const gan = S.ganhas, ult = U.diario.slice(-3).map((d) => d.t);
    const txt = '<p>' + esc(ult.filter((t) => /quadro|vence|perde/.test(t)).join(' ') || 'O quadro terminou.') + '</p><p class="tela-sub">Quadros: ' + gan[0] + ' a ' + gan[1] + '. Próximo quadro: ' + esc(U.nomes[S.vez]) + ' começa.</p>';
    mostrarTela('Quadro encerrado', txt, 'Próximo quadro', () => { esconderTela(); seguir(false); });
  }

  function fimDaPartida() {
    const v = S.fim.vencedor, humanoVenceu = U.adv === 'humano' || v === 0;
    somarStats((s) => { const j = s.jogos[S.modo] || (s.jogos[S.modo] = { p: 0, v: 0 }); j.p++; if (v === 0) j.v++; });
    sdel(LS.jogo);
    if (v === 0 || U.adv === 'humano') { ON.som('vitoria'); ON.vibrar('vitoria'); } else { ON.som('derrota'); ON.vibrar('derrota'); }
    const placar = S.fim.placar;
    const txt = '<p>' + esc(U.nomes[v]) + ' vence a partida por ' + placar[v] + ' a ' + placar[1 - v] + (S.melhorDe > 1 ? ' nos quadros.' : '.') + '</p>';
    mostrarTela(v === 0 || U.adv === 'humano' ? 'Vitória de ' + U.nomes[v] + '!' : U.nomes[v] + ' venceu', txt, 'Nova partida', () => { esconderTela(); ON.modal.abrir('partida-modal'); }, 'Ver a mesa', () => { esconderTela(); });
  }

  /* ==========================================================================
     8. Painel, placar e telas
     ========================================================================== */
  function mostrarTela(titulo, html, b1, f1, b2, f2) {
    U.tela = true;
    $('#tela-titulo').textContent = titulo; $('#tela-corpo').innerHTML = html;
    const x1 = $('#tela-btn'), x2 = $('#tela-btn2');
    x1.textContent = b1; x1.onclick = f1;
    if (b2) { x2.hidden = false; x2.textContent = b2; x2.onclick = f2; } else x2.hidden = true;
    el.tela.hidden = false; atualizarPainel();
    setTimeout(() => { try { x1.focus({ preventScroll: true }); } catch (e) { /* ignora */ } }, 50);
  }
  function esconderTela() { U.tela = null; el.tela.hidden = true; atualizarPainel(); pintar(); }

  const NOME_COR = ['', 'Vermelha', 'Amarela', 'Verde', 'Marrom', 'Azul', 'Rosa', 'Preta'];
  function hud(l1, v1, l2, v2, l3, v3, l4, v4) {
    [[l1, v1], [l2, v2], [l3, v3], [l4, v4]].forEach((p, i) => { $('#hud-l' + (i + 1)).textContent = p[0]; $('#hud-v' + (i + 1)).textContent = p[1]; });
  }
  function atualizarHud() {
    const md = modoAtual(), r = md.resumo ? md.resumo(S) : {}, nm = U.nomes, q = S.ganhas[0] + ' x ' + S.ganhas[1];
    if (S.modo === 'brasileira') {
      hud('Bola da vez', r.dv ? r.dv + ' ' + NOME_COR[r.dv].toLowerCase() : '-', 'Placar', S.placar[0] + ' x ' + S.placar[1], 'Limite', r.limite ? Math.abs(r.diff) + ' de ' + r.limite : 'sem limite', 'Quadros', q);
    } else if (S.modo === 'snooker') {
      const bola = S.fase === 'vermelha' ? 'Vermelha' : S.fase === 'cor' ? 'Uma cor' : S.fase === 'decisiva' ? 'Preta' : (NOME_COR[r.menorCor - 14] || 'Cor');
      hud('Placar', S.placar[0] + ' x ' + S.placar[1], 'Bola', bola, 'Série', S.serie || 0, 'Restam', r.restantes + ' pts');
    } else if (S.modo === 'bola8') {
      const g = S.grupos[S.vez];
      hud('Grupo de ' + nm[S.vez], g === null ? 'Aberta' : g === 0 ? 'Lisas' : 'Listradas', 'Quadros', q, 'Lisas', r.lisas.length + ' bolas', 'Listradas', r.listradas.length + ' bolas');
    } else {
      hud('Mais baixa', r.baixa || '-', 'Vez de', nm[S.vez], 'Faltas seguidas', S.faltasSeguidas ? S.faltasSeguidas[S.vez] : 0, 'Quadros', q);
    }
  }

  function atualizarChips() {
    const md = modoAtual(), nm = U.nomes, r = md.resumo ? md.resumo(S) : {};
    el.chips.innerHTML = '';
    [0, 1].forEach((i) => {
      let sub = '';
      if (S.modo === 'brasileira' || S.modo === 'snooker') sub = S.placar[i] + ' pontos' + (S.modo === 'snooker' && S.maior ? ', maior série ' + S.maior[i] : '');
      else if (S.modo === 'bola8') { const g = S.grupos[i]; sub = g === null ? 'Mesa aberta' : (g === 0 ? 'Lisas: ' + r.lisas.length : 'Listradas: ' + r.listradas.length) + ' restantes'; }
      else sub = 'Quadros: ' + S.ganhas[i];
      const d = document.createElement('div'); d.className = 'chip-j' + (S.vez === i && !S.fim ? ' vez' : '') + (i === 0 ? ' eu' : ''); d.setAttribute('role', 'listitem');
      d.innerHTML = '<b>' + esc(nm[i]) + (S.vez === i && !S.fim ? ' (na vez)' : '') + '</b><small>' + esc(sub) + '</small>';
      el.chips.appendChild(d);
    });
  }

  function atualizarDiario() {
    el.diario.innerHTML = '';
    const ult = U.diario.slice(-8).reverse();
    if (!ult.length) { const li = document.createElement('li'); li.className = 'vazio'; li.textContent = 'As jogadas aparecem aqui.'; el.diario.appendChild(li); return; }
    ult.forEach((d) => { const li = document.createElement('li'); if (d.falta) li.className = 'rua'; li.textContent = d.t; el.diario.appendChild(li); });
  }

  function atualizarPainel() {
    if (!S) return;
    const info = INFO[S.modo];
    el.modoNome.textContent = info.nome;
    el.modoSub.textContent = info.sub + ' · ' + (U.adv === 'robo' ? 'robô ' + ['', 'fácil', 'médio', 'difícil'][U.nivel] : 'dois jogadores') + (S.melhorDe > 1 ? ' · melhor de ' + S.melhorDe : '');
    el.modoMini.innerHTML = miniSVG(S.modo, 46);
    atualizarHud(); atualizarChips(); atualizarDiario();
    const humano = vezHumana() && !U.tela, md = modoAtual();
    el.acao.hidden = !(humano || U.ocupado || U.tela);
    el.acao.classList.toggle('inativo', !humano);
    [el.tacar, el.forca, el.fino, $('#mira-menos'), $('#mira-mais'), $('#efeito-btn')].forEach((n) => { n.disabled = !humano; });
    atualizarForca();
    const ef = textoEfeito(); el.efMini.textContent = ef.mini;
    el.empurrar.hidden = !(S.modo === 'bola9' && S.empurrarOk && humano);
    el.empurrar.setAttribute('aria-pressed', U.empurrar ? 'true' : 'false'); el.empurrar.classList.toggle('ligado', !!U.empurrar);
    el.desistir.hidden = !(md.desistir && humano && !S.recusa);
    const alvos = md.alvos(S);
    let dica = '';
    if (S.fim) dica = 'Partida encerrada.';
    else if (U.ocupado || !humano) dica = (U.adv === 'robo' && S.vez === 1) ? U.nomes[1] + ' joga.' : '';
    else dica = U.nomes[S.vez] + ': ' + alvos.texto.replace(/\.$/, '') + '.' + (S.mao ? ' Bola na mão: arraste a branca.' : '');
    if (humano && S.modo === 'bola8' && S.fase !== 'quebra' && alvos.ids && alvos.ids.length === 1 && alvos.ids[0] === 8) dica += ' Toque na caçapa para cantar a 8.';
    el.dica.textContent = dica;
    el.cv.setAttribute('aria-label', 'Mesa de ' + info.nome + '. ' + (humano ? 'Sua vez. ' + alvos.texto : ''));
    $('#restart-btn').disabled = false;
  }

  function miniSVG(modo, tam) {
    const pool = modo === 'bola8' || modo === 'bola9';
    const f = pool ? '#17789a' : '#1b7a4a';
    const bolas = {
      brasileira: [['#c62828', 10, 8], ['#f9d71c', 20, 8], ['#2e7d32', 30, 8], ['#1565c0', 15, 20], ['#f48fb1', 25, 20], ['#111', 20, 32]],
      snooker: [['#c62828', 12, 9], ['#c62828', 20, 9], ['#c62828', 28, 9], ['#c62828', 16, 17], ['#c62828', 24, 17], ['#111', 20, 31]],
      bola8: [['#f9d71c', 12, 9], ['#d32f2f', 20, 9], ['#111', 28, 9], ['#1e50a2', 16, 17], ['#7b1f1f', 24, 17], ['#f5f5f0', 20, 32]],
      bola9: [['#f9d71c', 20, 7], ['#1e50a2', 16, 15], ['#f9d71c', 24, 15], ['#d32f2f', 20, 23], ['#f5f5f0', 20, 34]]
    }[modo] || [];
    let svg = '<svg class="mini" viewBox="0 0 40 40" width="' + tam + '" height="' + tam + '" aria-hidden="true"><rect x="1" y="1" width="38" height="38" rx="7" fill="' + f + '" stroke="#6d4423" stroke-width="2"/>';
    bolas.forEach((b) => { svg += '<circle cx="' + b[1] + '" cy="' + b[2] + '" r="4.2" fill="' + b[0] + '"/><circle cx="' + (b[1] - 1.3) + '" cy="' + (b[2] - 1.5) + '" r="1.1" fill="#fff" opacity=".55"/>'; });
    return svg + '</svg>';
  }

  /* ==========================================================================
     9. Nova partida, Como Jogar e início
     ========================================================================== */
  function gravar() {
    if (!S || !U) return;
    if (S.fim) { sdel(LS.jogo); return; }
    sset(LS.jogo, { v: 1, S: S, U: { nomes: U.nomes, adv: U.adv, nivel: U.nivel, diario: U.diario.slice(-20), ang: U.ang, forca: U.forca } });
  }
  function validar(d) {
    try {
      if (!d || d.v !== 1 || !d.S || !INFO[d.S.modo] || !Array.isArray(d.S.bolas) || !d.U || !Array.isArray(d.U.nomes)) return false;
      const md = J.modo(d.S.modo); if (!md) return false;
      if (!d.S.bolas.every((b) => typeof b.id === 'number' && isFinite(b.x) && isFinite(b.y))) return false;
      if (!J.bolaPorId(d.S, 0)) return false;
      return true;
    } catch (e) { return false; }
  }
  function restaurar() {
    const d = sget(LS.jogo, null);
    if (!validar(d) || d.S.fim) return false;
    S = d.S; U = novoU();
    U.nomes = d.U.nomes; U.adv = d.U.adv === 'humano' ? 'humano' : 'robo'; U.nivel = d.U.nivel >= 1 && d.U.nivel <= 3 ? d.U.nivel : 2;
    U.diario = Array.isArray(d.U.diario) ? d.U.diario : []; U.ang = isFinite(d.U.ang) ? d.U.ang : U.ang; U.forca = isFinite(d.U.forca) ? Math.max(0, Math.min(1, d.U.forca)) : 0.4;
    return true;
  }

  /* --- nova partida --- */
  let sel = { modo: 'brasileira', adv: 'robo', nivel: 2, fim: 1, cac: 1 };
  function marcarSeg(id, valor) { document.querySelectorAll('#' + id + ' .seg-btn').forEach((b) => b.setAttribute('aria-pressed', String(String(b.dataset.v) === String(valor)))); }
  function desenharEscolha() {
    $('#tiles-modo').innerHTML = ORDEM.map((m) => '<button type="button" class="tile" data-modo="' + m + '" aria-current="' + (m === sel.modo) + '"><span class="tile-mini">' + miniSVG(m, 56) +
      '</span><span class="tile-txt"><span class="tile-nome">' + esc(INFO[m].nome) + '</span><span class="tile-dif">' + esc(INFO[m].dif) + '</span><span class="tile-desc">' + esc(INFO[m].desc) + '</span></span></button>').join('');
    marcarSeg('op-adv', sel.adv); marcarSeg('op-nivel', sel.nivel); marcarSeg('op-fim', sel.fim); marcarSeg('op-cac', sel.cac);
    $('#bloco-nivel').hidden = sel.adv !== 'robo';
    $('#nivel-desc').textContent = NIVEL_DESC[sel.nivel] || '';
    $('#aviso-partida').textContent = sel.modo === 'brasileira' ? 'Quem dá a saída é sorteado. A saída exige acertar a bola 1.' : sel.modo === 'snooker' ? 'Quem começa é sorteado. A primeira tacada sai do D.' : 'O primeiro a quebrar é sorteado. Nos quadros seguintes a quebra se alterna.';
  }
  $('#partida-corpo').addEventListener('click', (ev) => {
    const t = ev.target.closest('.tile'), b = ev.target.closest('.seg-btn');
    if (t) sel.modo = t.dataset.modo;
    else if (b) { const g = b.parentElement.id; const v = b.dataset.v; if (g === 'op-adv') sel.adv = v; else if (g === 'op-nivel') sel.nivel = +v; else if (g === 'op-fim') sel.fim = +v; else if (g === 'op-cac') sel.cac = +v; else return; }
    else return;
    desenharEscolha(); ON.som('toque');
  });
  function abrirPartida() { sel = { modo: prefs.modo, adv: prefs.adv, nivel: prefs.nivel, fim: +prefs.fim, cac: +prefs.cac }; desenharEscolha(); }
  const emAndamento = () => !!(S && !S.fim && U && U.jogadas > 0);
  const TXT_ABANDONA = { texto: 'A partida em andamento será abandonada.', sim: 'Sim, começar outra' };
  $('#partida-jogar').addEventListener('click', () => { const o = Object.assign({}, sel); ON.novoJogo(emAndamento(), () => { ON.modal.fechar(); novaPartida(o); }, TXT_ABANDONA); });
  $('#modo-btn').addEventListener('click', abrirPartida);
  $('#restart-btn').addEventListener('click', () => { abrirPartida(); ON.modal.abrir('partida-modal'); });

  function novaPartida(o) {
    prefs.modo = o.modo; prefs.adv = o.adv; prefs.nivel = o.nivel; prefs.fim = o.fim; prefs.cac = o.cac; gravarPrefs();
    const g = SO.criar(SO.novaSemente()), md = J.modo(o.modo);
    const nomes = ['Você', o.adv === 'robo' ? 'Robô' : 'Jogador 2'];
    S = md.inicial({ melhorDe: o.fim, quemSai: g.inteiro(2), largura: o.cac, nomes: nomes, semente: g.prox() });
    U = novoU(); U.nomes = nomes; U.adv = o.adv; U.nivel = o.nivel;
    U.jogadas = 0;
    esconderTela();
    registrarLog(['Partida nova: ' + INFO[o.modo].nome + '. ' + nomes[S.vez] + ' começa.']);
    somarStats((s) => { /* a contagem de partidas entra ao terminar */ });
    layout(); apontarPadrao(); atualizarPainel(); gravar();
    ON.som('toque');
    iniciarVez();
    pintar();
  }

  /* --- Como Jogar --- */
  let abas = [];
  function mostrarAba(aba) {
    abas.forEach((a) => { const s = a === aba; a.setAttribute('aria-selected', String(s)); a.tabIndex = s ? 0 : -1; document.getElementById(a.getAttribute('aria-controls')).hidden = !s; });
    document.getElementById(aba.getAttribute('aria-controls')).scrollTop = 0;
  }
  function montarAjuda() { $('#painel-site').innerHTML = TX.site || ''; $('#painel-regras').innerHTML = TX.regras || ''; $('#painel-fisica').innerHTML = TX.fisica || ''; $('#painel-dicas').innerHTML = TX.dicas || ''; }
  function ligarAbas() {
    abas = Array.from(document.querySelectorAll('.aba'));
    abas.forEach((a) => {
      a.addEventListener('click', () => mostrarAba(a));
      a.addEventListener('keydown', (ev) => {
        if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
        const novo = abas[(abas.indexOf(a) + (ev.key === 'ArrowRight' ? 1 : -1) + abas.length) % abas.length];
        mostrarAba(novo); novo.focus(); ev.preventDefault();
      });
    });
    $('#howto-btn').addEventListener('click', () => mostrarAba(abas[0]));
  }

  /* --- ajudas --- */
  const acBtn = $('#ajuda-btn');
  acBtn.addEventListener('click', () => { const abre = acBtn.getAttribute('aria-expanded') !== 'true'; acBtn.setAttribute('aria-expanded', String(abre)); $('#acc-ajuda').classList.toggle('aberto', abre); });
  const ROT_GUIA = { nenhum: 'sem guia', linha: 'linha', completo: 'completo' };
  function pintarAjudas() {
    marcarSeg('op-guia', prefs.guia); marcarSeg('op-vel', prefs.vel);
    $('#ajuda-atual').textContent = 'Guia de mira: ' + ROT_GUIA[prefs.guia];
  }
  function ligarAjudas() {
    const lig = (sel2, chave) => $(sel2).addEventListener('click', (ev) => { const b = ev.target.closest('.seg-btn'); if (!b) return; prefs[chave] = b.dataset.v; gravarPrefs(); ON.som('toque'); pintarAjudas(); if (S) pintar(); });
    lig('#op-guia', 'guia'); lig('#op-vel', 'vel'); pintarAjudas();
  }

  document.addEventListener('visibilitychange', () => { if (document.hidden) gravar(); });
  window.addEventListener('pagehide', gravar);
  let tRedim = 0;
  carregarTexturas();
  const redim = () => { clearTimeout(tRedim); tRedim = setTimeout(() => { if (S) layout(); }, 90); };
  window.addEventListener('resize', redim); window.addEventListener('orientationchange', redim);
  if (window.ResizeObserver) new ResizeObserver(redim).observe(el.caixa);
  new MutationObserver(() => { V.estatico = null; V.sprites = {}; if (S) pintar(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-tema'] });

  /* ==========================================================================
     Início
     ========================================================================== */
  ON.init({
    id: 'sinucaon',
    nome: 'SinucaON!',
    configuracoes: ['som', 'vibracao', 'escuro', 'reduzir'],
    estatisticas,
    zerarEstatisticas: () => { sdel(LS.stats); },
    pronto: () => {
      $('#modo-chevron').innerHTML = ON.icone('chevron', 16);
      $('#ajuda-chevron').innerHTML = ON.icone('chevron', 18);
      montarAjuda(); ligarAbas(); ligarAjudas(); criarWorker();
      U = novoU();
      if (restaurar()) {
        layout(); atualizarPainel(); atualizarEfeito(); pintar();
        if (S.recusa) tratarRecusa(); else iniciarVez();
      } else {
        sel = { modo: prefs.modo, adv: prefs.adv, nivel: prefs.nivel, fim: +prefs.fim, cac: +prefs.cac };
        novaPartida(sel);
      }
      atualizarEfeito();
      if (!ON.store.get(LS.visto, false)) { ON.store.set(LS.visto, true); setTimeout(() => ON.modal.abrir('howto-modal'), 400); }
    }
  });
})();
