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
 * Stage units. One world pixel is `scale` stage units, and the camera never moves: exchanges
 * are always fought from the same two marks, so a fixed frame keeps them the same size.
 * `minWidth` is as narrow as the frame gets on a tall screen — both marks, a full reach and a
 * knockback on either side still fit.
 */
export const STAGE = { width: 1000, minWidth: 520, height: 440, floor: 392, center: 500, scale: 3 } as const;

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

function element<K extends keyof SVGElementTagNameMap>(name: K, className?: string): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, name);
  if (className) node.setAttribute("class", className);
  return node;
}

function stageX(world: number): number {
  return STAGE.center + toPixels(world) * STAGE.scale;
}

function stageY(world: number): number {
  return STAGE.floor - toPixels(world - GROUND_Y) * STAGE.scale;
}

function rect(box: Aabb, className: string): SVGRectElement {
  const node = element("rect", className);
  node.setAttribute("x", stageX(box.x0).toFixed(2));
  node.setAttribute("y", stageY(box.y1).toFixed(2));
  node.setAttribute("width", (toPixels(box.x1 - box.x0) * STAGE.scale).toFixed(2));
  node.setAttribute("height", (toPixels(box.y1 - box.y0) * STAGE.scale).toFixed(2));
  return node;
}

/** Draws what combat and battle state say. It reads that state and never writes it. */
export class Stage {
  readonly svg: SVGSVGElement;
  private readonly figures: readonly [FigureView, FigureView];
  private readonly shadows: readonly [SVGEllipseElement, SVGEllipseElement];
  private readonly debugLayer: SVGGElement;
  private readonly resize: ResizeObserver;

  constructor(host: HTMLElement, models: readonly [FigureModel, FigureModel]) {
    this.svg = element("svg", "stage");
    this.frame(host.clientWidth, host.clientHeight);
    this.resize = new ResizeObserver(() => this.frame(host.clientWidth, host.clientHeight));
    this.resize.observe(host);
    this.svg.setAttribute("preserveAspectRatio", "xMidYMax meet");
    this.svg.setAttribute("role", "img");
    this.svg.setAttribute("aria-label", "Arena");

    const floor = element("line", "stage__floor");
    floor.setAttribute("x1", "0");
    floor.setAttribute("x2", String(STAGE.width));
    floor.setAttribute("y1", String(STAGE.floor));
    floor.setAttribute("y2", String(STAGE.floor));

    this.shadows = [element("ellipse", "stage__shadow"), element("ellipse", "stage__shadow")];
    for (const shadow of this.shadows) {
      shadow.setAttribute("cy", String(STAGE.floor));
      shadow.setAttribute("rx", String(22 * STAGE.scale));
      shadow.setAttribute("ry", String(3 * STAGE.scale));
    }
    this.figures = [new FigureView(models[0], "player"), new FigureView(models[1], "opponent")];
    this.debugLayer = element("g", "debug-geometry");
    this.svg.append(floor, ...this.shadows, this.figures[0].root, this.figures[1].root, this.debugLayer);
    host.replaceChildren(this.svg);
  }

  dispose(): void {
    this.resize.disconnect();
  }

  /** Crops the sides on a tall screen, around the centre, so the fighters stay large. */
  private frame(width: number, height: number): void {
    const aspect = width > 0 && height > 0 ? width / height : STAGE.width / STAGE.height;
    const visible = Math.min(STAGE.width, Math.max(STAGE.minWidth, STAGE.height * aspect));
    this.svg.setAttribute("viewBox", `${(STAGE.center - visible / 2).toFixed(1)} 0 ${visible.toFixed(1)} ${STAGE.height}`);
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
      const marker = element("path", "debug-origin");
      marker.setAttribute("d", `M${stageX(origin.x) - 8} ${stageY(origin.y)}h16M${stageX(origin.x)} ${stageY(origin.y) - 8}v16`);
      nodes.push(marker);
    }
    this.debugLayer.replaceChildren(...nodes);
  }
}
