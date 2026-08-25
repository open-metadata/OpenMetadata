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
import { Box } from '@openmetadata/ui-core-components';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { LEARNING_PAGE_IDS } from '../../../constants/Learning.constants';
import { PAGE_HEADERS } from '../../../constants/PageHeaders.constant';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import HeaderBreadcrumb from '../../common/HeaderBreadcrumb/HeaderBreadcrumb.component';
import HeaderShell from '../../common/HeaderShell/HeaderShell.component';
import IncidentManagerTable from '../../IncidentManager/IncidentManagerTable.component';
import { useIncidentManagerListPage } from '../../IncidentManager/useIncidentManagerListPage';
import { LearningIcon } from '../../Learning/LearningIcon/LearningIcon.component';
import FilterBar from '../common/FilterChip/FilterBar';
import { OBSERVABILITY_ROUTES } from '../observability.constants';
import { getObservabilityRootBreadcrumb } from '../observabilityBreadcrumb.utils';
import ObservabilityPageShell from '../ObservabilityPageShell/ObservabilityPageShell';
import IncidentManagerPageWidgets from './IncidentManagerPageWidgets';

/**
 * App-mode Incident Manager page. Composes the shared useIncidentManagerListPage
 * hook (logic) + reused IncidentManagerTable, and supplies its own untitled-ui
 * FilterBar. Only the filter chrome differs from the classic renderer, which keeps
 * its antd filter bar.
 */
const IncidentManagerPage = () => {
  const { t } = useTranslation();
  const {
    commonTestCasePermission,
    filterDescriptors,
    hasActiveFilters,
    clearAllFilters,
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
  } = useIncidentManagerListPage({ isIncidentPage: true });

  const hasViewPermission =
    commonTestCasePermission?.ViewAll || commonTestCasePermission?.ViewBasic;

  // Attached to the test case links so the detail page breadcrumb reflects
  // the incidents page as the origin.
  const incidentBreadcrumb = useMemo(
    () => [
      {
        name: t('label.incident-manager'),
        url: OBSERVABILITY_ROUTES.OBSERVABILITY_INCIDENT_MANAGER,
      },
    ],
    [t]
  );

  return (
    <ObservabilityPageShell
      header={
        <HeaderShell
          badge={
            <LearningIcon
              pageId={LEARNING_PAGE_IDS.INCIDENT_MANAGER}
              title={t(PAGE_HEADERS.INCIDENT_MANAGER.header)}
            />
          }
          breadcrumb={
            <HeaderBreadcrumb
              noMargin
              className="tw:text-xs"
              items={[
                getObservabilityRootBreadcrumb(t),
                {
                  label: t('label.incident-manager'),
                  ariaLabel: t('label.incident-manager'),
                },
              ]}
              showHome={false}
            />
          }
          padding="comfortable"
          subtitle={t(PAGE_HEADERS.INCIDENT_MANAGER.subHeader)}
          title={t(PAGE_HEADERS.INCIDENT_MANAGER.header)}
          variant="gradient"
        />
      }
      pageTitle={t(PAGE_HEADERS.INCIDENT_MANAGER.header)}>
      <div className="tw:mb-4 tw:[&_.incident-page-widgets]:border-0 tw:[&_.incident-page-widgets]:p-0 tw:[&_.custom-chart-background]:border-0 tw:[&_.custom-chart-background]:bg-gray-blue-25">
        <IncidentManagerPageWidgets />
      </div>
      {hasViewPermission ? (
        <Box
          className="tw:overflow-hidden tw:rounded-xl tw:bg-primary tw:outline-1 tw:outline-secondary"
          direction="col">
          <Box className="tw:border-b tw:border-secondary tw:p-4">
            <FilterBar
              filters={filterDescriptors}
              hasActiveFilters={hasActiveFilters}
              variant="input"
              onClearAll={clearAllFilters}
            />
          </Box>
          <IncidentManagerTable
            breadcrumbData={incidentBreadcrumb}
            handleAssigneeUpdate={handleAssigneeUpdate}
            handleSeveritySubmit={handleSeveritySubmit}
            handleStatusSubmit={handleStatusSubmit}
            isIncidentPage={isIncidentPage}
            isPermissionLoading={isPermissionLoading}
            pagingData={pagingData}
            showPagination={showPagination}
            tableDetails={tableDetails}
            testCaseListData={testCaseListData}
            testCasePermissions={testCasePermissions}
          />
        </Box>
      ) : (
        <ErrorPlaceHolder
          className="border-none"
          permissionValue={t('label.view-entity', {
            entity: t('label.test-case'),
          })}
          type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
        />
      )}
    </ObservabilityPageShell>
  );
};

export default IncidentManagerPage;
