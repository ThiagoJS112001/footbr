import { Composition } from "remotion";
import { z } from "zod";
import { FootBRTeaser } from "./Composition";
import { ClubTeaser } from "./ClubTeaser";

export const RemotionRoot = () => (
  <>
  <Composition
    id="FootBRTeaser"
    component={FootBRTeaser}
    durationInFrames={900}
    fps={30}
    width={1080}
    height={1350}
    schema={z.object({ release: z.string() })}
    defaultProps={{ release: "MARÇO DE 2027" }}
  />
  <Composition
    id="FootBRCentralDoClube"
    component={ClubTeaser}
    durationInFrames={750}
    fps={30}
    width={1080}
    height={1350}
    schema={z.object({ release: z.string() })}
    defaultProps={{ release: "MARÇO DE 2027" }}
  />
  </>
);
