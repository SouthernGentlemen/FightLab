import { ACTION_TYPES, DEFAULT_ACTIONS } from "../battle/actions.ts";
import type { ActionType } from "../battle/actions.ts";
import type { MatchupResult } from "../battle/matchup.ts";
import type { ActionProgram } from "../battle/program.ts";
import { PROGRAM_LENGTH } from "../battle/program.ts";
import { currentMove, movePhase } from "../combat/kernel/index.ts";
import { FixedClock } from "../game/clock.ts";
import type { BattleSpeed } from "../game/clock.ts";
import { DEFAULT_MATCH, Match } from "../game/match.ts";
import { ROSTER } from "../game/roster.ts";
import type { ClipFrame } from "../render/animation.ts";
import { loadFigureModel } from "../render/figure.ts";
import { Stage } from "../render/stage.ts";
import type { DebugLayers, StageView } from "../render/stage.ts";
import { button, h, setText } from "./dom.ts";

export interface PlayOptions {
  readonly program: ActionProgram;
  speed(): BattleSpeed;
  /** Keeps the player's loop across visits to the title screen. */
  remember(program: ActionProgram): void;
  title(): void;
  readonly debug: boolean;
}

const LABELS = Object.fromEntries(ACTION_TYPES.map((action) => [action, DEFAULT_ACTIONS[action].label])) as Record<ActionType, string>;

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
 * The play screen: planning, the fight, and its result.
 *
 * Everything drawn here is read from the match every frame; the only writes are the player's own
 * commands — a slot, Fight, Rematch. The clock turns elapsed time into whole simulation ticks, and
 * battle speed only changes how many of those a frame owes.
 */
