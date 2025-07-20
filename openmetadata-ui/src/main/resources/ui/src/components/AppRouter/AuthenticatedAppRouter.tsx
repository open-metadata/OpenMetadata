/*
 *  Copyright 2022 Collate.
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

import React, { FunctionComponent, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Route, Routes } from 'react-router-dom';
import {
  PLACEHOLDER_ROUTE_ENTITY_TYPE,
  ROUTES,
} from '../../constants/constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../context/PermissionProvider/PermissionProvider.interface';
import { Operation } from '../../generated/entity/policies/policy';
import AddCustomMetricPage from '../../pages/AddCustomMetricPage/AddCustomMetricPage';
import { CustomizablePage } from '../../pages/CustomizablePage/CustomizablePage';
import DataQualityPage from '../../pages/DataQuality/DataQualityPage';
import ForbiddenPage from '../../pages/ForbiddenPage/ForbiddenPage';
import PlatformLineage from '../../pages/PlatformLineage/PlatformLineage';
import TagPage from '../../pages/TagPage/TagPage';
import { checkPermission, userPermissions } from '../../utils/PermissionsUtils';
import AdminProtectedRoute from './AdminProtectedRoute';
import withSuspenseFallback from './withSuspenseFallback';

const DomainRouter = withSuspenseFallback(
  React.lazy(
    () => import(/* webpackChunkName: "DomainRouter" */ './DomainRouter')
  )
);
const DomainsRouter = withSuspenseFallback(
  React.lazy(
    () => import(/* webpackChunkName: "DomainsRouter" */ './DomainsRouter')
  )
);
const DomainsPage = withSuspenseFallback(
  React.lazy(() => import('../../pages/Domains/DomainsPage.component'))
);
const SettingsRouter = withSuspenseFallback(
  React.lazy(
    () => import(/* webpackChunkName: "SettingsRouter" */ './SettingsRouter')
  )
);
const EntityRouter = withSuspenseFallback(
  React.lazy(
    () => import(/* webpackChunkName: "EntityRouter" */ './EntityRouter')
  )
);
const ClassificationRouter = withSuspenseFallback(
  React.lazy(
    () =>
      import(
        /* webpackChunkName: "ClassificationRouter" */ './ClassificationRouter'
      )
  )
);
const GlossaryRouter = withSuspenseFallback(
  React.lazy(
    () =>
      import(
        /* webpackChunkName: "GlossaryRouter" */ './GlossaryRouter/GlossaryRouter'
      )
  )
);

const GlossaryTermRouter = withSuspenseFallback(
  React.lazy(
    () =>
      import(
        /* webpackChunkName: "GlossaryTermRouter" */ './GlossaryTermRouter/GlossaryTermRouter'
      )
  )
);

const MyDataPage = withSuspenseFallback(
  React.lazy(() => import('../../pages/MyDataPage/MyDataPage.component'))
);

const TestSuiteIngestionPage = withSuspenseFallback(
  React.lazy(
    () => import('../../pages/TestSuiteIngestionPage/TestSuiteIngestionPage')
  )
);

const TestSuiteDetailsPage = withSuspenseFallback(
  React.lazy(
    () =>
      import('../../pages/TestSuiteDetailsPage/TestSuiteDetailsPage.component')
  )
);

const AddDataQualityTestPage = withSuspenseFallback(
  React.lazy(
    () => import('../../pages/AddDataQualityTestPage/AddDataQualityTestPage')
  )
);

const AddCustomProperty = withSuspenseFallback(
  React.lazy(
    () =>
      import('../Settings/CustomProperty/AddCustomProperty/AddCustomProperty')
  )
);

const MarketPlacePage = withSuspenseFallback(
  React.lazy(() => import('../../pages/MarketPlacePage/MarketPlacePage'))
);

