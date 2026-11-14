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

import { defaultColors } from '@openmetadata/ui-core-components';
import {
  AreaChart,
  ChartOption,
} from '@openmetadata/ui-core-components/charts';
import classNames from 'classnames';
import React, { useMemo } from 'react';

export type SparklineTone = 'brand' | 'warning' | 'error' | 'success';

// Series colours are the same in light and dark, as everywhere in the core
// charts — the chart theme only covers the chrome (axes, grid, tooltip).
const TONE_COLOR: Record<SparklineTone, string> = {
  brand: defaultColors.brand[600],
  error: defaultColors.error[500],
  success: defaultColors.success[600],
  warning: defaultColors.warning[500],
};

const VALUE_KEY = 'value';
const INDEX_KEY = 'index';
// Breathing room at both ends of the scale, as a share of the range, so a flat
// line is centred rather than welded to an edge and the padding does not
// depend on whether the series counts assets or percentages.
const PAD_RATIO = 0.08;

// A sparkline is all plot: the grid runs to the edge of whatever box the card
// gives it, with two pixels of air for the stroke width.
const SPARKLINE_OPTION: ChartOption = {
  grid: { bottom: 2, left: 0, outerBoundsMode: 'none', right: 0, top: 2 },
};
// `boundaryGap: false` anchors the first and last point to the edges, so the
// trend spans the full width however many points there are.
const CATEGORY_AXIS = { boundaryGap: false, show: false };
const NO_LEGEND = { show: false };
// The number beside the trend already says the value, so a tooltip would read
// it twice — and these cards are clickable, so hovering should not pop a card.
const NO_TOOLTIP = { show: false };

export interface SparklineProps {
  series: number[];
  tone: SparklineTone;
  /** Draws a dashed reference line at this value, e.g. a KPI target. */
  target?: number;
  className?: string;
  ariaLabel: string;
}

interface SparklinePoint {
  index: number;
  value: number;
}

/** A compact trend line with a filled area, and optionally its target. */
const Sparkline: React.FC<SparklineProps> = ({
  series,
  tone,
  target,
  className,
  ariaLabel,
}) => {
  const data = useMemo<SparklinePoint[]>(
    () => series.map((value, index) => ({ index, value })),
    [series]
  );

  // The target has to be inside the scale, or a target above every observed
  // value would be drawn off the top of the box.
  const valueAxis = useMemo(() => {
    const values = target === undefined ? series : [...series, target];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = (max - min || Math.abs(max) || 1) * PAD_RATIO;

    return { max: max + pad, min: min - pad, show: false };
  }, [series, target]);

  const chartSeries = useMemo(
    () => [
      {
        color: TONE_COLOR[tone],
        key: VALUE_KEY,
        name: ariaLabel,
        // Straight segments: a smoothed curve invents values between days.
        smooth: false,
      },
    ],
    [ariaLabel, tone]
  );

  const referenceLines = useMemo(
    () =>
      target === undefined
        ? undefined
        : [{ axis: 'y' as const, value: target }],
    [target]
  );

  // One point is a value, not a trend — there is nothing honest to draw.
  if (series.length < 2) {
    return null;
  }

  return (
    <AreaChart
      ariaLabel={ariaLabel}
      className={classNames('tw:h-full tw:w-full', className)}
      data={data}
      height="100%"
      legend={NO_LEGEND}
      option={SPARKLINE_OPTION}
      referenceLines={referenceLines}
      series={chartSeries}
      tooltip={NO_TOOLTIP}
      xAxis={CATEGORY_AXIS}
      xKey={INDEX_KEY}
      yAxis={valueAxis}
    />
  );
};

export default Sparkline;
