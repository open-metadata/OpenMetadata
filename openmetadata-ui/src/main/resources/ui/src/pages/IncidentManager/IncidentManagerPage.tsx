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
import { Col, Row } from 'antd';
import { AxiosError } from 'axios';
import { isEqual } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { PagingHandlerParams } from '../../components/common/NextPrevious/NextPrevious.interface';
import DatePickerMenu from '../../components/DatePickerMenu/DatePickerMenu.component';
import TestCaseIncidentManagerTable from '../../components/IncidentManager/TestCaseIncidentManagerTable/TestCaseIncidentManagerTable.component';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { usePermissionProvider } from '../../components/PermissionProvider/PermissionProvider';
import { DateRangeObject } from '../../components/ProfilerDashboard/component/TestSummary';
import { PAGE_HEADERS } from '../../constants/PageHeaders.constant';
import { DEFAULT_RANGE_DATA } from '../../constants/profiler.constant';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { TestCaseResolutionStatus } from '../../generated/tests/testCase';
import { usePaging } from '../../hooks/paging/usePaging';
import { getListTestCaseIncidentStatus } from '../../rest/incidentManagerAPI';
import { ListTestCaseParams } from '../../rest/testAPI';
import { showErrorToast } from '../../utils/ToastUtils';
import { TestCaseIncidentStatusData } from './IncidentManager.interface';

const IncidentManagerPage = () => {
  const [testCaseListData, setTestCaseListData] =
    useState<TestCaseIncidentStatusData>({
      data: [],
      isLoading: true,
    });

  const [dateRangeObject, setDateRangeObject] =
    useState<DateRangeObject>(DEFAULT_RANGE_DATA);

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
    async (dateRangeObject: DateRangeObject, params?: ListTestCaseParams) => {
      setTestCaseListData((prev) => ({ ...prev, isLoading: true }));
      try {
        const { data, paging } = await getListTestCaseIncidentStatus({
          ...params,
          limit: pageSize,
          startTs: dateRangeObject.startTs,
          endTs: dateRangeObject.endTs,
          latest: true,
        });
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
      fetchTestCases(dateRangeObject, {
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

  const handleDateRangeChange = (value: DateRangeObject) => {
    if (!isEqual(value, dateRangeObject)) {
      setDateRangeObject(value);
    }
  };

  useEffect(() => {
    if (testCasePermission?.ViewAll || testCasePermission?.ViewBasic) {
      fetchTestCases(dateRangeObject);
    } else {
      setTestCaseListData((prev) => ({ ...prev, isLoading: false }));
    }
  }, [testCasePermission, pageSize, dateRangeObject]);

  if (!testCasePermission?.ViewAll && !testCasePermission?.ViewBasic) {
    return <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />;
  }

  return (
    <PageLayoutV1 pageTitle="Incident Manager">
      <Row className="p-x-lg" gutter={[0, 16]}>
        <Col span={24}>
          <PageHeader data={PAGE_HEADERS.INCIDENT_MANAGER} />
        </Col>

        <Col className="d-flex justify-end" span={24}>
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
