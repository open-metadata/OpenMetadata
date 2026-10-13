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
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { KpiTargetType } from '../../../../../generated/dataInsight/kpi/kpi';
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

interface KpiFormatters {
  value: (value: number) => string;
  /** Same unit, with an explicit sign — for a change rather than a level. */
  signed: (value: number) => string;
}

/**
 * Formats a KPI's figures in its own unit: a Percentage KPI reads `28%`, a
 * Number KPI `1,500` — not `1500%`, which is what a fixed `%` suffix printed.
 * Intl rather than a suffix so the symbol's placement follows the locale.
 */
const useKpiFormatters = (metricType: KpiTargetType): KpiFormatters => {
  const { i18n } = useTranslation();

  return useMemo(() => {
    const unit: Intl.NumberFormatOptions =
      metricType === KpiTargetType.Percentage
        ? { style: 'unit', unit: 'percent' }
        : {};
    const value = new Intl.NumberFormat(i18n.language, {
      ...unit,
      maximumFractionDigits: 0,
    });
    const signed = new Intl.NumberFormat(i18n.language, {
      ...unit,
      maximumFractionDigits: 0,
      signDisplay: 'exceptZero',
    });

    return {
      signed: (next: number) => signed.format(next),
      value: (next: number) => value.format(next),
    };
  }, [metricType, i18n.language]);
};

/**
 * The change across the selected range, worded for that range: "in the last
 * 90 days" on a 90-day window, "since start" on all time. It used to read
 * "this week" whatever the window was.
 */
const useDeltaLabel = (kpi: KpiProgress, format: KpiFormatters): string => {
  const { t } = useTranslation();
  const hasChange = kpi.delta !== null && kpi.delta !== 0;
  const value = format.signed(kpi.delta ?? 0);

  if (kpi.windowDays === null) {
    return hasChange
      ? t('message.value-since-start', { value })
      : t('message.no-change-since-start');
  }

  return hasChange
    ? t('message.value-in-last-count-days', { count: kpi.windowDays, value })
    : t('message.no-change-in-last-count-days', { count: kpi.windowDays });
};

/** One KPI: where it is, where it is heading, and where it needs to be. */
const KpiProgressRow: React.FC<KpiProgressRowProps> = ({ kpi }) => {
  const { t } = useTranslation();
  const format = useKpiFormatters(kpi.metricType);
  const deltaLabel = useDeltaLabel(kpi, format);
  const status = STATUS[kpi.status];
  const percent = kpi.target > 0 ? (kpi.current / kpi.target) * 100 : 0;
  const targetOffset = 100;
  const remaining = Math.max(0, kpi.target - kpi.current);
  const targetLabel = t('message.target-value-formatted', {
    value: format.value(kpi.target),
  });

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
          data-testid="kpi-target"
          size="text-sm">
          {targetLabel}
        </Typography>
      </div>

      <div className="tw:flex tw:items-baseline tw:gap-2">
        <Typography
          className="tw:text-text-primary!"
          data-testid="kpi-current"
          size="text-xl"
          weight="semibold">
          {format.value(kpi.current)}
        </Typography>
        <Typography
          className="tw:text-text-tertiary!"
          data-testid="kpi-remaining"
          size="text-sm">
          {t('message.value-to-go', { value: format.value(remaining) })}
        </Typography>
      </div>

      {/* The target sits at the far end of the track, so the fill reads as a
        fraction of the goal rather than of an arbitrary maximum. */}
      <div
        aria-label={targetLabel}
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
        <Typography
          className="tw:text-text-tertiary!"
          data-testid="kpi-delta"
          size="text-sm">
          {deltaLabel}
        </Typography>
        {/* Two facts side by side, not one sentence: the separator is drawn
          rather than spliced into a translated string. */}
        <span
          aria-hidden
          className="tw:size-1 tw:shrink-0 tw:rounded-full tw:bg-fg-quaternary"
        />
        <Typography
          className="tw:text-text-tertiary!"
          data-testid="kpi-days-left"
          size="text-sm">
          {t('message.count-days-left', { count: kpi.daysLeft })}
        </Typography>
      </div>

      {kpi.projected !== null && kpi.status !== 'onTrack' && (
        <Typography
          className="tw:text-utility-warning-700!"
          data-testid="kpi-projection"
          size="text-sm">
          {t('message.at-this-pace-projection-value', {
            date: formatDate(kpi.endDate),
            value: format.value(kpi.projected),
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
