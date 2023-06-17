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
import {
  Button,
  Col,
  Row,
  Select,
  Space,
  Table,
  Tooltip,
  Typography,
} from 'antd';
import { DefaultOptionType } from 'antd/lib/select';
import { ColumnsType } from 'antd/lib/table';
import { ReactComponent as IconEdit } from 'assets/svg/edit-new.svg';
import { ReactComponent as IconCheckMark } from 'assets/svg/ic-check-mark.svg';
import { ReactComponent as IconDelete } from 'assets/svg/ic-delete.svg';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import EditTestCaseModal from 'components/AddDataQualityTest/EditTestCaseModal';
import AppBadge from 'components/common/Badge/Badge.component';
import DeleteWidgetModal from 'components/common/DeleteWidget/DeleteWidgetModal';
import FilterTablePlaceHolder from 'components/common/error-with-placeholder/FilterTablePlaceHolder';
import { StatusBox } from 'components/common/LastRunGraph/LastRunGraph.component';
import NextPrevious from 'components/common/next-previous/NextPrevious';
import Searchbar from 'components/common/searchbar/Searchbar';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import { ResourceEntity } from 'components/PermissionProvider/PermissionProvider.interface';
import TestSummary from 'components/ProfilerDashboard/component/TestSummary';
import {
  getTableTabPath,
  INITIAL_PAGING_VALUE,
  PAGE_SIZE,
} from 'constants/constants';
import { NO_PERMISSION_FOR_ACTION } from 'constants/HelperTextUtil';
import { Operation } from 'generated/entity/policies/policy';
import {
  TestCase,
  TestCaseFailureStatus,
  TestCaseResult,
  TestCaseStatus,
} from 'generated/tests/testCase';
import { Paging } from 'generated/type/paging';
import { t } from 'i18next';
import { isString } from 'lodash';
import { PagingResponse } from 'Models';
import { DataQualityPageTabs } from 'pages/DataQuality/DataQualityPage.interface';
import QueryString from 'qs';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useHistory, useLocation, useParams } from 'react-router-dom';
import {
  getListTestCase,
  ListTestCaseParams,
  putTestCaseResult,
} from 'rest/testAPI';
import { getNameFromFQN } from 'utils/CommonUtils';
import { getEntityName } from 'utils/EntityUtils';
import { checkPermission } from 'utils/PermissionsUtils';
import { getDecodedFqn } from 'utils/StringsUtils';
import {
  getEntityFqnFromEntityLink,
  getTableExpandableConfig,
} from 'utils/TableUtils';
import { getFormattedDateFromSeconds } from 'utils/TimeUtils';
import { showErrorToast } from 'utils/ToastUtils';
import { DataQualitySearchParams } from '../DataQuality.interface';
import { SummaryPanel } from '../SummaryPannel/SummaryPanel.component';
import { TestCaseStatusModal } from '../TestCaseStatusModal/TestCaseStatusModal.component';
import './test-cases.style.less';

type TestCaseAction = {
  data: TestCase;
  action: 'UPDATE' | 'DELETE' | 'UPDATE_STATUS';
};

