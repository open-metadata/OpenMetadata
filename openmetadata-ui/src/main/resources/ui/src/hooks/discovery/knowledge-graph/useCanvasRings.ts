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
import { MutableRefObject, useCallback, useRef, useState } from 'react';
import { GraphLevelRing } from '../../../interface/discovery/knowledge-graph.interface';

interface UseCanvasRingsArgs {
  graphRef: MutableRefObject<Graph | null>;
  isDrawn: () => boolean;
}

interface UseCanvasRingsResult {
  rings: GraphLevelRing[];
  zoom: number;
  viewportOrigin: string;
  worldRings: MutableRefObject<GraphLevelRing[]>;
  updateRings: () => void;
}

/**
 * Owns the rings/zoom/viewport-origin state that follows the G6
 * `aftertransform` event. Held separately so the parent hook does not carry
 * three unrelated state slots and their update logic.
 */
export const useCanvasRings = ({
  graphRef,
  isDrawn,
}: UseCanvasRingsArgs): UseCanvasRingsResult => {
  const [rings, setRings] = useState<GraphLevelRing[]>([]);
  const [zoom, setZoom] = useState(1);
  // Viewport position of the world origin. With `zoom` this pins the whole
  // affine transform, which is the only way to observe *panning* from outside:
  // node and ring geometry both move when the graph re-lays out, so neither
  // can tell a pan apart from a relayout.
  const [viewportOrigin, setViewportOrigin] = useState('0,0');
  const worldRings = useRef<GraphLevelRing[]>([]);

  const updateRings = useCallback(() => {
    const graph = graphRef.current;
    if (!graph || graph.destroyed || !isDrawn()) {
      return;
    }
    const nextZoom = graph.getZoom();
    setZoom(nextZoom);
    const [originX, originY] = graph.getViewportByCanvas([0, 0]);
    setViewportOrigin(`${Math.round(originX)},${Math.round(originY)}`);
    setRings(
      worldRings.current.map((ring) => {
        const [x, y] = graph.getViewportByCanvas([ring.x, ring.y]);

        return {
          ...ring,
          x,
          y,
          radiusX: ring.radiusX * nextZoom,
          radiusY: ring.radiusY * nextZoom,
        };
      })
    );
  }, [graphRef, isDrawn]);

  return { rings, zoom, viewportOrigin, worldRings, updateRings };
};
