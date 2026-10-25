"use client";

import { useState } from "react";
import type { GameCompany as Company, HiringCompany } from "@/types/company";
import { WhosHiring } from "@/components/case/WhosHiring";
import { Game } from "@/components/game/Game";
import type { GameId } from "./TopBar";

type Props = {
  /** Higher or lower's discovered companies and sourced observations. */
  companies: Company[];
  /** Companies with open job ads, for Firmle */
  hiring: HiringCompany[];
};

/** Only Firmle and Higher/Lower are available in the public app. */
export function AppShell({ companies, hiring }: Props) {
  const [game, setGame] = useState<Exclude<GameId, "ceo">>("case");
  const changeGame = (next: GameId) => {
    if (next !== "ceo") setGame(next);
  };
  return game === "case" ? (
    <WhosHiring companies={hiring} onGameChange={changeGame} />
  ) : (
    <Game companies={companies} onGameChange={changeGame} />
  );
}
