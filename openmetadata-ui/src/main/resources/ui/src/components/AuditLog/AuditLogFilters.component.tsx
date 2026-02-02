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

import {
  CalendarOutlined,
  CloseOutlined,
  DownOutlined,
  FilterOutlined,
  RobotOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  Avatar,
  Button,
  DatePicker,
  Divider,
  Input,
  List,
  Popover,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import { Dayjs } from 'dayjs';
import { debounce } from 'lodash';
import { FC, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SearchIndex } from '../../enums/search.enum';
import { Bot } from '../../generated/entity/bot';
import { User } from '../../generated/entity/teams/user';
import { getBots } from '../../rest/botsAPI';
import { searchData } from '../../rest/miscAPI';
import {
  AuditLogActiveFilter,
  AuditLogFilterCategoryType,
  AuditLogFilterValue,
  AuditLogListParams,
} from '../../types/auditLogs.interface';
import { formatUsersResponse } from '../../utils/APIUtils';
import { formatDateTime } from '../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../utils/EntityUtils';
import { getEntityIcon } from '../../utils/TableUtils';
import ProfilePicture from '../common/ProfilePicture/ProfilePicture';
import {
  AuditLogFiltersProps,
  FilterOption,
} from './AuditLogFilters.interface';
import './AuditLogFilters.less';

const { RangePicker } = DatePicker;

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
  // Type
  { label: 'Type', value: 'type' },
];

const TIME_FILTER_OPTIONS: FilterOption[] = [
  { label: 'Yesterday', value: 'yesterday', key: 'yesterday' },
  { label: 'Last 7 Days', value: 'last7days', key: 'last7days' },
  { label: 'Last 30 Days', value: 'last30days', key: 'last30days' },
];

interface CustomDateRange {
  startTs: number;
  endTs: number;
  label: string;
}

