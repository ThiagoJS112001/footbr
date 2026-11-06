# Importação de dados do FootBR

## Iniciar

Use Node.js **22.19+**, que inclui `node:sqlite`, e execute:

```sh
npm install
npm run dev
```

O comando inicia Vite e backend. Use o endereço mostrado pelo Vite. O backend escuta apenas em `127.0.0.1`, porta 3001 por padrão. O Node 22 pode emitir um aviso de recurso experimental do SQLite; isso não impede a execução. Para usar a versão compilada, execute `npm run build` e depois `npm start`.

O jogo fictício e seus saves anteriores continuam funcionando. No menu inicial, abra **Importação de Dados · Base para nova carreira**. A tela administrativa fica fora da navegação principal da carreira.

## Testar sem chave

1. Abra **Importação de Dados**. O aviso **DEMONSTRAÇÃO FICTÍCIA** identifica este modo.
2. Selecione Brasil, Série A de demonstração e 2026. Clique em **Consultar clubes**.
3. Selecione os dois clubes ou apenas um. Importe e confira o progresso, os jogadores e os dados ausentes.
4. Opcionalmente, repita para a Série B e atribua-a à Divisão 2.
5. Em **Nova carreira com base importada**, selecione as bases para cada divisão. Ajuste os atributos de simulação se desejar.
6. Clique em **Criar carreira e escolher clube**, assuma um clube importado e abra **Elenco**.

Este fluxo usa os mesmos endpoints, banco, registros, snapshots e motor das importações reais. Nenhum nome de demonstração é apresentado como fato da API. Escudos alternativos e silhuetas são usados até que se cadastre uma imagem licenciada.

## Configurar API-Football

Copie `.env.example` para `.env` e preencha localmente:

```dotenv
API_FOOTBALL_KEY=sua_chave_configurada_localmente
FOOTBR_PORT=3001
FOOTBR_DATABASE=.data/footbr.sqlite
API_MIN_INTERVAL_MS=6500
```

Reinicie `npm run dev` ou `npm start`. O `.env`, o banco e os arquivos auxiliares do SQLite estão ignorados pelo Git. Nunca use `VITE_` no nome da chave nem coloque a chave em código, formulário, commit ou arquivo exportado. Também se aceita `APISPORTS_KEY` para configurações existentes. Sem ambas, o provedor é o de demonstração; uma chave inválida resulta em erro explícito e não em troca silenciosa para dados fictícios.

A integração utiliza a origem oficial `https://v3.football.api-sports.io/`, com `x-apisports-key` somente no backend. A configuração é para assinatura direta API-Sports, não para autenticação do intermediário RapidAPI.

Países, campeonatos e temporadas são consultados no provedor. O Brasil aparece inicialmente, com Série A e B priorizadas quando disponíveis. A lista não presume quais anos estão incluídos no seu plano. Outros campeonatos nacionais podem ser catalogados pelo mesmo fluxo; a divisão do FootBR é escolhida explicitamente na tela, sem inferir a hierarquia de uma liga internacional.

## O que é importado

| Entidade | Dados da fonte |
| --- | --- |
| Clube | ID externo, nome, abreviação/código, país, cidade, estádio, capacidade e referência do escudo |
| Jogador | ID externo, nome completo quando disponível, idade do perfil, nascimento, nacionalidade e referência da foto |
| Vínculo por temporada | Clube, jogador, posição e camisa disponíveis naquela consulta |
| Campeonato e temporada | ID externo da competição, país, nome, ano e indicação de temporada atual |

Campos ausentes continuam `null` e a interface mostra **Não informado**. A integração não importa avaliações de habilidade ou contratos reais. Os registros de contratos do catálogo mantêm valores desconhecidos; os contratos da carreira são gerados pelo jogo.

Para uma temporada atual, a integração consulta estatísticas paginadas, obtém o elenco atual em `players/squads` e complementa perfis ausentes com `players/profiles`. O campo `number` do elenco atual é priorizado. Se um perfil não trouxer nascimento ou nacionalidade, esses dados permanecem ausentes e há um aviso no resultado.

