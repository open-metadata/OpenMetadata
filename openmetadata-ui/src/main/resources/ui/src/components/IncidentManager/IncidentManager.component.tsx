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
import { Col, Row, Select, Skeleton, Space } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { isEqual, isUndefined, pick, startCase } from 'lodash';
import { DateRangeObject } from 'Models';
import QueryString from 'qs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { WILD_CARD_CHAR } from '../../constants/char.constants';
import { PAGE_SIZE_BASE } from '../../constants/constants';
import { PROFILER_FILTER_RANGE } from '../../constants/profiler.constant';
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
import {
  SearchHitBody,
  TestCaseSearchSource,
} from '../../interface/search.interface';
import { TestCaseIncidentStatusData } from '../../pages/IncidentManager/IncidentManager.interface';
import Assignees from '../../pages/TasksPage/shared/Assignees';
import { Option } from '../../pages/TasksPage/TasksPage.interface';
import {
  getListTestCaseIncidentStatus,
  TestCaseIncidentStatusParams,
  updateTestCaseIncidentById,
} from '../../rest/incidentManagerAPI';
import { getUserAndTeamSearch } from '../../rest/miscAPI';
import { searchQuery } from '../../rest/searchAPI';
import {
  getNameFromFQN,
  getPartialNameFromTableFQN,
} from '../../utils/CommonUtils';
import {
  formatDateTimeLong,
  getCurrentMillis,
  getEndOfDayInMillis,
  getEpochMillisForPastDays,
  getStartOfDayInMillis,
} from '../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../utils/EntityUtils';
import {
  getEntityDetailsPath,
  getTestCaseDetailPagePath,
} from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { AsyncSelect } from '../common/AsyncSelect/AsyncSelect';
import DatePickerMenu from '../common/DatePickerMenu/DatePickerMenu.component';
import ErrorPlaceHolder from '../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import FilterTablePlaceHolder from '../common/ErrorWithPlaceholder/FilterTablePlaceHolder';
import { PagingHandlerParams } from '../common/NextPrevious/NextPrevious.interface';
import { OwnerLabel } from '../common/OwnerLabel/OwnerLabel.component';
import Table from '../common/Table/Table';
import {
  TableProfilerTab,
  TestCasePermission,
} from '../Database/Profiler/ProfilerDashboard/profilerDashboard.interface';
import Severity from '../DataQuality/IncidentManager/Severity/Severity.component';
import TestCaseIncidentManagerStatus from '../DataQuality/IncidentManager/TestCaseStatus/TestCaseIncidentManagerStatus.component';
import { IncidentManagerProps } from './IncidentManager.interface';

