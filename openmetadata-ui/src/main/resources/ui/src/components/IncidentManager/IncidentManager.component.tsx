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
import { Box, Skeleton, Stack, useTheme } from '@mui/material';
import { Form, Select } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { isEqual, isString, isUndefined, omit, parseInt, pick } from 'lodash';
import { DateRangeObject } from 'Models';
import QueryString from 'qs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { WILD_CARD_CHAR } from '../../constants/char.constants';
import {
  DEFAULT_DOMAIN_VALUE,
  PAGE_SIZE_BASE,
} from '../../constants/constants';
import { TEST_CASE_RESOLUTION_STATUS_LABELS } from '../../constants/TestSuite.constant';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityTabs, EntityType, FqnPart } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import { EntityReference } from '../../generated/tests/testCase';
import {
  Assigned,
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
import Assignees from '../../pages/TasksPage/shared/Assignees';
import { Option } from '../../pages/TasksPage/TasksPage.interface';
import {
  getListTestCaseIncidentStatusFromSearch,
  postTestCaseIncidentStatus,
  TestCaseIncidentStatusParams,
  updateTestCaseIncidentById,
} from '../../rest/incidentManagerAPI';
import { getUserAndTeamSearch } from '../../rest/miscAPI';
import { searchQuery } from '../../rest/searchAPI';
import {
  getNameFromFQN,
  getPartialNameFromTableFQN,
} from '../../utils/CommonUtils';
import { getEntityName } from '../../utils/EntityUtils';
import {
  getEntityDetailsPath,
  getTestCaseDetailPagePath,
} from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { AsyncSelect } from '../common/AsyncSelect/AsyncSelect';
import DateTimeDisplay from '../common/DateTimeDisplay/DateTimeDisplay';
import ErrorPlaceHolder from '../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import FilterTablePlaceHolder from '../common/ErrorWithPlaceholder/FilterTablePlaceHolder';
import MuiDatePickerMenu from '../common/MuiDatePickerMenu/MuiDatePickerMenu';
import { PagingHandlerParams } from '../common/NextPrevious/NextPrevious.interface';
import { OwnerLabel } from '../common/OwnerLabel/OwnerLabel.component';
import Table from '../common/Table/Table';
import {
  ProfilerTabPath,
  TestCasePermission,
} from '../Database/Profiler/ProfilerDashboard/profilerDashboard.interface';
import Severity from '../DataQuality/IncidentManager/Severity/Severity.component';
import TestCaseIncidentManagerStatus from '../DataQuality/IncidentManager/TestCaseStatus/TestCaseIncidentManagerStatus.component';
import { IncidentManagerProps } from './IncidentManager.interface';

const IncidentManager = ({
  isIncidentPage = true,
  tableDetails,
  isDateRangePickerVisible = true,
}: IncidentManagerProps) => {
  const location = useCustomLocation();
  const navigate = useNavigate();
  const { activeDomain } = useDomainStore();
  const theme = useTheme();

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
    [pageSize, setTestCaseListData, activeDomain]
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

  const handlePagingClick = ({
    cursorType,
    currentPage,
  }: PagingHandlerParams) => {
    if (cursorType) {
      fetchTestCaseIncidents({
        ...filters,
        [cursorType]: paging?.[cursorType],
        offset: paging?.[cursorType]
          ? parseInt(paging?.[cursorType] ?? '', 10)
          : undefined,
      });
    }
    handlePageChange(currentPage);
  };

  const pagingData = useMemo(
    () => ({
      paging,
      currentPage,
      pagingHandler: handlePagingClick,
      pageSize,
      onShowSizeChange: handlePageSizeChange,
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
      const assigneeData = assignee?.[0];

      const updatedData: TestCaseResolutionStatus = {
        ...record,
        testCaseResolutionStatusDetails: {
          ...record?.testCaseResolutionStatusDetails,
          assignee: assigneeData,
        },
        testCaseResolutionStatusType: TestCaseResolutionStatusTypes.Assigned,
      };

      try {
        await postTestCaseIncidentStatus({
          severity: record.severity,
          testCaseReference: record.testCaseReference?.fullyQualifiedName ?? '',
          testCaseResolutionStatusType: TestCaseResolutionStatusTypes.Assigned,
          testCaseResolutionStatusDetails: {
            assignee: assigneeData,
          },
        });

        setTestCaseListData((prev) => {
          const testCaseList = prev.data.map((item) => {
            if (item.stateId === updatedData.stateId) {
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

  const handleDateRangeClear = useCallback(() => {
    const updatedFilters = omit(allParams, [
      'startTs',
      'endTs',
      'key',
      'title',
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
          if (item.stateId === value.stateId) {
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
  }, [commonTestCasePermission, pageSize, filters, activeDomain]);

  useEffect(() => {
    if (testCaseListData.data.length > 0) {
      fetchTestCasePermissions();
    }
  }, [testCaseListData.data]);

  const testCaseResolutionStatusDetailsRender = (
    value?: Assigned,
    record?: TestCaseResolutionStatus
  ) => {
    if (isPermissionLoading) {
      return <Skeleton height={24} variant="rectangular" width={100} />;
    }

    const hasPermission = testCasePermissions.find(
      (item) =>
        item.fullyQualifiedName ===
        record?.testCaseReference?.fullyQualifiedName
    );

    return (
      <Box data-testid="assignee">
        <OwnerLabel
          isCompactView
          className="m-0"
          hasPermission={hasPermission?.EditAll && !tableDetails?.deleted}
          multiple={{
            user: false,
            team: false,
          }}
          owners={value?.assignee ? [value.assignee] : []}
          placeHolder={t('label.no-entity', {
            entity: t('label.assignee'),
          })}
          tooltipText={t('label.edit-entity', {
            entity: t('label.assignee'),
          })}
          onUpdate={(assignees) =>
            record && handleAssigneeUpdate(record, assignees)
          }
        />
      </Box>
    );
  };

  const columns: ColumnsType<TestCaseResolutionStatus> = useMemo(
    () => [
      {
        title: t('label.test-case-name'),
        dataIndex: 'name',
        key: 'name',
        width: 300,
        fixed: 'left',
        render: (_, record) => {
          return (
            <Link
              className="m-0 break-all text-primary"
              data-testid={`test-case-${record.testCaseReference?.name}`}
              to={getTestCaseDetailPagePath(
                record.testCaseReference?.fullyQualifiedName ?? ''
              )}>
              {getEntityName(record.testCaseReference)}
            </Link>
          );
        },
      },
      ...(isIncidentPage
        ? [
            {
              title: t('label.table'),
              dataIndex: 'testCaseReference',
              key: 'testCaseReference',
              width: 150,
              render: (value: EntityReference) => {
                const tableFqn = getPartialNameFromTableFQN(
                  value.fullyQualifiedName ?? '',
                  [
                    FqnPart.Service,
                    FqnPart.Database,
                    FqnPart.Schema,
                    FqnPart.Table,
                  ],
                  '.'
                );

                return (
                  <Link
                    data-testid="table-link"
                    to={getEntityDetailsPath(
                      EntityType.TABLE,
                      tableFqn,
                      EntityTabs.PROFILER,
                      ProfilerTabPath.DATA_QUALITY
                    )}
                    onClick={(e) => e.stopPropagation()}>
                    {getNameFromFQN(tableFqn) ?? value.fullyQualifiedName}
                  </Link>
                );
              },
            },
          ]
        : []),
      {
        title: t('label.last-updated'),
        dataIndex: 'timestamp',
        key: 'timestamp',
        width: 150,
        render: (value: number) => {
          return <DateTimeDisplay timestamp={value} />;
        },
      },
      {
        title: t('label.status'),
        dataIndex: 'testCaseResolutionStatusType',
        key: 'testCaseResolutionStatusType',
        width: 100,
        render: (_, record: TestCaseResolutionStatus) => {
          if (isPermissionLoading) {
            return <Skeleton height={24} variant="rectangular" width={100} />;
          }
          const hasPermission = testCasePermissions.find(
            (item) =>
              item.fullyQualifiedName ===
              record.testCaseReference?.fullyQualifiedName
          );

          return (
            <TestCaseIncidentManagerStatus
              isInline
              data={record}
              hasPermission={hasPermission?.EditAll && !tableDetails?.deleted}
              onSubmit={handleStatusSubmit}
            />
          );
        },
      },
      {
        title: t('label.severity'),
        dataIndex: 'severity',
        key: 'severity',
        width: 100,
        render: (value: Severities, record: TestCaseResolutionStatus) => {
          if (isPermissionLoading) {
            return <Skeleton height={24} variant="rectangular" width={100} />;
          }

          const hasPermission = testCasePermissions.find(
            (item) =>
              item.fullyQualifiedName ===
              record.testCaseReference?.fullyQualifiedName
          );

          return (
            <Severity
              isInline
              hasPermission={hasPermission?.EditAll && !tableDetails?.deleted}
              severity={value}
              onSubmit={(severity) => handleSeveritySubmit(record, severity)}
            />
          );
        },
      },
      {
        title: t('label.assignee'),
        dataIndex: 'testCaseResolutionStatusDetails',
        key: 'testCaseResolutionStatusDetails',
        width: 200,
        render: testCaseResolutionStatusDetailsRender,
      },
    ],
    [
      tableDetails?.deleted,
      testCaseListData.data,
      testCasePermissions,
      isPermissionLoading,
      handleAssigneeUpdate,
      handleStatusSubmit,
    ]
  );

  if (
    !commonTestCasePermission?.ViewAll &&
    !commonTestCasePermission?.ViewBasic
  ) {
    return (
      <ErrorPlaceHolder
        className="border-none"
        permissionValue={t('label.view-entity', {
          entity: t('label.test-case'),
        })}
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
  }

  return (
    <Stack
      sx={{
        border: `1px solid ${theme.palette.grey[200]}`,
        borderRadius: '10px',
        backgroundColor: theme.palette.common.white,
      }}>
      <Box
        className="new-form-style"
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          p: 4,
          gap: 5,
        }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          spacing={5}
          width="100%">
          <AsyncSelect
            allowClear
            showArrow
            showSearch
            api={searchTestCases}
            className="w-min-20"
            data-testid="test-case-select"
            placeholder={t('label.test-case')}
            suffixIcon={undefined}
            value={filters.testCaseFQN}
            onChange={(value) => updateFilters({ testCaseFQN: value })}
          />
          <Box display="flex" gap={5}>
            <Form.Item className="m-b-0" label={t('label.assignee')}>
              <Assignees
                allowClear
                isSingleSelect
                showArrow
                className="w-min-10"
                options={assigneeOptionsWithSelected}
                placeholder={t('label.assignee')}
                value={selectedAssignees}
                onChange={handleAssigneeChange}
                onSearch={(query) => fetchUserFilterOptions(query)}
              />
            </Form.Item>
            <Form.Item className="m-b-0" label={t('label.status')}>
              <Select
                allowClear
                className="w-min-10"
                data-testid="status-select"
                placeholder={t('label.status')}
                value={filters.testCaseResolutionStatusType}
                onChange={(value) =>
                  updateFilters({ testCaseResolutionStatusType: value })
                }>
                {Object.values(TestCaseResolutionStatusTypes).map((value) => (
                  <Select.Option key={value}>
                    {TEST_CASE_RESOLUTION_STATUS_LABELS[value]}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
            {isDateRangePickerVisible && (
              <Form.Item className="m-b-0" label={t('label.date')}>
                <MuiDatePickerMenu
                  allowClear
                  showSelectedCustomRange
                  defaultDateRange={dateRangeKey}
                  handleDateRangeChange={handleDateRangeChange}
                  size="small"
                  onClear={handleDateRangeClear}
                />
              </Form.Item>
            )}
          </Box>
        </Stack>
      </Box>

      <Table
        columns={columns}
        containerClassName="test-case-table-container custom-card-with-table"
        data-testid="test-case-incident-manager-table"
        dataSource={testCaseListData.data}
        loading={testCaseListData.isLoading}
        {...(pagingData && showPagination
          ? {
              customPaginationProps: {
                ...pagingData,
                showPagination,
              },
            }
          : {})}
        locale={{
          emptyText: (
            <FilterTablePlaceHolder
              placeholderText={t('message.no-incident-found')}
            />
          ),
        }}
        pagination={false}
        rowKey="id"
        scroll={testCaseListData.data.length > 0 ? { x: '100%' } : undefined}
        size="small"
      />
    </Stack>
  );
};

export default IncidentManager;
