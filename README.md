# FootBR

Jogo de gerenciamento de futebol em React e TypeScript, com clubes e jogadores fictícios. Foco em temporadas rápidas e decisões de escalação, tática e mercado.

A interface segue a identidade visual oficial FootBR: azul-marinho, verde, Inter e ícones Lucide. O [design system](src/ui/DESIGN_SYSTEM.md) registra os componentes e as regras para manter todas as telas consistentes.

```sh
npm install
npm run dev
npm test
npm run build
```

## Mudanças, por prioridade

1. **Escalação e tática:** 11 titulares por posição, escolha dos reservas, cinco formações, postura e marcação. Escalação automática opcional; suas escolhas são mantidas entre rodadas, com reposição dos desfalques.
2. **Partida com decisões:** simulação minuto a minuto, pausa, velocidades 1×/2×/5×, cinco substituições e mudança de postura. Os outros jogos da divisão avançam junto. “Simular até o fim” usa o mesmo motor, a partir do minuto atual.
3. **Salvar e continuar:** automático, três slots, exportação/importação JSON e migração dos saves anteriores. Partidas da liga ou copa retomam no mesmo minuto, com escalações e decisões preservadas. O armazenamento local é comprimido para acomodar carreiras mais longas.
4. **Mercado ativo e finanças:** a IA contrata por necessidade e envia propostas pelos seus jogadores, sem vender ninguém sem aceite. Janelas 1–4 e 20–23. Extrato, projeção de quatro semanas, reserva sugerida de salários, bilheteria líquida, patrocínio, manutenção, juros e premiação.
5. **Copa e carreira contínua:** 40 clubes, duas divisões, quatro acessos/rebaixamentos e copa em seis etapas, com pênaltis e desgaste adicional. Evolução por idade, potencial e minutos jogados, aposentadorias e contratos. Histórico de campanhas, recordes, transferências e estatísticas individuais.
6. **Diretoria e base:** avaliações podem resultar em demissão; três propostas permitem continuar em outro clube do mesmo mundo. Cinco jovens por temporada, com avaliação de potencial e até três promoções escolhidas pelo técnico.
7. **Decisões rápidas:** resumo após cada jogo, análise factual de táticas/expulsões/substituições, comparação de jogadores e preservação de filtros, fichas e propostas durante a navegação.

## Como jogar

Escolha a divisão e o clube. No painel, clique em **Preparar partida**, ajuste os titulares e o banco e clique em **Jogar partida**. Durante o jogo, pause para substituir ou mudar a postura. Ao terminar, confira a tabela e as contas antes de preparar a próxima rodada.

No elenco, clique no nome para ver atributos, estatísticas de cada temporada, títulos e contrato. Use **Comparar jogadores** antes de trocar um titular ou contratar. Renove contratos antes de começar outra temporada: atletas sem renovação ficam livres. No mercado, clique no nome para negociar e consulte as propostas recebidas.

A copa entra no fluxo de **Avançar** após as rodadas 4, 8, 14, 20, 28 e 36. Etapas sem seu clube são resolvidas automaticamente. Quando participa, prepare a escalação normalmente e considere poupar titulares.

Em **Categorias de Base**, avaliar custa R$ 5 mil e revela o teto de evolução. Promover custa dois salários em luvas, com contrato de três anos. É possível promover sem avaliar, assumindo a incerteza. A diretoria faz a primeira avaliação após oito rodadas no cargo e depois a cada quatro. Confiança em 15% ou menos encerra o vínculo; continue pela tela **Diretoria**, escolhendo um novo emprego.

Os saves ficam no armazenamento local do navegador, sem servidor. O menu e o painel de saves permitem escolher slots e exportar cópias. Se o navegador bloquear o armazenamento ou atingir a cota, o jogo informa a falha e mantém a exportação disponível. Limpar os dados do navegador remove os saves locais.

A migração mantém dinheiro, elencos, resultados e partidas em andamento. Em saves antigos de temporadas já iniciadas, a copa começa na temporada seguinte. Estatísticas individuais antigas que nunca foram registradas não são inventadas; os novos registros começam com os dados disponíveis.

## Organização

- `src/engine/simulation`: motor puro, incremental e reproduzível por seed.
- `src/engine/league`: calendário, escalações, classificação e efeitos das partidas.
- `src/engine/career`: economia, negociação e transição entre temporadas/divisões.
- `src/engine/save`: formato versionado e validação de saves.
- `src/ui`: telas e store; persistência no navegador fica nesta camada.

O motor continua independente de React e DOM. As demonstrações `npm run sim-match` e `npm run sim-season` continuam disponíveis; a segunda testa uma liga isolada, enquanto a interface coordena a carreira com duas divisões e finanças.

As regras e os cenários de teste estão em [src/engine/career/README.md](src/engine/career/README.md).

## Evoluções opcionais

Playtests mais longos podem orientar novos ajustes de dificuldade e economia. Empréstimos, rivalidades, mods e distribuição com Tauri continuam fora desta entrega. A filosofia permanece: poucas decisões claras, consequências visíveis e temporadas rápidas.
