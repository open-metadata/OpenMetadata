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
import { Col, Row, Space, Tooltip, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import { Operation } from '../../../generated/entity/policies/policy';
import { EntityReference } from '../../../generated/entity/type';
import {
  Severities,
  TestCase,
  TestCaseResolutionStatus,
  TestCaseResult,
} from '../../../generated/tests/testCase';
import { Assigned } from '../../../generated/tests/testCaseResolutionStatus';
import { updateTestCaseIncidentById } from '../../../rest/incidentManagerAPI';
import { formatDateTime } from '../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { checkPermission } from '../../../utils/PermissionsUtils';
import { getIncidentManagerDetailPagePath } from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import FilterTablePlaceHolder from '../../common/ErrorWithPlaceholder/FilterTablePlaceHolder';
import { StatusBox } from '../../common/LastRunGraph/LastRunGraph.component';
import NextPrevious from '../../common/NextPrevious/NextPrevious';
import { OwnerLabel } from '../../common/OwnerLabel/OwnerLabel.component';
import Table from '../../common/Table/Table';
import { usePermissionProvider } from '../../PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../PermissionProvider/PermissionProvider.interface';
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

  const handlePatchTestCaseResult = async (
    record: TestCase,
    updatedResult: TestCaseResult
  ): Promise<void> => {
    // if (record.testCaseResult) {
    //   const timestamp = record.testCaseResult?.timestamp ?? 0;
    //   const patch = compare(record.testCaseResult, updatedResult);
    //   try {
    //     await patchTestCaseResult({
    //       testCaseFqn: record.fullyQualifiedName ?? '',
    //       patch,
    //       timestamp,
    //     });

    //     handleTestCaseUpdate({
    //       ...record,
    //       testCaseResult: updatedResult,
    //     });
    //   } catch (error) {
    //     showErrorToast(error as AxiosError);
    //   }
    // }

    return;
  };

  const handleSeveritySubmit = async (
    severity: Severities,
    record: TestCaseResolutionStatus
  ) => {
    const updatedData = { ...record, severity };
    const patch = compare(record, updatedData);
    try {
      await updateTestCaseIncidentById(record.id ?? '', patch);

      handleTestCaseUpdate(updatedData);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleStatusSubmit = async (
    updatedData: TestCaseResolutionStatus,
    record: TestCaseResolutionStatus
  ) => {
    // handlePatchTestCaseResult(record, {
    //     ...record.testCaseResult,
    //     testCaseResolutionStatusReference: updatedData,
    //   });
  };

  const columns: ColumnsType<TestCaseResolutionStatus> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        width: 300,
        fixed: 'left',
        render: (_, record) => {
          const status = record.testCaseResolutionStatusType;

          return (
            <Space data-testid={record.testCaseReference?.name}>
              <Tooltip title={status}>
                <div>
                  <StatusBox status={status?.toLocaleLowerCase()} />
                </div>
              </Tooltip>

              <Link
                className="m-0 break-all text-primary"
                data-testid={`test-case-${record.testCaseReference?.name}`}
                style={{ maxWidth: 280 }}
                to={getIncidentManagerDetailPagePath(
                  record.testCaseReference?.fullyQualifiedName ?? ''
                )}>
                {getEntityName(record.testCaseReference)}
              </Link>
            </Space>
          );
        },
      },
      {
        title: t('label.table'),
        dataIndex: 'testCaseReference',
        key: 'testCaseReference',
        width: 150,
        render: (value: EntityReference) => {
          //   const tableFqn = getEntityFqnFromEntityLink(value);
          //   const name = getNameFromFQN(tableFqn);

          //   return (
          //     <Link
          //       data-testid="table-link"
          //       to={{
          //         pathname: getTableTabPath(getEncodedFqn(tableFqn), 'profiler'),
          //         search: QueryString.stringify({
          //           activeTab: TableProfilerTab.DATA_QUALITY,
          //         }),
          //       }}
          //       onClick={(e) => e.stopPropagation()}>
          //       {name}
          //     </Link>

          //          );

          return <Typography.Text>{value.fullyQualifiedName}</Typography.Text>;
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
            onSubmit={(status) => handleStatusSubmit(status, record)}
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
        render: (value?: Assigned) => <OwnerLabel owner={value?.assignee} />,
      },
      {
        title: t('label.reviewer'),
        dataIndex: 'testCaseResolutionStatusDetails',
        key: 'testCaseResolutionStatusDetails',
        render: (value?: Assigned) => <OwnerLabel owner={value?.reviewer} />,
      },
    ],
    [testCaseEditPermission]
  );

  return (
    <Row gutter={[16, 16]}>
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
