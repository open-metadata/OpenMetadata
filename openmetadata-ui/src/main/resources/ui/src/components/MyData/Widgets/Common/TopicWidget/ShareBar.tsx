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

import { BarChart, ChartOption } from '@openmetadata/ui-core-components/charts';
import classNames from 'classnames';
import React, { useMemo } from 'react';

export interface ShareSegment {
  /** Stable identity for React keys and the series id. */
  key: string;
  /** Series name, translated by the caller. */
  name: string;
  value: number;
  color: string;
}

export interface ShareBarProps {
  segments: ShareSegment[];
  /**
   * Scale the segments are a share of. Defaults to their sum; pass a larger
   * total to leave the shortfall as visible track.
   */
  total?: number;
  /** Labels the bar as a whole — see the comment on the wrapper below. */
  ariaLabel: string;
  /** Formats the count in a segment's tooltip. Defaults to the raw number. */
  valueFormatter?: (value: number) => string;
  className?: string;
  dataTestId?: string;
}

const CATEGORY_KEY = 'share';
const STACK_ID = 'share';
// The segments carry their own keys; the row is keyed by position so a segment
// named `share` cannot collide with the category field.
const valueKey = (index: number) => `value-${index}`;

/**
 * The bar is the whole plot: no axes, no legend, no padding.
 *
 * `trigger: 'item'` is set here rather than through the `tooltip` prop because
 * `ChartTooltipProps` does not carry a trigger — cartesian charts are built with
 * `'axis'`, which on a one-category stack would open every series at once and
 * just restate the legend. Hovering one segment has to name that segment, which
 * is the whole point on a bar where the smallest share is a few pixels wide.
 * The consumer `option` is deep-merged over the built one, so this wins.
 */
const SHARE_OPTION: ChartOption = {
  grid: { bottom: 0, left: 0, outerBoundsMode: 'none', right: 0, top: 0 },
  tooltip: { trigger: 'item' },
};
// One category in the band, so the bar fills the height the caller gives it.
const FULL_WIDTH_BAR = { barWidth: '100%' };
const CATEGORY_AXIS = { show: false };
const NO_LEGEND = { show: false };

type ShareRow = Record<string, string | number>;

/**
 * A single stacked bar: how a total splits across a handful of series, drawn
 * as a pill. The caller owns the legend, which is where the values are read.
 */
const ShareBar: React.FC<ShareBarProps> = ({
  segments,
  total,
  ariaLabel,
  valueFormatter,
  className,
  dataTestId,
}) => {
  const sum = segments.reduce((acc, segment) => acc + segment.value, 0);
  const max = total ?? sum;

  const data = useMemo<ShareRow[]>(
    () => [
      segments.reduce<ShareRow>(
        (row, segment, index) => ({ ...row, [valueKey(index)]: segment.value }),
        { [CATEGORY_KEY]: '' }
      ),
    ],
    [segments]
  );

  const chartSeries = useMemo(
    () =>
      segments.map((segment, index) => ({
        color: segment.color,
        key: valueKey(index),
        name: segment.name,
        seriesOption: FULL_WIDTH_BAR,
        stack: STACK_ID,
      })),
    [segments]
  );

  // A stacked axis would round its maximum up to a "nice" number and leave a
  // gap at the end of the bar, so the scale is pinned to the total.
  const valueAxis = useMemo(() => ({ max, min: 0, show: false }), [max]);

  const tooltip = useMemo(
    () => ({
      valueFormatter: (value: number | string) =>
        typeof value === 'number' && valueFormatter
          ? valueFormatter(value)
          : String(value),
    }),
    [valueFormatter]
  );

  if (max <= 0) {
    return null;
  }

  return (
    // `role="img"` with one label: it makes the segments presentational, so
    // the chart's own description is not read on top of the legend below.
    <div
      aria-label={ariaLabel}
      className={classNames(
        'tw:w-full tw:overflow-hidden tw:rounded-full',
        className
      )}
      data-testid={dataTestId}
      role="img">
      <BarChart
        ariaLabel={ariaLabel}
        // The chart's own box has to be told to fill the wrapper, or its
        // percentage height resolves against an auto-height parent and
        // collapses to nothing.
        className="tw:h-full"
        data={data}
        height="100%"
        layout="horizontal"
        legend={NO_LEGEND}
        option={SHARE_OPTION}
        series={chartSeries}
        tooltip={tooltip}
        xAxis={CATEGORY_AXIS}
        xKey={CATEGORY_KEY}
        yAxis={valueAxis}
      />
    </div>
  );
};

export default ShareBar;