export const TestCases = () => {
  const history = useHistory();
  const location = useLocation();
  const { tab } = useParams<{ tab: DataQualityPageTabs }>();
  const { permissions } = usePermissionProvider();

  const testCaseEditPermission = useMemo(() => {
    return checkPermission(
      Operation.EditAll,
      ResourceEntity.TEST_CASE,
      permissions
    );
  }, [permissions]);

  const testCaseDeletePermission = useMemo(() => {
    return checkPermission(
      Operation.Delete,
      ResourceEntity.TEST_CASE,
      permissions
    );
  }, [permissions]);

  const params = useMemo(() => {
    const search = location.search;

    const params = QueryString.parse(
      search.startsWith('?') ? search.substring(1) : search
    );

    return params as DataQualitySearchParams;
  }, [location]);
  const { searchValue = '', status = '' } = params;

  const [testCase, setTestCase] = useState<PagingResponse<TestCase[]>>({
    data: [],
    paging: { total: 0 },
  });
  const [selectedTestCase, setSelectedTestCase] = useState<TestCaseAction>();
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
        width: 280,
        render: (_, record) => {
          const status = record.testCaseResult?.testCaseStatus;

          return (
            <Space>
              <Tooltip title={status}>
                <div>
                  <StatusBox status={status?.toLocaleLowerCase()} />
                </div>
              </Tooltip>

              <Typography.Paragraph className="m-0" style={{ maxWidth: 280 }}>
                {getEntityName(record)}
              </Typography.Paragraph>
            </Space>
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
        dataIndex: 'testCaseResult',
        key: 'resolution',
        width: 150,
        render: (value: TestCaseResult) => {
          const label = value?.testCaseFailureStatus?.testCaseFailureStatusType;

          return label ? (
            <AppBadge
              className={classNames('resolution', label.toLocaleLowerCase())}
              label={label}
            />
          ) : (
            '--'
          );
        },
      },
      {
        title: t('label.action-plural'),
        dataIndex: 'actions',
        key: 'actions',
        width: 100,
        fixed: 'right',
        render: (_, record) => {
          const status = record.testCaseResult?.testCaseStatus;

          return (
            <Row align="middle">
              <Tooltip
                placement="bottomRight"
                title={
                  testCaseEditPermission
                    ? t('label.edit')
                    : NO_PERMISSION_FOR_ACTION
                }>
                <Button
                  className="flex-center"
                  data-testid={`edit-${record.name}`}
                  disabled={!testCaseEditPermission}
                  icon={<IconEdit width={16} />}
                  type="text"
                  onClick={(e) => {
                    // preventing expand/collapse on click of edit button
                    e.stopPropagation();
                    setSelectedTestCase({ data: record, action: 'UPDATE' });
                  }}
                />
              </Tooltip>

              <Tooltip
                placement="bottomLeft"
                title={
                  testCaseDeletePermission
                    ? t('label.delete')
                    : NO_PERMISSION_FOR_ACTION
                }>
                <Button
                  className="flex-center"
                  data-testid={`delete-${record.name}`}
                  disabled={!testCaseDeletePermission}
                  icon={<IconDelete width={16} />}
                  type="text"
                  onClick={(e) => {
                    // preventing expand/collapse on click of delete button
                    e.stopPropagation();
                    setSelectedTestCase({ data: record, action: 'DELETE' });
                  }}
                />
              </Tooltip>
              {status === TestCaseStatus.Failed && (
                <Tooltip
                  placement="bottomRight"
                  title={
                    testCaseEditPermission
                      ? t('label.edit-entity', { entity: t('label.status') })
                      : NO_PERMISSION_FOR_ACTION
                  }>
                  <Button
                    className="flex-center"
                    data-testid={`update-status-${record.name}`}
                    disabled={!testCaseEditPermission}
                    icon={<IconCheckMark height={18} width={18} />}
                    type="text"
                    onClick={(e) => {
                      // preventing expand/collapse on click of edit button
                      e.stopPropagation();
                      setSelectedTestCase({
                        data: record,
                        action: 'UPDATE_STATUS',
                      });
                    }}
                  />
                </Tooltip>
              )}
            </Row>
          );
        },
      },
    ];

    return data;
  }, [testCaseEditPermission, testCaseDeletePermission, testCase]);

  const handleSearchParam = (
    value: string | boolean,
    key: keyof DataQualitySearchParams
  ) => {
    history.push({
      search: QueryString.stringify({ ...params, [key]: value }),
    });
  };

  const handleCancel = () => {
    setSelectedTestCase(undefined);
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

  const handleStatusSubmit = async (data: TestCaseFailureStatus) => {
    const updatedResult: TestCaseResult = {
      ...selectedTestCase?.data?.testCaseResult,
      testCaseFailureStatus: data,
    };
    const testCaseFqn = selectedTestCase?.data?.fullyQualifiedName ?? '';
    try {
      await putTestCaseResult(testCaseFqn, updatedResult);
      setTestCase((prev) => {
        const data = prev.data.map((test) => {
          if (test.fullyQualifiedName === testCaseFqn) {
            test.testCaseResult = updatedResult;
          }

          return test;
        });

        return { ...prev, data };
      });
      handleCancel();
    } catch (error) {
      showErrorToast(error as AxiosError);
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
      fetchTestCases();
    }
  }, [tab]);

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
          className="test-case-table-container"
          columns={columns}
          data-testid="test-case-table"
          dataSource={testCase.data}
          expandable={{
            ...getTableExpandableConfig<TestCase>(),
            expandRowByClick: true,
            rowExpandable: () => true,
            expandedRowRender: (recode) => <TestSummary data={recode} />,
          }}
          loading={isLoading}
          locale={{
            emptyText: <FilterTablePlaceHolder />,
          }}
          pagination={false}
          rowKey="name"
          scroll={{ x: 1300 }}
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
      <Col span={24}>
        <EditTestCaseModal
          testCase={selectedTestCase?.data as TestCase}
          visible={selectedTestCase?.action === 'UPDATE'}
          onCancel={handleCancel}
          onUpdate={fetchTestCases}
        />

        <TestCaseStatusModal
          data={selectedTestCase?.data?.testCaseResult?.testCaseFailureStatus}
          open={selectedTestCase?.action === 'UPDATE_STATUS'}
          onCancel={handleCancel}
          onSubmit={handleStatusSubmit}
        />

        <DeleteWidgetModal
          afterDeleteAction={fetchTestCases}
          allowSoftDelete={false}
          entityId={selectedTestCase?.data?.id ?? ''}
          entityName={selectedTestCase?.data?.name ?? ''}
          entityType="testCase"
          visible={selectedTestCase?.action === 'DELETE'}
          onCancel={handleCancel}
        />
      </Col>
    </Row>
  );
};
