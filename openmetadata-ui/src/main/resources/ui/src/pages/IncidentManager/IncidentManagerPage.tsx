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
import { Col, Row, Select, Space, Typography } from 'antd';
import { DefaultOptionType } from 'antd/lib/select';
import { AxiosError } from 'axios';
import { isEqual, startCase } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AsyncSelect } from '../../components/AsyncSelect/AsyncSelect';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { PagingHandlerParams } from '../../components/common/NextPrevious/NextPrevious.interface';
import DatePickerMenu from '../../components/DatePickerMenu/DatePickerMenu.component';
import TestCaseIncidentManagerTable from '../../components/IncidentManager/TestCaseIncidentManagerTable/TestCaseIncidentManagerTable.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { usePermissionProvider } from '../../components/PermissionProvider/PermissionProvider';
import { DateRangeObject } from '../../components/ProfilerDashboard/component/TestSummary';
import { WILD_CARD_CHAR } from '../../constants/char.constants';
import { PAGE_SIZE_BASE } from '../../constants/constants';
import { PAGE_HEADERS } from '../../constants/PageHeaders.constant';
import { DEFAULT_RANGE_DATA } from '../../constants/profiler.constant';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { SearchIndex } from '../../enums/search.enum';
import {
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
} from '../../rest/incidentManagerAPI';
import { getUserSuggestions } from '../../rest/miscAPI';
import { searchQuery } from '../../rest/searchAPI';
import { getEntityName } from '../../utils/EntityUtils';
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

  const fetchTestCases = useCallback(
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

  const handelTestCaseUpdate = (
    testCaseIncidentStatus: TestCaseResolutionStatus
  ) => {
    setTestCaseListData((prev) => {
      const testCaseList = prev.data.map((item) => {
        if (item.id === testCaseIncidentStatus.id) {
          return testCaseIncidentStatus;
        }

        return item;
      });

      return {
        ...prev,
        data: testCaseList,
      };
    });
  };

  const handlePagingClick = ({
    cursorType,
    currentPage,
  }: PagingHandlerParams) => {
    if (cursorType) {
      fetchTestCases({
        ...filters,
        [cursorType]: paging?.[cursorType],
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

  const fetchOptions = async (query: string) => {
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
      showErrorToast(error as AxiosError);
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
      fetchTestCases(filters);
    } else {
      setTestCaseListData((prev) => ({ ...prev, isLoading: false }));
    }
  }, [testCasePermission, pageSize, filters]);

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
              onSearch={(query) => fetchOptions(query)}
            />
            <Select
              allowClear
              className="w-min-10"
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
          <TestCaseIncidentManagerTable
            handleTestCaseUpdate={handelTestCaseUpdate}
            pagingData={pagingData}
            showPagination={showPagination}
            testCaseListData={testCaseListData}
          />
        </Col>
      </Row>
    </PageLayoutV1>
  );
};

export default IncidentManagerPage;
