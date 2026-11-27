# Carreira FootBR

Funções puras, sem React, DOM ou armazenamento. `config.ts` centraliza economia e limites de mercado, base e copa.

## Fluxo

`startCareerEvent` escolhe liga ou copa. `finishCareerEvent` confirma os efeitos uma única vez e atualiza contas, mercado, diretoria e resumo. `simulateCareerEvent` executa o mesmo fluxo até o fim. `repairLineup` preserva escolhas elegíveis e repõe desfalques. A escalação automática pode considerar força e condição; a manual é preservada.

## Mercado e economia

- Uma passagem da IA por rodada de preparação, com até cinco contratações nas janelas 1–4 e 20–23. Busca posições deficientes e melhora de qualidade; verifica cobertura do vendedor, limite de elenco e reserva de dois meses de salários após a compra.
- Atletas do usuário ficam fora das vendas automáticas. Até três propostas pendentes, com aceite/recusa, validade e nova verificação de caixa no aceite.
- Transferências atualizam dono, elenco, contrato, folha, saldo e histórico juntos. Rodadas já processadas não movimentam dinheiro novamente.
- Caixa de novas carreiras: `3 + reputação / 25` folhas mensais. Saves antigos mantêm o saldo que já tinham.
- Bilheteria líquida: 20% da arrecadação bruta, após operação do evento; público varia com reputação e classificação. Patrocínio semanal: R$ 50 mil + R$ 1.200 por reputação. Salários semanais: 1/4 da folha mensal. Manutenção: R$ 1,80 por lugar. Dívida inicial da semana: juros de 1%.
- Projeção de quatro semanas: média operacional sob o comando do técnico, sem transferências/prêmios. É apresentada como estimativa.

## Copa

A copa nacional tem seis fases após as rodadas 4, 8, 14, 20, 28 e 36. Dos 60 clubes, 56 disputam a preliminar e quatro entram na segunda fase. Nas carreiras de 40 clubes, a preliminar reúne 16 clubes e 24 avançam direto. O estadual é jogado antes da liga. Duas copas continentais começam no segundo ano com oito equipes cada, incluindo quatro convidados fictícios por torneio.

Empates usam pênaltis reproduzíveis, sem alterar gols ou estatísticas dos 90 minutos. W.O. duplo usa sorteio administrativo, sem simular cobranças com atletas inelegíveis. Só participantes recebem desgaste e cumprem suspensões. A copa não duplica a recuperação semanal; amarelos e suspensões são compartilhados entre competições para manter a regra simples. Etapas sem o clube controlado são automáticas.

Premiações por classificação: R$ 80 mil, R$ 160 mil, R$ 320 mil, R$ 600 mil, R$ 1 milhão e R$ 2 milhões. Há bilheteria líquida para o mandante quando ocorre partida.

## Premiações

- Cada estadual, divisão, copa nacional e continental encerra sua própria edição. A ficha da edição guarda campeão, vice, premiados e seleção. A cerimônia reúne essas fichas e monta a Seleção da Temporada com as partidas de todo o calendário. W.O. e cobranças de desempate ficam fora das estatísticas individuais.
- Bola de Ouro e Revelação usam nota ponderada por minutos, regularidade, participações, lances decisivos e produção por posição. A Revelação exige até 21 anos. A elegibilidade exige 40% das partidas do clube e 30% dos minutos possíveis, com ao menos dois jogos quando a edição oferecer esse volume em campo.
- A Chuteira de Ouro ordena por gols, menos jogos, menos minutos, maior nota média e ID do jogador. A Luva de Ouro considera nota, jogos sem sofrer gols, média de gols sofridos e defesas atribuídas pelo motor. Outros empates usam minutos e ID após a pontuação.
- A seleção usa o mesmo algoritmo de atribuição da escalação. Considera as posições naturais e secundárias e dá preferência a quem atingiu a participação mínima. Quando faltam opções, pode usar um atleta que tenha disputado pelo menos 45 minutos. A Seleção da Temporada exige também participação em ao menos 18% das rodadas de uma liga.
- Melhor Técnico combina classificação, título, aproveitamento e superação da expectativa inicial, considerando força do elenco, orçamento e reputação. O técnico do usuário precisa comandar pelo menos dois jogos e metade da campanha. Empates usam classificação e ID do clube. Em saves migrados, a categoria fica em aberto nas competições já iniciadas sem o retrato inicial.
- `awardConfig` concentra os bônus. O prestígio acumulado fica limitado a 30% do valor, entra integralmente na temporada seguinte à conquista e depois conserva 65% em anos de bom desempenho ou 35% nos demais. A IA usa o prestígio para ordenar candidatos que já atendem a necessidade, a melhora mínima e a capacidade financeira.
- O cadastro da edição pode ser aplicado uma única vez por temporada e competição. O clube recebe os pagamentos adicionais previstos nas cláusulas vigentes, com lançamento no extrato. Os registros históricos guardam a identidade do premiado e a participação por clube, inclusive após uma aposentadoria.

## Diretoria e continuidade

