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

import { Plus } from '@untitledui/icons';
import React from 'react';
import { Navigate } from 'react-router-dom';
import { ReactComponent as AlertsActiveIcon } from '../../../assets/svg/alerts-active.svg';
import { ReactComponent as AlertsIcon } from '../../../assets/svg/alerts-default.svg';
import { ReactComponent as DataQualityActiveIcon } from '../../../assets/svg/data-quality-active.svg';
import { ReactComponent as DataQualityIcon } from '../../../assets/svg/data-quality-default.svg';
import { ReactComponent as IncidentActiveIcon } from '../../../assets/svg/incident-active.svg';
import { ReactComponent as IncidentIcon } from '../../../assets/svg/incident-default.svg';
import { ReactComponent as ObservabilityActiveIcon } from '../../../assets/svg/observability-active.svg';
import { ReactComponent as ObservabilityIcon } from '../../../assets/svg/observability-default.svg';
import { ReactComponent as PipelineActiveIcon } from '../../../assets/svg/pipeline-active.svg';
import { ReactComponent as PipelineIcon } from '../../../assets/svg/pipeline-default.svg';
import { ReactComponent as TestLibraryActiveIcon } from '../../../assets/svg/test-library-active.svg';
import { ReactComponent as TestLibraryIcon } from '../../../assets/svg/test-library-default.svg';
import { ResourceEntity } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { Operation } from '../../../generated/entity/policies/policy';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import { AppModule, Intent } from '../../platform/ai-shell/AppModule.types';
import { LiveRefreshBoundary } from '../../platform/ai-shell/LiveRefreshBoundary/LiveRefreshBoundary';
import { RoutePosition } from '../../Settings/Applications/plugins/AppPlugin';
import { OBSERVABILITY_ROUTES } from '../observability.constants';

const ObservabilityLayout = withSuspenseFallback(
  React.lazy(() => import('../ObservabilityLayout/ObservabilityLayout'))
);

const DataQualityPage = withSuspenseFallback(
  React.lazy(() => import('../DataQuality/DataQualityPage'))
);

const IncidentManagerPage = withSuspenseFallback(
  React.lazy(() => import('../IncidentManager/IncidentManagerPage'))
);

const TestLibraryPage = withSuspenseFallback(
  React.lazy(() => import('../TestLibrary/TestLibraryPage'))
);

const TestSuiteDetail = withSuspenseFallback(
  React.lazy(() => import('../TestSuiteDetail/TestSuiteDetail'))
);

const TestCaseDetail = withSuspenseFallback(
  React.lazy(() => import('../TestCaseDetail/TestCaseDetail'))
);

const AlertsPage = withSuspenseFallback(
  React.lazy(() => import('../Alerts/AlertsPage'))
);

const AlertDetailsPage = withSuspenseFallback(
  React.lazy(() => import('../Alerts/AlertDetailsPage'))
);

// NOTE: Pipeline* pages still live in Collate (large plugin-coupled pages).
// Until they are moved to OSS, their routes resolve through the app-mode
// fallback (CollateRouter); the pipeline sub-nav item below navigates to those
// fallback-served paths.

