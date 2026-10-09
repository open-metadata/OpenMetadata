/*
 *  Copyright 2025 Collate.
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
    ProgressBarBase,
    Tooltip,
    Typography
} from '@openmetadata/ui-core-components';
import {
    chartColor,
    useChartPalette
} from '@openmetadata/ui-core-components/charts';
import {
    AlertTriangle,
    CheckCircle,
    InfoCircle
} from '@openmetadata/ui-core-components/icons';
import { clamp, toNumber } from 'lodash';
import React, { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { KpiTargetType } from '../../../../../generated/api/dataInsight/kpi/createKpiRequest';
import { UIKpiResult } from '../../../../../interface/data-insight.interface';
import { getKpiResultFeedback } from '../../../../../utils/DataInsightUtils';
import { getDaysRemaining } from '../../../../../utils/date-time/DateTimeUtils';

interface KPILegendProps {
  kpiLatestResultsRecord: Record<string, UIKpiResult>;
  isFullSize: boolean;
}

// ProgressBarBase does not clamp, so >100% or a zero target would shift the bar.
const getProgressPercent = (current: number, target: number) =>
  clamp((current / target) * 100 || 0, 0, 100);

const GOAL_CHIP_CLASS =
  'tw:min-w-0 tw:w-fit tw:shrink tw:rounded-lg tw:px-2 tw:py-1 tw:text-[10px]';

const GoalCompleted = () => {
  const { t } = useTranslation();

  return (
    <Box
      align="center"
      className={`${GOAL_CHIP_CLASS} tw:bg-utility-success-50 tw:text-utility-success-700`}
      gap={1}>
      <CheckCircle className="tw:size-3 tw:shrink-0" />
      <Typography className="tw:truncate tw:text-[10px] tw:text-utility-success-700">
        {t('label.goal-completed')}
      </Typography>
    </Box>
  );
};

const GoalMissed = () => {
  const { t } = useTranslation();

  return (
    <Box
      align="center"
      className={`${GOAL_CHIP_CLASS} tw:bg-utility-warning-50 tw:text-utility-warning-700`}
      gap={1}>
      <AlertTriangle className="tw:size-3 tw:shrink-0" />
      <Typography className="tw:truncate tw:text-[10px] tw:text-utility-warning-700">
        {t('label.goal-missed')}
      </Typography>
    </Box>
  );
};

const KPILegend: React.FC<KPILegendProps> = ({
  kpiLatestResultsRecord,
  isFullSize,
}) => {
  const { t } = useTranslation();
  const palette = useChartPalette();
  const entries = Object.entries(kpiLatestResultsRecord);

  return (
    <Box
      className="kpi-legend tw:h-full tw:max-h-87.5 tw:w-full tw:overflow-y-auto tw:rounded-xl tw:border tw:border-secondary tw:p-3"
      direction="col"
      gap={2}>
      {entries.map(([key, resultData], index) => {
        const color = chartColor(palette, index);
        const daysLeft = getDaysRemaining(resultData.endDate);
        const targetResult = resultData.targetResult[0];

        const isPercentage = resultData.metricType === KpiTargetType.Percentage;

        const current = toNumber(targetResult?.value);
        const target = toNumber(resultData.target);

        const suffix = isPercentage ? '%' : '';

        const isTargetMet = targetResult.targetMet;
        const isTargetMissed = !targetResult.targetMet && daysLeft <= 0;

        let centerContent: JSX.Element;
        if (isTargetMet) {
          centerContent = <GoalCompleted />;
        } else if (isTargetMissed) {
          centerContent = <GoalMissed />;
        } else {
          centerContent = (
            <Typography className="tw:text-center tw:text-[10px] tw:font-medium tw:text-tertiary">
              {daysLeft <= 0 ? 0 : daysLeft}{' '}
              {t('label.days-left').toUpperCase()}
            </Typography>
          );
        }

        if (isFullSize) {
          return (
            <Box
              className="kpi-full-legend tw:mb-2 tw:w-full tw:min-w-0 tw:rounded-xl tw:border tw:border-tertiary tw:bg-secondary_subtle tw:p-2"
              direction="col"
              gap={1}
              key={key}
              // Series colour comes from the chart palette at runtime.
              style={{ '--kpi-series-color': color } as CSSProperties}>
              <Box
                align="center"
                className="tw:min-w-0"
                gap={2}
                justify="between">
                <Typography
                  className="tw:min-w-0 tw:flex-1 tw:text-xs tw:leading-tight tw:font-normal tw:text-secondary"
                  ellipsis={{ tooltip: true }}>
                  {resultData.displayName}
                </Typography>

                {daysLeft <= 0 || isTargetMet ? (
                  <Tooltip
                    placement="bottom"
                    title={getKpiResultFeedback(daysLeft, Boolean(isTargetMet))}
                    triggerClassName="tw:flex">
                    <InfoCircle className="tw:size-3 tw:text-fg-quaternary" />
                  </Tooltip>
                ) : null}
              </Box>

              <ProgressBarBase
                className="tw:h-1 tw:bg-quaternary"
                progressClassName="tw:bg-(--kpi-series-color)"
                value={getProgressPercent(current, target)}
              />

              <Box
                align="center"
                className="tw:min-w-0"
                gap={1}
                justify="between">
                <Typography className="tw:shrink-0 tw:text-[10px] tw:text-tertiary">
                  {current.toFixed(0)}
                  {suffix}
                </Typography>
                <Box
                  align="center"
                  className="tw:min-w-0 tw:flex-1"
                  justify="center">
                  {centerContent}
                </Box>
                <Typography className="tw:shrink-0 tw:text-[10px] tw:text-tertiary">
                  {target.toFixed(0)}
                  {suffix}
                </Typography>
              </Box>
            </Box>
          );
        }

        // Compact Mode
        return (
          <Box
            align="center"
            className="legend-item tw:p-3 tw:text-xs"
            gap={1}
            justify="center"
            key={key}
            wrap="wrap">
            <span
              className="legend-dot tw:mr-1 tw:inline-block tw:size-3 tw:shrink-0 tw:rounded-full"
              style={{ backgroundColor: color }}
            />
            <Typography size="text-xs" weight="semibold">
              {`${resultData.displayName}:`}
            </Typography>
            <Typography color="secondary" size="text-xs">
              {daysLeft <= 0 ? 0 : daysLeft} {t('label.days-left')}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
};

export default KPILegend;
