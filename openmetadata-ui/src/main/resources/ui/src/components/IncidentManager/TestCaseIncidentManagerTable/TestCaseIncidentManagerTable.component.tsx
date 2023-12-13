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
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import QueryString from 'qs';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getTableTabPath } from '../../../constants/constants';
import { EntityTabs, FqnPart } from '../../../enums/entity.enum';
import { Operation } from '../../../generated/entity/policies/policy';
import { EntityReference } from '../../../generated/entity/type';
import {
  Severities,
  TestCaseResolutionStatus,
} from '../../../generated/tests/testCase';
import { Assigned } from '../../../generated/tests/testCaseResolutionStatus';
import { updateTestCaseIncidentById } from '../../../rest/incidentManagerAPI';
import {
  getNameFromFQN,
  getPartialNameFromTableFQN,
} from '../../../utils/CommonUtils';
import { formatDateTime } from '../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { checkPermission } from '../../../utils/PermissionsUtils';
import { getIncidentManagerDetailPagePath } from '../../../utils/RouterUtils';
import { getEncodedFqn } from '../../../utils/StringsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import FilterTablePlaceHolder from '../../common/ErrorWithPlaceholder/FilterTablePlaceHolder';
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
    //   ...record.testCaseResult,
    //   testCaseResolutionStatusReference: updatedData,
    // });
  };

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
        render: (value?: Assigned) => (
          <OwnerLabel
            owner={value?.assignee}
            placeHolder={t('label.no-entity', { entity: t('label.assignee') })}
          />
        ),
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
