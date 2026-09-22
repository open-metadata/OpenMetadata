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

import { render, screen } from '@testing-library/react';
import {
  IncidentGroupBy,
  IncidentTrendDirection,
  Severities,
  TestCaseIncidentGroup,
} from '../../../../generated/tests/testCaseIncidentGroup';
import {
  INCIDENT_TREND_COLORS,
  SPARKLINE_HEIGHT,
  SPARKLINE_INSET,
  SPARKLINE_WIDTH,
} from './IncidentGroups.constants';
import IncidentTrendSparkline, {
  getIncidentTrendColor,
  getIncidentTrendPoints,
  isRecurring,
} from './IncidentTrendSparkline';

const group = (
  overrides: Partial<TestCaseIncidentGroup> = {}
): TestCaseIncidentGroup => ({
  groupBy: IncidentGroupBy.TestDefinition,
  name: 'columnValuesToBeUnique',
  incidentCount: 3,
  ...overrides,
});

describe('getIncidentTrendPoints', () => {
  it('should spread the buckets across the width and scale them to the peak', () => {
    const points = getIncidentTrendPoints([0, 1, 2, 3, 4, 3, 2, 4]).split(' ');

    expect(points).toHaveLength(8);
    // First bucket is 0 — it sits on the floor, inset from the bottom edge.
    expect(points[0]).toBe(
      `${SPARKLINE_INSET},${SPARKLINE_HEIGHT - SPARKLINE_INSET}`
    );
    // Last bucket ties the peak, so it sits on the ceiling at the right edge.
    expect(points[7]).toBe(
      `${SPARKLINE_WIDTH - SPARKLINE_INSET},${SPARKLINE_INSET}`
    );
  });

  it('should scale against the peak, not against an absolute volume', () => {
    // Same shape at two volumes must draw the same line.
    expect(getIncidentTrendPoints([1, 2, 4])).toBe(
      getIncidentTrendPoints([10, 20, 40])
    );
  });

  it('should draw an all-zero trend flat through the middle', () => {
    const points = getIncidentTrendPoints([0, 0, 0, 0]).split(' ');
    const midY = SPARKLINE_INSET + (SPARKLINE_HEIGHT - SPARKLINE_INSET * 2) / 2;

    points.forEach((point) => expect(point.split(',')[1]).toBe(`${midY}`));
  });

  it('should place a single bucket at the left edge', () => {
    expect(getIncidentTrendPoints([4])).toBe(
      `${SPARKLINE_INSET},${SPARKLINE_INSET}`
    );
  });
});

describe('getIncidentTrendColor', () => {
  it.each([
    [
      IncidentTrendDirection.Rising,
      Severities.Severity1,
      INCIDENT_TREND_COLORS.error,
    ],
    [
      IncidentTrendDirection.Rising,
      Severities.Severity3,
      INCIDENT_TREND_COLORS.warning,
    ],
    [IncidentTrendDirection.Rising, undefined, INCIDENT_TREND_COLORS.warning],
    [
      IncidentTrendDirection.Falling,
      Severities.Severity1,
      INCIDENT_TREND_COLORS.success,
    ],
    [IncidentTrendDirection.Falling, undefined, INCIDENT_TREND_COLORS.success],
    [
      IncidentTrendDirection.Steady,
      Severities.Severity1,
      INCIDENT_TREND_COLORS.neutral,
    ],
    [IncidentTrendDirection.Steady, undefined, INCIDENT_TREND_COLORS.neutral],
    [undefined, Severities.Severity1, INCIDENT_TREND_COLORS.neutral],
  ])(
    'should colour %s / %s with the matching token',
    (direction, severity, expected) => {
      expect(getIncidentTrendColor(direction, severity)).toBe(expected);
    }
  );
});

describe('isRecurring', () => {
  it('should treat a rising group as recurring', () => {
    expect(
      isRecurring(group({ trendDirection: IncidentTrendDirection.Rising }))
    ).toBe(true);
  });

  it('should not treat a falling, steady or trendless group as recurring', () => {
    expect(
      isRecurring(group({ trendDirection: IncidentTrendDirection.Falling }))
    ).toBe(false);
    expect(
      isRecurring(group({ trendDirection: IncidentTrendDirection.Steady }))
    ).toBe(false);
    expect(isRecurring(group())).toBe(false);
  });
});

describe('IncidentTrendSparkline', () => {
  it('should draw the line and its direction label', () => {
    render(
      <IncidentTrendSparkline
        severity={Severities.Severity1}
        trend={[1, 0, 0, 0, 2, 3, 4, 5]}
        trendDirection={IncidentTrendDirection.Rising}
      />
    );

    expect(screen.getByTestId('incident-trend-line')).toHaveAttribute(
      'points',
      getIncidentTrendPoints([1, 0, 0, 0, 2, 3, 4, 5])
    );
    expect(screen.getByTestId('incident-trend-line')).toHaveAttribute(
      'stroke',
      INCIDENT_TREND_COLORS.error
    );
    expect(screen.getByTestId('incident-trend-direction')).toHaveTextContent(
      'label.rising'
    );
  });

  it('should render nothing when the group carries no trend', () => {
    const { container: withoutTrend } = render(<IncidentTrendSparkline />);

    expect(withoutTrend).toBeEmptyDOMElement();

    const { container: emptyTrend } = render(
      <IncidentTrendSparkline trend={[]} />
    );

    expect(emptyTrend).toBeEmptyDOMElement();
  });

  it('should draw the line without a label when the direction is absent', () => {
    render(<IncidentTrendSparkline trend={[1, 2, 3]} />);

    expect(screen.getByTestId('incident-trend-line')).toHaveAttribute(
      'stroke',
      INCIDENT_TREND_COLORS.neutral
    );
    expect(
      screen.queryByTestId('incident-trend-direction')
    ).not.toBeInTheDocument();
  });
});
