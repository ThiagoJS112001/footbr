# Campeonato

A camada [career](../career/README.md) coordena duas divisões, copa, economia,
mercado, diretoria e transições. Este módulo mantém a simulação isolada da liga.
O terceiro argumento opcional de `autoPickLineup` considera condição física
para rotação; escalações preferidas continuam preservando escolhas elegíveis.

```ts
import { generateLeague } from '../generators/league.ts';
import { autoPickLineup, playRound, simulateSeason } from './index.ts';

const league = generateLeague(2026, 20);
const lineup = autoPickLineup(league.teams[0]);
const next = playRound(league, 42);
const season = simulateSeason(next, 42);
```

As funções preservam o estado recebido. `playRound` prepara o calendário quando
ele está vazio e joga a próxima rodada. `simulateSeason` também continua uma liga
parcialmente disputada e retorna `league`, `standings`, `topScorers` e `matches`.
Use a mesma seed de temporada em cada chamada para obter a mesma continuação.

`generateSchedule(teamIds)` usa o círculo, com returno espelhado. Quantidades
ímpares têm folgas. Para 20 clubes são 38 rodadas de 10 partidas, com no máximo
três mandos consecutivos iguais, inclusive na passagem para o returno.

`calculateStandings(league, seed)` recalcula a tabela a partir das partidas
finalizadas: pontos, vitórias, saldo e gols pró; depois, uma minitabela de pontos,
saldo e gols pró dos clubes ainda empatados; por fim, sorteio reproduzível. Não
usa comparação par a par para empates múltiplos. `position`, `qualified` e
`relegated` indicam a situação atual, provisória até o final. Em ligas de 20
clubes, as zonas dependem das regras da liga. A camada `career` cria duas
divisões, com quatro acessos e quatro rebaixamentos na virada da temporada.

`autoPickLineup(team)` resolve a atribuição ótima dos atletas às posições da
formação, incluindo posições secundárias com desconto de 10%. A posição ocupada
é enviada ao motor em `lineup.positions`. Lesionados e suspensos ficam fora dos
titulares e do banco. Formações suportadas têm três ou quatro linhas, de um a
cinco defensores/meias, até quatro atacantes e, quando houver, até quatro meias
avançados. A soma deve ser dez, além do goleiro.

`autoPickLineup(team, preferred)` preserva os titulares elegíveis da escalação
anterior e repõe os desfalques. `validateLineup` valida uma escalação manual.
`playRound(league, seed, lineups)` aceita escalações por ID de clube. Para jogos
acompanhados, `startRound`, `stepRound` e `finishRound` usam as mesmas seeds e
regras do avanço direto. Resultados incompletos não podem confirmar a rodada.

`getPlayerSeasonStats` soma jogos, minutos e gols a partir das escalações e dos
eventos, inclusive substituições e saídas por lesão/expulsão. A artilharia guarda
o nome no evento do gol e mantém o clube de origem após transferências.

Sem onze jogadores elegíveis nas posições necessárias, `autoPickLineup` lança
`LineupUnavailableError`. O campeonato registra W.O. de 3–0 para o adversário;
se ambos não puderem jogar, registra 0–0. Esses resultados valem para a tabela,
mas não geram eventos de gol nem crédito para artilheiros.

Vermelho e três amarelos acumulados geram uma partida de suspensão. A contagem
de amarelos volta a zero ao atingir três; amarelos de uma expulsão também contam.
Se ambas as punições ocorrerem na mesma partida, vale uma suspensão, sem somar.
Suspensões antigas diminuem após o próximo jogo do clube; folgas não contam.
Punições novas ficam para o jogo seguinte.

Entre rodadas, lesões antigas recuperam sete dias e a condição física recupera
18 pontos. Participantes gastam até 22 pontos, proporcionalmente aos minutos em
campo. Lesões novas recebem de 7 a 28 dias e começam a recuperar na próxima
rodada. Tudo fica no novo estado da liga. Parâmetros em `config.ts`.

```sh
npm run sim-season
npm run sim-season -- --seed 2026 --seasons 20
```

O modo múltiplo reinicia os mesmos elencos em cada temporada, variando apenas a
seed da simulação. Imprime a tabela e os cinco artilheiros da última temporada,
além das frequências por clube. G4 inclui o campeão.
