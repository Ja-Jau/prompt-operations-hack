import type { Metadata } from "next";
import { Game } from "@/bottleneck/Game";

export const metadata: Metadata = {
  title: "Fix the Bottleneck | Tehokas",
  description: "60 seconds. A pipeline with a hidden bottleneck. Put the Velho AI agents where they actually help.",
};

export default function Page() {
  return <Game />;
}
