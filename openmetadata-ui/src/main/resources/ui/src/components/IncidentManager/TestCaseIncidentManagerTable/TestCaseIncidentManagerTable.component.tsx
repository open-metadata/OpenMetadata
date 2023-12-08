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
import { Col, Row, Space, Tooltip } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { sortBy } from 'lodash';
import QueryString from 'qs';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  getTableTabPath,
  NO_DATA_PLACEHOLDER,
} from '../../../constants/constants';
import { Operation } from '../../../generated/entity/policies/policy';
import { EntityReference } from '../../../generated/entity/type';
import {
  Severities,
  TestCase,
  TestCaseResolutionStatus,
  TestCaseResult,
  TestCaseStatus,
} from '../../../generated/tests/testCase';
import { patchTestCaseResult } from '../../../rest/testAPI';
import { getNameFromFQN } from '../../../utils/CommonUtils';
import { formatDateTime } from '../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { checkPermission } from '../../../utils/PermissionsUtils';
import { getIncidentManagerDetailPagePath } from '../../../utils/RouterUtils';
import { getEncodedFqn, replacePlus } from '../../../utils/StringsUtils';
import { getEntityFqnFromEntityLink } from '../../../utils/TableUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import FilterTablePlaceHolder from '../../common/ErrorWithPlaceholder/FilterTablePlaceHolder';
import { StatusBox } from '../../common/LastRunGraph/LastRunGraph.component';
import NextPrevious from '../../common/NextPrevious/NextPrevious';
import { OwnerLabel } from '../../common/OwnerLabel/OwnerLabel.component';
import Table from '../../common/Table/Table';
import { usePermissionProvider } from '../../PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../PermissionProvider/PermissionProvider.interface';
import { TableProfilerTab } from '../../ProfilerDashboard/profilerDashboard.interface';
import '../incident-manager.style.less';
import Severity from '../Severity/Severity.component';
import TestCaseIncidentManagerStatus from '../TestCaseStatus/TestCaseIncidentManagerStatus.component';
import { TestCaseIncidentManagerTableProps } from './TestCaseIncidentManagerTable.interface';

