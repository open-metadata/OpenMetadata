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

import { BadgeWithDot, Button } from '@openmetadata/ui-core-components';
import { AlertTriangle, ArrowUpRight } from '@untitledui/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ExpandableBannerText from './ExpandableBannerText';
import type { IncidentDetailsProps } from './TestCaseLastRunBanner.interface';

const IncidentDetails = ({
  canAcknowledge,
  config,
  description,
  incidentId,
  incidentLink,
  onAcknowledge,
  statusConfig,
}: IncidentDetailsProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isAcknowledging, setIsAcknowledging] = useState(false);

  const handleAcknowledge = async () => {
    setIsAcknowledging(true);
    try {
      await onAcknowledge?.();
    } finally {
      setIsAcknowledging(false);
    }
  };

  if (!incidentLink) {
    return null;
  }

  return (
    <div
      className={`tw:flex tw:flex-col tw:gap-4 tw:border-t tw:px-5 tw:py-3 tw:lg:flex-row tw:lg:items-center ${config.dividerClassName} ${config.incidentClassName}`}
      data-testid="test-case-last-run-incident">
      <div className="tw:flex tw:min-w-0 tw:flex-1 tw:items-center tw:gap-3">
        <AlertTriangle
          aria-hidden="true"
          className={`tw:shrink-0 ${config.statusClassName}`}
          data-testid="test-case-incident-icon"
          size={20}
        />
        <div
          className="tw:flex tw:min-w-0 tw:items-baseline tw:gap-2"
          data-testid="test-case-incident-text">
          <span
            className="tw:shrink-0 tw:font-mono tw:text-xs tw:font-semibold tw:leading-normal tw:text-secondary"
            data-testid="test-case-incident-id">
            {incidentId}
          </span>
          {description && (
            <ExpandableBannerText
              dataTestId="test-case-incident-description"
              text={description}
            />
          )}
        </div>
        {statusConfig && (
          <span className="tw:shrink-0" data-testid="test-case-incident-status">
            <BadgeWithDot
              className="tw:bg-white"
              color={statusConfig.color}
              size="sm"
              type="pill-color">
              {t(statusConfig.label)}
            </BadgeWithDot>
          </span>
        )}
      </div>
      <div
        className="tw:flex tw:w-full tw:items-center tw:justify-end tw:gap-2 tw:lg:w-52 tw:lg:shrink-0"
        data-testid="test-case-incident-actions">
        {canAcknowledge && (
          <Button
            className={`tw:shrink-0 ${config.actionBorderClassName}`}
            color="secondary"
            data-testid="acknowledge-incident-button"
            isLoading={isAcknowledging}
            size="xs"
            onClick={handleAcknowledge}>
            <span className={config.statusClassName}>
              {t('label.acknowledge')}
            </span>
          </Button>
        )}
        <Button
          className="tw:shrink-0"
          color="primary"
          data-testid="view-incident-button"
          iconTrailing={ArrowUpRight}
          size="xs"
          onClick={() => navigate(incidentLink.path)}>
          {t('label.view-entity', { entity: t('label.incident') })}
        </Button>
      </div>
    </div>
  );
};

export default IncidentDetails;
