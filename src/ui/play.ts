import { ACTION_TYPES, DEFAULT_ACTIONS } from "../battle/actions.ts";
import type { ActionType } from "../battle/actions.ts";
import { BAR_LENGTH, otherBar } from "../battle/bars.ts";
import type { ActionLoadout, BarId } from "../battle/bars.ts";
import { activeBar } from "../battle/director.ts";
import type { MatchupResult } from "../battle/matchup.ts";
import { currentMove, movePhase } from "../combat/kernel/index.ts";
import { FixedClock } from "../game/clock.ts";
import type { BattleSpeed } from "../game/clock.ts";
import { DEFAULT_MATCH, Match } from "../game/match.ts";
import { PLAYER_FIGURE } from "../game/roster.ts";
import { OPPONENT_FIGURES } from "../run/opponents.ts";
import type { ClipFrame } from "../render/animation.ts";
import { loadFigureModel } from "../render/figure.ts";
import { Stage } from "../render/stage.ts";
import type { DebugLayers, StageView } from "../render/stage.ts";
import { button, h, setText } from "./dom.ts";

export interface PlayOptions {
  readonly loadout: ActionLoadout;
  speed(): BattleSpeed;
  title(): void;
  readonly debug: boolean;
}

const LABELS = Object.fromEntries(ACTION_TYPES.map((action) => [action, DEFAULT_ACTIONS[action].label])) as Record<ActionType, string>;
const BAR_NAMES: Record<BarId, string> = { primary: "Bar A", secondary: "Bar B" };

function chip(action: ActionType | null, className = "chip"): HTMLSpanElement {
  const node = h("span", { class: className });
  paintChip(node, action);
  return node;
}

function paintChip(node: HTMLElement, action: ActionType | null): void {
  const key = action ?? "hidden";
  if (node.dataset.action === key) return;
  node.dataset.action = key;
  node.textContent = action === null ? "?" : LABELS[action];
}

function verdict(player: ActionType, opponent: ActionType, result: MatchupResult): string {
  if (result === "tie") return player === "block" ? "Both guard" : "Trade";
  const [winner, loser] = result === "player" ? [player, opponent] : [opponent, player];
  return `${LABELS[winner]} beats ${LABELS[loser]}`;
}

/**
 * The fight screen: rounds, the pause between them, and the result.
 *
 * Everything drawn here is read from the match every frame; the only writes are the player's own
 * commands — Mixup, Fight, Rematch. The clock turns elapsed time into whole simulation ticks, and
 * battle speed only changes how many of those a frame owes.
 */
