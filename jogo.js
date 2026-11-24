/* SinucaON! - núcleo dos jogos (sem DOM): executar uma tacada, relatório da jogada,
 * geometria de apoio (bola fantasma, visibilidade, reposição de bolas) e registro de modos. */
(function (root, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(require('./fisica.js'), require('./mesa.js'));
  else root.Jogo = fabrica(root.Fisica, root.Mesa);
})(typeof self !== 'undefined' ? self : this, function (F, M) {
  'use strict';

  var MODOS = {};
  var cacheMesa = {};
  function mesaDe(tipo, largura) {
    var k = tipo + '|' + (largura || 1);
    return cacheMesa[k] || (cacheMesa[k] = M.criar(tipo, { largura: largura }));
  }
  function clonar(S) { return JSON.parse(JSON.stringify(S)); }

  /* ---------- relatório de uma tacada ---------- */
  function relatorio(sim, S) {
    var rel = { primeiro: null, tPrimeiro: Infinity, encacapadas: [], branca: false, tabelaAntes: false,
      tabelaDepois: {}, bolasNaTabela: 0, houveTabela: false, eventos: sim.eventos };
    var ev = sim.eventos, i, e, tocouTabela = {};
    for (i = 0; i < ev.length; i++) {
      e = ev[i];
      if (e.tipo === 'bola' && rel.primeiro === null && (e.i === 0 || e.j === 0)) { rel.primeiro = e.i === 0 ? e.j : e.i; rel.tPrimeiro = e.t; }
    }
    for (i = 0; i < ev.length; i++) {
      e = ev[i];
      if (e.tipo === 'cacapa') { if (e.i === 0) rel.branca = true; rel.encacapadas.push({ id: e.i, k: e.k, t: e.t }); }
      else if (e.tipo === 'tabela') {
        rel.houveTabela = true;
        if (e.i !== 0) tocouTabela[e.i] = true;
        if (e.t < rel.tPrimeiro && e.i === 0) rel.tabelaAntes = true;
        if (e.t >= rel.tPrimeiro) rel.tabelaDepois[e.i] = true;
      }
    }
    rel.bolasNaTabela = Object.keys(tocouTabela).length;
    // bolas encaçapadas sem a branca
    rel.encacapadasObj = rel.encacapadas.filter(function (c) { return c.id !== 0; });
    return rel;
  }

  /* ---------- executar uma tacada ---------- */
  // acao: {ang, v0, a, b, alvo, cac}. Altera uma cópia de S: posições, bolas fora, e chama o modo.
  function executar(S, acao, opc) {
    opc = opc || {};
    var modo = MODOS[S.modo], mesa = mesaDe(S.mesa, S.largura), P = mesa.P, i;
    var bs = [], mapa = {};
    for (i = 0; i < S.bolas.length; i++) {
      var b = S.bolas[i];
      if (b.fora) continue;
      var nb = F.nova(b.id, b.x, b.y); bs.push(nb); mapa[b.id] = nb;
    }
    var cue = mapa[0];
    F.tacada(P, cue, acao.ang, acao.v0, acao.a || 0, acao.b || 0);
    var sim = F.simular(mesa, bs, { tMax: 120 });
    var rel = relatorio(sim, S);
    rel.finais = {};
    var N = clonar(S);
    for (i = 0; i < sim.finais.length; i++) rel.finais[bs[i].id] = sim.finais[i];
    for (i = 0; i < N.bolas.length; i++) {
      var nb2 = N.bolas[i];
      if (nb2.fora) continue;
      var f = rel.finais[nb2.id];
      if (f.dentro) { nb2.fora = true; nb2.cac = f.cac; }
      else { nb2.x = f.x; nb2.y = f.y; }
    }
    N.mao = null;
    var res = modo.arbitrar(N, acao, rel, S);
    return { S: N, sim: sim, rel: rel, res: res, ids: bs.map(function (x) { return x.id; }) };
  }

  /* ---------- geometria ---------- */
  function bolaPorId(S, id) { for (var i = 0; i < S.bolas.length; i++) if (S.bolas[i].id === id) return S.bolas[i]; return null; }
  function emJogo(S) { return S.bolas.filter(function (b) { return !b.fora && b.id !== 0; }); }
  function livre(S, x, y, R, ignorar) {
    for (var i = 0; i < S.bolas.length; i++) {
      var b = S.bolas[i];
      if (b.fora || b.id === ignorar) continue;
      if (Math.hypot(b.x - x, b.y - y) < 2 * R - 1e-6) return false;
    }
    return true;
  }
  // posição livre mais próxima de (x,y) dentro da mesa, no sentido de 'dir' (dx,dy) e depois em espiral
  function pontoLivre(S, mesa, x, y, dir, ignorar) {
    var R = mesa.P.R, k, passo = R * 0.25;
    if (livre(S, x, y, R, ignorar)) return { x: x, y: y };
    if (dir) for (k = 1; k < 200; k++) {
      var px = x + dir[0] * passo * k, py = y + dir[1] * passo * k;
      if (px < R || px > mesa.W - R || py < R || py > mesa.L - R) break;
      if (livre(S, px, py, R, ignorar)) return { x: px, y: py };
    }
    var melhor = null, md = Infinity, ang, r;
    for (r = passo; r < 0.8; r += passo) for (ang = 0; ang < 6.2832; ang += 0.2) {
      var qx = x + r * Math.cos(ang), qy = y + r * Math.sin(ang);
      if (qx < R || qx > mesa.W - R || qy < R || qy > mesa.L - R) continue;
      if (livre(S, qx, qy, R, ignorar) && r < md) { md = r; melhor = { x: qx, y: qy }; }
      if (melhor) return melhor;
    }
    return melhor || { x: x, y: y };
  }

  // a branca em (cx,cy) alcança alguma parte da bola alvo sem tocar antes em outra bola? (varredura angular)
  function visivel(S, mesa, cx, cy, idAlvo, idsIgnorar) {
    var R = mesa.P.R, alvo = bolaPorId(S, idAlvo);
    if (!alvo || alvo.fora) return false;
    var dx = alvo.x - cx, dy = alvo.y - cy, d = Math.hypot(dx, dy);
    if (d < 2 * R - 1e-6) return true;
    var base = Math.atan2(dy, dx), meio = Math.asin(Math.min(1, 2 * R * 0.999 / d)), k, passos = 24;
    var outras = S.bolas.filter(function (b) { return !b.fora && b.id !== 0 && b.id !== idAlvo && !(idsIgnorar && idsIgnorar.indexOf(b.id) >= 0); });
    for (k = 0; k <= passos; k++) {
      var th = base - meio + (2 * meio) * k / passos, ux = Math.cos(th), uy = Math.sin(th);
      // distância até o contato com o alvo ao longo do raio
      var tA = tocar(cx, cy, ux, uy, alvo.x, alvo.y, 2 * R);
      if (tA === Infinity) continue;
      var bloq = false, j;
      for (j = 0; j < outras.length; j++) {
        var tO = tocar(cx, cy, ux, uy, outras[j].x, outras[j].y, 2 * R);
        if (tO < tA - 1e-9) { bloq = true; break; }
      }
      if (!bloq) return true;
    }
    return false;
  }
  // primeiro instante em que um círculo (centro em cx,cy; direção u) toca o círculo de centro (px,py) com raio de contorno r
  function tocar(cx, cy, ux, uy, px, py, r) {
    var fx = cx - px, fy = cy - py, b = fx * ux + fy * uy, c = fx * fx + fy * fy - r * r, disc = b * b - c;
    if (disc < 0) return Infinity;
    var t = -b - Math.sqrt(disc);
    return t >= -1e-9 ? Math.max(0, t) : Infinity;
  }
  // bola de ponta: a branca precisa passar "tirando fino" dos dois lados da bola: ambos os extremos livres
  function visivelDosDoisLados(S, mesa, cx, cy, idAlvo) {
    var R = mesa.P.R, alvo = bolaPorId(S, idAlvo);
    if (!alvo || alvo.fora) return false;
    var dx = alvo.x - cx, dy = alvo.y - cy, d = Math.hypot(dx, dy);
    if (d < 2 * R) return true;
    var base = Math.atan2(dy, dx), meio = Math.asin(Math.min(1, 2 * R * 0.9 / d)), lados = [-meio, meio], k, ok = 0;
    var outras = S.bolas.filter(function (b) { return !b.fora && b.id !== 0 && b.id !== idAlvo; });
    for (k = 0; k < 2; k++) {
      var th = base + lados[k], ux = Math.cos(th), uy = Math.sin(th);
      var tA = tocar(cx, cy, ux, uy, alvo.x, alvo.y, 2 * R), bloq = tA === Infinity, j;
      for (j = 0; !bloq && j < outras.length; j++) if (tocar(cx, cy, ux, uy, outras[j].x, outras[j].y, 2 * R) < tA - 1e-9) bloq = true;
      if (!bloq) ok++;
    }
    return ok === 2;
  }

  // ângulo de mira e posição da "bola fantasma" para encaçapar 'alvo' na caçapa 'cp' (ponto de mira na boca)
  function fantasma(mesa, cx, cy, alvo, cp) {
    var R = mesa.P.R, tx = cp.x - alvo.x, ty = cp.y - alvo.y, td = Math.hypot(tx, ty) || 1;
    tx /= td; ty /= td;
    var gx = alvo.x - tx * 2 * R, gy = alvo.y - ty * 2 * R;
    var ang = Math.atan2(gy - cy, gx - cx);
    var dx = gx - cx, dy = gy - cy;
    var vx = alvo.x - cx, vy = alvo.y - cy;
    var corte = Math.acos(Math.max(-1, Math.min(1, (dx * tx + dy * ty) / (Math.hypot(dx, dy) || 1)))) * 180 / Math.PI;
    return { gx: gx, gy: gy, ang: ang, corte: corte, dist: Math.hypot(dx, dy), distAlvo: td };
  }

  // distância mínima de um ponto a um segmento
  function distSeg(px, py, x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy, t = l2 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }
  // o segmento está livre de outras bolas (exceto 'ignorar') com folga 'folga'?
  function caminhoLivre(S, x1, y1, x2, y2, ignorar, folga) {
    for (var i = 0; i < S.bolas.length; i++) {
      var b = S.bolas[i];
      if (b.fora || (ignorar && ignorar.indexOf(b.id) >= 0)) continue;
      if (distSeg(b.x, b.y, x1, y1, x2, y2) < folga) return false;
    }
    return true;
  }
  function aplicarMao(S, x, y) {
    var b = bolaPorId(S, 0);
    b.fora = false; b.x = x; b.y = y; S.mao = null;
    return S;
  }

  function registrar(modo) { MODOS[modo.id] = modo; }
  function modo(id) { return MODOS[id]; }

  return { MODOS: MODOS, registrar: registrar, modo: modo, mesaDe: mesaDe, clonar: clonar, executar: executar, relatorio: relatorio,
    bolaPorId: bolaPorId, emJogo: emJogo, livre: livre, pontoLivre: pontoLivre, visivel: visivel,
    visivelDosDoisLados: visivelDosDoisLados, fantasma: fantasma, tocar: tocar, distSeg: distSeg, caminhoLivre: caminhoLivre, aplicarMao: aplicarMao };
});
