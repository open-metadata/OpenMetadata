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

import {
  Badge,
  Box,
  EmptyPlaceholder,
  OwnerChip,
  Table,
  toOwnerRef,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  AlertTriangle,
  Database01,
  ShieldTick,
} from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { TEST_CASE_RESOLUTION_STATUS_LABELS } from '../../../../constants/TestSuite.constant';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import { FqnPart } from '../../../../enums/entity.enum';
import { Operation } from '../../../../generated/entity/policies/policy';
import {
  Assigned,
  Severities,
  TestCaseResolutionStatus,
  TestCaseResolutionStatusTypes,
} from '../../../../generated/tests/testCaseResolutionStatus';
import useCustomLocation from '../../../../hooks/useCustomLocation/useCustomLocation';
import { updateTestCaseIncidentById } from '../../../../rest/incidentManagerAPI';
import {
  formatDate,
  formatDateTimeLong,
} from '../../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { getPartialNameFromTableFQN } from '../../../../utils/FqnUtils';
import observabilityRouterClassBase from '../../../../utils/ObservabilityRouterClassBase';
import { getDerivedPermissionFlags } from '../../../../utils/PermissionDerivation';
import { DEFAULT_ENTITY_PERMISSION } from '../../../../utils/PermissionsUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import Loader from '../../../common/Loader/Loader';
import InlineSeverity from '../../../DataQuality/IncidentManager/Severity/InlineSeverity.component';
import InlineTestCaseIncidentStatus from '../../../DataQuality/IncidentManager/TestCaseStatus/InlineTestCaseIncidentStatus.component';
import { useIncidentRowPermissions } from '../../../IncidentManager/useIncidentRowPermissions';
import { INCIDENT_STATUS_BADGE_COLORS } from './IncidentGroups.constants';
import { IncidentListProps } from './IncidentGroups.types';
import IncidentSeverityBadge from './IncidentSeverityBadge';

/** Time of day under the date, with the zone the stamp is read in. */
const LAST_UPDATED_TIME_FORMAT = "h:mm a '(UTC'ZZ')'";

const getAssignee = (incident: TestCaseResolutionStatus) =>
  incident.testCaseResolutionStatusType ===
  TestCaseResolutionStatusTypes.Assigned
    ? (incident.testCaseResolutionStatusDetails as Assigned | undefined)
        ?.assignee
    : undefined;

