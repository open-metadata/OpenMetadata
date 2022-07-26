/*
 *  Copyright 2022 Collate
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

import React from 'react';
import { Redirect, Route, Switch } from 'react-router-dom';
import { GlobalSettingOptions } from '../constants/globalSettings.constants';
import { getSettingPath } from '../utils/RouterUtils';
import withSuspenseFallback from './withSuspenseFallback';

const WebhooksPageV1 = withSuspenseFallback(
  React.lazy(() => import('../pages/WebhooksPage/WebhooksPageV1.component'))
);
const ServicesPage = withSuspenseFallback(
  React.lazy(() => import('../pages/services/ServicesPage'))
);

const GlobalSettingRouter = () => {
  return (
    <Switch>
      <Route exact path={getSettingPath()}>
        <Redirect to={getSettingPath(GlobalSettingOptions.TEAMS)} />
      </Route>
      <Route
        exact
        component={WebhooksPageV1}
        path={getSettingPath(GlobalSettingOptions.WEBHOOK)}
      />
      <Route
        exact
        component={ServicesPage}
        path={getSettingPath(GlobalSettingOptions.DATABASES)}
      />
      <Route
        exact
        component={ServicesPage}
        path={getSettingPath(GlobalSettingOptions.MESSAGING)}
      />
      <Route
        exact
        component={ServicesPage}
        path={getSettingPath(GlobalSettingOptions.MLMODELS)}
      />
      <Route
        exact
        component={ServicesPage}
        path={getSettingPath(GlobalSettingOptions.PIPELINES)}
      />
      <Route
        exact
        component={ServicesPage}
        path={getSettingPath(GlobalSettingOptions.DASHBOARDS)}
      />
    </Switch>
  );
};

export default GlobalSettingRouter;