const TestCaseIncidentManagerTable = ({
  testCaseListData,
  pagingData,
  showPagination,
  handleTestCaseUpdate,
}: TestCaseIncidentManagerTableProps) => {
  const { t } = useTranslation();
  const { permissions } = usePermissionProvider();

  const testCaseEditPermission = useMemo(() => {
    return checkPermission(
      Operation.EditAll,
      ResourceEntity.TEST_CASE,
      permissions
    );
  }, [permissions]);

  const sortedData = useMemo(
    () =>
      sortBy(testCaseListData.data, (test) => {
        switch (test.testCaseResult?.testCaseStatus) {
          case TestCaseStatus.Failed:
            return 0;
          case TestCaseStatus.Aborted:
            return 1;
          case TestCaseStatus.Success:
            return 2;

          default:
            return 3;
        }
      }),
    [testCaseListData.data]
  );

  const handlePatchTestCaseResult = async (
    record: TestCase,
    updatedResult: TestCaseResult
  ): Promise<void> => {
    if (record.testCaseResult) {
      const timestamp = record.testCaseResult?.timestamp ?? 0;
      const patch = compare(record.testCaseResult, updatedResult);
      try {
        await patchTestCaseResult({
          testCaseFqn: record.fullyQualifiedName ?? '',
          patch,
          timestamp,
        });

        handleTestCaseUpdate({
          ...record,
          testCaseResult: updatedResult,
        });
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    }

    return;
  };

  const handleSeveritySubmit = async (
    severity: Severities,
    record: TestCase
  ) => {
    if (
      record.testCaseResult &&
      record.testCaseResult.testCaseResolutionStatusReference
        ?.testCaseResolutionStatusType
    ) {
      handlePatchTestCaseResult(record, {
        ...record.testCaseResult,
        testCaseResolutionStatusReference: {
          ...record.testCaseResult?.testCaseResolutionStatusReference,
          severity,
        },
      });
    }

    return;
  };

  const handleStatusSubmit = async (
    updatedData: TestCaseResolutionStatus,
    record: TestCase
  ) =>
    handlePatchTestCaseResult(record, {
      ...record.testCaseResult,
      testCaseResolutionStatusReference: updatedData,
    });

  const columns: ColumnsType<TestCase> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        width: 300,
        fixed: 'left',
        render: (_, record) => {
          const status = record.testCaseResult?.testCaseStatus;

          return (
            <Space data-testid={record.name}>
              <Tooltip title={status}>
                <div>
                  <StatusBox status={status?.toLocaleLowerCase()} />
                </div>
              </Tooltip>

              <Link
                className="m-0 break-all text-primary"
                data-testid={`test-case-${record.name}`}
                style={{ maxWidth: 280 }}
                to={getIncidentManagerDetailPagePath(
                  record.fullyQualifiedName ?? ''
                )}>
                {getEntityName(record)}
              </Link>
            </Space>
          );
        },
      },
      {
        title: t('label.table'),
        dataIndex: 'entityLink',
        key: 'table',
        width: 150,
        render: (entityLink: string) => {
          const tableFqn = getEntityFqnFromEntityLink(entityLink);
          const name = getNameFromFQN(tableFqn);

          return (
            <Link
              data-testid="table-link"
              to={{
                pathname: getTableTabPath(getEncodedFqn(tableFqn), 'profiler'),
                search: QueryString.stringify({
                  activeTab: TableProfilerTab.DATA_QUALITY,
                }),
              }}
              onClick={(e) => e.stopPropagation()}>
              {name}
            </Link>
          );
        },
      },
      {
        title: t('label.test-suite'),
        dataIndex: 'testSuite',
        key: 'testSuite',
        width: 300,
        render: (testSuite: EntityReference) =>
          getEntityName(testSuite) ?? NO_DATA_PLACEHOLDER,
      },
      {
        title: t('label.column'),
        dataIndex: 'entityLink',
        key: 'column',
        width: 150,
        render: (entityLink: string) => {
          const isColumn = entityLink.includes('::columns::');
          if (isColumn) {
            const name = getNameFromFQN(
              replacePlus(getEntityFqnFromEntityLink(entityLink, isColumn))
            );

            return name;
          }

          return NO_DATA_PLACEHOLDER;
        },
      },
      {
        title: t('label.execution-time'),
        dataIndex: 'executionTime',
        key: 'executionTime',
        width: 150,
        render: (result: TestCaseResult) =>
          result?.timestamp ? formatDateTime(result.timestamp) : '--',
      },
      {
        title: t('label.status'),
        dataIndex: 'testCaseResult',
        key: 'testCaseResult',
        width: 100,
        render: (value: TestCaseResult, record: TestCase) => (
          <TestCaseIncidentManagerStatus
            testCaseResult={value}
            onSubmit={(status) => handleStatusSubmit(status, record)}
          />
        ),
      },
      {
        title: t('label.severity'),
        dataIndex: 'testCaseResult',
        key: 'testCaseResult',
        width: 150,
        render: (value: TestCaseResult, record) => {
          const { testCaseResolutionStatusReference } = value;

          return (
            <Severity
              severity={testCaseResolutionStatusReference?.severity}
              onSubmit={(severity) => handleSeveritySubmit(severity, record)}
            />
          );
        },
      },
      {
        title: t('label.assignee'),
        dataIndex: 'assignee',
        key: 'assignee',
        width: 150,
        render: (assignee: EntityReference) => <OwnerLabel owner={assignee} />,
      },
      {
        title: t('label.reviewer'),
        dataIndex: 'reviewer',
        key: 'reviewer',
        render: (owner: EntityReference) => <OwnerLabel owner={owner} />,
      },
    ],
    [testCaseEditPermission, testCaseListData.data]
  );

  return (
    <Row gutter={[16, 16]}>
      <Col span={24}>
        <Table
          bordered
          className="test-case-table-container"
          columns={columns}
          data-testid="test-case-incident-manager-table"
          dataSource={sortedData}
          loading={testCaseListData.isLoading}
          locale={{
            emptyText: <FilterTablePlaceHolder />,
          }}
          pagination={false}
          rowKey="id"
          scroll={{ x: 1600 }}
          size="small"
        />
      </Col>
      <Col span={24}>
        {pagingData && showPagination && <NextPrevious {...pagingData} />}
      </Col>
      <Col />
    </Row>
  );
};

export default TestCaseIncidentManagerTable;
