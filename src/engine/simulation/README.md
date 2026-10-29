# Motor de partida

`simulateMatch(home, away, seed)` recebe dois `MatchTeam`: os campos de `Team`
mais `lineup` (`starterIds`, `substituteIds`, `tactic`). São exigidos 11 titulares,
um goleiro, IDs sem repetição e formação com 10 jogadores de linha. Titulares e
reservas precisam estar no elenco e sem lesão prévia. Cada time tem ID distinto.

Retorna um `MatchResult` finalizado, com placar, escalações iniciais, eventos em
ordem de minuto e estatísticas. Não altera os times recebidos. Expulsões e lesões
afetam apenas o estado local da partida; persistir suas consequências na temporada
fica para as etapas seguintes.

As forças usam atributos dos jogadores ativos, ponderados por posição, moral,
condição física, formação e marcação. Um jogador removido deixa de contribuir;
o denominador da força permanece o da escalação inicial. Sem goleiro, o melhor
atributo de goleiro dos jogadores restantes representa um goleiro improvisado.

O estilo ofensivo aumenta a chance de finalizar e a exposição a finalizações.
O defensivo reduz ambas. Reservas entram automaticamente por posição principal
em caso de lesão, até cinco substituições. Sem reserva compatível, o time segue
com um jogador a menos. Expulsos não são substituídos.

Cada minuto tem uma posse e no máximo uma finalização. Escanteios são contados
como consequência de uma defesa ou chute bloqueado/desviado; não geram um lance
extra. O xG aproximado soma, por chute, a chance de acertar o alvo multiplicada
pela chance de superar o goleiro. Posse é a porcentagem dos 90 minutos de posse.

Todos os parâmetros de balanceamento estão em `config.ts`. Um quarto argumento
opcional permite passar outra configuração sem alterar a configuração global.

`npm run sim-match -- 42` executa a demonstração com seed 42 (padrão: 2026).
`npm test -- --reporter=verbose --silent=false` mostra as tabelas das baterias
de 1.000 partidas. A bateria de +15 usa elencos equivalentes, adiciona 15 pontos
aos atributos e alterna o mando; a de iguais mantém o mandante fixo.
