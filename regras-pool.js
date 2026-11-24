/* SinucaON! - Bola 8 e Bola 9 (regras da WPA, simplificadas onde indicado) na mesa de pool de 9 pés.
 * Os dois modos dividem a montagem do triângulo, a checagem de quebra e a lógica da bola na mão. */
(function (root, fabrica) {
  if (typeof module === 'object' && module.exports) fabrica(require('./jogo.js'));
  else fabrica(root.Jogo);
})(typeof self !== 'undefined' ? self : this, function (J) {
  'use strict';

  var COR = ['#f5f5f0', '#f9d71c', '#1e50a2', '#d32f2f', '#6a1b9a', '#f57c00', '#2e7d32', '#7b1f1f', '#111111'];
  var FOLGA = 1e-4;   // folga entre bolas do triângulo, evita contato no instante zero

  function mesa(S) { return J.mesaDe(S.mesa, S.largura); }
  function naMesa(S) { return S.bolas.filter(function (b) { return b.id > 0 && !b.fora; }).map(function (b) { return b.id; }); }
  function grupoDe(id) { return id === 8 ? -1 : (id < 8 ? 0 : 1); }   // 0 lisas (1 a 7), 1 listradas (9 a 15)
  function perfil(S, id) { return { numero: id, cor: COR[id <= 8 ? id : id - 8], listra: id > 8 }; }

  /* gerador simples e reproduzível: a mesma semente monta o mesmo triângulo */
  function lcg(seed) { var s = seed >>> 0; return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
  function embaralhar(arr, rnd) { for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }

  // posições do triângulo (8) ou do losango (9), com o vértice voltado para a cabeça da mesa
  function posicoesTriangulo(S, linhas) {
    var m = mesa(S), R = m.P.R, pe = m.marcas.pe, W = m.W, out = [], r, k, d = 2 * R + FOLGA, dy = Math.sqrt(3) / 2 * d;
    for (r = 0; r < linhas.length; r++) for (k = 0; k < linhas[r]; k++) out.push({ x: W / 2 + (k - (linhas[r] - 1) / 2) * d, y: pe + r * dy });
    return out;
  }

  function montar8(S, rnd) {
    var pos = posicoesTriangulo(S, [1, 2, 3, 4, 5]), ids = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15], ok = false, a, t = 0;
    while (!ok && t++ < 50) {
      a = embaralhar(ids.slice(), rnd);          // 14 bolas para as posições, menos o centro (8)
      // posições 0..14 sem o índice 4 (centro da terceira fileira, onde fica a 8)
      var cant1 = a[9], cant2 = a[13];           // cantos da última fileira: índices 10 e 14
      ok = grupoDe(cant1) !== grupoDe(cant2);
    }
    var ordem = [], j = 0, i;
    for (i = 0; i < 15; i++) ordem.push(i === 4 ? 8 : a[j++]);
    return ordem.map(function (id, n) { return { id: id, x: pos[n].x, y: pos[n].y, fora: false }; });
  }

  function montar9(S, rnd) {
    var pos = posicoesTriangulo(S, [1, 2, 3, 2, 1]), resto = embaralhar([2, 3, 4, 5, 6, 7, 8], rnd), ordem = [], j = 0, i;
    for (i = 0; i < 9; i++) ordem.push(i === 0 ? 1 : (i === 4 ? 9 : resto[j++]));
    return ordem.map(function (id, n) { return { id: id, x: pos[n].x, y: pos[n].y, fora: false }; });
  }

  function novoQuadro(S) {
    var m = mesa(S), rnd = lcg(S.semente + S.partida * 7919 + (S.tentativa || 0) * 104729);
    S.bolas = [{ id: 0, x: m.W / 2, y: m.marcas.cabeca * 0.8, fora: false }].concat(S.modo === 'bola8' ? montar8(S, rnd) : montar9(S, rnd));
    S.fase = 'quebra'; S.mao = 'cabeca'; S.recusa = null; S.grupos = [null, null]; S.vez = S.quebra;
    S.faltasSeguidas = [0, 0]; S.empurrarOk = false;
  }

  function inicial(id) {
    return function (opt) {
      opt = opt || {};
      var S = { modo: id, mesa: 'pool9', largura: opt.largura || 1, melhorDe: opt.melhorDe || 1, ganhas: [0, 0], partida: 1,
        quebra: opt.quemSai === undefined ? 0 : opt.quemSai, semente: opt.semente === undefined ? Math.floor(Math.random() * 4e9) : opt.semente,
        tentativa: 0, log: [], fim: null, nomes: opt.nomes || ['Você', 'Robô'] };
      novoQuadro(S);
      return S;
    };
  }

  /* ---------- bola na mão e reposição ---------- */
  function dentro(S, x, y) { var m = mesa(S), R = m.P.R; return x >= R && x <= m.W - R && y >= R && y <= m.L - R; }
  function maoValida(S, x, y) {
    var m = mesa(S), R = m.P.R;
    if (!dentro(S, x, y)) return false;
    if (S.mao === 'cabeca' && y > m.marcas.cabeca) return false;
    return J.livre(S, x, y, R, 0);
  }
  function posicaoMao(S) {
    var m = mesa(S);
    if (S.fase === 'quebra') return { x: m.W / 2, y: m.marcas.cabeca * 0.8 };
    return { x: m.W / 2, y: m.marcas.cabeca };
  }

  function colocarBranca(N, x, y) { var b = J.bolaPorId(N, 0); b.fora = false; delete b.cac; b.x = x; b.y = y; }

  // devolve uma bola à marca do pé; se ocupada, procura o ponto livre mais próximo, no sentido do fundo
  function recolocarNoPe(N, id) {
    var m = mesa(N), R = m.P.R, b = J.bolaPorId(N, id), x = m.W / 2, y = m.marcas.pe, k;
    b.fora = false; delete b.cac; b.x = -10; b.y = -10;
    for (k = 0; k < 40; k++) {
      if (J.livre(N, x, y, R, id)) break;
      y += R * 0.5;
      if (y > m.L - R) { y = m.marcas.pe; x += R; }
    }
    b.x = x; b.y = y;
  }

  /* ---------- fim de quadro ---------- */
  function fimQuadro(N, venceu, msgs) {
    N.ganhas[venceu]++;
    msgs.push(N.nomes[venceu] + ' vence o quadro.');
    var meta = Math.ceil(N.melhorDe / 2);
    if (N.ganhas[venceu] >= meta) { N.fim = { vencedor: venceu, placar: N.ganhas.slice() }; msgs.push(N.nomes[venceu] + ' vence o jogo!'); N.recusa = null; return true; }
    N.partida++; N.tentativa = 0; N.quebra = 1 - N.quebra; novoQuadro(N);
    return true;
  }

  function qtdTabelaDepois(rel) { return Object.keys(rel.tabelaDepois).length; }

  function bolasDoGrupo(S, g) {
    return naMesa(S).filter(function (id) { return grupoDe(id) === g; });
  }

  /* ---------- Bola 8 ---------- */
  function alvos8(S) {
    var ids = naMesa(S), v = S.vez;
    if (S.fase === 'quebra') return { ids: ids.filter(function (i) { return i !== 8; }), padrao: 1, texto: 'Quebra: acerte o triângulo' };
    var g = S.grupos[v];
    if (g === null) return { ids: ids.filter(function (i) { return i !== 8; }), padrao: ids.filter(function (i) { return i !== 8; })[0] || 8, texto: 'Mesa aberta: jogue em qualquer lisa ou listrada' };
    var meus = bolasDoGrupo(S, g);
    if (!meus.length) return { ids: [8], padrao: 8, texto: 'Jogue na bola 8 e cante a caçapa' };
    return { ids: meus, padrao: meus[0], texto: (g === 0 ? 'Suas bolas: lisas (1 a 7)' : 'Suas bolas: listradas (9 a 15)') };
  }

  function arbitrar8(N, acao, rel, S0) {
    var msgs = [], sh = S0.vez, op = 1 - sh, pot = rel.encacapadasObj.map(function (c) { return c.id; }), scratch = rel.branca;
    var info = alvos8(S0), alvosOk = info.ids, foul = null, res = { propias: 0 };
    var tem8 = pot.indexOf(8) >= 0, fase = S0.fase;
    var cacChamada = acao.cac !== undefined && acao.cac !== null;

    function passaDireita(mao) {
      N.vez = op; N.recusa = null; N.mao = mao;
      if (scratch) colocarBranca(N, mesa(N).W / 2, mao === 'cabeca' ? mesa(N).marcas.cabeca * 0.8 : mesa(N).marcas.cabeca);
    }

    if (fase === 'quebra') {
      if (tem8) {
        recolocarNoPe(N, 8);
        msgs.push('A bola 8 caiu na quebra: volta para a marca do pé.');
        pot = pot.filter(function (i) { return i !== 8; });
      }
      var legal = pot.length > 0 || rel.bolasNaTabela >= 4;
      if (scratch) {
        foul = 'a branca caiu na quebra';
        msgs.push('Falta: ' + foul + '. ' + N.nomes[op] + ' joga com a bola na mão atrás da linha da cabeça.');
        N.fase = 'aberta'; passaDireita('cabeca'); res.foul = true;
      } else if (!legal) {
        msgs.push('Quebra ilegal (menos de 4 bolas na tabela e nenhuma encaçapada). ' + N.nomes[op] + ' pode jogar ou mandar quebrar de novo.');
        N.fase = 'aberta'; N.vez = op; N.recusa = { tipo: 'quebra', quem: op };
      } else {
        msgs.push(pot.length ? N.nomes[sh] + ' encaçapa na quebra e continua. A mesa está aberta.' : 'Quebra válida. A mesa está aberta.');
        N.fase = 'aberta'; N.vez = pot.length ? sh : op; N.recusa = null;
      }
      res.propias = pot.length;
      N.log = msgs; return res;
    }

    var g = S0.grupos[sh];
    var meusAntes = g === null ? null : bolasDoGrupo(S0, g);
    var noOito = g !== null && meusAntes.length === 0;
    var primeiro = rel.primeiro;
    if (scratch) foul = 'a branca caiu na caçapa';
    else if (primeiro === null) foul = 'a branca não tocou em bola nenhuma';
    else if (alvosOk.indexOf(primeiro) < 0) foul = primeiro === 8 && !noOito ? 'a primeira bola tocada foi a 8' : 'a primeira bola tocada não era sua';
    else if (!pot.length && !qtdTabelaDepois(rel)) foul = 'nenhuma bola tocou a tabela depois do contato';

    if (tem8) {
      var perdeu = foul || !noOito || (cacChamada && rel.encacapadasObj.filter(function (c) { return c.id === 8; })[0].k !== acao.cac);
      if (perdeu) {
        var motivo = !noOito ? 'encaçapou a 8 antes de limpar suas bolas' : (foul ? foul : 'a 8 caiu em outra caçapa, não na cantada');
        msgs.push(N.nomes[sh] + ' perde o quadro: ' + motivo + '.');
        res.fimQuadro = op; fimQuadro(N, op, msgs); N.log = msgs; return res;
      }
      msgs.push(N.nomes[sh] + ' encaçapa a bola 8 e vence o quadro.');
      res.fimQuadro = sh; fimQuadro(N, sh, msgs); N.log = msgs; return res;
    }

    // atribui o grupo quando a mesa está aberta e a jogada é limpa
    var ganhouGrupo = false;
    if (!foul && g === null && pot.length) {
      var gs = {}; pot.forEach(function (id) { gs[grupoDe(id)] = true; });
      var ks = Object.keys(gs);
      if (ks.length === 1) {
        var gg = +ks[0]; N.grupos[sh] = gg; N.grupos[op] = 1 - gg; ganhouGrupo = true;
        msgs.push(N.nomes[sh] + ' fica com as ' + (gg === 0 ? 'lisas (1 a 7)' : 'listradas (9 a 15)') + '.');
      }
    }
    var gAtual = N.grupos[sh];
    var propias = pot.filter(function (id) { return gAtual === null ? true : grupoDe(id) === gAtual; });
    res.propias = propias.length;
    if (foul) {
      msgs.push('Falta: ' + foul + '. ' + N.nomes[op] + ' joga com a bola na mão.');
      res.foul = true; passaDireita('livre');
    } else if (propias.length) {
      msgs.push(N.nomes[sh] + ' encaçapa ' + (propias.length === 1 ? 'a bola ' + propias[0] : 'as bolas ' + propias.join(', ')) + ' e continua.');
      N.vez = sh; N.recusa = null; N.mao = null;
    } else {
      msgs.push(N.nomes[sh] + ' não encaçapou' + (pot.length ? ' bola sua' : '') + '.');
      N.vez = op; N.recusa = null; N.mao = null;
    }
    if (N.fase === 'quebra') N.fase = 'aberta';
    N.fase = N.grupos[0] === null ? 'aberta' : 'grupos';
    N.log = msgs; return res;
  }

  /* ---------- Bola 9 ---------- */
  function alvos9(S) {
    var ids = naMesa(S), baixa = ids.length ? Math.min.apply(null, ids) : 9;
    if (S.fase === 'quebra') return { ids: [1], padrao: 1, texto: 'Quebra: acerte a bola 1' };
    return { ids: [baixa], padrao: baixa, texto: 'Bola mais baixa: ' + baixa + (S.empurrarOk ? ' (empurrada permitida)' : '') };
  }

  function arbitrar9(N, acao, rel, S0) {
    var msgs = [], sh = S0.vez, op = 1 - sh, pot = rel.encacapadasObj.map(function (c) { return c.id; }), scratch = rel.branca;
    var ids = naMesa(S0), baixa = Math.min.apply(null, ids), fase = S0.fase, res = { propias: 0 };
    var tem9 = pot.indexOf(9) >= 0, foul = null;
    N.empurrarOk = false;

    function darMao(onde) {
      N.vez = op; N.mao = onde; N.recusa = null;
      if (scratch) colocarBranca(N, mesa(N).W / 2, mesa(N).marcas.cabeca);
    }

    if (fase === 'quebra') {
      var legal = pot.length > 0 || rel.bolasNaTabela >= 4;
      if (scratch) {
        if (tem9) { recolocarNoPe(N, 9); pot = pot.filter(function (i) { return i !== 9; }); }
        msgs.push('Falta na quebra: a branca caiu. ' + N.nomes[op] + ' joga com a bola na mão.');
        res.foul = true; N.fase = 'jogo'; N.faltasSeguidas[sh] = 1; darMao('livre'); N.log = msgs; return res;
      }
      if (tem9) { msgs.push(N.nomes[sh] + ' encaçapa a 9 na quebra e vence o quadro.'); res.fimQuadro = sh; fimQuadro(N, sh, msgs); N.log = msgs; return res; }
      if (!legal) {
        msgs.push('Quebra ilegal (menos de 4 bolas na tabela e nenhuma encaçapada). ' + N.nomes[op] + ' pode jogar ou mandar quebrar de novo.');
        N.fase = 'jogo'; N.vez = op; N.recusa = { tipo: 'quebra', quem: op }; N.log = msgs; return res;
      }
      msgs.push(pot.length ? N.nomes[sh] + ' encaçapa na quebra e continua.' : 'Quebra válida.');
      res.propias = pot.length; N.fase = 'jogo'; N.vez = pot.length ? sh : op; N.mao = null; N.empurrarOk = true; N.faltasSeguidas[sh] = 0;
      N.log = msgs; return res;
    }

    var empurrou = !!acao.empurrar && S0.empurrarOk;
    if (scratch) foul = 'a branca caiu na caçapa';
    else if (rel.primeiro === null) foul = 'a branca não tocou em bola nenhuma';
    else if (!empurrou && rel.primeiro !== baixa) foul = 'a primeira bola tocada foi a ' + rel.primeiro + ', e a mais baixa era a ' + baixa;
    else if (!empurrou && !pot.length && !qtdTabelaDepois(rel)) foul = 'nenhuma bola tocou a tabela depois do contato';

    if (foul) {
      if (tem9) { recolocarNoPe(N, 9); pot = pot.filter(function (i) { return i !== 9; }); }
      N.faltasSeguidas[sh]++;
      if (N.faltasSeguidas[sh] >= 3) {
        msgs.push('Falta: ' + foul + '. É a terceira falta seguida de ' + N.nomes[sh] + ', que perde o quadro.');
        res.foul = true; res.fimQuadro = op; fimQuadro(N, op, msgs); N.log = msgs; return res;
      }
      msgs.push('Falta: ' + foul + '. ' + N.nomes[op] + ' joga com a bola na mão.' + (N.faltasSeguidas[sh] === 2 ? ' Atenção: mais uma falta seguida e ' + N.nomes[sh] + ' perde o quadro.' : ''));
      res.foul = true; darMao('livre'); N.log = msgs; return res;
    }
    N.faltasSeguidas[sh] = 0;
    if (tem9) {
      if (empurrou) { recolocarNoPe(N, 9); pot = pot.filter(function (i) { return i !== 9; }); msgs.push('A 9 caiu na empurrada: volta para a marca do pé.'); }
      else { msgs.push(N.nomes[sh] + ' encaçapa a bola 9 e vence o quadro.'); res.fimQuadro = sh; res.propias = pot.length; fimQuadro(N, sh, msgs); N.log = msgs; return res; }
    }
    res.propias = pot.length;
    if (empurrou) {
      msgs.push(N.nomes[sh] + ' fez uma empurrada. ' + N.nomes[op] + ' pode jogar dali ou devolver a vez.');
      N.vez = op; N.recusa = { tipo: 'empurrar', quem: op }; N.mao = null;
    } else if (pot.length) {
      msgs.push(N.nomes[sh] + ' encaçapa ' + (pot.length === 1 ? 'a bola ' + pot[0] : 'as bolas ' + pot.join(', ')) + ' e continua.');
      N.vez = sh; N.mao = null; N.recusa = null;
    } else {
      msgs.push(N.nomes[sh] + ' não encaçapou.');
      N.vez = op; N.mao = null; N.recusa = null;
    }
    N.log = msgs; return res;
  }

  /* decisão do oponente: aceitar a quebra ilegal ou mandar repetir; aceitar ou devolver a empurrada */
  function decidir(S, escolha) {
    var N = J.clonar(S), r = S.recusa, msgs = [];
    if (!r) return N;
    if (r.tipo === 'quebra') {
      if (escolha === 'repetir') {
        msgs.push(N.nomes[N.quebra] + ' quebra de novo.');
        N.tentativa = (N.tentativa || 0) + 1; novoQuadro(N);
      } else msgs.push(N.nomes[S.vez] + ' aceita a mesa como ficou.');
    } else if (r.tipo === 'empurrar') {
      if (escolha === 'recusar') { N.vez = 1 - N.vez; msgs.push(N.nomes[S.vez] + ' devolve a vez, e ' + N.nomes[N.vez] + ' joga de novo dali.'); }
      else msgs.push(N.nomes[S.vez] + ' joga a partir daí.');
    }
    N.recusa = null; N.log = msgs;
    return N;
  }

  /* ---------- ganchos para o robô ---------- */
  function valorPool(S0, r, quem) {
    var N = r.S, v = 0, res = r.res || {};
    if (N.fim) return N.fim.vencedor === quem ? 80 : -80;
    if (N.partida !== S0.partida) return (N.ganhas[quem] > S0.ganhas[quem]) ? 60 : -60;
    var k = S0.vez === quem ? 1 : -1;
    v += k * 1.6 * (res.propias || 0);
    if (res.foul) v -= k * 6;
    if (r.rel.branca) v -= k * 1.5;
    return v;
  }

  function acaoQuebra(S, nivel) {
    var m = mesa(S), cue = J.bolaPorId(S, 0), apice = S.bolas.filter(function (b) { return b.id > 0 && !b.fora; }).sort(function (a, b) { return a.y - b.y; })[0];
    return { ang: Math.atan2(apice.y - cue.y, apice.x - cue.x), v0: (S.modo === 'bola8' ? [5.9, 6.2, 6.4] : [5.2, 5.6, 5.9])[Math.max(0, Math.min(2, (nivel || 2) - 1))], a: 0, b: 0, alvo: apice.id };
  }

  function resumo(S) {
    var ids = naMesa(S);
    return { restantes: ids, grupos: S.grupos, baixa: ids.length ? Math.min.apply(null, ids) : 0,
      lisas: bolasDoGrupo(S, 0), listradas: bolasDoGrupo(S, 1), faltasSeguidas: S.faltasSeguidas, empurrarOk: S.empurrarOk };
  }

  var comum = { mesa: 'pool9', decidir: decidir, perfil: perfil, maoValida: maoValida, posicaoMao: posicaoMao, valor: valorPool,
    acaoQuebra: acaoQuebra, resumo: resumo, zonaMao: function (S) { return S.mao === 'cabeca' ? 'cabeca' : 'livre'; } };

  function reg(extra) { var o = {}, k; for (k in comum) o[k] = comum[k]; for (k in extra) o[k] = extra[k]; J.registrar(o); }
  reg({ id: 'bola8', nome: 'Bola 8', inicial: inicial('bola8'), arbitrar: arbitrar8, alvos: alvos8, chamar: function (S, id) { return id === 8; } });
  reg({ id: 'bola9', nome: 'Bola 9', inicial: inicial('bola9'), arbitrar: arbitrar9, alvos: alvos9, chamar: function () { return false; } });
});
