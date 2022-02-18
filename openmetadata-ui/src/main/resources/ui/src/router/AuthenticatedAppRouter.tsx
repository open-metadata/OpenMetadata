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
import { ROUTES } from '../constants/constants';
import { useAuth } from '../hooks/authHooks';
import AddWebhookPage from '../pages/AddWebhookPage/AddWebhookPage.component';
import DashboardDetailsPage from '../pages/DashboardDetailsPage/DashboardDetailsPage.component';
import DatabaseDetails from '../pages/database-details/index';
import DatasetDetailsPage from '../pages/DatasetDetailsPage/DatasetDetailsPage.component';
import EditWebhookPage from '../pages/EditWebhookPage/EditWebhookPage.component';
import EntityVersionPage from '../pages/EntityVersionPage/EntityVersionPage.component';
import ExplorePage from '../pages/explore/ExplorePage.component';
import MyDataPage from '../pages/MyDataPage/MyDataPage.component';
import PipelineDetailsPage from '../pages/PipelineDetails/PipelineDetailsPage.component';
import RolesPage from '../pages/RolesPage/RolesPage.component';
import ServicePage from '../pages/service';
import ServicesPage from '../pages/services';
import SignupPage from '../pages/signup';
import SwaggerPage from '../pages/swagger';
import TagsPage from '../pages/tags';
import TeamsPage from '../pages/teams';
import TopicDetailsPage from '../pages/TopicDetails/TopicDetailsPage.component';
import TourPageComponent from '../pages/tour-page/TourPage.component';
import UserListPage from '../pages/UserListPage/UserListPage';
import WebhooksPage from '../pages/WebhooksPage/WebhooksPage.component';
const AuthenticatedAppRouter: FunctionComponent = () => {
  const { isAuthDisabled, isAdminUser } = useAuth();

  return (
    <Switch>
      <Route exact component={MyDataPage} path={ROUTES.MY_DATA} />
      <Route exact component={TourPageComponent} path={ROUTES.TOUR} />
      <Route exact component={ExplorePage} path={ROUTES.EXPLORE} />
      <Route component={ExplorePage} path={ROUTES.EXPLORE_WITH_SEARCH} />
      <Route component={ExplorePage} path={ROUTES.EXPLORE_WITH_TAB} />
      <Route exact component={TeamsPage} path={ROUTES.TEAMS} />
      <Route exact component={TeamsPage} path={ROUTES.TEAM_DETAILS} />
      <Route exact component={ServicesPage} path={ROUTES.SERVICES} />
      <Route component={ServicePage} path={ROUTES.SERVICE} />
      <Route exact component={SignupPage} path={ROUTES.SIGNUP}>
        {!isEmpty(AppState.userDetails) && <Redirect to={ROUTES.HOME} />}
      </Route>
      <Route exact component={SwaggerPage} path={ROUTES.SWAGGER} />
      <Route exact component={TagsPage} path={ROUTES.TAGS} />
      <Route component={DatabaseDetails} path={ROUTES.DATABASE_DETAILS} />
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
      {isAuthDisabled || isAdminUser ? (
        <>
          <Route exact component={AddWebhookPage} path={ROUTES.ADD_WEBHOOK} />
          <Route exact component={RolesPage} path={ROUTES.ROLES} />
          <Route exact component={UserListPage} path={ROUTES.USER_LIST} />
        </>
      ) : null}

      <Redirect to={ROUTES.NOT_FOUND} />
    </Switch>
  );
};

export default AuthenticatedAppRouter;
