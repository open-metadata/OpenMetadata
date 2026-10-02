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
import { PageLayout } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import { LEARNING_PAGE_IDS } from '../../../constants/Learning.constants';
import { PAGE_HEADERS } from '../../../constants/PageHeaders.constant';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { getDerivedPermissionFlags } from '../../../utils/PermissionDerivation';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import HeaderBreadcrumb from '../../common/HeaderBreadcrumb/HeaderBreadcrumb.component';
import { LearningIcon } from '../../Learning/LearningIcon/LearningIcon.component';
import { getObservabilityRootBreadcrumb } from '../observabilityBreadcrumb.utils';
import ObservabilityPageShell from '../ObservabilityPageShell/ObservabilityPageShell';
import IncidentGroupsView from './IncidentGroups/IncidentGroupsView';
import IncidentManagerPageWidgets from './IncidentManagerPageWidgets';

// Widget wrapper: strip the widgets' own border/padding and give the chart cards
// a light bg in light and a dark surface in dark.
const INCIDENT_WIDGETS_WRAPPER_CLASS = [
  'tw:mb-4',
  'tw:[&_.incident-page-widgets]:border-0',
  'tw:[&_.incident-page-widgets]:p-0',
  'tw:[&_.custom-chart-background]:border-0',
  'tw:[&_.custom-chart-background]:bg-gray-blue-25',
  'tw:[&_.custom-chart-background]:dark:bg-surface',
].join(' ');

/**
 * App-mode Incident Manager page: the incident widgets above the grouped
 * incidents. A group's own incidents open from its row, in the drawer or the
 * drill-down, so the page lists no incidents one by one.
 */
const IncidentManagerPage = () => {
  const { t } = useTranslation();
  const { permissions } = usePermissionProvider();

  const hasViewPermission = getDerivedPermissionFlags(
    permissions.testCase ?? DEFAULT_ENTITY_PERMISSION
  ).hasViewAccess;

  return (
    <ObservabilityPageShell
      header={
        <PageLayout.PageHeader
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
          subtitle={t(PAGE_HEADERS.INCIDENT_MANAGER.subHeader)}
          title={t(PAGE_HEADERS.INCIDENT_MANAGER.header)}
          variant="gradient"
        />
      }
      pageTitle={t(PAGE_HEADERS.INCIDENT_MANAGER.header)}>
      <div className={INCIDENT_WIDGETS_WRAPPER_CLASS}>
        <IncidentManagerPageWidgets />
      </div>
      {hasViewPermission ? (
        <IncidentGroupsView />
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
