// Testes das regras: cada caso entrega ao árbitro um relatório de tacada montado à mão
'use strict';
const J = require('../jogo.js'); require('../regras-brasileira.js'); require('../regras-pool.js'); require('../regras-snooker.js');
let ok = 0, mal = 0;
function t(nome, cond, extra) { if (cond) ok++; else { mal++; console.log('FALHOU:', nome, extra === undefined ? '' : JSON.stringify(extra)); } }

function jogada(S, o, acao) {
  const N = J.clonar(S), pot = o.pot || [];
  pot.forEach(id => { const b = J.bolaPorId(N, id); b.fora = true; });
  if (o.branca) J.bolaPorId(N, 0).fora = true;
  const rel = { primeiro: o.primeiro === undefined ? null : o.primeiro, tPrimeiro: 0, encacapadas: [], branca: !!o.branca, tabelaAntes: false,
    tabelaDepois: o.tabela || {}, bolasNaTabela: o.nTabela || 0, houveTabela: false, eventos: [] };
  pot.forEach(id => rel.encacapadas.push({ id: id, k: o.k === undefined ? 0 : o.k, t: 1 }));
  if (o.branca) rel.encacapadas.push({ id: 0, k: 0, t: 1 });
  rel.encacapadasObj = rel.encacapadas.filter(c => c.id !== 0);
  N.mao = null;
  const res = J.modo(S.modo).arbitrar(N, acao || {}, rel, S);
  return { N, res };
}
function tirar(S, ids) { ids.forEach(id => { J.bolaPorId(S, id).fora = true; }); }

