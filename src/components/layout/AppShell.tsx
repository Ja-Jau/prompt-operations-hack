"use client";

import { useState } from "react";
import type { GameCompany as Company, HiringCompany } from "@/types/company";
import { WhosHiring } from "@/components/case/WhosHiring";
import { Game } from "@/components/game/Game";
import type { GameId } from "./TopBar";

type Props = {
  /** Higher or lower's discovered companies and sourced observations. */
  companies: Company[];
  /** Companies with open job ads, for Who's hiring? */
  hiring: HiringCompany[];
};

/** Switches between the daily case (main game) and Higher/Lower (bonus). */
export function AppShell({ companies, hiring }: Props) {
  const [game, setGame] = useState<GameId>("case");
  return game === "case" ? (
    <WhosHiring companies={hiring} onGameChange={setGame} />
  ) : (
    <Game companies={companies} onGameChange={setGame} />
  );
}
