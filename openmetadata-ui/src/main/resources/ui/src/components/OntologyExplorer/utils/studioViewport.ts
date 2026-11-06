/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
import type { Graph } from '@antv/g6';
import {
  DEFAULT_ZOOM,
  fitViewWithMinZoom,
} from '../OntologyExplorer.constants';
import { NODE_HEIGHT, NODE_WIDTH } from './graphConfig';

export interface ViewportRect {
  readonly maxX: number;
  readonly maxY: number;
  readonly minX: number;
  readonly minY: number;
}

export interface ViewportSize {
  readonly height: number;
  readonly width: number;
}

export function rectOfCenters(
  centers: readonly (readonly [number, number])[],
  halfWidth: number,
  halfHeight: number
): ViewportRect | undefined {
  if (centers.length === 0) {
    return undefined;
  }

  return {
    minX: Math.min(...centers.map(([x]) => x)) - halfWidth,
    maxX: Math.max(...centers.map(([x]) => x)) + halfWidth,
    minY: Math.min(...centers.map(([, y]) => y)) - halfHeight,
    maxY: Math.max(...centers.map(([, y]) => y)) + halfHeight,
  };
}

export function rectFitsViewport(
  rect: ViewportRect,
  size: ViewportSize
): boolean {
  return (
    rect.minX >= 0 &&
    rect.minY >= 0 &&
    rect.maxX <= size.width &&
    rect.maxY <= size.height
  );
}

export const containerViewportSize = (
  container: HTMLElement
): ViewportSize => ({
  height: container.offsetHeight,
  width: container.offsetWidth,
});

export function nodeViewportRect(
  graph: Graph,
  ids?: ReadonlySet<string>
): ViewportRect | undefined {
  const zoom = graph.getZoom();
  const centers = graph
    .getNodeData()
    .filter((node) => !ids || ids.has(String(node.id)))
    .flatMap((node) => {
      try {
        const [x, y] = graph.getViewportByCanvas(
          graph.getElementPosition(node.id)
        );

        return [[x, y] as const];
      } catch {
        return [];
      }
    });

  return rectOfCenters(
    centers,
    (NODE_WIDTH / 2) * zoom,
    (NODE_HEIGHT / 2) * zoom
  );
}

export function graphFitsViewport(graph: Graph, size: ViewportSize): boolean {
  const rect = nodeViewportRect(graph);

  return Boolean(rect && rectFitsViewport(rect, size));
}

/** Brings a node that sits outside the visible canvas into view; a visible node stays put. */
export async function revealHiddenNode(
  graph: Graph,
  container: HTMLElement,
  nodeId?: string | null
): Promise<void> {
  if (!nodeId || !graph.hasNode(nodeId)) {
    return;
  }
  const rect = nodeViewportRect(graph, new Set([nodeId]));
  if (rect && !rectFitsViewport(rect, containerViewportSize(container))) {
    // The canvas only learns its new size from the resize observer, which can
    // run after this; fit against the size the container has now.
    graph.resize(container.offsetWidth, container.offsetHeight);
    // Fitting shows the selection with the rest of the graph; panning to it
    // alone would leave the surrounding concepts behind when a panel narrows
    // the canvas.
    await fitViewWithMinZoom(graph);
    const fitted = nodeViewportRect(graph, new Set([nodeId]));
    if (fitted && !rectFitsViewport(fitted, containerViewportSize(container))) {
      await graph.focusElement(nodeId, { duration: 0 });
    }
  }
}

/**
 * The default view starts at the canvas origin, which is blank when a large
 * layout is centred far below it, so a graph that does not fit is fitted.
 */
export async function settleStudioViewport(
  graph: Graph,
  container: HTMLElement
): Promise<void> {
  await graph.zoomTo(DEFAULT_ZOOM, { duration: 0 });
  await graph.translateTo([0, 0], { duration: 0 });
  if (!graphFitsViewport(graph, containerViewportSize(container))) {
    await fitViewWithMinZoom(graph);
  }
}
