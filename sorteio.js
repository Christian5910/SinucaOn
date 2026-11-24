/* ==========================================================================
   sorteio.js - sorteio padrão da família ON! (arquivo reutilizável, vale para qualquer jogo)

   Regra: toda partida que depende de sorte (embaralhar, sortear peças, quem começa) nasce de uma
   SEMENTE nova de 128 bits e nunca repete, em nenhum aparelho. Os jogos não usam Math.random
   direto para o que decide a partida.

   A semente junta várias fontes de entropia (crypto.getRandomValues, relógio, cronômetro de alta
   resolução, Math.random, um contador que muda a cada chamada, dados do aparelho e da página) e as
   mistura com um hash de 128 bits. Com a semente, o gerador (sfc32) é totalmente determinístico:
   a mesma semente refaz a mesma sequência, o que deixa testes e salvamentos reproduzíveis. O estado do gerador (4 números) cabe no
   salvamento da partida.

   API (window.Sorteio ou module.exports):
     novaSemente()          texto com 32 dígitos hexadecimais (128 bits), diferente a cada chamada
     criar(semente)         gerador a partir de uma semente (texto) ou de um estado salvo ([a,b,c,d])
   Gerador:
     prox()                 inteiro de 32 bits sem sinal
     real()                 número em [0, 1)
     inteiro(n)             inteiro em [0, n), sem viés de módulo
     embaralhar(lista)      Fisher-Yates, no lugar; devolve a própria lista
     escolher(lista)        um item ao acaso
     estado()               [a, b, c, d] para salvar
     misturar(texto)        acrescenta entropia nova ao gerador (por exemplo, entropia() a cada mão)
   entropia()               texto com entropia nova, para misturar
   ========================================================================== */
(function (raiz, fabrica) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = fabrica(raiz);
  else raiz.Sorteio = fabrica(raiz);
})(typeof window !== 'undefined' ? window : globalThis, function (raiz) {
  'use strict';

  var contador = 0;

  /* hash de 128 bits (cyrb128): texto -> 4 inteiros de 32 bits */
  function hash128(s) {
    var h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762, k;
    for (var i = 0; i < s.length; i++) {
      k = s.charCodeAt(i);
      h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
      h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
      h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
      h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
    h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
    h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
  }

  function bytesDoSistema() {
    var out = [];
    try {
      var c = raiz.crypto || (raiz.msCrypto);
      if (c && c.getRandomValues) {
        var a = new Uint32Array(8); c.getRandomValues(a);
        for (var i = 0; i < a.length; i++) out.push(a[i]);
      } else if (typeof require === 'function') {
        var b = require('crypto').randomBytes(32);
        for (var j = 0; j < 32; j += 4) out.push(b.readUInt32LE(j));
      }
    } catch (e) { /* segue com as outras fontes */ }
    return out;
  }

  function entropia() {
    var p = [];
    p.push(bytesDoSistema().join('.'));
    p.push(Date.now());
    try { if (raiz.performance && raiz.performance.now) p.push(raiz.performance.now()); } catch (e) { /* ignora */ }
    try { if (raiz.performance && raiz.performance.timeOrigin) p.push(raiz.performance.timeOrigin); } catch (e) { /* ignora */ }
    for (var i = 0; i < 4; i++) p.push(Math.random());
    p.push(++contador);
    try {
      var n = raiz.navigator;
      if (n) p.push(n.userAgent, n.language, n.hardwareConcurrency, n.platform);
      var s = raiz.screen;
      if (s) p.push(s.width, s.height, s.colorDepth);
      p.push(new Date().getTimezoneOffset());
      if (raiz.location) p.push(raiz.location.href);
    } catch (e) { /* ignora */ }
    try { if (typeof process !== 'undefined' && process.hrtime) p.push(process.hrtime().join('.'), process.pid); } catch (e) { /* ignora */ }
    return p.join('|');
  }

  function hex8(n) { return ('00000000' + (n >>> 0).toString(16)).slice(-8); }

  function novaSemente() {
    var h = hash128(entropia() + '#' + entropia());
    return hex8(h[0]) + hex8(h[1]) + hex8(h[2]) + hex8(h[3]);
  }

  function Gerador(est) {
    this.a = est[0] >>> 0; this.b = est[1] >>> 0; this.c = est[2] >>> 0; this.d = est[3] >>> 0;
  }
  /* sfc32 */
  Gerador.prototype.prox = function () {
    var t = (((this.a + this.b) | 0) + this.d) | 0;
    this.d = (this.d + 1) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = (this.c + t) | 0;
    return t >>> 0;
  };
  Gerador.prototype.real = function () { return this.prox() / 4294967296; };
  Gerador.prototype.inteiro = function (n) {
    n = Math.floor(n);
    if (!(n > 0)) return 0;
    if (n > 4294967296) { /* n grande: junta dois sorteios de 32 bits */
      return Math.floor(this.real() * n);
    }
    var lim = 4294967296 - (4294967296 % n), x;
    do { x = this.prox(); } while (x >= lim);
    return x % n;
  };
  Gerador.prototype.embaralhar = function (lista) {
    for (var i = lista.length - 1; i > 0; i--) {
      var j = this.inteiro(i + 1), t = lista[i]; lista[i] = lista[j]; lista[j] = t;
    }
    return lista;
  };
  Gerador.prototype.escolher = function (lista) { return lista[this.inteiro(lista.length)]; };
  Gerador.prototype.estado = function () { return [this.a >>> 0, this.b >>> 0, this.c >>> 0, this.d >>> 0]; };
  Gerador.prototype.misturar = function (txt) {
    var h = hash128(String(txt === undefined ? entropia() : txt) + '|' + this.estado().join('.'));
    this.a = (this.a ^ h[0]) >>> 0; this.b = (this.b ^ h[1]) >>> 0; this.c = (this.c ^ h[2]) >>> 0; this.d = (this.d ^ h[3]) >>> 0;
    for (var i = 0; i < 12; i++) this.prox();
    return this;
  };

  function criar(semente) {
    var est;
    if (Array.isArray(semente) && semente.length === 4) est = semente;
    else {
      est = hash128('sorteio-on|' + String(semente));
    }
    var g = new Gerador(est);
    if (!Array.isArray(semente)) for (var i = 0; i < 15; i++) g.prox();   // aquecimento
    return g;
  }

  return { novaSemente: novaSemente, criar: criar, entropia: entropia, hash128: hash128 };
});
