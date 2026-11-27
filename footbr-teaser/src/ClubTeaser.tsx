import { Audio } from "@remotion/media";
import { TransitionSeries } from "@remotion/transitions";
import {
  AbsoluteFill, Easing, Img, Interactive, Sequence, interpolate, staticFile,
  useCurrentFrame, useVideoConfig,
} from "remotion";
import { Backdrop, Reveal } from "./Composition";
import "./club-teaser.css";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

function PanelTour({ title, note, file, turn }: {
  title: string; note: string; file: string; turn: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return <>
    <Backdrop turn={turn} />
    <div className="club-tour">
      <Interactive.Div name="Título" className="club-tour-title">{title}</Interactive.Div>
      <Img className="club-tour-shot" src={staticFile(file)} style={{
        opacity: interpolate(frame, [0, 0.22 * fps], [0.72, 1], clamp),
        translate: interpolate(frame, [0, 0.48 * fps], ["0px 16px", "0px 0px"], { ...clamp, easing: Easing.out(Easing.cubic) }),
        scale: interpolate(frame, [0, 4 * fps], [0.985, 1.025], clamp),
      }} />
      <Interactive.Div name="Legenda" className="club-tour-note">{note}</Interactive.Div>
    </div>
  </>;
}

export function ClubTeaser({ release }: { release: string }) {
  const { fps } = useVideoConfig();
  return <AbsoluteFill className="teaser">
    <TransitionSeries>
      <TransitionSeries.Sequence name="Central do Clube" durationInFrames={4 * fps}>
        <PanelTour title="Tudo do seu time" note="Em um só lugar." file="central-censurada.png" turn={-12} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Sequence name="Próxima partida" durationInFrames={4 * fps}>
        <PanelTour title="Dia de jogo" note="Prepare, simule ou acompanhe ao vivo." file="partida-central.png" turn={16} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Sequence name="Elenco" durationInFrames={5 * fps}>
        <PanelTour title="De olho no elenco" note="Confira a formação, a condição e a moral." file="elenco-censurado.png" turn={-22} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Sequence name="Notícias" durationInFrames={3 * fps}>
        <PanelTour title="Notícias do clube" note="Fique por dentro da temporada." file="noticias-central.png" turn={23} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Sequence name="Mercado e diretoria" durationInFrames={4 * fps}>
        <PanelTour title="Além do campo" note="Acompanhe propostas e metas da diretoria." file="gestao-central.png" turn={-16} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Sequence name="FootBR e lançamento" durationInFrames={5 * fps}><Reveal release={release} /></TransitionSeries.Sequence>
    </TransitionSeries>
    <Sequence name="Trilha" durationInFrames={20 * fps}>
      <Audio src={staticFile("trilha.wav")} volume={(frame) => interpolate(frame, [19.75 * fps, 20 * fps], [0.82, 0], clamp)} />
    </Sequence>
    <Sequence name="Assinatura sonora" from={20 * fps} durationInFrames={5 * fps}>
      <Audio src={staticFile("trilha.wav")} trimBefore={24 * fps} volume={(frame) => interpolate(frame, [4.4 * fps, 5 * fps], [1, 0], clamp)} />
    </Sequence>
  </AbsoluteFill>;
}
