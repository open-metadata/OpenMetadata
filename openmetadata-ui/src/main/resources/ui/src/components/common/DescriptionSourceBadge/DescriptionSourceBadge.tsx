/*
 *  Copyright 2024 Collate.
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

import { Tooltip } from 'antd';
import classNames from 'classnames';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as AISuggestionIcon } from '../../../assets/svg/ic-ai-suggestion.svg';
import { ReactComponent as AutomatedIcon } from '../../../assets/svg/ic-automated.svg';
import { ReactComponent as CheckCircleIcon } from '../../../assets/svg/ic-check-circle.svg';
import { ReactComponent as PropagatedIcon } from '../../../assets/svg/ic-propagated.svg';
import { ChangeSource } from '../../../generated/type/changeSummaryMap';
import {
  formatDate,
  formatDateTime,
  getShortRelativeTime,
} from '../../../utils/date-time/DateTimeUtils';
import UserPopOverCard from '../PopOverCard/UserPopOverCard';
import './description-source-badge.less';
import { DescriptionSourceBadgeProps } from './DescriptionSourceBadge.interface';

interface BadgeConfig {
  labelKey: string;
  tooltipKey: string;
  icon: React.ReactNode;
  className: string;
  testId: string;
  iconOnly?: boolean;
}

const BADGE_CONFIG: Partial<Record<ChangeSource, BadgeConfig>> = {
  [ChangeSource.Suggested]: {
    labelKey: 'label.ai',
    tooltipKey: 'label.ai-generated-description',
    icon: <AISuggestionIcon height={14} width={14} />,
    className: 'badge-suggested',
    testId: 'ai-suggested-badge',
    iconOnly: true,
  },
  [ChangeSource.Automated]: {
    labelKey: 'label.automated',
    tooltipKey: 'label.automated-description',
    icon: <AutomatedIcon height={16} width={16} />,
    className: 'badge-automated',
    testId: 'automated-badge',
    iconOnly: true,
  },
  [ChangeSource.Propagated]: {
    labelKey: 'label.propagated',
    tooltipKey: 'label.description-inherited-from-parent-entity',
    icon: <PropagatedIcon height={16} width={16} />,
    className: 'badge-propagated',
    testId: 'propagated-badge',
    iconOnly: true,
  },
};

const DescriptionSourceBadge = ({
  changeSummaryEntry,
  showAcceptedBy = true,
  showBadge = true,
  showTimestamp = true,
}: DescriptionSourceBadgeProps) => {
  const { t } = useTranslation();

  const config = useMemo(() => {
    if (!changeSummaryEntry?.changeSource) {
      return null;
    }

    return BADGE_CONFIG[changeSummaryEntry.changeSource] ?? null;
  }, [changeSummaryEntry?.changeSource]);

  const tooltipContent = changeSummaryEntry?.changedAt
    ? formatDateTime(changeSummaryEntry.changedAt)
    : undefined;

  const renderTooltipContent = useMemo(() => {
    if (!showBadge || !config) {
      return '';
    }

    return (
      <>
        {config.iconOnly ? (
          <Tooltip title={t(config.tooltipKey)}>
            <output
              aria-live="polite"
              className="description-source-icon"
              data-testid={config.testId}>
              {config.icon}
            </output>
          </Tooltip>
        ) : (
          <Tooltip title={tooltipContent}>
            <div
              className={classNames(
                'description-source-badge',
                config.className
              )}>
              {config.icon}
              <span>{t(config.labelKey)}</span>
            </div>
          </Tooltip>
        )}
      </>
    );
  }, [showBadge, config, t, tooltipContent]);

  const isManualChange =
    changeSummaryEntry?.changeSource === ChangeSource.Manual;

  if (!config && !isManualChange) {
    return null;
  }

  const actorLabel = config ? t('label.accepted-by') : t('label.authored-by');

  const relativeTime = changeSummaryEntry?.changedAt
    ? getShortRelativeTime(changeSummaryEntry.changedAt) ||
      formatDate(changeSummaryEntry.changedAt)
    : '';

  const actorInfo =
    showAcceptedBy && changeSummaryEntry?.changedBy ? (
      <span
        className={classNames('description-source-text', {
          'description-source-text-success': Boolean(config),
        })}
        data-testid="source-actor">
        {config ? (
          <CheckCircleIcon className="text-primary" height={12} width={12} />
        ) : null}
        <span className="d-flex items-center gap-1">
          <span className="text-grey-500">{actorLabel}</span>

          <UserPopOverCard
            showUserName
            className="text-grey-900 actor-username"
            displayName={changeSummaryEntry.changedBy}
            profileWidth={16}
            showUserProfile={false}
            userName={changeSummaryEntry.changedBy || '-'}
          />
        </span>
      </span>
    ) : null;

  const timestampInfo =
    showTimestamp && relativeTime ? (
      <span className="description-source-time" data-testid="source-timestamp">
        {relativeTime}
      </span>
    ) : null;

  if (!showBadge && !actorInfo && !timestampInfo) {
    return null;
  }

  return (
    <div
      className="description-source-container"
      data-testid="description-source-container">
      {renderTooltipContent}
      {(actorInfo || timestampInfo) && (
        <div className="description-source-metadata">
          {actorInfo}
          {actorInfo && timestampInfo ? (
            <span className="description-source-separator">•</span>
          ) : null}
          {timestampInfo}
        </div>
      )}
    </div>
  );
};

export default DescriptionSourceBadge;