const BotDetailsPage = withSuspenseFallback(
  React.lazy(() => import('../../pages/BotDetailsPage/BotDetailsPage'))
);
const ServicePage = withSuspenseFallback(
  React.lazy(() => import('../../pages/ServiceDetailsPage/ServiceDetailsPage'))
);

const SwaggerPage = withSuspenseFallback(
  React.lazy(() => import('../../pages/SwaggerPage'))
);
const TourPageComponent = withSuspenseFallback(
  React.lazy(() => import('../../pages/TourPage/TourPage.component'))
);
const UserPage = withSuspenseFallback(
  React.lazy(() => import('../../pages/UserPage/UserPage.component'))
);

const DomainVersionPage = withSuspenseFallback(
  React.lazy(
    () =>
      import('../../components/Domain/DomainVersion/DomainVersion.component')
  )
);

const AddIngestionPage = withSuspenseFallback(
  React.lazy(
    () => import('../../pages/AddIngestionPage/AddIngestionPage.component')
  )
);
const AddServicePage = withSuspenseFallback(
  React.lazy(
    () => import('../../pages/AddServicePage/AddServicePage.component')
  )
);

const MarketPlaceAppDetails = withSuspenseFallback(
  React.lazy(
    () =>
      import(
        '../Settings/Applications/MarketPlaceAppDetails/MarketPlaceAppDetails.component'
      )
  )
);

const AppInstallPage = withSuspenseFallback(
  React.lazy(() => import('../../pages/AppInstall/AppInstall.component'))
);

const EditConnectionFormPage = withSuspenseFallback(
  React.lazy(
    () =>
      import(
        '../../pages/EditConnectionFormPage/EditConnectionFormPage.component'
      )
  )
);

const CreateUserPage = withSuspenseFallback(
  React.lazy(
    () => import('../../pages/CreateUserPage/CreateUserPage.component')
  )
);
const EditIngestionPage = withSuspenseFallback(
  React.lazy(
    () => import('../../pages/EditIngestionPage/EditIngestionPage.component')
  )
);
const ServiceVersionPage = withSuspenseFallback(
  React.lazy(() => import('../../pages/ServiceVersionPage/ServiceVersionPage'))
);

const ExplorePageV1 = withSuspenseFallback(
  React.lazy(() => import('../../pages/ExplorePage/ExplorePageV1.component'))
);

const RequestDescriptionPage = withSuspenseFallback(
  React.lazy(
    () =>
      import(
        '../../pages/TasksPage/RequestDescriptionPage/RequestDescriptionPage'
      )
  )
);

const RequestTagsPage = withSuspenseFallback(
  React.lazy(
    () => import('../../pages/TasksPage/RequestTagPage/RequestTagPage')
  )
);

const UpdateDescriptionPage = withSuspenseFallback(
  React.lazy(
    () =>
      import(
        '../../pages/TasksPage/UpdateDescriptionPage/UpdateDescriptionPage'
      )
  )
);

const UpdateTagsPage = withSuspenseFallback(
  React.lazy(() => import('../../pages/TasksPage/UpdateTagPage/UpdateTagPage'))
);

const LogsViewerPage = withSuspenseFallback(
  React.lazy(() => import('../../pages/LogsViewerPage/LogsViewerPage'))
);

const DataInsightPage = withSuspenseFallback(
  React.lazy(
    () => import('../../pages/DataInsightPage/DataInsightPage.component')
  )
);

const AddKPIPage = withSuspenseFallback(
  React.lazy(() => import('../../pages/KPIPage/AddKPIPage'))
);

const EditKPIPage = withSuspenseFallback(
  React.lazy(() => import('../../pages/KPIPage/EditKPIPage'))
);

const AddTestSuitePage = withSuspenseFallback(
  React.lazy(
    () => import('../DataQuality/TestSuite/TestSuiteStepper/TestSuiteStepper')
  )
);

const QueryPage = withSuspenseFallback(
  React.lazy(() => import('../../pages/QueryPage/QueryPage.component'))
);
const AddQueryPage = withSuspenseFallback(
  React.lazy(() => import('../../pages/AddQueryPage/AddQueryPage.component'))
);