export function mountPlay(root: HTMLElement, options: PlayOptions): () => void {
  const match = new Match(DEFAULT_MATCH, options.program);
  const clock = new FixedClock();
  let stage: Stage | null = null;
  let debug: DebugLayers | null = options.debug ? { boxes: true, skeleton: true } : null;
  let frames: readonly [ClipFrame, ClipFrame] | null = null;
  let picking = -1;
  let raf = 0;
  let last = performance.now();
  let shownPhase = "";
  let disposed = false;

  const leave = (): void => {
    options.remember(match.battle.playerProgram);
    options.title();
  };

  const meters = (["player", "enemy"] as const).map((side) => {
    const value = h("b", { class: "meter__value" }, "100");
    const fill = h("i", { class: "meter__fill" });
    const track = h("div", { class: "meter__track", role: "meter", "aria-label": `${side} health`, "aria-valuemin": "0", "aria-valuemax": "100" },
      h("i", { class: "meter__trail" }), fill);
    const node = h("div", { class: `meter meter--${side}` },
      h("div", { class: "meter__label" }, h("span", {}, side === "player" ? "Player" : "Enemy"), value), track);
    return { node, value, fill, track };
  });
  const loop = h("span", { class: "hud__loop" });
  const back = button("Title", "link", leave);

  const stageHost = h("div", { class: "arena__stage" });
  const resultTitle = h("h2", { class: "result__title" });
  const resultNote = h("p", { class: "result__note" });
  const rematch = button("Rematch", "button button--primary", () => {
    match.rematch();
    clock.reset();
  });
  const result = h("div", { class: "result", hidden: "" }, resultTitle, resultNote,
    h("div", { class: "result__actions" }, rematch, button("Title", "button", leave)));
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

  const rules = h("p", { class: "rules" },
    chip("strike"), " beats ", chip("tech"), h("span", { class: "rules__gap" }, "·"),
    chip("tech"), " beats ", chip("block"), h("span", { class: "rules__gap" }, "·"),
    chip("block"), " beats ", chip("strike"));
  const you = chip(null);
  const enemy = chip(null);
  const slotLabel = h("span", { class: "matchup__slot" });
  const outcome = h("span", { class: "matchup__verdict" });
  const matchup = h("p", { class: "matchup", hidden: "" },
    slotLabel, h("span", { class: "matchup__side" }, "You"), you, h("span", { class: "matchup__vs" }, "vs"), enemy,
    h("span", { class: "matchup__side" }, "Enemy"), outcome);

  const slots = Array.from({ length: PROGRAM_LENGTH }, (_, index) => {
    const label = h("span", { class: "slot__label" });
    const node = h("button", { type: "button", class: "slot", "aria-haspopup": "menu" },
      h("span", { class: "slot__index" }, String(index + 1)), label);
    node.addEventListener("click", () => openPicker(index));
    return { node, label };
  });
  const fight = button("Fight", "fight", () => {
    if (match.battle.phase !== "planning" || stage === null) return;
    match.fight();
    clock.reset();
  });
  fight.disabled = true;

  const choices = ACTION_TYPES.map((action) => {
    const node = button(LABELS[action], "picker__option", () => choose(action));
    node.dataset.action = action;
    node.setAttribute("role", "menuitemradio");
    return node;
  });
  const picker = h("div", { class: "picker", popover: "auto", role: "menu", "aria-label": "Choose an action" }, ...choices);
  picker.addEventListener("toggle", (event) => {
    if ((event as ToggleEvent).newState === "closed") picking = -1;
  });

  const screen = h("main", { class: "screen play", "data-phase": "planning" },
    h("header", { class: "hud" }, meters[0].node, h("div", { class: "hud__center" }, loop, back), meters[1].node),
    h("section", { class: "arena" }, stageHost, result, ...(debug || import.meta.env.DEV ? [debugPanel] : [])),
    h("div", { class: "exchange", "aria-live": "polite" }, rules, matchup),
    h("section", { class: "program", "aria-label": "Your program" }, h("ol", { class: "slots" }, ...slots.map(({ node }) => h("li", {}, node))), fight),
    picker,
  );
  root.replaceChildren(screen);

  function openPicker(index: number): void {
    if (match.battle.phase !== "planning") return;
    picking = index;
    const current = match.battle.playerProgram[index];
    choices.forEach((node, option) => node.setAttribute("aria-checked", String(ACTION_TYPES[option] === current)));
    picker.showPopover();
    const anchor = slots[index].node.getBoundingClientRect();
    const box = picker.getBoundingClientRect();
    const left = Math.min(Math.max(8, anchor.left + anchor.width / 2 - box.width / 2), window.innerWidth - box.width - 8);
    picker.style.left = `${left}px`;
    picker.style.top = `${Math.max(8, anchor.top - box.height - 10)}px`;
    choices[ACTION_TYPES.indexOf(current)].focus();
  }

  function choose(action: ActionType): void {
    const slot = picking;
    if (slot < 0 || match.battle.phase !== "planning") return;
    match.setSlot(slot, action);
    options.remember(match.battle.playerProgram);
    picker.hidePopover();
    slots[slot].node.focus();
  }

  function stageView(): StageView {
    const { battle, arena } = match;
    const finished = battle.outcome !== null && match.endedAt !== null ? match.presentationTick - match.endedAt : null;
    const winners = [battle.outcome?.result === "victory", battle.outcome?.result === "defeat"];
    const context = winners.map((won) => ({
      idleFrame: battle.phase === "planning" ? match.presentationTick : null,
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
      back.hidden = phase !== "planning";
      rules.hidden = phase !== "planning";
      matchup.hidden = phase === "planning";
      result.hidden = phase !== "ko";
      slots.forEach(({ node }) => { node.disabled = phase !== "planning"; });
      fight.disabled = phase !== "planning" || stage === null;
      if (phase === "ko") rematch.focus();
      else if (phase === "planning" && shownPhase === "ko") fight.focus();
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
    // After a knockout the cursor has already moved past the final exchange; show the loop it ended in.
    const shownCycle = phase === "ko" ? battle.history.at(-1)?.cycle ?? battle.cycle : battle.cycle;
    setText(loop, phase === "planning" ? "" : `Loop ${shownCycle + 1}`);

    const resolving = phase === "fighting" ? battle.exchange?.index ?? battle.actionIndex : -1;
    slots.forEach(({ node, label }, index) => {
      const action = battle.playerProgram[index];
      if (node.dataset.action !== action) node.dataset.action = action;
      setText(label, LABELS[action]);
      node.setAttribute("aria-label", `Slot ${index + 1}: ${LABELS[action]}`);
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

    if (phase === "ko" && battle.outcome !== null) {
      const { result: final, reason } = battle.outcome;
      setText(resultTitle, final === "victory" ? "Victory" : final === "defeat" ? "Defeat" : "Draw");
      resultTitle.dataset.outcome = final;
      setText(resultNote, reason === "double-ko" ? "Double knockout" : reason === "stalemate" ? "Stalemate — a whole loop without a hit"
        : reason === "limit" ? "Time" : `${battle.history.length} exchanges`);
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
      `tick ${battle.tick}  phase ${battle.phase}  loop ${battle.cycle + 1}  slot ${battle.actionIndex + 1}  exchange ${exchange?.stage ?? "—"}`,
      `         action  mode      move      phase     frame clip`,
      row("player", 0, exchange?.player ?? null),
      row("opponent", 1, exchange?.stage === "clash" ? exchange.opponent : null),
      `matchup  ${exchange ? `${exchange.player} vs ${exchange.opponent} → ${exchange.result}` : "—"}`,
      `last     ${last ? `loop ${last.cycle + 1} slot ${last.index + 1} ${last.player}/${last.opponent} → ${last.result}, lost ${last.damage[0]}/${last.damage[1]}, physics ${last.agrees ? "agrees" : "DISAGREES"}` : "—"}`,
    ].join("\n"));
    for (const { layer, input } of debugToggles) input.checked = debug?.[layer] ?? false;
  }

  function frame(now: number): void {
    const speed = match.battle.phase === "fighting" ? options.speed() : 1;
    const ticks = clock.advance(now - last, speed);
    last = now;
    for (let tick = 0; tick < ticks; tick++) match.step();
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

  Promise.all([loadFigureModel(ROSTER.player), loadFigureModel(ROSTER.opponent)])
    .then((models) => {
      if (disposed) return;
      stage = new Stage(stageHost, models);
      fight.disabled = match.battle.phase !== "planning";
      if (match.battle.phase === "planning") fight.focus();
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
    if (picker.matches(":popover-open")) picker.hidePopover();
    root.replaceChildren();
  };
}
