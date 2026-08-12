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
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ExpandableBannerText from './ExpandableBannerText';
import type { IncidentDetailsProps } from './TestCaseLastRunBanner.interface';

const IncidentDetails = ({
  config,
  description,
  incidentId,
  incidentLink,
  statusConfig,
}: IncidentDetailsProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (!incidentLink) {
    return null;
  }

  return (
    <div
      className={`tw:flex tw:flex-col tw:gap-4 tw:border-t tw:px-5 tw:py-3 tw:lg:flex-row tw:lg:items-start ${config.dividerClassName} ${config.incidentClassName}`}
      data-testid="test-case-last-run-incident">
      <div className="tw:flex tw:min-w-0 tw:flex-1 tw:items-start tw:gap-3">
        <AlertTriangle
          aria-hidden="true"
          className={`tw:shrink-0 tw:self-start ${config.statusClassName}`}
          data-testid="test-case-incident-icon"
          size={20}
        />
        <div className="tw:min-w-0" data-testid="test-case-incident-text">
          {description ? (
            <ExpandableBannerText
              dataTestId="test-case-incident-description"
              prefix={
                <>
                  <span
                    className="tw:text-xs tw:font-semibold tw:leading-normal tw:text-primary"
                    data-testid="test-case-incident-id">
                    {incidentId},
                  </span>{' '}
                </>
              }
              text={description}
            />
          ) : (
            <span
              className="tw:text-xs tw:font-semibold tw:leading-normal tw:text-primary"
              data-testid="test-case-incident-id">
              {incidentId}
            </span>
          )}
        </div>
        {statusConfig && (
          <span
            className="tw:shrink-0 tw:self-start"
            data-testid="test-case-incident-status">
            <BadgeWithDot
              className="tw:bg-primary"
              color={statusConfig.color}
              size="sm"
              type="pill-color">
              {t(statusConfig.label)}
            </BadgeWithDot>
          </span>
        )}
      </div>
      <div
        className="tw:flex tw:w-full tw:items-start tw:lg:w-52 tw:lg:shrink-0"
        data-testid="test-case-incident-actions">
        <Button
          className="tw:ml-auto tw:shrink-0"
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
