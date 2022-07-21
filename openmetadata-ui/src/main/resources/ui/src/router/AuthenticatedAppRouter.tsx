/*
 *  Copyright 2021 Collate
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

import { isEmpty } from 'lodash';
import React, { FunctionComponent } from 'react';
import { Redirect, Route, Switch } from 'react-router-dom';
import AppState from '../AppState';
import AddCustomProperty from '../components/CustomEntityDetail/AddCustomProperty/AddCustomProperty';
import { ROUTES } from '../constants/constants';
import GlobalSettingPage from '../pages/GlobalSettingPage/GlobalSettingPage';
import withSuspenseFallback from './withSuspenseFallback';

const MyDataPage = withSuspenseFallback(
  React.lazy(() => import('../pages/MyDataPage/MyDataPage.component'))
);

const PipelineDetailsPage = withSuspenseFallback(
  React.lazy(
    () => import('../pages/PipelineDetails/PipelineDetailsPage.component')
  )
);

const RolesPage = withSuspenseFallback(
  React.lazy(() => import('../pages/RolesPage/RolesPage.component'))
);
const ServicePage = withSuspenseFallback(
  React.lazy(() => import('../pages/service'))
);
const ServicesPage = withSuspenseFallback(
  React.lazy(() => import('../pages/services'))
);
const SignupPage = withSuspenseFallback(
  React.lazy(() => import('../pages/signup'))
);
const SwaggerPage = withSuspenseFallback(
  React.lazy(() => import('../pages/swagger'))
);
const TagsPage = withSuspenseFallback(
  React.lazy(() => import('../pages/tags'))
);
const TeamsAndUsersPage = withSuspenseFallback(
  React.lazy(
    () => import('../pages/TeamsAndUsersPage/TeamsAndUsersPage.component')
  )
);
const TopicDetailsPage = withSuspenseFallback(
  React.lazy(() => import('../pages/TopicDetails/TopicDetailsPage.component'))
);
const TourPageComponent = withSuspenseFallback(
  React.lazy(() => import('../pages/tour-page/TourPage.component'))
);
const UserPage = withSuspenseFallback(
  React.lazy(() => import('../pages/UserPage/UserPage.component'))
);
const WebhooksPage = withSuspenseFallback(
  React.lazy(() => import('../pages/WebhooksPage/WebhooksPage.component'))
);
const AdminProtectedRoute = withSuspenseFallback(
  React.lazy(() => import('./AdminProtectedRoute'))
);

const AddGlossaryPage = withSuspenseFallback(
  React.lazy(() => import('../pages/AddGlossary/AddGlossaryPage.component'))
);
const AddGlossaryTermPage = withSuspenseFallback(
  React.lazy(
    () => import('../pages/AddGlossaryTermPage/AddGlossaryTermPage.component')
  )
);
const AddIngestionPage = withSuspenseFallback(
  React.lazy(
    () => import('../pages/AddIngestionPage/AddIngestionPage.component')
  )
);
const AddServicePage = withSuspenseFallback(
  React.lazy(() => import('../pages/AddServicePage/AddServicePage.component'))
);
const EditConnectionFormPage = withSuspenseFallback(
  React.lazy(
    () =>
      import('../pages/EditConnectionFormPage/EditConnectionFormPage.component')
  )
);
const AddWebhookPage = withSuspenseFallback(
  React.lazy(() => import('../pages/AddWebhookPage/AddWebhookPage.component'))
);
const BotsListPage = withSuspenseFallback(
  React.lazy(() => import('../pages/BotsListpage/BotsListpage.component'))
);
const BotsPage = withSuspenseFallback(
  React.lazy(() => import('../pages/BotsPage/BotsPage.component'))
);
const CreateUserPage = withSuspenseFallback(
  React.lazy(() => import('../pages/CreateUserPage/CreateUserPage.component'))
);
const DashboardDetailsPage = withSuspenseFallback(
  React.lazy(
    () => import('../pages/DashboardDetailsPage/DashboardDetailsPage.component')
  )
);
const DatabaseDetails = withSuspenseFallback(
  React.lazy(() => import('../pages/database-details/index'))
);
const DatabaseSchemaPageComponent = withSuspenseFallback(
  React.lazy(
    () => import('../pages/DatabaseSchemaPage/DatabaseSchemaPage.component')
  )
);
const DatasetDetailsPage = withSuspenseFallback(
  React.lazy(
    () => import('../pages/DatasetDetailsPage/DatasetDetailsPage.component')
  )
);
const EditIngestionPage = withSuspenseFallback(
  React.lazy(
    () => import('../pages/EditIngestionPage/EditIngestionPage.component')
  )
);
const EditWebhookPage = withSuspenseFallback(
  React.lazy(() => import('../pages/EditWebhookPage/EditWebhookPage.component'))
);
const EntityVersionPage = withSuspenseFallback(
  React.lazy(
    () => import('../pages/EntityVersionPage/EntityVersionPage.component')
  )
);
const ExplorePage = withSuspenseFallback(
  React.lazy(() => import('../pages/explore/ExplorePage.component'))
);
const GlossaryPageV1 = withSuspenseFallback(
  React.lazy(() => import('../pages/GlossaryPage/GlossaryPageV1.component'))
);

const MlModelPage = withSuspenseFallback(
  React.lazy(() => import('../pages/MlModelPage/MlModelPage.component'))
);

const CustomPropertiesPage = withSuspenseFallback(
  React.lazy(() => import('../pages/CustomPropertiesPage/CustomPropertiesPage'))
);

const RequestDescriptionPage = withSuspenseFallback(
  React.lazy(
    () =>
      import('../pages/TasksPage/RequestDescriptionPage/RequestDescriptionPage')
  )
);

const RequestTagsPage = withSuspenseFallback(
  React.lazy(() => import('../pages/TasksPage/RequestTagPage/RequestTagPage'))
);

const UpdateDescriptionPage = withSuspenseFallback(
  React.lazy(
    () =>
      import('../pages/TasksPage/UpdateDescriptionPage/UpdateDescriptionPage')
  )
);

const UpdateTagsPage = withSuspenseFallback(
  React.lazy(() => import('../pages/TasksPage/UpdateTagPage/UpdateTagPage'))
);

const TaskDetailPage = withSuspenseFallback(
  React.lazy(() => import('../pages/TasksPage/TaskDetailPage/TaskDetailPage'))
);

const AuthenticatedAppRouter: FunctionComponent = () => {
  return (
    <Switch>
      <Route exact component={MyDataPage} path={ROUTES.MY_DATA} />
      <Route exact component={TourPageComponent} path={ROUTES.TOUR} />
      <Route exact component={ExplorePage} path={ROUTES.EXPLORE} />
      <Route component={ExplorePage} path={ROUTES.EXPLORE_WITH_SEARCH} />
      <Route component={ExplorePage} path={ROUTES.EXPLORE_WITH_TAB} />
      <Route
        exact
        component={TeamsAndUsersPage}
        path={ROUTES.TEAMS_AND_USERS}
      />
      <Route
        exact
        component={TeamsAndUsersPage}
        path={ROUTES.TEAMS_AND_USERS_DETAILS}
      />
      <Route
        exact
        component={EditConnectionFormPage}
        path={ROUTES.EDIT_SERVICE_CONNECTION}
      />
      <Route exact component={ServicesPage} path={ROUTES.SERVICES} />
      <Route exact component={ServicesPage} path={ROUTES.SERVICES_WITH_TAB} />
      <Route exact component={ServicePage} path={ROUTES.SERVICE} />
      <Route exact component={ServicePage} path={ROUTES.SERVICE_WITH_TAB} />
      <Route exact component={AddServicePage} path={ROUTES.ADD_SERVICE} />
      <AdminProtectedRoute
        exact
        component={AddIngestionPage}
        path={ROUTES.ADD_INGESTION}
      />
      <AdminProtectedRoute
        exact
        component={EditIngestionPage}
        path={ROUTES.EDIT_INGESTION}
      />
      <Route exact component={SignupPage} path={ROUTES.SIGNUP}>
        {!isEmpty(AppState.userDetails) && <Redirect to={ROUTES.HOME} />}
      </Route>
      <Route exact component={SwaggerPage} path={ROUTES.SWAGGER} />
      <Route exact component={TagsPage} path={ROUTES.TAGS} />
      <Route exact component={DatabaseDetails} path={ROUTES.DATABASE_DETAILS} />
      <Route
        exact
        component={DatabaseDetails}
        path={ROUTES.DATABASE_DETAILS_WITH_TAB}
      />
      <Route
        exact
        component={DatabaseSchemaPageComponent}
        path={ROUTES.SCHEMA_DETAILS}
      />
      <Route
        exact
        component={DatabaseSchemaPageComponent}
        path={ROUTES.SCHEMA_DETAILS_WITH_TAB}
      />
      <Route exact component={DatasetDetailsPage} path={ROUTES.TABLE_DETAILS} />
      <Route
        exact
        component={DatasetDetailsPage}
        path={ROUTES.TABLE_DETAILS_WITH_TAB}
      />
      <Route exact component={TopicDetailsPage} path={ROUTES.TOPIC_DETAILS} />
      <Route
        exact
        component={TopicDetailsPage}
        path={ROUTES.TOPIC_DETAILS_WITH_TAB}
      />
      <Route
        exact
        component={DashboardDetailsPage}
        path={ROUTES.DASHBOARD_DETAILS}
      />
      <Route
        exact
        component={DashboardDetailsPage}
        path={ROUTES.DASHBOARD_DETAILS_WITH_TAB}
      />
      <Route
        exact
        component={PipelineDetailsPage}
        path={ROUTES.PIPELINE_DETAILS}
      />
      <Route
        exact
        component={PipelineDetailsPage}
        path={ROUTES.PIPELINE_DETAILS_WITH_TAB}
      />
      <Route exact component={EntityVersionPage} path={ROUTES.ENTITY_VERSION} />
      <Route exact component={WebhooksPage} path={ROUTES.WEBHOOKS} />
      <Route exact component={EditWebhookPage} path={ROUTES.EDIT_WEBHOOK} />
      <Route exact component={GlossaryPageV1} path={ROUTES.GLOSSARY} />
      <Route exact component={GlossaryPageV1} path={ROUTES.GLOSSARY_DETAILS} />
      <Route exact component={GlossaryPageV1} path={ROUTES.GLOSSARY_TERMS} />
      <Route exact component={UserPage} path={ROUTES.USER_PROFILE} />
      <Route exact component={UserPage} path={ROUTES.USER_PROFILE_WITH_TAB} />
      <Route exact component={MlModelPage} path={ROUTES.MLMODEL_DETAILS} />
      <Route
        exact
        component={MlModelPage}
        path={ROUTES.MLMODEL_DETAILS_WITH_TAB}
      />
      <AdminProtectedRoute
        exact
        component={AddGlossaryPage}
        path={ROUTES.ADD_GLOSSARY}
      />
      <AdminProtectedRoute
        exact
        component={AddGlossaryTermPage}
        path={ROUTES.ADD_GLOSSARY_TERMS_CHILD}
      />
      <AdminProtectedRoute
        exact
        component={AddGlossaryTermPage}
        path={ROUTES.ADD_GLOSSARY_TERMS}
      />
      <AdminProtectedRoute
        exact
        component={AddWebhookPage}
        path={ROUTES.ADD_WEBHOOK}
      />
      <AdminProtectedRoute exact component={RolesPage} path={ROUTES.ROLES} />
      <AdminProtectedRoute
        exact
        component={CreateUserPage}
        path={ROUTES.CREATE_USER}
      />
      <AdminProtectedRoute exact component={BotsListPage} path={ROUTES.BOTS} />
      <AdminProtectedRoute
        exact
        component={BotsPage}
        path={ROUTES.BOTS_PROFILE}
      />
      <AdminProtectedRoute
        exact
        component={CustomPropertiesPage}
        path={ROUTES.CUSTOM_PROPERTIES}
      />
      <AdminProtectedRoute
        exact
        component={CustomPropertiesPage}
        path={ROUTES.CUSTOM_ENTITY_DETAIL}
      />
      <AdminProtectedRoute
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

      <Route exact component={TaskDetailPage} path={ROUTES.TASK_DETAIL} />
      <Route exact component={RequestTagsPage} path={ROUTES.REQUEST_TAGS} />
      <Route exact component={UpdateTagsPage} path={ROUTES.UPDATE_TAGS} />
      <Route exact component={GlobalSettingPage} path={ROUTES.SETTINGS} />
      <Route
        exact
        component={GlobalSettingPage}
        path={ROUTES.SETTINGS_WITH_TAB}
      />

      <Redirect to={ROUTES.NOT_FOUND} />
    </Switch>
  );
};

export default AuthenticatedAppRouter;
