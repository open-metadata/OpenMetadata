/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

import { isEmpty } from 'lodash';
import React, { FunctionComponent } from 'react';
import { Redirect, Route, Switch } from 'react-router-dom';
import AppState from '../AppState';
import Onboarding from '../components/onboarding/Onboarding'; // Remove this route once Onboarding is added to my-data
import { ROUTES } from '../constants/constants';
import MyDashBoardPage from '../pages/dashboard-details';
import DatabaseDetails from '../pages/database-details/index';
import ExplorePage from '../pages/explore';
import MyDataPage from '../pages/my-data';
import MyDataDetailsPage from '../pages/my-data-details';
import MyPipelinePage from '../pages/Pipeline-details';
import ReportsPage from '../pages/reports';
import Scorecard from '../pages/scorecard';
import ServicePage from '../pages/service';
import ServicesPage from '../pages/services';
import SettingsPage from '../pages/settings';
import SignupPage from '../pages/signup';
import SQLBuilderPage from '../pages/sql-builder';
import StorePage from '../pages/store';
import SwaggerPage from '../pages/swagger';
import TagsPage from '../pages/tags';
import TeamsPage from '../pages/teams';
import MyTopicDetailPage from '../pages/topic-details';
import UsersPage from '../pages/users';
import WorkflowsPage from '../pages/workflows';
const AuthenticatedAppRouter: FunctionComponent = () => {
  return (
    <Switch>
      <Route exact component={MyDataPage} path={ROUTES.MY_DATA} />
      <Route exact component={ReportsPage} path={ROUTES.REPORTS} />
      <Route exact component={ExplorePage} path={ROUTES.EXPLORE} />
      <Route component={ExplorePage} path={ROUTES.EXPLORE_WITH_SEARCH} />
      <Route component={ExplorePage} path={ROUTES.EXPLORE_WITH_TAB} />
      <Route exact component={WorkflowsPage} path={ROUTES.WORKFLOWS} />
      <Route exact component={SQLBuilderPage} path={ROUTES.SQL_BUILDER} />
      <Route exact component={TeamsPage} path={ROUTES.TEAMS} />
      <Route exact component={TeamsPage} path={ROUTES.TEAM_DETAILS} />
      <Route exact component={SettingsPage} path={ROUTES.SETTINGS} />
      <Route exact component={StorePage} path={ROUTES.STORE} />
      {/* <Route exact component={FeedsPage} path={ROUTES.FEEDS} /> */}
      <Route exact component={ServicesPage} path={ROUTES.SERVICES} />
      <Route component={ServicePage} path={ROUTES.SERVICE} />
      <Route exact component={UsersPage} path={ROUTES.USERS} />
      <Route exact component={Scorecard} path={ROUTES.SCORECARD} />
      <Route exact component={SignupPage} path={ROUTES.SIGNUP}>
        {!isEmpty(AppState.userDetails) && <Redirect to={ROUTES.HOME} />}
      </Route>
      <Route exact component={SwaggerPage} path={ROUTES.SWAGGER} />
      <Route exact component={TagsPage} path={ROUTES.TAGS} />
      <Route component={DatabaseDetails} path={ROUTES.DATABASE_DETAILS} />
      <Route component={MyDataDetailsPage} path={ROUTES.DATASET_DETAILS} />
      <Route component={MyTopicDetailPage} path={ROUTES.TOPIC_DETAILS} />
      <Route component={MyDashBoardPage} path={ROUTES.DASHBOARD_DETAILS} />
      <Route component={MyPipelinePage} path={ROUTES.PIPELINE_DETAILS} />
      <Route component={Onboarding} path={ROUTES.ONBOARDING} />
      <Redirect to={ROUTES.NOT_FOUND} />
    </Switch>
  );
};

export default AuthenticatedAppRouter;
