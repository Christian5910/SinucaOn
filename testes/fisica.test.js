'use strict';
const F = require('../fisica.js'), M = require('../mesa.js');
let ok = 0, falhas = 0;
function t(nome, cond, extra) { if (cond) { ok++; } else { falhas++; console.log('FALHOU:', nome, extra === undefined ? '' : extra); } }
function perto(a, b, tol) { return Math.abs(a - b) <= tol; }

const P = F.params('pool'), R = P.R, G = F.G;
const livre = { P, W: 100, L: 100, segs: [], pontas: [], cacapas: [] };   // mesa sem bordas
function bola(id, x, y) { return F.nova(id, x, y); }
function ultimo(h) { return h[h.length - 1]; }

// 1. rolamento puro: distância de parada v^2 / (2 mur g) e tempo v / (mur g)
{
  const b = bola(0, 0, 0); b.vx = 1; b.wy = 1 / R; F.classificar(P, b);
  const r = F.simular(livre, [b]);
  const f = ultimo(r.hist[0]);
  t('rolando: estado inicial rolando', r.hist[0][0].e === F.EST.ROLANDO);
  t('rolando: distância até parar', perto(r.finais[0].x, 1 / (2 * P.mur * G), 1e-6), r.finais[0].x);
  t('rolando: tempo até parar', perto(r.fim, 1 / (P.mur * G), 1e-6), r.fim);
  t('rolando: termina parada', r.finais[0].e === F.EST.PARADO);
}
// 2. tacada central: desliza e passa a rolar com 5/7 da velocidade inicial
{
  const b = bola(0, 0, 0), v0b = F.tacada(P, b, 0, 2, 0, 0);
  t('tacada central: velocidade da bola = 2 V0/(1+m/M)', perto(v0b, 2 * 2 / (1 + P.m / P.M), 1e-9), v0b);
  const r = F.simular(livre, [b]), h = r.hist[0];
  const rol = h.find(s => s.e === F.EST.ROLANDO);
  t('tacada central: vira rolamento', !!rol);
  t('tacada central: velocidade de rolamento = 5/7 v0', perto(Math.hypot(rol.vx, rol.vy), 5 / 7 * v0b, 1e-6), rol && rol.vx);
  t('tacada central: distância de deslizamento = 12/49 v0^2/(mus g)', perto(rol.x, 12 / 49 * v0b * v0b / (P.mus * G), 1e-6), rol.x);
}
// 3. topspin forte: bola nasce em rolamento quando b = 2R/5
{
  const b = bola(0, 0, 0), v0b = F.tacada(P, b, 0, 2, 0, 0.4 * R);
  t('topspin 2R/5: sai rolando', b.e === F.EST.ROLANDO, b.e);
  t('topspin 2R/5: sem deslizamento', perto(b.wy, b.vx / R, 1e-9));
}
// 4. backspin: a bola volta (draw) depois de bater de frente numa bola parada
{
  const c = bola(0, 0, 0), o = bola(1, 0.6, 0);
  F.tacada(P, c, 0, 3, 0, -0.5 * R);
  const r = F.simular(livre, [c, o]);
  t('draw: bola branca termina atrás do ponto de impacto', r.finais[0].x < 0.6 - 2 * R, r.finais[0].x);
  t('draw: bola alvo anda para frente', r.finais[1].x > 0.7);
}
// 5. topspin (follow): a branca segue a alvo
{
  const c = bola(0, 0, 0), o = bola(1, 0.6, 0);
  F.tacada(P, c, 0, 3, 0, 0.5 * R);
  const r = F.simular(livre, [c, o]);
  t('follow: branca termina à frente do ponto de impacto', r.finais[0].x > 0.6 - 2 * R + 0.1, r.finais[0].x);
}
// 6. colisão frontal com a branca rolando: normal pela restituição
{
  const c = bola(0, 0, 0); c.vx = 2; c.wy = 2 / R; F.classificar(P, c);
  const o = bola(1, 0.5, 0);
  const r = F.simular(livre, [c, o]);
  const ev = r.eventos.find(e => e.tipo === 'bola');
  t('frontal: houve colisão', !!ev);
  const sc = r.hist[0].find(s => s.t >= ev.t - 1e-12 && s.t <= ev.t + 1e-9), so = r.hist[1].find(s => s.t >= ev.t - 1e-12 && s.t <= ev.t + 1e-9);
  t('frontal: velocidade da alvo = (1+e)/2 v', perto(so.vx, (1 + P.eb) / 2 * ev.v, 1e-6), so.vx);
  t('frontal: velocidade da branca = (1-e)/2 v', perto(sc.vx, (1 - P.eb) / 2 * ev.v, 1e-6), sc.vx);
}
// 7. energia nunca cresce nas colisões (aleatório)
{
  let max = 0, rng = 12345;
  function rnd() { rng = (rng * 1664525 + 1013904223) % 4294967296; return rng / 4294967296; }
  function en(b) { return 0.5 * P.m * (b.vx * b.vx + b.vy * b.vy) + 0.5 * P.I * (b.wx * b.wx + b.wy * b.wy + b.wz * b.wz); }
  for (let k = 0; k < 4000; k++) {
    const a = bola(0, 0, 0), b = bola(1, 2 * R * Math.cos(rnd() * 6.28), 0); b.x = 2 * R; b.y = 0;
    const th = rnd() * 6.28, sp = rnd() * 8;
    a.vx = sp * Math.cos(th); a.vy = sp * Math.sin(th); a.wx = (rnd() - .5) * 200; a.wy = (rnd() - .5) * 200; a.wz = (rnd() - .5) * 200;
    b.vx = (rnd() - .5) * 2; b.vy = (rnd() - .5) * 2; b.wx = (rnd() - .5) * 50; b.wy = (rnd() - .5) * 50; b.wz = (rnd() - .5) * 50;
    const E0 = en(a) + en(b), px = a.vx + b.vx, py = a.vy + b.vy;
    F.resolverBolaBola(P, a, b);
    const E1 = en(a) + en(b);
    max = Math.max(max, E1 - E0);
    if (Math.abs(a.vx + b.vx - px) > 1e-9 || Math.abs(a.vy + b.vy - py) > 1e-9) { t('momento linear conservado', false); break; }
  }
  t('colisão bola-bola: energia não cresce', max < 1e-9, max);
}
// 8. regra dos 30 graus (branca rolando): desvio entre ~25 e ~35 graus para cortes de 20 a 40
{
  const res = [];
  for (const corte of [20, 30, 40]) {
    const th = corte * Math.PI / 180;
    const o = bola(1, 1.0, 0);
    // posição da branca para o ângulo de corte: fantasma a 2R da alvo, deslocada
    const gx = o.x - 2 * R * Math.cos(th), gy = o.y + 2 * R * Math.sin(th);   // a branca vai para o fantasma e a alvo sai a -th
    const c = bola(0, gx - 1.0, gy);   // 1 m atrás, mesma direção (+x)
    c.vx = 1.5; c.wy = 1.5 / R; F.classificar(P, c);
    const r = F.simular(livre, [c, o]);
    const ev = r.eventos.find(e => e.tipo === 'bola');
    // direção final da branca: posição final menos posição no impacto
    const sc = r.hist[0].find(s => s.t >= ev.t - 1e-12);
    const fin = r.finais[0];
    const ang = Math.atan2(fin.y - sc.y, fin.x - sc.x) * 180 / Math.PI;
    res.push([corte, ang.toFixed(1)]);
    t('30 graus: corte ' + corte + ' desvio entre 20 e 40', Math.abs(ang) > 20 && Math.abs(ang) < 40, ang);
  }
  if (process.env.V) console.log('30 graus', JSON.stringify(res));
}
// 9. tabela: perpendicular
{
  const m = M.criar('pool9'), b = bola(0, m.W / 2, 1.0);
  b.vy = 2; b.wx = -2 / R; F.classificar(P, b);
  const r = F.simular(m, [b], { tMax: 4 });
  const ev = r.eventos.find(e => e.tipo === 'tabela');
  t('tabela: bateu', !!ev);
  const h = r.hist[0], depois = h.find(s => s.t >= ev.t - 1e-12);
  const e_ef = -depois.vy / ev.v;
  if (process.env.V) console.log('restituição efetiva frontal (rolando)', e_ef.toFixed(3), 'v', ev.v.toFixed(3));
  t('tabela: restituição efetiva entre 0,45 e 0,85', e_ef > 0.45 && e_ef < 0.85, e_ef);
}
// 10. tabela: ângulo (sem efeito) - reflexão com perda tangencial
{
  const m = M.criar('pool9'), b = bola(0, 0.4, 0.4);
  const a = 40 * Math.PI / 180; b.vx = 2 * Math.cos(a); b.vy = 2 * Math.sin(a); F.classificar(P, b);   // desliza
  const r = F.simular(m, [b], { tMax: 2 });
  const ev = r.eventos.find(e => e.tipo === 'tabela');
  t('ângulo: bateu na tabela', !!ev);
}
// 11. caçapas: tiro reto no centro da caçapa
{
  const m = M.criar('pool9');
  let entrou = 0, total = 0;
  for (let k = 0; k < m.cacapas.length; k++) {
    const vz = m.vis[k], b = bola(0, vz.x - vz.nx * 0.6, vz.y - vz.ny * 0.6);
    // bola rolando para a caçapa, vinda do interior da mesa
    b.vx = vz.nx * 1.2; b.vy = vz.ny * 1.2; b.wy = b.vx / R; b.wx = -b.vy / R; F.classificar(P, b);
    const r = F.simular(m, [b]);
    total++; if (r.eventos.some(e => e.tipo === 'cacapa' && e.k === k)) entrou++;
  }
  t('caçapas: tiros retos entram nas 6', entrou === 6, entrou + '/' + total);
}
// 12. determinismo e limite de eventos numa quebra
{
  const m = M.criar('pool9'), bolas = [];
  const foot = { x: m.W / 2, y: m.marcas.pe }, d = 2 * R + 1e-5;
  let id = 1;
  for (let linha = 0; linha < 5; linha++) for (let k = 0; k <= linha; k++) bolas.push(bola(id++, foot.x + (k - linha / 2) * d, foot.y + linha * d * Math.sqrt(3) / 2));
  const c = bola(0, m.W / 2, m.marcas.cabeca); bolas.unshift(c);
  F.tacada(P, c, Math.PI / 2, 7, 0, 0);
  const a = F.simular(m, bolas), b = F.simular(m, bolas);
  t('quebra: determinística', JSON.stringify(a.finais) === JSON.stringify(b.finais));
  t('quebra: terminou sem estourar o limite', !a.esgotou && a.fim < 90, a.fim);
  const dentro = a.finais.filter(x => x.dentro).length;
  if (process.env.V) console.log('quebra: eventos', a.eventos.length, 'fim', a.fim.toFixed(1), 'encaçapadas', dentro);
  // nenhuma bola fora da mesa
  t('quebra: nenhuma bola escapou', a.finais.every(x => x.dentro || (x.x > 0 && x.x < m.W && x.y > 0 && x.y < m.L)));
}
console.log('fisica ok=' + ok + (falhas ? ' FALHAS=' + falhas : ''));
process.exit(falhas ? 1 : 0);
