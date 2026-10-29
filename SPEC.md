# SPEC: Jogo de Gerenciamento de Futebol (estilo Brasfoot, moderno)

## 1. Visão geral

Jogo de gerenciamento de futebol para PC. O jogador assume um clube, define escalação e tática, negocia jogadores, controla finanças e disputa temporadas completas. Foco em dados, simulação e uma interface moderna, sem gráficos de partida complexos.

**Todos os times, jogadores e escudos são FICTÍCIOS** (evita problemas de licença). O jogo deve permitir bancos de dados editáveis (mods) no futuro.

## 2. Stack técnica

- TypeScript + Vite
- React para a interface
- Vitest para testes
- Zustand para estado global
- Persistência: IndexedDB (via `idb`) ou arquivo JSON de save
- Empacotamento futuro para PC: Tauri

## 3. Arquitetura (regra principal)

O projeto é dividido em duas camadas independentes:

```
src/
  engine/        # lógica pura do jogo, SEM React e SEM acesso ao DOM
    models/      # tipos: Player, Team, Match, League, Season, Finance
    generators/  # gerador de nomes, jogadores e times fictícios
    simulation/  # motor de partida
    league/      # calendário, classificação, rebaixamento
    market/      # transferências, contratos, valores
    ai/          # decisões dos times controlados pelo computador
    save/        # serialização do jogo
  ui/            # React: telas, componentes, estado
  data/          # bancos de dados editáveis (JSON)
tests/
```

**Regra:** a pasta `engine/` nunca importa nada de `ui/`. O motor deve poder rodar em um script de terminal.

## 4. Modelos de dados

**Player**: id, nome, idade, nacionalidade, posição principal e secundária, atributos (ataque, meio, defesa, goleiro, velocidade, passe, finalização, fôlego, de 1 a 99), overall calculado, moral, condição física, lesão, contrato (salário, anos restantes), valor de mercado, time atual.

**Team**: id, nome, cidade, divisão, elenco, orçamento, folha salarial, reputação, estádio (capacidade, preço do ingresso), tática padrão.

**Tactic**: formação (4-4-2, 4-3-3, 3-5-2, etc.), estilo (defensivo, equilibrado, ofensivo), intensidade de marcação.

**Match**: mandante, visitante, escalações, placar, lista de eventos (gol, cartão, lesão, substituição), estatísticas (posse, finalizações, xG).

**League**: nome, times, calendário, tabela, regras de acesso e rebaixamento.

## 5. Regras do motor de simulação

- A partida é simulada em 90 minutos, em passos de 1 minuto (ou por lances).
- A cada passo, calcula-se qual time ataca com base na força de meio-campo, tática e moral.
- A chance de finalização, a qualidade do chute e a defesa do goleiro dependem dos atributos dos jogadores envolvidos.
- Mandante tem pequena vantagem.
- Resultados devem ter aleatoriedade: time muito mais forte vence com frequência, mas o azarão pode vencer.
- Eventos: gols, cartões amarelos e vermelhos, lesões, substituições.
- O motor deve aceitar uma **seed** para resultados reproduzíveis (importante para testes).

**Critérios de balanceamento (testados automaticamente):**
- Em 1.000 partidas, o time com overall médio 15 pontos maior vence mais de 60% e menos de 85%.
- Média de gols por partida entre 2,2 e 3,0.
- Empates entre 20% e 30%.

## 6. Campeonatos

- Pontos corridos (turno e returno) com tabela, saldo e critérios de desempate.
- Copa mata-mata (ida e volta ou jogo único, com pênaltis).
- Múltiplas divisões com acesso e rebaixamento.
- Calendário gerado automaticamente (algoritmo round-robin).

## 7. Mercado e finanças

- Valor de mercado calculado por overall, idade e potencial.
- Propostas de compra/venda com negociação (a IA aceita, recusa ou contrapropõe).
- Contratos: salário, duração, renovação.
- Receitas: bilheteria, patrocínio, premiação, venda de jogadores.
- Despesas: salários, manutenção do estádio, compras.
- Janelas de transferência.

## 8. IA dos times do computador

- Escolhe a melhor escalação disponível para a formação.
- Contrata e vende jogadores conforme necessidade e orçamento.
- Renova contratos de jogadores importantes.

## 9. Telas da interface

