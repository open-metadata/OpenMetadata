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
  Table,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  AlertTriangle,
  Database01,
  ShieldTick,
} from '@openmetadata/ui-core-components/icons';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { NO_DATA_PLACEHOLDER } from '../../../../constants/constants';
import { TEST_CASE_RESOLUTION_STATUS_LABELS } from '../../../../constants/TestSuite.constant';
import { FqnPart } from '../../../../enums/entity.enum';
import {
  Assigned,
  TestCaseResolutionStatus,
  TestCaseResolutionStatusTypes,
} from '../../../../generated/tests/testCaseResolutionStatus';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { getPartialNameFromTableFQN } from '../../../../utils/FqnUtils';
import observabilityRouterClassBase from '../../../../utils/ObservabilityRouterClassBase';
import DateTimeDisplay from '../../../common/DateTimeDisplay/DateTimeDisplay';
import Loader from '../../../common/Loader/Loader';
import ProfilePicture from '../../../common/ProfilePicture/ProfilePicture';
import InlineSeverity from '../../../DataQuality/IncidentManager/Severity/InlineSeverity.component';
import { INCIDENT_STATUS_BADGE_COLORS } from './IncidentGroups.constants';
import { IncidentListProps } from './IncidentGroups.types';

const ASSIGNEE_AVATAR_WIDTH = '24';

const getAssignee = (incident: TestCaseResolutionStatus) =>
  incident.testCaseResolutionStatusType ===
  TestCaseResolutionStatusTypes.Assigned
    ? (incident.testCaseResolutionStatusDetails as Assigned | undefined)
        ?.assignee
    : undefined;

const TestCaseCell = ({ incident }: { incident: TestCaseResolutionStatus }) => {
  const fqn = incident.testCaseReference?.fullyQualifiedName ?? '';

  return (
    <Box className="tw:min-w-0 tw:max-w-120" direction="col" gap={1}>
      <Link
        className="tw:truncate tw:text-sm tw:font-medium tw:text-link"
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
      <div data-testid="incident-failure-summary">
        {incident.failureSummary ? (
          // Not the core Alert: it is a live region, and every row of the list
          // would be announced as one. Same error tokens, in the design's
          // compact callout.
          <Box
            align="start"
            className="tw:rounded-lg tw:border tw:border-error-subtle tw:bg-error-primary tw:px-3 tw:py-2"
            gap={2}>
            <AlertTriangle className="tw:mt-0.5 tw:size-4 tw:shrink-0 tw:text-fg-error-primary" />
            <Typography as="span" className="tw:text-secondary" size="text-sm">
              {incident.failureSummary}
            </Typography>
          </Box>
        ) : (
          <Typography as="span" className="tw:text-tertiary" size="text-xs">
            {NO_DATA_PLACEHOLDER}
          </Typography>
        )}
      </div>
    </Box>
  );
};

/**
 * The incidents of a group, one row each, as the drawer and the drill-down
 * both list them. Read-only: an incident is worked on from its test case,
 * which every row links to, or in bulk from the group table.
 */
const IncidentList = ({ incidents, isLoading }: IncidentListProps) => {
  const { t } = useTranslation();

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
    <Table aria-label={t('label.incident-plural')} size="sm">
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
        dependencies={[incidents, isLoading]}
        items={incidents}
        renderEmptyState={renderEmptyState}>
        {(incident) => {
          const assignee = getAssignee(incident);
          const status = incident.testCaseResolutionStatusType;
          const rowId = incident.id ?? incident.stateId;

          return (
            <Table.Row
              data-testid={`incident-row-${rowId}`}
              id={rowId}
              key={rowId}>
              <Table.Cell>
                <TestCaseCell incident={incident} />
              </Table.Cell>
              <Table.Cell className="tw:whitespace-nowrap">
                <DateTimeDisplay
                  size="compact"
                  timestamp={incident.updatedAt ?? incident.timestamp}
                />
              </Table.Cell>
              <Table.Cell>
                <span data-testid="incident-status">
                  <Badge
                    color={INCIDENT_STATUS_BADGE_COLORS[status]}
                    size="sm"
                    type="pill-color">
                    {TEST_CASE_RESOLUTION_STATUS_LABELS[status]}
                  </Badge>
                </span>
              </Table.Cell>
              <Table.Cell>
                <span data-testid="incident-severity">
                  <InlineSeverity
                    hasEditPermission={false}
                    severity={incident.severity}
                  />
                </span>
              </Table.Cell>
              <Table.Cell>
                {assignee && (
                  <Box align="center" data-testid="incident-assignee" gap={2}>
                    <ProfilePicture
                      name={assignee.name ?? ''}
                      width={ASSIGNEE_AVATAR_WIDTH}
                    />
                    <Typography as="span" size="text-sm">
                      {getEntityName(assignee)}
                    </Typography>
                  </Box>
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
