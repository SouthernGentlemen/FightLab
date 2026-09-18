import type { ActionType } from "../battle/actions.ts";
import { BAR_IDS, BAR_LENGTH, otherBar, sameBar } from "../battle/bars.ts";
import { activeBar } from "../battle/director.ts";
import type { BattleState, OutcomeReason } from "../battle/director.ts";
import type { MatchupResult } from "../battle/matchup.ts";
import { currentMove, movePhase } from "../combat/kernel/index.ts";
import { FixedClock, SPEEDS } from "../game/clock.ts";
import type { BattleSpeed } from "../game/clock.ts";
import { fightFor, reportOf, resumeFight } from "../game/fight.ts";
import { PLAYER_FIGURE } from "../game/roster.ts";
import type { ClipFrame } from "../render/animation.ts";
import { loadFigureModel } from "../render/figure.ts";
import { Stage } from "../render/stage.ts";
import type { DebugLayers, StageView } from "../render/stage.ts";
import type { FightReport, RunState } from "../run/run.ts";
import { presentable } from "./display.ts";
import { button, h, icon, replay, setData, setText } from "./dom.ts";
import { heartsMeter } from "./hearts.ts";
import { ACTION_LABEL, BAR_NAME, actionChip, bevel, paintChip, styleMeter } from "./kit.ts";

export interface FightOptions {
  readonly run: RunState;
  /** The Mixup decisions already made in this fight, to resume it where it was. */
  readonly decisions: readonly boolean[];
  speed(): BattleSpeed;
  setSpeed(speed: BattleSpeed): void;
  /** Called at every pause the player leaves, so the fight can be resumed from here. */
  decided(decisions: readonly boolean[]): void;
  finished(report: FightReport): void;
  readonly debug: boolean;
}

const EARLIER_ROUNDS = 3;
/** Presentation ticks the FIGHT! call stays up once a round's exchanges begin. */
const CALL_TICKS = 40;

function verdict(player: ActionType, opponent: ActionType, result: MatchupResult): string {
  if (result === "tie") return player === "block" ? "Both guard" : "Trade";
  const winner = result === "player" ? player : opponent;
  return `${ACTION_LABEL[winner]} wins`;
}

const REASONS: Readonly<Record<OutcomeReason, string>> = {
  "ko": "Knockout",
  "double-ko": "Double knockout",
  "stalemate": "Stalemate — nobody could be hurt",
  "limit": "Thirty rounds",
};

/** The opponent's action in each slot of `round`, as far as the player has seen it. */
function revealed(battle: BattleState, round: number): Array<ActionType | null> {
  const seen: Array<ActionType | null> = Array.from({ length: BAR_LENGTH }, () => null);
  for (const record of battle.history) if (record.round === round) seen[record.index] = record.opponent;
  const exchange = battle.exchange;
  if (exchange !== null && exchange.round === round && exchange.stage === "clash") seen[exchange.index] = exchange.opponent;
  return seen;
}

/**
 * The fight: rounds, the pause between them, and the knockout.
 *
 * Everything drawn is read from the match every frame; the only writes are the player's own
 * decisions — Mixup and Fight at a pause, Continue after the knockout. The clock turns elapsed time
 * into whole simulation ticks, and battle speed only changes how many a frame owes.
 */
