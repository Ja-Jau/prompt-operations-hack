"use client";

import { useState } from "react";
import type { Company, HiringCompany } from "@/types/company";
import { WhosHiring } from "@/components/case/WhosHiring";
import { Game } from "@/components/game/Game";
import type { GameId } from "./TopBar";

type Props = {
  /** Higher or lower's companies, with revenue and headcount. */
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
