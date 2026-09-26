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

export const findClosestCanvasEdge = <T>(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  paths: ReadonlyArray<{ edge: T; path: Path2D }>,
  x: number,
  y: number,
  hitLineWidth: number
): T | null => {
  let closestEdge: T | null = null;
  let closestWidth = hitLineWidth;
  const precision = hitLineWidth / 256;

  for (const { edge, path } of paths) {
    context.lineWidth = closestWidth;
    if (!context.isPointInStroke(path, x, y)) {
      continue;
    }

    // Wide hit areas overlap when zoomed out. Find the nearest stroke instead
    // of letting the order of edges decide which relationship gets edited.
    let lower = 0;
    let upper = closestWidth;
    while (upper - lower > precision) {
      const middle = (lower + upper) / 2;
      context.lineWidth = middle;
      if (context.isPointInStroke(path, x, y)) {
        upper = middle;
      } else {
        lower = middle;
      }
    }
    closestEdge = edge;
    closestWidth = upper;
    if (closestWidth <= precision) {
      break;
    }
  }

  return closestEdge;
};
