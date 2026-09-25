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
import { MutableRefObject } from 'react';
import { isFocusInView } from './KnowledgeGraphCanvas.utils';

interface AttachCanvasResizeArgs {
  container: HTMLDivElement;
  graph: Graph;
  isDrawn: () => boolean;
  refitOnResize: MutableRefObject<boolean>;
  onFit: () => void;
  onUpdateRings: () => void;
  onError: (error: unknown) => void;
  getEntityId: () => string;
}

/**
 * Attach a `ResizeObserver` that keeps the graph pinned under the pointer as
 * the containing pane changes size, and refits the viewport when a pane
 * change (fullscreen, drawer open/close) explicitly requested a refit.
 *
 * Returns a `dispose` function that disconnects the observer.
 */
export const attachCanvasResize = ({
  container,
  graph,
  isDrawn,
  refitOnResize,
  onFit,
  onUpdateRings,
  onError,
  getEntityId,
}: AttachCanvasResizeArgs): (() => void) => {
  let previousBounds = container.getBoundingClientRect();
  let previousWindow = [window.innerWidth, window.innerHeight];
  const observer = new ResizeObserver(() => {
    if (graph.destroyed || !isDrawn()) {
      return;
    }
    const parent = container.parentElement;
    if (refitOnResize.current) {
      refitOnResize.current = false;
      onFit();

      return;
    }
    if (parent) {
      const anchor = graph.getViewportByCanvas([0, 0]);
      const bounds = container.getBoundingClientRect();
      const windowChanged =
        previousWindow[0] !== window.innerWidth ||
        previousWindow[1] !== window.innerHeight;
      const [width, height] = graph.getSize();
      const keepCenter = windowChanged || width !== parent.clientWidth;
      const offset = keepCenter
        ? [(parent.clientWidth - width) / 2, (parent.clientHeight - height) / 2]
        : [previousBounds.left - bounds.left, previousBounds.top - bounds.top];
      graph.resize(parent.clientWidth, parent.clientHeight);
      const resizedAnchor = graph.getViewportByCanvas([0, 0]);
      // Width changes keep the viewed center; toolbar changes keep the graph
      // under the pointer.
      void graph
        .translateBy(
          [
            anchor[0] - resizedAnchor[0] + offset[0],
            anchor[1] - resizedAnchor[1] + offset[1],
          ],
          false
        )
        .then(() => {
          // A pane that shrank past the subject would otherwise show an empty
          // canvas; re-frame rather than leave the graph out of view.
          if (!isFocusInView(graph, getEntityId())) {
            onFit();
          }
        })
        .catch(onError);
      previousBounds = bounds;
      previousWindow = [window.innerWidth, window.innerHeight];
    }
    onUpdateRings();
  });
  observer.observe(container.parentElement ?? container);

  return () => observer.disconnect();
};