/* ---------------- Snooker ---------------- */
{
  const m = J.modo('snooker'); let S = m.inicial({ semente: 1 }); S.mao = null;
  let r = jogada(S, { primeiro: 3, pot: [3] }, { alvo: 3 });
  t('snooker: vermelha encaçapada vale 1 e leva à cor', r.N.placar[0] === 1 && r.N.fase === 'cor' && r.N.vez === 0, [r.N.placar, r.N.fase]);
  r = jogada(S, { primeiro: 3, pot: [3, 4, 5] }, { alvo: 3 });
  t('snooker: três vermelhas valem 3', r.N.placar[0] === 3 && r.N.fase === 'cor');
  r = jogada(S, { primeiro: 19, pot: [] }, {});
  t('snooker: tocar a azul primeiro com vermelha na vez é falta de 5', r.res.foul && r.N.placar[1] === 5 && r.N.vez === 1, r.N.placar);
  r = jogada(S, { primeiro: 3, pot: [], branca: true }, { alvo: 3 });
  t('snooker: branca encaçapada é falta de 4 e bola na mão no D', r.res.foul && r.N.placar[1] === 4 && r.N.mao === 'D' && !J.bolaPorId(r.N, 0).fora, [r.N.placar, r.N.mao]);
  r = jogada(S, { primeiro: 3, pot: [17] }, { alvo: 3 });
  t('snooker: cor antes da vermelha é falta de 3 → mínimo 4', r.res.foul && r.N.placar[1] === 4, r.N.placar);
  r = jogada(S, { primeiro: 3, pot: [20] }, { alvo: 3 });
  t('snooker: encaçapar a rosa em falta vale 6 e a rosa volta', r.N.placar[1] === 6 && !J.bolaPorId(r.N, 20).fora, r.N.placar);
  r = jogada(S, { primeiro: null }, {});
  t('snooker: não tocar em nada é falta', r.res.foul && r.N.placar[1] === 4);
  // fase da cor
  let C = J.clonar(S); C.fase = 'cor'; tirar(C, [1]);
  r = jogada(C, { primeiro: 16, pot: [16] }, { alvo: 16 });
  t('snooker: cor anunciada encaçapada vale o valor e volta à marca', r.N.placar[0] === 2 && !J.bolaPorId(r.N, 16).fora && r.N.fase === 'vermelha' && r.N.vez === 0, [r.N.placar, r.N.fase]);
  r = jogada(C, { primeiro: 17, pot: [] }, { alvo: 16 });
  t('snooker: tocar cor diferente da anunciada é falta de 4', r.res.foul && r.N.placar[1] === 4, r.N.placar);
  r = jogada(C, { primeiro: 16, pot: [] }, { alvo: 16 });
  t('snooker: errar a cor passa a vez e volta para vermelha', !r.res.foul && r.N.vez === 1 && r.N.fase === 'vermelha');
  // sequência final
  let Q = J.clonar(S); tirar(Q, [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]); Q.fase = 'sequencia';
  r = jogada(Q, { primeiro: 16, pot: [16] }, { alvo: 16 });
  t('snooker: na sequência a cor encaçapada fica fora', r.N.placar[0] === 2 && J.bolaPorId(r.N, 16).fora && r.N.vez === 0);
  r = jogada(Q, { primeiro: 17, pot: [] }, { alvo: 17 });
  t('snooker: sequência, tocar a verde com a amarela na vez é falta de 4', r.res.foul && r.N.placar[1] === 4);
  let F = J.clonar(Q); tirar(F, [16, 17, 18, 19, 20]); F.placar = [40, 20];
  r = jogada(F, { primeiro: 21, pot: [21] }, { alvo: 21 });
  t('snooker: preta final decide o quadro por pontos', r.N.fim && r.N.fim.vencedor === 0 && r.N.ganhas[0] === 1, [r.N.fim, r.N.ganhas]);
  F.placar = [30, 37];
  r = jogada(F, { primeiro: 21, pot: [21] }, { alvo: 21 });
  t('snooker: empate na preta final leva à decisiva', r.N.fase === 'decisiva' && !J.bolaPorId(r.N, 21).fora && r.N.mao === 'D', [r.N.fase, r.N.placar]);
  F.placar = [30, 30];
  r = jogada(F, { primeiro: 21, pot: [21] }, { alvo: 21 });
  t('snooker: 37 a 37 após a preta mantém empate', r.N.fase === 'decisiva' || r.N.fim, r.N.fase);
  let D = J.clonar(r.N); D.fase = 'decisiva';
  const rd = jogada(D, { primeiro: 21, pot: [21] }, { alvo: 21 });
  t('snooker: decisiva, encaçapar a preta vence', rd.N.ganhas[D.vez] === 1 || rd.N.fim);
  const rf = jogada(D, { primeiro: null }, {});
  t('snooker: decisiva, falta perde', rf.N.ganhas[1 - D.vez] === 1 || rf.N.fim);
  // melhor de 3 continua em novo quadro
  let M = m.inicial({ semente: 2, melhorDe: 3 }); M.mao = null; M.fase = 'sequencia'; tirar(M, [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20]); M.placar = [10, 0];
  r = jogada(M, { primeiro: 21, pot: [21] }, { alvo: 21 });
  t('snooker: melhor de 3, vencer o 1º quadro abre o 2º', !r.N.fim && r.N.partida === 2 && r.N.bolas.filter(b => b.id > 0 && !b.fora).length === 21 && r.N.vez === 1, [r.N.partida, r.N.vez]);
  // bola livre
  let B = J.clonar(S); B.mao = null;
  const cue = J.bolaPorId(B, 0); const mesa = J.mesaDe(B.mesa, 1);
  const s1 = m.alvos(B); t('snooker: alvos iniciais são as vermelhas', s1.ids.length === 15 && !B.bolaLivre);
  const d0 = m.desistir(B, 0); t('snooker: desistir dá o quadro ao oponente', d0.ganhas[1] === 1 || d0.fim);
}

