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
import { Col, Row, Select, Space, Switch, Table, Typography } from 'antd';
import { DefaultOptionType } from 'antd/lib/select';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import FilterTablePlaceHolder from 'components/common/error-with-placeholder/FilterTablePlaceHolder';
import NextPrevious from 'components/common/next-previous/NextPrevious';
import Searchbar from 'components/common/searchbar/Searchbar';
import {
  getTableTabPath,
  INITIAL_PAGING_VALUE,
  PAGE_SIZE,
} from 'constants/constants';
import {
  TestCase,
  TestCaseResult,
  TestCaseStatus,
} from 'generated/tests/testCase';
import { Include } from 'generated/type/include';
import { Paging } from 'generated/type/paging';
import { t } from 'i18next';
import { isString } from 'lodash';
import { PagingResponse } from 'Models';
import { DataQualityPageTabs } from 'pages/DataQuality/DataQualityPage.interface';
import QueryString from 'qs';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useHistory, useLocation, useParams } from 'react-router-dom';
import { getListTestCase, ListTestCaseParams } from 'rest/testAPI';
import { getNameFromFQN } from 'utils/CommonUtils';
import { getEntityName } from 'utils/EntityUtils';
import { getDecodedFqn } from 'utils/StringsUtils';
import { getEntityFqnFromEntityLink } from 'utils/TableUtils';
import { getFormattedDateFromSeconds } from 'utils/TimeUtils';
import { showErrorToast } from 'utils/ToastUtils';
import { DataQualitySearchParams } from '../DataQuality.interface';
import { SummaryPanel } from '../SummaryPannel/SummaryPanel.component';

export const TestCases = () => {
  const history = useHistory();
  const location = useLocation();
  const { tab } = useParams<{ tab: DataQualityPageTabs }>();

  const params = useMemo(() => {
    const search = location.search;

    const params = QueryString.parse(
      search.startsWith('?') ? search.substring(1) : search
    );

    return params as DataQualitySearchParams;
  }, [location]);
  const { searchValue = '', status = '', deleted } = params;
  const isDeleted = deleted === 'true';

  const [testCase, setTestCase] = useState<PagingResponse<TestCase[]>>({
    data: [],
    paging: { total: 0 },
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState(INITIAL_PAGING_VALUE);

  const statusOption = useMemo(() => {
    const testCaseStatus: DefaultOptionType[] = Object.values(
      TestCaseStatus
    ).map((value) => ({
      label: value,
      value: value,
    }));
    testCaseStatus.unshift({
      label: t('label.all'),
      value: '',
    });

    return testCaseStatus;
  }, []);

  const columns = useMemo(() => {
    const data: ColumnsType<TestCase> = [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        width: 250,
        render: (_, record) => {
          return (
            <Typography.Paragraph>{getEntityName(record)}</Typography.Paragraph>
          );
        },
      },
      {
        title: t('label.test-suite'),
        dataIndex: 'testSuite',
        key: 'testSuite',
        width: 250,
        render: (value) => {
          return (
            <Typography.Paragraph>{getEntityName(value)}</Typography.Paragraph>
          );
        },
      },
      {
        title: t('label.table'),
        dataIndex: 'entityLink',
        key: 'table',
        width: 150,
        render: (entityLink) => {
          const tableFqn = getEntityFqnFromEntityLink(entityLink);
          const name = getNameFromFQN(tableFqn);

          return (
            <Link
              data-testid="table-link"
              to={getTableTabPath(tableFqn, 'profiler')}
              onClick={(e) => e.stopPropagation()}>
              {name}
            </Link>
          );
        },
      },
      {
        title: t('label.column'),
        dataIndex: 'entityLink',
        key: 'column',
        width: 150,
        render: (entityLink) => {
          const isColumn = entityLink.includes('::columns::');

          if (isColumn) {
            const name = getNameFromFQN(
              getDecodedFqn(
                getEntityFqnFromEntityLink(entityLink, isColumn),
                true
              )
            );

            return name;
          }

          return '--';
        },
      },
      {
        title: t('label.last-run'),
        dataIndex: 'testCaseResult',
        key: 'lastRun',
        width: 150,
        render: (result: TestCaseResult) =>
          result?.timestamp
            ? getFormattedDateFromSeconds(
                result.timestamp,
                'MMM dd, yyyy HH:mm'
              )
            : '--',
      },
      {
        title: 'Resolution',
        dataIndex: 'resolution',
        key: 'resolution',
        width: 150,
        render: () => '--',
      },
    ];

    return data;
  }, []);

  const handleSearchParam = (
    value: string | boolean,
    key: keyof DataQualitySearchParams
  ) => {
    history.push({
      search: QueryString.stringify({ ...params, [key]: value }),
    });
  };

  const fetchTestCases = async (params?: ListTestCaseParams) => {
    setIsLoading(true);
    try {
      const response = await getListTestCase({
        ...params,
        fields: 'testDefinition,testCaseResult,testSuite',
      });
      setTestCase(response);
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
    const { paging } = testCase;
    if (isString(cursorValue)) {
      fetchTestCases({ [cursorValue]: paging?.[cursorValue as keyof Paging] });
    }
    activePage && setCurrentPage(activePage);
  };

  useEffect(() => {
    if (tab === DataQualityPageTabs.TEST_CASES) {
      fetchTestCases({
        include: isDeleted ? Include.Deleted : Include.NonDeleted,
      });
    }
  }, [tab, isDeleted]);

  return (
    <Row className="p-x-lg p-t-md" gutter={[16, 16]}>
      <Col span={24}>
        <Row justify="space-between">
          <Col span={8}>
            <Searchbar
              removeMargin
              searchValue={searchValue}
              onSearch={(value) => handleSearchParam(value, 'searchValue')}
            />
          </Col>
          <Col>
            <Space size={12}>
              <div>
                <Typography.Text className="text-grey-muted">
                  {t('label.deleted')}
                </Typography.Text>{' '}
                <Switch
                  checked={isDeleted}
                  onChange={(value) => handleSearchParam(value, 'deleted')}
                />
              </div>
              <Select
                className="w-32"
                options={statusOption}
                placeholder={t('label.status')}
                value={status}
                onChange={(value) => handleSearchParam(value, 'status')}
              />
            </Space>
          </Col>
        </Row>
      </Col>
      <Col span={24}>
        <SummaryPanel />
      </Col>
      <Col span={24}>
        <Table
          bordered
          columns={columns}
          data-testid="test-case-table"
          dataSource={testCase.data}
          loading={isLoading}
          locale={{
            emptyText: <FilterTablePlaceHolder />,
          }}
          pagination={false}
          scroll={{ x: 1500 }}
          size="small"
        />
      </Col>
      <Col span={24}>
        {testCase.paging.total > PAGE_SIZE && (
          <NextPrevious
            currentPage={currentPage}
            pageSize={PAGE_SIZE}
            paging={testCase.paging}
            pagingHandler={handlePagingClick}
            totalCount={testCase.paging.total}
          />
        )}
      </Col>
    </Row>
  );
};
