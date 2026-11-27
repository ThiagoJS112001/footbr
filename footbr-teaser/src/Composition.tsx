import { Audio } from "@remotion/media";
import { TransitionSeries } from "@remotion/transitions";
import {
  AbsoluteFill, Easing, Img, Interactive, interpolate, staticFile,
  useCurrentFrame, useVideoConfig,
} from "remotion";
import "./teaser.css";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

function Pitch({ turn = 0 }: { turn?: number }) {
  const frame = useCurrentFrame();
  return (
    <div className="pitch" style={{ rotate: `${turn + frame * 0.018}deg`, translate: `0 ${-frame * 0.14}px` }}>
      <div className="pitch-outline">
        <div className="center-line" />
        <div className="center-circle" />
        <div className="penalty top" />
        <div className="penalty bottom" />
      </div>
    </div>
  );
}

export function Backdrop({ turn = 0 }: { turn?: number }) {
  return <AbsoluteFill className="backdrop">
    <Pitch turn={turn} />
    <div className="shade" />
    <div className="rails" />
  </AbsoluteFill>;
}

function Headline({ first, second, label, rise = 0 }: {
  first: string; second: string; label: string; rise?: number;
}) {
  const frame = useCurrentFrame();
  return (
    <div className="headline-wrap" style={{ top: 515 - rise }}>
      <Interactive.Div name="Identificação da cena" className="eyebrow">{label}</Interactive.Div>
      <Interactive.Div name="Título" className="headline" style={{
        opacity: interpolate(frame, [1, 12], [0, 1], clamp),
        translate: interpolate(frame, [1, 21], ["0px 38px", "0px 0px"], { ...clamp, easing: Easing.out(Easing.cubic) }),
      }}>
        <div>{first}</div>
        <div className="accent">{second}</div>
      </Interactive.Div>
    </div>
  );
}

function Entrance() {
  return <>
    <Backdrop turn={-28} />
    <Headline label="MANAGER DE FUTEBOL" first="O jogo começa" second="antes do apito." />
  </>;
}

function Glimpse({ file, short = false }: { file: string; short?: boolean }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div className={`glimpse ${short ? "compact" : ""}`} style={{
      opacity: interpolate(frame, [fps * 1.9, fps * 2.15, fps * 4.65, fps * 5.15], [0, 1, 1, 0], clamp),
      translate: interpolate(frame, [fps * 1.9, fps * 4.9], ["35px 30px", "-42px -10px"], clamp),
    }}>
      <Img src={staticFile(file)} style={{ scale: interpolate(frame, [2 * fps, 5 * fps], [1.06, 1.15], clamp) }} />
      <div className="glimpse-shade" />
      <div className="scanline" style={{ top: `${interpolate(frame, [2 * fps, 4.9 * fps], [0, 100], clamp)}%` }} />
    </div>
  );
}

function Tactics() {
  return <>
    <Backdrop turn={18} />
    <Glimpse file="tatica.png" />
    <Headline label="ANTES DA PARTIDA" first="A escalação" second="é sua." rise={170} />
  </>;
}

function Match() {
  return <>
    <Backdrop turn={-15} />
    <Glimpse file="placar.png" short />
    <Headline label="COM A BOLA ROLANDO" first="A pressão" second="também." rise={145} />
  </>;
}

function Hold() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return <>
    <Backdrop turn={36} />
    <Headline label="COMANDO DO CLUBE" first="O próximo passo" second="é seu." />
    <AbsoluteFill className="blackout" style={{
      opacity: interpolate(frame, [5.65 * fps, 6.6 * fps], [0, 1], clamp),
    }} />
  </>;
}

function BrandMark() {
  return (
    <svg width="144" height="144" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <circle cx="33" cy="26" r="22" fill="#f4f8f4" stroke="#b6ccbf" strokeWidth="2" />
      <path d="m33 14 10 7-4 12H27l-4-12 10-7ZM14 17l9 4M43 21l9-4M27 33l-6 10M39 33l7 9M33 4v10" stroke="#071820" strokeWidth="3" fill="#071820" />
      <path d="M4 47c18 1 37-10 54-20-4 13-20 28-42 30l10-10-22 0Z" fill="#56f795" />
      <path d="m10 60 15-13 25-6-16 14-24 5Z" fill="#13b968" />
    </svg>
  );
}

export function Reveal({ release }: { release: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return <>
    <Backdrop turn={-24} />
    <div className="reveal">
      <div style={{
        opacity: interpolate(frame, [0, 0.34 * fps], [0, 1], clamp),
        scale: interpolate(frame, [0, 0.7 * fps], [0.91, 1], { ...clamp, easing: Easing.out(Easing.cubic) }),
      }}>
        <BrandMark />
        <div className="wordmark">Foot<span>BR</span></div>
        <div className="brand-type">MANAGER DE FUTEBOL</div>
      </div>
      <Interactive.Div name="Data de lançamento" className="date" style={{
        opacity: interpolate(frame, [0.5 * fps, 0.95 * fps], [0, 1], clamp),
        translate: interpolate(frame, [0.5 * fps, 0.95 * fps], ["0px 24px", "0px 0px"], clamp),
      }}>
        <div className="date-label">LANÇAMENTO</div>
        <div>{release}</div>
      </Interactive.Div>
    </div>
  </>;
}

export function FootBRTeaser({ release }: { release: string }) {
  const { fps } = useVideoConfig();
  return <AbsoluteFill className="teaser">
    <TransitionSeries>
      <TransitionSeries.Sequence name="Antes do apito" durationInFrames={5 * fps}><Entrance /></TransitionSeries.Sequence>
      <TransitionSeries.Sequence name="Escalação" durationInFrames={6 * fps}><Tactics /></TransitionSeries.Sequence>
      <TransitionSeries.Sequence name="Partida" durationInFrames={6 * fps}><Match /></TransitionSeries.Sequence>
      <TransitionSeries.Sequence name="Suspense" durationInFrames={7 * fps}><Hold /></TransitionSeries.Sequence>
      <TransitionSeries.Sequence name="FootBR e lançamento" durationInFrames={6 * fps}><Reveal release={release} /></TransitionSeries.Sequence>
    </TransitionSeries>
    <Audio name="Trilha original" src={staticFile("trilha.wav")} />
  </AbsoluteFill>;
}
