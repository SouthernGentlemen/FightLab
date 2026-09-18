import { forwardKinematics, inBone, validateRig } from "boneyard";
import type { Placed, Pose, Rig } from "boneyard";
import { visualPaintOrder } from "boneyard/render/depth";

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * A roster figure as `pipelines/figures.ts` serves it: the rig exactly as Boneyard wrote it, and
 * the markup Boneyard's own assembly placed in each bone's depth slots.
 */
export interface FighterArt {
  readonly contract: 1;
  readonly figure: string;
  readonly name: string;
  readonly rig: unknown;
  readonly bones: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

export interface FigureModel {
  readonly figure: string;
  readonly name: string;
  readonly rig: Rig;
  readonly bones: FighterArt["bones"];
}

export async function loadFigureModel(figure: string, base = document.baseURI): Promise<FigureModel> {
  const response = await fetch(new URL(`fighters/${figure}.json`, base));
  if (!response.ok) throw new Error(`fighter art '${figure}' is unavailable (${response.status})`);
  return figureModel(await response.json() as FighterArt);
}

export function figureModel(art: FighterArt): FigureModel {
  if (art.contract !== 1) throw new Error(`fighter art '${art.figure}' has an unsupported contract`);
  const rig = validateRig(art.rig);
  for (const bone of rig.bones) {
    const layers = art.bones[bone.name];
    if (!layers || rig.contract.depthSlots.some((slot) => typeof layers[slot] !== "string")) {
      throw new Error(`fighter art '${art.figure}' has no assembled layers for '${bone.name}'`);
    }
  }
  return { figure: art.figure, name: art.name, rig, bones: art.bones };
}

function element<K extends keyof SVGElementTagNameMap>(name: K, className?: string): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, name);
  if (className) node.setAttribute("class", className);
  return node;
}

function number(value: number): string {
  return (Math.abs(value) < 0.0005 ? 0 : value).toFixed(3);
}

/**
 * One fighter on the stage: a flat group per bone, each carrying its depth slots.
 *
 * This is the shape Boneyard's contact sheets draw, not SVGLab's nested hierarchy: every bone's
 * world transform comes from Boneyard's forward kinematics and the groups paint in Boneyard's
 * `visualPaintOrder`, so there is no second composition of the skeleton to disagree with the
 * first.
 */
export class FigureView {
  readonly model: FigureModel;
  readonly root: SVGGElement;
  private readonly body: SVGGElement;
  private readonly bones = new Map<string, SVGGElement>();
  private readonly skeleton: SVGGElement;
  private painted = "";

  constructor(model: FigureModel, side: "player" | "opponent") {
    this.model = model;
    this.root = element("g", `fighter fighter--${side}`);
    this.root.dataset.figure = model.figure;
    this.body = element("g", "fighter__body");
    for (const bone of model.rig.bones) {
      const group = element("g");
      group.dataset.bone = bone.name;
      for (const slot of model.rig.contract.depthSlots) {
        const layer = element("g");
        layer.dataset.depth = slot;
        // Boneyard's traced markup, validated by Boneyard's loader before it was served.
        layer.innerHTML = model.bones[bone.name][slot];
        group.appendChild(layer);
      }
      this.bones.set(bone.name, group);
    }
    this.skeleton = element("g", "skeleton");
    this.root.append(this.body, this.skeleton);
  }

  /** Pose every bone and repaint in depth order. Returns the placements, for the skeleton. */
  pose(pose: Pose, facing: 1 | -1, profile: string): ReadonlyMap<string, Placed> {
    const placed = forwardKinematics(this.model.rig, pose);
    for (const [name, group] of this.bones) {
      const world = placed.get(name)!;
      group.setAttribute("transform", `translate(${number(world.x)} ${number(world.y)}) rotate(${number(world.rotation * 180 / Math.PI)})`);
    }
    const key = `${facing}:${profile}`;
    if (key !== this.painted) {
      this.body.replaceChildren(...visualPaintOrder(this.model.rig, facing, profile).map((name) => this.bones.get(name)!));
      this.painted = key;
    }
    return placed;
  }

  /** Stage placement. The whole figure mirrors to face left, as Boneyard's sheets do. */
  place(x: number, y: number, facing: 1 | -1, scale: number): void {
    this.root.setAttribute("transform", `translate(${number(x)} ${number(y)}) scale(${facing * scale} ${scale})`);
  }

  /** The FK skeleton, drawn in rig space so it mirrors with the figure. Debug only. */
  drawSkeleton(placed: ReadonlyMap<string, Placed> | null): void {
    if (placed === null) {
      this.skeleton.replaceChildren();
      return;
    }
    const nodes: SVGElement[] = [];
    for (const bone of this.model.rig.bones) {
      const at = placed.get(bone.name)!;
      const ends = [
        ...(bone.parent === null ? [] : [placed.get(bone.parent)!]),
        ...(bone.tip === null ? [] : [inBone(at, bone.tip)]),
      ];
      for (const end of ends) {
        const line = element("line", "skeleton__bone");
        line.setAttribute("x1", number(end.x));
        line.setAttribute("y1", number(end.y));
        line.setAttribute("x2", number(at.x));
        line.setAttribute("y2", number(at.y));
        nodes.push(line);
      }
    }
    for (const bone of this.model.rig.bones) {
      const at = placed.get(bone.name)!;
      const joint = element("circle", bone.parent === null ? "skeleton__joint skeleton__joint--root" : "skeleton__joint");
      joint.setAttribute("cx", number(at.x));
      joint.setAttribute("cy", number(at.y));
      joint.setAttribute("r", "1.8");
      nodes.push(joint);
    }
    this.skeleton.replaceChildren(...nodes);
  }
}
