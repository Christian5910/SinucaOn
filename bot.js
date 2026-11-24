/* SinucaON! - robô: escolhe a tacada simulando de verdade com o motor de física.
 * Níveis: 1 Fácil, 2 Médio, 3 Difícil (mudam o erro de execução e a profundidade da busca). */
(function (root, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(require('./fisica.js'), require('./jogo.js'));
  else root.Bot = fabrica(root.Fisica, root.Jogo);
})(typeof self !== 'undefined' ? self : this, function (F, J) {
  'use strict';

  var NIVEIS = {
    1: { nome: 'Fácil', sigAng: 1.6, sigPot: 0.12, maxCorte: 55, refinar: 0, topo: 4, efeito: false, vazio: 0 },
    2: { nome: 'Médio', sigAng: 0.9, sigPot: 0.07, maxCorte: 65, refinar: 2, topo: 3, efeito: false, vazio: 1 },
    3: { nome: 'Difícil', sigAng: 0.3, sigPot: 0.03, maxCorte: 72, refinar: 3, topo: 2, efeito: true, vazio: 1 }
  };
  var D2R = Math.PI / 180;

  function gauss(rng) { var u = 1 - rng(), v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

  // velocidade do taco (m/s) que dá a velocidade inicial 'vb' à bola branca
  function tacoPara(P, vb) { return vb * (1 + P.m / P.M) / (1 + P.etip); }
  function bolaDoTaco(P, v0) { return (1 + P.etip) * v0 / (1 + P.m / P.M); }

  function nivelDe(n) { return NIVEIS[n] || NIVEIS[2]; }

  /* ---------- geometria dos candidatos ---------- */
  function candidatosDiretos(S, mesa, ids, maxCorte) {
    var P = mesa.P, R = P.R, cue = J.bolaPorId(S, 0), out = [], i, k, modo = J.modo(S.modo);
    for (i = 0; i < ids.length; i++) {
      var alvo = J.bolaPorId(S, ids[i]);
      if (!alvo || alvo.fora) continue;
      for (k = 0; k < mesa.cacapas.length; k++) {
        var cp = mesa.cacapas[k], f = J.fantasma(mesa, cue.x, cue.y, alvo, cp);
        if (f.corte > (maxCorte || 80) || f.dist < 1e-3) continue;
        if (f.gx < R || f.gx > mesa.W - R || f.gy < R || f.gy > mesa.L - R) continue;
        if (!J.caminhoLivre(S, cue.x, cue.y, f.gx, f.gy, [0, alvo.id], 2 * R - 1e-4)) continue;
        if (!J.caminhoLivre(S, alvo.x, alvo.y, cp.x, cp.y, [0, alvo.id], 2 * R - 1e-4)) continue;
        out.push({ alvo: alvo.id, cac: k, f: f, corte: f.corte, chamar: !!(modo && modo.chamar && modo.chamar(S, alvo.id)) });
      }
    }
    return out;
  }

  // velocidades de bola alvo para chegar à caçapa com folga
  function potenciasPara(P, f, alvoDist) {
    var G = F.G, vt0 = Math.sqrt(0.5 * 0.5 + 2 * P.mur * G * alvoDist * 1.15);
    var cosC = Math.max(0.25, Math.cos(f.corte * D2R));
    var base = vt0 / (0.975 * cosC);
    var vb = [], mult = [1.0, 1.5, 2.4], j;
    for (j = 0; j < mult.length; j++) {
      var vc = base * mult[j];
      vb.push(Math.min(11, Math.sqrt(vc * vc + 2 * 0.25 * G * f.dist)));
    }
    return vb;
  }

  /* ---------- avaliação ---------- */
  function ofertas(S, mesa, modo) {
    // número de jogadas diretas viáveis para quem joga em S (heurística geométrica)
    var a = modo.alvos(S), n = 0;
    var cs = candidatosDiretos(S, mesa, a.ids || [], null);
    n = cs.length;
    return Math.min(n, 8);
  }

  function valorGenerico(S0, r, modo, quem) {
    var N = r.S, v = 0, opp = 1 - quem;
    if (modo.valor) return modo.valor(S0, r, quem);
    if (N.placar) v += (N.placar[quem] - S0.placar[quem]) - (N.placar[opp] - S0.placar[opp]);
    return v;
  }

  function avaliarAcao(S, acao, modo, quem, mesa, nivel) {
    var r = J.executar(S, acao), N = r.S, v = valorGenerico(S, r, modo, quem);
    if (r.res && r.res.repetir) v -= 40; // repetir a saída não é de graça: o robô não pode explorar isso
    if (!N.fim) {
      var of = ofertas(N, mesa, modo);
      var k = N.vez === quem ? 1 : -1;
      v += k * 0.6 * of;
      if (N.vez === quem) v += 2;
    } else v += (N.fim.vencedor === quem ? 1000 : -1000);
    return { v: v, r: r };
  }

  /* ---------- decisão ---------- */
  function alvoDePosicao(S, modo) { return modo.alvos(S); }

  // valor da jogada sob perturbações do tamanho do erro de execução do nível
  function robustez(S, av, modo, quem, mesa, N) {
    var soma = 0, pior = 1e9, pert = [[-1, 0], [1, 0], [0, -1], [0, 1]], pi, kk;
    for (pi = 0; pi < pert.length; pi++) {
      var ap = {};
      for (kk in av.acao) ap[kk] = av.acao[kk];
      ap.ang += pert[pi][0] * 1.3 * N.sigAng * D2R;
      ap.v0 *= 1 + pert[pi][1] * 1.3 * N.sigPot;
      var vp = avaliarAcao(S, ap, modo, quem, mesa, N).v;
      soma += vp; if (vp < pior) pior = vp;
    }
    av.vr = 0.3 * av.v + 0.3 * soma / pert.length + 0.4 * pior;
    return av;
  }

  function montarAcao(P, cand, vb, b, ang) {
    return { ang: ang === undefined ? cand.f.ang : ang, v0: tacoPara(P, vb), a: 0, b: b || 0, alvo: cand.alvo, cac: cand.chamar ? cand.cac : undefined };
  }

  var prazo = 0;
  function estourou(frac) { return prazo && Date.now() > prazo - (1 - frac) * orcamentoMs; }
  var orcamentoMs = 1500;

  function escolher(S, opc) {
    opc = opc || {};
    orcamentoMs = opc.orcamento || 1500; prazo = Date.now() + orcamentoMs;
    var rng = opc.rng || Math.random, N = nivelDe(opc.nivel), modo = J.modo(S.modo);
    if (S.fase === 'quebra' && modo.acaoQuebra) {
      var aq = modo.acaoQuebra(S, opc.nivel, rng);
      aq.ang += gauss(rng) * N.sigAng * D2R; aq.v0 *= 1 + gauss(rng) * N.sigPot;
      return { acao: aq, v: 0, nivel: N, quebra: true };
    }
    var mesa = J.mesaDe(S.mesa, S.largura), P = mesa.P, R = P.R, quem = S.vez;
    var info = alvoDePosicao(S, modo), ids = info.ids || [];
    var cs = candidatosDiretos(S, mesa, ids, N.maxCorte), tentativas = [], c, j;
    var bs = N.efeito ? [0, 0.35 * R, -0.4 * R] : [0, 0.25 * R];
    for (c = 0; c < cs.length; c++) {
      var pots = potenciasPara(P, cs[c].f, cs[c].f.distAlvo);
      for (j = 0; j < pots.length; j++) {
        for (var bi = 0; bi < (j === 1 ? bs.length : 1); bi++) tentativas.push({ cand: cs[c], vb: pots[j], b: bs[bi] });
      }
    }
    var avals = [], t;
    for (t = 0; t < tentativas.length; t++) {
      if (t > 6 && estourou(0.45)) break;
      var a = montarAcao(P, tentativas[t].cand, tentativas[t].vb, tentativas[t].b);
      var ev = avaliarAcao(S, a, modo, quem, mesa, N);
      avals.push({ acao: a, v: ev.v, cand: tentativas[t].cand, vb: tentativas[t].vb, b: tentativas[t].b });
    }
    avals.sort(function (x, y) { return y.v - x.v; });
    // refinamento: pequenas variações de ângulo e força, acrescentadas ao conjunto de candidatas
    if (N.refinar) {
      var topo = avals.slice(0, N.topo), q;
      for (q = 0; q < topo.length; q++) {
        var tt = topo[q];
        for (var da = -0.6; da <= 0.61; da += 0.3) for (var fp = 0.92; fp <= 1.09; fp += 0.08) {
          if (da === 0 && Math.abs(fp - 1) < 1e-9) continue;
          if (estourou(0.6)) continue;
          var a2 = montarAcao(P, tt.cand, tt.vb * fp, tt.b, tt.acao.ang + da * D2R);
          var e2 = avaliarAcao(S, a2, modo, quem, mesa, N);
          avals.push({ acao: a2, v: e2.v, cand: tt.cand, vb: tt.vb * fp, b: tt.b });
        }
      }
      avals.sort(function (x, y) { return y.v - x.v; });
    }
    // robustez: a jogada é avaliada sob perturbações do tamanho do erro de execução do nível,
    // para que cortes finos e encaçapadas no limite percam para jogadas seguras
    var K = Math.min(avals.length, N.refinar ? 8 : 4), k2;
    for (k2 = 0; k2 < K; k2++) { if (k2 > 1 && estourou(0.85)) { K = k2; break; } robustez(S, avals[k2], modo, quem, mesa, N); }
    for (k2 = K; k2 < avals.length; k2++) avals[k2].vr = -1e9;
    avals.sort(function (x, y) { return y.vr - x.vr; });
    var melhor = avals[0];
    if (melhor) melhor = { acao: melhor.acao, v: melhor.vr, cand: melhor.cand, vb: melhor.vb, b: melhor.b };
    // jogadas de segurança quando não há ataque que valha
    if (!melhor || melhor.v < 1.5) {
      var segs = seguranca(S, modo, mesa, ids, quem, N, rng), sg;
      for (sg = 0; sg < segs.length; sg++) {
        robustez(S, segs[sg], modo, quem, mesa, N);
        if (!melhor || segs[sg].vr > melhor.v) melhor = { acao: segs[sg].acao, v: segs[sg].vr };
      }
    }
    if (!melhor) return { acao: { ang: rng() * 6.2832, v0: 1.5, a: 0, b: 0, alvo: info.padrao }, v: -99, nivel: N };
    // nível fácil: escolhe entre as melhores
    if (!N.refinar && avals.length > 1 && melhor.cand) {
      var pool = avals.slice(0, Math.min(N.topo, avals.length)), pick = pool[Math.floor(rng() * pool.length)];
      if (pick.vr > melhor.v - 4) melhor = { acao: pick.acao, v: pick.vr, cand: pick.cand, vb: pick.vb, b: pick.b };
    }
    var ac = melhor.acao, out = {};
    for (var key in ac) out[key] = ac[key];
    out.ang += gauss(rng) * N.sigAng * D2R;
    out.v0 *= 1 + gauss(rng) * N.sigPot;
    return { acao: out, v: melhor.v, nivel: N, seg: !melhor.cand, cand: melhor.cand, semRuido: ac };
  }

  function seguranca(S, modo, mesa, ids, quem, N, rng) {
    var P = mesa.P, cue = J.bolaPorId(S, 0), lista = [], i, a, e;
    var alvos = ids.slice(0, 8);
    for (i = 0; i < alvos.length; i++) {
      var al = J.bolaPorId(S, alvos[i]);
      if (!al || al.fora) continue;
      if (!J.visivel(S, mesa, cue.x, cue.y, al.id)) continue;
      var base = Math.atan2(al.y - cue.y, al.x - cue.x), d = Math.hypot(al.x - cue.x, al.y - cue.y);
      var offs = [-0.5, -0.25, 0, 0.25, 0.5], sp = [0.6, 1.2, 2.4];
      for (a = 0; a < offs.length; a++) for (e = 0; e < sp.length; e++) {
        if (lista.length > 3 && estourou(0.95)) break;
        var ang = base + Math.asin(Math.min(0.99, 2 * P.R * 0.9 * offs[a] / Math.max(d, 4 * P.R)));
        var ac = { ang: ang, v0: tacoPara(P, sp[e] + d * 0.5), a: 0, b: 0, alvo: al.id };
        var ev = avaliarAcao(S, ac, modo, quem, mesa, N);
        lista.push({ acao: ac, v: ev.v });
      }
    }
    lista.sort(function (x, y) { return y.v - x.v; });
    return lista.slice(0, N.refinar ? 6 : 3);
  }

  // escolhe onde pôr a branca quando está na mão
  function posicionarMao(S, opc) {
    opc = opc || {};
    var modo = J.modo(S.modo), mesa = J.mesaDe(S.mesa, S.largura), R = mesa.P.R, melhor = null, melhorN = -1;
    if (S.fase === 'quebra' && modo.posicaoMao) { var pq = modo.posicaoMao(S); return { x: pq.x + ((opc.rng || Math.random)() - 0.5) * 0.3, y: pq.y }; }
    var rng = opc.rng || Math.random, x, y;
    var passo = 0.09;
    for (x = R; x <= mesa.W - R; x += passo) for (y = R; y <= mesa.L - R; y += passo) {
      if (!modo.maoValida(S, x, y)) continue;
      var T = J.clonar(S); T.mao = null; J.bolaPorId(T, 0).x = x; J.bolaPorId(T, 0).y = y; J.bolaPorId(T, 0).fora = false;
      var n = ofertas(T, mesa, modo) + rng() * 0.4;
      if (n > melhorN) { melhorN = n; melhor = { x: x, y: y }; }
    }
    return melhor || modo.posicaoMao(S);
  }

  // o robô aceita a tacada (jogar) ou a recusa?
  function recusar(S, opc) {
    var modo = J.modo(S.modo), mesa = J.mesaDe(S.mesa, S.largura);
    var r = S.recusa;
    if (!r) return 'jogar';
    if (r.tipo === 'saida') return J.visivelDosDoisLados(S, mesa, J.bolaPorId(S, 0).x, J.bolaPorId(S, 0).y, 1) ? 'jogar' : 'repetir';
    var T = J.clonar(S);
    if (r.tipo === 'quebra') return ofertas(T, mesa, modo) >= 2 ? 'jogar' : 'repetir';
    if (T.mao) { return 'jogar'; }
    return ofertas(T, mesa, modo) >= 1 ? 'jogar' : 'recusar';
  }

  return { NIVEIS: NIVEIS, escolher: escolher, posicionarMao: posicionarMao, recusar: recusar, tacoPara: tacoPara, bolaDoTaco: bolaDoTaco,
    candidatosDiretos: candidatosDiretos, ofertas: ofertas, gauss: gauss };
});
