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

40 clubes, 39 eliminatórias de jogo único. Dezesseis sorteados disputam a preliminar; 24 entram na segunda fase. Etapas após as rodadas 4, 8, 14, 20, 28 e 36.

Empates usam pênaltis reproduzíveis, sem alterar gols ou estatísticas dos 90 minutos. W.O. duplo usa sorteio administrativo, sem simular cobranças com atletas inelegíveis. Só participantes recebem desgaste e cumprem suspensões. A copa não duplica a recuperação semanal; amarelos e suspensões são compartilhados entre competições para manter a regra simples. Etapas sem o clube controlado são automáticas.

Premiações por classificação: R$ 80 mil, R$ 160 mil, R$ 320 mil, R$ 600 mil, R$ 1 milhão e R$ 2 milhões. Há bilheteria líquida para o mandante quando ocorre partida.

## Diretoria e continuidade

Meta conforme reputação relativa na divisão. Confiança inicial: 65%. Primeira avaliação após oito rodadas no cargo; depois, a cada quatro. Usa pontos conquistados desde a contratação e considera dívidas. Confiança em 15% ou menos causa demissão e bloqueia o gerenciamento.

`availableJobs` oferece três clubes. `takeJob` mantém mundo, temporada e resultados, registra a pontuação inicial e abre nova carência. O técnico não é julgado pelo trabalho de seu antecessor. Extratos distinguem clubes por ID.

## Base, evolução e memória

Cinco candidatos por temporada (GOL/ZAG/MC/PE/ATA). Avaliar: R$ 5 mil. Promover: dois salários em luvas, contrato de três anos, até três promoções. Avaliação/promoção não se repetem para o mesmo jovem; dispensar não gera reposição imediata.

Jovens têm teto de potencial. Idade e minutos limitam o desenvolvimento; veteranos declinam. A virada faz reposições emergenciais para posições e mínimo de 18 atletas do técnico, mantendo relevantes as escolhas de promoção e contratação.

Antes de envelhecer, liberar ou aposentar, `archiveSeason` registra estatísticas por jogador/clube/temporada, títulos, classificação e maior goleada. Transferências preservam o clube em que os gols ocorreram; aposentados permanecem no histórico. Recordes cobrem todas as divisões e a copa.

`matchInsights` descreve formação, postura, finalizações/xG, expulsões e decisões por minuto. Recortes após substituições são observações, sem atribuição indevida de causalidade.

## Saves

JSON v2 valida sistemas, referências e chave da copa. V1 cria sistemas faltantes sem alterar resultados, salários ou elencos. A copa não é inserida retroativamente em temporada antiga. Partidas v1 em andamento recuperam as escalações originais, incluídas explicitamente nos saves seguintes.

Gzip fica na camada UI; exportação/importação continuam em JSON. O leitor aceita slots JSON antigos, limita tamanho e verifica integridade. As chaves locais anteriores são mantidas para preservar acesso aos slots existentes.

## Verificação

`tests/expansion.test.ts`: mercado, consentimento, dinheiro, copa, pênaltis, desgaste, diretoria, empregos, base, aposentados, evolução, migração e integridade. `tests/ui/expansion.test.tsx`: telas, comparação, filtros e retomada de partidas de copa/v1. `tests/storage.test.ts`: compressão e corrupção.

Duas carreiras (seeds 2026 e 2045), três temporadas cada:

| Perfil | Temporada | Transferências IA | Endividados | Caixa mediano |
| --- | --- | --- | --- | --- |
| Pequeno | 1 | 35 | 0 | R$ 4.382.724 |
| Pequeno | 2 | 35 | 0 | R$ 4.680.421 |
| Pequeno | 3 | 35 | 0 | R$ 4.503.695 |
| Favorito | 1 | 35 | 0 | R$ 5.648.209 |
| Favorito | 2 | 35 | 0 | R$ 5.239.676 |
| Favorito | 3 | 35 | 0 | R$ 5.389.894 |

Cenários controlados com escalação automática e continuidade após demissão, sem compras manuais que pressionem o caixa. Verificam estabilidade e limites; não substituem playtests de dificuldade e diversão.