Para temporadas históricas, utiliza os participantes de `players?team&league&season&page`, sem misturar o elenco atual. Um jogador pode ter participado de dois clubes no mesmo ano. A tela de nova carreira exige escolher seu clube inicial e mantém os vínculos originais no catálogo. Elencos históricos não garantem a composição do clube em uma data específica. Idade de perfil pode refletir a data atual do provedor; a carreira calcula a idade para 12 de janeiro do ano escolhido quando existe nascimento. Sem nascimento em base histórica, usa a idade de simulação configurada, preservando a idade original da fonte separadamente.

## Atributos de simulação

A identidade importada fica em `identity.facts`. Os atributos usados pelo motor permanecem nos campos próprios do jogador. Força, potencial, ataque, meio-campo/habilidade técnica, defesa, goleiro, velocidade, passe, finalização, resistência, condição e moral são **simulação do FootBR**, não avaliações reais do atleta. Salário, duração do contrato, valor de mercado, reputação, orçamento e preço do ingresso também são parâmetros fictícios.

É possível configurar a faixa de força-alvo, bônus de potencial, condição, moral, idade desconhecida e semente. Os atributos técnicos respeitam o intervalo já adotado pelo motor, **1–99**. Condição e moral usam até 100. A geração é reproduzível por semente e ID interno; os mesmos dados e configuração geram as mesmas habilidades em carreiras diferentes. Os IDs das carreiras e de seus jogadores continuam distintos.

Posições genéricas como Defender, Midfielder e Attacker são distribuídas em funções táticas para a escalação; a posição da fonte é preservada. O jogo bloqueia elencos com menos de 18, mais de 60 jogadores ou sem cobertura para o 4-4-2 inicial. Não cria atletas supostamente reais para preencher lacunas. Idades incompatíveis com os limites do motor usam o parâmetro de idade, com indicação nos metadados.

O formato do motor permanece em **duas divisões de 20 clubes**, 38 rodadas e copa própria. Importe até 20 clubes por divisão. Uma base parcial é completada com clubes inteiramente fictícios, com contagens e rótulos explícitos antes e depois de iniciar. Bases das duas divisões devem ser do mesmo ano. Calendários e regulamentos são gerados pelo FootBR; não reproduzem partidas oficiais da API.

## Persistência e isolamento

O SQLite normaliza `competitions`, `seasons`, `clubs`, `players`, `season_clubs`, `rosters` e `roster_contracts`. UUIDs internos são independentes dos identificadores externos. A chave única `(provider, external_id)` evita duplicação entre reimportações. Um jogador pode ter vários vínculos históricos sem ser duplicado no cadastro.

Cada clube e seu elenco são atualizados em uma transação. Uma resposta vazia, inválida ou com paginação interrompida preserva o último elenco completo. Uma base com poucos jogadores pode ser catalogada para revisão, mas não é aceita como elenco pronto para carreira.

Ao criar uma carreira, o servidor monta um snapshot profundo e imutável do catálogo e da configuração, gera o mundo e grava `career_snapshots`, `careers` e `career_players`. Esses registros são a **cópia inicial**, não o progresso contínuo. O jogo recebe outra cópia e usa os slots locais já existentes para salvar partidas, negociações e temporadas. Não há caminho de escrita do motor para as tabelas do catálogo. Uma atualização de clubes, perfis ou imagens só entra em carreiras criadas posteriormente.

Faça backup de `.data` para preservar catálogo e arquivos licenciados. Exporte os saves no jogo para preservar o progresso. O JSON do save contém referências de imagens, não seus bytes; ao levá-lo para outra instalação sem o mesmo banco, as imagens usam fallback. Mantenha a mesma origem/endereço do navegador para acessar os slots locais existentes.

## Cache, cotas, erros e retomada

Requisições são serializadas, com intervalo mínimo padrão de 6,5 segundos. O limite por minuto retornado pelo provedor pode aumentar esse intervalo. Cabeçalhos de cotas diária e por minuto e `Retry-After` são considerados; pausas são persistidas por uma impressão digital da credencial, sem armazenar a chave no banco. Quando a cota termina, a importação para e pode ser retomada após a renovação. Não há ciclos automáticos insistindo em uma API bloqueada.

