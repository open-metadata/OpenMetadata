import { isEmpty } from 'lodash';
import React, { FunctionComponent } from 'react';
import { Redirect, Route, Switch } from 'react-router-dom';
import AppState from '../AppState';
import Onboarding from '../components/onboarding/Onboarding'; // Remove this route once Onboarding is added to my-data
import { ROUTES } from '../constants/constants';
import DatabaseDetails from '../pages/database-details/index';
import ExplorePage from '../pages/explore';
import MyDataPage from '../pages/my-data';
import MyDataDetailsPage from '../pages/my-data-details';
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
import UsersPage from '../pages/users';
import WorkflowsPage from '../pages/workflows';
const AuthenticatedAppRouter: FunctionComponent = () => {
  return (
    <Switch>
      <Route exact component={MyDataPage} path={ROUTES.MY_DATA} />
      <Route exact component={ReportsPage} path={ROUTES.REPORTS} />
      <Route exact component={ExplorePage} path={ROUTES.EXPLORE} />
      <Route component={ExplorePage} path={ROUTES.EXPLORE_WITH_SEARCH} />
      <Route exact component={WorkflowsPage} path={ROUTES.WORKFLOWS} />
      <Route exact component={SQLBuilderPage} path={ROUTES.SQL_BUILDER} />
      <Route exact component={TeamsPage} path={ROUTES.TEAMS} />
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
      <Route component={Onboarding} path={ROUTES.ONBOARDING} />
      <Redirect to={ROUTES.NOT_FOUND} />
    </Switch>
  );
};

export default AuthenticatedAppRouter;
