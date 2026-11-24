# FootBR

Jogo de gerenciamento de futebol em React e TypeScript, com base fictícia e importação opcional de identidades reais pela API-Football. Foco em temporadas rápidas e decisões de escalação, tática e mercado.

A interface segue a identidade visual oficial FootBR: azul-marinho, verde, Inter e ícones Lucide. O [design system](src/ui/DESIGN_SYSTEM.md) registra os componentes e as regras para manter todas as telas consistentes.

```sh
npm install
npm run dev
npm test
npm run build
```

Requer **Node.js 22.19 ou superior**. `npm run dev` inicia a interface e o backend local de importação. Sem chave, **Importação de Dados**, no menu inicial, oferece dois clubes fictícios por divisão para testar o fluxo completo. **Novo jogo** continua usando a base fictícia original.

## Aplicativo para Windows

Execute `FootBR-Setup.exe` e abra **FootBR** pelo menu Iniciar. A carreira fictícia funciona offline em uma janela própria. Para gerar o instalador a partir do código, execute `npm ci` e `npm run installer:windows` no Windows. O instalador x64 fica em `out/make/squirrel.windows/x64/FootBR-Setup.exe`. Para executar a edição desktop durante o desenvolvimento, use `npm run desktop`.

Os saves automáticos e manuais ficam em `%APPDATA%\FootBR\saves`, e o catálogo em `%APPDATA%\FootBR\footbr.sqlite`. Para trazer uma carreira do navegador, carregue-a lá, clique em **Exportar save** e use **Importar save** no aplicativo. A importação atualiza o slot automático. Para migrar vários slots, depois de cada importação escolha o slot correspondente e clique em **Salvar**.

Para importar dados reais no aplicativo, crie `%APPDATA%\FootBR\.env` com `API_FOOTBALL_KEY` e reinicie o jogo. A importação de dados reais usa internet.

Para dados reais, copie [.env.example](.env.example) para `.env`, preencha `API_FOOTBALL_KEY` somente nesse arquivo e reinicie o servidor. Consulte o [guia de importação](docs/IMPORTACAO.md) para configurar temporadas, imagens e atributos. Depois de `npm run build`, `npm start` serve a interface e a API em `http://127.0.0.1:3001`.

## Mudanças, por prioridade

1. **Escalação e tática:** 11 titulares por posição, escolha dos reservas, cinco formações, postura e marcação. Escalação automática opcional; suas escolhas são mantidas entre rodadas, com reposição dos desfalques.
2. **Partida com decisões:** simulação minuto a minuto, pausa, velocidades 1×/2×/5×, cinco substituições e mudança de postura. Os outros jogos da divisão avançam junto. “Simular até o fim” usa o mesmo motor, a partir do minuto atual.
3. **Salvar e continuar:** automático, três slots, exportação/importação JSON e migração dos saves anteriores. Partidas da liga ou copa retomam no mesmo minuto, com escalações e decisões preservadas. O armazenamento local é comprimido para acomodar carreiras mais longas.
4. **Mercado ativo e finanças:** a IA contrata por necessidade e envia propostas pelos seus jogadores, sem vender ninguém sem aceite. Janelas 1–4 e 20–23. Extrato, projeção de quatro semanas, reserva sugerida de salários, bilheteria líquida, patrocínio, manutenção, juros e premiação.
5. **Copa e carreira contínua:** 60 clubes em três divisões, com quatro acessos e rebaixamentos entre divisões vizinhas. A temporada abre com um estadual de quatro clubes. A copa nacional tem seis etapas, e a partir da segunda temporada há duas copas continentais. Evolução por idade, potencial e minutos jogados, aposentadorias e contratos. Histórico de campanhas, recordes, transferências e estatísticas individuais.
6. **Diretoria e base:** avaliações podem resultar em demissão; três propostas permitem continuar em outro clube do mesmo mundo. Cinco jovens por temporada, com avaliação de potencial e até três promoções escolhidas pelo técnico.
7. **Decisões rápidas:** resumo após cada jogo, análise factual de táticas/expulsões/substituições, comparação de jogadores e preservação de filtros, fichas e propostas durante a navegação.

## Como jogar

Escolha a divisão e o clube. Na **Central do Clube**, ajuste titulares, formação e postura e clique em **Jogar rodada** para ver placar, gols, desfalques e posição na liga. Para acompanhar minuto a minuto, use **Acompanhar ao vivo**. Em **Preparar partida**, você também pode escolher reservas e intensidade da marcação.

Na preparação, o **Relatório do adversário** usa até os cinco últimos jogos disponíveis da liga para mostrar formação, marcação inicial e finalizações por tempo. Após a partida, a análise compara as finalizações a favor e contra em intervalos de até 15 minutos de cada lado de trocas e mudanças de postura.

Na Central, **J** joga uma rodada. Durante a partida ao vivo, **Espaço** pausa ou retoma, e **1**, **2** ou **5** ajustam a velocidade. **Simular até a próxima decisão** para diante de uma proposta pendente, clássico, jogo de copa, avaliação da diretoria ou fim de temporada. Use **Jogar rodada** para passar individualmente por um jogo que acionou a pausa.

No elenco, clique no nome para ver atributos, estatísticas de cada temporada, títulos e contrato. Use **Comparar jogadores** antes de trocar um titular ou contratar. Renove contratos antes de começar outra temporada: atletas sem renovação ficam livres. No mercado, clique no nome para negociar e consulte as propostas recebidas.

No menu inicial, abra o **Editor de clubes e elencos** para alterar o nome dos clubes e o nome, a idade, a posição e a força dos jogadores na base fictícia. Você pode importar ou exportar a base em JSON e usá-la em uma nova carreira.

