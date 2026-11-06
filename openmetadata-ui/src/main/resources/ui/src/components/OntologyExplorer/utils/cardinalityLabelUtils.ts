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

export const CARDINALITY_LABEL_FONT_SIZE = 10;
export const CARDINALITY_LABEL_FILL = '#8C93AE';
export const CARDINALITY_LABEL_ALONG_PX = 24;
export const CARDINALITY_LABEL_PERP_PX = 11;

type CardinalityLabelAttrs = {
  fill: string;
  fontSize: number;
  fontWeight: number;
  text: string;
  textAlign: 'center';
  textBaseline: 'middle';
  x: number;
  y: number;
  zIndex: number;
};

export function computeCardinalityLabelAttrs(
  attributes: Record<string, unknown>,
  endpoints: [[number, number], [number, number]],
  end: 'start' | 'end'
): false | CardinalityLabelAttrs {
  const key = end === 'start' ? 'startLabelText' : 'endLabelText';
  const text = typeof attributes[key] === 'string' ? attributes[key] : '';

  if (!text) {
    return false;
  }

  const [sx, sy] = endpoints[0];
  const [ex, ey] = endpoints[1];
  const edgeDx = ex - sx;
  const edgeDy = ey - sy;
  const len = Math.hypot(edgeDx, edgeDy);

  let labelX: number;
  let labelY: number;

  if (len < 1) {
    labelX = end === 'start' ? sx : ex;
    labelY = end === 'start' ? sy : ey;
  } else {
    const ux = edgeDx / len;
    const uy = edgeDy / len;
    const along = Math.min(CARDINALITY_LABEL_ALONG_PX, len * 0.3);
    const px = -uy;
    const py = ux;

    if (end === 'start') {
      labelX = sx + ux * along + px * CARDINALITY_LABEL_PERP_PX;
      labelY = sy + uy * along + py * CARDINALITY_LABEL_PERP_PX;
    } else {
      labelX = ex - ux * along + px * CARDINALITY_LABEL_PERP_PX;
      labelY = ey - uy * along + py * CARDINALITY_LABEL_PERP_PX;
    }
  }

  return {
    fill: CARDINALITY_LABEL_FILL,
    fontSize: CARDINALITY_LABEL_FONT_SIZE,
    fontWeight: 700,
    text,
    textAlign: 'center',
    textBaseline: 'middle',
    x: labelX,
    y: labelY,
    zIndex: 10,
  };
}
