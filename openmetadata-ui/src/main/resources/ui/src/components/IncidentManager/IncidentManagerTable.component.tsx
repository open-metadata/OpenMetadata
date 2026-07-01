/*
 *  Copyright 2026 Collate.
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
import { Skeleton, Table } from '@openmetadata/ui-core-components';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { EntityTabs, EntityType, FqnPart } from '../../enums/entity.enum';
import { Table as TableType } from '../../generated/entity/data/table';
import { EntityReference } from '../../generated/tests/testCase';
import {
  Assigned,
  Severities,
  TestCaseResolutionStatus,
} from '../../generated/tests/testCaseResolutionStatus';
import { TestCaseIncidentStatusData } from '../../pages/IncidentManager/IncidentManager.interface';
import { getEntityName } from '../../utils/EntityNameUtils';
import {
  getNameFromFQN,
  getPartialNameFromTableFQN,
} from '../../utils/FqnUtils';
import observabilityRouterClassBase from '../../utils/ObservabilityRouterClassBase';
import { getEntityDetailsPath } from '../../utils/RouterUtils';
import DateTimeDisplay from '../common/DateTimeDisplay/DateTimeDisplay';
import FilterTablePlaceHolder from '../common/ErrorWithPlaceholder/FilterTablePlaceHolder';
import NextPrevious from '../common/NextPrevious/NextPrevious';
import { NextPreviousProps } from '../common/NextPrevious/NextPrevious.interface';
import { OwnerLabel } from '../common/OwnerLabel/OwnerLabel.component';
import {
  ProfilerTabPath,
  TestCasePermission,
} from '../Database/Profiler/ProfilerDashboard/profilerDashboard.interface';
import Severity from '../DataQuality/IncidentManager/Severity/Severity.component';
import TestCaseIncidentManagerStatus from '../DataQuality/IncidentManager/TestCaseStatus/TestCaseIncidentManagerStatus.component';

export interface IncidentManagerTableProps {
  isIncidentPage: boolean;
  tableDetails?: TableType;
  testCaseListData: TestCaseIncidentStatusData;
  isPermissionLoading: boolean;
  testCasePermissions: TestCasePermission[];
  showPagination: boolean;
  pagingData: NextPreviousProps;
  handleStatusSubmit: (value: TestCaseResolutionStatus) => void;
  handleSeveritySubmit: (
    record: TestCaseResolutionStatus,
    severity?: Severities
  ) => Promise<void>;
  handleAssigneeUpdate: (
    record: TestCaseResolutionStatus,
    assignee?: EntityReference[]
  ) => Promise<void>;
}

const IncidentManagerTable = ({
  isIncidentPage,
  tableDetails,
  testCaseListData,
  isPermissionLoading,
  testCasePermissions,
  showPagination,
  pagingData,
  handleStatusSubmit,
  handleSeveritySubmit,
  handleAssigneeUpdate,
}: IncidentManagerTableProps) => {
  const { t } = useTranslation();

  const testCaseResolutionStatusDetailsRender = (
    value?: Assigned,
    record?: TestCaseResolutionStatus
  ) => {
    if (isPermissionLoading) {
      return <Skeleton height={24} variant="rectangular" width={100} />;
    }

    const hasPermission = testCasePermissions.find(
      (item) =>
        item.fullyQualifiedName ===
        record?.testCaseReference?.fullyQualifiedName
    );

    return (
      <div data-testid="assignee">
        <OwnerLabel
          isCompactView
          className="m-0"
          hasPermission={hasPermission?.EditAll && !tableDetails?.deleted}
          multiple={{
            user: false,
            team: false,
          }}
          owners={value?.assignee ? [value.assignee] : []}
          placeHolder={t('label.no-entity', {
            entity: t('label.assignee'),
          })}
          tooltipText={t('label.edit-entity', {
            entity: t('label.assignee'),
          })}
          onUpdate={(assignees) =>
            record && handleAssigneeUpdate(record, assignees)
          }
        />
      </div>
    );
  };

  const columns = useMemo(
    () => [
      { id: 'name', label: t('label.test-case-name') },
      ...(isIncidentPage
        ? [{ id: 'testCaseReference', label: t('label.table') }]
        : []),
      { id: 'timestamp', label: t('label.last-updated') },
      { id: 'testCaseResolutionStatusType', label: t('label.status') },
      { id: 'severity', label: t('label.severity') },
      { id: 'testCaseResolutionStatusDetails', label: t('label.assignee') },
    ],
    [isIncidentPage, t]
  );

  const loadingSkeletons = useMemo(
    () => (
      <div className="tw:p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton className="tw:mb-2" height={40} key={i} width="100%" />
        ))}
      </div>
    ),
    []
  );

  const renderRow = (record: TestCaseResolutionStatus) => {
    const ref = record.testCaseReference;
    const tableFqn = getPartialNameFromTableFQN(
      ref?.fullyQualifiedName ?? '',
      [FqnPart.Service, FqnPart.Database, FqnPart.Schema, FqnPart.Table],
      '.'
    );
    const hasPermission = testCasePermissions.find(
      (item) => item.fullyQualifiedName === ref?.fullyQualifiedName
    );

    return (
      <Table.Row id={record.id ?? ''} key={record.id}>
        <Table.Cell>
          <Link
            className="tw:m-0 tw:break-all tw:text-primary"
            data-testid={`test-case-${ref?.name}`}
            to={observabilityRouterClassBase.getTestCaseDetailPagePath(
              ref?.fullyQualifiedName ?? ''
            )}>
            {getEntityName(ref)}
          </Link>
        </Table.Cell>
        {isIncidentPage && (
          <Table.Cell>
            <Link
              data-testid="table-link"
              to={getEntityDetailsPath(
                EntityType.TABLE,
                tableFqn,
                EntityTabs.PROFILER,
                ProfilerTabPath.DATA_QUALITY
              )}
              onClick={(e) => e.stopPropagation()}>
              {getNameFromFQN(tableFqn) ?? ref?.fullyQualifiedName}
            </Link>
          </Table.Cell>
        )}
        <Table.Cell>
          <DateTimeDisplay
            size="compact"
            timestamp={record.timestamp as number}
          />
        </Table.Cell>
        <Table.Cell>
          {isPermissionLoading ? (
            <Skeleton height={24} variant="rectangular" width={100} />
          ) : (
            <TestCaseIncidentManagerStatus
              isInline
              data={record}
              hasPermission={hasPermission?.EditAll && !tableDetails?.deleted}
              onSubmit={handleStatusSubmit}
            />
          )}
        </Table.Cell>
        <Table.Cell>
          {isPermissionLoading ? (
            <Skeleton height={24} variant="rectangular" width={100} />
          ) : (
            <Severity
              isInline
              hasPermission={hasPermission?.EditAll && !tableDetails?.deleted}
              severity={record.severity}
              onSubmit={(severity) => handleSeveritySubmit(record, severity)}
            />
          )}
        </Table.Cell>
        <Table.Cell>
          {testCaseResolutionStatusDetailsRender(
            record.testCaseResolutionStatusDetails as Assigned | undefined,
            record
          )}
        </Table.Cell>
      </Table.Row>
    );
  };

  return (
    <>
      <Table
        aria-label={t('label.incident-manager')}
        data-testid="test-case-incident-manager-table"
        size="sm">
        <Table.Header columns={columns}>
          {(col) => <Table.Head id={col.id} key={col.id} label={col.label} />}
        </Table.Header>
        <Table.Body
          dependencies={[
            isPermissionLoading,
            testCasePermissions,
            testCaseListData.data,
            tableDetails?.deleted,
          ]}
          items={testCaseListData.isLoading ? [] : testCaseListData.data}
          renderEmptyState={() =>
            testCaseListData.isLoading ? (
              loadingSkeletons
            ) : (
              <FilterTablePlaceHolder
                placeholderText={t('message.no-incident-found')}
              />
            )
          }>
          {(record) => renderRow(record)}
        </Table.Body>
      </Table>
      {pagingData && showPagination && <NextPrevious {...pagingData} />}
    </>
  );
};

export default IncidentManagerTable;
