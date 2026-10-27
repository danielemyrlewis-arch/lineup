import { Lineup } from "@/components/game/lineup";
import { PlayerProvider } from "@/components/account/player-provider";
import { GAME_STRUCTURED_DATA } from "@/lib/site";
export default function Home() {
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(GAME_STRUCTURED_DATA).replace(/</g, "\\u003c")}} />
    <PlayerProvider><Lineup /></PlayerProvider>
  </>;
}
