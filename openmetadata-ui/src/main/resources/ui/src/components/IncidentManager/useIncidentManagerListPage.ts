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
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import {
  isEqual,
  isString,
  isUndefined,
  noop,
  omit,
  parseInt,
  pick,
} from 'lodash';
import { DateRangeObject } from 'Models';
import QueryString from 'qs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { WILD_CARD_CHAR } from '../../constants/char.constants';
import {
  DEFAULT_DOMAIN_VALUE,
  PAGE_SIZE_BASE,
} from '../../constants/constants';
import { TEST_CASE_RESOLUTION_STATUS_LABELS } from '../../constants/TestSuite.constant';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../context/PermissionProvider/PermissionProvider.interface';
import { SearchIndex } from '../../enums/search.enum';
import { Table } from '../../generated/entity/data/table';
import { EntityReference } from '../../generated/tests/testCase';
import {
  Severities,
  TestCaseResolutionStatus,
  TestCaseResolutionStatusTypes,
} from '../../generated/tests/testCaseResolutionStatus';
import { Include } from '../../generated/type/include';
import { usePaging } from '../../hooks/paging/usePaging';
import useCustomLocation from '../../hooks/useCustomLocation/useCustomLocation';
import { useDomainStore } from '../../hooks/useDomainStore';
import {
  SearchHitBody,
  TestCaseSearchSource,
} from '../../interface/search.interface';
import { TestCaseIncidentStatusData } from '../../pages/IncidentManager/IncidentManager.interface';
import { Option } from '../../pages/TasksPage/TasksPage.interface';
import {
  getListTestCaseIncidentByStateId,
  getListTestCaseIncidentStatusFromSearch,
  TestCaseIncidentStatusParams,
  transitionIncident,
  updateTestCaseIncidentById,
} from '../../rest/incidentManagerAPI';
import { getUserAndTeamSearch } from '../../rest/miscAPI';
import { searchQuery } from '../../rest/searchAPI';
import { getEntityName } from '../../utils/EntityNameUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import {
  FilterDateValue,
  FilterDescriptor,
  FilterOptionData,
} from '../common/FilterChip/FilterChip.interface';
import { PagingHandlerParams } from '../common/NextPrevious/NextPrevious.interface';
import { TestCasePermission } from '../Database/Profiler/ProfilerDashboard/profilerDashboard.interface';

export interface UseIncidentManagerListPageProps {
  isIncidentPage?: boolean;
  tableDetails?: Table;
}

// Static, single-select options for the incident resolution status filter.
const STATUS_FILTER_OPTIONS: FilterOptionData[] = Object.values(
  TestCaseResolutionStatusTypes
).map((value) => ({
  value,
  label: TEST_CASE_RESOLUTION_STATUS_LABELS[value],
}));

