import "./ui/styles.css";

import { defaultProgram } from "./battle/program.ts";
import type { ActionProgram } from "./battle/program.ts";
import { loadSettings, saveSettings } from "./game/settings.ts";
import type { Settings } from "./game/settings.ts";
import { mountPlay } from "./ui/play.ts";
import { mountSettings } from "./ui/settings.ts";
import { mountTitle } from "./ui/title.ts";

type Screen = "title" | "settings" | "play";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("index.html has no #app");

/** `?debug` is the one explicit way into the lab tooling; development servers also have a key for it. */
const debug = new URLSearchParams(window.location.search).has("debug");
let settings: Settings = loadSettings();
let program: ActionProgram = defaultProgram();
let unmount: () => void = () => {};

function show(screen: Screen): void {
  unmount();
  if (screen === "title") {
    unmount = mountTitle(root!, { play: () => show("play"), settings: () => show("settings") });
  } else if (screen === "settings") {
    unmount = mountSettings(root!, {
      settings,
      change: (next) => {
        settings = next;
        saveSettings(next);
      },
      back: () => show("title"),
    });
  } else {
    unmount = mountPlay(root!, {
      program,
      speed: () => settings.speed,
      remember: (next) => {
        program = next;
      },
      title: () => show("title"),
      debug,
    });
  }
}

show("title");