Meta conforme reputação relativa na divisão. Confiança inicial: 65%. Primeira avaliação após oito rodadas no cargo; depois, a cada quatro. Usa pontos conquistados desde a contratação e considera dívidas. Confiança em 15% ou menos causa demissão e bloqueia o gerenciamento.

`availableJobs` oferece três clubes. `takeJob` mantém mundo, temporada e resultados, registra a pontuação inicial e abre nova carência. O técnico não é julgado pelo trabalho de seu antecessor. Extratos distinguem clubes por ID.

## Base, evolução e memória

Cinco candidatos por temporada (GOL/ZAG/MC/PE/ATA). Avaliar: R$ 5 mil, com faixa estimada de potencial e parecer de prontidão, sem revelar o teto exato. Promover: dois salários em luvas, contrato de três anos, até três promoções. Avaliação/promoção não se repetem para o mesmo jovem; dispensar não gera reposição imediata. O clube formador permanece no atleta promovido.

Jovens têm teto de potencial. Idade e minutos limitam o desenvolvimento; veteranos declinam. A virada faz reposições emergenciais para posições e mínimo de 18 atletas do técnico, mantendo relevantes as escolhas de promoção e contratação.

Antes de envelhecer, liberar ou aposentar, `archiveSeason` registra estatísticas por jogador/clube/temporada, títulos, classificação e maior goleada. Transferências preservam o clube em que os gols ocorreram; aposentados permanecem no histórico. Recordes cobrem todas as divisões e a copa.

`matchInsights` descreve formação, postura, finalizações/xG, expulsões e decisões por minuto. Recortes após substituições são observações, sem atribuição indevida de causalidade.

`preparation.ts` guarda três escalações por clube, com reaplicação da tática e reposição dos desfalques. `models/personality.ts` define as especialidades e seus efeitos, perfis de clube e desgaste por fôlego. Formadores ganham até três pontos de potencial adicional na base; 360 minutos de sub-21 desde a última avaliação rendem três pontos de confiança. Metas e preferências de desenvolvimento da IA também consideram o perfil.

`market.ts` mantém a observação com valor/clube de referência, uma contraproposta por oferta recebida e empréstimos de reservas. A taxa é de 5% do valor de mercado; o destino paga os salários integrais. `returnLoans` devolve os atletas após arquivar a temporada e antes de atualizar contratos. Retornos ocupam vagas reservadas no limite de 35; atletas emprestados ficam fora das vendas, renovações e novas cessões.

`stories.ts` registra estreias, primeiros gols, transferências e reencontros, além de rivalidades da cidade e de decisões. Cidades ausentes não criam clássicos. Os resultados das divisões e das copas alimentam a memória, e os títulos entram ao arquivar a temporada. Vendas ficam visíveis na memória de origem e destino. Clássicos elevam a procura por ingressos em 10%, ou 20% para clubes de torcida, sem exceder a capacidade.

## Saves

JSON v2 valida sistemas, referências e chave da copa. Os campos novos são opcionais na leitura e recebem valores iniciais na migração. V1 cria sistemas faltantes sem alterar resultados, salários ou elencos. A copa não é inserida retroativamente em temporada antiga. Partidas v1 em andamento recuperam as escalações originais, incluídas explicitamente nos saves seguintes. `progress.engineVersion` preserva o motor anterior em partidas antigas até o apito final; o próximo jogo usa o motor atual. A compatibilidade do modo anterior foi comparada com 50 partidas do código anterior: mesmos placares, eventos e estatísticas.

Gzip fica na camada UI; exportação/importação continuam em JSON. O leitor aceita slots JSON antigos, limita tamanho e verifica integridade. As chaves locais anteriores são mantidas para preservar acesso aos slots existentes.

## Verificação

`tests/expansion.test.ts`: mercado, consentimento, dinheiro, copa, pênaltis, desgaste, diretoria, empregos, base, aposentados, evolução, migração e integridade. `tests/ui/expansion.test.tsx`: telas, comparação, filtros e retomada de partidas de copa/v1. `tests/storage.test.ts`: compressão e corrupção.

`tests/identity.test.ts` e `tests/ui/identity.test.tsx` cobrem planos salvos, avisos, jogo direto, projeção da tabela, observação, negociação de ofertas, empréstimos/retorno, relatórios da base, narrativa e migração dos novos sistemas e do motor de partida.

Duas carreiras (seeds 2026 e 2045), três temporadas cada:

| Perfil | Temporada | Transferências IA | Endividados | Caixa mediano |
| --- | --- | --- | --- | --- |
| Pequeno | 1 | 35 | 0 | R$ 4.214.496 |
| Pequeno | 2 | 35 | 0 | R$ 5.253.957 |
| Pequeno | 3 | 35 | 0 | R$ 4.835.859 |
| Favorito | 1 | 35 | 0 | R$ 5.596.669 |
| Favorito | 2 | 35 | 0 | R$ 5.459.079 |
| Favorito | 3 | 35 | 0 | R$ 5.643.681 |

Cenários controlados com escalação automática e continuidade após demissão, sem compras manuais que pressionem o caixa. Verificam estabilidade e limites; não substituem playtests de dificuldade e diversão.
