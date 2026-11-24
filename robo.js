/* SinucaON! - robô em segundo plano (Web Worker): escolhe a tacada sem travar a tela. */
importScripts('fisica.js', 'mesa.js', 'jogo.js', 'regras-brasileira.js', 'regras-pool.js', 'regras-snooker.js', 'bot.js');

// gerador reproduzível a partir da semente que a tela manda (mulberry32)
function gerador(semente) {
  var a = semente >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

self.onmessage = function (e) {
  var m = e.data, rng = gerador(m.semente), r;
  try {
    if (m.tipo === 'escolher') {
      var d = self.Bot.escolher(m.S, { nivel: m.nivel, rng: rng, orcamento: m.orcamento });
      r = { acao: d.acao, v: d.v };
    } else if (m.tipo === 'mao') r = self.Bot.posicionarMao(m.S, { rng: rng });
    else if (m.tipo === 'recusar') r = self.Bot.recusar(m.S, { rng: rng });
    self.postMessage({ id: m.id, r: r });
  } catch (err) {
    self.postMessage({ id: m.id, erro: String(err && err.message || err) });
  }
};
