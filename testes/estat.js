// Estatística de qualidade do robô: faltas, encaçapadas e sequências por nível
'use strict';
const J = require('../jogo.js'); require('../regras-brasileira.js'); require('../regras-pool.js'); require('../regras-snooker.js'); const Bot = require('../bot.js');
const modoId = process.argv[2] || 'brasileira', n = +process.argv[3] || 3, niv = +process.argv[4] || 2;
let seed = 7;
function rng() { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }
let tac = 0, faltas = 0, encac = 0, mantem = 0, semToque = 0, seq = [], atual = 0, ult = null;
for (let g = 0; g < n; g++) {
  const modo = J.modo(modoId); let S = modo.inicial({ melhorDe: 1, quemSai: g % 2 }), p = 0;
  while (!S.fim && p++ < 400) {
    if (S.recusa) { const e = Bot.recusar(S, { rng }); S = modo.decidir(S, e); if (e === 'jogar' || e === 'repetir') continue; }
    if (S.mao) { const q = Bot.posicionarMao(S, { rng }); J.aplicarMao(S, q.x, q.y); }
    const d = Bot.escolher(S, { nivel: niv, rng }), v0 = S.vez;
    const r = J.executar(S, d.acao);
    tac++;
    if (r.rel.primeiro === null) semToque++;
    if (r.res && r.res.foul) faltas++;
    if (r.rel.encacapadas && r.rel.encacapadas.length) encac++;
    if (r.S.vez === v0 && ult === v0) atual++; else { if (atual) seq.push(atual); atual = 1; }
    ult = r.S.vez; S = r.S;
  }
}
seq.push(atual);
console.log('nível', niv, 'tacadas', tac, 'faltas', (100 * faltas / tac).toFixed(0) + '%', 'sem toque', (100 * semToque / tac).toFixed(0) + '%', 'com encaçapada', (100 * encac / tac).toFixed(0) + '%', 'maior sequência', Math.max.apply(null, seq));
