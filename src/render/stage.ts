import { depthProfileName, sampleClip } from "boneyard";

import { GROUND_Y, debugBoxes, toPixels } from "../combat/kernel/index.ts";
import type { Aabb, FighterDefinition, FrameReport, SimulationState } from "../combat/kernel/index.ts";
import { animationFor } from "./animation.ts";
import type { AnimationContext, ClipFrame } from "./animation.ts";
import { clipNamed, clipOrigin } from "./clips.ts";
import { FigureView } from "./figure.ts";
import type { FigureModel } from "./figure.ts";

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Stage units: the same 1600 × 900 grid every screen is authored on, so the arena and the HUD over
 * it scale as one picture. One world pixel is `scale` stage units and the camera never moves:
 * exchanges are always fought from the same two marks, and knockback never carries a fighter more
 * than about seventy pixels from the centre, well inside the frame.
 */
export const STAGE = { width: 1600, height: 900, floor: 700, center: 800, scale: 4 } as const;

export interface StageView {
  readonly combat: SimulationState;
  readonly definitions: readonly [FighterDefinition, FighterDefinition];
  readonly report: FrameReport | null;
  readonly context: readonly [AnimationContext, AnimationContext];
}

export interface DebugLayers {
  readonly boxes: boolean;
  readonly skeleton: boolean;
}

function element<K extends keyof SVGElementTagNameMap>(name: K, attributes: Readonly<Record<string, string | number>> = {}): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

function stageX(world: number): number {
  return STAGE.center + toPixels(world) * STAGE.scale;
}

function stageY(world: number): number {
  return STAGE.floor - toPixels(world - GROUND_Y) * STAGE.scale;
}

function rect(box: Aabb, className: string): SVGRectElement {
  return element("rect", {
    class: className,
    x: stageX(box.x0).toFixed(2),
    y: stageY(box.y1).toFixed(2),
    width: (toPixels(box.x1 - box.x0) * STAGE.scale).toFixed(2),
    height: (toPixels(box.y1 - box.y0) * STAGE.scale).toFixed(2),
  });
}

/** A row of pines: one path of triangles, each a little different, repeating across the frame. */
function pines(baseline: number, height: number, width: number, step: number, offset: number): string {
  let path = "";
  for (let x = -width + offset, index = 0; x < STAGE.width + width; x += step, index++) {
    const tall = height * (0.82 + ((index * 37) % 7) / 30);
    path += `M${x} ${baseline}l${width / 2} ${-tall}l${width / 2} ${tall}z`;
    path += `M${x + width * 0.14} ${baseline - tall * 0.42}l${width * 0.36} ${-tall * 0.36}l${width * 0.36} ${tall * 0.36}z`;
  }
  return path;
}

/** Flat sky, a sun, two rows of pines and a striped grass field — original art, drawn here. */
function scene(): SVGGElement {
  const group = element("g", { class: "scene", "aria-hidden": "true" });
  const defs = element("defs");
  const sky = element("linearGradient", { id: "fightlab-sky", x1: 0, y1: 0, x2: 0, y2: 1 });
  sky.append(element("stop", { offset: "0", "stop-color": "#6cc6ff" }), element("stop", { offset: "1", "stop-color": "#c9ecff" }));
  defs.append(sky);
  group.append(
    defs,
    element("rect", { x: 0, y: 0, width: STAGE.width, height: STAGE.floor, fill: "url(#fightlab-sky)" }),
    element("circle", { cx: 1290, cy: 190, r: 70, fill: "#fff6c9" }),
    element("circle", { cx: 1290, cy: 190, r: 52, fill: "#ffe98a" }),
  );
  for (const [x, y, size] of [[250, 170, 1], [640, 110, 0.7], [1010, 210, 0.85], [1480, 90, 0.6]] as const) {
    const cloud = element("g", { fill: "#ffffff", opacity: "0.9", transform: `translate(${x} ${y}) scale(${size})` });
    cloud.append(
      element("ellipse", { cx: 0, cy: 0, rx: 90, ry: 30 }),
      element("ellipse", { cx: -34, cy: -18, rx: 44, ry: 32 }),
      element("ellipse", { cx: 28, cy: -26, rx: 52, ry: 40 }),
    );
    group.append(cloud);
  }
  group.append(
    element("path", { d: `M0 ${STAGE.floor - 150}Q400 ${STAGE.floor - 230} 800 ${STAGE.floor - 160}T1600 ${STAGE.floor - 170}V${STAGE.floor}H0z`, fill: "#a7dcae" }),
    element("path", { d: pines(STAGE.floor - 30, 150, 86, 70, 10), fill: "#3f9a5c" }),
    element("path", { d: pines(STAGE.floor + 6, 190, 112, 96, 48), fill: "#2a7a47" }),
    element("rect", { x: 0, y: STAGE.floor, width: STAGE.width, height: STAGE.height - STAGE.floor, fill: "#98d86c" }),
  );
  for (let band = 0; band < 5; band++) {
    const top = STAGE.floor + 18 + band * band * 9 + band * 14;
    group.append(element("rect", { x: 0, y: top, width: STAGE.width, height: 8 + band * 4, fill: "#86ca5c" }));
  }
  group.append(element("rect", { x: 0, y: STAGE.floor - 2, width: STAGE.width, height: 6, fill: "#6fb44c" }));
  return group;
}

