# Interface base

- `store/gameStore.ts`: liga, clube escolhido, próxima rodada, seed e tela atual
  em Zustand. A seed aleatória vem de `crypto.getRandomValues`; a ação também
  aceita uma seed explícita para testes reproduzíveis.
- `screens/`: menu, escolha do clube, painel, elenco, classificação e calendário.
- `components/`: layout, tabela genérica ordenável, tabela de classificação,
  cabeçalho, ícones e identificação visual dos clubes.
- `App.module.css` e `components/DataTable.module.css`: estilos isolados e layout
  responsivo. `global.css` define o tema e carrega fontes incluídas no bundle.

A UI apenas importa APIs e tipos do motor. Ao criar um jogo, prepara calendário
e classificação com as funções existentes. Cada avanço chama `playRound` com a
mesma seed, guarda o novo estado e atualiza a próxima rodada. Ao concluir a
temporada, mantém a rodada 38 e apresenta o campeão da classificação final.

A navegação é local à store. O jogo permanece em memória enquanto a aplicação
estiver aberta; persistência será implementada na etapa de save/load.

```sh
npm run dev
npm test
npm run build
```

`tests/ui/` cobre ordenação numérica/textual, seleção dos 20 clubes, filtro do
elenco, navegação, avanço de rodada, fim de temporada e proteção contra avanços
concorrentes. Componentes usam Testing Library com jsdom; os testes do motor
continuam rodando no ambiente Node.
