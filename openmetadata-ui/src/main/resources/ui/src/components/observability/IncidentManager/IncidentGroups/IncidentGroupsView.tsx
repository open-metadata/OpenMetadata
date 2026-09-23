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
// The core-components icon barrel re-exports the design team's own SVG set
// only; it carries no trend glyph, so this one comes from the shared
// `@untitledui/icons` both packages pin at the same range.
import { TrendUp02 } from '@untitledui/icons';
import { isEmpty } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../../../enums/common.enum';
import ErrorPlaceHolder from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../../common/Loader/Loader';
import IncidentGroupByDropdown from './IncidentGroupByDropdown';
import { IncidentGroupsViewProps } from './IncidentGroups.types';
import { countRecurringIncidentGroups } from './IncidentGroups.utils';
import IncidentGroupsTable from './IncidentGroupsTable';
import { useIncidentGroups } from './useIncidentGroups';

/**
 * Grouped incident listing: the `Group by` dimension picker, the header stats
 * over the fetched groups, and the group table itself — plus the
 * loading/empty/error states of the fetch that feeds all three.
 */
const IncidentGroupsView = ({ refreshKey }: IncidentGroupsViewProps) => {
  const { t } = useTranslation();
  const {
    groupBy,
    incidentGroups,
    paging,
    sortType,
    isLoading,
    isError,
    handleGroupByChange,
    handleSortTypeChange,
  } = useIncidentGroups({ refreshKey });

  /**
   * Only the loaded page can be counted: the endpoint reports the group total
   * but no recurring total, and a group is recurring by a field that only
   * arrives with the group itself.
   */
  const recurringCount = useMemo(
    () => countRecurringIncidentGroups(incidentGroups),
    [incidentGroups]
  );

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

    return (
      <IncidentGroupsTable
        groupBy={groupBy}
        groups={incidentGroups}
        sortType={sortType}
        onSortTypeChange={handleSortTypeChange}
      />
    );
  };

  const hasStats = !isLoading && !isError;

  return (
    <Box className="tw:gap-4" data-testid="incident-groups" direction="col">
      <Box className="tw:items-center tw:justify-between tw:gap-2">
        <Box className="tw:items-center tw:gap-3">
          <Typography
            className="tw:text-secondary"
            data-testid="incident-groups-count"
            size="text-sm"
            weight="semibold">
            {hasStats
              ? t('label.group-count', {
                  count: paging?.total ?? incidentGroups.length,
                })
              : ''}
          </Typography>
          {hasStats && (
            <Tooltip
              placement="top"
              title={t('message.recurring-groups-loaded')}>
              <TooltipTrigger>
                <Box className="tw:items-center tw:gap-1 tw:text-secondary">
                  <TrendUp02 className="tw:size-4" />
                  <Typography
                    as="span"
                    data-testid="incident-groups-recurring-count"
                    size="text-sm"
                    weight="semibold">
                    {t('label.recurring-count', { count: recurringCount })}
                  </Typography>
                </Box>
              </TooltipTrigger>
            </Tooltip>
          )}
        </Box>
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