/** Draws what combat and battle state say. It reads that state and never writes it. */
export class Stage {
  readonly svg: SVGSVGElement;
  private readonly figures: readonly [FigureView, FigureView];
  private readonly shadows: readonly [SVGEllipseElement, SVGEllipseElement];
  private readonly debugLayer: SVGGElement;

  constructor(host: HTMLElement, models: readonly [FigureModel, FigureModel]) {
    this.svg = element("svg", { class: "stage", viewBox: `0 0 ${STAGE.width} ${STAGE.height}`, preserveAspectRatio: "xMidYMid slice", role: "img", "aria-label": "Arena" });
    this.shadows = [0, 1].map(() => element("ellipse", {
      class: "stage__shadow", cy: STAGE.floor + 4, rx: 22 * STAGE.scale, ry: 4 * STAGE.scale,
    })) as unknown as readonly [SVGEllipseElement, SVGEllipseElement];
    this.figures = [new FigureView(models[0], "player"), new FigureView(models[1], "opponent")];
    this.debugLayer = element("g", { class: "debug-geometry" });
    this.svg.append(scene(), ...this.shadows, this.figures[0].root, this.figures[1].root, this.debugLayer);
    host.replaceChildren(this.svg);
  }

  dispose(): void {
    this.svg.remove();
  }

  render(view: StageView, debug: DebugLayers | null): readonly [ClipFrame, ClipFrame] {
    const frames = view.combat.fighters.map((fighter, index) => {
      const figure = this.figures[index];
      const clip = animationFor(fighter, view.definitions[index], view.context[index]);
      const profile = depthProfileName(figure.model.rig, clip.clip, clipOrigin(clip.clip));
      const placed = figure.pose(sampleClip(clipNamed(clip.clip), clip.frame), fighter.facing, profile);
      figure.place(stageX(fighter.x), STAGE.floor, fighter.facing, STAGE.scale);
      figure.drawSkeleton(debug?.skeleton ? placed : null);
      this.shadows[index].setAttribute("cx", stageX(fighter.x).toFixed(2));
      return clip;
    }) as unknown as readonly [ClipFrame, ClipFrame];

    this.debugLayer.replaceChildren();
    if (debug?.boxes) this.drawBoxes(view);
    return frames;
  }

  private drawBoxes(view: StageView): void {
    const boxes = debugBoxes(view.combat, view.definitions);
    const nodes: SVGElement[] = [];
    boxes.pushboxes.forEach((box) => nodes.push(rect(box, "debug-box debug-box--push")));
    boxes.hurtboxes.forEach((list, index) => {
      const className = boxes.parrying[index] ? "debug-box debug-box--parry" : "debug-box debug-box--hurt";
      for (const box of list) nodes.push(rect(box, className));
    });
    for (const box of boxes.hitboxes.flat()) nodes.push(rect(box, "debug-box debug-box--hit"));
    for (const contact of view.report?.contacts ?? []) {
      nodes.push(rect(contact.overlap, contact.parried ? "debug-box debug-box--parried" : "debug-box debug-box--contact"));
    }
    for (const origin of boxes.origins) {
      nodes.push(element("path", {
        class: "debug-origin",
        d: `M${stageX(origin.x) - 8} ${stageY(origin.y)}h16M${stageX(origin.x)} ${stageY(origin.y) - 8}v16`,
      }));
    }
    this.debugLayer.replaceChildren(...nodes);
  }
}
