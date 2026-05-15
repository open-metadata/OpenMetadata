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

let sharedCtx: CanvasRenderingContext2D | null = null;

export function getCanvasContext(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') {
    return null;
  }
  if (!sharedCtx) {
    const canvas = document.createElement('canvas');
    sharedCtx = canvas.getContext('2d');
  }

  return sharedCtx;
}

export function measureTextWidth(
  text: string,
  font: string,
  fallbackCharWidth: number
): number {
  const ctx = getCanvasContext();
  if (!ctx) {
    return text.length * fallbackCharWidth;
  }
  try {
    ctx.font = font;

    return Math.ceil(ctx.measureText(text).width);
  } catch {
    return text.length * fallbackCharWidth;
  }
}

export function truncateToFit(
  text: string,
  maxPx: number,
  font: string,
  fallbackCharWidth: number
): string {
  const ctx = getCanvasContext();
  if (!ctx) {
    const maxChars = Math.max(1, Math.floor(maxPx / fallbackCharWidth));
    if (text.length <= maxChars) {
      return text;
    }

    return maxChars <= 1 ? '...' : `${text.slice(0, maxChars - 1)}...`;
  }
  ctx.font = font;
  if (ctx.measureText(text).width <= maxPx) {
    return text;
  }
  const ellipsisWidth = ctx.measureText('...').width;
  const budget = maxPx - ellipsisWidth;
  let lo = 0;
  let hi = text.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(text.slice(0, mid)).width <= budget) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }

  return lo === 0 ? '...' : `${text.slice(0, lo)}...`;
}