const IncidentManager = ({
  isIncidentPage = true,
  tableDetails,
}: IncidentManagerProps) => {
  const location = useCustomLocation();
  const navigate = useNavigate();

  const searchParams = useMemo(() => {
    const param = location.search;
    const searchData = QueryString.parse(
      param.startsWith('?') ? param.substring(1) : param
    );
    const data = isUndefined(searchData) ? {} : searchData;

    return data as Partial<TestCaseIncidentStatusParams>;
  }, [location.search]);

  const defaultRange = useMemo(
    () => ({
      key: 'last30days',
      title: PROFILER_FILTER_RANGE.last30days.title,
    }),
    []
  );
  const [testCaseListData, setTestCaseListData] =
    useState<TestCaseIncidentStatusData>({
      data: [],
      isLoading: true,
    });
  const [filters, setFilters] = useState<TestCaseIncidentStatusParams>({
    startTs: getStartOfDayInMillis(
      getEpochMillisForPastDays(PROFILER_FILTER_RANGE.last30days.days)
    ),
    endTs: getEndOfDayInMillis(getCurrentMillis()),
    ...searchParams,
  });
  const [users, setUsers] = useState<{
    options: Option[];
    selected: Option[];
  }>({
    options: [],
    selected: [],
  });

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
        const { data, paging } = await getListTestCaseIncidentStatus({
          limit: pageSize,
          latest: true,
          include: tableDetails?.deleted ? Include.Deleted : Include.NonDeleted,
          originEntityFQN: tableDetails?.fullyQualifiedName,
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
    [pageSize, setTestCaseListData]
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
        offset: paging?.[cursorType],
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
    severity: Severities,
    record: TestCaseResolutionStatus
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

  const handleAssigneeChange = (value?: Option[]) => {
    setUsers((pre) => ({ ...pre, selected: value ?? [] }));
    setFilters((pre) => ({
      ...pre,
      assignee: value ? value[0]?.name : value,
    }));
  };

  const handleDateRangeChange = (value: DateRangeObject) => {
    const updatedFilter = pick(value, ['startTs', 'endTs']);
    const existingFilters = pick(filters, ['startTs', 'endTs']);

    if (!isEqual(existingFilters, updatedFilter)) {
      setFilters((pre) => ({ ...pre, ...updatedFilter }));
    }
  };

  const handleStatusSubmit = (value: TestCaseResolutionStatus) => {
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
  };

  const searchTestCases = async (searchValue = WILD_CARD_CHAR) => {
    try {
      const response = await searchQuery({
        pageNumber: 1,
        pageSize: PAGE_SIZE_BASE,
        searchIndex: SearchIndex.TEST_CASE,
        query: searchValue,
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
      if (searchParams) {
        navigate(
          {
            search: QueryString.stringify(filters),
          },
          {
            replace: true,
          }
        );
      }
    } else {
      setTestCaseListData((prev) => ({ ...prev, isLoading: false }));
    }
  }, [commonTestCasePermission, pageSize, filters]);

  useEffect(() => {
    if (testCaseListData.data.length > 0) {
      fetchTestCasePermissions();
    }
  }, [testCaseListData.data]);

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
                    to={{
                      pathname: getEntityDetailsPath(
                        EntityType.TABLE,
                        tableFqn,
                        EntityTabs.PROFILER
                      ),
                      search: QueryString.stringify({
                        activeTab: TableProfilerTab.DATA_QUALITY,
                      }),
                    }}
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
        width: 200,
        render: (value: number) => (value ? formatDateTimeLong(value) : '--'),
      },
      {
        title: t('label.status'),
        dataIndex: 'testCaseResolutionStatusType',
        key: 'testCaseResolutionStatusType',
        width: 120,
        render: (_, record: TestCaseResolutionStatus) => {
          if (isPermissionLoading) {
            return <Skeleton.Input size="small" />;
          }
          const hasPermission = testCasePermissions.find(
            (item) =>
              item.fullyQualifiedName ===
              record.testCaseReference?.fullyQualifiedName
          );

          return (
            <TestCaseIncidentManagerStatus
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
        width: 120,
        render: (value: Severities, record: TestCaseResolutionStatus) => {
          if (isPermissionLoading) {
            return <Skeleton.Input size="small" />;
          }

          const hasPermission = testCasePermissions.find(
            (item) =>
              item.fullyQualifiedName ===
              record.testCaseReference?.fullyQualifiedName
          );

          return (
            <Severity
              hasPermission={hasPermission?.EditAll && !tableDetails?.deleted}
              severity={value}
              onSubmit={(severity) => handleSeveritySubmit(severity, record)}
            />
          );
        },
      },
      {
        title: t('label.assignee'),
        dataIndex: 'testCaseResolutionStatusDetails',
        key: 'testCaseResolutionStatusDetails',
        width: 150,
        render: (value?: Assigned) => (
          <OwnerLabel
            owners={value?.assignee ? [value.assignee] : []}
            placeHolder={t('label.no-entity', { entity: t('label.assignee') })}
          />
        ),
      },
    ],
    [
      tableDetails?.deleted,
      testCaseListData.data,
      testCasePermissions,
      isPermissionLoading,
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
    <Row gutter={[0, 16]}>
      <Col className="d-flex justify-between" span={24}>
        <Space>
          <Assignees
            allowClear
            isSingleSelect
            showArrow
            className="w-min-10"
            options={users.options}
            placeholder={t('label.assignee')}
            value={users.selected}
            onChange={handleAssigneeChange}
            onSearch={(query) => fetchUserFilterOptions(query)}
          />
          <Select
            allowClear
            className="w-min-10"
            data-testid="status-select"
            placeholder={t('label.status')}
            value={filters.testCaseResolutionStatusType}
            onChange={(value) =>
              setFilters((pre) => ({
                ...pre,
                testCaseResolutionStatusType: value,
              }))
            }>
            {Object.values(TestCaseResolutionStatusTypes).map((value) => (
              <Select.Option key={value}>{startCase(value)}</Select.Option>
            ))}
          </Select>
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
            onChange={(value) =>
              setFilters((pre) => ({
                ...pre,
                testCaseFQN: value,
              }))
            }
          />
        </Space>
        <DatePickerMenu
          showSelectedCustomRange
          defaultDateRange={defaultRange}
          handleDateRangeChange={handleDateRangeChange}
        />
      </Col>

      <Col span={24}>
        <Table
          columns={columns}
          containerClassName="test-case-table-container"
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
          scroll={{
            x: '100%',
          }}
          size="small"
        />
      </Col>
    </Row>
  );
};

export default IncidentManager;
