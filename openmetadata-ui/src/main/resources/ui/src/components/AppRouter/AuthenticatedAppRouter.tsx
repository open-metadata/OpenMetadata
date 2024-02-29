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
import AddDomain from '../../components/Domain/AddDomain/AddDomain.component';
import DomainPage from '../../components/Domain/DomainPage.component';
import { ROUTES } from '../../constants/constants';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../constants/GlobalSettings.constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../context/PermissionProvider/PermissionProvider.interface';
import { Operation } from '../../generated/entity/policies/policy';
import { TeamType } from '../../generated/entity/teams/team';
import AddCustomMetricPage from '../../pages/AddCustomMetricPage/AddCustomMetricPage';
import { CustomizablePage } from '../../pages/CustomizablePage/CustomizablePage';
import { CustomPageSettings } from '../../pages/CustomPageSettings/CustomPageSettings';
import DataQualityPage from '../../pages/DataQuality/DataQualityPage';
import { PersonaDetailsPage } from '../../pages/Persona/PersonaDetailsPage/PersonaDetailsPage';
import { PersonaPage } from '../../pages/Persona/PersonaListPage/PersonaPage';
import applicationRoutesClass from '../../utils/ApplicationRoutesClassBase';
import { checkPermission, userPermissions } from '../../utils/PermissionsUtils';
import {
  getSettingCategoryPath,
  getSettingPath,
  getTeamsWithFqnPath,
} from '../../utils/RouterUtils';
import DataProductsPage from '../DataProducts/DataProductsPage/DataProductsPage.component';
import AdminProtectedRoute from './AdminProtectedRoute';
import { EntityRouter } from './EntityRouter';
import withSuspenseFallback from './withSuspenseFallback';

const GlobalSettingPage = withSuspenseFallback(
  React.lazy(() => import('../../pages/GlobalSettingPage/GlobalSettingPage'))
);

