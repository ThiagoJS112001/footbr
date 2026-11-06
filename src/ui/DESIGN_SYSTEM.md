# Identidade visual do FootBR

A referência principal é o dashboard fornecido pelo usuário: futebol moderno, fundo azul-marinho, painéis azul-petróleo, verde como cor de ação, hierarquia clara e densidade de informação moderada. A interface é em português brasileiro.

## Tema único

`theme.css` centraliza cores, superfícies, sombras, raios, espaçamentos, largura da navegação e fundos fotográficos. `global.css` carrega Inter variável a partir do pacote local; não há dependência de fontes remotas.

| Papel | Token | Cor |
| --- | --- | --- |
| Fundo | `--bg` | `#07131F` |
| Navegação | `--sidebar` | `#0B1928` |
| Painéis | `--surface` | `#102331` |
| Ação principal | `--accent` | `#00C83C` |
| Verde secundário | `--accent-dark` | `#008F35` |
| Texto | `--text` | `#F5F7FA` |
| Texto secundário | `--muted` | `#A9B6C5` |
| Bordas | `--line` | `#29404D` |

Use os tokens existentes em novas telas. Amarelo e vermelho representam recuperação, lesão, suspensão, resultado ou alerta financeiro. Não são cores decorativas de fundo. Escudos têm cores próprias para identificar clubes fictícios, definidas na mesma folha de tema.

## Componentes

- `Brand`: marca FootBR em vetor e assinatura “Manager de Futebol”.
- `Icon`: ícones Lucide, normalmente 21 px, traço 1,8; decorativos para leitores de tela.
- `Panel` e `StatCard`: título, ícone, ação opcional, conteúdo e rodapé consistentes.
- `DataTable`: alinhamento numérico, ordenação, paginação, destaque do clube e rolagem interna.
- `ClubBadge`: escudos vetoriais estáveis a partir do nome dos clubes.
- `ConditionRing`: indicador de condição física com descrição acessível e valor limitado a 0–100%.
- `TacticalPitch`: campo vetorial que acompanha a formação e os titulares existentes.
- `PlayerAvatar`: silhueta de uniforme, sem representar uma foto real do atleta.
- `PageHeader`: hierarquia de página compartilhada.

Botões principais usam `primaryButton`, secundários `secondaryButton` e links de navegação `textButton`. Há estados hover, active, disabled e foco visível. Novos componentes devem consumir o tema, evitando cores e fontes isoladas.

## Estrutura

A navegação reúne as telas implementadas, incluindo copa, base e diretoria. Não adicionar opções para funções ausentes. Em desktop, a lateral fica fixa e o topo permanece visível ao rolar. Em larguras menores, a lateral passa a ícones com nomes acessíveis; cards, formulários e barra superior se reorganizam. Tabelas largas rolam dentro do painel.

A Central do Clube usa dados da carreira: próxima partida de liga/copa, resumo pós-jogo, classificação, destaques, contas, condição, meta/confiança da diretoria, propostas e notícias existentes. Sem resultados ou receitas inventados para reproduzir a imagem.

“Avançar” abre a preparação da próxima competição; na escalação, inicia a partida; no resultado, retorna ao painel. Fica indisponível durante jogos e ao encerrar a temporada. Após demissão, leva às propostas na diretoria. Filtros, fichas e rascunhos de negociação permanecem durante a navegação; iniciar/carregar outra carreira reinicia essas preferências de tela.

O treinador aparece como “Você”, pois não há cadastro de nome. As datas representam os intervalos de sete dias do motor, com início visual em 12 de janeiro de 2026 e ano incrementado por temporada. A liga aparece na quarta-feira e a copa no sábado correspondente, entre rodadas da liga. Não há configuração de horários nem agenda de treinos.

## Imagem de estádio

`assets/stadium-night.webp` é um fundo original gerado com a ferramenta integrada de imagens. A versão WebP tem aproximadamente 206 KiB. Sobreposições do tema preservam o contraste dos textos. O fundo é decorativo; não contém dados necessários à navegação.

O prompt e a origem estão em [assets/README.md](assets/README.md). Não copiar clubes, fotos de atletas ou marcas reais do exemplo para o banco fictício do jogo.
