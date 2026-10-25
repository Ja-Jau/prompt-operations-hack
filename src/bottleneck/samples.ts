/** Prints sample generated scenarios: node /tmp/bottleneck-tests/src/bottleneck/samples.js [count] */
import { generate } from "./generate";

const n = Number(process.argv[2] ?? 5);
const picks = [[101, 1], [2024, 2], [31337, 3], [777, 4], [9001, 5], [42, 3], [555, 5]].slice(0, n);
for (const [seed, d] of picks) {
  const t0 = Date.now();
  const s = generate(seed, d);
  const m = s.meta!;
  console.log(
    `seed ${seed} diff ${d} | ${s.title} | ${s.stages.length} stages | agents ${s.agents} (max ${s.maxAgentsPerStage}/stage) | budget ${s.budget} | ${s.durationSeconds}s | events ${s.events.length}`,
  );
  console.log(`  stages: ${s.stages.map((x) => `${x.name} [${x.kind}]`).join(" > ")}`);
  console.log(`  true bottleneck: ${m.trueBottleneck}   decoy: ${m.decoy ?? "-"}   tries: ${m.attempts}   solvable: ${m.solvable}   (${Date.now() - t0} ms)`);
  console.log(`  solver best: [${m.solver!.best.join(", ")}] score ${m.solver!.bestScore} cut ${m.solver!.bestCut}%   lazy: [${m.solver!.lazy.join(", ")}] score ${m.solver!.lazyScore}`);
  console.log(`  events: ${s.events.map((e) => `${e.at}s ${e.title}`).join(" | ")}\n`);
}
