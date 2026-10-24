"use client";

import { useState } from "react";
import type { Company } from "@/types/company";
import { WhosHiring } from "@/components/case/WhosHiring";
import { Game } from "@/components/game/Game";
import type { GameId } from "./TopBar";

type Props = {
  companies: Company[];
  exampleCompanies: Company[];
};

/** Switches between the daily case (main game) and Higher/Lower (bonus). */
export function AppShell({ companies, exampleCompanies }: Props) {
  const [game, setGame] = useState<GameId>("case");
  return game === "case" ? (
    <WhosHiring
      companies={companies}
      exampleCompanies={exampleCompanies}
      onGameChange={setGame}
    />
  ) : (
    <Game companies={companies} onGameChange={setGame} />
  );
}
