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
  Box,
  Tooltip,
  TooltipTrigger,
  Typography,
} from '@openmetadata/ui-core-components';
import { isEmpty } from 'lodash';
import { useTranslation } from 'react-i18next';
import {
  INCIDENT_TREND_COLORS,
  INCIDENT_TREND_DIRECTION_LABELS,
  INCIDENT_TREND_TEXT_CLASSES,
  SPARKLINE_HEIGHT,
  SPARKLINE_WIDTH,
} from './IncidentGroups.constants';
import { IncidentTrendSparklineProps } from './IncidentGroups.types';
import {
  getIncidentTrendPoints,
  getIncidentTrendTone,
} from './IncidentGroups.utils';

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

  if (!trend || isEmpty(trend)) {
    return null;
  }

  const tone = getIncidentTrendTone(trendDirection, severity);
  const directionLabel = trendDirection
    ? t(INCIDENT_TREND_DIRECTION_LABELS[trendDirection])
    : '';

  const description = t('message.open-incident-trend', {
    startCount: trend[0],
    endCount: trend[trend.length - 1],
  });

  return (
    <Tooltip title={description}>
      <TooltipTrigger>
        <Box
          className="tw:gap-0.5"
          data-testid="incident-trend"
          direction="col">
          <svg
            aria-label={description}
            data-testid="incident-trend-sparkline"
            fill="none"
            height={SPARKLINE_HEIGHT}
            role="img"
            viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`}
            width={SPARKLINE_WIDTH}>
            <polyline
              data-testid="incident-trend-line"
              points={getIncidentTrendPoints(trend)}
              // An SVG stroke takes no class, so the tone arrives as its token.
              stroke={INCIDENT_TREND_COLORS[tone]}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
            />
          </svg>
          {directionLabel && (
            <Typography
              as="span"
              className={INCIDENT_TREND_TEXT_CLASSES[tone]}
              data-testid="incident-trend-direction"
              size="text-xs"
              weight="semibold">
              {directionLabel}
            </Typography>
          )}
        </Box>
      </TooltipTrigger>
    </Tooltip>
  );
};

export default IncidentTrendSparkline;