Respostas válidas ficam em cache por 24 horas; perfis adicionais, por sete dias. Páginas concluídas permanecem em cache após falhas de conexão. A opção de ignorar o cache permite atualizar imediatamente, consumindo novas chamadas. O painel de progresso consulta apenas registros locais, sem gastar cota do provedor. Uma importação completa pode exigir dezenas de chamadas, especialmente para jogadores sem estatísticas naquela temporada.

Os trabalhos guardam o estado de cada clube. Em caso de encerramento do servidor, ficam como **Interrompida** no próximo início. Use **Retomar pendências e erros**: clubes concluídos são preservados e clubes pendentes ou com erro são tentados novamente. Os eventos de cada tentativa ficam em `import_events`, inclusive erros anteriores que já foram resolvidos. O botão **Ver histórico de tentativas** apresenta esses registros.

Se o provedor estiver indisponível, os catálogos e registros locais continuam consultáveis pelo backend. Saves em andamento não dependem de consultas à API.

## Escudos, fotos e licenças

Referências externas são preservadas, mas imagens sem autorização informada não são carregadas automaticamente. A disponibilidade de uma imagem na API não comprova direitos comerciais. Veja os [termos de dados e imagens da API-Football](https://www.api-football.com/terms).

No catálogo, escolha **Imagem do clube** ou clique no nome de um jogador para editar sua foto. Informe a referência da licença/autorização, confirme o direito de uso e:

- Envie um arquivo próprio PNG, JPEG ou WebP de até 2 MB; ou
- Habilite a imagem da fonte quando sua autorização permitir. Nesse caso, o backend obtém uma cópia local após a confirmação.

As imagens autorizadas são armazenadas com IDs imutáveis no SQLite. A referência original e a licença informada permanecem registradas. Alterar a imagem do catálogo não substitui os arquivos já referenciados por uma carreira. Falhas de rede ou de decodificação exibem escudos alternativos e silhuetas. Não se exige uma imagem para importar ou jogar.

## Endpoints locais

| Método | Caminho | Uso |
| --- | --- | --- |
| GET | `/api/status` | Modo, cotas e trabalho em andamento; nunca a chave |
| GET | `/api/countries` | Países disponíveis |
| GET | `/api/competitions?country=Brazil` | Competições e temporadas |
| GET | `/api/teams?league=71&year=2026` | Prévia dos clubes; disponibilidade depende do plano |
| GET / POST | `/api/imports` | Registros / criação do trabalho |
| POST | `/api/imports/:id/resume` | Retomar pendências |
| GET | `/api/imports/:id/events` | Histórico de tentativas |
| GET | `/api/catalog` | Bases persistidas |
| POST | `/api/careers` | Copiar base e iniciar nova carreira |
| POST | `/api/images/:id` | Arquivo próprio, autorização ou fallback |
| GET | `/api/media/:id` | Imagem local licenciada |

O backend é local e não implementa contas de usuários. Alterações entre origens distintas são recusadas; não há CORS aberto. O proxy de desenvolvimento preserva a origem da interface. Para hospedagem pública seria necessário um projeto específico de autenticação e controle administrativo.

## Validação

```sh
npm test
npm run build
```

Os testes de integração importam dois clubes, verificam upserts e campos ausentes, contratos desconhecidos, geração configurável, criação de carreira, negociação isolada, atualização posterior do catálogo, persistência, retomada após reinício, cache paginado, limites e erros do provedor. O teste HTTP executa os endpoints reais locais e o ciclo de imagem licenciada. Os testes da interface percorrem a seleção, importação e criação de carreira, além de exercitar os fallbacks. As respostas da API real são controladas nos testes: nenhuma chamada paga é necessária.

Referências primárias: [documentação API-Football](https://www.api-football.com/documentation_v3), [elencos atuais](https://www.api-football.com/news/post/football-players-squads), [limites de requisições](https://www.api-football.com/news/post/how-ratelimit-works).
