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

/**
 * Build the `wheel` handler that forwards the native scroll to G6. Pure so
 * the hook can attach and detach it in an effect and tests can invoke it
 * without simulating a DOM event.
 */
export const createCanvasWheelHandler = (
  container: HTMLDivElement,
  graph: Graph,
  isDrawn: () => boolean
) => {
  return (event: WheelEvent) => {
    const nativeCanvas = container.querySelector('canvas');
    if (
      event.target instanceof HTMLCanvasElement ||
      !nativeCanvas ||
      !isDrawn()
    ) {
      return;
    }
    event.preventDefault();
    const rect = container.getBoundingClientRect();
    graph.emit('wheel', {
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      viewport: { x: event.clientX - rect.left, y: event.clientY - rect.top },
    });
  };
};
