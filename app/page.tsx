import { Lineup } from "@/components/game/lineup";
import { PlayerProvider } from "@/components/account/player-provider";
export default function Home() {
  return <PlayerProvider><Lineup /></PlayerProvider>;
}
