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
import { Redirect, Route, Switch } from 'react-router-dom';
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
    () => import(/* webpackChunkName: "GlossaryRouter" */ './GlossaryRouter')
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

  const createBotPermission = useMemo(
    () =>
      checkPermission(Operation.Create, ResourceEntity.USER, permissions) &&
      checkPermission(Operation.Create, ResourceEntity.BOT, permissions),
    [permissions]
  );

  return (
    <Switch>
      <Route exact component={ForbiddenPage} path={ROUTES.FORBIDDEN} />

      <Route exact component={MyDataPage} path={ROUTES.MY_DATA} />
      <Route exact component={TourPageComponent} path={ROUTES.TOUR} />
      <Route exact component={ExplorePageV1} path={ROUTES.EXPLORE} />
      <Route
        exact
        component={PlatformLineage}
        path={[ROUTES.PLATFORM_LINEAGE, ROUTES.PLATFORM_LINEAGE_WITH_FQN]}
      />
      <Route component={ExplorePageV1} path={ROUTES.EXPLORE_WITH_TAB} />
      <Route
        exact
        component={EditConnectionFormPage}
        path={ROUTES.EDIT_SERVICE_CONNECTION}
      />

      <Route exact component={AddServicePage} path={ROUTES.ADD_SERVICE} />
      <Route exact component={QueryPage} path={ROUTES.QUERY_FULL_SCREEN_VIEW} />
      <Route exact component={AddQueryPage} path={ROUTES.ADD_QUERY} />
      <AdminProtectedRoute
        exact
        component={AddIngestionPage}
        hasPermission={checkPermission(
          Operation.Create,
          ResourceEntity.INGESTION_PIPELINE,
          permissions
        )}
        path={ROUTES.ADD_INGESTION}
      />
      <AdminProtectedRoute
        exact
        component={EditIngestionPage}
        hasPermission={checkPermission(
          Operation.EditAll,
          ResourceEntity.INGESTION_PIPELINE,
          permissions
        )}
        path={ROUTES.EDIT_INGESTION}
      />
      <Route
        exact
        component={ServiceVersionPage}
        path={ROUTES.SERVICE_VERSION}
      />

      <Route
        exact
        component={ServicePage}
        path={[
          ROUTES.SERVICE_WITH_SUB_TAB,
          ROUTES.SERVICE_WITH_TAB,
          ROUTES.SERVICE,
        ]}
      />

      <AdminProtectedRoute
        exact
        component={MarketPlacePage}
        path={ROUTES.MARKETPLACE}
      />

      <AdminProtectedRoute
        exact
        component={MarketPlaceAppDetails}
        path={ROUTES.MARKETPLACE_APP_DETAILS}
      />

      <AdminProtectedRoute
        exact
        component={AppInstallPage}
        path={ROUTES.MARKETPLACE_APP_INSTALL}
      />

      <Route exact component={SwaggerPage} path={ROUTES.SWAGGER} />
      <Route exact component={DomainVersionPage} path={ROUTES.DOMAIN_VERSION} />

      <Route
        exact
        component={UserPage}
        path={[
          ROUTES.USER_PROFILE_WITH_SUB_TAB,
          ROUTES.USER_PROFILE_WITH_TAB,
          ROUTES.USER_PROFILE,
        ]}
      />

      <Route
        exact
        component={AddDataQualityTestPage}
        path={ROUTES.ADD_DATA_QUALITY_TEST_CASE}
      />
      <AdminProtectedRoute
        exact
        component={AddCustomMetricPage}
        hasPermission={checkPermission(
          Operation.Create,
          ResourceEntity.TABLE,
          permissions
        )}
        path={ROUTES.ADD_CUSTOM_METRIC}
      />

      <AdminProtectedRoute
        exact
        component={CreateUserPage}
        hasPermission={checkPermission(
          Operation.Create,
          ResourceEntity.USER,
          permissions
        )}
        path={ROUTES.CREATE_USER}
      />
      <AdminProtectedRoute
        exact
        component={CreateUserPage}
        hasPermission={createBotPermission}
        path={ROUTES.CREATE_USER_WITH_BOT}
      />
      <Route exact component={BotDetailsPage} path={ROUTES.BOTS_PROFILE} />
      <Route
        exact
        component={AddCustomProperty}
        path={ROUTES.ADD_CUSTOM_PROPERTY}
      />
      <Route
        exact
        component={RequestDescriptionPage}
        path={ROUTES.REQUEST_DESCRIPTION}
      />
      <Route
        exact
        component={UpdateDescriptionPage}
        path={ROUTES.UPDATE_DESCRIPTION}
      />

      <Route exact component={RequestTagsPage} path={ROUTES.REQUEST_TAGS} />
      <Route exact component={UpdateTagsPage} path={ROUTES.UPDATE_TAGS} />

      <Route
        exact
        component={TestSuiteDetailsPage}
        path={ROUTES.TEST_SUITES_WITH_FQN}
      />
      <Route exact component={LogsViewerPage} path={ROUTES.LOGS} />
      <Route
        exact
        component={TestSuiteIngestionPage}
        path={[
          ROUTES.TEST_SUITES_ADD_INGESTION,
          ROUTES.TEST_SUITES_EDIT_INGESTION,
        ]}
      />

      <AdminProtectedRoute
        exact
        component={DataQualityPage}
        hasPermission={userPermissions.hasViewPermissions(
          ResourceEntity.TEST_SUITE,
          permissions
        )}
        path={[ROUTES.DATA_QUALITY_WITH_TAB, ROUTES.DATA_QUALITY]}
      />

      <AdminProtectedRoute
        exact
        component={IncidentManagerPage}
        hasPermission={userPermissions.hasViewPermissions(
          ResourceEntity.TEST_CASE,
          permissions
        )}
        path={ROUTES.INCIDENT_MANAGER}
      />

      <AdminProtectedRoute
        exact
        component={IncidentManagerDetailPage}
        hasPermission={userPermissions.hasViewPermissions(
          ResourceEntity.TEST_CASE,
          permissions
        )}
        path={[ROUTES.TEST_CASE_DETAILS, ROUTES.TEST_CASE_DETAILS_WITH_TAB]}
      />
      <AdminProtectedRoute
        exact
        component={TestCaseVersionPage}
        hasPermission={userPermissions.hasViewPermissions(
          ResourceEntity.TEST_CASE,
          permissions
        )}
        path={ROUTES.TEST_CASE_VERSION}
      />

      <AdminProtectedRoute
        exact
        component={ObservabilityAlertsPage}
        hasPermission={userPermissions.hasViewPermissions(
          ResourceEntity.EVENT_SUBSCRIPTION,
          permissions
        )}
        path={ROUTES.OBSERVABILITY_ALERTS}
      />

      <AdminProtectedRoute
        exact
        component={AlertDetailsPage}
        hasPermission={userPermissions.hasViewPermissions(
          ResourceEntity.EVENT_SUBSCRIPTION,
          permissions
        )}
        path={ROUTES.OBSERVABILITY_ALERT_DETAILS_WITH_TAB}
      />

      <Route
        exact
        component={AddObservabilityPage}
        path={[
          ROUTES.ADD_OBSERVABILITY_ALERTS,
          ROUTES.EDIT_OBSERVABILITY_ALERTS,
        ]}
      />

      <Route
        exact
        component={DataInsightPage}
        path={[ROUTES.DATA_INSIGHT_WITH_TAB, ROUTES.DATA_INSIGHT]}
      />

      <Route exact component={AddKPIPage} path={ROUTES.ADD_KPI} />
      <Route exact component={EditKPIPage} path={ROUTES.EDIT_KPI} />
      <Route exact component={AddTestSuitePage} path={ROUTES.ADD_TEST_SUITES} />
      <Route exact path={ROUTES.HOME}>
        <Redirect to={ROUTES.MY_DATA} />
      </Route>

      <AdminProtectedRoute
        exact
        component={CustomizablePage}
        path={ROUTES.CUSTOMIZE_PAGE}
      />

      <Route component={ClassificationRouter} path="/tags" />
      <Route
        exact
        component={TagPage}
        path={[ROUTES.TAG_ITEM, ROUTES.TAG_ITEM_WITH_TAB]}
      />
      <Route
        component={GlossaryRouter}
        path={['/glossary', '/glossary-term']}
      />

      <Route component={SettingsRouter} path="/settings" />
      <Route component={DomainRouter} path="/domain" />

      <Route exact component={MetricListPage} path={ROUTES.METRICS} />
      <Route exact component={AddMetricPage} path={ROUTES.ADD_METRIC} />

      <Route
        component={EntityRouter}
        path={`/${PLACEHOLDER_ROUTE_ENTITY_TYPE}/*`}
      />

      <Route
        exact
        path={[
          ROUTES.SIGNIN,
          ROUTES.REGISTER,
          ROUTES.SIGNIN,
          ROUTES.FORGOT_PASSWORD,
        ]}>
        <Redirect to={ROUTES.MY_DATA} />
      </Route>

      <Redirect to={ROUTES.NOT_FOUND} />
    </Switch>
  );
};

export default AuthenticatedAppRouter;
