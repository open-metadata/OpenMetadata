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
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../../../enums/common.enum';
import ErrorPlaceHolder from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../../common/Loader/Loader';
import IncidentGroupByDropdown from './IncidentGroupByDropdown';
import { IncidentGroupsViewProps } from './IncidentGroups.types';
import { useIncidentGroups } from './useIncidentGroups';

/**
 * Grouped incident listing: the `Group by` dimension picker plus the
 * loading/empty/error states of the groups fetch it drives. The group table
 * itself is rendered as `children` — until it lands, the legacy flat listing
 * stays in place on the page.
 */
const IncidentGroupsView = ({ children }: IncidentGroupsViewProps) => {
  const { t } = useTranslation();
  const {
    groupBy,
    incidentGroups,
    paging,
    isLoading,
    isError,
    handleGroupByChange,
  } = useIncidentGroups();

  const renderContent = () => {
    if (isLoading) {
      return (
        <Box className="tw:py-8" data-testid="incident-groups-loader">
          <Loader />
        </Box>
      );
    }

    if (isError) {
      return (
        <ErrorPlaceHolder
          className="tw:border-none"
          size={SIZE.MEDIUM}
          type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
          <div data-testid="incident-groups-error">
            {t('server.entity-fetch-error', {
              entity: t('label.incident-plural'),
            })}
          </div>
        </ErrorPlaceHolder>
      );
    }

    if (isEmpty(incidentGroups)) {
      return (
        <ErrorPlaceHolder
          className="tw:border-none"
          placeholderText={t('message.no-active-incidents')}
          size={SIZE.MEDIUM}
          type={ERROR_PLACEHOLDER_TYPE.NO_DATA}>
          <div data-testid="incident-groups-empty">
            {t('message.no-active-incidents-description')}
          </div>
        </ErrorPlaceHolder>
      );
    }

    return children;
  };

  return (
    <Box className="tw:gap-4" data-testid="incident-groups" direction="col">
      <Box className="tw:items-center tw:justify-between tw:gap-2">
        <Typography
          inline
          className="tw:text-secondary"
          data-testid="incident-groups-count"
          size="text-sm"
          weight="semibold">
          {isLoading || isError
            ? ''
            : `${paging?.total ?? incidentGroups.length} ${t(
                'label.group-plural'
              )}`}
        </Typography>
        <IncidentGroupByDropdown
          value={groupBy}
          onChange={handleGroupByChange}
        />
      </Box>
      {renderContent()}
    </Box>
  );
};

export default IncidentGroupsView;
