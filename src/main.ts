import "./ui/styles.css";

import { loadSettings, saveSettings } from "./game/settings.ts";
import type { Settings } from "./game/settings.ts";
import { isSeed, MAX_SEED } from "./run/random.ts";
import { beginFight, finishFight, newRun, nextDay } from "./run/run.ts";
import type { RunState } from "./run/run.ts";
import { clearSave, readSave, writeSave } from "./run/save.ts";
import { mountFight } from "./ui/fight.ts";
import { mountPayday } from "./ui/payday.ts";
import { mountPrep } from "./ui/prep.ts";
import { mountRunEnd } from "./ui/runend.ts";
import { mountSettings } from "./ui/settings.ts";
import { mountTitle } from "./ui/title.ts";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("index.html has no #app");

const params = new URLSearchParams(window.location.search);
/** `?debug` is the one explicit way into the lab tooling; development servers also have a key for it. */
const debug = params.has("debug");
let settings: Settings = loadSettings();
const saved = readSave();
let run: RunState | null = saved?.run ?? null;
/** The player's Mixup decisions in the fight in progress. */
let decisions: boolean[] = [...(saved?.fight?.decisions ?? [])];
let unmount: () => void = () => {};

/**
 * The one unseeded value in the game: a new run's seed. `?seed=<n>` chooses it, so a run can be
 * shared or replayed; everything after it is drawn from it.
 */
function freshSeed(): number {
  const chosen = Number(params.get("seed") ?? Number.NaN);
  if (isSeed(chosen)) return chosen;
  return crypto.getRandomValues(new Uint32Array(1))[0] % (MAX_SEED + 1);
}

function save(): void {
  if (run !== null) writeSave(run, run.phase === "fight" ? { decisions } : null);
}

function mount(next: () => () => void): void {
  unmount();
  unmount = next();
}

function showTitle(): void {
  mount(() => mountTitle(root!, { saved: run !== null, continueRun: resume, newRun: startRun, settings: () => showSettings(showTitle) }));
}

function showSettings(back: () => void): void {
  mount(() => mountSettings(root!, {
    settings,
    change: (next) => {
      settings = next;
      saveSettings(next);
    },
    back,
  }));
}

function startRun(): void {
  run = newRun(freshSeed());
  decisions = [];
  save();
  resume();
}

/** Whatever the run is doing, the screen for it. */
function resume(): void {
  if (run === null) return showTitle();
  const current = run;
  if (current.phase === "prep") {
    mount(() => mountPrep(root!, {
      run: current,
      changed: save,
      fight: () => {
        if (beginFight(current) !== null) return;
        decisions = [];
        save();
        resume();
      },
      settings: () => showSettings(resume),
      leave: showTitle,
    }));
  } else if (current.phase === "fight") {
    mount(() => mountFight(root!, {
      run: current,
      decisions,
      speed: () => settings.speed,
      setSpeed: (speed) => {
        settings = { ...settings, speed };
        saveSettings(settings);
      },
      decided: (made) => {
        decisions = [...made];
        save();
      },
      finished: (report) => {
        finishFight(current, report);
        decisions = [];
        save();
        resume();
      },
      debug,
    }));
  } else if (current.phase === "payday") {
    mount(() => mountPayday(root!, {
      run: current,
      next: () => {
        nextDay(current);
        save();
        resume();
      },
    }));
  } else {
    mount(() => mountRunEnd(root!, {
      run: current,
      newRun: startRun,
      title: () => {
        run = null;
        clearSave();
        showTitle();
      },
    }));
  }
}

showTitle();
