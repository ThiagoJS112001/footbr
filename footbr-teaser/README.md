# Teaser do FootBR

Vídeo de 30 segundos para o feed do Instagram em 1080 × 1350 (4:5), a 30 fps. O teaser usa dois recortes da interface do FootBR, uma trilha original e revela o lançamento em março de 2027 no final.

Execute os comandos abaixo nesta pasta. O Studio abre a composição `FootBRTeaser`, onde é possível editar a data de lançamento e ajustar a montagem.

```powershell
npm.cmd ci
npm.cmd run dev
```

Para exportar o MP4 para a pasta `out` do FootBR, execute:

```powershell
npm.cmd run render
```

A composição `FootBRCentralDoClube` dura 25 segundos e destaca próxima partida, elenco, notícias, mercado e diretoria. As capturas da Central do Clube ocultam os nomes e escudos dos times. Para exportá-la no mesmo formato do primeiro teaser, execute:

```powershell
npx.cmd remotion render FootBRCentralDoClube ../out/footbr-teaser-central-do-clube-v2.mp4 --codec=h264 --audio-codec=aac --pixel-format=yuv420p --crf=17
```