export function mountFight(root: HTMLElement, options: FightOptions): () => void {
  const { opponent, config } = fightFor(options.run);
  const match = resumeFight(config, options.decisions);
  const clock = new FixedClock();
  let stage: Stage | null = null;
  let debug: DebugLayers | null = options.debug ? { boxes: true, skeleton: true } : null;
  let frames: readonly [ClipFrame, ClipFrame] | null = null;
  let raf = 0;
  let last = performance.now();
  let shownPhase = "";
  let shownRound = 0;
  let fightingSince: number | null = null;
  let disposed = false;
  let opponentName = opponent.figure.toUpperCase();

  // Top of the screen: style, health, the round.
  const styles = [styleMeter("player"), styleMeter("opponent")] as const;
  const health = [heartsMeter("Your"), heartsMeter("Their", true)] as const;
  const names = [h("span", { class: "hud__name stroke" }, "You"), h("span", { class: "hud__name stroke" }, opponentName)];
  const round = h("div", { class: "hud__round stroke" });
  const speedLabel = h("span", { class: "stroke" });
  const speed = button(speedLabel, "btn btn--sm hud__speed", () => {
    const next = SPEEDS[(SPEEDS.indexOf(options.speed()) + 1) % SPEEDS.length];
    options.setSpeed(next);
  }, { "aria-label": "Battle speed" });
  speed.prepend(icon("speed"));
  speed.style.setProperty("--c", "var(--rose)");

  // Bottom of the screen: your bar, the exchange, what you have seen of them.
  const barName = h("b", { class: "stroke" });
  const barChips = Array.from({ length: BAR_LENGTH }, () => actionChip(null, "chip chip--big"));
  const otherName = h("small", { class: "stroke" });
  const otherChips = Array.from({ length: BAR_LENGTH }, () => actionChip(null, "chip chip--small"));
  const yourBar = h("section", { class: "hud__bar", "aria-label": "Your active bar" },
    h("p", { class: "hud__label" }, barName), h("div", { class: "hud__chips" }, ...barChips),
    h("p", { class: "hud__other" }, otherName, ...otherChips));
  const yours = actionChip(null, "chip chip--big");
  const theirs = actionChip(null, "chip chip--big");
  const call = h("p", { class: "exchange__verdict stroke" });
  const exchange = h("section", { class: "hud__exchange", "aria-live": "polite" },
    h("div", { class: "exchange__pair" }, yours, h("b", { class: "exchange__vs stroke" }, "vs"), theirs), call);
  const foeName = h("b", { class: "stroke" });
  const foeRows = Array.from({ length: EARLIER_ROUNDS + 1 }, () => {
    const label = h("small", { class: "stroke" });
    const chips = Array.from({ length: BAR_LENGTH }, () => actionChip(null, "chip chip--small"));
    return { label, chips, node: h("p", { class: "foe__row" }, label, ...chips) };
  });
  const foe = h("section", { class: "hud__foe", "aria-label": "What you have seen them do" }, h("p", { class: "hud__label" }, foeName),
    ...foeRows.map(({ node }) => node));

  const banner = h("div", { class: "banner stroke", "aria-live": "assertive" });

  // The pause: both bars, Mixup and Fight.
  const pauseTitle = h("h2", { class: "pause__title stroke" });
  const pauseNote = h("p", { class: "pause__note" });
  const pauseBars = BAR_IDS.map((bar) => {
    const chips = Array.from({ length: BAR_LENGTH }, () => actionChip(null, "chip chip--big"));
    const marker = h("b", { class: "pause__marker" });
    return { bar, chips, marker, node: h("div", { class: "pause__bar" }, h("b", { class: "pause__name" }, BAR_NAME[bar]), ...chips, marker) };
  });
  const warning = h("p", { class: "pause__warning", hidden: "" }, "Nobody was hurt. The same bars again is a draw.");
  const mixupNote = h("small", {});
  const mixupButton = bevel("Mixup", "sky", () => mixup(), "pause__mixup");
  mixupButton.append(mixupNote);
  const fightNote = h("small", {});
  const fightButton = bevel("Fight", "rose", () => fight(), "pause__fight");
  fightButton.append(fightNote);
  const pause = h("section", { class: "pause", "aria-label": "Between rounds", hidden: "" },
    pauseTitle, pauseNote, ...pauseBars.map(({ node }) => node), warning,
    h("div", { class: "pause__actions" }, mixupButton, fightButton));

  // The knockout.
  const resultTitle = h("h2", { class: "result__title stroke" });
  const resultNote = h("p", { class: "result__note stroke" });
  const continueButton = bevel("Continue", "rose", () => options.finished(reportOf(match)), "result__continue");
  const result = h("section", { class: "result", hidden: "" }, resultTitle, resultNote, continueButton);

  const stageHost = h("div", { class: "fight__arena" });
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

  const screen = h("main", { class: "screen fight" },
    stageHost,
    h("div", { class: "fight__dim" }),
    h("header", { class: "hud__top" },
      styles[0].node,
      h("div", { class: "hud__health" }, names[0], health[0].node),
      h("div", { class: "hud__center" }, round, speed),
      h("div", { class: "hud__health hud__health--opponent" }, names[1], health[1].node),
      styles[1].node),
    yourBar, exchange, foe, banner, pause, result,
    ...(debug || import.meta.env.DEV ? [debugPanel] : []));
  root.replaceChildren(screen);

  /** Focus goes back to Fight, so Enter always fights and M always mixes up. */
  function mixup(): void {
    if (!match.paused) return;
    match.mixup();
    replay(pause, "is-swapped");
    fightButton.focus();
  }

  function fight(): void {
    if (!match.paused) return;
    match.nextRound();
    clock.reset();
    options.decided([...match.decisions]);
  }

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

  function drawPause(battle: BattleState): void {
    const last = battle.rounds.at(-1)!;
    setText(pauseTitle, `Round ${last.round} over`);
    const [won, lost] = last.wins;
    setText(pauseNote, won > lost ? `You took ${won} of ${last.exchanges}` : lost > won ? `They took ${lost} of ${last.exchanges}` : "Even round");
    for (const { bar, chips, marker, node } of pauseBars) {
      battle.playerLoadout[bar].forEach((action, index) => paintChip(chips[index], action));
      const active = battle.bars[0] === bar;
      node.classList.toggle("is-active", active);
      setText(marker, active ? "Active" : "");
    }
    setText(mixupNote, `Switch to ${BAR_NAME[otherBar(battle.bars[0])]}`);
    setText(fightNote, `Round ${battle.round + 1}`);
    const repeats = sameBar(battle.playerLoadout[last.bars[0]], battle.playerLoadout[battle.bars[0]]);
    warning.hidden = !(last.damage[0] === 0 && last.damage[1] === 0 && repeats);
  }

  function draw(): void {
    const { battle, arena } = match;
    const phase = battle.phase;
    if (phase !== shownPhase) {
      screen.dataset.phase = phase;
      pause.hidden = phase !== "round-pause";
      result.hidden = phase !== "ko";
      if (phase === "round-pause") {
        drawPause(battle);
        fightButton.focus();
      }
      if (phase === "fighting") fightingSince = match.presentationTick;
      if (phase === "ko") continueButton.focus();
      shownPhase = phase;
    }
    if (phase === "round-pause") drawPause(battle);
    if (stage !== null) frames = stage.render(stageView(), debug);

    arena.state.fighters.forEach((fighter, index) => health[index].update(fighter.health, arena.sides[index].fighter.maxHealth));
    const [mine, theirsStyle] = match.style();
    styles[0].update(mine);
    styles[1].update(theirsStyle);
    setText(round, phase === "ko" ? "K.O." : `Round ${battle.round}`);
    setText(speedLabel, `${options.speed()}×`);
    setText(names[1], opponentName);

    // The banner calls the round, then FIGHT!, then gets out of the way.
    if (battle.round !== shownRound && phase === "round-intro") {
      shownRound = battle.round;
      replay(banner, "is-in");
    }
    const calling = phase === "fighting" && fightingSince !== null && match.presentationTick - fightingSince < CALL_TICKS;
    setText(banner, phase === "round-intro" ? `Round ${battle.round}` : calling ? "Fight!" : "");
    banner.hidden = banner.textContent === "";

    const bar = activeBar(battle, 0);
    const resolving = phase === "fighting" ? battle.exchange?.index ?? battle.actionIndex : -1;
    setText(barName, `${BAR_NAME[battle.bars[0]]}${battle.mixedUp[0] ? " · mixed up" : ""}`);
    barChips.forEach((chip, index) => {
      paintChip(chip, bar[index]);
      chip.classList.toggle("is-now", index === resolving);
      chip.classList.toggle("is-done", phase === "fighting" && index < resolving);
    });
    const other = otherBar(battle.bars[0]);
    setText(otherName, BAR_NAME[other]);
    otherChips.forEach((chip, index) => paintChip(chip, battle.playerLoadout[other][index]));

    // The last exchange stays up until the next one opens, except across a round's intro.
    const current = battle.exchange ?? null;
    const shown = current ?? (phase === "round-intro" ? null : battle.history.at(-1) ?? null);
    if (shown === null) {
      paintChip(yours, null);
      paintChip(theirs, null);
      setText(call, "");
    } else {
      const clashed = current === null || current.stage === "clash";
      paintChip(yours, shown.player);
      paintChip(theirs, clashed ? shown.opponent : null);
      setText(call, clashed ? verdict(shown.player, shown.opponent, shown.result) : `Slot ${shown.index + 1}`);
      setData(call, "winner", clashed ? shown.result : "");
    }

    setText(foeName, opponentName);
    foeRows.forEach(({ label, chips, node }, row) => {
      const number = battle.round - row;
      node.hidden = number < 1;
      if (number < 1) return;
      setText(label, row === 0 && phase !== "round-pause" && phase !== "ko" ? "This round" : `Round ${number}`);
      revealed(battle, number).forEach((action, index) => paintChip(chips[index], action));
    });

    if (phase === "ko" && battle.outcome !== null) {
      const { result: final, reason } = battle.outcome;
      setText(resultTitle, final === "victory" ? "Victory" : final === "defeat" ? "Defeat" : "Draw");
      setData(resultTitle, "outcome", final);
      setText(resultNote, `${REASONS[reason]} · ${battle.round} round${battle.round === 1 ? "" : "s"}`);
    }
    if (debug !== null) drawDebug();
    debugPanel.hidden = debug === null;
  }

  function drawDebug(): void {
    const { battle, arena } = match;
    const current = battle.exchange;
    const row = (name: string, index: 0 | 1, action: ActionType | null): string => {
      const fighter = arena.state.fighters[index];
      const definition = arena.sides[index].fighter;
      const move = currentMove(fighter, definition);
      const moveState = movePhase(fighter, move) ?? "—";
      const shown = frames?.[index];
      return `${name.padEnd(9)}${(action ?? "—").padEnd(8)}${fighter.mode.padEnd(10)}${(move?.id ?? "—").padEnd(10)}`
        + `${moveState.padEnd(10)}${String(move ? fighter.moveFrame : fighter.stateFrame).padEnd(5)}`
        + `${shown ? `${shown.clip}@${shown.frame}` : "—"}  hp ${fighter.health}  +${fighter.bonus}`;
    };
    const lastRecord = battle.history.at(-1);
    setText(debugText, [
      `tick ${battle.tick}  phase ${battle.phase}  round ${battle.round}  slot ${battle.actionIndex + 1}  bars ${battle.bars.join("/")}  mixed ${battle.mixedUp.join("/")}`,
      `         action  mode      move      phase     frame clip`,
      row("player", 0, current?.player ?? null),
      row("opponent", 1, current?.stage === "clash" ? current.opponent : null),
      `matchup  ${current ? `${current.player} vs ${current.opponent} → ${current.result}` : "—"}`,
      `last     ${lastRecord ? `r${lastRecord.round} s${lastRecord.index + 1} ${lastRecord.player}/${lastRecord.opponent} → ${lastRecord.result}, lost ${lastRecord.damage.join("/")}, healed ${lastRecord.healing.join("/")}, physics ${lastRecord.agrees ? "agrees" : "DISAGREES"}` : "—"}`,
      `opponent ${opponent.archetype}, ${opponent.plan.mixup.kind}`,
    ].join("\n"));
    for (const { layer, input } of debugToggles) input.checked = debug?.[layer] ?? false;
  }

  function frame(now: number): void {
    const ticks = clock.advance(now - last, options.speed());
    last = now;
    // A hidden playfield holds the fight where it is; turning the device back picks it up there.
    if (!presentable()) clock.reset();
    else if (stage !== null) for (let tick = 0; tick < ticks; tick++) match.step();
    draw();
    raf = requestAnimationFrame(frame);
  }

  const onKey = (event: KeyboardEvent): void => {
    // Development builds keep the lab tooling one key away; a normal player never sees it.
    if (import.meta.env.DEV && event.code === "Backquote") {
      debug = debug === null ? { boxes: true, skeleton: true } : null;
      event.preventDefault();
      return;
    }
    if (!match.paused) return;
    // M mixes up and Enter or Space fights, wherever focus happens to be in the pause.
    if (event.key === "m" || event.key === "M") {
      event.preventDefault();
      mixup();
    } else if ((event.key === "Enter" || event.key === " ") && document.activeElement !== speed) {
      event.preventDefault();
      if (document.activeElement === mixupButton) mixup();
      else fight();
    }
  };
  window.addEventListener("keydown", onKey);

  Promise.all([loadFigureModel(PLAYER_FIGURE), loadFigureModel(opponent.figure)])
    .then((models) => {
      if (disposed) return;
      stage = new Stage(stageHost, models);
      opponentName = models[1].name.toUpperCase();
      clock.reset();
    })
    .catch((error: unknown) => {
      stageHost.replaceChildren(h("p", { class: "fight__error" }, `The fighters could not be loaded: ${(error as Error).message}`));
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