const AuditLogFilters: FC<AuditLogFiltersProps> = ({
  activeFilters,
  onFiltersChange,
}) => {
  const { t } = useTranslation();

  const [activeCategory, setActiveCategory] =
    useState<AuditLogFilterCategoryType | null>(null);
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false);
  const [showCustomRangePicker, setShowCustomRangePicker] = useState(false);
  const [customDateRange, setCustomDateRange] =
    useState<CustomDateRange | null>(null);

  const [userOptions, setUserOptions] = useState<FilterOption[]>([]);
  const [botOptions, setBotOptions] = useState<FilterOption[]>([]);
  const [entityTypeOptions, setEntityTypeOptions] =
    useState<FilterOption[]>(ENTITY_TYPE_OPTIONS);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [searchText, setSearchText] = useState('');

  const buildParamsFromFilters = useCallback(
    (
      filters: AuditLogActiveFilter[],
      customRange?: CustomDateRange | null
    ): Partial<AuditLogListParams> => {
      const params: Partial<AuditLogListParams> = {};
      const now = Date.now();
      const oneDayMs = 24 * 60 * 60 * 1000;

      filters.forEach((filter) => {
        switch (filter.category) {
          case 'time':
            if (filter.value.key === 'yesterday') {
              params.startTs = now - oneDayMs;
              params.endTs = now;
            } else if (filter.value.key === 'last7days') {
              params.startTs = now - 7 * oneDayMs;
              params.endTs = now;
            } else if (filter.value.key === 'last30days') {
              params.startTs = now - 30 * oneDayMs;
              params.endTs = now;
            } else if (filter.value.key === 'customRange' && customRange) {
              params.startTs = customRange.startTs;
              params.endTs = customRange.endTs;
            }

            break;
          case 'user':
            params.userName = filter.value.value;
            params.actorType = 'USER';

            break;
          case 'bot':
            params.userName = filter.value.value;
            params.actorType = 'BOT';

            break;
          case 'entityType':
            params.entityType = filter.value.value;

            break;
        }
      });

      return params;
    },
    []
  );

  const fetchUsers = useCallback(async (search: string) => {
    setIsLoadingOptions(true);
    try {
      const response = await searchData(
        search,
        1,
        10,
        'isBot:false',
        '',
        '',
        SearchIndex.USER
      );
      const users: User[] = formatUsersResponse(response.data.hits.hits);
      setUserOptions(
        users.map((user) => ({
          label: getEntityName(user) || user.name,
          value: user.name,
          key: user.id,
        }))
      );
    } catch {
      setUserOptions([]);
    } finally {
      setIsLoadingOptions(false);
    }
  }, []);

  const fetchBots = useCallback(async (search: string) => {
    setIsLoadingOptions(true);
    try {
      const response = await getBots({ limit: 10 });
      const filteredBots = search
        ? response.data.filter(
            (bot: Bot) =>
              bot.name?.toLowerCase().includes(search.toLowerCase()) ||
              bot.displayName?.toLowerCase().includes(search.toLowerCase())
          )
        : response.data;

      setBotOptions(
        filteredBots.map((bot: Bot) => ({
          label: bot.displayName || bot.name || '',
          value: bot.name || '',
          key: bot.id,
        }))
      );
    } catch {
      setBotOptions([]);
    } finally {
      setIsLoadingOptions(false);
    }
  }, []);

  const filterEntityTypes = useCallback((search: string) => {
    if (!search) {
      setEntityTypeOptions(ENTITY_TYPE_OPTIONS);

      return;
    }
    const filtered = ENTITY_TYPE_OPTIONS.filter((opt) =>
      opt.label.toLowerCase().includes(search.toLowerCase())
    );
    setEntityTypeOptions(filtered);
  }, []);

  const debouncedFetchUsers = useMemo(
    () => debounce(fetchUsers, 300),
    [fetchUsers]
  );

  const debouncedFetchBots = useMemo(
    () => debounce(fetchBots, 300),
    [fetchBots]
  );

  const handleCategorySelect = useCallback(
    (category: AuditLogFilterCategoryType) => {
      setActiveCategory(category);
      setSearchText('');

      if (category === 'user') {
        fetchUsers('');
      } else if (category === 'bot') {
        fetchBots('');
      } else if (category === 'entityType') {
        setEntityTypeOptions(ENTITY_TYPE_OPTIONS);
      }
    },
    [fetchUsers, fetchBots]
  );

  const handleSearch = useCallback(
    (value: string) => {
      setSearchText(value);

      if (activeCategory === 'user') {
        debouncedFetchUsers(value);
      } else if (activeCategory === 'bot') {
        debouncedFetchBots(value);
      } else if (activeCategory === 'entityType') {
        filterEntityTypes(value);
      }
    },
    [activeCategory, debouncedFetchUsers, debouncedFetchBots, filterEntityTypes]
  );

  const getCategoryLabel = useCallback(
    (category: AuditLogFilterCategoryType): string => {
      switch (category) {
        case 'time':
          return t('label.time');
        case 'user':
          return t('label.user');
        case 'bot':
          return t('label.bot');
        case 'entityType':
          return t('label.entity-type');
        default:
          return '';
      }
    },
    [t]
  );

  const handleValueSelect = useCallback(
    (value: AuditLogFilterValue, range?: CustomDateRange | null) => {
      if (!activeCategory) {
        return;
      }

      const existingFilterIndex = activeFilters.findIndex(
        (f) => f.category === activeCategory
      );

      const newFilter: AuditLogActiveFilter = {
        category: activeCategory,
        categoryLabel: getCategoryLabel(activeCategory),
        value,
      };

      let newFilters: AuditLogActiveFilter[];

      if (existingFilterIndex >= 0) {
        newFilters = [...activeFilters];
        newFilters[existingFilterIndex] = newFilter;
      } else {
        newFilters = [...activeFilters, newFilter];
      }

      const newCustomRange = range ?? customDateRange;

      if (value.key === 'customRange') {
        setCustomDateRange(newCustomRange);
      }

      const params = buildParamsFromFilters(newFilters, newCustomRange);
      onFiltersChange(newFilters, params);

      setActiveCategory(null);
      setCategoryPopoverOpen(false);
      setSearchText('');
      setShowCustomRangePicker(false);
    },
    [
      activeCategory,
      activeFilters,
      customDateRange,
      getCategoryLabel,
      buildParamsFromFilters,
      onFiltersChange,
    ]
  );

  const handleCustomRangeChange = useCallback(
    (dates: [Dayjs | null, Dayjs | null] | null) => {
      if (dates && dates[0] && dates[1]) {
        const startTs = dates[0].startOf('day').valueOf();
        const endTs = dates[1].endOf('day').valueOf();
        const startLabel = formatDateTime(startTs, 'MMM dd');
        const endLabel = formatDateTime(endTs, 'MMM dd');
        const label = `${startLabel} - ${endLabel}`;

        const range: CustomDateRange = { startTs, endTs, label };

        handleValueSelect(
          {
            key: 'customRange',
            label,
            value: 'customRange',
          },
          range
        );
      }
    },
    [handleValueSelect]
  );

  const handleRemoveFilter = useCallback(
    (category: AuditLogFilterCategoryType) => {
      const newFilters = activeFilters.filter((f) => f.category !== category);

      let newCustomRange = customDateRange;

      if (category === 'time') {
        newCustomRange = null;
        setCustomDateRange(null);
      }

      const params = buildParamsFromFilters(newFilters, newCustomRange);
      onFiltersChange(newFilters, params);
    },
    [activeFilters, customDateRange, buildParamsFromFilters, onFiltersChange]
  );

  const getCurrentOptions = useCallback((): FilterOption[] => {
    switch (activeCategory) {
      case 'time':
        return TIME_FILTER_OPTIONS;
      case 'user':
        return userOptions;
      case 'bot':
        return botOptions;
      case 'entityType':
        return entityTypeOptions;
      default:
        return [];
    }
  }, [activeCategory, userOptions, botOptions, entityTypeOptions]);

  const filterCategories: AuditLogFilterCategoryType[] = [
    'time',
    'user',
    'bot',
    'entityType',
  ];

  const renderTimeFilterContent = useMemo(() => {
    if (showCustomRangePicker) {
      return (
        <div className="custom-range-picker-container">
          <div className="filter-value-header">
            <Typography.Text strong>{t('label.custom-range')}</Typography.Text>
            <Button
              className="back-button"
              size="small"
              type="text"
              onClick={() => setShowCustomRangePicker(false)}>
              {t('label.back')}
            </Button>
          </div>
          <Divider className="m-y-xs" />
          <div className="range-picker-wrapper">
            <RangePicker
              className="audit-log-range-picker"
              data-testid="custom-date-range-picker"
              format="MMM DD, YYYY"
              placeholder={[t('label.start-date'), t('label.end-date')]}
              onChange={handleCustomRangeChange}
            />
          </div>
        </div>
      );
    }

    const options = getCurrentOptions();

    return (
      <>
        <List
          className="filter-options-list"
          dataSource={options}
          renderItem={(option) => (
            <List.Item
              className="filter-option-item"
              onClick={() =>
                handleValueSelect({
                  key: option.key || option.value,
                  label: option.label,
                  value: option.value,
                })
              }>
              <Space>
                <CalendarOutlined className="filter-option-icon" />
                <Typography.Text>{option.label}</Typography.Text>
              </Space>
            </List.Item>
          )}
        />
        <Divider className="m-y-xs" />
        <List.Item
          className="filter-option-item custom-range-option"
          onClick={() => setShowCustomRangePicker(true)}>
          <Space>
            <CalendarOutlined className="filter-option-icon" />
            <Typography.Text>{t('label.custom-range')}</Typography.Text>
          </Space>
        </List.Item>
      </>
    );
  }, [
    showCustomRangePicker,
    getCurrentOptions,
    handleValueSelect,
    handleCustomRangeChange,
    t,
  ]);

  const renderValueSelector = useMemo(() => {
    if (!activeCategory) {
      return null;
    }

    const isTimeFilter = activeCategory === 'time';
    const options = getCurrentOptions();
    const showSearch = !isTimeFilter;

    return (
      <div className="audit-log-filter-value-selector">
        <div className="filter-value-header">
          <Typography.Text strong>
            {t('label.select-entity', {
              entity: getCategoryLabel(activeCategory),
            })}
          </Typography.Text>
          <Button
            className="back-button"
            size="small"
            type="text"
            onClick={() => {
              setActiveCategory(null);
              setShowCustomRangePicker(false);
            }}>
            {t('label.back')}
          </Button>
        </div>
        <Divider className="m-y-xs" />
        {showSearch && (
          <Input
            allowClear
            className="filter-search-input m-b-xs"
            placeholder={t('label.search')}
            prefix={<SearchOutlined className="text-grey-muted" />}
            value={searchText}
            onChange={(e) => handleSearch(e.target.value)}
          />
        )}
        {isTimeFilter ? (
          renderTimeFilterContent
        ) : isLoadingOptions ? (
          <div className="filter-loading">
            <Spin size="small" />
          </div>
        ) : (
          <List
            className="filter-options-list"
            dataSource={options}
            renderItem={(option) => (
              <List.Item
                className="filter-option-item"
                onClick={() =>
                  handleValueSelect({
                    key: option.key || option.value,
                    label: option.label,
                    value: option.value,
                  })
                }>
                {activeCategory === 'user' ? (
                  <Space size={8}>
                    <ProfilePicture
                      displayName={option.label}
                      height={24}
                      name={option.value}
                      width={24}
                    />
                    <Typography.Text>{option.label}</Typography.Text>
                  </Space>
                ) : activeCategory === 'bot' ? (
                  <Space size={8}>
                    <Avatar
                      icon={<RobotOutlined />}
                      size={24}
                      style={{ backgroundColor: '#1890ff' }}
                    />
                    <Typography.Text>{option.label}</Typography.Text>
                  </Space>
                ) : activeCategory === 'entityType' ? (
                  <Space size={8}>
                    <span className="entity-type-icon">
                      {getEntityIcon(option.value, 'w-4 h-4')}
                    </span>
                    <Typography.Text>{option.label}</Typography.Text>
                  </Space>
                ) : (
                  <Typography.Text>{option.label}</Typography.Text>
                )}
              </List.Item>
            )}
          />
        )}
      </div>
    );
  }, [
    activeCategory,
    getCurrentOptions,
    getCategoryLabel,
    searchText,
    isLoadingOptions,
    handleSearch,
    handleValueSelect,
    renderTimeFilterContent,
    t,
  ]);

  const getCategoryIcon = useCallback(
    (category: AuditLogFilterCategoryType) => {
      switch (category) {
        case 'time':
          return <CalendarOutlined className="filter-category-icon" />;
        case 'user':
          return (
            <span className="filter-category-icon">
              <svg
                fill="currentColor"
                height="14"
                viewBox="0 0 16 16"
                width="14">
                <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM12.735 14c.618 0 1.093-.561.872-1.139a6.002 6.002 0 0 0-11.215 0c-.22.578.254 1.139.872 1.139h9.47Z" />
              </svg>
            </span>
          );
        case 'bot':
          return (
            <span className="filter-category-icon">
              <svg
                fill="currentColor"
                height="14"
                viewBox="0 0 24 24"
                width="14">
                <path
                  d={[
                    'M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 ',
                    '0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 ',
                    '7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5 2.5 ',
                    '2.5 0 0 0 7.5 18a2.5 2.5 0 0 0 2.5-2.5A2.5 2.5 0 0 0 7.5 13m9 0a2.5 2.5 0 0 0-2.5 ',
                    '2.5 2.5 2.5 0 0 0 2.5 2.5 2.5 2.5 0 0 0 2.5-2.5 2.5 2.5 0 0 0-2.5-2.5Z',
                  ].join('')}
                />
              </svg>
            </span>
          );
        case 'entityType':
          return (
            <span className="filter-category-icon">
              <svg
                fill="currentColor"
                height="14"
                viewBox="0 0 16 16"
                width="14">
                <path
                  d={[
                    'M0 1.5A1.5 1.5 0 0 1 1.5 0h3A1.5 1.5 0 0 1 6 1.5v3',
                    'A1.5 1.5 0 0 1 4.5 6h-3A1.5 1.5 0 0 1 0 4.5v-3Z',
                    'M10 1.5A1.5 1.5 0 0 1 11.5 0h3A1.5 1.5 0 0 1 16 1.5v3',
                    'A1.5 1.5 0 0 1 14.5 6h-3A1.5 1.5 0 0 1 10 4.5v-3Z',
                    'M0 11.5A1.5 1.5 0 0 1 1.5 10h3A1.5 1.5 0 0 1 6 11.5v3',
                    'A1.5 1.5 0 0 1 4.5 16h-3A1.5 1.5 0 0 1 0 14.5v-3Z',
                    'M10 11.5a1.5 1.5 0 0 1 1.5-1.5h3a1.5 1.5 0 0 1 1.5 1.5v3',
                    'a1.5 1.5 0 0 1-1.5 1.5h-3a1.5 1.5 0 0 1-1.5-1.5v-3Z',
                  ].join('')}
                />
              </svg>
            </span>
          );
        default:
          return null;
      }
    },
    []
  );

  const popoverContent = useMemo(() => {
    if (activeCategory) {
      return renderValueSelector;
    }

    return (
      <div className="audit-log-filter-categories">
        <Typography.Text strong className="filter-header">
          {t('label.filter-audit-logs')}
        </Typography.Text>
        <Divider className="m-y-xs" />
        <List
          dataSource={filterCategories}
          renderItem={(category) => {
            const hasActiveFilter = activeFilters.some(
              (f) => f.category === category
            );

            return (
              <List.Item
                className="filter-category-item"
                onClick={() => handleCategorySelect(category)}>
                <Space className="w-full justify-between">
                  <Space size={8}>
                    {getCategoryIcon(category)}
                    <Typography.Text>
                      {getCategoryLabel(category)}
                    </Typography.Text>
                  </Space>
                  {hasActiveFilter && (
                    <Tag className="active-tag" color="blue">
                      {t('label.active')}
                    </Tag>
                  )}
                </Space>
              </List.Item>
            );
          }}
        />
      </div>
    );
  }, [
    activeCategory,
    activeFilters,
    getCategoryIcon,
    getCategoryLabel,
    handleCategorySelect,
    renderValueSelector,
    t,
  ]);

  const hasActiveFilters = activeFilters.length > 0;

  return (
    <Space wrap className="audit-log-filters-container" size={8}>
      <Popover
        content={popoverContent}
        open={categoryPopoverOpen}
        overlayClassName="audit-log-filter-popover"
        placement="bottomLeft"
        trigger="click"
        onOpenChange={(open) => {
          setCategoryPopoverOpen(open);
          if (!open) {
            setActiveCategory(null);
            setSearchText('');
            setShowCustomRangePicker(false);
          }
        }}>
        <Button
          className={`filters-button ${hasActiveFilters ? 'has-filters' : ''}`}
          data-testid="filters-dropdown">
          <Space size={6}>
            <FilterOutlined />
            {t('label.filter-plural')}
            {hasActiveFilters && (
              <span className="filter-count">{activeFilters.length}</span>
            )}
            <DownOutlined className="dropdown-icon" />
          </Space>
        </Button>
      </Popover>

      {activeFilters.map((filter) => (
        <Tag
          closable
          className="audit-log-filter-tag"
          closeIcon={<CloseOutlined />}
          data-testid={`active-filter-${filter.category}`}
          key={filter.category}
          onClose={() => handleRemoveFilter(filter.category)}>
          <span className="filter-tag-label">{filter.categoryLabel}:</span>
          <span className="filter-tag-value">{filter.value.label}</span>
        </Tag>
      ))}
    </Space>
  );
};

export default AuditLogFilters;
