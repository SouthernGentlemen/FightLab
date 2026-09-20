import { BAR_IDS } from "../battle/bars.ts";
import { STYLE_RANKS } from "../battle/style.ts";
import { BOARD_HEIGHT, BOARD_WIDTH } from "../mods/grid.ts";
import { REGISTRY } from "../mods/registry.ts";
import type { RunState } from "../run/run.ts";
import { h } from "./dom.ts";
import { BAR_NAME, actionChip, bevel, modArt } from "./kit.ts";
import { modLabel } from "./modlabel.ts";

export interface RunEndOptions {
  readonly run: RunState;
  newRun(): void;
  title(): void;
}

function counted(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Champion or knocked out: the record, the best style, and the build that got there. */
export function mountRunEnd(root: HTMLElement, options: RunEndOptions): () => void {
  const { run } = options;
  const { wins, losses, draws, bestStyle } = run.record;
  const champion = run.ending === "champion";
  const grid = h("div", { class: "runend__grid", style: `--board-w:${BOARD_WIDTH};--board-h:${BOARD_HEIGHT}` },
    ...Array.from({ length: BOARD_WIDTH * BOARD_HEIGHT }, () => h("span", { class: "cell" })),
    ...run.grid.map((piece) => {
      const art = modArt(piece.mod, piece.rotation, "piece", piece.stars);
      art.style.left = `calc(var(--cell) * ${piece.x})`;
      art.style.top = `calc(var(--cell) * ${piece.y})`;
      art.setAttribute("role", "img");
      art.setAttribute("aria-label", modLabel(REGISTRY[piece.mod], piece.stars));
      return art;
    }));
  const bars = BAR_IDS.map((bar) => h("p", { class: "runend__bar" }, h("b", {}, BAR_NAME[bar]),
    ...run.loadout[bar].map((action) => actionChip(action, "chip chip--small"))));
  const again = bevel("New run", "rose", options.newRun, "runend__again");
  root.replaceChildren(h("main", { class: "screen runend teal" },
    h("h1", { class: "runend__title stroke", "data-ending": run.ending ?? "" }, champion ? "Champion" : "Knocked out"),
    h("p", { class: "runend__record stroke" }, `Day ${run.day} · ${counted(wins, "win", "wins")} · ${counted(losses, "loss", "losses")} · ${counted(draws, "draw", "draws")}`),
    h("p", { class: "runend__style stroke" }, "Best style ", h("b", { "data-rank": STYLE_RANKS[bestStyle] }, STYLE_RANKS[bestStyle])),
    h("section", { class: "runend__build", "aria-label": "Final build" }, grid, h("div", {}, ...bars)),
    h("nav", { class: "runend__actions" }, again, bevel("Title", "paper", options.title))));
  again.focus();
  return () => root.replaceChildren();
}
