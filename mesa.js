/* SinucaON! - geometria das mesas (sem DOM).
 * Mesa de pool de 9 pés (superfície 2,54 x 1,27 m, padrão WPA) e de snooker de 12 pés
 * (superfície 3,569 x 1,778 m, WPBSA). As aberturas das caçapas são valores típicos
 * dessas mesas; o formato dos jaws é um modelo simplificado (nós + faces). */
(function (root, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(require('./fisica.js'));
  else root.Mesa = fabrica(root.Fisica);
})(typeof self !== 'undefined' ? self : this, function (F) {
  'use strict';

  var TIPOS = {
    pool9: { bola: 'pool', W: 1.27, L: 2.54, canto: 0.116, meio: 0.130, nome: 'Pool 9 pés' },
    snooker12: { bola: 'snooker', W: 1.778, L: 3.569, canto: 0.0889, meio: 0.1016, nome: 'Snooker 12 pés' }
  };

  function criar(tipo, opc) {
    opc = opc || {};
    var T = TIPOS[tipo], P = F.params(T.bola, opc.params), R = P.R;
    var fator = opc.largura || 1;                       // 1 = medida oficial; >1 = caçapas mais largas
    var W = T.W, L = T.L, cw = T.canto * fator, sw = T.meio * fator;
    var a = cw / Math.SQRT2, segs = [], pontas = [], cacapas = [], vis = [];

    function seg(x1, y1, x2, y2, nx, ny) {
      var len = Math.hypot(x2 - x1, y2 - y1);
      segs.push({ x1: x1, y1: y1, x2: x2, y2: y2, nx: nx, ny: ny, tx: (x2 - x1) / len, ty: (y2 - y1) / len, len: len });
    }
    seg(a, 0, W - a, 0, 0, 1);
    seg(W - a, L, a, L, 0, -1);
    seg(0, L / 2 + sw / 2, 0, L - a, 1, 0);
    seg(0, a, 0, L / 2 - sw / 2, 1, 0);
    seg(W, L / 2 - sw / 2, W, a, -1, 0);
    seg(W, L - a, W, L / 2 + sw / 2, -1, 0);

    var cantos = [[0, 0, -1, -1], [W, 0, 1, -1], [0, L, -1, 1], [W, L, 1, 1]], i, c;
    var dC = 0.0, rpC = Math.hypot(cw / 2 - R, 0.015) + 0.001;
    for (i = 0; i < cantos.length; i++) {
      c = cantos[i];
      var sx = -c[2], sy = -c[3];                       // direção para dentro da mesa
      var t1 = { x: c[0] + sx * a, y: c[1] }, t2 = { x: c[0], y: c[1] + sy * a };
      pontas.push(t1, t2);
      var mx = (t1.x + t2.x) / 2, my = (t1.y + t2.y) / 2, nx = c[2] / Math.SQRT2, ny = c[3] / Math.SQRT2;
      cacapas.push({ x: mx + nx * 0.015, y: my + ny * 0.015, r: rpC, tipo: 'canto' });
      vis.push({ x: mx, y: my, nx: nx, ny: ny, larg: cw, tipo: 'canto' });
    }
    var rpS = Math.hypot(sw / 2 - R, 0.015) + 0.001;
    [[0, -1], [W, 1]].forEach(function (s) {
      var y1 = L / 2 - sw / 2, y2 = L / 2 + sw / 2;
      pontas.push({ x: s[0], y: y1 }, { x: s[0], y: y2 });
      cacapas.push({ x: s[0] + s[1] * 0.015, y: L / 2, r: rpS, tipo: 'meio' });
      vis.push({ x: s[0], y: L / 2, nx: s[1], ny: 0, larg: sw, tipo: 'meio' });
    });

    var m = { tipo: tipo, nome: T.nome, W: W, L: L, P: P, segs: segs, pontas: pontas, cacapas: cacapas, vis: vis, canto: cw, meio: sw };
    if (T.bola === 'snooker') {
      var baulk = 0.737, rd = 0.292;
      m.marcas = {
        baulk: baulk, rD: rd, xc: W / 2,
        amarela: { x: W / 2 + rd, y: baulk }, verde: { x: W / 2 - rd, y: baulk }, marrom: { x: W / 2, y: baulk },
        azul: { x: W / 2, y: L / 2 }, rosa: { x: W / 2, y: 0.75 * L }, preta: { x: W / 2, y: L - 0.324 }
      };
    } else {
      m.marcas = { cabeca: L / 4, pe: 0.75 * L, centro: { x: W / 2, y: L / 2 } };
    }
    return m;
  }

  return { criar: criar, TIPOS: TIPOS };
});