const TestCaseCell = ({ incident }: { incident: TestCaseResolutionStatus }) => {
  const { t } = useTranslation();
  const { pathname, search } = useCustomLocation();
  const fqn = incident.testCaseReference?.fullyQualifiedName ?? '';

  return (
    <Box className="tw:min-w-0 tw:max-w-96" direction="col" gap={1}>
      <Link
        className="tw:truncate tw:text-sm tw:font-medium tw:text-link"
        // The test case page reads it to lead its breadcrumb back here.
        state={{
          breadcrumbData: [
            {
              name: t('label.incident-manager'),
              // Back to the listing as it was left: its filters, its
              // dimension and any open drill-down are all in the URL.
              url: `${pathname}${search}`,
            },
          ],
        }}
        to={observabilityRouterClassBase.getTestCaseDetailPagePath(fqn)}>
        {incident.testCaseReference
          ? getEntityName(incident.testCaseReference)
          : fqn}
      </Link>
      <Box align="center" className="tw:text-tertiary" gap={1}>
        <Database01 className="tw:size-3 tw:shrink-0 tw:text-fg-quaternary" />
        <Typography as="span" data-testid="incident-table" size="text-xs">
          {getPartialNameFromTableFQN(fqn, [FqnPart.Table])}
        </Typography>
      </Box>
      {incident.failureSummary && (
        // Not the core Alert: it is a live region, and every row of the list
        // would be announced as one. Same error tokens, in the design's
        // compact callout.
        <Box
          align="start"
          className="tw:rounded-lg tw:border tw:border-error-subtle tw:bg-error-primary tw:px-3 tw:py-2"
          data-testid="incident-failure-summary"
          gap={2}>
          <AlertTriangle className="tw:mt-0.5 tw:size-4 tw:shrink-0 tw:text-fg-error-primary" />
          <Typography as="span" className="tw:text-secondary" size="text-sm">
            {incident.failureSummary}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

/**
 * The incidents of a group, one row each, as the drawer and the drill-down
 * both list them. Status and severity are edited in the row by whoever may
 * edit the incident's test case — the status chip also assigns and reassigns
 * — and read-only otherwise; `onIncidentChange` hears of every change.
 */
const IncidentList = ({
  incidents,
  isLoading,
  onIncidentChange,
}: IncidentListProps) => {
  const { t } = useTranslation();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const listData = useMemo(
    () => ({ data: incidents, isLoading }),
    [incidents, isLoading]
  );
  const { isPermissionLoading, testCasePermissions } =
    useIncidentRowPermissions({
      testCaseListData: listData,
      getEntityPermissionByFqn,
    });

  // `EditStatus` on the test case, as the incident table elsewhere gates it:
  // a role can work incidents while the test case itself stays read-only.
  const canEdit = (incident: TestCaseResolutionStatus) =>
    !isPermissionLoading &&
    getDerivedPermissionFlags(
      testCasePermissions.find(
        (permission) =>
          permission.fullyQualifiedName ===
          incident.testCaseReference?.fullyQualifiedName
      ) ?? DEFAULT_ENTITY_PERMISSION,
      false
    ).can(Operation.EditStatus);

  const handleSeveritySubmit = async (
    incident: TestCaseResolutionStatus,
    severity?: Severities
  ) => {
    try {
      await updateTestCaseIncidentById(
        incident.id ?? '',
        compare(incident, { ...incident, severity })
      );
      onIncidentChange?.();
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const columns = useMemo(
    () => [
      { id: 'testCase', label: t('label.test-case-name') },
      { id: 'lastUpdated', label: t('label.last-updated') },
      { id: 'status', label: t('label.status') },
      { id: 'severity', label: t('label.severity') },
      { id: 'assignee', label: t('label.assignee') },
    ],
    [t]
  );

  const renderEmptyState = () =>
    isLoading ? (
      <Box className="tw:py-8" data-testid="incident-list-loader">
        <Loader />
      </Box>
    ) : (
      <Box
        className="tw:relative tw:min-h-60 tw:w-full"
        data-testid="incident-list-empty">
        <EmptyPlaceholder
          icon={<ShieldTick className="tw:text-fg-brand-primary" />}
          title={t('message.no-active-incidents')}
          variant="blank"
        />
      </Box>
    );

  return (
    <Table
      aria-label={t('label.incident-plural')}
      // The page being left stays until the next one lands; dimmed, it reads
      // as on its way out rather than as the result.
      className={
        isLoading && incidents.length > 0 ? 'tw:opacity-60' : undefined
      }
      data-testid="incident-list"
      size="sm">
      <Table.Header columns={columns}>
        {(column) => (
          <Table.Head
            id={column.id}
            isRowHeader={column.id === 'testCase'}
            key={column.id}
            label={column.label}
          />
        )}
      </Table.Header>
      <Table.Body
        dependencies={[
          incidents,
          isLoading,
          isPermissionLoading,
          testCasePermissions,
        ]}
        items={incidents}
        renderEmptyState={renderEmptyState}>
        {(incident) => {
          const assignee = getAssignee(incident);
          const status = incident.testCaseResolutionStatusType;
          const rowId = incident.id ?? incident.stateId;
          const lastUpdated = incident.updatedAt ?? incident.timestamp;
          const isEditable = canEdit(incident);

          return (
            <Table.Row
              data-testid={`incident-row-${rowId}`}
              id={rowId}
              key={rowId}>
              <Table.Cell>
                <TestCaseCell incident={incident} />
              </Table.Cell>
              <Table.Cell className="tw:whitespace-nowrap">
                <Box data-testid="incident-last-updated" direction="col">
                  <Typography
                    as="span"
                    className="tw:text-primary"
                    size="text-sm">
                    {formatDate(lastUpdated)}
                  </Typography>
                  <Typography
                    as="span"
                    className="tw:text-tertiary"
                    size="text-xs">
                    {formatDateTimeLong(lastUpdated, LAST_UPDATED_TIME_FORMAT)}
                  </Typography>
                </Box>
              </Table.Cell>
              <Table.Cell>
                <span data-testid="incident-status">
                  {isEditable ? (
                    <InlineTestCaseIncidentStatus
                      hasEditPermission
                      data={incident}
                      onSubmit={() => onIncidentChange?.()}
                    />
                  ) : (
                    <Badge
                      color={INCIDENT_STATUS_BADGE_COLORS[status]}
                      size="sm"
                      type="pill-color">
                      {TEST_CASE_RESOLUTION_STATUS_LABELS[status]}
                    </Badge>
                  )}
                </span>
              </Table.Cell>
              <Table.Cell>
                <span data-testid="incident-severity">
                  {isEditable ? (
                    <InlineSeverity
                      hasEditPermission
                      severity={incident.severity}
                      onSubmit={(severity) =>
                        handleSeveritySubmit(incident, severity)
                      }
                    />
                  ) : (
                    <IncidentSeverityBadge severity={incident.severity} />
                  )}
                </span>
              </Table.Cell>
              <Table.Cell className="tw:whitespace-nowrap">
                {assignee && (
                  <span data-testid="incident-assignee">
                    <OwnerChip
                      isCompactView={false}
                      owner={toOwnerRef(assignee)}
                    />
                  </span>
                )}
              </Table.Cell>
            </Table.Row>
          );
        }}
      </Table.Body>
    </Table>
  );
};

export default IncidentList;
