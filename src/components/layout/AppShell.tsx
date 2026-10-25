"use client";

import { useState } from "react";
import type { GameCompany as Company, HiringCompany } from "@/types/company";
import { WhosHiring } from "@/components/case/WhosHiring";
import { Game } from "@/components/game/Game";
import { CeoGame } from "@/components/ceo/CeoGame";
import type { GameId } from "./TopBar";

type Props = {
  /** Higher or lower's discovered companies and sourced observations. */
  companies: Company[];
  /** Companies with open job ads, for Who's hiring? */
  hiring: HiringCompany[];
};

/** Switches between the hiring case, Higher/Lower and the timed CEO game. */
export function AppShell({ companies, hiring }: Props) {
  const [game, setGame] = useState<GameId>("case");
  if (game === "ceo") return <CeoGame onGameChange={setGame} />;
  return game === "case" ? (
    <WhosHiring companies={hiring} onGameChange={setGame} />
  ) : (
    <Game companies={companies} onGameChange={setGame} />
  );
}