export const observabilityModule: AppModule = {
  id: 'observability',
  navOrder: 20,
  labelKey: 'label.observability',
  icon: ObservabilityIcon,
  activeIcon: ObservabilityActiveIcon,
  prefix: OBSERVABILITY_ROUTES.OBSERVABILITY,
  defaultPath: OBSERVABILITY_ROUTES.OBSERVABILITY,
  routes: [
    {
      path: OBSERVABILITY_ROUTES.OBSERVABILITY,
      element: (
        <Navigate
          replace
          to={OBSERVABILITY_ROUTES.OBSERVABILITY_DATA_QUALITY_BASE}
        />
      ),
      position: RoutePosition.APP,
    },
    {
      path: OBSERVABILITY_ROUTES.OBSERVABILITY_DATA_QUALITY_BASE,
      // LiveRefreshBoundary reloads the page when a testCase/testSuite change
      // arrives (registry → markRouteDirty) without remounting the layout.
      element: (
        <ObservabilityLayout>
          <LiveRefreshBoundary>
            <DataQualityPage />
          </LiveRefreshBoundary>
        </ObservabilityLayout>
      ),
      position: RoutePosition.APP,
    },
    {
      path: OBSERVABILITY_ROUTES.OBSERVABILITY_DATA_QUALITY_SUB_TAB,
      element: (
        <ObservabilityLayout>
          <LiveRefreshBoundary>
            <DataQualityPage />
          </LiveRefreshBoundary>
        </ObservabilityLayout>
      ),
      position: RoutePosition.APP,
    },
    {
      path: OBSERVABILITY_ROUTES.OBSERVABILITY_DATA_QUALITY,
      element: (
        <ObservabilityLayout>
          <LiveRefreshBoundary>
            <DataQualityPage />
          </LiveRefreshBoundary>
        </ObservabilityLayout>
      ),
      position: RoutePosition.APP,
    },
    {
      path: OBSERVABILITY_ROUTES.OBSERVABILITY_INCIDENT_MANAGER,
      element: (
        <ObservabilityLayout>
          <IncidentManagerPage />
        </ObservabilityLayout>
      ),
      position: RoutePosition.APP,
    },
    {
      path: OBSERVABILITY_ROUTES.OBSERVABILITY_ALERTS,
      element: (
        <ObservabilityLayout>
          <AlertsPage />
        </ObservabilityLayout>
      ),
      position: RoutePosition.APP,
    },
    {
      path: OBSERVABILITY_ROUTES.OBSERVABILITY_ALERT_DETAILS,
      element: (
        <ObservabilityLayout>
          <AlertDetailsPage />
        </ObservabilityLayout>
      ),
      position: RoutePosition.APP,
    },
    {
      path: OBSERVABILITY_ROUTES.OBSERVABILITY_ALERT_DETAILS_WITH_TAB,
      element: (
        <ObservabilityLayout>
          <AlertDetailsPage />
        </ObservabilityLayout>
      ),
      position: RoutePosition.APP,
    },
    {
      path: OBSERVABILITY_ROUTES.OBSERVABILITY_TEST_SUITE_DETAILS,
      element: (
        <ObservabilityLayout>
          <TestSuiteDetail />
        </ObservabilityLayout>
      ),
      position: RoutePosition.APP,
    },
    {
      path: OBSERVABILITY_ROUTES.OBSERVABILITY_TEST_CASE_VERSION_WITH_TAB,
      element: (
        <ObservabilityLayout>
          <TestCaseDetail isVersionPage />
        </ObservabilityLayout>
      ),
      position: RoutePosition.APP,
    },
    {
      path: OBSERVABILITY_ROUTES.OBSERVABILITY_TEST_CASE_VERSION,
      element: (
        <ObservabilityLayout>
          <TestCaseDetail isVersionPage />
        </ObservabilityLayout>
      ),
      position: RoutePosition.APP,
    },
    {
      path: OBSERVABILITY_ROUTES.OBSERVABILITY_TEST_CASE_DIMENSIONS_WITH_TAB,
      element: (
        <ObservabilityLayout>
          <TestCaseDetail />
        </ObservabilityLayout>
      ),
      position: RoutePosition.APP,
    },
    {
      path: OBSERVABILITY_ROUTES.OBSERVABILITY_TEST_CASE_DIMENSIONS,
      element: (
        <ObservabilityLayout>
          <TestCaseDetail />
        </ObservabilityLayout>
      ),
      position: RoutePosition.APP,
    },
    {
      path: OBSERVABILITY_ROUTES.OBSERVABILITY_TEST_CASE_DETAILS_WITH_TAB,
      element: (
        <ObservabilityLayout>
          <TestCaseDetail />
        </ObservabilityLayout>
      ),
      position: RoutePosition.APP,
    },
    {
      path: OBSERVABILITY_ROUTES.OBSERVABILITY_TEST_CASE_DETAILS,
      element: (
        <ObservabilityLayout>
          <TestCaseDetail />
        </ObservabilityLayout>
      ),
      position: RoutePosition.APP,
    },
    {
      path: OBSERVABILITY_ROUTES.OBSERVABILITY_TEST_LIBRARY,
      // Deliberately NOT wrapped in LiveRefreshBoundary. This page lists test
      // DEFINITIONS; the only types that mark a route dirty here are testCase /
      // testSuite, neither of which it renders — so every reload was a no-op
      // redraw that also remounted the subtree, destroying the open Add/Edit
      // Test Definition modal mid-edit. If test definitions ever need live
      // refresh, add `testDefinition` to the backend allowlist + the registry
      // and subscribe with useRouteActivation (TestLibraryPage owns its fetch
      // hook) rather than reinstating a remount.
      element: (
        <ObservabilityLayout>
          <TestLibraryPage />
        </ObservabilityLayout>
      ),
      position: RoutePosition.APP,
    },
  ],
  subNav: {
    key: 'observability',
    titleKey: 'label.observability',
    rootPath: OBSERVABILITY_ROUTES.OBSERVABILITY,
    sections: [
      {
        items: [
          {
            key: 'data-quality',
            icon: DataQualityIcon,
            activeIcon: DataQualityActiveIcon,
            labelKey: 'label.data-quality',
            path: OBSERVABILITY_ROUTES.OBSERVABILITY_DATA_QUALITY_BASE,
            activePaths: [
              OBSERVABILITY_ROUTES.OBSERVABILITY_TEST_CASE_DETAILS.split(
                '/:'
              )[0],
              OBSERVABILITY_ROUTES.OBSERVABILITY_TEST_SUITE_DETAILS.split(
                '/:'
              )[0],
            ],
          },
          {
            key: 'incidents',
            icon: IncidentIcon,
            activeIcon: IncidentActiveIcon,
            labelKey: 'label.incident-plural',
            path: OBSERVABILITY_ROUTES.OBSERVABILITY_INCIDENT_MANAGER,
          },
          {
            key: 'alerts',
            icon: AlertsIcon,
            activeIcon: AlertsActiveIcon,
            labelKey: 'label.alert-plural',
            path: OBSERVABILITY_ROUTES.OBSERVABILITY_ALERTS,
            activePaths: [
              OBSERVABILITY_ROUTES.OBSERVABILITY_ALERT_DETAILS.split('/:')[0],
            ],
          },
          {
            key: 'pipeline',
            icon: PipelineIcon,
            activeIcon: PipelineActiveIcon,
            labelKey: 'label.pipeline-observability',
            path: OBSERVABILITY_ROUTES.OBSERVABILITY_PIPELINE,
          },
          {
            key: 'test-library',
            icon: TestLibraryIcon,
            activeIcon: TestLibraryActiveIcon,
            labelKey: 'label.test-library',
            path: OBSERVABILITY_ROUTES.OBSERVABILITY_TEST_LIBRARY,
          },
        ],
      },
      {
        headerKey: 'label.quick-action-plural',
        items: [
          {
            key: 'add-test-case',
            icon: Plus,
            labelKey: 'label.add-test-case',
            emphasized: true,
            intent: Intent.AddTestCase,
          },
          {
            key: 'add-bundle-suite',
            icon: Plus,
            labelKey: 'label.add-bundle-suite',
            emphasized: true,
            intent: Intent.AddBundleSuite,
            // A bundle suite isn't scoped to an asset the user might own,
            // so a global Create is the correct gate here. Mirrors the
            // Data Quality header's `testSuitePermission?.Create` check.
            requiredPermission: {
              resource: ResourceEntity.TEST_SUITE,
              operation: Operation.Create,
            },
          },
        ],
      },
    ],
  },
};
