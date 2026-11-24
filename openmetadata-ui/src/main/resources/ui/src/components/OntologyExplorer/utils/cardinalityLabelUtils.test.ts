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

import {
  CARDINALITY_LABEL_ALONG_PX,
  CARDINALITY_LABEL_FILL,
  CARDINALITY_LABEL_FONT_SIZE,
  CARDINALITY_LABEL_PERP_PX,
  computeCardinalityLabelAttrs,
} from './cardinalityLabelUtils';

describe('computeCardinalityLabelAttrs', () => {
  const endpoints: [[number, number], [number, number]] = [
    [0, 0],
    [100, 0],
  ];

  it('returns false when the label text attribute is missing', () => {
    expect(computeCardinalityLabelAttrs({}, endpoints, 'start')).toBe(false);
    expect(computeCardinalityLabelAttrs({}, endpoints, 'end')).toBe(false);
  });

  it('returns false when the label text attribute is non-string or empty', () => {
    expect(
      computeCardinalityLabelAttrs({ startLabelText: 42 }, endpoints, 'start')
    ).toBe(false);
    expect(
      computeCardinalityLabelAttrs({ endLabelText: null }, endpoints, 'end')
    ).toBe(false);
    expect(
      computeCardinalityLabelAttrs({ startLabelText: '' }, endpoints, 'start')
    ).toBe(false);
  });

  it('selects startLabelText for end==="start" and endLabelText for end==="end"', () => {
    const attributes = { endLabelText: '0..*', startLabelText: '1..1' };

    const startAttrs = computeCardinalityLabelAttrs(
      attributes,
      endpoints,
      'start'
    );
    const endAttrs = computeCardinalityLabelAttrs(attributes, endpoints, 'end');

    expect(startAttrs).not.toBe(false);
    expect(endAttrs).not.toBe(false);

    if (startAttrs === false || endAttrs === false) {
      throw new Error('expected attrs to be resolved');
    }

    expect(startAttrs.text).toBe('1..1');
    expect(endAttrs.text).toBe('0..*');
  });

  it('places the label exactly at the endpoint for a degenerate edge (len < 1)', () => {
    const degenerate: [[number, number], [number, number]] = [
      [5, 7],
      [5, 7],
    ];

    const startAttrs = computeCardinalityLabelAttrs(
      { startLabelText: '1' },
      degenerate,
      'start'
    );
    const endAttrs = computeCardinalityLabelAttrs(
      { endLabelText: '*' },
      degenerate,
      'end'
    );

    if (startAttrs === false || endAttrs === false) {
      throw new Error('expected attrs to be resolved');
    }

    expect(startAttrs.x).toBe(5);
    expect(startAttrs.y).toBe(7);
    expect(endAttrs.x).toBe(5);
    expect(endAttrs.y).toBe(7);
  });

  it('offsets the label along the edge by ALONG_PX and perpendicular by PERP_PX for a long edge', () => {
    const startAttrs = computeCardinalityLabelAttrs(
      { startLabelText: '1' },
      endpoints,
      'start'
    );
    const endAttrs = computeCardinalityLabelAttrs(
      { endLabelText: '*' },
      endpoints,
      'end'
    );

    if (startAttrs === false || endAttrs === false) {
      throw new Error('expected attrs to be resolved');
    }

    expect(startAttrs.x).toBe(CARDINALITY_LABEL_ALONG_PX);
    expect(startAttrs.y).toBe(CARDINALITY_LABEL_PERP_PX);
    expect(endAttrs.x).toBe(100 - CARDINALITY_LABEL_ALONG_PX);
    expect(endAttrs.y).toBe(CARDINALITY_LABEL_PERP_PX);
  });

  it('offsets by the minimum of ALONG_PX and 30% of length for a short edge', () => {
    const shortEdge: [[number, number], [number, number]] = [
      [0, 0],
      [50, 0],
    ];
    const expectedAlong = Math.min(CARDINALITY_LABEL_ALONG_PX, 50 * 0.3);

    const startAttrs = computeCardinalityLabelAttrs(
      { startLabelText: '1' },
      shortEdge,
      'start'
    );

    if (startAttrs === false) {
      throw new Error('expected attrs to be resolved');
    }

    expect(expectedAlong).toBe(15);
    expect(startAttrs.x).toBe(15);
    expect(startAttrs.y).toBe(CARDINALITY_LABEL_PERP_PX);
  });

  it('carries constant fill/fontSize/fontWeight/zIndex alongside the resolved text', () => {
    const attrs = computeCardinalityLabelAttrs(
      { startLabelText: '1..*' },
      endpoints,
      'start'
    );

    if (attrs === false) {
      throw new Error('expected attrs to be resolved');
    }

    expect(attrs.fill).toBe(CARDINALITY_LABEL_FILL);
    expect(attrs.fontSize).toBe(CARDINALITY_LABEL_FONT_SIZE);
    expect(attrs.fontWeight).toBe(700);
    expect(attrs.zIndex).toBe(10);
    expect(attrs.textAlign).toBe('center');
    expect(attrs.textBaseline).toBe('middle');
    expect(attrs.text).toBe('1..*');
  });
});
