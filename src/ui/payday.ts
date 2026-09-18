import { STYLE_RANKS } from "../battle/style.ts";
import type { PaydayLabel } from "../run/economy.ts";
import { RUN_HEARTS, TROPHIES_TO_WIN, buildOf } from "../run/run.ts";
import type { RunState } from "../run/run.ts";
import { h, icon } from "./dom.ts";
import { bevel, panel } from "./kit.ts";

export interface PaydayOptions {
  readonly run: RunState;
  next(): void;
}

/** The fight's outcome, the trophy or heart it cost or won, and the money it paid, line by line. */
export function mountPayday(root: HTMLElement, options: PaydayOptions): () => void {
  const { run } = options;
  const last = run.last!;
  const build = buildOf(run);
  const outcome = last.result === "victory" ? "Victory" : last.result === "defeat" ? "Defeat" : "Draw";
  const change = last.result === "victory" ? [icon("trophy"), `+1 trophy · ${run.trophies}/${TROPHIES_TO_WIN}`]
    : last.result === "defeat" ? [icon("heart"), `−1 heart · ${run.hearts} of ${RUN_HEARTS} left`]
    : ["No trophy, no heart"];
  const labels: Readonly<Record<PaydayLabel, string>> = {
    base: "Base",
    result: outcome,
    interest: "Interest",
    style: `Style ${STYLE_RANKS[last.peakStyle]}${build.styleMultiplier > 1 ? ` ×${build.styleMultiplier}` : ""}`,
    perks: "Piggy banks",
  };
  const rows = last.payday.map((line, index) => {
    const row = h("div", { class: `tally__row${line.amount === 0 ? " is-zero" : ""}` }, h("span", {}, labels[line.label]), h("b", {}, `+$${line.amount}`));
    row.style.setProperty("--i", String(index));
    return row;
  });
  const next = bevel("Next day", "rose", options.next, "payday__next");
  root.replaceChildren(h("main", { class: "screen payday teal" },
    h("h1", { class: "payday__outcome stroke", "data-outcome": last.result }, outcome),
    h("p", { class: "payday__change stroke" }, ...change),
    panel("Payday", "sun", [h("span", {}, `Day ${last.day} · ${last.rounds} round${last.rounds === 1 ? "" : "s"}`)],
      h("div", { class: "tally" }, ...rows, h("div", { class: "tally__total" }, h("span", {}, "Total"), h("b", {}, `+$${last.earned}`)))),
    h("div", { class: "pill money stroke payday__money" }, `$${run.money}`),
    next));
  next.focus();
  return () => root.replaceChildren();
}