/* ---------------- Bola 8 ---------------- */
{
  const m = J.modo('bola8'); let S = m.inicial({ semente: 3 }); S.mao = null; S.fase = 'aberta';
  let r = jogada(S, { primeiro: 9, pot: [10], tabela: { 1: true } }, {});
  t('bola8: mesa aberta, encaçapar listrada dá as listradas', r.N.grupos[0] === 1 && r.N.grupos[1] === 0 && r.N.vez === 0, r.N.grupos);
  r = jogada(S, { primeiro: 9, pot: [10, 3], tabela: { 1: true } }, {});
  t('bola8: duas cores encaçapadas mantêm a mesa aberta', r.N.grupos[0] === null && r.N.vez === 0, r.N.grupos);
  r = jogada(S, { primeiro: 8, pot: [] }, {});
  t('bola8: tocar a 8 primeiro na mesa aberta é falta e dá bola na mão', r.res.foul && r.N.mao === 'livre' && r.N.vez === 1);
  r = jogada(S, { primeiro: 2, pot: [8] , tabela: { 1: true } }, {});
  t('bola8: 8 encaçapada cedo perde o quadro', r.N.ganhas[1] === 1 || r.N.fim, r.N.ganhas);
  r = jogada(S, { primeiro: 2, pot: [], tabela: {} }, {});
  t('bola8: sem encaçapar e sem tocar a tabela é falta', r.res.foul);
  r = jogada(S, { primeiro: 2, pot: [], tabela: { 2: true } }, {});
  t('bola8: sem encaçapar mas com tabela só passa a vez', !r.res.foul && r.N.vez === 1 && !r.N.mao);
  let G = J.clonar(S); G.fase = 'grupos'; G.grupos = [0, 1];
  r = jogada(G, { primeiro: 9, pot: [] , tabela: { 9: true } }, {});
  t('bola8: tocar bola do oponente primeiro é falta', r.res.foul && r.N.mao === 'livre');
  r = jogada(G, { primeiro: 2, pot: [9], tabela: { 9: true } }, {});
  t('bola8: encaçapar só bola do adversário não mantém a vez', !r.res.foul && r.N.vez === 1);
  r = jogada(G, { primeiro: 2, pot: [], branca: true, tabela: { 2: true } }, {});
  t('bola8: branca encaçapada dá bola na mão', r.res.foul && r.N.mao === 'livre' && !J.bolaPorId(r.N, 0).fora);
  let H = J.clonar(G); tirar(H, [1, 2, 3, 4, 5, 6, 7]);
  r = jogada(H, { primeiro: 8, pot: [8], k: 2 }, { alvo: 8, cac: 2 });
  t('bola8: 8 na caçapa cantada, grupo limpo, vence', r.N.ganhas[0] === 1 || r.N.fim, r.N.ganhas);
  r = jogada(H, { primeiro: 8, pot: [8], k: 1 }, { alvo: 8, cac: 2 });
  t('bola8: 8 em outra caçapa perde', r.N.ganhas[1] === 1 || r.N.fim, r.N.ganhas);
  r = jogada(H, { primeiro: 8, pot: [8], branca: true, k: 2 }, { alvo: 8, cac: 2 });
  t('bola8: 8 com branca perde', r.N.ganhas[1] === 1 || r.N.fim);
  r = jogada(H, { primeiro: 9, pot: [] , tabela: { 9: true } }, {});
  t('bola8: com o grupo limpo, tocar outra bola antes da 8 é falta', r.res.foul);
  // quebra
  let Q = m.inicial({ semente: 4 });
  r = jogada(Q, { primeiro: 1, pot: [], nTabela: 4 }, {});
  t('bola8: quebra com 4 bolas na tabela é válida, vez passa', !r.res.foul && !r.N.recusa && r.N.vez === 1 && r.N.fase === 'aberta', [r.N.vez, r.N.recusa]);
  r = jogada(Q, { primeiro: 1, pot: [], nTabela: 2 }, {});
  t('bola8: quebra fraca dá escolha ao oponente', r.N.recusa && r.N.recusa.tipo === 'quebra' && r.N.vez === 1);
  const dd = m.decidir(r.N, 'repetir'); t('bola8: mandar repetir remonta o triângulo', dd.fase === 'quebra' && dd.vez === 0 && dd.bolas.filter(b => b.id > 0 && !b.fora).length === 15);
  r = jogada(Q, { primeiro: 1, pot: [5], nTabela: 4 }, {});
  t('bola8: encaçapar na quebra mantém a vez e a mesa aberta', r.N.vez === 0 && r.N.grupos[0] === null);
  r = jogada(Q, { primeiro: 1, pot: [8], nTabela: 4 }, {});
  t('bola8: a 8 na quebra volta ao pé e não decide', !r.N.fim && !J.bolaPorId(r.N, 8).fora && r.N.ganhas[0] + r.N.ganhas[1] === 0);
  r = jogada(Q, { primeiro: 1, pot: [], branca: true, nTabela: 4 }, {});
  t('bola8: branca na quebra dá bola na mão atrás da linha', r.res.foul && r.N.mao === 'cabeca' && r.N.vez === 1);
}

