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
import { Button, Col, Row } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { isString } from 'lodash';
import QueryString from 'qs';
import React, {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { getTableTabPath, ROUTES } from '../../../../constants/constants';
import { PROGRESS_BAR_COLOR } from '../../../../constants/TestSuite.constant';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import { ERROR_PLACEHOLDER_TYPE } from '../../../../enums/common.enum';
import { EntityTabs } from '../../../../enums/entity.enum';
import { TestSummary } from '../../../../generated/entity/data/table';
import { EntityReference } from '../../../../generated/entity/type';
import { TestSuite } from '../../../../generated/tests/testCase';
import { usePaging } from '../../../../hooks/paging/usePaging';
import { DataQualityPageTabs } from '../../../../pages/DataQuality/DataQualityPage.interface';
import {
  getListTestSuites,
  ListTestSuitePrams,
  TestSuiteType,
} from '../../../../rest/testAPI';
import { getEntityName } from '../../../../utils/EntityUtils';
import { getTestSuitePath } from '../../../../utils/RouterUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import ErrorPlaceHolder from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import FilterTablePlaceHolder from '../../../common/ErrorWithPlaceholder/FilterTablePlaceHolder';
import NextPrevious from '../../../common/NextPrevious/NextPrevious';
import { PagingHandlerParams } from '../../../common/NextPrevious/NextPrevious.interface';
import { OwnerLabel } from '../../../common/OwnerLabel/OwnerLabel.component';
import Table from '../../../common/Table/Table';
import { TableProfilerTab } from '../../../Database/Profiler/ProfilerDashboard/profilerDashboard.interface';
import ProfilerProgressWidget from '../../../Database/Profiler/TableProfiler/ProfilerProgressWidget/ProfilerProgressWidget';

export const TestSuites = ({ summaryPanel }: { summaryPanel: ReactNode }) => {
  const { t } = useTranslation();
  const { tab = DataQualityPageTabs.TABLES } =
    useParams<{ tab: DataQualityPageTabs }>();

  const { permissions } = usePermissionProvider();
  const { testSuite: testSuitePermission } = permissions;
  const [testSuites, setTestSuites] = useState<TestSuite[]>([]);
  const {
    currentPage,
    pageSize,
    paging,
    handlePageChange,
    handlePageSizeChange,
    handlePagingChange,
    showPagination,
  } = usePaging();

  const [isLoading, setIsLoading] = useState<boolean>(true);

  const columns = useMemo(() => {
    const data: ColumnsType<TestSuite> = [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        sorter: (a, b) => {
          if (a.executable) {
            // Sort for executable test suites
            return (
              a.executableEntityReference?.fullyQualifiedName?.localeCompare(
                b.executableEntityReference?.fullyQualifiedName ?? ''
              ) ?? 0
            );
          } else {
            // Sort for logical test suites
            return (
              a.fullyQualifiedName?.localeCompare(b.fullyQualifiedName ?? '') ??
              0
            );
          }
        },
        sortDirections: ['ascend', 'descend'],
        render: (name, record) => {
          return record.executable ? (
            <Link
              data-testid={name}
              to={{
                pathname: getTableTabPath(
                  record.executableEntityReference?.fullyQualifiedName ?? '',
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
              data-testid={name}
              to={getTestSuitePath(record.fullyQualifiedName ?? record.name)}>
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
        includeEmptyTestSuites: !(tab === DataQualityPageTabs.TABLES),
        testSuiteType:
          tab === DataQualityPageTabs.TABLES
            ? TestSuiteType.executable
            : TestSuiteType.logical,
      });
      setTestSuites(result.data);
      handlePagingChange(result.paging);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestSuitesPageChange = useCallback(
    ({ cursorType, currentPage }: PagingHandlerParams) => {
      if (isString(cursorType)) {
        fetchTestSuites({
          [cursorType]: paging?.[cursorType],
          limit: pageSize,
        });
      }
      handlePageChange(currentPage);
    },
    [pageSize, paging]
  );

  useEffect(() => {
    if (testSuitePermission?.ViewAll || testSuitePermission?.ViewBasic) {
      fetchTestSuites({ limit: pageSize });
    } else {
      setIsLoading(false);
    }
  }, [testSuitePermission, pageSize]);

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
          dataSource={testSuites}
          loading={isLoading}
          locale={{
            emptyText: <FilterTablePlaceHolder />,
          }}
          pagination={false}
          size="small"
        />
      </Col>
      <Col span={24}>
        {showPagination && (
          <NextPrevious
            currentPage={currentPage}
            pageSize={pageSize}
            paging={paging}
            pagingHandler={handleTestSuitesPageChange}
            onShowSizeChange={handlePageSizeChange}
          />
        )}
      </Col>
    </Row>
  );
};
