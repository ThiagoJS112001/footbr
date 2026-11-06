# Interface e carreira

O guia de jogo e a ordem das entregas estão no [README principal](../../README.md).

A identidade oficial, os componentes e as regras para novas telas estão em
[DESIGN_SYSTEM.md](DESIGN_SYSTEM.md). As variáveis de tema ficam em `theme.css`;
Inter é incluída no bundle e todos os ícones usam Lucide.

- `store/gameStore.ts`: liga, clube escolhido, próxima rodada, seed e tela atual
  em Zustand, com escalação, carreira, partidas em andamento e ações de mercado/save. A seed aleatória vem de `crypto.getRandomValues`; a ação também
  aceita uma seed explícita para testes reproduzíveis.
- `screens/`: menu, escolha do clube/divisão, painel, elenco/ficha/histórico, escalação, partida/resumo, classificação, calendário, copa, mercado, base, diretoria, comparação, finanças e história.
- `components/`: layout, tabela genérica ordenável, tabela de classificação,
  cabeçalho, ícones e identificação visual dos clubes.
- `App.module.css` e `components/DataTable.module.css`: estilos isolados e layout
  responsivo. `global.css` define o tema e carrega fontes incluídas no bundle.

A UI importa APIs e tipos do motor. Ao criar um jogo, prepara duas divisões de
20 clubes. O fluxo prepara a escalação, chama `startCareerEvent`, avança minutos
com `stepRound` e confirma com `finishCareerEvent`. O próximo compromisso pode
ser liga ou copa; contas, mercado e diretoria avançam no momento correspondente. A ação
`advanceRound` mantém disponível a simulação direta para testes e ferramentas.

A navegação é local à store. Saves versionados ficam no `localStorage`, com
automático e três slots manuais comprimidos, além de exportação/importação JSON
e migração de v1 para v2. A retomada
da partida reconstrói a simulação até o minuto salvo e reaplica as decisões na
ordem em que ocorreram. Arquivos inválidos não substituem a carreira atual.

```sh
npm run dev
npm test
npm run build
```

`tests/ui/` cobre ordenação numérica/textual, seleção dos 20 clubes, filtro do
elenco, navegação, avanço de rodada, fim de temporada e proteção contra avanços
concorrentes. Componentes usam Testing Library com jsdom; os testes do motor
continuam rodando no ambiente Node.
