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

import { Box, Typography } from '@openmetadata/ui-core-components';
import { isEmpty } from 'lodash';
import { useTranslation } from 'react-i18next';
import {
  IncidentTrendDirection,
  Severities,
  TestCaseIncidentGroup,
} from '../../../../generated/tests/testCaseIncidentGroup';
import {
  INCIDENT_TREND_COLORS,
  INCIDENT_TREND_DIRECTION_LABELS,
  SPARKLINE_HEIGHT,
  SPARKLINE_INSET,
  SPARKLINE_WIDTH,
} from './IncidentGroups.constants';
import { IncidentTrendSparklineProps } from './IncidentGroups.types';

/**
 * A group counts as recurring when its incidents keep coming back faster than
 * they did: the server compares the second half of the trend buckets against
 * the first and reports `Rising`. It lives with the sparkline because both read
 * the same field, and the header's `recurring` chip must agree with the arrow
 * the user sees on the row.
 */
export const isRecurring = (group: TestCaseIncidentGroup): boolean =>
  group.trendDirection === IncidentTrendDirection.Rising;

/**
 * Colour of the trend line. Falling incident creation is good news and steady
 * is neither, so only a rising trend is graded — by the severity the group
 * carries, since a rising `Severity1` group is the one to look at first.
 */
export const getIncidentTrendColor = (
  trendDirection?: IncidentTrendDirection,
  severity?: Severities
): string => {
  if (trendDirection === IncidentTrendDirection.Rising) {
    return severity === Severities.Severity1
      ? INCIDENT_TREND_COLORS.error
      : INCIDENT_TREND_COLORS.warning;
  }

  return trendDirection === IncidentTrendDirection.Falling
    ? INCIDENT_TREND_COLORS.success
    : INCIDENT_TREND_COLORS.neutral;
};

/**
 * Bucket counts to `x,y` pairs for an SVG polyline. Buckets are equally spaced
 * across the width and scaled against the tallest bucket, so the line shows the
 * shape of the group's incident creation rather than its absolute volume — a
 * group with 40 incidents and one with 4 are equally readable. An all-zero
 * trend has no shape to scale, so it draws flat through the middle.
 */
export const getIncidentTrendPoints = (trend: number[]): string => {
  const usableWidth = SPARKLINE_WIDTH - SPARKLINE_INSET * 2;
  const usableHeight = SPARKLINE_HEIGHT - SPARKLINE_INSET * 2;
  const peak = Math.max(...trend);
  const stepX = trend.length > 1 ? usableWidth / (trend.length - 1) : 0;

  return trend
    .map((count, index) => {
      const x = SPARKLINE_INSET + index * stepX;
      const y =
        peak === 0
          ? SPARKLINE_INSET + usableHeight / 2
          : SPARKLINE_INSET + (1 - count / peak) * usableHeight;

      return `${x},${y}`;
    })
    .join(' ');
};

/**
 * Read-only trend line for one incident group: the bucket counts the server
 * computed, plus the direction it derived from them. Pure — every value it
 * draws comes from its props, so the row can render it without a fetch.
 */
const IncidentTrendSparkline = ({
  trend,
  trendDirection,
  severity,
}: IncidentTrendSparklineProps) => {
  const { t } = useTranslation();

  // A group whose incidents all landed in the same instant has no trend to
  // draw; the server omits the field rather than sending a flat line.
  if (!trend || isEmpty(trend)) {
    return null;
  }

  const color = getIncidentTrendColor(trendDirection, severity);
  const directionLabel = trendDirection
    ? t(INCIDENT_TREND_DIRECTION_LABELS[trendDirection])
    : '';

  return (
    <Box className="tw:gap-0.5" data-testid="incident-trend" direction="col">
      <svg
        aria-hidden
        data-testid="incident-trend-sparkline"
        fill="none"
        height={SPARKLINE_HEIGHT}
        viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`}
        width={SPARKLINE_WIDTH}>
        <polyline
          data-testid="incident-trend-line"
          points={getIncidentTrendPoints(trend)}
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
        />
      </svg>
      {directionLabel && (
        <Typography
          as="span"
          data-testid="incident-trend-direction"
          size="text-xs"
          style={{ color }}
          weight="semibold">
          {directionLabel}
        </Typography>
      )}
    </Box>
  );
};

export default IncidentTrendSparkline;
