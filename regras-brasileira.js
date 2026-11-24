/* SinucaON! - Sinuca Brasileira (regulamento da sinuca, bola da vez e numeradas).
 * Bolas 1 a 7 (vermelha 1, amarela 2, verde 3, marrom 4, azul 5, rosa 6, preta 7) em mesa de snooker. */
(function (root, fabrica) {
  if (typeof module === 'object' && module.exports) fabrica(require('./jogo.js'));
  else fabrica(root.Jogo);
})(typeof self !== 'undefined' ? self : this, function (J) {
  'use strict';

  var FALTA = 7;
  var LIMITES = { 5: 46, 6: 27, 7: 7 };
  var NOMES = ['branca', 'vermelha', 'amarela', 'verde', 'marrom', 'azul', 'rosa', 'preta'];

  function mesa(S) { return J.mesaDe(S.mesa, S.largura); }
  function marca(S, id) {
    var mk = mesa(S).marcas, W = mesa(S).W;
    switch (id) {
      case 1: return { x: 0.75 * W, y: mk.rosa.y };
      case 2: return mk.amarela; case 3: return mk.verde; case 4: return mk.marrom;
      case 5: return mk.azul; case 6: return mk.rosa; default: return mk.preta;
    }
  }
  function neutro(S) { var mk = mesa(S).marcas; return { x: mk.xc, y: mk.baulk - mk.rD }; }
  function naMesa(S) { return S.bolas.filter(function (b) { return b.id > 0 && !b.fora; }).map(function (b) { return b.id; }); }
  function daVez(S) { var ids = naMesa(S); return ids.length ? Math.min.apply(null, ids) : 0; }

  // coloca a bola no ponto, na marca livre de maior valor, ou no ponto neutro (art. 7)
  function recolocar(S, ids) {
    var m = mesa(S), R = m.P.R;
    ids.slice().sort(function (a, b) { return b - a; }).forEach(function (id) {
      var b = J.bolaPorId(S, id), alvo = null, k;
      b.fora = false; delete b.cac; b.x = -10; b.y = -10;                // sai do caminho
      if (J.livre(S, marca(S, id).x, marca(S, id).y, R, id)) alvo = marca(S, id);
      else for (k = 7; k >= 1 && !alvo; k--) {
        var mk = marca(S, k);
        if (k !== id && J.livre(S, mk.x, mk.y, R, id)) alvo = mk;
      }
      if (!alvo) { var n = neutro(S); alvo = J.livre(S, n.x, n.y, R, id) ? n : J.pontoLivre(S, m, n.x, n.y, [0, -1], id); }
      b.x = alvo.x; b.y = alvo.y;
    });
  }

  function dentroDoD(S, x, y) {
    var m = mesa(S), mk = m.marcas, R = m.P.R;
    return y <= mk.baulk + 1e-6 && Math.hypot(x - mk.xc, y - mk.baulk) <= mk.rD + 1e-6 && x >= R && x <= m.W - R && y >= R;
  }
  function posicaoMao(S) { var mk = mesa(S).marcas; return { x: mk.xc, y: mk.baulk - mk.rD * 0.5 }; }
  function colocarBranca(S, x, y) { var b = J.bolaPorId(S, 0); b.fora = false; b.x = x; b.y = y; }
  function maoValida(S, x, y) {
    var R = mesa(S).P.R;
    return dentroDoD(S, x, y) && J.livre(S, x, y, R, 0);
  }

  function novaPartida(S, so7) {
    var ids = so7 ? [7] : [1, 2, 3, 4, 5, 6, 7], i, m = mesa(S);
    S.bolas = [{ id: 0, x: m.marcas.xc, y: m.marcas.baulk - m.marcas.rD * 0.5, fora: false }];
    for (i = 0; i < ids.length; i++) { var mk = marca(S, ids[i]); S.bolas.push({ id: ids[i], x: mk.x, y: mk.y, fora: false }); }
    S.fase = so7 ? 'livre' : 'saida'; S.mao = 'D'; S.recusa = null;   // na complementar só há a bola 7: não há saída
    S.vez = S.saiu;
    S.placar = [0, 0];
  }

  function inicial(opt) {
    opt = opt || {};
    var S = { modo: 'brasileira', mesa: 'snooker12', largura: opt.largura || 1, melhorDe: opt.melhorDe || 1, ganhas: [0, 0],
      partida: 1, saiu: opt.quemSai === undefined ? 0 : opt.quemSai, complementar: false, log: [], fim: null, nomes: opt.nomes || ['Você', 'Robô'] };
    novaPartida(S, false);
    return S;
  }

  function perfil(S, id) {
    return { numero: id, cor: ['#f5f5f0', '#c62828', '#f9d71c', '#2e7d32', '#6d4c41', '#1565c0', '#f48fb1', '#111111'][id], listra: false };
  }

  /* alvos que o jogador pode mirar agora */
  function alvos(S) {
    var ids = naMesa(S), dv = daVez(S), fase = S.fase;
    if (fase === 'saida') return { ids: [1], padrao: 1, texto: 'Saída: jogue na bola 1 (vermelha)' };
    if (fase === 'forcaVez') return { ids: [dv], padrao: dv, texto: 'Continue na bola da vez (' + dv + ')' };
    if (fase === 'forcaNumerada') return { ids: ids, padrao: ids.filter(function (i) { return i !== dv; })[0] || dv, texto: 'Jogue uma numerada (sem castigo)' };
    return { ids: ids, padrao: dv, texto: 'Bola da vez: ' + dv + ' (' + NOMES[dv] + ')' };
  }

  function ponto(n) { return n + (n === 1 ? ' ponto' : ' pontos'); }

  function resetarSaida(N) {
    var S2 = { mesa: N.mesa, largura: N.largura, saiu: N.saiu };
    novaPartida(N, N.complementar);
    N.vez = N.saiu;
  }

  function fimDePartida(N, msgs) {
    var v = daVez(N), a = N.placar[0], b = N.placar[1], diff = Math.abs(a - b), lider = a > b ? 0 : 1, fimP = false;
    var tem7 = N.bolas.some(function (x) { return x.id === 7 && !x.fora; });
    if (!tem7) {
      if (a === b) {
        msgs.push('Empate: partida complementar, só com a bola 7.');
        N.complementar = true; N.saiu = 1 - N.saiu; novaPartida(N, true);
        return true;
      }
      fimP = true;
    } else if (LIMITES[v] && diff > LIMITES[v]) fimP = true;
    if (!fimP) return false;
    N.ganhas[lider]++;
    msgs.push((N.nomes[lider]) + ' vence a partida por ' + a + ' a ' + b + '.');
    var meta = Math.ceil(N.melhorDe / 2);
    if (N.ganhas[lider] >= meta) { N.fim = { vencedor: lider, placar: N.ganhas.slice() }; msgs.push((N.nomes[lider]) + ' vence o jogo!'); N.recusa = null; return true; }
    N.partida++; N.complementar = false; N.saiu = 1 - N.saiu; novaPartida(N, false);
    return true;
  }

  function arbitrar(N, acao, rel, S0) {
    var msgs = [], shooter = S0.vez, opp = 1 - shooter, m = mesa(S0), i;
    var dv = daVez(S0), fase = S0.fase;
    var pot = rel.encacapadasObj.map(function (c) { return c.id; });
    var alvo = acao.alvo;
    if (fase === 'saida') alvo = 1;
    else if (fase === 'forcaVez') alvo = dv;
    else if (fase === 'forcaNumerada') alvo = (alvo !== undefined && alvo !== null) ? alvo : rel.primeiro;
    else if (alvo === undefined || alvo === null) alvo = dv;
    var foul = null;
    if (rel.branca) foul = 'a branca caiu na caçapa';
    else if (rel.primeiro === null) foul = 'a branca não tocou em bola nenhuma';
    else if (rel.primeiro !== alvo) foul = 'a primeira bola tocada foi a ' + rel.primeiro + ', e ' + ((fase === 'saida' || fase === 'forcaVez') ? 'a bola a jogar era a ' : 'a visada era a ') + alvo;
    else if (pot.some(function (id) { return id !== alvo; })) foul = pot.length > 1 ? 'duas ou mais bolas encaçapadas' : 'encaçapou a bola ' + pot[0] + ' sem ser a visada';
    else if (acao.cac !== undefined && acao.cac !== null && pot.length && rel.encacapadasObj[0].k !== acao.cac) foul = 'bola encaçapada em caçapa diferente da cantada';
    var numerada = fase === 'forcaNumerada' || (fase === 'livre' && alvo !== dv);
    var castigo = fase === 'livre' && alvo !== dv;
    var alvoCaiu = !foul && pot.length === 1 && pot[0] === alvo;
    if (!foul && castigo && !alvoCaiu) foul = 'numerada com castigo não encaçapada';

    if (fase === 'saida') {
      var cueSai = J.bolaPorId(N, 0), b1 = J.bolaPorId(N, 1);
      if (foul || (pot.indexOf(1) >= 0)) {
        msgs.push(pot.indexOf(1) >= 0 && !foul ? 'A bola 1 foi encaçapada na saída: a saída se repete.' : 'Falta na saída (' + foul + '): a saída se repete.');
        resetarSaida(N); N.log = msgs; return { msgs: msgs, foul: true, repetir: true };
      }
      var fina = J.visivelDosDoisLados(N, m, cueSai.x, cueSai.y, 1);
      if (!fina) {
        msgs.push('A branca ficou sem poder tirar fino dos dois lados da bola 1. ' + N.nomes[opp] + ' pode jogar ou mandar repetir a saída.');
        N.recusa = { tipo: 'saida', quem: opp }; N.vez = opp; N.fase = 'livre'; return { msgs: msgs, foul: false };
      }
      msgs.push('Saída válida.');
      N.vez = opp; N.fase = 'livre'; N.recusa = null; return { msgs: msgs, foul: false };
    }

    var devolver = [];
    if (foul) {
      N.placar[opp] += FALTA;
      msgs.push('Falta: ' + foul + '. ' + N.nomes[opp] + ' recebe ' + ponto(FALTA) + '.');
      pot.forEach(function (id) { devolver.push(id); });
      N.vez = opp; N.fase = 'livre';
      if (rel.branca) { var pm = posicaoMao(N); colocarBranca(N, pm.x, pm.y); N.mao = 'D'; }
      else if (S0.mao) N.mao = S0.mao;
      N.recusa = { tipo: 'falta', quem: opp };
    } else if (alvoCaiu) {
      if (fase === 'forcaNumerada' || numerada) {
        devolver.push(alvo);
        msgs.push('Numerada ' + alvo + ' encaçapada: volta para a marca.');
        N.fase = fase === 'forcaNumerada' ? 'livre' : 'forcaVez';
        N.vez = shooter; N.recusa = null;
      } else {
        N.placar[shooter] += alvo;
        msgs.push(N.nomes[shooter] + ' encaçapa a bola ' + alvo + ' e faz ' + ponto(alvo) + '.');
        N.vez = shooter; N.recusa = null;
        N.fase = naMesa(N).length > 1 ? 'forcaNumerada' : 'livre';
      }
    } else {
      N.vez = opp; N.fase = 'livre'; N.recusa = null;
      msgs.push(N.nomes[shooter] + ' não encaçapou.');
      if (fase === 'forcaNumerada') N.recusa = { tipo: 'numerada', quem: opp };
    }
    if (devolver.length) recolocar(N, devolver);
    var terminou = fimDePartida(N, msgs);
    N.log = msgs;
    return { msgs: msgs, foul: !!foul, fimPartida: terminou };
  }

  /* decisão do oponente depois de falta, numerada errada ou saída sem fino */
  function decidir(S, escolha) {
    var N = J.clonar(S), r = S.recusa, msgs = [];
    if (!r) return N;
    if (r.tipo === 'saida') {
      if (escolha === 'repetir') { resetarSaida(N); N.vez = N.saiu; msgs.push('A saída será repetida.'); }
      else msgs.push(N.nomes[N.vez] + ' joga a partir daí.');
    } else if (escolha === 'recusar') { N.vez = 1 - N.vez; msgs.push(N.nomes[S.vez] + ' recusa a tacada.'); }
    else msgs.push(N.nomes[S.vez] + ' aceita a tacada.');
    N.recusa = null; N.log = msgs;
    return N;
  }

  function resumo(S) {
    var dv = daVez(S);
    return { dv: dv, restantes: naMesa(S), diff: S.placar[0] - S.placar[1], limite: LIMITES[dv] || null };
  }

  J.registrar({ id: 'brasileira', nome: 'Sinuca Brasileira', mesa: 'snooker12', inicial: inicial, arbitrar: arbitrar, decidir: decidir,
    alvos: alvos, perfil: perfil, maoValida: maoValida, posicaoMao: posicaoMao, resumo: resumo, daVez: daVez, FALTA: FALTA, NOMES: NOMES,
    zonaMao: function (S) { return 'D'; } });
});
