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

import { Badge, Typography } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { KpiProgress, KpiStatus } from '../../../../../hooks/useKpiProgress';
import { formatDate } from '../../../../../utils/date-time/DateTimeUtils';
import Sparkline, { SparklineTone } from './Sparkline';

const STATUS: Record<
  KpiStatus,
  { labelKey: string; color: 'success' | 'warning' | 'error'; bar: string }
> = {
  atRisk: {
    bar: 'tw:bg-utility-warning-500',
    color: 'warning',
    labelKey: 'label.at-risk',
  },
  missed: {
    bar: 'tw:bg-utility-error-500',
    color: 'error',
    labelKey: 'label.missed',
  },
  onTrack: {
    bar: 'tw:bg-utility-success-500',
    color: 'success',
    labelKey: 'label.on-track',
  },
};

const SPARKLINE_TONE: Record<KpiStatus, SparklineTone> = {
  atRisk: 'warning',
  missed: 'error',
  onTrack: 'success',
};

export interface KpiProgressRowProps {
  kpi: KpiProgress;
}

/** One KPI: where it is, where it is heading, and where it needs to be. */
const KpiProgressRow: React.FC<KpiProgressRowProps> = ({ kpi }) => {
  const { t } = useTranslation();
  const status = STATUS[kpi.status];
  const percent = kpi.target > 0 ? (kpi.current / kpi.target) * 100 : 0;
  const targetOffset = 100;
  const remaining = Math.max(0, kpi.target - kpi.current);

  return (
    <li
      className="tw:@container tw:flex tw:min-w-0 tw:flex-col tw:gap-2 tw:py-4"
      data-testid={`kpi-${kpi.id}`}>
      <div className="tw:flex tw:min-w-0 tw:items-center tw:gap-2.5">
        {/* `!` on the colours throughout: Typography renders `.prose`, whose
          unlayered `color` rule is emitted after the Tailwind utilities. */}
        <Typography
          className="tw:min-w-0 tw:text-text-primary!"
          ellipsis={{ rows: 1 }}
          size="text-sm"
          weight="semibold">
          {kpi.name}
        </Typography>
        <Badge
          className="tw:shrink-0"
          color={status.color}
          size="sm"
          type="pill-color">
          {t(status.labelKey)}
        </Badge>
        <Typography
          className="tw:ml-auto tw:shrink-0 tw:text-text-tertiary!"
          size="text-sm">
          {t('message.target-value', { value: Math.round(kpi.target) })}
        </Typography>
      </div>

      <div className="tw:flex tw:items-baseline tw:gap-2">
        <Typography
          className="tw:text-text-primary!"
          size="text-xl"
          weight="semibold">
          {`${Math.round(kpi.current)}%`}
        </Typography>
        <Typography className="tw:text-text-tertiary!" size="text-sm">
          {t('message.count-percent-to-go', { count: Math.round(remaining) })}
        </Typography>
      </div>

      {/* The target sits at the far end of the track, so the fill reads as a
        fraction of the goal rather than of an arbitrary maximum. */}
      <div
        aria-label={t('message.target-value', {
          value: Math.round(kpi.target),
        })}
        aria-valuemax={targetOffset}
        aria-valuemin={0}
        aria-valuenow={Math.round(percent)}
        className="tw:relative tw:h-2 tw:w-full tw:overflow-hidden tw:rounded-full tw:bg-secondary"
        role="progressbar">
        <span
          className={classNames('tw:block tw:h-full', status.bar)}
          style={{ width: `${Math.min(percent, targetOffset)}%` }}
        />
      </div>

      <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-x-2 tw:gap-y-1">
        <Typography className="tw:text-text-tertiary!" size="text-sm">
          {kpi.delta === null || kpi.delta === 0
            ? t('message.no-change-this-week')
            : t('message.count-percent-this-week', {
                sign: kpi.delta > 0 ? '+' : '',
                value: Math.round(kpi.delta),
              })}
        </Typography>
        <Typography className="tw:text-text-tertiary!" size="text-sm">
          {`· ${t('message.count-days-left', { count: kpi.daysLeft })}`}
        </Typography>
      </div>

      {kpi.projected !== null && kpi.status !== 'onTrack' && (
        <Typography className="tw:text-utility-warning-700!" size="text-sm">
          {t('message.at-this-pace-projection', {
            date: formatDate(kpi.endDate),
            value: Math.round(kpi.projected),
          })}
        </Typography>
      )}

      {kpi.series.length > 1 && (
        <div className="tw:mt-1 tw:flex tw:min-w-0 tw:flex-col tw:gap-1">
          <div className="tw:h-12 tw:w-full">
            <Sparkline
              ariaLabel={kpi.name}
              series={kpi.series}
              target={kpi.target}
              tone={SPARKLINE_TONE[kpi.status]}
            />
          </div>
          <div className="tw:flex tw:items-center tw:justify-between">
            <Typography className="tw:text-text-tertiary!" size="text-xs">
              {formatDate(kpi.windowStart)}
            </Typography>
            <Typography className="tw:text-text-tertiary!" size="text-xs">
              {formatDate(kpi.windowEnd)}
            </Typography>
          </div>
        </div>
      )}
    </li>
  );
};

export default KpiProgressRow;
