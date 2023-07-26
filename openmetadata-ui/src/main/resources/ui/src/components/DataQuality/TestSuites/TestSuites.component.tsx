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
import { Button, Col, Row, Table } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import FilterTablePlaceHolder from 'components/common/error-with-placeholder/FilterTablePlaceHolder';
import NextPrevious from 'components/common/next-previous/NextPrevious';
import { OwnerLabel } from 'components/common/OwnerLabel/OwnerLabel.component';
import Loader from 'components/Loader/Loader';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import { TableProfilerTab } from 'components/ProfilerDashboard/profilerDashboard.interface';
import ProfilerProgressWidget from 'components/TableProfiler/Component/ProfilerProgressWidget';
import {
  getTableTabPath,
  INITIAL_PAGING_VALUE,
  PAGE_SIZE,
  ROUTES,
} from 'constants/constants';
import { PROGRESS_BAR_COLOR } from 'constants/TestSuite.constant';
import { ERROR_PLACEHOLDER_TYPE } from 'enums/common.enum';
import { EntityTabs } from 'enums/entity.enum';
import { TestSummary } from 'generated/entity/data/table';
import { TestSuite } from 'generated/tests/testSuite';
import { EntityReference } from 'generated/type/entityReference';
import { Paging } from 'generated/type/paging';
import { isString } from 'lodash';
import { PagingResponse } from 'Models';
import { DataQualityPageTabs } from 'pages/DataQuality/DataQualityPage.interface';
import QueryString from 'qs';
import React, { ReactNode, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import {
  getListTestSuites,
  ListTestSuitePrams,
  TestSuiteType,
} from 'rest/testAPI';
import { getEntityName } from 'utils/EntityUtils';
import { getTestSuitePath } from 'utils/RouterUtils';
import { showErrorToast } from 'utils/ToastUtils';

export const TestSuites = ({ summaryPanel }: { summaryPanel: ReactNode }) => {
  const { t } = useTranslation();
  const { tab = DataQualityPageTabs.TABLES } =
    useParams<{ tab: DataQualityPageTabs }>();

  const { permissions } = usePermissionProvider();
  const { testSuite: testSuitePermission } = permissions;

  const [testSuites, setTestSuites] = useState<PagingResponse<TestSuite[]>>({
    data: [],
    paging: { total: 0 },
  });
  const [currentPage, setCurrentPage] = useState(INITIAL_PAGING_VALUE);

  const [isLoading, setIsLoading] = useState<boolean>(true);

  const columns = useMemo(() => {
    const data: ColumnsType<TestSuite> = [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        render: (_, record) => {
          return record.executable ? (
            <Link
              to={{
                pathname: getTableTabPath(
                  encodeURIComponent(
                    record.executableEntityReference?.fullyQualifiedName ?? ''
                  ),
                  EntityTabs.PROFILER
                ),
                search: QueryString.stringify({
                  activeTab: TableProfilerTab.DATA_QUALITY,
                }),
              }}>
              {record.executableEntityReference?.fullyQualifiedName ??
                record.executableEntityReference?.name}
            </Link>
          ) : (
            <Link
              to={getTestSuitePath(
                encodeURIComponent(record.fullyQualifiedName ?? record.name)
              )}>
              {getEntityName(record)}
            </Link>
          );
        },
      },
      {
        title: t('label.test-plural'),
        dataIndex: 'summary',
        key: 'tests',
        render: (value: TestSummary) => value?.total ?? 0,
      },
      {
        title: `${t('label.success')} %`,
        dataIndex: 'summary',
        key: 'success',
        render: (value: TestSummary) => {
          const percent =
            value.total && value.success ? value.success / value.total : 0;

          return (
            <ProfilerProgressWidget
              strokeColor={PROGRESS_BAR_COLOR}
              value={percent}
            />
          );
        },
      },
      {
        title: t('label.owner'),
        dataIndex: 'owner',
        key: 'owner',
        render: (owner: EntityReference) => <OwnerLabel owner={owner} />,
      },
    ];

    return data;
  }, []);

  const fetchTestSuites = async (params?: ListTestSuitePrams) => {
    setIsLoading(true);
    try {
      const result = await getListTestSuites({
        ...params,
        fields: 'owner,summary',
        testSuiteType:
          tab === DataQualityPageTabs.TABLES
            ? TestSuiteType.executable
            : TestSuiteType.logical,
      });
      setTestSuites(result);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePagingClick = (
    cursorValue: string | number,
    activePage?: number
  ) => {
    const { paging } = testSuites;
    if (isString(cursorValue)) {
      fetchTestSuites({ [cursorValue]: paging?.[cursorValue as keyof Paging] });
    }
    activePage && setCurrentPage(activePage);
  };

  useEffect(() => {
    if (testSuitePermission?.ViewAll || testSuitePermission?.ViewBasic) {
      fetchTestSuites();
    } else {
      setIsLoading(false);
    }
  }, [tab, testSuitePermission]);

  if (!testSuitePermission?.ViewAll && !testSuitePermission?.ViewBasic) {
    return <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />;
  }

  return (
    <Row
      className="p-x-lg p-t-md"
      data-testid="test-suite-container"
      gutter={[16, 16]}>
      <Col span={24}>
        <Row justify="end">
          <Col>
            {tab === DataQualityPageTabs.TEST_SUITES &&
              testSuitePermission?.Create && (
                <Link
                  data-testid="add-test-suite-btn"
                  to={ROUTES.ADD_TEST_SUITES}>
                  <Button type="primary">
                    {t('label.add-entity', { entity: t('label.test-suite') })}
                  </Button>
                </Link>
              )}
          </Col>
        </Row>
      </Col>

      <Col span={24}>{summaryPanel}</Col>
      <Col span={24}>
        <Table
          bordered
          columns={columns}
          data-testid="test-suite-table"
          dataSource={testSuites.data}
          loading={{ spinning: isLoading, indicator: <Loader /> }}
          locale={{
            emptyText: <FilterTablePlaceHolder />,
          }}
          pagination={false}
          size="small"
        />
      </Col>
      <Col span={24}>
        {testSuites.paging.total > PAGE_SIZE && (
          <NextPrevious
            currentPage={currentPage}
            pageSize={PAGE_SIZE}
            paging={testSuites.paging}
            pagingHandler={handlePagingClick}
            totalCount={testSuites.paging.total}
          />
        )}
      </Col>
    </Row>
  );
};
