/*
 *  Copyright 2024 Collate.
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
  Skeleton,
  Tooltip,
  TooltipTrigger,
  Typography,
} from '@openmetadata/ui-core-components';
import { isUndefined } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as InternalLinkIcon } from '../../../../assets/svg/InternalIcons.svg';
import { EntityTabs, EntityType } from '../../../../enums/entity.enum';
import { HeaderDotSeparator } from '../../../../utils/DataAssetsHeader.utils';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { getNameFromFQN } from '../../../../utils/FqnUtils';
import { getEntityDetailsPath } from '../../../../utils/RouterUtils';
import { DomainLabel } from '../../../common/DomainLabel/DomainLabel.component';
import { OwnerLabel } from '../../../common/OwnerLabel/OwnerLabel.component';
import { ProfilerTabPath } from '../../../Database/Profiler/ProfilerDashboard/profilerDashboard.interface';
import Severity from '../Severity/Severity.component';
import TestCaseIncidentManagerStatus from '../TestCaseStatus/TestCaseIncidentManagerStatus.component';
import './incident-manager.less';
import { IncidentManagerPageHeaderProps } from './IncidentManagerPageHeader.interface';
import { useTestCaseIncidentHeader } from './useTestCaseIncidentHeader';

const HeaderField = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="tw:flex tw:flex-col tw:gap-1.5">
    <Typography
      as="span"
      className="tw:whitespace-nowrap tw:text-secondary"
      size="text-sm"
      weight="medium">
      {label}
    </Typography>
    {children}
  </div>
);

const HeaderFieldValue = ({
  dataTestId,
  children,
}: {
  dataTestId?: string;
  children: React.ReactNode;
}) => (
  <Typography
    as="span"
    className="tw:whitespace-nowrap tw:text-primary"
    data-testid={dataTestId}
    size="text-sm"
    weight="medium">
    {children}
  </Typography>
);

const IncidentManagerPageHeader = ({
  onOwnerUpdate,
  fetchTaskCount,
  isVersionPage = false,
}: IncidentManagerPageHeaderProps) => {
  const { t } = useTranslation();
  const {
    testCaseData,
    testCaseStatusData,
    isLoading,
    taskLinkInfo,
    ownerDisplayName,
    ownerRef,
    columnName,
    tableFqn,
    dimensionKey,
    hasEditStatusPermission,
    hasEditOwnerPermission,
    hasEditDomainPermission,
    canAddMultipleUserOwners,
    canAddMultipleTeamOwner,
    handleSeverityUpdate,
    handleAssigneeUpdate,
    handleDomainUpdate,
    onIncidentStatusUpdate,
  } = useTestCaseIncidentHeader({ fetchTaskCount, isVersionPage });

  const statusDetails = useMemo(() => {
    if (isLoading) {
      return <Skeleton height={24} variant="rounded" width={160} />;
    }

    if (isUndefined(testCaseStatusData)) {
      return (
        <>
          <HeaderDotSeparator />
          <HeaderField label={t('label.incident-status')}>
            <HeaderFieldValue>
              {t('label.no-entity', { entity: t('label.incident') })}
            </HeaderFieldValue>
          </HeaderField>
        </>
      );
    }

    const details = testCaseStatusData?.testCaseResolutionStatusDetails;

    return (
      <>
        {taskLinkInfo && (
          <>
            <HeaderDotSeparator />
            <HeaderField label={t('label.incident')}>
              <Link
                className="no-underline domain-link-text tw:flex tw:items-center tw:gap-1 tw:text-sm tw:font-medium"
                data-testid="incident-task-link"
                to={taskLinkInfo.path}>
                {taskLinkInfo.label}
                <InternalLinkIcon className="text-grey-muted" width="14px" />
              </Link>
            </HeaderField>
          </>
        )}
        <HeaderDotSeparator />
        <TestCaseIncidentManagerStatus
          newLook
          data={testCaseStatusData}
          hasPermission={hasEditStatusPermission}
          headerName={t('label.incident-status')}
          onSubmit={onIncidentStatusUpdate}
        />
        <HeaderDotSeparator />
        <div className="tw:min-w-0" data-testid="assignee">
          <OwnerLabel
            className="header-owner-heading"
            hasPermission={hasEditStatusPermission}
            isCompactView={false}
            multiple={{
              user: false,
              team: false,
            }}
            owners={details?.assignee ? [details.assignee] : []}
            placeHolder={t('label.assignee')}
            tooltipText={t('label.edit-entity', {
              entity: t('label.assignee'),
            })}
            onUpdate={handleAssigneeUpdate}
          />
        </div>
        <HeaderDotSeparator />
        <Severity
          newLook
          hasPermission={hasEditStatusPermission}
          headerName={t('label.severity')}
          severity={testCaseStatusData.severity}
          onSubmit={handleSeverityUpdate}
        />
      </>
    );
  }, [testCaseStatusData, isLoading, taskLinkInfo, hasEditStatusPermission]);

  return (
    <div className="incident-manager-header w-full">
      <DomainLabel
        headerLayout
        showDashPlaceholder
        domains={testCaseData?.domains}
        entityFqn={testCaseData?.fullyQualifiedName ?? ''}
        entityId={testCaseData?.id ?? ''}
        entityType={EntityType.TEST_CASE}
        hasPermission={hasEditDomainPermission}
        multiple={false}
        textClassName="render-domain-lebel-style"
        onUpdate={handleDomainUpdate}
      />
      <HeaderDotSeparator />
      <OwnerLabel
        showDashPlaceholder
        avatarSize={24}
        className="header-owner-heading"
        hasPermission={hasEditOwnerPermission}
        isCompactView={false}
        maxVisibleOwners={3}
        multiple={{
          user: canAddMultipleUserOwners,
          team: canAddMultipleTeamOwner,
        }}
        ownerDisplayName={ownerDisplayName}
        owners={testCaseData?.owners ?? ownerRef}
        onUpdate={onOwnerUpdate}
      />
      {!isVersionPage && statusDetails}
      {tableFqn && (
        <>
          <HeaderDotSeparator />
          <HeaderField label={t('label.table')}>
            <Link
              className="no-underline domain-link-text tw:flex tw:items-center tw:gap-1 tw:text-sm tw:font-medium"
              data-testid="table-name"
              to={getEntityDetailsPath(
                EntityType.TABLE,
                tableFqn,
                EntityTabs.PROFILER,
                ProfilerTabPath.DATA_QUALITY
              )}>
              {getNameFromFQN(tableFqn)}
              <InternalLinkIcon className="text-grey-muted" width="14px" />
            </Link>
          </HeaderField>
        </>
      )}
      {dimensionKey && (
        <>
          <HeaderDotSeparator />
          <HeaderField label={t('label.dimension')}>
            <HeaderFieldValue dataTestId="dimension-key">
              {dimensionKey}
            </HeaderFieldValue>
          </HeaderField>
        </>
      )}
      {columnName && (
        <>
          <HeaderDotSeparator />
          <HeaderField label={t('label.column')}>
            <HeaderFieldValue dataTestId="test-column-name">
              {columnName}
            </HeaderFieldValue>
          </HeaderField>
        </>
      )}
      <HeaderDotSeparator />
      <HeaderField label={t('label.test-type')}>
        <Tooltip
          isDisabled={!testCaseData?.testDefinition?.description}
          placement="bottom"
          title={testCaseData?.testDefinition?.description}>
          <TooltipTrigger className="tw:w-fit">
            <HeaderFieldValue dataTestId="test-definition-name">
              {getEntityName(testCaseData?.testDefinition)}
            </HeaderFieldValue>
          </TooltipTrigger>
        </Tooltip>
      </HeaderField>
    </div>
  );
};

export default IncidentManagerPageHeader;
