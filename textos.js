/* SinucaON! - textos do Como Jogar (pt-BR). O HTML daqui só usa h3, h4, p, ul, ol, li, b e em. */
window.STXT = {
  site: `
<h3>O que é</h3>
<p>SinucaON! reúne quatro jogos de mesa com bolas e caçapas: <b>Sinuca Brasileira</b>, <b>Snooker</b>, <b>Bola 8</b> e <b>Bola 9</b>. Todos usam o mesmo motor de física, que calcula cada bola, cada choque e cada giro. Você joga contra o robô (em três níveis) ou a dois, no mesmo aparelho.</p>

<h3>Como dar a tacada</h3>
<ol>
<li><b>Mire.</b> Toque ou clique na mesa, ou arraste: a bola branca aponta para onde você tocou. No celular, uma lupa mostra a mira ampliada enquanto o dedo está na tela.</li>
<li><b>Ajuste fino.</b> Use a barra <em>Mira fina</em> (ou os botões menos e mais) para girar a mira em passos de um décimo de grau. Distâncias longas pedem esse ajuste.</li>
<li><b>Força.</b> Na barra <em>Força</em>, do toque suave à força máxima. O taco desenhado na mesa recua conforme a força.</li>
<li><b>Efeito.</b> Em <em>Efeito</em>, escolha onde o taco encosta na bola. Em cima, a branca corre depois do choque. Embaixo, ela volta. De lado, ela gira e muda o rebote nas tabelas.</li>
<li><b>Tacar.</b> Aperte o botão <em>Tacar</em>. Toque na mesa durante o movimento para pular a animação.</li>
</ol>

<h3>Bola na mão</h3>
<p>Quando a regra dá a bola na mão, a área permitida fica marcada em amarelo (o semicírculo D, a área atrás da linha da cabeça ou a mesa toda). Arraste a bola branca para onde quiser dentro dela e depois mire.</p>

<h3>Cantar a caçapa</h3>
<p>Na Bola 8, a bola 8 precisa de caçapa cantada. Quando você mirar nela, as caçapas aparecem com um contorno: toque na caçapa em que a 8 vai cair.</p>

<h3>Teclado</h3>
<ul>
<li>Setas para a esquerda e para a direita: giram a mira (com Shift, de um em um grau).</li>
<li>Setas para cima e para baixo: força.</li>
<li>Espaço ou Enter: tacar. A letra E abre o efeito.</li>
</ul>

<h3>Ajudas</h3>
<p>Em <em>Ajudas</em>, abaixo da mesa, escolha o guia de mira (nenhum, só a linha ou completo, com o caminho da bola alvo e da branca depois do choque) e a velocidade da animação. O guia de mira é uma linha reta: ele não considera o efeito, o atrito nem o giro das bolas.</p>

<h3>O resto</h3>
<ul>
<li>O jogo salva sozinho depois de cada tacada. Se você fechar a página, a partida continua de onde parou.</li>
<li>No menu, em Estatísticas, ficam as suas vitórias, tacadas e bolas encaçapadas, só neste aparelho.</li>
<li>Em <em>Nova partida</em> você escolhe o jogo, o adversário, o nível do robô, a duração e se as caçapas são as oficiais ou um pouco mais largas.</li>
</ul>`,

  regras: `
<h3>Sinuca Brasileira</h3>
<p>Jogada na mesa de snooker, com sete bolas e a branca. Cada bola tem um número e um valor em pontos: <b>1 vermelha, 2 amarela, 3 verde, 4 marrom, 5 azul, 6 rosa, 7 preta</b>. A <b>bola da vez</b> é sempre a de menor número que ainda está na mesa.</p>
<h4>A saída</h4>
<p>Quem sai coloca a branca no D e precisa acertar a bola 1, que está na marca. Se a bola 1 cair ou houver falta, a saída se repete. Se a branca ficar sem poder tirar fino dos dois lados da bola 1, o adversário escolhe entre jogar assim e mandar repetir.</p>
<h4>O andamento</h4>
<ul>
<li>Você joga na bola da vez. Se encaçapar, ganha o valor dela e <b>precisa jogar numa numerada</b>, isto é, em qualquer uma das outras.</li>
<li>Numerada encaçapada não vale ponto: ela volta para a marca e você continua. Numerada que não cai passa a vez, e o adversário pode aceitar a mesa ou mandar você jogar de novo.</li>
<li>Você também pode escolher uma numerada no lugar da bola da vez. Se ela não cair, é <b>castigo de 7 pontos</b>. Você escolhe a bola da jogada apenas mirando nela.</li>
</ul>
<h4>Faltas</h4>
<p>Toda falta dá <b>7 pontos</b> ao adversário. É falta: tocar primeiro numa bola que não é a visada, não tocar em nenhuma, encaçapar a branca, encaçapar bola que não era a visada ou duas bolas na mesma tacada. Bolas encaçapadas numa falta voltam para as marcas. Se a branca cair, o adversário joga com ela na mão, no D. Depois de uma falta, o adversário pode aceitar a tacada ou mandar o autor jogar de novo.</p>
<h4>O fim da partida</h4>
<p>A partida acaba quando a bola 7 cai: vence quem tiver mais pontos. Se empatar, joga-se uma partida complementar só com a bola 7. A partida também acaba antes se a diferença de pontos passar de <b>46</b> com a bola 5 da vez, de <b>27</b> com a 6 ou de <b>7</b> com a 7.</p>

<h3>Snooker</h3>
<p>Mesa de 12 pés, com 15 vermelhas (1 ponto cada) e seis cores: amarela 2, verde 3, marrom 4, azul 5, rosa 6, preta 7. Vence o quadro quem somar mais pontos.</p>
<ul>
<li>A primeira tacada sai do D, mirando numa vermelha.</li>
<li><b>Uma vermelha, uma cor.</b> Depois de encaçapar vermelhas (pode ser mais de uma por tacada), você joga numa cor. Para anunciar a cor, é só mirar nela. A cor encaçapada volta para a marca enquanto ainda houver vermelhas.</li>
<li>Sem vermelhas na mesa, as cores são jogadas em ordem, da amarela à preta, e ficam fora.</li>
<li><b>Falta</b>: vale o maior entre 4 e o valor da bola em jogo, da bola tocada primeiro ou da bola encaçapada, com teto de 7. Os pontos vão para o adversário, que pode aceitar a tacada ou mandar o autor jogar de novo. Se a branca cair, ela volta para o D.</li>
<li><b>Bola livre</b>: depois de uma falta, se a branca está snookerada (sem enxergar a bola da vez), o adversário pode usar qualquer cor como bola livre: mirando numa cor que não é a da vez, ela passa a valer como a bola da vez.</li>
<li><b>Empate</b> depois da preta final: a preta volta à marca, um sorteio decide quem joga e quem encaçapar a preta vence. Uma falta nesse momento perde o quadro.</li>
<li>Se a diferença de pontos for maior do que os pontos que restam na mesa, o botão <em>Desistir do quadro</em> faz sentido, como nos jogos de verdade.</li>
</ul>
<p><b>Não está no jogo:</b> a regra do <em>miss</em> (repetir a jogada quando não se tentou o melhor possível). A bola livre só vale quando a bola da vez é uma vermelha ou uma cor específica, e a bola livre é sempre uma cor.</p>

<h3>Bola 8</h3>
<p>Mesa de pool de 9 pés, com 15 bolas: lisas de 1 a 7, listradas de 9 a 15 e a bola 8.</p>
<ul>
<li><b>Quebra</b>: a branca sai de trás da linha da cabeça. A quebra vale se encaçapar uma bola ou levar quatro bolas até a tabela. Se não valer, o adversário aceita a mesa ou manda quebrar de novo. Se a branca cair, o adversário joga com ela na mão, atrás da linha. A bola 8 que cai na quebra volta para a marca do pé.</li>
<li><b>Mesa aberta</b>: no começo ninguém tem grupo. Quem encaçapar bolas de um grupo só (e não fizer falta) fica com ele. Se cair uma lisa e uma listrada na mesma tacada, a mesa continua aberta.</li>
<li>Em cada tacada, a primeira bola tocada precisa ser do seu grupo. Depois do contato, uma bola deve cair ou alguma bola deve tocar a tabela. Você continua se encaçapar uma bola sua.</li>
<li><b>Falta</b>: bola errada primeiro, branca encaçapada, nada tocado ou nenhuma bola na tabela depois do contato. O adversário joga com a bola <b>na mão, em qualquer lugar da mesa</b>.</li>
<li><b>Bola 8</b>: com todas as suas bolas fora, jogue na 8 e cante a caçapa. Ela precisa cair na caçapa cantada, sem falta, para você vencer. Encaçapar a 8 antes da hora, ou junto com uma falta, perde o quadro.</li>
</ul>

<h3>Bola 9</h3>
<p>Mesa de pool de 9 pés, com as bolas 1 a 9 em losango e a 1 na ponta.</p>
<ul>
<li>A primeira bola tocada tem de ser sempre a <b>de menor número</b> que está na mesa. Depois do contato, uma bola deve cair ou alguma bola deve tocar a tabela.</li>
<li>Encaçapar qualquer bola mantém a vez. Encaçapar a <b>9</b> numa jogada legal vence o quadro, mesmo numa combinação, ou seja, quando a bola mais baixa empurra a 9.</li>
<li><b>Quebra</b>: vale se cair uma bola ou se quatro bolas tocarem a tabela. Uma 9 na quebra vence. Quebra fraca sem falta dá ao adversário a escolha entre jogar e mandar quebrar de novo.</li>
<li><b>Falta</b>: o adversário joga com a bola na mão em qualquer lugar. Se a 9 cair numa falta, ela volta para a marca do pé. <b>Três faltas seguidas</b> do mesmo jogador perdem o quadro.</li>
<li><b>Empurrada</b>: na primeira tacada depois da quebra, o botão <em>Empurrada</em> permite jogar sem tocar a bola mais baixa nem encaçapar nada. O adversário escolhe entre jogar dali e devolver a vez.</li>
</ul>

<h3>O que as quatro regras não têm</h3>
<p>Em todos os jogos: não há massé, jump (bola saltando), taco elevado nem as regras de uso de giz, de toque duplo e de bola saltando para fora da mesa. A tacada é sempre horizontal.</p>`,

  fisica: `
<h3>Como a física funciona</h3>
<p>O motor não anda de quadro em quadro. Ele calcula, para cada bola, o caminho exato (parada, girando, deslizando ou rolando) e procura o <b>próximo instante em que algo muda</b>: um choque entre bolas, um choque numa tabela, a entrada numa caçapa ou a passagem de deslizando para rolando. O resultado é o mesmo, com muito menos erro acumulado do que numa simulação por passos.</p>
<h4>O que está simulado</h4>
<ul>
<li><b>Deslizando e rolando.</b> Logo depois da tacada a bola desliza, com atrito entre o pano e a bola. Depois de um tempo ela passa a rolar, perdendo velocidade devagar. Por isso a bola de topo corre e a de corte volta.</li>
<li><b>Efeito.</b> A tacada dá velocidade e giro à bola conforme o ponto onde o taco bate, com massa e inércia reais. O giro lateral gira a bola sobre o próprio eixo e some aos poucos.</li>
<li><b>Choque entre bolas.</b> Quase elástico, com atrito entre as bolas: a bola alvo sai um pouco desviada da linha dos centros (o <em>throw</em>) e leva um pouco de giro. A regra dos 30 graus, que todo jogador conhece, aparece sozinha.</li>
<li><b>Tabelas.</b> O rebote depende da velocidade, do ângulo, do giro e do atrito da almofada, com a altura de contato real. Por isso bolas rápidas e bolas com efeito rebatem de formas diferentes.</li>
<li><b>Caçapas.</b> Têm as medidas das mesas reais, com as pontas dos dentes (jaws) como obstáculos: uma bola devagar entra mais fácil do que uma bola rápida, e bolas de quina podem ficar na boca.</li>
</ul>
<h4>Medidas usadas</h4>
<ul>
<li>Pool: bola de 57,15 mm e 170 g, mesa de 9 pés (2,54 por 1,27 m).</li>
<li>Snooker e sinuca brasileira: bola de 52,4 mm e 142 g, mesa de 12 pés (3,569 por 1,778 m).</li>
</ul>
<h4>O que não está</h4>
<p>Massé, jump e taco levantado. O efeito lateral não curva a trajetória da branca logo depois da tacada (o <em>squirt</em> e a curva do efeito não existem aqui). A mesa é perfeitamente plana e o pano não tem desgaste nem direção.</p>
<p>Os créditos das equações e das constantes estão no arquivo CREDITOS.txt do jogo.</p>`,

  dicas: `
<h3>Para acertar mais</h3>
<ul>
<li>Em cortes finos, a sua mira precisa ser muito precisa. Use a <b>Mira fina</b> e, no celular, a lupa.</li>
<li>Em tacadas longas, um décimo de grau na mira já é mais de um centímetro de erro no fim da mesa.</li>
<li>Força média costuma encaçapar mais do que força máxima: a bola rápida bate nos dentes da caçapa e não entra.</li>
<li>O guia <b>completo</b> mostra a linha da bola alvo. A linha de cada tacada serve para ver se o ângulo leva à caçapa que você quer.</li>
</ul>
<h3>Para jogar melhor</h3>
<ul>
<li>Pense na tacada seguinte: a bola de topo faz a branca seguir, a de recuo faz a branca voltar, e a de lado muda o ângulo do rebote.</li>
<li>Quando não houver tacada boa, jogue de segurança: acerte a bola da vez e deixe a branca longe, ou escondida atrás de outras bolas.</li>
<li>Na Sinuca Brasileira, numerada que não cai custa 7 pontos. Só arrisque uma numerada quando a caçapa estiver aberta.</li>
<li>No Snooker, uma boa série começa pela vermelha que deixa a branca bem posicionada para a cor alta.</li>
<li>Na Bola 8, resolva as bolas que estão coladas ou perto da tabela antes de tentar a 8.</li>
<li>Na Bola 9, a combinação é um atalho legítimo: muitas vezes a 9 cai empurrada pela bola mais baixa.</li>
</ul>
<h3>Contra o robô</h3>
<p>O <b>Fácil</b> erra a mira e a força e joga sem pensar na tacada seguinte. O <b>Médio</b> escolhe bem o que encaçapar e às vezes joga de segurança. O <b>Difícil</b> quase não erra a execução, usa efeito e procura deixar você sem jogada. O robô simula as tacadas no mesmo motor de física que você usa.</p>`
};
