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

import { CalendarDate, getLocalTimeZone } from '@internationalized/date';
import {
  Box,
  DateRangePicker,
  FilterSelect,
  FilterSelectOption,
} from '@openmetadata/ui-core-components';
import { debounce } from 'lodash';
import { DateTime } from 'luxon';
import { FC, useCallback, useMemo, useState } from 'react';
import type { DateValue } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { AuditLogFiltersProps } from '../../../../../../components/AuditLog/AuditLogFilters.interface';
import { SearchIndex } from '../../../../../../enums/search.enum';
import { User } from '../../../../../../generated/entity/teams/user';
import { searchQuery } from '../../../../../../rest/searchAPI';
import {
  AuditLogActiveFilter,
  AuditLogFilterCategoryType,
} from '../../../../../../types/auditLogs.interface';
import { formatUsersResponse } from '../../../../../../utils/APIUtils';
import {
  buildParamsFromFilters,
  getAuditLogCategoryLabel,
} from '../../../../../../utils/AuditLogUtils';
import { CUSTOM_DATE_RANGE_KEY } from '../../../../../../utils/DatePickerMenuUtils';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import { getTermQuery } from '../../../../../../utils/SearchPureUtils';
import { getEntityTypeSearchOptions } from './AccessControl.constants';

const AccessControlAuditLogFilters: FC<AuditLogFiltersProps> = ({
  activeFilters,
  onFiltersChange,
}) => {
  const { t } = useTranslation();

  const [userOptions, setUserOptions] = useState<FilterSelectOption[]>([]);
  const [botOptions, setBotOptions] = useState<FilterSelectOption[]>([]);
  const allEntityTypeOptions = useMemo(getEntityTypeSearchOptions, [t]);
  const [filteredEntityTypeOptions, setFilteredEntityTypeOptions] = useState<
    FilterSelectOption[]
  >(getEntityTypeSearchOptions);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isLoadingBots, setIsLoadingBots] = useState(false);
  const [pendingDateRange, setPendingDateRange] = useState<{
    start: DateValue;
    end: DateValue;
  } | null>(null);

  const timeFilter = useMemo(
    () => activeFilters.find((f) => f.category === 'time'),
    [activeFilters]
  );

  const currentTimeRange = useMemo(() => {
    const value = timeFilter?.value as
      | { startTs?: number; endTs?: number }
      | undefined;

    if (!value?.startTs || !value?.endTs) {
      return null;
    }

    const startDate = new Date(value.startTs);
    const endDate = new Date(value.endTs);

    // @internationalized/date is externalized in ui-core-components but resolves to a
    // different patch version (3.12.0) than the one openmetadata-ui locks to (3.12.1).
    // TypeScript therefore treats CalendarDate / DateValue from each copy as distinct
    // nominal types even though they are structurally identical. Cast until both
    // packages resolve the same version.
    return {
      start: new CalendarDate(
        startDate.getFullYear(),
        startDate.getMonth() + 1,
        startDate.getDate()
      ) as unknown as DateValue,
      end: new CalendarDate(
        endDate.getFullYear(),
        endDate.getMonth() + 1,
        endDate.getDate()
      ) as unknown as DateValue,
    };
  }, [timeFilter]);

  const getSelectedValues = useCallback(
    (category: AuditLogFilterCategoryType): string[] => {
      const filter = activeFilters.find((f) => f.category === category);

      return filter ? [filter.value.key] : [];
    },
    [activeFilters]
  );

  const handleDateRangeApply = useCallback(() => {
    if (!pendingDateRange) {
      return;
    }

    const tz = getLocalTimeZone();
    const startTs = pendingDateRange.start.toDate(tz).setHours(0, 0, 0, 0);
    const endTs = pendingDateRange.end.toDate(tz).setHours(23, 59, 59, 999);

    const label = `${DateTime.fromMillis(startTs).toFormat(
      'yyyy-MM-dd'
    )} -> ${DateTime.fromMillis(endTs).toFormat('yyyy-MM-dd')}`;

    const newFilter: AuditLogActiveFilter = {
      category: 'time',
      categoryLabel: getAuditLogCategoryLabel('time', t),
      value: {
        key: CUSTOM_DATE_RANGE_KEY,
        label,
        value: CUSTOM_DATE_RANGE_KEY,
        startTs,
        endTs,
      } as AuditLogActiveFilter['value'],
    };

    const existingIndex = activeFilters.findIndex((f) => f.category === 'time');
    const newFilters =
      existingIndex >= 0
        ? activeFilters.map((f, i) => (i === existingIndex ? newFilter : f))
        : [...activeFilters, newFilter];

    const params = buildParamsFromFilters(newFilters);
    onFiltersChange(newFilters, params);
    setPendingDateRange(null);
  }, [activeFilters, onFiltersChange, pendingDateRange, t]);

  const makeChangeHandler = useCallback(
    (
        category: AuditLogFilterCategoryType,
        currentOptions: FilterSelectOption[]
      ) =>
      (values: string[]) => {
        const optionMap = new Map(
          currentOptions.map((o) => [o.value, o.label as string])
        );
        let newFilters: AuditLogActiveFilter[];

        if (values.length === 0) {
          newFilters = activeFilters.filter((f) => f.category !== category);
        } else {
          const value = values[0];
          const label = optionMap.get(value) ?? value;
          const existingIndex = activeFilters.findIndex(
            (f) => f.category === category
          );
          const newFilter: AuditLogActiveFilter = {
            category,
            categoryLabel: getAuditLogCategoryLabel(category, t),
            value: { key: value, label, value },
          };

          if (existingIndex >= 0) {
            newFilters = [...activeFilters];
            newFilters[existingIndex] = newFilter;
          } else {
            newFilters = [...activeFilters, newFilter];
          }
        }

        const params = buildParamsFromFilters(newFilters);
        onFiltersChange(newFilters, params);
      },
    [activeFilters, onFiltersChange, t]
  );

  const fetchUsers = useCallback(async (search: string) => {
    setIsLoadingUsers(true);
    try {
      const response = await searchQuery({
        query: search,
        pageNumber: 1,
        pageSize: 10,
        queryFilter: getTermQuery({ isBot: 'false' }),
        searchIndex: SearchIndex.USER,
      });
      const users: User[] = formatUsersResponse(response.hits.hits);
      setUserOptions(
        users.map((user) => ({
          label: getEntityName(user) || user.name,
          value: user.name,
        }))
      );
    } catch {
      setUserOptions([]);
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  const fetchBots = useCallback(async (search: string) => {
    setIsLoadingBots(true);
    try {
      const response = await searchQuery({
        query: search,
        pageNumber: 1,
        pageSize: 10,
        queryFilter: getTermQuery({ isBot: 'true' }),
        searchIndex: SearchIndex.USER,
      });
      const bots: User[] = formatUsersResponse(response.hits.hits);
      setBotOptions(
        bots.map((bot) => ({
          label: getEntityName(bot) || bot.name,
          value: bot.name,
        }))
      );
    } catch {
      setBotOptions([]);
    } finally {
      setIsLoadingBots(false);
    }
  }, []);

  const debouncedFetchUsers = useMemo(
    () => debounce(fetchUsers, 300),
    [fetchUsers]
  );

  const debouncedFetchBots = useMemo(
    () => debounce(fetchBots, 300),
    [fetchBots]
  );

  return (
    <Box
      align="center"
      data-testid="audit-log-filters"
      direction="row"
      gap={2}
      wrap="wrap">
      <DateRangePicker
        value={
          (pendingDateRange ?? currentTimeRange) as unknown as Parameters<
            typeof DateRangePicker
          >[0]['value']
        }
        onApply={handleDateRangeApply}
        onCancel={() => setPendingDateRange(null)}
        onChange={(range) =>
          setPendingDateRange(
            range
              ? {
                  start: range.start as unknown as DateValue,
                  end: range.end as unknown as DateValue,
                }
              : null
          )
        }
      />
      <FilterSelect
        hideCounts
        searchable
        isLoading={isLoadingUsers}
        label={t('label.user')}
        options={userOptions}
        selectedValues={getSelectedValues('user')}
        selectionMode="single"
        triggerVariant="button"
        onChange={makeChangeHandler('user', userOptions)}
        onOpenChange={(open) => {
          if (open) {
            fetchUsers('');
          }
        }}
        onSearch={debouncedFetchUsers}
      />
      <FilterSelect
        hideCounts
        searchable
        isLoading={isLoadingBots}
        label={t('label.bot')}
        options={botOptions}
        selectedValues={getSelectedValues('bot')}
        selectionMode="single"
        triggerVariant="button"
        onChange={makeChangeHandler('bot', botOptions)}
        onOpenChange={(open) => {
          if (open) {
            fetchBots('');
          }
        }}
        onSearch={debouncedFetchBots}
      />
      <FilterSelect
        hideCounts
        searchable
        isLoading={false}
        label={t('label.entity-type')}
        options={filteredEntityTypeOptions}
        selectedValues={getSelectedValues('entityType')}
        selectionMode="single"
        triggerVariant="button"
        onChange={makeChangeHandler('entityType', filteredEntityTypeOptions)}
        onOpenChange={(open) => {
          if (open) {
            setFilteredEntityTypeOptions(allEntityTypeOptions);
          }
        }}
        onSearch={(text) => {
          const filtered = text
            ? allEntityTypeOptions.filter((option) => {
                const label =
                  typeof option.label === 'string' ? option.label : '';

                return label.toLowerCase().includes(text.toLowerCase());
              })
            : allEntityTypeOptions;
          setFilteredEntityTypeOptions(filtered);
        }}
      />
    </Box>
  );
};

export default AccessControlAuditLogFilters;
