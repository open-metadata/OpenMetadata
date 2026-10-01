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

import type { ChartPixel } from './types';

export interface PixelChart {
  convertToPixel: (finder: { seriesId: string }, value: unknown[]) => unknown;
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** Centre of the point of `seriesKey` at `datum`, or undefined if it has no position. */
export const pointPixel = <T extends object>(
  chart: PixelChart,
  datum: T,
  xKey: keyof T & string,
  seriesKey: string,
  isTime: boolean
): ChartPixel | undefined => {
  const row = datum as Record<string, unknown>;
  const y = row[seriesKey];
  if (y === null || y === undefined || y === '') {
    return undefined;
  }
  const x = isTime ? row[xKey] : String(row[xKey]);
  const pixel = chart.convertToPixel({ seriesId: seriesKey }, [x, y]);
  const [px, py] = Array.isArray(pixel) ? pixel : [];

  return isFiniteNumber(px) && isFiniteNumber(py)
    ? { x: px, y: py }
    : undefined;
};