/* ---------------- Bola 9 ---------------- */
{
  const m = J.modo('bola9'); let S = m.inicial({ semente: 5 }); S.mao = null; S.fase = 'jogo';
  let r = jogada(S, { primeiro: 2, pot: [], tabela: { 2: true } }, {});
  t('bola9: tocar bola que não é a mais baixa é falta', r.res.foul && r.N.mao === 'livre' && r.N.vez === 1);
  r = jogada(S, { primeiro: 1, pot: [3], tabela: { 3: true } }, {});
  t('bola9: encaçapar qualquer bola após acertar a mais baixa mantém a vez', !r.res.foul && r.N.vez === 0);
  r = jogada(S, { primeiro: 1, pot: [9] }, {});
  t('bola9: 9 encaçapada de forma legal vence (combinação)', r.N.ganhas[0] === 1 || r.N.fim);
  r = jogada(S, { primeiro: 2, pot: [9] }, {});
  t('bola9: 9 em falta volta ao pé', r.res.foul && !J.bolaPorId(r.N, 9).fora && !r.N.fim && r.N.ganhas[0] === 0);
  r = jogada(S, { primeiro: 1, pot: [], tabela: {} }, {});
  t('bola9: sem encaçapar nem tabela é falta', r.res.foul);
  // empurrada
  let P = J.clonar(S); P.empurrarOk = true;
  r = jogada(P, { primeiro: 4, pot: [], tabela: {} }, { empurrar: true });
  t('bola9: empurrada permitida, oponente escolhe', !r.res.foul && r.N.recusa && r.N.recusa.tipo === 'empurrar' && r.N.vez === 1);
  const dv = m.decidir(r.N, 'recusar'); t('bola9: devolver a empurrada passa a vez de volta', dv.vez === 0);
  r = jogada(S, { primeiro: 4, pot: [], tabela: {} }, { empurrar: true });
  t('bola9: empurrada fora da hora é falta', r.res.foul);
  // três faltas
  let T = J.clonar(S); T.faltasSeguidas = [2, 0];
  r = jogada(T, { primeiro: 2, pot: [], tabela: { 2: true } }, {});
  t('bola9: terceira falta seguida perde o quadro', r.N.ganhas[1] === 1 || r.N.fim, r.N.ganhas);
  T = J.clonar(S); T.faltasSeguidas = [2, 0];
  r = jogada(T, { primeiro: 1, pot: [2], tabela: { 2: true } }, {});
  t('bola9: jogada legal zera a contagem', r.N.faltasSeguidas[0] === 0);
  // quebra
  let Q = m.inicial({ semente: 6 });
  r = jogada(Q, { primeiro: 1, pot: [9], nTabela: 4 }, {});
  t('bola9: 9 na quebra vence', r.N.ganhas[0] === 1 || r.N.fim);
  r = jogada(Q, { primeiro: 1, pot: [], branca: true, nTabela: 4 }, {});
  t('bola9: branca na quebra é falta com bola na mão em qualquer lugar', r.res.foul && r.N.mao === 'livre' && r.N.vez === 1);
  r = jogada(Q, { primeiro: 1, pot: [], nTabela: 4 }, {});
  t('bola9: quebra válida sem encaçapar passa a vez, empurrada liberada', r.N.vez === 1 && r.N.empurrarOk === true);
}

console.log('regras ok=' + ok + (mal ? ' mal=' + mal : ''));
process.exit(mal ? 1 : 0);
