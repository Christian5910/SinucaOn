// Partidas completas robô contra robô, para flagrar travas nas regras
'use strict';
const J = require('../jogo.js'); require('../regras-brasileira.js'); require('../regras-pool.js'); require('../regras-snooker.js'); const Bot = require('../bot.js');
const modoId = process.argv[2] || 'brasileira', n = +process.argv[3] || 3, niv = +process.argv[4] || 2;
let seed = 99;
function rng() { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }
let tot = 0, jogadas = 0, t0 = Date.now(), pior = 0;
for (let g = 0; g < n; g++) {
  const modo = J.modo(modoId); let S = modo.inicial({ melhorDe: 1, quemSai: g % 2 });
  let passos = 0;
  while (!S.fim && passos++ < 400) {
    if (S.recusa) { const esc = Bot.recusar(S, { rng }); S = modo.decidir(S, esc); if (esc === 'jogar' || esc === 'repetir') continue; }
    if (S.mao) { const p = Bot.posicionarMao(S, { rng }); J.aplicarMao(S, p.x, p.y); }
    const ts = Date.now();
    const d = Bot.escolher(S, { nivel: niv, rng });
    pior = Math.max(pior, Date.now() - ts);
    const r = J.executar(S, d.acao);
    if (process.env.V) console.log(passos, 'vez', S.vez, 'fase', S.fase, (r.S.log || []).join(' | '), 'placar', r.S.placar);
    S = r.S; jogadas++;
  }
  tot += passos;
  console.log('jogo', g, S.fim ? 'terminou' : 'TRAVOU em ' + passos, 'placar', S.placar, 'ganhas', S.ganhas, 'passos', passos);
}
console.log('ms por decisão média', ((Date.now() - t0) / jogadas).toFixed(0), 'pior', pior);