export function mountPlay(root: HTMLElement, options: PlayOptions): () => void {
  let match = new Match({ ...DEFAULT_MATCH, player: options.loadout });
  const clock = new FixedClock();
  let stage: Stage | null = null;
  let debug: DebugLayers | null = options.debug ? { boxes: true, skeleton: true } : null;
  let frames: readonly [ClipFrame, ClipFrame] | null = null;
  let raf = 0;
  let last = performance.now();
  let shownPhase = "";
  let disposed = false;

  const meters = (["player", "enemy"] as const).map((side) => {
    const value = h("b", { class: "meter__value" }, "100");
    const fill = h("i", { class: "meter__fill" });
    const track = h("div", { class: "meter__track", role: "meter", "aria-label": `${side} health`, "aria-valuemin": "0", "aria-valuemax": "100" },
      h("i", { class: "meter__trail" }), fill);
    const node = h("div", { class: `meter meter--${side}` },
      h("div", { class: "meter__label" }, h("span", {}, side === "player" ? "Player" : "Enemy"), value), track);
    return { node, value, fill, track };
  });
  const roundLabel = h("span", { class: "hud__loop" });
  const back = button("Title", "link", options.title);

  const stageHost = h("div", { class: "arena__stage" });
  const resultTitle = h("h2", { class: "result__title" });
  const resultNote = h("p", { class: "result__note" });
  const rematch = button("Rematch", "button button--primary", () => {
    match = new Match({ ...DEFAULT_MATCH, player: options.loadout });
    clock.reset();
    shownPhase = "";
  });
  const result = h("div", { class: "result", hidden: "" }, resultTitle, resultNote,
    h("div", { class: "result__actions" }, rematch, button("Title", "button", options.title)));

  const barRows = (["primary", "secondary"] as const).map((bar) => {
    const chips = Array.from({ length: BAR_LENGTH }, () => chip(null));
    const marker = h("span", { class: "pause__marker" });
    return { bar, chips, marker, node: h("p", { class: "pause__bar" }, h("span", { class: "pause__name" }, BAR_NAMES[bar]), ...chips, marker) };
  });
  const mixupLabel = h("small", {});
  const mixupButton = button("Mixup", "button", () => {
    if (match.paused) match.mixup();
  });
  mixupButton.append(mixupLabel);
  const fightLabel = h("small", {});
  const fightButton = button("Fight", "button button--primary", () => {
    if (match.paused) {
      match.nextRound();
      clock.reset();
    }
  });
  fightButton.append(fightLabel);
  const pauseTitle = h("h2", { class: "pause__title" });
  const pause = h("div", { class: "result pause", hidden: "" }, pauseTitle, ...barRows.map(({ node }) => node),
    h("div", { class: "result__actions" }, mixupButton, fightButton));

  const debugText = h("pre", { class: "debug-panel__text" });
  const debugToggles = (["boxes", "skeleton"] as const).map((layer) => {
    const input = h("input", { type: "checkbox" });
    input.addEventListener("change", () => {
      debug = { boxes: debug?.boxes ?? false, skeleton: debug?.skeleton ?? false, [layer]: input.checked };
    });
    return { layer, input, label: h("label", {}, input, layer) };
  });
  const debugPanel = h("aside", { class: "debug-panel", "aria-label": "Debug" }, debugText,
    h("div", { class: "debug-panel__toggles" }, ...debugToggles.map(({ label }) => label)));

  const you = chip(null);
  const enemy = chip(null);
  const slotLabel = h("span", { class: "matchup__slot" });
  const outcome = h("span", { class: "matchup__verdict" });
  const matchup = h("p", { class: "matchup" },
    slotLabel, h("span", { class: "matchup__side" }, "You"), you, h("span", { class: "matchup__vs" }, "vs"), enemy,
    h("span", { class: "matchup__side" }, "Enemy"), outcome);

  const slots = Array.from({ length: BAR_LENGTH }, (_, index) => {
    const label = h("span", { class: "slot__label" });
    const node = h("button", { type: "button", class: "slot", disabled: "" }, h("span", { class: "slot__index" }, String(index + 1)), label);
    return { node, label };
  });

  const screen = h("main", { class: "screen play" },
    h("header", { class: "hud" }, meters[0].node, h("div", { class: "hud__center" }, roundLabel, back), meters[1].node),
    h("section", { class: "arena" }, stageHost, pause, result, ...(debug || import.meta.env.DEV ? [debugPanel] : [])),
    h("div", { class: "exchange", "aria-live": "polite" }, matchup),
    h("section", { class: "program", "aria-label": "Your active bar" }, h("ol", { class: "slots" }, ...slots.map(({ node }) => h("li", {}, node)))),
  );
  root.replaceChildren(screen);

  function stageView(): StageView {
    const { battle, arena } = match;
    const finished = battle.outcome !== null && match.endedAt !== null ? match.presentationTick - match.endedAt : null;
    const winners = [battle.outcome?.result === "victory", battle.outcome?.result === "defeat"];
    const context = winners.map((won) => ({
      idleFrame: battle.phase === "round-pause" ? match.presentationTick : null,
      finish: finished === null ? null : { ticks: finished, won },
    }));
    return {
      combat: arena.state,
      definitions: [arena.sides[0].fighter, arena.sides[1].fighter],
      report: arena.lastReport,
      context: [context[0], context[1]],
    };
  }

  function draw(): void {
    const { battle, arena } = match;
    const phase = battle.phase;
    if (phase !== shownPhase) {
      screen.dataset.phase = phase;
      result.hidden = phase !== "ko";
      pause.hidden = phase !== "round-pause";
      if (phase === "ko") rematch.focus();
      if (phase === "round-pause") fightButton.focus();
      shownPhase = phase;
    }
    if (stage !== null) frames = stage.render(stageView(), debug);

    arena.state.fighters.forEach((fighter, index) => {
      const meter = meters[index];
      const percent = Math.round((fighter.health / arena.sides[index].fighter.maxHealth) * 100);
      setText(meter.value, String(fighter.health));
      const width = `${percent}%`;
      if (meter.fill.style.width !== width) {
        meter.fill.style.width = width;
        meter.node.style.setProperty("--health", width);
        meter.track.setAttribute("aria-valuenow", String(percent));
      }
    });
    setText(roundLabel, `Round ${battle.round}`);

    const bar = activeBar(battle, 0);
    const resolving = phase === "fighting" ? battle.exchange?.index ?? battle.actionIndex : -1;
    slots.forEach(({ node, label }, index) => {
      const action = bar[index];
      if (node.dataset.action !== action) node.dataset.action = action;
      setText(label, LABELS[action]);
      node.classList.toggle("is-current", index === resolving);
    });

    const exchange = battle.exchange;
    if (phase === "fighting" && exchange !== null) {
      const clashed = exchange.stage === "clash";
      setText(slotLabel, `Slot ${exchange.index + 1}`);
      paintChip(you, exchange.player);
      paintChip(enemy, clashed ? exchange.opponent : null);
      setText(outcome, clashed ? verdict(exchange.player, exchange.opponent, exchange.result) : "");
      outcome.dataset.winner = clashed ? exchange.result : "";
    }

    if (phase === "round-pause") {
      setText(pauseTitle, `Round ${battle.round} complete`);
      for (const row of barRows) {
        battle.playerLoadout[row.bar].forEach((action, index) => paintChip(row.chips[index], action));
        setText(row.marker, battle.bars[0] === row.bar ? "Active" : "");
      }
      setText(mixupLabel, ` · Switch to ${BAR_NAMES[otherBar(battle.bars[0])]}`);
      setText(fightLabel, ` · Round ${battle.round + 1}`);
    }

    if (phase === "ko" && battle.outcome !== null) {
      const { result: final, reason } = battle.outcome;
      setText(resultTitle, final === "victory" ? "Victory" : final === "defeat" ? "Defeat" : "Draw");
      resultTitle.dataset.outcome = final;
      setText(resultNote, reason === "double-ko" ? "Double knockout" : reason === "stalemate" ? "Stalemate — nobody could be hurt"
        : reason === "limit" ? "Time" : `${battle.round} rounds`);
    }
    if (debug !== null) drawDebug();
    debugPanel.hidden = debug === null;
  }

  function drawDebug(): void {
    const { battle, arena } = match;
    const exchange = battle.exchange;
    const row = (name: string, index: 0 | 1, action: ActionType | null): string => {
      const fighter = arena.state.fighters[index];
      const definition = arena.sides[index].fighter;
      const move = currentMove(fighter, definition);
      const phase = movePhase(fighter, move) ?? "—";
      const shown = frames?.[index];
      return `${name.padEnd(9)}${(action ?? "—").padEnd(8)}${fighter.mode.padEnd(10)}${(move?.id ?? "—").padEnd(10)}`
        + `${phase.padEnd(10)}${String(move ? fighter.moveFrame : fighter.stateFrame).padEnd(5)}`
        + `${shown ? `${shown.clip}@${shown.frame}` : "—"}  hp ${fighter.health}`;
    };
    const last = battle.history.at(-1);
    setText(debugText, [
      `tick ${battle.tick}  phase ${battle.phase}  round ${battle.round}  slot ${battle.actionIndex + 1}  bars ${battle.bars.join("/")}  exchange ${exchange?.stage ?? "—"}`,
      `         action  mode      move      phase     frame clip`,
      row("player", 0, exchange?.player ?? null),
      row("opponent", 1, exchange?.stage === "clash" ? exchange.opponent : null),
      `matchup  ${exchange ? `${exchange.player} vs ${exchange.opponent} → ${exchange.result}` : "—"}`,
      `last     ${last ? `round ${last.round} slot ${last.index + 1} ${last.player}/${last.opponent} → ${last.result}, lost ${last.damage[0]}/${last.damage[1]}, physics ${last.agrees ? "agrees" : "DISAGREES"}` : "—"}`,
    ].join("\n"));
    for (const { layer, input } of debugToggles) input.checked = debug?.[layer] ?? false;
  }

  function frame(now: number): void {
    const ticks = clock.advance(now - last, options.speed());
    last = now;
    if (stage !== null) for (let tick = 0; tick < ticks; tick++) match.step();
    draw();
    raf = requestAnimationFrame(frame);
  }

  const onKey = (event: KeyboardEvent): void => {
    // Development builds keep the lab tooling one key away; a normal player never sees it.
    if (import.meta.env.DEV && event.code === "Backquote") {
      debug = debug === null ? { boxes: true, skeleton: true } : null;
      event.preventDefault();
    }
  };
  window.addEventListener("keydown", onKey);

  Promise.all([loadFigureModel(PLAYER_FIGURE), loadFigureModel(OPPONENT_FIGURES[0])])
    .then((models) => {
      if (disposed) return;
      stage = new Stage(stageHost, models);
      clock.reset();
    })
    .catch((error: unknown) => {
      stageHost.replaceChildren(h("p", { class: "arena__error" }, `The fighters could not be loaded: ${(error as Error).message}`));
    });

  draw();
  raf = requestAnimationFrame(frame);
  return () => {
    disposed = true;
    cancelAnimationFrame(raf);
    stage?.dispose();
    window.removeEventListener("keydown", onKey);
    root.replaceChildren();
  };
}
