/* SinucaON! - Snooker (regras da WPBSA, em mesa de 12 pés).
 * Bolas: 0 branca, 1 a 15 vermelhas, 16 amarela (2), 17 verde (3), 18 marrom (4), 19 azul (5), 20 rosa (6), 21 preta (7).
 * Não implementado: regra do "miss" (repetir a jogada quando a falta não foi o melhor possível). Bola livre só com cor. */
(function (root, fabrica) {
  if (typeof module === 'object' && module.exports) fabrica(require('./jogo.js'));
  else fabrica(root.Jogo);
})(typeof self !== 'undefined' ? self : this, function (J) {
  'use strict';

  var NOMES = { 1: 'vermelha', 16: 'amarela', 17: 'verde', 18: 'marrom', 19: 'azul', 20: 'rosa', 21: 'preta' };
  var CORES = { 16: '#f9d71c', 17: '#2e7d32', 18: '#6d4c41', 19: '#1565c0', 20: '#f48fb1', 21: '#111111' };
  var FOLGA = 1e-4;

  function mesa(S) { return J.mesaDe(S.mesa, S.largura); }
  function valor(id) { return id >= 16 ? id - 14 : 1; }
  function nomeBola(id) { return id >= 16 ? NOMES[id] : NOMES[1]; }
  function ehCor(id) { return id >= 16; }
  function naMesa(S) { return S.bolas.filter(function (b) { return b.id > 0 && !b.fora; }).map(function (b) { return b.id; }); }
  function vermelhas(S) { return naMesa(S).filter(function (i) { return i < 16; }); }
  function cores(S) { return naMesa(S).filter(ehCor); }
  function menorCor(S) { var c = cores(S); return c.length ? Math.min.apply(null, c) : 0; }
  function perfil(S, id) { return { numero: 0, cor: id < 16 ? '#c62828' : CORES[id], listra: false, sem: true }; }

  function marca(S, id) {
    var mk = mesa(S).marcas;
    switch (id) { case 16: return mk.amarela; case 17: return mk.verde; case 18: return mk.marrom; case 19: return mk.azul; case 20: return mk.rosa; default: return mk.preta; }
  }

  function montar(S) {
    var m = mesa(S), R = m.P.R, mk = m.marcas, d = 2 * R + FOLGA, dy = Math.sqrt(3) / 2 * d, id = 1, r, k, out = [];
    out.push({ id: 0, x: mk.xc, y: mk.baulk - mk.rD * 0.5, fora: false });
    for (r = 0; r < 5; r++) for (k = 0; k <= r; k++) out.push({ id: id++, x: m.W / 2 + (k - r / 2) * d, y: mk.rosa.y + 2 * R + FOLGA + r * dy, fora: false });
    for (id = 16; id <= 21; id++) { var p = marca(S, id); out.push({ id: id, x: p.x, y: p.y, fora: false }); }
    return out;
  }

  function novoQuadro(S) {
    S.bolas = montar(S); S.fase = 'vermelha'; S.mao = 'D'; S.recusa = null; S.bolaLivre = false;
    S.placar = [0, 0]; S.vez = S.quebra; S.maior = [0, 0]; S.serie = 0;
  }

  function inicial(opt) {
    opt = opt || {};
    var S = { modo: 'snooker', mesa: 'snooker12', largura: opt.largura || 1, melhorDe: opt.melhorDe || 1, ganhas: [0, 0], partida: 1,
      quebra: opt.quemSai === undefined ? 0 : opt.quemSai, semente: opt.semente === undefined ? Math.floor(Math.random() * 4e9) : opt.semente,
      log: [], fim: null, nomes: opt.nomes || ['Você', 'Robô'] };
    novoQuadro(S);
    return S;
  }

  /* ---------- mão (semicírculo) e reposição ---------- */
  function dentroDoD(S, x, y) {
    var m = mesa(S), mk = m.marcas, R = m.P.R;
    return y <= mk.baulk + 1e-6 && Math.hypot(x - mk.xc, y - mk.baulk) <= mk.rD + 1e-6 && x >= R && x <= m.W - R && y >= R;
  }
  function maoValida(S, x, y) { return dentroDoD(S, x, y) && J.livre(S, x, y, mesa(S).P.R, 0); }
  function posicaoMao(S) { var mk = mesa(S).marcas; return { x: mk.xc, y: mk.baulk - mk.rD * 0.5 }; }
  function colocarBranca(N, x, y) { var b = J.bolaPorId(N, 0); b.fora = false; delete b.cac; b.x = x; b.y = y; }

  // devolve uma cor à sua marca; se ocupada, à marca livre de maior valor; senão, o mais perto possível, rumo à tabela do fundo
  function recolocar(N, id) {
    var m = mesa(N), R = m.P.R, b = J.bolaPorId(N, id), alvo = null, k;
    b.fora = false; delete b.cac; b.x = -10; b.y = -10;
    var mp = marca(N, id);
    if (J.livre(N, mp.x, mp.y, R, id)) alvo = mp;
    else for (k = 21; k >= 16 && !alvo; k--) { var q = marca(N, k); if (k !== id && J.livre(N, q.x, q.y, R, id)) alvo = q; }
    if (!alvo) {
      var y = mp.y, x = mp.x;
      for (k = 0; k < 80 && !J.livre(N, x, y, R, id); k++) { y += R * 0.5; if (y > m.L - R) { y = mp.y; x += R; } }
      alvo = { x: x, y: y };
    }
    b.x = alvo.x; b.y = alvo.y;
  }

  /* ---------- alvos ---------- */
  function alvos(S) {
    var reds = vermelhas(S), cs = cores(S), fase = S.fase;
    if (fase === 'decisiva') return { ids: [21], padrao: 21, texto: 'Bola preta decisiva: encaçape a preta; falta perde o quadro' };
    if (fase === 'cor') return { ids: cs, padrao: cs[cs.length - 1], texto: 'Escolha uma cor (anuncie tocando nela)' };
    if (fase === 'sequencia') {
      var mc = menorCor(S);
      var ids = [mc];
      if (S.bolaLivre) ids = ids.concat(cs.filter(function (i) { return i !== mc; }));
      return { ids: ids, padrao: mc, texto: 'Sequência: bola ' + nomeBola(mc) + ' (' + valor(mc) + ')' + (S.bolaLivre ? ' ou bola livre' : '') };
    }
    var ids2 = reds.slice();
    if (S.bolaLivre) ids2 = ids2.concat(cs);
    return { ids: ids2, padrao: reds[0], texto: 'Jogue numa vermelha' + (S.bolaLivre ? ' ou use a bola livre (qualquer cor)' : '') };
  }

  /* ---------- árbitro ---------- */
  function proximaFase(N) { return vermelhas(N).length ? 'vermelha' : 'sequencia'; }

  function pontosRestantes(S) {
    var r = vermelhas(S).length, cs = cores(S), soma = 0;
    if (S.fase === 'cor') soma += 7;
    if (r) { soma += r * 8; soma += cs.reduce(function (a, i) { return a + valor(i); }, 0); }
    else soma += cs.reduce(function (a, i) { return a + valor(i); }, 0);
    return soma;
  }

  function fimQuadro(N, venceu, msgs) {
    N.ganhas[venceu]++;
    msgs.push(N.nomes[venceu] + ' vence o quadro por ' + N.placar[venceu] + ' a ' + N.placar[1 - venceu] + '.');
    var meta = Math.ceil(N.melhorDe / 2);
    if (N.ganhas[venceu] >= meta) { N.fim = { vencedor: venceu, placar: N.ganhas.slice() }; msgs.push(N.nomes[venceu] + ' vence a partida!'); N.recusa = null; return; }
    N.partida++; N.quebra = 1 - N.quebra; novoQuadro(N);
  }

  function fimDaSequencia(N, msgs) {
    var a = N.placar[0], b = N.placar[1];
    if (a !== b) { fimQuadro(N, a > b ? 0 : 1, msgs); return; }
    msgs.push('Empate no quadro: a bola preta volta à marca e quem a encaçapar vence.');
    recolocar(N, 21);
    var cb = J.bolaPorId(N, 0), p = posicaoMao(N); colocarBranca(N, p.x, p.y);
    N.fase = 'decisiva'; N.mao = 'D'; N.recusa = null; N.bolaLivre = false;
    N.vez = (((N.semente + N.partida * 31) >>> 0) % 2);
    msgs.push(N.nomes[N.vez] + ' joga primeiro (sorteio).');
  }

  function arbitrar(N, acao, rel, S0) {
    var msgs = [], sh = S0.vez, op = 1 - sh, fase = S0.fase, pot = rel.encacapadasObj.map(function (c) { return c.id; });
    var potV = pot.filter(function (i) { return i < 16; }), potC = pot.filter(ehCor), prim = rel.primeiro, i;
    var res = { propias: 0 }, foul = null, vf = 4;
    var reds0 = vermelhas(S0), mc = menorCor(S0);
    var nom = (acao.alvo !== undefined && acao.alvo !== null && ehCor(acao.alvo)) ? acao.alvo : null;
    var livreAtivo = false, aNaoLivre = null;

    // bola na mesa em cada fase: a "bola da vez"
    var emJogo;   // lista de ids permitidos como primeiro contato sem ser bola livre
    if (fase === 'decisiva') emJogo = [21];
    else if (fase === 'sequencia') emJogo = [mc];
    else if (fase === 'cor') emJogo = cores(S0);
    else emJogo = reds0;

    if (S0.bolaLivre && fase !== 'cor' && fase !== 'decisiva' && nom !== null && emJogo.indexOf(nom) < 0 && prim === nom) livreAtivo = true;
    if (fase === 'cor' && nom === null && prim !== null && ehCor(prim)) nom = prim;

    function sobe(id) { if (id !== null && id !== undefined && ehCor(id)) vf = Math.max(vf, valor(id)); }
    if (fase === 'cor' && nom) vf = Math.max(vf, valor(nom));
    if (fase === 'sequencia' || fase === 'decisiva') vf = Math.max(vf, valor(emJogo[0]));
    potC.forEach(sobe); sobe(prim);

    if (rel.branca) foul = 'a branca caiu na caçapa';
    else if (prim === null) foul = 'a branca não tocou em bola nenhuma';
    else if (!livreAtivo && emJogo.indexOf(prim) < 0) foul = 'a primeira bola tocada foi a ' + nomeBola(prim) + ', e a da vez era ' + (fase === 'cor' ? 'uma cor' : (fase === 'vermelha' ? 'uma vermelha' : 'a ' + nomeBola(emJogo[0])));
    else if (fase === 'cor' && nom !== null && prim !== nom) foul = 'tocou numa cor diferente da anunciada';
    if (!foul) {
      if (livreAtivo) {
        if (potV.length || potC.some(function (c) { return c !== nom; })) foul = 'encaçapou bola que não era a livre';
      } else if (fase === 'vermelha') { if (potC.length) foul = 'encaçapou uma cor antes de uma vermelha'; }
      else if (fase === 'cor') { if (potV.length) foul = 'encaçapou uma vermelha na vez da cor'; else if (potC.length > 1 || (potC.length === 1 && potC[0] !== nom)) foul = 'encaçapou cor diferente da anunciada'; }
      else if (fase === 'sequencia') { if (potV.length || potC.some(function (c) { return c !== mc; })) foul = 'encaçapou bola fora da sequência'; }
      else if (fase === 'decisiva') { if (potC.some(function (c) { return c !== 21; })) foul = 'encaçapou bola errada'; }
    }

    // cores encaçapadas voltam à marca (todas, fora da sequência final; em falta, sempre)
    function devolverCores() {
      potC.slice().sort(function (a, b) { return b - a; }).forEach(function (id) {
        if (foul || fase !== 'sequencia' || livreAtivo || id !== mc) recolocar(N, id);
      });
    }

    N.bolaLivre = false;
    var ultimaPreta = (fase === 'sequencia' && mc === 21) || fase === 'decisiva';

    if (foul) {
      if (fase === 'decisiva') {
        msgs.push('Falta na bola preta decisiva (' + foul + '). ' + N.nomes[op] + ' vence o quadro.');
        res.foul = true; res.fimQuadro = op; fimQuadro(N, op, msgs); N.log = msgs; return res;
      }
      N.placar[op] += vf;
      msgs.push('Falta de ' + vf + ': ' + foul + '. ' + N.nomes[op] + ' recebe ' + vf + ' pontos.');
      devolverCores();
      res.foul = true; res.valorFalta = vf;
      if (ultimaPreta && (potC.indexOf(21) >= 0)) { recolocar(N, 21); }
      N.vez = op; N.recusa = { tipo: 'falta', quem: op }; N.mao = null; N.serie = 0;
      if (rel.branca) { var pm = posicaoMao(N); colocarBranca(N, pm.x, pm.y); N.mao = 'D'; }
      N.fase = proximaFase(N);
      if (!cores(N).length && !vermelhas(N).length) { fimDaSequencia(N, msgs); N.log = msgs; return res; }
      // bola livre: quando a branca está snookerada em tudo o que estava "na mesa"
      if (!rel.branca && (N.fase === 'vermelha' || N.fase === 'sequencia')) {
        var on = alvos(N).ids, cue = J.bolaPorId(N, 0), mesaN = mesa(N);
        var algum = on.some(function (id) { return J.visivel(N, mesaN, cue.x, cue.y, id); });
        if (!algum) { N.bolaLivre = true; msgs.push('A branca está snookerada: ' + N.nomes[op] + ' pode usar uma bola livre.'); }
      }
      N.log = msgs; return res;
    }

    // jogada legal
    var pts = 0;
    if (livreAtivo) {
      if (potC.length) {
        pts = fase === 'sequencia' ? valor(mc) : 1;
        msgs.push(N.nomes[sh] + ' encaçapa a bola livre (' + nomeBola(nom) + ') e faz ' + pts + (pts === 1 ? ' ponto' : ' pontos') + '.');
        recolocar(N, nom);
        N.placar[sh] += pts; N.serie += pts; res.propias = 1; N.vez = sh;
        N.fase = fase === 'vermelha' ? 'cor' : 'sequencia';
      } else { msgs.push(N.nomes[sh] + ' tocou a bola livre e não encaçapou.'); N.vez = op; N.fase = proximaFase(N); N.serie = 0; }
    } else if (fase === 'vermelha') {
      if (potV.length) {
        pts = potV.length; N.placar[sh] += pts; N.serie += pts; res.propias = potV.length;
        msgs.push(N.nomes[sh] + ' encaçapa ' + (pts === 1 ? 'uma vermelha' : pts + ' vermelhas') + ' e faz ' + pts + (pts === 1 ? ' ponto' : ' pontos') + '. Agora, uma cor.');
        N.vez = sh; N.fase = 'cor';
      } else { msgs.push(N.nomes[sh] + ' não encaçapou.'); N.vez = op; N.serie = 0; }
    } else if (fase === 'cor') {
      if (potC.length) {
        pts = valor(potC[0]); N.placar[sh] += pts; N.serie += pts; res.propias = 1;
        msgs.push(N.nomes[sh] + ' encaçapa a ' + nomeBola(potC[0]) + ' e faz ' + pts + ' pontos.');
        recolocar(N, potC[0]); N.vez = sh; N.fase = proximaFase(N);
      } else { msgs.push(N.nomes[sh] + ' não encaçapou a cor.'); N.vez = op; N.serie = 0; N.fase = proximaFase(N); }
    } else if (fase === 'sequencia') {
      if (potC.length) {
        pts = valor(mc); N.placar[sh] += pts; N.serie += pts; res.propias = 1;
        msgs.push(N.nomes[sh] + ' encaçapa a ' + nomeBola(mc) + ' e faz ' + pts + ' pontos.');
        N.vez = sh;
        if (mc === 21) { fimDaSequencia(N, msgs); N.log = msgs; return res; }
      } else { msgs.push(N.nomes[sh] + ' não encaçapou.'); N.vez = op; N.serie = 0; }
    } else if (fase === 'decisiva') {
      if (potC.indexOf(21) >= 0) { msgs.push(N.nomes[sh] + ' encaçapa a preta e vence o quadro.'); res.fimQuadro = sh; N.placar[sh] += 7; fimQuadro(N, sh, msgs); N.log = msgs; return res; }
      msgs.push(N.nomes[sh] + ' não encaçapou.'); N.vez = op;
    }
    N.maior[sh] = Math.max(N.maior[sh], N.serie);
    N.recusa = null; N.mao = null;
    N.log = msgs; return res;
  }

  function decidir(S, escolha) {
    var N = J.clonar(S), msgs = [];
    if (!S.recusa) return N;
    if (escolha === 'recusar') { N.vez = 1 - N.vez; msgs.push(N.nomes[S.vez] + ' manda ' + N.nomes[N.vez] + ' jogar de novo da posição atual.'); if (N.mao) N.mao = N.mao; }
    else msgs.push(N.nomes[S.vez] + ' aceita a tacada.');
    N.recusa = null; N.log = msgs;
    return N;
  }

  // desistir do quadro (quando faltam menos pontos do que a diferença)
  function desistir(S, quem) {
    var N = J.clonar(S), msgs = [N.nomes[quem] + ' desiste do quadro.'];
    fimQuadro(N, 1 - quem, msgs); N.log = msgs; return N;
  }

  function resumo(S) {
    var diff = S.placar[0] - S.placar[1], rest = pontosRestantes(S);
    return { fase: S.fase, placar: S.placar, vermelhas: vermelhas(S).length, cores: cores(S), menorCor: menorCor(S), maior: S.maior, serie: S.serie,
      restantes: rest, matematicamenteFora: Math.abs(diff) > rest && S.fase !== 'decisiva', bolaLivre: !!S.bolaLivre };
  }

  function valorBot(S0, r, quem) {
    var N = r.S;
    if (N.fim) return N.fim.vencedor === quem ? 80 : -80;
    if (N.partida !== S0.partida) return N.ganhas[quem] > S0.ganhas[quem] ? 60 : -60;
    return (N.placar[quem] - S0.placar[quem]) - (N.placar[1 - quem] - S0.placar[1 - quem]);
  }

  J.registrar({ id: 'snooker', nome: 'Snooker', mesa: 'snooker12', inicial: inicial, arbitrar: arbitrar, decidir: decidir, alvos: alvos, perfil: perfil,
    maoValida: maoValida, posicaoMao: posicaoMao, resumo: resumo, desistir: desistir, valor: valorBot, chamar: function () { return false; },
    valorDaBola: valor, zonaMao: function () { return 'D'; } });
});
