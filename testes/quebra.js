// Taxa de quebras legais e bolas encaçapadas por velocidade do taco
'use strict';
const J = require('../jogo.js'); require('../regras-pool.js'); const Bot = require('../bot.js');
const id = process.argv[2] || 'bola8';
for (const v0 of [3.5, 4.5, 5.2, 5.8, 6.4, 7.0]) {
  let leg = 0, pots = 0, sc = 0, n = 40, cush = 0;
  for (let s = 0; s < n; s++) {
    const m = J.modo(id), S = m.inicial({ semente: 100 + s });
    const mesa = J.mesaDe(S.mesa, 1), cue = J.bolaPorId(S, 0); cue.x = mesa.W / 2 + ((s % 5) - 2) * 0.06; 
    const ap = S.bolas.filter(b => b.id).sort((a, b) => a.y - b.y)[0];
    const acao = { ang: Math.atan2(ap.y - cue.y, ap.x - cue.x), v0, a: 0, b: 0, alvo: ap.id };
    const r = J.executar(S, acao);
    if (r.rel.branca) sc++;
    pots += r.rel.encacapadasObj.length; cush += r.rel.bolasNaTabela;
    if (r.rel.encacapadasObj.length > 0 || r.rel.bolasNaTabela >= 4) leg++;
  }
  console.log(id, 'v0', v0, 'bola', (Bot.bolaDoTaco({ m: 0.170097, M: 0.567, etip: 1 }, v0)).toFixed(1), 'legais', leg + '/' + n, 'encaçapadas média', (pots / n).toFixed(1), 'tabela média', (cush / n).toFixed(1), 'branca caiu', sc);
}
