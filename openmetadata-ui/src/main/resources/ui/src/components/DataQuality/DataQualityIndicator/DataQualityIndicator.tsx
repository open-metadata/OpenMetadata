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
  Divider,
  FeaturedIcon,
  HoverCard,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  ArrowRight,
  ArrowUp,
  DataQualityAlarm,
  DataQualityAlarmUpstream,
  XCircle,
} from '@openmetadata/ui-core-components/icons';
import QueryString from 'qs';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { LineageLayer } from '../../../generated/configuration/lineageSettings';
import { Transi18next } from '../../../utils/i18next/LocalUtil';
import { getEntityDetailsPath } from '../../../utils/RouterUtils';
import { ProfilerTabPath } from '../../Database/Profiler/ProfilerDashboard/profilerDashboard.interface';
import {
  DataQualityIndicatorCounts,
  DataQualityIndicatorLevel,
  DataQualityIndicatorProps,
} from './DataQualityIndicator.types';
import {
  getDataQualityIndicatorLevel,
  hasMultipleDataQualityConditions,
} from './DataQualityIndicator.utils';

const UpstreamBadge = ({ className }: { className: string }) => (
  <span
    aria-hidden
    className={`tw:grid tw:place-items-center tw:rounded-full tw:bg-warning-solid tw:text-fg-white ${className}`}>
    <ArrowUp className="tw:size-2.5" />
  </span>
);

const pluralKey = (key: string, count: number) =>
  count === 1 ? key : `${key}-plural`;

const TONE_CLASSES = {
  error: {
    icon: 'tw:text-fg-error-primary',
    trigger: 'tw:hover:bg-error-primary',
  },
  warning: {
    icon: 'tw:text-fg-warning-primary',
    trigger: 'tw:hover:bg-warning-primary',
  },
} as const;

const ConditionList = ({ counts }: { counts: DataQualityIndicatorCounts }) => {
  const rows = [
    {
      count: counts.failingTests,
      icon: <XCircle className="tw:size-4 tw:text-fg-error-primary" />,
      i18nKey: 'message.dq-failing-tests-count',
    },
    {
      count: counts.unresolvedIncidents,
      icon: (
        <DataQualityAlarm className="tw:text-fg-warning-primary" size={16} />
      ),
      i18nKey: 'message.dq-unresolved-incidents-count',
    },
    {
      count: counts.upstreamIssues,
      icon: <UpstreamBadge className="tw:size-4" />,
      i18nKey: 'message.dq-upstream-issues-count',
    },
  ].filter((row) => row.count > 0);

  return (
    <ul className="tw:flex tw:flex-col tw:gap-2">
      {rows.map((row) => (
        <li
          className="tw:flex tw:items-center tw:gap-2.5 tw:text-sm tw:text-secondary"
          key={row.i18nKey}>
          <span className="tw:grid tw:size-5 tw:shrink-0 tw:place-items-center">
            {row.icon}
          </span>
          <span>
            <Transi18next
              i18nKey={pluralKey(row.i18nKey, row.count)}
              renderElement={
                <strong className="tw:font-semibold tw:text-primary" />
              }
              values={{ count: row.count }}
            />
          </span>
        </li>
      ))}
    </ul>
  );
};

interface IndicatorContent {
  title: string;
  description: ReactNode;
  actionLabel: string;
  to: string | { pathname: string; search: string };
}

const useIndicatorContent = (
  level: DataQualityIndicatorLevel,
  counts: DataQualityIndicatorCounts,
  tableFqn: string
): IndicatorContent | null => {
  const { t } = useTranslation();

  if (level === 'none') {
    return null;
  }

  const profilerPath = (subTab: ProfilerTabPath) =>
    getEntityDetailsPath(
      EntityType.TABLE,
      tableFqn,
      EntityTabs.PROFILER,
      subTab
    );

  if (hasMultipleDataQualityConditions(counts)) {
    return {
      title: t('label.data-quality-needs-attention'),
      description: <ConditionList counts={counts} />,
      actionLabel: t('label.view-data-quality'),
      to: profilerPath(ProfilerTabPath.DATA_QUALITY),
    };
  }

  if (level === 'failing') {
    return {
      title: t('label.data-quality-test-failing'),
      description: t(
        pluralKey('message.dq-failing-tests-description', counts.failingTests),
        { count: counts.failingTests }
      ),
      actionLabel: t(pluralKey('label.view-failing-test', counts.failingTests)),
      to: profilerPath(ProfilerTabPath.DATA_QUALITY),
    };
  }

  if (level === 'incident') {
    return {
      title: t('label.data-quality-incident-still-open'),
      description: t(
        pluralKey(
          'message.dq-incident-open-tests-passing',
          counts.unresolvedIncidents
        ),
        { count: counts.unresolvedIncidents }
      ),
      actionLabel: t('label.view-incident'),
      to: profilerPath(ProfilerTabPath.INCIDENTS),
    };
  }

  return {
    title: t('label.upstream-data-quality-issue'),
    description: t('message.dq-upstream-failing-test'),
    actionLabel: t('label.view-upstream-issue'),
    to: {
      pathname: getEntityDetailsPath(
        EntityType.TABLE,
        tableFqn,
        EntityTabs.LINEAGE
      ),
      search: QueryString.stringify({
        layers: [LineageLayer.DataObservability],
      }),
    },
  };
};

export const DataQualityIndicator = ({
  counts,
  tableFqn,
}: DataQualityIndicatorProps) => {
  const level = getDataQualityIndicatorLevel(counts);
  const content = useIndicatorContent(level, counts, tableFqn);

  if (!content) {
    return null;
  }

  const { title, description, actionLabel, to } = content;
  const tone = level === 'failing' ? 'error' : 'warning';
  const isUpstream = level === 'upstream';
  const isList = hasMultipleDataQualityConditions(counts);
  const AlarmIcon = isUpstream ? DataQualityAlarmUpstream : DataQualityAlarm;

  const card = (
    <div className="tw:flex tw:w-80 tw:flex-col tw:gap-3">
      <div className="tw:flex tw:items-start tw:gap-3">
        <FeaturedIcon
          className="tw:shrink-0"
          color={tone}
          icon={<AlarmIcon size={16} />}
          shape="square"
          size="sm"
        />
        <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-1 tw:pt-1">
          <Typography as="p" size="text-sm" weight="semibold">
            {title}
          </Typography>
          {!isList && (
            <Typography as="p" className="tw:text-tertiary" size="text-sm">
              {description}
            </Typography>
          )}
        </div>
      </div>
      {isList && description}
      <Divider />
      <Link
        className="tw:inline-flex tw:items-center tw:gap-1 tw:self-start tw:text-sm tw:font-semibold tw:text-brand-secondary"
        data-testid="dq-indicator-action"
        to={to}>
        {actionLabel}
        <ArrowRight aria-hidden className="tw:size-4" />
      </Link>
    </div>
  );

  return (
    <HoverCard content={card} placement="bottom start">
      <Link
        aria-label={title}
        className={`tw:inline-flex tw:rounded-lg tw:p-1.5 ${TONE_CLASSES[tone].trigger}`}
        data-level={level}
        data-testid="dq-indicator"
        to={to}>
        {/* Colour sits on the svg, not the link: antd's global a:hover/a:focus
            colour would otherwise turn the icon primary blue. */}
        <AlarmIcon
          className={TONE_CLASSES[tone].icon}
          data-testid={
            isUpstream ? 'dq-indicator-upstream-icon' : 'dq-indicator-icon'
          }
          size={20}
        />
      </Link>
    </HoverCard>
  );
};
