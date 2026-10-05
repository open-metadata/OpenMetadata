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

import { isNumber } from 'lodash';
import { useMemo } from 'react';
import { placedSeriesKey } from '../../../../utils/DataQuality/TestSummaryGraphUtils';
import { TestCaseChartDataType } from '../ProfilerDashboard/profilerDashboard.interface';

type PlottedPoint = TestCaseChartDataType['data'][number];

interface RunEntry {
  id: string;
  label: string;
  point: PlottedPoint;
}

interface TestSummaryRunListProps {
  points: PlottedPoint[];
  seriesLabels: string[];
  getLabel: (point: PlottedPoint) => string;
}

/**
 * The chart's text alternative: one entry per run and series the run has a
 * value on, measured or placed, in plot order. Visually hidden; the chart
 * draws the same runs.
 */
const TestSummaryRunList = ({
  points,
  seriesLabels,
  getLabel,
}: Readonly<TestSummaryRunListProps>) => {
  // Two runs can share a timestamp, so an entry's id also carries the run's
  // place in the plotted list.
  const entries = useMemo(
    () =>
      points.flatMap((point, position) =>
        seriesLabels.reduce<RunEntry[]>((pointEntries, label) => {
          if (
            isNumber(point[label]) ||
            isNumber(point[placedSeriesKey(label)])
          ) {
            pointEntries.push({
              id: `${String(point.name)}-${label}-${position}`,
              label,
              point,
            });
          }

          return pointEntries;
        }, [])
      ),
    [points, seriesLabels]
  );

  return (
    <ul className="tw:sr-only" data-testid="test-summary-runs">
      {entries.map(({ id, label, point }) => (
        <li
          data-status={point.status}
          data-testid={`test-summary-point-${label}`}
          key={id}>
          {getLabel(point)}
        </li>
      ))}
    </ul>
  );
};

export default TestSummaryRunList;