const GlobalSettingCategoryPage = withSuspenseFallback(
  React.lazy(
    () =>
      import(
        '../../pages/GlobalSettingPage/GlobalSettingCategory/GlobalSettingCategoryPage'
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
const TagsPage = withSuspenseFallback(
  React.lazy(() => import('../../pages/TagsPage/TagsPage'))
);
const ClassificationVersionPage = withSuspenseFallback(
  React.lazy(
    () =>
      import('../../pages/ClassificationVersionPage/ClassificationVersionPage')
  )
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

const GlossaryVersionPage = withSuspenseFallback(
  React.lazy(
    () =>
      import(
        '../../components/Glossary/GlossaryVersion/GlossaryVersion.component'
      )
  )
);

const AddGlossaryPage = withSuspenseFallback(
  React.lazy(() => import('../../pages/AddGlossary/AddGlossaryPage.component'))
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

const GlossaryPage = withSuspenseFallback(
  React.lazy(
    () => import('../../pages/Glossary/GlossaryPage/GlossaryPage.component')
  )
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

const AddRolePage = withSuspenseFallback(
  React.lazy(() => import('../../pages/RolesPage/AddRolePage/AddRolePage'))
);
const AddPolicyPage = withSuspenseFallback(
  React.lazy(
    () => import('../../pages/PoliciesPage/AddPolicyPage/AddPolicyPage')
  )
);

const EditEmailConfigPage = withSuspenseFallback(
  React.lazy(
    () =>
      import('../../pages/EditEmailConfigPage/EditEmailConfigPage.component')
  )
);
const EditCustomLogoConfigPage = withSuspenseFallback(
  React.lazy(
    () => import('../../pages/EditCustomLogoConfig/EditCustomLogoConfig')
  )
);

const AddRulePage = withSuspenseFallback(
  React.lazy(
    () => import('../../pages/PoliciesPage/PoliciesDetailPage/AddRulePage')
  )
);
const EditRulePage = withSuspenseFallback(
  React.lazy(
    () => import('../../pages/PoliciesPage/PoliciesDetailPage/EditRulePage')
  )
);

const LogsViewer = withSuspenseFallback(
  React.lazy(() => import('../../pages/LogsViewer/LogsViewer.component'))
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

const PageNotFound = withSuspenseFallback(
  React.lazy(() => import('../../pages/PageNotFound/PageNotFound'))
);

const EditLoginConfiguration = withSuspenseFallback(
  React.lazy(
    () =>
      import(
        '../../pages/Configuration/EditLoginConfiguration/EditLoginConfigurationPage'
      )
  )
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

const ObservabilityAlertsPage = withSuspenseFallback(
  React.lazy(
    () => import('../../pages/ObservabilityAlertsPage/ObservabilityAlertsPage')
  )
);

const AlertDetailsPage = withSuspenseFallback(
  React.lazy(() => import('../../pages/AlertDetailsPage/AlertDetailsPage'))
);

const NotificationsAlertDetailsPage = () => (
  <AlertDetailsPage isNotificationAlert />
);

const AddObservabilityPage = withSuspenseFallback(
  React.lazy(
    () => import('../../pages/AddObservabilityPage/AddObservabilityPage')
  )
);

// Settings Page Routes

const AddNotificationPage = withSuspenseFallback(
  React.lazy(
    () => import('../../pages/AddNotificationPage/AddNotificationPage')
  )
);

const ImportTeamsPage = withSuspenseFallback(
  React.lazy(
    () => import('../../pages/TeamsPage/ImportTeamsPage/ImportTeamsPage')
  )
);

const AlertsActivityFeedPage = withSuspenseFallback(
  React.lazy(
    () => import('../../pages/AlertsActivityFeedPage/AlertsActivityFeedPage')
  )
);

const NotificationListPage = withSuspenseFallback(
  React.lazy(
    () => import('../../pages/NotificationListPage/NotificationListPage')
  )
);

const TeamsPage = withSuspenseFallback(
  React.lazy(() => import('../../pages/TeamsPage/TeamsPage'))
);

const ServicesPage = withSuspenseFallback(
  React.lazy(() => import('../../pages/ServicesPage/ServicesPage'))
);
const BotsPageV1 = withSuspenseFallback(
  React.lazy(() => import('../../pages/BotsPageV1/BotsPageV1.component'))
);
const CustomPropertiesPageV1 = withSuspenseFallback(
  React.lazy(
    () => import('../../pages/CustomPropertiesPageV1/CustomPropertiesPageV1')
  )
);

const AppDetailsPage = withSuspenseFallback(
  React.lazy(
    () => import('../Settings/Applications/AppDetails/AppDetails.component')
  )
);

const RolesListPage = withSuspenseFallback(
  React.lazy(() => import('../../pages/RolesPage/RolesListPage/RolesListPage'))
);
const RolesDetailPage = withSuspenseFallback(
  React.lazy(
    () => import('../../pages/RolesPage/RolesDetailPage/RolesDetailPage')
  )
);

const PoliciesDetailPage = withSuspenseFallback(
  React.lazy(
    () =>
      import('../../pages/PoliciesPage/PoliciesDetailPage/PoliciesDetailPage')
  )
);
const PoliciesListPage = withSuspenseFallback(
  React.lazy(
    () => import('../../pages/PoliciesPage/PoliciesListPage/PoliciesListPage')
  )
);

const UserListPageV1 = withSuspenseFallback(
  React.lazy(() => import('../../pages/UserListPage/UserListPageV1'))
);

const EmailConfigSettingsPage = withSuspenseFallback(
  React.lazy(
    () =>
      import(
        '../../pages/EmailConfigSettingsPage/EmailConfigSettingsPage.component'
      )
  )
);
const CustomLogoConfigSettingsPage = withSuspenseFallback(
  React.lazy(
    () =>
      import(
        '../../pages/CustomLogoConfigSettingsPage/CustomLogoConfigSettingsPage'
      )
  )
);

const LoginConfigurationPage = withSuspenseFallback(
  React.lazy(
    () =>
      import(
        '../../pages/Configuration/LoginConfigurationDetails/LoginConfigurationPage'
      )
  )
);

const ApplicationPageV1 = withSuspenseFallback(
  React.lazy(() => import('../../pages/Application/ApplicationPage'))
);

const AuthenticatedAppRouter: FunctionComponent = () => {
  const { permissions } = usePermissionProvider();
  const RouteElements = applicationRoutesClass.getRouteElements();

  const glossaryPermission = useMemo(
    () =>
      userPermissions.hasViewPermissions(ResourceEntity.GLOSSARY, permissions),
    [permissions]
  );

  const domainPermission = useMemo(
    () =>
      userPermissions.hasViewPermissions(ResourceEntity.DOMAIN, permissions),
    [permissions]
  );

  const dataProductPermission = useMemo(
    () =>
      userPermissions.hasViewPermissions(
        ResourceEntity.DATA_PRODUCT,
        permissions
      ),
    [permissions]
  );

  const tagCategoryPermission = useMemo(
    () =>
      userPermissions.hasViewPermissions(
        ResourceEntity.CLASSIFICATION,
        permissions
      ),

    [permissions]
  );

  const createBotPermission = useMemo(
    () =>
      checkPermission(Operation.Create, ResourceEntity.USER, permissions) &&
      checkPermission(Operation.Create, ResourceEntity.BOT, permissions),
    [permissions]
  );

  return (
    <Switch>
      <Route exact component={MyDataPage} path={ROUTES.MY_DATA} />
      <Route exact component={TourPageComponent} path={ROUTES.TOUR} />
      <Route exact component={ExplorePageV1} path={ROUTES.EXPLORE} />
      <Route component={ExplorePageV1} path={ROUTES.EXPLORE_WITH_TAB} />
      <Route
        exact
        component={EditConnectionFormPage}
        path={ROUTES.EDIT_SERVICE_CONNECTION}
      />
      <Route exact component={ServicePage} path={ROUTES.SERVICE} />
      <Route exact component={ServicePage} path={ROUTES.SERVICE_WITH_TAB} />
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
      <AdminProtectedRoute
        exact
        component={TagsPage}
        hasPermission={tagCategoryPermission}
        path={ROUTES.TAGS}
      />
      <AdminProtectedRoute
        exact
        component={TagsPage}
        hasPermission={tagCategoryPermission}
        path={ROUTES.TAG_DETAILS}
      />
      <AdminProtectedRoute
        exact
        component={ClassificationVersionPage}
        hasPermission={tagCategoryPermission}
        path={ROUTES.TAG_VERSION}
      />

      <Route
        exact
        component={DataProductsPage}
        path={ROUTES.DATA_PRODUCT_VERSION}
      />
      <Route exact component={DomainVersionPage} path={ROUTES.DOMAIN_VERSION} />
      <Route
        exact
        component={() => <GlossaryVersionPage isGlossary />}
        path={ROUTES.GLOSSARY_VERSION}
      />
      <Route
        exact
        component={GlossaryVersionPage}
        path={ROUTES.GLOSSARY_TERMS_VERSION}
      />
      <Route
        exact
        component={GlossaryVersionPage}
        path={ROUTES.GLOSSARY_TERMS_VERSION_TAB}
      />

      <Route
        exact
        component={ServiceVersionPage}
        path={ROUTES.SERVICE_VERSION}
      />

      <AdminProtectedRoute
        exact
        component={GlossaryPage}
        hasPermission={glossaryPermission}
        path={ROUTES.GLOSSARY}
      />
      <AdminProtectedRoute
        exact
        component={GlossaryPage}
        hasPermission={glossaryPermission}
        path={ROUTES.GLOSSARY_DETAILS}
      />
      <AdminProtectedRoute
        exact
        component={GlossaryPage}
        hasPermission={glossaryPermission}
        path={ROUTES.GLOSSARY_DETAILS_WITH_ACTION}
      />
      <Route exact component={UserPage} path={ROUTES.USER_PROFILE} />
      <Route exact component={UserPage} path={ROUTES.USER_PROFILE_WITH_TAB} />
      <Route
        exact
        component={UserPage}
        path={ROUTES.USER_PROFILE_WITH_SUB_TAB}
      />

      <Route
        exact
        component={UserPage}
        path={ROUTES.USER_PROFILE_WITH_SUB_TAB}
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
        component={DataProductsPage}
        hasPermission={dataProductPermission}
        path={ROUTES.DATA_PRODUCT_DETAILS}
      />
      <AdminProtectedRoute
        exact
        component={DataProductsPage}
        hasPermission={dataProductPermission}
        path={ROUTES.DATA_PRODUCT_DETAILS_WITH_TAB}
      />

      <Route exact component={AddDomain} path={ROUTES.ADD_DOMAIN} />
      <AdminProtectedRoute
        exact
        component={DomainPage}
        hasPermission={domainPermission}
        path={ROUTES.DOMAIN}
      />
      <AdminProtectedRoute
        exact
        component={DomainPage}
        hasPermission={domainPermission}
        path={ROUTES.DOMAIN_DETAILS}
      />
      <AdminProtectedRoute
        exact
        component={DomainPage}
        hasPermission={domainPermission}
        path={ROUTES.DOMAIN_DETAILS_WITH_TAB}
      />

      <Route exact component={AddGlossaryPage} path={ROUTES.ADD_GLOSSARY} />
      <AdminProtectedRoute
        exact
        component={GlossaryPage}
        hasPermission={glossaryPermission}
        path={ROUTES.GLOSSARY_DETAILS_WITH_TAB}
      />
      <AdminProtectedRoute
        exact
        component={GlossaryPage}
        hasPermission={glossaryPermission}
        path={ROUTES.GLOSSARY_DETAILS_WITH_SUBTAB}
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

      {/* keep these route above the setting route always */}
      <AdminProtectedRoute
        exact
        component={AddRolePage}
        hasPermission={checkPermission(
          Operation.Create,
          ResourceEntity.ROLE,
          permissions
        )}
        path={ROUTES.ADD_ROLE}
      />
      <AdminProtectedRoute
        exact
        component={AddPolicyPage}
        hasPermission={checkPermission(
          Operation.Create,
          ResourceEntity.POLICY,
          permissions
        )}
        path={ROUTES.ADD_POLICY}
      />
      <Route exact component={AddRulePage} path={ROUTES.ADD_POLICY_RULE} />
      <AdminProtectedRoute
        exact
        component={EditEmailConfigPage}
        hasPermission={false}
        path={ROUTES.SETTINGS_EDIT_EMAIL_CONFIG}
      />
      <AdminProtectedRoute
        exact
        component={EditCustomLogoConfigPage}
        hasPermission={false}
        path={ROUTES.SETTINGS_EDIT_CUSTOM_LOGO_CONFIG}
      />
      <AdminProtectedRoute
        exact
        component={EditLoginConfiguration}
        hasPermission={false}
        path={ROUTES.SETTINGS_EDIT_CUSTOM_LOGIN_CONFIG}
      />
      <Route exact component={EditRulePage} path={ROUTES.EDIT_POLICY_RULE} />

      <Route
        exact
        component={TestSuiteDetailsPage}
        path={ROUTES.TEST_SUITES_WITH_FQN}
      />
      <Route exact component={LogsViewer} path={ROUTES.LOGS} />
      <Route
        exact
        component={TestSuiteIngestionPage}
        path={ROUTES.TEST_SUITES_ADD_INGESTION}
      />
      <Route
        exact
        component={TestSuiteIngestionPage}
        path={ROUTES.TEST_SUITES_EDIT_INGESTION}
      />
      <AdminProtectedRoute
        exact
        component={DataQualityPage}
        hasPermission={userPermissions.hasViewPermissions(
          ResourceEntity.TEST_SUITE,
          permissions
        )}
        path={ROUTES.DATA_QUALITY_WITH_TAB}
      />
      <AdminProtectedRoute
        exact
        component={DataQualityPage}
        hasPermission={userPermissions.hasViewPermissions(
          ResourceEntity.TEST_SUITE,
          permissions
        )}
        path={ROUTES.DATA_QUALITY}
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
        path={ROUTES.INCIDENT_MANAGER_DETAILS}
      />

      <AdminProtectedRoute
        exact
        component={IncidentManagerDetailPage}
        hasPermission={userPermissions.hasViewPermissions(
          ResourceEntity.TEST_CASE,
          permissions
        )}
        path={ROUTES.INCIDENT_MANAGER_DETAILS_WITH_TAB}
      />

      <AdminProtectedRoute
        exact
        component={ObservabilityAlertsPage}
        path={ROUTES.OBSERVABILITY_ALERTS}
      />

      <AdminProtectedRoute
        exact
        component={AlertDetailsPage}
        path={ROUTES.OBSERVABILITY_ALERT_DETAILS}
      />

      <AdminProtectedRoute
        exact
        component={AddObservabilityPage}
        path={ROUTES.ADD_OBSERVABILITY_ALERTS}
      />

      <AdminProtectedRoute
        exact
        component={AddObservabilityPage}
        path={ROUTES.EDIT_OBSERVABILITY_ALERTS}
      />

      <Route exact component={DataInsightPage} path={ROUTES.DATA_INSIGHT} />
      <Route
        exact
        component={DataInsightPage}
        path={ROUTES.DATA_INSIGHT_WITH_TAB}
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

      <Route exact component={GlobalSettingPage} path={ROUTES.SETTINGS} />

      {/*  Setting routes without any category will be places here */}
      <AdminProtectedRoute
        exact
        component={NotificationListPage}
        hasPermission={false}
        path={getSettingPath(GlobalSettingsMenuCategory.NOTIFICATIONS)}
      />

      <AdminProtectedRoute
        exact
        component={NotificationsAlertDetailsPage}
        path={ROUTES.NOTIFICATION_ALERT_DETAILS}
      />

      <AdminProtectedRoute
        exact
        component={AddNotificationPage}
        hasPermission={false}
        path={getSettingPath(
          GlobalSettingsMenuCategory.NOTIFICATIONS,
          GlobalSettingOptions.EDIT_NOTIFICATION,
          true
        )}
      />
      <AdminProtectedRoute
        exact
        component={AddNotificationPage}
        hasPermission={false}
        path={getSettingPath(
          GlobalSettingsMenuCategory.NOTIFICATIONS,
          GlobalSettingOptions.ADD_NOTIFICATION
        )}
      />
      <AdminProtectedRoute
        exact
        component={BotsPageV1}
        hasPermission={false}
        path={getSettingPath(GlobalSettingOptions.BOTS)}
      />
      <AdminProtectedRoute
        exact
        component={ApplicationPageV1}
        hasPermission={false}
        path={getSettingPath(GlobalSettingOptions.APPLICATIONS)}
      />
      <AdminProtectedRoute
        exact
        component={AppDetailsPage}
        hasPermission={false}
        path={getSettingPath(
          GlobalSettingOptions.APPLICATIONS,
          undefined,
          true
        )}
      />

      {/* Setting Page Routes with categories */}

      <Route
        exact
        component={GlobalSettingCategoryPage}
        path={ROUTES.SETTINGS_WITH_CATEGORY}
      />

      <Route exact path={getSettingPath()}>
        <Redirect to={getTeamsWithFqnPath(TeamType.Organization)} />
      </Route>
      <AdminProtectedRoute
        exact
        component={TeamsPage}
        hasPermission={userPermissions.hasViewPermissions(
          ResourceEntity.TEAM,
          permissions
        )}
        path={getSettingPath(
          GlobalSettingsMenuCategory.MEMBERS,
          GlobalSettingOptions.TEAMS,
          true
        )}
      />
      <AdminProtectedRoute
        exact
        component={ImportTeamsPage}
        hasPermission={userPermissions.hasViewPermissions(
          ResourceEntity.TEAM,
          permissions
        )}
        path={getSettingPath(
          GlobalSettingsMenuCategory.MEMBERS,
          GlobalSettingOptions.TEAMS,
          true,
          true
        )}
      />
      <Route
        path={getSettingPath(
          GlobalSettingsMenuCategory.MEMBERS,
          GlobalSettingOptions.TEAMS
        )}>
        <Redirect to={getTeamsWithFqnPath(TeamType.Organization)} />
      </Route>
      <AdminProtectedRoute
        exact
        component={PersonaPage}
        path={getSettingPath(
          GlobalSettingsMenuCategory.MEMBERS,
          GlobalSettingOptions.PERSONA
        )}
      />
      <AdminProtectedRoute
        exact
        component={PersonaDetailsPage}
        path={getSettingPath(
          GlobalSettingsMenuCategory.MEMBERS,
          GlobalSettingOptions.PERSONA,
          true
        )}
      />
      {/* Roles route start
       * Do not change the order of these route
       */}
      <AdminProtectedRoute
        exact
        component={RolesListPage}
        path={getSettingPath(
          GlobalSettingsMenuCategory.ACCESS,
          GlobalSettingOptions.ROLES
        )}
      />

      <AdminProtectedRoute
        exact
        component={RolesDetailPage}
        path={getSettingPath(
          GlobalSettingsMenuCategory.ACCESS,
          GlobalSettingOptions.ROLES,
          true
        )}
      />
      {/* Roles route end
       * Do not change the order of these route
       */}

      <AdminProtectedRoute
        exact
        component={PoliciesListPage}
        path={getSettingPath(
          GlobalSettingsMenuCategory.ACCESS,
          GlobalSettingOptions.POLICIES
        )}
      />
      <AdminProtectedRoute
        exact
        component={PoliciesDetailPage}
        path={getSettingPath(
          GlobalSettingsMenuCategory.ACCESS,
          GlobalSettingOptions.POLICIES,
          true
        )}
      />
      <AdminProtectedRoute
        exact
        component={UserListPageV1}
        hasPermission={userPermissions.hasViewPermissions(
          ResourceEntity.USER,
          permissions
        )}
        path={getSettingCategoryPath(GlobalSettingsMenuCategory.MEMBERS)}
      />
      <AdminProtectedRoute
        exact
        component={EmailConfigSettingsPage}
        hasPermission={false}
        path={getSettingPath(
          GlobalSettingsMenuCategory.OPEN_METADATA,
          GlobalSettingOptions.EMAIL
        )}
      />
      <AdminProtectedRoute
        exact
        component={CustomLogoConfigSettingsPage}
        hasPermission={false}
        path={getSettingPath(
          GlobalSettingsMenuCategory.OPEN_METADATA,
          GlobalSettingOptions.CUSTOM_LOGO
        )}
      />
      <AdminProtectedRoute
        exact
        component={LoginConfigurationPage}
        hasPermission={false}
        path={getSettingPath(
          GlobalSettingsMenuCategory.OPEN_METADATA,
          GlobalSettingOptions.LOGIN_CONFIGURATION
        )}
      />
      <AdminProtectedRoute
        exact
        component={CustomPageSettings}
        path={getSettingPath(
          GlobalSettingsMenuCategory.OPEN_METADATA,
          GlobalSettingOptions.CUSTOMIZE_LANDING_PAGE
        )}
      />

      <Route
        exact
        component={ServicesPage}
        path={getSettingCategoryPath(GlobalSettingsMenuCategory.SERVICES)}
      />

      <AdminProtectedRoute
        exact
        component={AlertsActivityFeedPage}
        hasPermission={false}
        path={getSettingPath(
          GlobalSettingsMenuCategory.NOTIFICATIONS,
          GlobalSettingOptions.ACTIVITY_FEED
        )}
      />

      <AdminProtectedRoute
        exact
        component={CustomPropertiesPageV1}
        hasPermission={false}
        path={getSettingCategoryPath(
          GlobalSettingsMenuCategory.CUSTOM_PROPERTIES
        )}
      />
      {RouteElements && <RouteElements />}
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
      <EntityRouter />
      <Route exact component={PageNotFound} path={ROUTES.NOT_FOUND} />
      <Redirect to={ROUTES.NOT_FOUND} />
    </Switch>
  );
};

export default AuthenticatedAppRouter;