const IncidentManagerPage = withSuspenseFallback(
  React.lazy(() => import('../../pages/IncidentManager/IncidentManagerPage'))
);

const IncidentManagerDetailPage = withSuspenseFallback(
  React.lazy(
    () =>
      import(
        '../../pages/IncidentManager/IncidentManagerDetailPage/IncidentManagerDetailPage'
      )
  )
);

const TestCaseVersionPage = withSuspenseFallback(
  React.lazy(
    () => import('../../pages/TestCaseVersionPage/TestCaseVersionPage')
  )
);

const ObservabilityAlertsPage = withSuspenseFallback(
  React.lazy(
    () => import('../../pages/ObservabilityAlertsPage/ObservabilityAlertsPage')
  )
);

const AlertDetailsPage = withSuspenseFallback(
  React.lazy(() => import('../../pages/AlertDetailsPage/AlertDetailsPage'))
);

const AddObservabilityPage = withSuspenseFallback(
  React.lazy(
    () => import('../../pages/AddObservabilityPage/AddObservabilityPage')
  )
);

const MetricListPage = withSuspenseFallback(
  React.lazy(
    () => import('../../pages/MetricsPage/MetricListPage/MetricListPage')
  )
);

const AddMetricPage = withSuspenseFallback(
  React.lazy(
    () => import('../../pages/MetricsPage/AddMetricPage/AddMetricPage')
  )
);

