/*
 *  Copyright 2023 Collate.
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
import { Col, Row, Select, Space, Table, Typography } from 'antd';
import { DefaultOptionType } from 'antd/lib/select';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { isEqual, startCase } from 'lodash';
import QueryString from 'qs';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AsyncSelect } from '../../components/AsyncSelect/AsyncSelect';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import FilterTablePlaceHolder from '../../components/common/ErrorWithPlaceholder/FilterTablePlaceHolder';
import NextPrevious from '../../components/common/NextPrevious/NextPrevious';
import { PagingHandlerParams } from '../../components/common/NextPrevious/NextPrevious.interface';
import { OwnerLabel } from '../../components/common/OwnerLabel/OwnerLabel.component';
import DatePickerMenu from '../../components/DatePickerMenu/DatePickerMenu.component';
import Severity from '../../components/IncidentManager/Severity/Severity.component';
import TestCaseIncidentManagerStatus from '../../components/IncidentManager/TestCaseStatus/TestCaseIncidentManagerStatus.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { usePermissionProvider } from '../../components/PermissionProvider/PermissionProvider';
import { DateRangeObject } from '../../components/ProfilerDashboard/component/TestSummary';
import { TableProfilerTab } from '../../components/ProfilerDashboard/profilerDashboard.interface';
import { WILD_CARD_CHAR } from '../../constants/char.constants';
import { getTableTabPath, PAGE_SIZE_BASE } from '../../constants/constants';
import { PAGE_HEADERS } from '../../constants/PageHeaders.constant';
import { DEFAULT_RANGE_DATA } from '../../constants/profiler.constant';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityTabs, FqnPart } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import { EntityReference } from '../../generated/entity/type';
import {
  Assigned,
  Severities,
  TestCaseResolutionStatus,
  TestCaseResolutionStatusTypes,
} from '../../generated/tests/testCase';
import { usePaging } from '../../hooks/paging/usePaging';
import {
  SearchHitBody,
  TestCaseSearchSource,
} from '../../interface/search.interface';
import {
  getListTestCaseIncidentStatus,
  TestCaseIncidentStatusParams,
  updateTestCaseIncidentById,
} from '../../rest/incidentManagerAPI';
import { getUserSuggestions } from '../../rest/miscAPI';
import { searchQuery } from '../../rest/searchAPI';
import {
  getNameFromFQN,
  getPartialNameFromTableFQN,
} from '../../utils/CommonUtils';
import { formatDateTime } from '../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../utils/EntityUtils';
import { getIncidentManagerDetailPagePath } from '../../utils/RouterUtils';
import { getEncodedFqn } from '../../utils/StringsUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import Assignees from '../TasksPage/shared/Assignees';
import { Option } from '../TasksPage/TasksPage.interface';
import { TestCaseIncidentStatusData } from './IncidentManager.interface';

const IncidentManagerPage = () => {
  const [testCaseListData, setTestCaseListData] =
    useState<TestCaseIncidentStatusData>({
      data: [],
      isLoading: true,
    });
  const [filters, setFilters] = useState<TestCaseIncidentStatusParams>({
    ...DEFAULT_RANGE_DATA,
  });
  const [users, setUsers] = useState<{
    options: Option[];
    selected: Option[];
  }>({
    options: [],
    selected: [],
  });
  const [testCaseInitialOptions, setTestCaseInitialOptions] =
    useState<DefaultOptionType[]>();

  const { t } = useTranslation();

  const { permissions } = usePermissionProvider();
  const { testCase: testCasePermission } = permissions;

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
          ...params,
        });
        const assigneeOptions = data.reduce((acc, curr) => {
          const assignee = curr.testCaseResolutionStatusDetails?.assignee;
          const isExist = acc.some((item) => item.value === assignee?.id);

          if (assignee && !isExist) {
            acc.push({
              label: getEntityName(assignee),
              value: assignee.id,
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
      const res = await getUserSuggestions(query, true);
      const hits = res.data.suggest['metadata-suggest'][0]['options'];
      const suggestOptions = hits.map((hit) => ({
        label: getEntityName(hit._source),
        value: hit._id,
        type: hit._source.entityType,
        name: hit._source.name,
      }));

      setUsers((pre) => ({ ...pre, options: suggestOptions }));
    } catch (error) {
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
    const dateRangeObject = {
      startTs: filters.startTs,
      endTs: filters.endTs,
    };

    if (!isEqual(value, dateRangeObject)) {
      setFilters((pre) => ({ ...pre, ...value }));
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
    } catch (error) {
      return [];
    }
  };

  const getInitialOptions = async () => {
    try {
      const option = await searchTestCases();
      setTestCaseInitialOptions(option);
    } catch (error) {
      setTestCaseInitialOptions([]);
    }
  };
  useEffect(() => {
    getInitialOptions();
  }, []);
  useEffect(() => {
    if (testCasePermission?.ViewAll || testCasePermission?.ViewBasic) {
      fetchTestCaseIncidents(filters);
    } else {
      setTestCaseListData((prev) => ({ ...prev, isLoading: false }));
    }
  }, [testCasePermission, pageSize, filters]);

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
              style={{ maxWidth: 280 }}
              to={getIncidentManagerDetailPagePath(
                record.testCaseReference?.fullyQualifiedName ?? ''
              )}>
              {getEntityName(record.testCaseReference)}
            </Link>
          );
        },
      },
      {
        title: t('label.table'),
        dataIndex: 'testCaseReference',
        key: 'testCaseReference',
        width: 150,
        render: (value: EntityReference) => {
          const tableFqn = getPartialNameFromTableFQN(
            value.fullyQualifiedName ?? '',
            [FqnPart.Service, FqnPart.Database, FqnPart.Schema, FqnPart.Table],
            '.'
          );

          return (
            <Link
              data-testid="table-link"
              to={{
                pathname: getTableTabPath(
                  getEncodedFqn(tableFqn),
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
      {
        title: t('label.execution-time'),
        dataIndex: 'timestamp',
        key: 'timestamp',
        width: 150,
        render: (value: number) => (value ? formatDateTime(value) : '--'),
      },
      {
        title: t('label.status'),
        dataIndex: 'testCaseResolutionStatusType',
        key: 'testCaseResolutionStatusType',
        width: 100,
        render: (_, record: TestCaseResolutionStatus) => (
          <TestCaseIncidentManagerStatus
            data={record}
            onSubmit={handleStatusSubmit}
          />
        ),
      },
      {
        title: t('label.severity'),
        dataIndex: 'severity',
        key: 'severity',
        width: 150,
        render: (value: Severities, record: TestCaseResolutionStatus) => {
          return (
            <Severity
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
            owner={value?.assignee}
            placeHolder={t('label.no-entity', { entity: t('label.assignee') })}
          />
        ),
      },
    ],
    [testCaseListData.data]
  );

  if (!testCasePermission?.ViewAll && !testCasePermission?.ViewBasic) {
    return <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />;
  }

  return (
    <PageLayoutV1 pageTitle="Incident Manager">
      <Row className="p-x-lg p-t-md" gutter={[0, 16]}>
        <Col span={24}>
          <Typography.Title
            className="m-b-md"
            data-testid="page-title"
            level={5}>
            {PAGE_HEADERS.INCIDENT_MANAGER.header}
          </Typography.Title>
          <Typography.Paragraph
            className="text-grey-muted"
            data-testid="page-sub-title">
            {PAGE_HEADERS.INCIDENT_MANAGER.subHeader}
          </Typography.Paragraph>
        </Col>

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
              options={testCaseInitialOptions}
              placeholder={t('label.test-case')}
              suffixIcon={undefined}
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
            handleDateRangeChange={handleDateRangeChange}
          />
        </Col>

        <Col span={24}>
          <Table
            bordered
            className="test-case-table-container"
            columns={columns}
            data-testid="test-case-incident-manager-table"
            dataSource={testCaseListData.data}
            loading={testCaseListData.isLoading}
            locale={{
              emptyText: <FilterTablePlaceHolder />,
            }}
            pagination={false}
            rowKey="id"
            size="small"
          />
        </Col>

        {pagingData && showPagination && (
          <Col span={24}>
            <NextPrevious {...pagingData} />
          </Col>
        )}
      </Row>
    </PageLayoutV1>
  );
};

export default IncidentManagerPage;