export const useIncidentManagerListPage = ({
  isIncidentPage = true,
  tableDetails,
}: UseIncidentManagerListPageProps) => {
  const location = useCustomLocation();
  const navigate = useNavigate();
  const { activeDomain } = useDomainStore();
  const allParams = useMemo(() => {
    const param = location.search;
    const searchData = QueryString.parse(
      param.startsWith('?') ? param.substring(1) : param
    );

    return isUndefined(searchData) ? {} : searchData;
  }, [location.search]);

  const filters = useMemo(() => {
    const urlParams = omit(allParams, ['key', 'title']);

    const params: TestCaseIncidentStatusParams = {
      ...urlParams,
    };

    // Only use date params if they exist in the URL
    if (urlParams.startTs || urlParams.endTs) {
      if (urlParams.startTs && isString(urlParams.startTs)) {
        params.startTs = parseInt(urlParams.startTs, 10);
      }
      if (urlParams.endTs && isString(urlParams.endTs)) {
        params.endTs = parseInt(urlParams.endTs, 10);
      }
    }

    return params;
  }, [allParams]);

  const dateRangeKey = useMemo(() => {
    // Only return date range if URL has explicit date params
    if (allParams.key && filters.startTs && filters.endTs) {
      return {
        key: allParams.key as string,
        title: allParams.title as string,
        startTs: filters.startTs,
        endTs: filters.endTs,
      };
    }

    // No date range selected - show placeholder
    return undefined;
  }, [allParams.key, allParams.title, filters.startTs, filters.endTs]);

  const [testCaseListData, setTestCaseListData] =
    useState<TestCaseIncidentStatusData>({
      data: [],
      isLoading: true,
    });
  const [isDateFilterOpen, setIsDateFilterOpen] = useState(false);
  const [users, setUsers] = useState<{
    options: Option[];
  }>({
    options: [],
  });

  const assigneeOptionsWithSelected = useMemo(() => {
    const options = [...users.options];
    if (filters.assignee) {
      const exists = options.some(
        (opt) => opt.name === filters.assignee || opt.value === filters.assignee
      );
      if (!exists) {
        options.push({
          label: filters.assignee,
          value: filters.assignee,
          name: filters.assignee,
          type: 'user',
        });
      }
    }

    return options;
  }, [filters.assignee, users.options]);

  const selectedAssignees = useMemo(() => {
    if (!filters.assignee) {
      return [];
    }
    const option = assigneeOptionsWithSelected.find(
      (opt) => opt.name === filters.assignee || opt.value === filters.assignee
    );

    return option ? [option] : [];
  }, [filters.assignee, assigneeOptionsWithSelected]);

  const { getEntityPermissionByFqn, permissions } = usePermissionProvider();
  const { testCase: commonTestCasePermission } = permissions;

  const [isPermissionLoading, setIsPermissionLoading] = useState(true);
  const [testCasePermissions, setTestCasePermissions] = useState<
    TestCasePermission[]
  >([]);

  const { t } = useTranslation();

  const dateFilterOptions = useMemo(
    () => [
      { name: t('label.created-at'), value: 'timestamp' },
      { name: t('label.updated-at'), value: 'updatedAt' },
    ],
    [t]
  );

  const selectedDateFilterKey = (filters.dateField as string) ?? 'timestamp';
  const selectedDateFilterOption =
    dateFilterOptions.find((o) => o.value === selectedDateFilterKey) ??
    dateFilterOptions[0];

  const {
    paging,
    pageSize,
    currentPage,
    showPagination,
    handlePageChange,
    handlePagingChange,
    handlePageSizeChange,
  } = usePaging();

  const fetchTestCaseIncidents = useCallback(
    async (params: TestCaseIncidentStatusParams) => {
      setTestCaseListData((prev) => ({ ...prev, isLoading: true }));
      try {
        const { data, paging } = await getListTestCaseIncidentStatusFromSearch({
          limit: pageSize,
          offset: params.offset ?? 0,
          latest: true,
          include: tableDetails?.deleted ? Include.Deleted : Include.NonDeleted,
          originEntityFQN: tableDetails?.fullyQualifiedName,
          domain:
            activeDomain === DEFAULT_DOMAIN_VALUE ? undefined : activeDomain,
          ...params,
        });
        const assigneeOptions = data.reduce((acc, curr) => {
          const assignee = curr.testCaseResolutionStatusDetails?.assignee;
          const isExist = acc.some((item) => item.value === assignee?.name);

          if (assignee && !isExist) {
            acc.push({
              label: getEntityName(assignee),
              value: assignee.name ?? assignee.fullyQualifiedName ?? '',
              type: assignee.type,
              name: assignee.name,
            });
          }

          return acc;
        }, [] as Option[]);

        setUsers((pre) => ({
          ...pre,
          options: assigneeOptions,
        }));
        setTestCaseListData((prev) => ({ ...prev, data: data }));
        handlePagingChange(paging);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setTestCaseListData((prev) => ({ ...prev, isLoading: false }));
      }
    },
    [
      pageSize,
      setTestCaseListData,
      activeDomain,
      tableDetails?.deleted,
      tableDetails?.fullyQualifiedName,
    ]
  );

  const fetchTestCasePermissions = async () => {
    const { data: incident } = testCaseListData;
    try {
      setIsPermissionLoading(true);
      const promises = incident.map((testCase) => {
        return getEntityPermissionByFqn(
          ResourceEntity.TEST_CASE,
          testCase.testCaseReference?.fullyQualifiedName ?? ''
        );
      });
      const testCasePermission = await Promise.allSettled(promises);
      const data = testCasePermission.reduce((acc, status, i) => {
        if (status.status === 'fulfilled') {
          return [
            ...acc,
            {
              ...status.value,
              fullyQualifiedName:
                incident[i].testCaseReference?.fullyQualifiedName ?? '',
            },
          ];
        }

        return acc;
      }, [] as TestCasePermission[]);

      setTestCasePermissions(data);
    } catch {
      // do nothing
    } finally {
      setIsPermissionLoading(false);
    }
  };

  const handlePagingClick = useCallback(
    ({ currentPage }: PagingHandlerParams) => {
      fetchTestCaseIncidents({
        ...filters,
        offset: (currentPage - 1) * pageSize,
      });
      handlePageChange(currentPage);
    },
    [fetchTestCaseIncidents, filters, pageSize, handlePageChange]
  );

  const pagingData = useMemo(
    () => ({
      paging,
      currentPage,
      pagingHandler: handlePagingClick,
      pageSize,
      onShowSizeChange: handlePageSizeChange,
      isNumberBased: true,
    }),
    [paging, currentPage, handlePagingClick, pageSize, handlePageSizeChange]
  );

  const handleSeveritySubmit = async (
    record: TestCaseResolutionStatus,
    severity?: Severities
  ) => {
    const updatedData = { ...record, severity };
    const patch = compare(record, updatedData);
    try {
      await updateTestCaseIncidentById(record.id ?? '', patch);

      setTestCaseListData((prev) => {
        const testCaseList = prev.data.map((item) => {
          if (item.id === updatedData.id) {
            return updatedData;
          }

          return item;
        });

        return {
          ...prev,
          data: testCaseList,
        };
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleAssigneeUpdate = useCallback(
    async (record: TestCaseResolutionStatus, assignee?: EntityReference[]) => {
      const taskId = record.stateId;
      if (!taskId) {
        return;
      }

      const assigneeData = assignee?.[0];
      const transitionId =
        record.testCaseResolutionStatusType ===
        TestCaseResolutionStatusTypes.Assigned
          ? 'reassign'
          : 'assign';

      try {
        await transitionIncident(taskId, {
          transitionId,
          payload: assigneeData
            ? {
                assignees: [
                  {
                    id: assigneeData.id,
                    type: assigneeData.type ?? 'user',
                    name: assigneeData.name,
                    fullyQualifiedName:
                      assigneeData.fullyQualifiedName ?? assigneeData.name,
                    displayName: assigneeData.displayName,
                  },
                ],
              }
            : undefined,
        });

        const refreshed = await getListTestCaseIncidentByStateId(taskId);
        const latest = refreshed?.data?.[0];
        if (!latest) {
          return;
        }

        setTestCaseListData((prev) => {
          const testCaseList = prev.data.map((item) => {
            if (item.stateId === latest.stateId) {
              return latest;
            }

            return item;
          });

          return {
            ...prev,
            data: testCaseList,
          };
        });
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [setTestCaseListData]
  );

  const fetchUserFilterOptions = async (query: string) => {
    if (!query) {
      return;
    }
    try {
      const res = await getUserAndTeamSearch(query, true);
      const hits = res.data.hits.hits;
      const suggestOptions = hits.map((hit) => ({
        label: getEntityName(hit._source),
        value: hit._source.name,
        type: hit._source.entityType,
        name: hit._source.name,
      }));

      setUsers((pre) => ({ ...pre, options: suggestOptions }));
    } catch {
      setUsers((pre) => ({ ...pre, options: [] }));
    }
  };

  const updateFilters = useCallback(
    (
      newFilters: Partial<TestCaseIncidentStatusParams>,
      dateRangeParams?: { key: string; title: string }
    ) => {
      const updatedFilters = { ...filters, ...newFilters };
      const allUpdatedParams = dateRangeParams
        ? { ...updatedFilters, ...dateRangeParams }
        : { ...allParams, ...updatedFilters };

      navigate(
        {
          search: QueryString.stringify(allUpdatedParams),
        },
        {
          replace: true,
        }
      );
    },
    [filters, allParams, navigate]
  );

  const handleAssigneeChange = (value?: Option[]) => {
    updateFilters({ assignee: value ? value[0]?.name : value });
  };

  const handleDateRangeChange = (value: DateRangeObject) => {
    const updatedFilter = pick(value, ['startTs', 'endTs']);
    const existingFilters = pick(filters, ['startTs', 'endTs']);
    const dateRangeParams = pick(value, ['key', 'title']) as {
      key: string;
      title: string;
    };

    if (!isEqual(existingFilters, updatedFilter)) {
      updateFilters(updatedFilter, dateRangeParams);
    }
  };

  const handleDateFieldChange = useCallback(
    (value: string) => {
      updateFilters({ dateField: value as 'timestamp' | 'updatedAt' });
    },
    [updateFilters]
  );

  const handleDateRangeClear = useCallback(() => {
    const updatedFilters = omit(allParams, [
      'startTs',
      'endTs',
      'key',
      'title',
      'dateField',
    ]);
    navigate(
      {
        search: QueryString.stringify(updatedFilters),
      },
      {
        replace: true,
      }
    );
  }, [allParams, navigate]);

  const handleStatusSubmit = useCallback(
    (value: TestCaseResolutionStatus) => {
      setTestCaseListData((prev) => {
        const testCaseList = prev.data.map((item) => {
          if (
            item.testCaseReference?.fullyQualifiedName ===
            value.testCaseReference?.fullyQualifiedName
          ) {
            return value;
          }

          return item;
        });

        return {
          ...prev,
          data: testCaseList,
        };
      });
    },
    [setTestCaseListData]
  );

  const searchTestCases = async (searchValue = WILD_CARD_CHAR) => {
    // Encode the search value to handle special characters like #, %, $, etc.
    // Preserve wildcard character to maintain default search behavior
    const encodedSearchValue: string =
      searchValue === WILD_CARD_CHAR
        ? searchValue
        : encodeURIComponent(searchValue);
    try {
      const response = await searchQuery({
        pageNumber: 1,
        pageSize: PAGE_SIZE_BASE,
        searchIndex: SearchIndex.TEST_CASE,
        query: encodedSearchValue,
        fetchSource: true,
        includeFields: ['name', 'displayName', 'fullyQualifiedName'],
      });

      return (
        response.hits.hits as SearchHitBody<
          SearchIndex.TEST_CASE,
          TestCaseSearchSource
        >[]
      ).map((hit) => ({
        label: getEntityName(hit._source),
        value: hit._source.fullyQualifiedName,
      }));
    } catch {
      return [];
    }
  };

  useEffect(() => {
    if (
      commonTestCasePermission?.ViewAll ||
      commonTestCasePermission?.ViewBasic
    ) {
      fetchTestCaseIncidents(filters);
    } else {
      setTestCaseListData((prev) => ({ ...prev, isLoading: false }));
    }
  }, [
    commonTestCasePermission,
    pageSize,
    filters,
    activeDomain,
    tableDetails?.deleted,
    tableDetails?.fullyQualifiedName,
  ]);

  useEffect(() => {
    if (testCaseListData.data.length > 0) {
      fetchTestCasePermissions();
    }
  }, [testCaseListData.data]);

  const [testCaseFilterOptions, setTestCaseFilterOptions] = useState<
    FilterOptionData[]
  >([]);
  const [isTestCaseOptionsLoading, setIsTestCaseOptionsLoading] =
    useState(false);
  const [assigneeOwnerRefs, setAssigneeOwnerRefs] = useState<EntityReference[]>(
    []
  );

  const handleAssigneeOwnerChange = (owners: EntityReference[] = []) => {
    setAssigneeOwnerRefs(owners);
    updateFilters({ assignee: owners[0]?.name });
  };

  // On a shared/refreshed link (?assignee=foo) the picker state starts empty.
  // Since the list is filtered by that assignee, each loaded incident carries
  // their full EntityReference — derive the selected owner from it so the picker
  // pre-selects and the chip shows the display name, without an extra lookup.
  const assigneeOwners = useMemo<EntityReference[]>(() => {
    if (!filters.assignee) {
      return [];
    }
    // Use the picker-selected refs only when they still match the active filter,
    // so a stale ref doesn't survive clear-all / browser nav / a URL change to a
    // different ?assignee=.
    if (assigneeOwnerRefs.some((owner) => owner?.name === filters.assignee)) {
      return assigneeOwnerRefs;
    }
    const match = testCaseListData.data
      .map((record) => record.testCaseResolutionStatusDetails?.assignee)
      .find((assignee) => assignee?.name === filters.assignee);

    return match ? [match] : [];
  }, [assigneeOwnerRefs, filters.assignee, testCaseListData.data]);

  const fetchTestCaseFilterOptions = async (query = WILD_CARD_CHAR) => {
    setIsTestCaseOptionsLoading(true);
    try {
      const results = await searchTestCases(query);
      setTestCaseFilterOptions(
        results
          .filter((result) => Boolean(result.value))
          .map((result) => ({
            value: result.value as string,
            label: result.label,
          }))
      );
    } finally {
      setIsTestCaseOptionsLoading(false);
    }
  };

  // Filter descriptors consumed by the AI-mode FilterBar. Migrated one at a time;
  // the OSS renderer keeps its own antd filter bar.
  const filterDescriptors: FilterDescriptor[] = [
    {
      key: 'testCaseFQN',
      paramKey: 'testCaseFQN',
      label: t('label.test-case'),
      controlType: 'select',
      searchable: true,
      value: filters.testCaseFQN,
      options: testCaseFilterOptions,
      isLoading: isTestCaseOptionsLoading,
      onGetInitialOptions: () => {
        fetchTestCaseFilterOptions();
      },
      onSearch: (query: string) => {
        fetchTestCaseFilterOptions(query);
      },
      onChange: (value) =>
        updateFilters({ testCaseFQN: value as string | undefined }),
    },
    {
      key: 'assignee',
      paramKey: 'assignee',
      label: t('label.assignee'),
      controlType: 'user',
      searchable: false,
      value: filters.assignee,
      options: [],
      isLoading: false,
      onGetInitialOptions: noop,
      onChange: noop,
      selectedOwners: assigneeOwners,
      onOwnerChange: handleAssigneeOwnerChange,
    },
    {
      key: 'testCaseResolutionStatusType',
      paramKey: 'testCaseResolutionStatusType',
      label: t('label.status'),
      controlType: 'select',
      searchable: false,
      value: filters.testCaseResolutionStatusType,
      options: STATUS_FILTER_OPTIONS,
      isLoading: false,
      onGetInitialOptions: noop,
      onChange: (value) =>
        updateFilters({
          testCaseResolutionStatusType: value as
            | TestCaseResolutionStatusTypes
            | undefined,
        }),
    },
    {
      key: 'dateField',
      paramKey: 'dateField',
      label: t('label.date-filter'),
      controlType: 'select',
      searchable: false,
      value: selectedDateFilterKey,
      options: dateFilterOptions.map((option) => ({
        label: option.name,
        value: option.value,
      })),
      isLoading: false,
      onGetInitialOptions: noop,
      onChange: (value) =>
        handleDateFieldChange((value as string) ?? 'timestamp'),
    },
    {
      key: 'dateRange',
      paramKey: 'startTs',
      label: t('label.date-range'),
      controlType: 'date',
      searchable: false,
      value: { startTs: filters.startTs, endTs: filters.endTs },
      options: [],
      isLoading: false,
      onGetInitialOptions: noop,
      onChange: (value) => {
        const range = value as FilterDateValue | undefined;
        updateFilters({ startTs: range?.startTs, endTs: range?.endTs });
      },
    },
  ];

  const hasActiveFilters = Boolean(
    filters.testCaseFQN ||
      filters.testCaseResolutionStatusType ||
      filters.assignee ||
      filters.startTs ||
      filters.endTs
  );

  const clearAllFilters = () => {
    setAssigneeOwnerRefs([]);
    updateFilters({
      testCaseFQN: undefined,
      testCaseResolutionStatusType: undefined,
      assignee: undefined,
      startTs: undefined,
      endTs: undefined,
      dateField: undefined,
    });
  };

  return {
    isIncidentPage,
    tableDetails,
    commonTestCasePermission,
    filters,
    dateRangeKey,
    testCaseListData,
    isDateFilterOpen,
    setIsDateFilterOpen,
    assigneeOptionsWithSelected,
    selectedAssignees,
    isPermissionLoading,
    testCasePermissions,
    dateFilterOptions,
    selectedDateFilterKey,
    selectedDateFilterOption,
    showPagination,
    pagingData,
    handleSeveritySubmit,
    handleAssigneeUpdate,
    fetchUserFilterOptions,
    updateFilters,
    handleAssigneeChange,
    handleDateRangeChange,
    handleDateFieldChange,
    handleDateRangeClear,
    handleStatusSubmit,
    searchTestCases,
    filterDescriptors,
    hasActiveFilters,
    clearAllFilters,
  };
};