const AuthenticatedAppRouter: FunctionComponent = () => {
  const { permissions } = usePermissionProvider();
  const { t } = useTranslation();

  const createBotPermission = useMemo(
    () =>
      checkPermission(Operation.Create, ResourceEntity.USER, permissions) &&
      checkPermission(Operation.Create, ResourceEntity.BOT, permissions),
    [permissions]
  );

  return (
    <Routes>
      <Route
        element={<ForbiddenPage pageTitle={t('label.no-access')} />}
        path={ROUTES.FORBIDDEN}
      />
      <Route element={<MyDataPage />} path={ROUTES.MY_DATA} />
      <Route element={<TourPageComponent />} path={ROUTES.TOUR} />
      <Route
        element={<ExplorePageV1 pageTitle={t('label.explore')} />}
        path={ROUTES.EXPLORE}
      />
      <Route element={<PlatformLineage />} path={ROUTES.PLATFORM_LINEAGE} />
      <Route
        element={<PlatformLineage />}
        path={ROUTES.PLATFORM_LINEAGE_WITH_FQN}
      />
      <Route
        element={<ExplorePageV1 pageTitle={t('label.explore')} />}
        path={ROUTES.EXPLORE_WITH_TAB}
      />
      <Route
        element={
          <EditConnectionFormPage
            pageTitle={t('label.edit-entity', {
              entity: t('label.connection'),
            })}
          />
        }
        path={ROUTES.EDIT_SERVICE_CONNECTION}
      />
      <Route
        element={
          <AddServicePage
            pageTitle={t('label.add-entity', {
              entity: t('label.service'),
            })}
          />
        }
        path={ROUTES.ADD_SERVICE}
      />
      <Route element={<QueryPage />} path={ROUTES.QUERY_FULL_SCREEN_VIEW} />
      <Route
        element={
          <AddQueryPage
            pageTitle={t('label.add-entity', {
              entity: t('label.query'),
            })}
          />
        }
        path={ROUTES.ADD_QUERY}
      />
      <Route
        element={
          <AdminProtectedRoute
            hasPermission={checkPermission(
              Operation.Create,
              ResourceEntity.INGESTION_PIPELINE,
              permissions
            )}>
            <AddIngestionPage
              pageTitle={t('label.add-entity', {
                entity: t('label.ingestion'),
              })}
            />
          </AdminProtectedRoute>
        }
        path={ROUTES.ADD_INGESTION}
      />
      <Route
        element={
          <AdminProtectedRoute
            hasPermission={checkPermission(
              Operation.EditAll,
              ResourceEntity.INGESTION_PIPELINE,
              permissions
            )}>
            <EditIngestionPage
              pageTitle={t('label.edit-entity', {
                entity: t('label.ingestion'),
              })}
            />
          </AdminProtectedRoute>
        }
        path={ROUTES.EDIT_INGESTION}
      />
      <Route element={<ServiceVersionPage />} path={ROUTES.SERVICE_VERSION} />
      <Route element={<ServicePage />} path={ROUTES.SERVICE_WITH_SUB_TAB} />
      <Route element={<ServicePage />} path={ROUTES.SERVICE_WITH_TAB} />
      <Route element={<ServicePage />} path={ROUTES.SERVICE} />
      <Route
        element={
          <AdminProtectedRoute>
            <MarketPlacePage />
          </AdminProtectedRoute>
        }
        path={ROUTES.MARKETPLACE}
      />
      <Route
        element={
          <AdminProtectedRoute>
            <MarketPlaceAppDetails />
          </AdminProtectedRoute>
        }
        path={ROUTES.MARKETPLACE_APP_DETAILS}
      />
      <Route
        element={
          <AdminProtectedRoute>
            <AppInstallPage />
          </AdminProtectedRoute>
        }
        path={ROUTES.MARKETPLACE_APP_INSTALL}
      />
      <Route element={<SwaggerPage />} path={ROUTES.SWAGGER} />
      <Route element={<DomainVersionPage />} path={ROUTES.DOMAIN_VERSION} />
      <Route element={<UserPage />} path={ROUTES.USER_PROFILE_WITH_SUB_TAB} />
      <Route element={<UserPage />} path={ROUTES.USER_PROFILE_WITH_TAB} />
      <Route element={<UserPage />} path={ROUTES.USER_PROFILE} />
      <Route
        element={
          <AddDataQualityTestPage
            pageTitle={t('label.add-entity', {
              entity: t('label.data-quality-test'),
            })}
          />
        }
        path={ROUTES.ADD_DATA_QUALITY_TEST_CASE}
      />
      <Route
        element={
          <AdminProtectedRoute
            hasPermission={checkPermission(
              Operation.Create,
              ResourceEntity.TABLE,
              permissions
            )}>
            <AddCustomMetricPage
              pageTitle={t('label.add-entity', {
                entity: t('label.custom-metric'),
              })}
            />
          </AdminProtectedRoute>
        }
        path={ROUTES.ADD_CUSTOM_METRIC}
      />
      <Route
        element={
          <AdminProtectedRoute
            hasPermission={checkPermission(
              Operation.Create,
              ResourceEntity.USER,
              permissions
            )}>
            <CreateUserPage />
          </AdminProtectedRoute>
        }
        path={ROUTES.CREATE_USER}
      />
      <Route
        element={
          <AdminProtectedRoute hasPermission={createBotPermission}>
            <CreateUserPage />
          </AdminProtectedRoute>
        }
        path={ROUTES.CREATE_USER_WITH_BOT}
      />
      <Route element={<BotDetailsPage />} path={ROUTES.BOTS_PROFILE} />
      <Route
        element={<AddCustomProperty />}
        path={ROUTES.ADD_CUSTOM_PROPERTY}
      />
      <Route
        element={
          <RequestDescriptionPage
            pageTitle={t('message.request-description')}
          />
        }
        path={ROUTES.REQUEST_DESCRIPTION}
      />
      <Route
        element={
          <UpdateDescriptionPage pageTitle={t('label.update-description')} />
        }
        path={ROUTES.UPDATE_DESCRIPTION}
      />
      <Route
        element={<RequestTagsPage pageTitle={t('label.request-tag-plural')} />}
        path={ROUTES.REQUEST_TAGS}
      />
      <Route
        element={
          <UpdateTagsPage
            pageTitle={t('label.update-entity', {
              entity: t('label.tag'),
            })}
          />
        }
        path={ROUTES.UPDATE_TAGS}
      />
      <Route
        element={<TestSuiteDetailsPage />}
        path={ROUTES.TEST_SUITES_WITH_FQN}
      />
      <Route element={<LogsViewerPage />} path={ROUTES.LOGS} />
      <Route
        element={
          <TestSuiteIngestionPage
            pageTitle={t('label.add-entity', {
              entity: t('label.test-suite'),
            })}
          />
        }
        path={ROUTES.TEST_SUITES_ADD_INGESTION}
      />
      <Route
        element={
          <TestSuiteIngestionPage
            pageTitle={t('label.add-entity', {
              entity: t('label.test-suite'),
            })}
          />
        }
        path={ROUTES.TEST_SUITES_EDIT_INGESTION}
      />
      <Route
        element={
          <AdminProtectedRoute
            hasPermission={userPermissions.hasViewPermissions(
              ResourceEntity.TEST_SUITE,
              permissions
            )}>
            <DataQualityPage
              pageTitle={t('label.add-entity', {
                entity: t('label.data-quality'),
              })}
            />
          </AdminProtectedRoute>
        }
        path={ROUTES.DATA_QUALITY_WITH_TAB}
      />
      <Route
        element={
          <AdminProtectedRoute
            hasPermission={userPermissions.hasViewPermissions(
              ResourceEntity.TEST_SUITE,
              permissions
            )}>
            <DataQualityPage
              pageTitle={t('label.add-entity', {
                entity: t('label.data-quality'),
              })}
            />
          </AdminProtectedRoute>
        }
        path={ROUTES.DATA_QUALITY}
      />
      <Route
        element={
          <AdminProtectedRoute
            hasPermission={userPermissions.hasViewPermissions(
              ResourceEntity.TEST_CASE,
              permissions
            )}>
            <IncidentManagerPage />
          </AdminProtectedRoute>
        }
        path={ROUTES.INCIDENT_MANAGER}
      />
      <Route
        element={
          <AdminProtectedRoute
            hasPermission={userPermissions.hasViewPermissions(
              ResourceEntity.TEST_CASE,
              permissions
            )}>
            <IncidentManagerDetailPage />
          </AdminProtectedRoute>
        }
        path={ROUTES.TEST_CASE_DETAILS}
      />

      <Route
        element={
          <AdminProtectedRoute
            hasPermission={userPermissions.hasViewPermissions(
              ResourceEntity.TEST_CASE,
              permissions
            )}>
            <IncidentManagerDetailPage />
          </AdminProtectedRoute>
        }
        path={ROUTES.TEST_CASE_DETAILS_WITH_TAB}
      />

      <Route
        element={
          <AdminProtectedRoute
            hasPermission={userPermissions.hasViewPermissions(
              ResourceEntity.TEST_CASE,
              permissions
            )}>
            <TestCaseVersionPage />
          </AdminProtectedRoute>
        }
        path={ROUTES.TEST_CASE_VERSION}
      />

      <Route
        element={
          <AdminProtectedRoute
            hasPermission={userPermissions.hasViewPermissions(
              ResourceEntity.TEST_CASE,
              permissions
            )}>
            <TestCaseVersionPage />
          </AdminProtectedRoute>
        }
        path={ROUTES.TEST_CASE_DETAILS_WITH_TAB_VERSION}
      />
      <Route
        element={
          <AdminProtectedRoute
            hasPermission={userPermissions.hasViewPermissions(
              ResourceEntity.EVENT_SUBSCRIPTION,
              permissions
            )}>
            <ObservabilityAlertsPage />
          </AdminProtectedRoute>
        }
        path={ROUTES.OBSERVABILITY_ALERTS}
      />
      <Route
        element={
          <AdminProtectedRoute
            hasPermission={userPermissions.hasViewPermissions(
              ResourceEntity.EVENT_SUBSCRIPTION,
              permissions
            )}>
            <AlertDetailsPage isNotificationAlert={false} />
          </AdminProtectedRoute>
        }
        path={ROUTES.OBSERVABILITY_ALERT_DETAILS_WITH_TAB}
      />
      <Route
        element={
          <AddObservabilityPage
            pageTitle={t('label.add-entity', {
              entity: t('label.observability'),
            })}
          />
        }
        path={ROUTES.ADD_OBSERVABILITY_ALERTS}
      />
      <Route
        element={
          <AddObservabilityPage
            pageTitle={t('label.add-entity', {
              entity: t('label.observability'),
            })}
          />
        }
        path={ROUTES.EDIT_OBSERVABILITY_ALERTS}
      />
      <Route
        element={<DataInsightPage pageTitle={t('label.data-insight')} />}
        path={ROUTES.DATA_INSIGHT_WITH_TAB}
      />
      <Route
        element={<DataInsightPage pageTitle={t('label.data-insight')} />}
        path={ROUTES.DATA_INSIGHT}
      />
      <Route
        element={
          <AddKPIPage
            pageTitle={t('label.add-new-entity', {
              entity: t('label.kpi-uppercase'),
            })}
          />
        }
        path={ROUTES.ADD_KPI}
      />
      <Route
        element={
          <EditKPIPage
            pageTitle={t('label.edit-entity', {
              entity: t('label.kpi-uppercase'),
            })}
          />
        }
        path={ROUTES.EDIT_KPI}
      />
      <Route element={<AddTestSuitePage />} path={ROUTES.ADD_TEST_SUITES} />
      <Route element={<Navigate to={ROUTES.MY_DATA} />} path={ROUTES.HOME} />
      <Route
        element={
          <AdminProtectedRoute>
            <CustomizablePage />
          </AdminProtectedRoute>
        }
        path={ROUTES.CUSTOMIZE_PAGE}
      />
      <Route element={<ClassificationRouter />} path="/tags/*" />
      <Route element={<TagPage />} path={ROUTES.TAG_ITEM} />
      <Route element={<TagPage />} path={ROUTES.TAG_ITEM_WITH_TAB} />
      <Route element={<GlossaryRouter />} path="/glossary/*" />
      <Route element={<GlossaryTermRouter />} path="/glossary-term/*" />
      <Route element={<SettingsRouter />} path="/settings/*" />
      <Route element={<DomainRouter />} path="/domain/*" />
      <Route element={<DomainsRouter />} path="/domains/*" />

      <Route
        element={<DomainsPage pageTitle={t('label.domain')} />}
        path={ROUTES.DOMAINS}
      />
      <Route
        element={<DomainsPage pageTitle={t('label.data-product')} />}
        path={ROUTES.DATA_PRODUCTS}
      />

      <Route element={<MetricListPage />} path={ROUTES.METRICS} />
      <Route
        element={
          <AddMetricPage
            pageTitle={t('label.add-new-entity', {
              entity: t('label.metric'),
            })}
          />
        }
        path={ROUTES.ADD_METRIC}
      />
      <Route
        element={<EntityRouter />}
        path={`/${PLACEHOLDER_ROUTE_ENTITY_TYPE}/*`}
      />
      <Route element={<Navigate to={ROUTES.MY_DATA} />} path={ROUTES.SIGNIN} />
      <Route
        element={<Navigate to={ROUTES.MY_DATA} />}
        path={ROUTES.REGISTER}
      />
      <Route
        element={<Navigate to={ROUTES.MY_DATA} />}
        path={ROUTES.FORGOT_PASSWORD}
      />
      <Route element={<Navigate to={ROUTES.NOT_FOUND} />} path="*" />
    </Routes>
  );
};

export default AuthenticatedAppRouter;
