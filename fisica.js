/* SinucaON! - motor de física (sem DOM; roda no navegador e no Node).
 *
 * Modelo orientado a eventos: cada bola tem uma trajetória exata (parada, girando,
 * deslizando ou rolando) e o motor só calcula os instantes em que algo muda:
 * transição de movimento, colisão bola-bola, bola-tabela ou queda na caçapa.
 *
 * Referências (equações e constantes; nenhum código foi copiado):
 *  - Leckie e Greenspan (2006), "An event-based pool physics simulator"
 *  - Han (2005), "Dynamics in carom and three cushion billiards" (tabela)
 *  - Alciatore, "Billiards: ball-ball friction and cue-ball impulse" (TP A.4, TP A.14)
 *  - Mathavan et al. (2010), cushion impact analysis
 *  - constantes padrão do projeto pooltool (Apache-2.0), ver CREDITOS.txt
 * Unidades do SI (m, s, kg). Eixos: x ao longo da largura, y ao longo do comprimento.
 */
(function (root, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else root.Fisica = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var G = 9.81;
  var EST = { PARADO: 0, GIRANDO: 1, ROLANDO: 2, DESLIZANDO: 3, CACAPA: 4 };
  var EPSV = 1e-5;      // velocidade (m/s) abaixo da qual a bola é considerada parada
  var HMAX = 200;       // horizonte máximo de um evento (s)

  /* ---------- parâmetros por tipo de bola e pano ---------- */
  var PARAMS = {
    pool: { R: 0.028575, m: 0.170097, mus: 0.2, mur: 0.01, musp: 0.4444444, eb: 0.95, ec: 0.85, fc: 0.2, M: 0.567, etip: 1 },
    snooker: { R: 0.02619375, m: 0.142, mus: 0.5, mur: 0.01, musp: 0.4444444, eb: 0.95, ec: 0.85, fc: 0.5, M: 0.567, etip: 1 }
  };
  function params(tipo, extra) {
    var b = PARAMS[tipo] || PARAMS.pool, p = {}, k;
    for (k in b) p[k] = b[k];
    if (extra) for (k in extra) p[k] = extra[k];
    p.h = 7 * p.R / 5;                       // altura do contato com a tabela (Han 2005)
    p.I = 0.4 * p.m * p.R * p.R;             // momento de inércia da esfera
    p.alfaSpin = 2.5 * p.musp * G;           // desaceleração do giro vertical (rad/s2): 5*musp*G/(2R) com musp=prop*R
    return p;
  }

  /* ---------- polinômios: raízes reais num intervalo ---------- */
  function aval(c, t) { var r = 0, i; for (i = c.length - 1; i >= 0; i--) r = r * t + c[i]; return r; }
  function derivada(c) { var d = [], i; for (i = 1; i < c.length; i++) d.push(c[i] * i); return d; }
  function bisseccao(c, a, b, fa) {
    var i, m, fm;
    for (i = 0; i < 80; i++) {
      m = 0.5 * (a + b); fm = aval(c, m);
      if ((fm < 0) === (fa < 0)) { a = m; fa = fm; } else b = m;
      if (b - a < 1e-13) break;
    }
    return 0.5 * (a + b);
  }
  // todas as raízes reais de c (potências crescentes) em [a, b], em ordem
  function raizes(c, a, b) {
    var n = c.length - 1;
    while (n > 0 && c[n] === 0) n--;
    if (n === 0) return [];
    if (n === 1) { var r1 = -c[0] / c[1]; return (r1 >= a && r1 <= b) ? [r1] : []; }
    var cc = c.slice(0, n + 1);
    var crit = raizes(derivada(cc), a, b);
    var pts = [a].concat(crit, [b]), out = [], i, p, q, fp, fq, r;
    fp = aval(cc, pts[0]);
    for (i = 0; i < pts.length - 1; i++) {
      p = pts[i]; q = pts[i + 1]; fq = aval(cc, q);
      if (fp === 0) { if (!out.length || out[out.length - 1] !== p) out.push(p); }
      else if (fp * fq < 0) { r = bisseccao(cc, p, q, fp); out.push(r); }
      fp = fq;
    }
    if (fp === 0 && (!out.length || out[out.length - 1] !== b)) out.push(b);
    return out;
  }
  // primeira raiz em [0, H] em que o polinômio passa de positivo para negativo
  function primeiraDescida(c, H) {
    var rs = raizes(c, 0, H), d = derivada(c), i;
    for (i = 0; i < rs.length; i++) if (aval(d, rs[i]) < 0) return rs[i];
    return Infinity;
  }

  /* ---------- estado de uma bola ---------- */
  function nova(id, x, y) { return { id: id, x: x, y: y, vx: 0, vy: 0, wx: 0, wy: 0, wz: 0, e: EST.PARADO, t: 0, dentro: false, cac: -1 }; }
  function copiar(b) { return { id: b.id, x: b.x, y: b.y, vx: b.vx, vy: b.vy, wx: b.wx, wy: b.wy, wz: b.wz, e: b.e, t: b.t, dentro: b.dentro, cac: b.cac }; }

  function classificar(P, b) {
    var R = P.R, v = Math.hypot(b.vx, b.vy);
    if (v < EPSV && Math.hypot(b.wx, b.wy) * R < EPSV) {
      b.vx = b.vy = b.wx = b.wy = 0;
      b.e = Math.abs(b.wz) > 1e-4 ? EST.GIRANDO : EST.PARADO;
      if (b.e === EST.PARADO) b.wz = 0;
    } else {
      var ux = b.vx - R * b.wy, uy = b.vy + R * b.wx;
      if (Math.hypot(ux, uy) < EPSV) { b.e = EST.ROLANDO; b.wy = b.vx / R; b.wx = -b.vy / R; }
      else b.e = EST.DESLIZANDO;
    }
    return b;
  }

  // aceleração linear (ax, ay) na fase atual
  function acel(P, b) {
    if (b.e === EST.ROLANDO) {
      var v = Math.hypot(b.vx, b.vy);
      if (v < 1e-12) return [0, 0];
      var a = P.mur * G; return [-a * b.vx / v, -a * b.vy / v];
    }
    if (b.e === EST.DESLIZANDO) {
      var ux = b.vx - P.R * b.wy, uy = b.vy + P.R * b.wx, u = Math.hypot(ux, uy), a2 = P.mus * G;
      if (u < 1e-12) return [0, 0];
      return [-a2 * ux / u, -a2 * uy / u];
    }
    return [0, 0];
  }

  // tempo restante (s) até a próxima transição de movimento
  function tTransicao(P, b) {
    if (b.e === EST.DESLIZANDO) {
      var u = Math.hypot(b.vx - P.R * b.wy, b.vy + P.R * b.wx);
      return 2 * u / (7 * P.mus * G);
    }
    if (b.e === EST.ROLANDO) return Math.hypot(b.vx, b.vy) / (P.mur * G);
    if (b.e === EST.GIRANDO) return Math.abs(b.wz) / P.alfaSpin;
    return Infinity;
  }

  // novo estado no instante t (t >= b.t), sem eventos no intervalo
  function avancar(P, b, t) {
    var dt = t - b.t, n = copiar(b), R = P.R;
    n.t = t;
    if (dt <= 0 || b.dentro) return n;
    if (b.e === EST.ROLANDO) {
      var v = Math.hypot(b.vx, b.vy), a = P.mur * G;
      if (v > 1e-12) {
        var tt = Math.min(dt, v / a), d = v * tt - 0.5 * a * tt * tt, vf = Math.max(0, v - a * dt);
        n.x += d * b.vx / v; n.y += d * b.vy / v;
        n.vx = b.vx / v * vf; n.vy = b.vy / v * vf;
        n.wy = n.vx / R; n.wx = -n.vy / R;
      }
    } else if (b.e === EST.DESLIZANDO) {
      var ux = b.vx - R * b.wy, uy = b.vy + R * b.wx, u = Math.hypot(ux, uy);
      if (u > 1e-12) {
        var a2 = P.mus * G, hx = ux / u, hy = uy / u;
        n.x += b.vx * dt - 0.5 * a2 * dt * dt * hx;
        n.y += b.vy * dt - 0.5 * a2 * dt * dt * hy;
        n.vx = b.vx - a2 * dt * hx; n.vy = b.vy - a2 * dt * hy;
        var k = 2.5 * P.mus * G * dt / R;
        n.wx = b.wx - k * hy; n.wy = b.wy + k * hx;
      }
    }
    if (b.wz !== 0) {
      var dw = P.alfaSpin * dt;
      n.wz = Math.abs(b.wz) <= dw ? 0 : b.wz - Math.sign(b.wz) * dw;
    }
    return n;
  }

  /* ---------- tacada (impulso do taco) ---------- */
  // dir: ângulo da tacada (rad, 0 = +x); v0: velocidade do taco (m/s);
  // a: deslocamento lateral do ponto de contato (m, positivo = direita de quem mira),
  // b: deslocamento vertical (m, positivo = acima do centro)
  function tacada(P, bola, dir, v0, a, b) {
    var R = P.R, dx = Math.cos(dir), dy = Math.sin(dir);
    a = a || 0; b = b || 0;
    var off = Math.hypot(a, b), lim = 0.9 * R;
    if (off > lim) { a *= lim / off; b *= lim / off; }
    var J = (1 + P.etip) * v0 / (1 / P.m + 1 / P.M + (a * a + b * b) / P.I);
    bola.vx = J / P.m * dx; bola.vy = J / P.m * dy;
    bola.wx = J / P.I * (-b * dy);
    bola.wy = J / P.I * (b * dx);
    bola.wz = J / P.I * a;
    classificar(P, bola);
    return J / P.m;   // velocidade inicial da bola
  }

  /* ---------- colisão bola-bola (Alciatore) ---------- */
  function atritoBolaBola(vrel) { return 9.951e-3 + 0.108 * Math.exp(-1.088 * vrel); }

  function resolverBolaBola(P, bi, bj) {
    var dx = bj.x - bi.x, dy = bj.y - bi.y, d = Math.hypot(dx, dy);
    if (d < 1e-12) return 0;
    var nx = dx / d, ny = dy / d, tx = -ny, ty = nx, R = P.R;
    var vn = (bi.vx - bj.vx) * nx + (bi.vy - bj.vy) * ny;
    if (vn <= 0) return 0;
    var e = vn < 0.01 ? 0 : P.eb;                       // contato quase parado: sem quique
    var dv = (1 + e) * vn / 2, Jn = P.m * dv;
    var st = (bi.vx - bj.vx) * tx + (bi.vy - bj.vy) * ty + R * (bi.wz + bj.wz);
    var mu = atritoBolaBola(Math.abs(st));
    var Jt = Math.min(mu * Jn, Math.abs(st) * P.m / 7), sg = st >= 0 ? 1 : -1;
    bi.vx += -dv * nx - Jt * sg / P.m * tx; bi.vy += -dv * ny - Jt * sg / P.m * ty;
    bj.vx += dv * nx + Jt * sg / P.m * tx;  bj.vy += dv * ny + Jt * sg / P.m * ty;
    bi.wz += -R * Jt * sg / P.I; bj.wz += -R * Jt * sg / P.I;
    // separa ligeiramente para não detectar o mesmo contato de novo
    var folga = 2 * R + 1e-9 - d;
    if (folga > 0) { bi.x -= nx * folga / 2; bi.y -= ny * folga / 2; bj.x += nx * folga / 2; bj.y += ny * folga / 2; }
    classificar(P, bi); classificar(P, bj);
    return vn;
  }

  /* ---------- colisão com a tabela (Han 2005) ---------- */
  // nx, ny: normal unitária apontando da bola para a tabela
  function resolverTabela(P, b, nx, ny, ec, fc) {
    var R = P.R, m = P.m;
    var vx = b.vx * nx + b.vy * ny, vy = -b.vx * ny + b.vy * nx;
    var wx = b.wx * nx + b.wy * ny, wy = -b.wx * ny + b.wy * nx, wz = b.wz;
    if (vx <= 0) return 0;
    var vin = vx;
    var th = Math.asin(P.h / R - 1), sn = Math.sin(th), cs = Math.cos(th);
    var sx = vx * sn + R * wy;
    var sy = -vy - R * wz * cs + R * wx * sn;
    var c = vx * cs, A = 7 / (2 * m), B = 1 / m;
    var e = vx < 0.01 ? 0 : ec;
    var Pn = (1 + e) * c / B, PzS = Math.hypot(sx, sy) / A;
    var PX, PY, PZ;
    if (PzS <= fc * Pn || PzS === 0) {                  // adere (stick)
      PX = -(sx / A) * sn - Pn * cs;
      PY = sy / A;
      PZ = (sx / A) * cs - Pn * sn;
    } else {                                           // desliza no contato
      var sl = Math.hypot(sx, sy), cp = sx / sl, sp = sy / sl;
      PX = -fc * Pn * cp * sn - Pn * cs;
      PY = fc * Pn * sp;
      PZ = fc * Pn * cp * cs - Pn * sn;
    }
    vx += PX / m; vy += PY / m;
    wx += -(R / P.I) * PY * sn;
    wy += (R / P.I) * (PX * sn - PZ * cs);
    wz += (R / P.I) * PY * cs;
    b.vx = vx * nx - vy * ny; b.vy = vx * ny + vy * nx;
    b.wx = wx * nx - wy * ny; b.wy = wx * ny + wy * nx; b.wz = wz;
    classificar(P, b);
    return vin;
  }

  /* ---------- simulação ---------- */
  // mesa: {W, L, P, segs:[{x1,y1,x2,y2,nx,ny,len}], pontas:[{x,y}], cacapas:[{x,y,r}]}
  // bolas: lista de estados (nova()). Retorna {hist, eventos, fim}
  function simular(mesa, bolas, opc) {
    opc = opc || {};
    var P = mesa.P, R = P.R, n = bolas.length, tMax = opc.tMax || 90, maxEv = opc.maxEv || 20000;
    var S = bolas.map(copiar), hist = [], ver = [], i, j;
    var t0 = opc.t0 || 0;
    for (i = 0; i < n; i++) { S[i].t = t0; hist.push([copiar(S[i])]); ver.push(0); }
    var eventos = [];
    var tn = t0;

    var evTr = new Array(n), evBd = new Array(n), evPr = [];
    for (i = 0; i < n; i++) evPr.push(new Array(n));

    function paraAgora(i) { if (S[i].t < tn) S[i] = avancar(P, S[i], tn); return S[i]; }

    function eventoBorda(i) {
      var b = S[i], Tr = tTransicao(P, b), H = Math.min(HMAX, isFinite(Tr) ? Tr : HMAX);
      if (b.e === EST.PARADO || b.e === EST.GIRANDO) return null;
      var a = acel(P, b), best = { t: Infinity }, k, t;
      var ax = a[0], ay = a[1];
      // caçapas
      for (k = 0; k < mesa.cacapas.length; k++) {
        var cp = mesa.cacapas[k], Cx = b.x - cp.x, Cy = b.y - cp.y;
        var c0 = Cx * Cx + Cy * Cy - cp.r * cp.r;
        if (c0 <= 0) { best = { t: 0, tipo: 'cacapa', k: k }; break; }
        var Ax = 0.5 * ax, Ay = 0.5 * ay, Bx = b.vx, By = b.vy;
        t = primeiraDescida([c0, 2 * (Bx * Cx + By * Cy), Bx * Bx + By * By + 2 * (Ax * Cx + Ay * Cy), 2 * (Ax * Bx + Ay * By), Ax * Ax + Ay * Ay], H);
        if (t < best.t) best = { t: t, tipo: 'cacapa', k: k };
      }
      // segmentos de tabela
      for (k = 0; k < mesa.segs.length; k++) {
        var sg = mesa.segs[k];
        var s0 = sg.nx * (b.x - sg.x1) + sg.ny * (b.y - sg.y1) - R;
        var sv = sg.nx * b.vx + sg.ny * b.vy, sa = sg.nx * ax + sg.ny * ay;
        if (s0 < -1e-9) { if (sv < 0) { t = 0; } else continue; }
        else t = primeiraDescida([s0, sv, 0.5 * sa], H);
        if (t >= best.t) continue;
        // posição ao longo do segmento no instante t
        var px = b.x + b.vx * t + 0.5 * ax * t * t, py = b.y + b.vy * t + 0.5 * ay * t * t;
        var u = (px - sg.x1) * sg.tx + (py - sg.y1) * sg.ty;
        if (u >= 0 && u <= sg.len) best = { t: t, tipo: 'seg', k: k };
      }
      // pontas dos jaws (nós)
      for (k = 0; k < mesa.pontas.length; k++) {
        var pt = mesa.pontas[k], Cx2 = b.x - pt.x, Cy2 = b.y - pt.y, rr = R + (pt.r || 0);
        var d0 = Cx2 * Cx2 + Cy2 * Cy2 - rr * rr;
        var Ax2 = 0.5 * ax, Ay2 = 0.5 * ay;
        if (d0 <= 1e-12) {
          if (b.vx * Cx2 + b.vy * Cy2 < 0) t = 0; else continue;
        } else t = primeiraDescida([d0, 2 * (b.vx * Cx2 + b.vy * Cy2), b.vx * b.vx + b.vy * b.vy + 2 * (Ax2 * Cx2 + Ay2 * Cy2), 2 * (Ax2 * b.vx + Ay2 * b.vy), Ax2 * Ax2 + Ay2 * Ay2], H);
        if (t < best.t) best = { t: t, tipo: 'ponta', k: k };
      }
      if (best.t === Infinity) return null;
      best.t += b.t; best.i = i; best.ver = ver[i];
      return best;
    }

    function eventoPar(i, j) {
      var bi = S[i], bj = S[j];
      if (bi.dentro || bj.dentro) return null;
      var ri = bi.e === EST.PARADO || bi.e === EST.GIRANDO, rj = bj.e === EST.PARADO || bj.e === EST.GIRANDO;
      if (ri && rj) return null;
      var tref = tn;
      var si = avancar(P, bi, tref), sj = avancar(P, bj, tref);
      var Ti = tTransicao(P, si), Tj = tTransicao(P, sj);
      var H = Math.min(HMAX, Ti, Tj);
      var ai = acel(P, si), aj = acel(P, sj);
      var Ax = 0.5 * (aj[0] - ai[0]), Ay = 0.5 * (aj[1] - ai[1]);
      var Bx = sj.vx - si.vx, By = sj.vy - si.vy, Cx = sj.x - si.x, Cy = sj.y - si.y;
      var c0 = Cx * Cx + Cy * Cy - 4 * R * R, c1 = 2 * (Bx * Cx + By * Cy);
      var t;
      if (c0 <= 1e-12) { if (c1 < 0) t = 0; else { t = primeiraDescida([c0, c1, Bx * Bx + By * By + 2 * (Ax * Cx + Ay * Cy), 2 * (Ax * Bx + Ay * By), Ax * Ax + Ay * Ay], H); } }
      else t = primeiraDescida([c0, c1, Bx * Bx + By * By + 2 * (Ax * Cx + Ay * Cy), 2 * (Ax * Bx + Ay * By), Ax * Ax + Ay * Ay], H);
      if (t === Infinity) return null;
      return { t: tref + t, tipo: 'par', i: i, j: j, vi: ver[i], vj: ver[j] };
    }

    function recalcular(i) {
      var b = S[i];
      if (b.dentro) { evTr[i] = null; evBd[i] = null; for (var jj = 0; jj < n; jj++) { evPr[Math.min(i, jj)][Math.max(i, jj)] = null; } return; }
      var Tr = tTransicao(P, b);
      evTr[i] = isFinite(Tr) ? { t: b.t + Tr, tipo: 'trans', i: i, ver: ver[i] } : null;
      evBd[i] = eventoBorda(i);
      for (var j2 = 0; j2 < n; j2++) {
        if (j2 === i) continue;
        evPr[Math.min(i, j2)][Math.max(i, j2)] = eventoPar(Math.min(i, j2), Math.max(i, j2));
      }
    }

    function registrar(i) { hist[i].push(copiar(S[i])); }

    for (i = 0; i < n; i++) classificar(P, S[i]);
    for (i = 0; i < n; i++) registrar(i), hist[i].shift();
    for (i = 0; i < n; i++) recalcular(i);

    var contador = 0, mesmoInstante = 0, ultimoT = -1, parT = {}, parC = {};
    while (contador++ < maxEv) {
      var melhor = null, e;
      for (i = 0; i < n; i++) {
        e = evTr[i]; if (e && e.ver === ver[i] && (!melhor || e.t < melhor.t)) melhor = e;
        e = evBd[i]; if (e && e.ver === ver[i] && (!melhor || e.t < melhor.t)) melhor = e;
        for (j = i + 1; j < n; j++) {
          e = evPr[i][j];
          if (e && e.vi === ver[i] && e.vj === ver[j] && (!melhor || e.t < melhor.t)) melhor = e;
        }
      }
      if (!melhor || melhor.t > tMax) break;
      if (melhor.t < tn) melhor.t = tn;
      if (melhor.t - ultimoT < 1e-9) mesmoInstante++; else mesmoInstante = 0;
      ultimoT = melhor.t;
      if (mesmoInstante > 400) {            // contato preso: assenta as bolas envolvidas
        var q = melhor.i, r2 = melhor.j;
        paraAgora(q); S[q].vx = S[q].vy = 0; S[q].wx = S[q].wy = 0; classificar(P, S[q]); ver[q]++; registrar(q); recalcular(q);
        if (r2 !== undefined) { paraAgora(r2); S[r2].vx = S[r2].vy = 0; S[r2].wx = S[r2].wy = 0; classificar(P, S[r2]); ver[r2]++; registrar(r2); recalcular(r2); }
        mesmoInstante = 0; continue;
      }
      tn = melhor.t;
      if (melhor.tipo === 'trans') {
        i = melhor.i; paraAgora(i);
        var s = S[i];
        if (s.e === EST.DESLIZANDO) { s.e = EST.ROLANDO; s.wy = s.vx / R; s.wx = -s.vy / R; }
        else if (s.e === EST.ROLANDO) { s.vx = s.vy = 0; s.wx = s.wy = 0; s.e = Math.abs(s.wz) > 1e-4 ? EST.GIRANDO : EST.PARADO; if (s.e === EST.PARADO) s.wz = 0; }
        else if (s.e === EST.GIRANDO) { s.wz = 0; s.e = EST.PARADO; }
        ver[i]++; registrar(i); recalcular(i);
      } else if (melhor.tipo === 'par') {
        i = melhor.i; j = melhor.j; paraAgora(i); paraAgora(j);
        var vimp = resolverBolaBola(P, S[i], S[j]);
        eventos.push({ t: tn, tipo: 'bola', i: S[i].id, j: S[j].id, v: vimp });
        // contatos em cadeia entre bolas coladas geram milhares de choques minúsculos (problema de Zenão):
        // se o mesmo par bate muitas vezes em poucos milissegundos a menos de 5 cm/s, as duas bolas assentam
        var kp = i * n + j;
        if (vimp < 0.05 && tn - (parT[kp] === undefined ? -1 : parT[kp]) < 2e-3) parC[kp] = (parC[kp] || 0) + 1; else parC[kp] = 0;
        parT[kp] = tn;
        if (parC[kp] >= 12) {
          S[i].vx = S[i].vy = S[i].wx = S[i].wy = 0; S[j].vx = S[j].vy = S[j].wx = S[j].wy = 0;
          classificar(P, S[i]); classificar(P, S[j]); parC[kp] = 0;
        }
        ver[i]++; ver[j]++; registrar(i); registrar(j); recalcular(i); recalcular(j);
      } else {
        i = melhor.i; paraAgora(i); var bb = S[i];
        if (melhor.tipo === 'cacapa') {
          var cpz = mesa.cacapas[melhor.k];
          bb.dentro = true; bb.cac = melhor.k; bb.e = EST.CACAPA;
          eventos.push({ t: tn, tipo: 'cacapa', i: bb.id, k: melhor.k, v: Math.hypot(bb.vx, bb.vy) });
          ver[i]++; registrar(i); recalcular(i);
          // bolas vizinhas continuam; nada mais a recalcular aqui
          for (j = 0; j < n; j++) if (j !== i) recalcular(j);
        } else {
          var nxo, nyo, ec = P.ec, fc = P.fc, vv;
          if (melhor.tipo === 'seg') { var sgm = mesa.segs[melhor.k]; nxo = -sgm.nx; nyo = -sgm.ny; }
          else { var ptm = mesa.pontas[melhor.k]; var ddx = ptm.x - bb.x, ddy = ptm.y - bb.y, dd = Math.hypot(ddx, ddy) || 1; nxo = ddx / dd; nyo = ddy / dd; }
          vv = bb.vx * nxo + bb.vy * nyo;
          if (vv > 1e-6) {
            resolverTabela(P, bb, nxo, nyo, ec, fc);
            eventos.push({ t: tn, tipo: 'tabela', i: bb.id, v: vv, ponta: melhor.tipo === 'ponta' });
          } else if (vv > 0) { bb.vx -= vv * nxo; bb.vy -= vv * nyo; classificar(P, bb); }
          ver[i]++; registrar(i); recalcular(i);
        }
      }
    }
    var fim = tn;
    // fecha o histórico: posições finais
    var finais = S.map(function (b) { return avancar(P, b, Math.max(b.t, fim)); });
    return { hist: hist, eventos: eventos, fim: fim, finais: finais, esgotou: contador > maxEv };
  }

  // estado de uma bola no instante t a partir do histórico
  function estadoEm(P, h, t) {
    var lo = 0, hi = h.length - 1, m;
    if (t <= h[0].t) return h[0];
    while (lo < hi) { m = (lo + hi + 1) >> 1; if (h[m].t <= t) lo = m; else hi = m - 1; }
    return avancar(P, h[lo], t);
  }

  return { G: G, EST: EST, params: params, nova: nova, copiar: copiar, classificar: classificar, avancar: avancar,
    acel: acel, tTransicao: tTransicao, tacada: tacada, simular: simular, estadoEm: estadoEm,
    resolverBolaBola: resolverBolaBola, resolverTabela: resolverTabela, raizes: raizes, primeiraDescida: primeiraDescida };
});
