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
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { PagingHandlerParams } from '../../components/common/NextPrevious/NextPrevious.interface';
import { SummaryCard } from '../../components/common/SummaryCard/SummaryCard.component';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { usePermissionProvider } from '../../components/PermissionProvider/PermissionProvider';
import TestCaseResolutionCenterTable from '../../components/ResolutionCenter/TestCaseResolutionCenterTable/TestCaseResolutionCenterTable.component';
import { PAGE_HEADERS } from '../../constants/PageHeaders.constant';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { TestCase } from '../../generated/tests/testCase';
import { usePaging } from '../../hooks/paging/usePaging';
import { getListTestCase, ListTestCaseParams } from '../../rest/testAPI';
import { showErrorToast } from '../../utils/ToastUtils';
import { TestCaseListData } from './ResolutionCenter.interface';

const summary = {
  total: 100,
  new: 20,
  acknowledged: 13,
  inReview: 18,
  assigned: 20,
  resolved: 1043,
};

const isLoading = false;

const ResolutionCenterPage = () => {
  const { t } = useTranslation();

  const [testCaseListData, setTestCaseListData] = useState<TestCaseListData>({
    data: [],
    isLoading: true,
  });

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

  const fetchTestCases = async (params?: ListTestCaseParams) => {
    setTestCaseListData((prev) => ({ ...prev, isLoading: true }));
    try {
      const { data, paging } = await getListTestCase({
        ...params,
        limit: pageSize,
        fields: 'testDefinition,testCaseResult,testSuite',
        orderByLastExecutionDate: true,
      });
      setTestCaseListData((prev) => ({ ...prev, data: data }));
      handlePagingChange(paging);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setTestCaseListData((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const handelTestCaseUpdate = (testCase: TestCase) => {
    setTestCaseListData((prev) => {
      const testCaseList = prev.data.map((item) => {
        if (item.fullyQualifiedName === testCase.fullyQualifiedName) {
          return testCase;
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

  useEffect(() => {
    if (testCasePermission?.ViewAll || testCasePermission?.ViewBasic) {
      fetchTestCases();
    } else {
      //   setIsLoading(false);
    }
  }, [testCasePermission, pageSize]);

  if (!testCasePermission?.ViewAll && !testCasePermission?.ViewBasic) {
    return <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />;
  }

  return (
    <PageLayoutV1 pageTitle="Resolution Center">
      <Row className="p-x-lg" gutter={[0, 16]}>
        <Col span={24}>
          <PageHeader data={PAGE_HEADERS.RESOLUTION_CENTER} />
        </Col>

        <Col span={24}>
          <Row wrap gutter={[16, 16]}>
            <Col span={4}>
              <SummaryCard
                className="h-full"
                isLoading={isLoading}
                title={t('label.new')}
                total={summary?.total ?? 0}
                type="new"
                value={summary?.new ?? 0}
              />
            </Col>
            <Col span={5}>
              <SummaryCard
                isLoading={isLoading}
                title={t('label.acknowledged')}
                total={summary?.total ?? 0}
                type="acknowledged"
                value={summary?.acknowledged ?? 0}
              />
            </Col>
            <Col span={5}>
              <SummaryCard
                isLoading={isLoading}
                title={t('label.in-review')}
                total={summary?.total ?? 0}
                type="aborted"
                value={summary?.inReview ?? 0}
              />
            </Col>
            <Col span={5}>
              <SummaryCard
                isLoading={isLoading}
                title={t('label.assigned')}
                total={summary?.total ?? 0}
                type="assigned"
                value={summary?.assigned ?? 0}
              />
            </Col>
            <Col span={5}>
              <SummaryCard
                isLoading={isLoading}
                title={t('label.resolved')}
                total={summary?.total ?? 0}
                type="success"
                value={summary?.resolved ?? 0}
              />
            </Col>
          </Row>
        </Col>

        <Col span={24}>
          <TestCaseResolutionCenterTable
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

export default ResolutionCenterPage;
