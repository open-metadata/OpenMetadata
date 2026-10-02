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
import { Tooltip } from '@openmetadata/ui-core-components';
import { ArrowUp } from '@openmetadata/ui-core-components/icons';
import QueryString from 'qs';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as AlertIcon } from '../../../assets/svg/ic-alert-red.svg';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { LineageLayer } from '../../../generated/configuration/lineageSettings';
import { getEntityDetailsPath } from '../../../utils/RouterUtils';
import { ProfilerTabPath } from '../../Database/Profiler/ProfilerDashboard/profilerDashboard.interface';
import { DataQualityIndicatorProps } from './DataQualityIndicator.types';
import {
  getDataQualityIndicatorLevel,
  hasMultipleDataQualityConditions,
} from './DataQualityIndicator.utils';

export const DataQualityIndicator = ({
  counts,
  tableFqn,
}: DataQualityIndicatorProps) => {
  const { t } = useTranslation();
  const level = getDataQualityIndicatorLevel(counts);

  if (level === 'none') {
    return null;
  }

  const isMultiple = hasMultipleDataQualityConditions(counts);
  const profilerPath = (subTab: ProfilerTabPath) =>
    getEntityDetailsPath(
      EntityType.TABLE,
      tableFqn,
      EntityTabs.PROFILER,
      subTab
    );

  let title: string;
  let description: ReactNode;
  let to: string | { pathname: string; search: string };

  if (isMultiple) {
    title = t('label.data-quality-needs-attention');
    description = (
      <ul>
        {counts.failingTests > 0 && (
          <li>
            {t('message.dq-failing-tests-count', {
              count: counts.failingTests,
            })}
          </li>
        )}
        {counts.unresolvedIncidents > 0 && (
          <li>
            {t('message.dq-unresolved-incidents-count', {
              count: counts.unresolvedIncidents,
            })}
          </li>
        )}
        {counts.upstreamIssues > 0 && (
          <li>
            {t('message.dq-upstream-issues-count', {
              count: counts.upstreamIssues,
            })}
          </li>
        )}
      </ul>
    );
    to = profilerPath(ProfilerTabPath.DATA_QUALITY);
  } else if (level === 'failing') {
    title = t('label.data-quality-test-failing');
    description = t('message.dq-failing-tests-count', {
      count: counts.failingTests,
    });
    to = profilerPath(ProfilerTabPath.DATA_QUALITY);
  } else if (level === 'incident') {
    title = t('label.data-quality-incident-still-open');
    description = t('message.dq-incident-open-tests-passing');
    to = profilerPath(ProfilerTabPath.INCIDENTS);
  } else {
    title = t('label.upstream-data-quality-issue');
    description = t('message.dq-upstream-failing-test');
    to = {
      pathname: getEntityDetailsPath(
        EntityType.TABLE,
        tableFqn,
        EntityTabs.LINEAGE
      ),
      search: QueryString.stringify({
        layers: [LineageLayer.DataObservability],
      }),
    };
  }

  const isError = level === 'failing';

  return (
    <Tooltip
      excludeTriggerFromTabOrder
      description={description}
      placement="right"
      title={title}
      triggerClassName="tw:inline-flex">
      <Link
        aria-label={title}
        className={
          isError
            ? 'tw:relative tw:inline-flex tw:text-fg-error-primary'
            : 'tw:relative tw:inline-flex tw:text-fg-warning-primary'
        }
        data-level={level}
        data-testid="dq-indicator"
        to={to}>
        <AlertIcon height={24} width={24} />
        {level === 'upstream' && (
          <ArrowUp
            aria-hidden
            className="tw:absolute tw:-right-1 tw:-bottom-1 tw:size-3 tw:rounded-full tw:bg-warning-solid tw:text-fg-white"
            data-testid="dq-indicator-upstream-badge"
          />
        )}
      </Link>
    </Tooltip>
  );
};