1. Menu inicial (novo jogo, carregar, configurações)
2. Escolha do clube
3. Painel principal (próximo jogo, notícias, finanças resumidas)
4. Elenco (tabela ordenável e filtrável)
5. Escalação e tática
6. Partida (placar ao vivo com eventos em texto)
7. Classificação e calendário
8. Mercado de transferências
9. Finanças
10. Fim de temporada (resumo, premiações)

**Estilo visual:** moderno, tema escuro opcional, tabelas limpas, gráficos simples (evolução de desempenho, finanças), navegação por barra lateral.

## 10. Roteiro de desenvolvimento

Siga as etapas na ordem. Só avance quando a anterior estiver funcionando e com testes passando.

| Etapa | Entrega |
|-------|---------|
| 1 | Setup do projeto, modelos de dados |
| 2 | Gerador de times e jogadores fictícios |
| 3 | Motor de simulação de partida + testes de balanceamento |
| 4 | Liga com calendário e classificação (rodando no terminal) |
| 5 | Interface básica: escolha do clube, elenco, classificação |
| 6 | Tela de escalação/tática e partida |
| 7 | Save/load |
| 8 | Mercado de transferências e contratos |
| 9 | Finanças |
| 10 | Copas, múltiplas divisões e fim de temporada |
| 11 | Polimento visual e empacotamento com Tauri |

---

# Prompts prontos para colar na IA (em ordem)

> Antes de cada prompt, diga: "Leia o SPEC.md antes de começar."

**Prompt 1 (setup e modelos)**
> Crie o projeto com Vite + TypeScript + Vitest seguindo a estrutura do SPEC.md. Implemente apenas os tipos e interfaces em `engine/models` (Player, Team, Tactic, Match, League). Sem interface ainda. Faça um commit ao final.

**Prompt 2 (geradores)**
> Implemente em `engine/generators` um gerador de nomes fictícios e uma função `generateTeam(seed)` que cria um time com 25 jogadores (posições balanceadas, atributos coerentes com a posição, idades entre 17 e 36). Use um gerador de números aleatórios com seed. Escreva testes.

**Prompt 3 (motor de partida)**
> Implemente em `engine/simulation` a função `simulateMatch(home, away, seed)` seguindo a seção 5 do SPEC.md. Retorne placar, eventos e estatísticas. Depois escreva um teste que roda 1.000 partidas e valida os critérios de balanceamento do SPEC. Se falharem, ajuste os parâmetros do motor.

**Prompt 4 (liga)**
> Implemente em `engine/league` o gerador de calendário round-robin, a tabela de classificação com critérios de desempate e uma função que simula uma temporada completa de 20 times. Crie um script `npm run sim-season` que imprime a tabela final no terminal.

**Prompt 5 (interface base)**
> Adicione React e Zustand. Crie a navegação com barra lateral e as telas: escolha do clube, elenco (tabela ordenável) e classificação. Use o motor existente sem alterá-lo. Visual moderno e tema escuro.

**Prompt 6 (escalação e partida)**
> Crie a tela de escalação (escolher 11 titulares e reservas, trocar formação e estilo) e a tela de partida, que mostra o placar e os eventos minuto a minuto. Adicione botão de avançar para o próximo jogo.

**Prompt 7 (save/load)**
> Implemente salvar e carregar o jogo (estado completo da temporada), com múltiplos slots. Teste que salvar e carregar resulta no mesmo estado.

**Prompt 8 (mercado)**
> Implemente o mercado de transferências: lista de jogadores à venda, propostas, resposta da IA (aceita, recusa, contraproposta) e atualização de elenco e orçamento. Inclua a tela correspondente.

**Prompt 9 (finanças)**
> Implemente receitas e despesas por rodada, a tela de finanças com gráfico de saldo ao longo da temporada e regras para quando o clube fica no vermelho.

**Prompt 10 (copas e divisões)**
> Adicione copa mata-mata com pênaltis, segunda divisão, acesso e rebaixamento, e a tela de fim de temporada.

---

## Dicas para o teste com IA

- Faça `git commit` após cada etapa que funcionar.
- Peça sempre: "rode os testes e corrija o que falhar antes de terminar".
- Se a IA mudar coisas demais, diga: "altere somente os arquivos necessários e explique o que mudou".
- Quando algo quebrar, cole o erro completo na conversa.
- Anote o que a IA acertou e errou em cada etapa. Isso é o resultado do seu teste.