A copa nacional entra no fluxo de **Avançar** após as rodadas 4, 8, 14, 20, 28 e 36. O campeão da copa nacional e os primeiros colocados da Divisão 1 se classificam para as continentais do ano seguinte. Cada continental tem quatro classificados nacionais e quatro convidados fictícios. Etapas sem seu clube são resolvidas automaticamente. Quando participa, prepare a escalação normalmente e considere poupar titulares.

Em **Categorias de Base**, avaliar custa R$ 5 mil e revela uma faixa estimada de potencial e um parecer sobre espaço no elenco. Promover custa dois salários em luvas, com contrato de três anos. É possível promover sem avaliar, assumindo a incerteza. A diretoria faz a primeira avaliação após oito rodadas no cargo e depois a cada quatro. Confiança em 15% ou menos encerra o vínculo; continue pela tela **Diretoria**, escolhendo um novo emprego.

## Ritmo e identidade

- **Jogar direto:** a central oferece “Jogar rodada” e “Acompanhar ao vivo”. A preparação mostra titulares cansados, desfalques repostos e falta de reservas. No resultado, “Preparar próximo jogo” evita o retorno obrigatório ao painel.
- **Três planos salvos por clube:** Principal, Reserva e Copa guardam formação, postura, marcação, titulares e banco. Salve suas escolhas na escalação e reaplique quando quiser; atletas indisponíveis ou que saíram do clube são repostos quando possível.
- **Especialidades:** velocista, armador, finalizador, polivalente e líder têm efeitos e contrapartidas no motor, explicados no elenco, na comparação e no mercado. A força geral continua sendo apenas parte da decisão. A condição diminui durante a partida conforme o fôlego.
- **Partida expressiva:** finalizações para fora, defesas, chances claras e pressão são narradas a partir dos chutes reais do motor. É possível filtrar os eventos principais. A classificação provisória usa os placares da rodada sem alterar a tabela oficial.
- **Mercado:** observe até 100 jogadores e acompanhe mudanças de valor ou clube em relação ao momento da observação. Reputação e concorrência pela posição podem aumentar o salário pedido. O painel detalha transferência, salário, saldo e custo total. Ofertas recebidas admitem uma contraproposta e continuam exigindo aceite para vender.
- **Empréstimos:** a lista de disponíveis reúne reservas com concorrência mais forte na posição. A taxa é de 5% do valor de mercado, o clube comprador assume o salário integral e mantém dois salários reservados para concluir a operação. O retorno ocorre ao começar a próxima temporada, antes de atualizar contratos e idades. Jogadores emprestados não podem ser vendidos, renovados ou emprestados novamente; vagas de retorno permanecem reservadas no clube de origem.
- **Clubes com perfil:** formadores recebem jovens com maior margem de evolução, priorizam desenvolvimento nas compras da IA e ganham confiança por dar minutos aos sub-21. Tradicionais têm metas mais exigentes e priorizam reforços prontos; clubes de torcida têm maior procura nos clássicos. Rivalidades da cidade e de decisões de liga/copa persistem na carreira.
- **Memória:** História e fichas guardam estreias, primeiros gols, transferências, reencontros e títulos. Os títulos são arquivados ao iniciar a temporada seguinte; as estatísticas da temporada atual continuam disponíveis. Atletas promovidos mantêm seu clube formador.

Os novos sistemas são acrescentados aos saves anteriores sem recriar resultados. Partidas antigas em andamento mantêm o motor anterior até o apito final; a próxima partida já usa as novas regras. Saves atuais registram a versão do motor utilizada na partida.

O progresso dos saves fica no armazenamento local do navegador. O catálogo importado, imagens licenciadas, cache, registros e cópias iniciais das carreiras ficam no SQLite local, em `.data/footbr.sqlite`. Alterações durante o jogo não são gravadas no catálogo. O menu e o painel de saves permitem escolher slots e exportar cópias. Se o navegador bloquear o armazenamento ou atingir a cota, o jogo informa a falha e mantém a exportação disponível. Limpar os dados do navegador remove os saves locais; o banco não substitui um backup do progresso.

Saves de duas divisões conservam seu formato ao carregar e avançar de temporada. A migração mantém dinheiro, elencos, resultados e partidas em andamento. Em saves antigos de temporadas já iniciadas, a copa começa na temporada seguinte. Estatísticas individuais antigas que nunca foram registradas não são inventadas; os novos registros começam com os dados disponíveis.

## Organização

- `src/engine/simulation`: motor puro, incremental e reproduzível por seed.
- `src/engine/league`: calendário, escalações, classificação e efeitos das partidas.
- `src/engine/career`: economia, negociação e transição entre temporadas/divisões.
- `src/engine/save`: formato versionado e validação de saves.
- `src/ui`: telas e store; persistência no navegador fica nesta camada.
- `src/data`: contratos do catálogo e configuração dos atributos simulados.
- `server`: API local, integração API-Football, SQLite, cache e importações retomáveis.
- `src/engine/career/imported.ts`: transformação de uma cópia do catálogo em uma carreira independente.

O motor continua independente de React e DOM. As demonstrações `npm run sim-match` e `npm run sim-season` continuam disponíveis; a segunda testa uma liga isolada, enquanto a interface coordena a carreira com três divisões e finanças.

As regras e os cenários de teste estão em [src/engine/career/README.md](src/engine/career/README.md).

## Evoluções opcionais

Playtests mais longos podem orientar novos ajustes de dificuldade e economia. A filosofia permanece: poucas decisões claras, consequências visíveis e temporadas rápidas.
