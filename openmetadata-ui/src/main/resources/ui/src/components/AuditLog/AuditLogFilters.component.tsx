/*
 *  Copyright 2025 Collate.
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

import { DateTime } from 'luxon';
import { Space } from 'antd';
import { debounce } from 'lodash';
import { DateRangeObject } from 'Models';
import { FC, useCallback, useMemo, useState } from 'react';

import { useTranslation } from 'react-i18next';
import { AUDIT_LOG_TIME_FILTER_RANGE } from '../../constants/auditLog.constant';
import { SearchIndex } from '../../enums/search.enum';
import { User } from '../../generated/entity/teams/user';
import { searchQuery } from '../../rest/searchAPI';
import {
  AuditLogActiveFilter,
  AuditLogFilterCategoryType,
  TimeFilterValue,
} from '../../types/auditLogs.interface';
import { formatUsersResponse } from '../../utils/APIUtils';
import { getEntityName } from '../../utils/EntityUtils';
import { getTermQuery } from '../../utils/SearchUtils';
import { translateWithNestedKeys } from '../../utils/i18next/LocalUtil';
import DatePickerMenu from '../common/DatePickerMenu/DatePickerMenu.component';
import SearchDropdown from '../SearchDropdown/SearchDropdown';
import { SearchDropdownOption } from '../SearchDropdown/SearchDropdown.interface';
import {
  AuditLogFiltersProps,
  FilterOption,
} from './AuditLogFilters.interface';
import {
  buildParamsFromFilters,
  getAuditLogCategoryLabel,
} from '../../utils/AuditLogUtils';

const ENTITY_TYPE_OPTIONS: FilterOption[] = [
  // Data Assets
  { label: 'Table', value: 'table' },
  { label: 'Topic', value: 'topic' },
  { label: 'Dashboard', value: 'dashboard' },
  { label: 'Pipeline', value: 'pipeline' },
  { label: 'ML Model', value: 'mlmodel' },
  { label: 'Container', value: 'container' },
  { label: 'Search Index', value: 'searchIndex' },
  { label: 'Stored Procedure', value: 'storedProcedure' },
  { label: 'Dashboard Data Model', value: 'dashboardDataModel' },
  { label: 'Chart', value: 'chart' },
  { label: 'Database', value: 'database' },
  { label: 'Database Schema', value: 'databaseSchema' },
  { label: 'Query', value: 'query' },
  // API Assets
  { label: 'API Collection', value: 'apiCollection' },
  { label: 'API Endpoint', value: 'apiEndpoint' },
  // Metrics
  { label: 'Metric', value: 'metric' },
  // Governance
  { label: 'Glossary', value: 'glossary' },
  { label: 'Glossary Term', value: 'glossaryTerm' },
  { label: 'Classification', value: 'classification' },
  { label: 'Tag', value: 'tag' },
  { label: 'Domain', value: 'domain' },
  { label: 'Data Product', value: 'dataProduct' },
  // Users and Teams
  { label: 'User', value: 'user' },
  { label: 'Team', value: 'team' },
  { label: 'Bot', value: 'bot' },
  { label: 'Persona', value: 'persona' },
  // Access Control
  { label: 'Role', value: 'role' },
  { label: 'Policy', value: 'policy' },
  // Services
  { label: 'Database Service', value: 'databaseService' },
  { label: 'Messaging Service', value: 'messagingService' },
  { label: 'Dashboard Service', value: 'dashboardService' },
  { label: 'Pipeline Service', value: 'pipelineService' },
  { label: 'ML Model Service', value: 'mlmodelService' },
  { label: 'Storage Service', value: 'storageService' },
  { label: 'Search Service', value: 'searchService' },
  { label: 'API Service', value: 'apiService' },
  { label: 'Metadata Service', value: 'metadataService' },
  // Ingestion
  { label: 'Ingestion Pipeline', value: 'ingestionPipeline' },
  // Data Quality
  { label: 'Test Suite', value: 'testSuite' },
  { label: 'Test Case', value: 'testCase' },
  // Notifications
  { label: 'Event Subscription', value: 'eventsubscription' },
  // Applications
  { label: 'Application', value: 'app' },
  // KPI
  { label: 'KPI', value: 'kpi' },
];

const ENTITY_TYPE_SEARCH_OPTIONS: SearchDropdownOption[] =
  ENTITY_TYPE_OPTIONS.map((o) => ({ key: o.value, label: o.label }));

const AuditLogFilters: FC<AuditLogFiltersProps> = ({
  activeFilters,
  onFiltersChange,
}) => {
  const { t } = useTranslation();

  const auditTimeFilterRange = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(AUDIT_LOG_TIME_FILTER_RANGE).map(([key, value]) => [
          key,
          {
            ...value,
            title: translateWithNestedKeys(value.title, value.titleData),
          },
        ])
      ),
    [t]
  );

  const [userOptions, setUserOptions] = useState<SearchDropdownOption[]>([]);
  const [botOptions, setBotOptions] = useState<SearchDropdownOption[]>([]);
  const [filteredEntityTypeOptions, setFilteredEntityTypeOptions] = useState<
    SearchDropdownOption[]
  >(ENTITY_TYPE_SEARCH_OPTIONS);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isLoadingBots, setIsLoadingBots] = useState(false);



  

  const getSelectedKeys = useCallback(
    (category: AuditLogFilterCategoryType): SearchDropdownOption[] => {
      const filter = activeFilters.find((f) => f.category === category);

      return filter ? [{ key: filter.value.key, label: filter.value.label }] : [];
    },
    [activeFilters]
  );

  const timeFilter = useMemo(
    () => activeFilters.find((f) => f.category === 'time'),
    [activeFilters]
  );

  const timeDefaultDateRange = useMemo(():
    | Partial<DateRangeObject>
    | undefined => {
    if (!timeFilter) {
      return undefined;
    }
    const timeValue = timeFilter.value as TimeFilterValue;

    return {
      key: timeValue.key,
      title: timeValue.label,
      startTs: timeValue.startTs,
      endTs: timeValue.endTs,
    };
  }, [timeFilter]);

  const handleTimeFilterChange = useCallback(
    (dateRange: DateRangeObject) => {
      let label = dateRange.title ?? '';
      if (
        dateRange.key === 'customRange' &&
        dateRange.startTs &&
        dateRange.endTs
      ) {
        label = `${DateTime.fromMillis(dateRange.startTs).toFormat(
          'yyyy-MM-dd'
        )} -> ${DateTime.fromMillis(dateRange.endTs).toFormat('yyyy-MM-dd')}`;
      }

      const newFilter: AuditLogActiveFilter = {
        category: 'time',
        categoryLabel: getAuditLogCategoryLabel('time', t),
        value: {
          key: dateRange.key ?? 'custom',
          label,
          value: dateRange.key ?? 'custom',
          startTs: dateRange.startTs,
          endTs: dateRange.endTs,
        } as TimeFilterValue,
      };

      const existingIndex = activeFilters.findIndex(
        (f) => f.category === 'time'
      );
      const newFilters =
        existingIndex >= 0
          ? activeFilters.map((f, i) => (i === existingIndex ? newFilter : f))
          : [...activeFilters, newFilter];

      const params = buildParamsFromFilters(newFilters);
      onFiltersChange(newFilters, params);
    },
    [activeFilters, onFiltersChange, t]
  );

  const handleDropdownChange = useCallback(
    (values: SearchDropdownOption[], searchKey: string) => {
      const category = searchKey as AuditLogFilterCategoryType;
      let newFilters: AuditLogActiveFilter[];

      if (values.length === 0) {
        newFilters = activeFilters.filter((f) => f.category !== category);
      } else {
        const option = values[0];
        const existingIndex = activeFilters.findIndex(
          (f) => f.category === category
        );
        const newFilter: AuditLogActiveFilter = {
          category,
          categoryLabel: getAuditLogCategoryLabel(category, t),
          value: {
            key: option.key,
            label: option.label,
            value: option.key,
          },
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
          key: user.name,
          label: getEntityName(user) || user.name,
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
          key: bot.name,
          label: getEntityName(bot) || bot.name,
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

  const handleSearch = useCallback(
    (searchText: string, searchKey: string) => {
      if (searchKey === 'user') {
        debouncedFetchUsers(searchText);
      } else if (searchKey === 'bot') {
        debouncedFetchBots(searchText);
      } else if (searchKey === 'entityType') {
        const filtered = searchText
          ? ENTITY_TYPE_SEARCH_OPTIONS.filter((option) =>
              option.label.toLowerCase().includes(searchText.toLowerCase())
            )
          : ENTITY_TYPE_SEARCH_OPTIONS;
        setFilteredEntityTypeOptions(filtered);
      }
    },
    [debouncedFetchUsers, debouncedFetchBots]
  );

  const handleGetInitialOptions = useCallback(
    (searchKey: string) => {
      if (searchKey === 'user') {
        fetchUsers('');
      } else if (searchKey === 'bot') {
        fetchBots('');
      } else if (searchKey === 'entityType') {
        setFilteredEntityTypeOptions(ENTITY_TYPE_SEARCH_OPTIONS);
      }
    },
    [fetchUsers, fetchBots]
  );

  return (
    <Space
      wrap
      className="explore-quick-filters-container"
      data-testid="audit-log-filters"
      size={[8, 0]}>
      <DatePickerMenu
        showSelectedCustomRange
        defaultDateRange={timeDefaultDateRange}
        handleDateRangeChange={handleTimeFilterChange}
        key={timeFilter?.value.key ?? 'no-time-filter'}
        options={auditTimeFilterRange}
      />
      <SearchDropdown
        hideCounts
        showSelectedCounts
        singleSelect
        isSuggestionsLoading={isLoadingUsers}
        label={t('label.user')}
        options={userOptions}
        searchKey="user"
        selectedKeys={getSelectedKeys('user')}
        triggerButtonSize="middle"
        onChange={handleDropdownChange}
        onGetInitialOptions={handleGetInitialOptions}
        onSearch={handleSearch}
      />
      <SearchDropdown
        hideCounts
        showSelectedCounts
        singleSelect
        isSuggestionsLoading={isLoadingBots}
        label={t('label.bot')}
        options={botOptions}
        searchKey="bot"
        selectedKeys={getSelectedKeys('bot')}
        triggerButtonSize="middle"
        onChange={handleDropdownChange}
        onGetInitialOptions={handleGetInitialOptions}
        onSearch={handleSearch}
      />
      <SearchDropdown
        hideCounts
        showSelectedCounts
        singleSelect
        isSuggestionsLoading={false}
        label={t('label.entity-type')}
        options={filteredEntityTypeOptions}
        searchKey="entityType"
        selectedKeys={getSelectedKeys('entityType')}
        triggerButtonSize="middle"
        onChange={handleDropdownChange}
        onGetInitialOptions={handleGetInitialOptions}
        onSearch={handleSearch}
      />
    </Space>
  );
};

export default AuditLogFilters;
