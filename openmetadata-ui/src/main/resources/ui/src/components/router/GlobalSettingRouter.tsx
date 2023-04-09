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

import React from 'react';
import { Redirect, Route, Switch } from 'react-router-dom';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../constants/GlobalSettings.constants';

import { TeamType } from '../../generated/entity/teams/team';
import { userPermissions } from '../../utils/PermissionsUtils';
import {
  getSettingCategoryPath,
  getSettingPath,
  getTeamsWithFqnPath,
} from '../../utils/RouterUtils';
import { usePermissionProvider } from '../PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../PermissionProvider/PermissionProvider.interface';

import AdminProtectedRoute from './AdminProtectedRoute';
import withSuspenseFallback from './withSuspenseFallback';

const AddAlertPage = withSuspenseFallback(
  React.lazy(() => import('pages/AddAlertPage/AddAlertPage'))
);

const AlertDetailsPage = withSuspenseFallback(
  React.lazy(() => import('pages/AlertDetailsPage/AlertDetailsPage'))
);

const AlertsActivityFeedPage = withSuspenseFallback(
  React.lazy(
    () => import('pages/AlertsActivityFeedPage/AlertsActivityFeedPage')
  )
);

const AlertsPage = withSuspenseFallback(
  React.lazy(() => import('pages/AlertsPage/AlertsPage'))
);

const TeamsPage = withSuspenseFallback(
  React.lazy(() => import('pages/teams/TeamsPage'))
);

const ServicesPage = withSuspenseFallback(
  React.lazy(() => import('pages/services/ServicesPage'))
);
const BotsPageV1 = withSuspenseFallback(
  React.lazy(() => import('pages/BotsPageV1/BotsPageV1.component'))
);
const CustomPropertiesPageV1 = withSuspenseFallback(
  React.lazy(
    () => import('pages/CustomPropertiesPageV1/CustomPropertiesPageV1')
  )
);
const RolesListPage = withSuspenseFallback(
  React.lazy(() => import('pages/RolesPage/RolesListPage/RolesListPage'))
);
const RolesDetailPage = withSuspenseFallback(
  React.lazy(() => import('pages/RolesPage/RolesDetailPage/RolesDetailPage'))
);

const PoliciesDetailPage = withSuspenseFallback(
  React.lazy(
    () => import('pages/PoliciesPage/PoliciesDetailPage/PoliciesDetailPage')
  )
);
const PoliciesListPage = withSuspenseFallback(
  React.lazy(
    () => import('pages/PoliciesPage/PoliciesListPage/PoliciesListPage')
  )
);

const UserListPageV1 = withSuspenseFallback(
  React.lazy(() => import('pages/UserListPage/UserListPageV1'))
);

const ElasticSearchIndexPage = withSuspenseFallback(
  React.lazy(
    () =>
      import('pages/ElasticSearchIndexPage/ElasticSearchReIndexPage.component')
  )
);

const DataInsightsSettingsPage = withSuspenseFallback(
  React.lazy(
    () =>
      import(
        'pages/DataInsightsSettingsPage/DataInsightsSettingsPage.component'
      )
  )
);

const EmailConfigSettingsPage = withSuspenseFallback(
  React.lazy(
    () =>
      import('pages/EmailConfigSettingsPage/EmailConfigSettingsPage.component')
  )
);

const GlobalSettingRouter = () => {
  const { permissions } = usePermissionProvider();

  return (
    <Switch>
      <Route exact path={getSettingPath()}>
        <Redirect to={getTeamsWithFqnPath(TeamType.Organization)} />
      </Route>
      <Route
        exact
        component={TeamsPage}
        path={getSettingPath(
          GlobalSettingsMenuCategory.MEMBERS,
          GlobalSettingOptions.TEAMS,
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
      {/* Roles route start
       * Do not change the order of these route
       */}
      <AdminProtectedRoute
        exact
        component={RolesListPage}
        hasPermission={userPermissions.hasViewPermissions(
          ResourceEntity.ROLE,
          permissions
        )}
        path={getSettingPath(
          GlobalSettingsMenuCategory.ACCESS,
          GlobalSettingOptions.ROLES
        )}
      />

      <Route
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
        hasPermission={userPermissions.hasViewPermissions(
          ResourceEntity.POLICY,
          permissions
        )}
        path={getSettingPath(
          GlobalSettingsMenuCategory.ACCESS,
          GlobalSettingOptions.POLICIES
        )}
      />
      <Route
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
        component={BotsPageV1}
        hasPermission={userPermissions.hasViewPermissions(
          ResourceEntity.BOT,
          permissions
        )}
        path={getSettingPath(
          GlobalSettingsMenuCategory.INTEGRATIONS,
          GlobalSettingOptions.BOTS
        )}
      />

      <AdminProtectedRoute
        exact
        component={ElasticSearchIndexPage}
        hasPermission={false}
        path={getSettingPath(
          GlobalSettingsMenuCategory.OPEN_METADATA,
          GlobalSettingOptions.SEARCH
        )}
      />

      <AdminProtectedRoute
        exact
        component={DataInsightsSettingsPage}
        hasPermission={false}
        path={getSettingPath(
          GlobalSettingsMenuCategory.OPEN_METADATA,
          GlobalSettingOptions.DATA_INSIGHT
        )}
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

      <Route
        exact
        component={ServicesPage}
        path={getSettingCategoryPath(GlobalSettingsMenuCategory.SERVICES)}
      />

      <AdminProtectedRoute
        exact
        component={AlertsPage}
        hasPermission={false}
        path={getSettingPath(
          GlobalSettingsMenuCategory.NOTIFICATIONS,
          GlobalSettingOptions.ALERTS
        )}
      />

      <AdminProtectedRoute
        exact
        component={AddAlertPage}
        hasPermission={false}
        path={getSettingPath(
          GlobalSettingsMenuCategory.NOTIFICATIONS,
          GlobalSettingOptions.EDIT_ALERTS,
          true
        )}
      />
      <AdminProtectedRoute
        exact
        component={AddAlertPage}
        hasPermission={false}
        path={getSettingPath(
          GlobalSettingsMenuCategory.NOTIFICATIONS,
          GlobalSettingOptions.ADD_ALERTS
        )}
      />

      <AdminProtectedRoute
        exact
        component={AlertDetailsPage}
        hasPermission={false}
        path={getSettingPath(
          GlobalSettingsMenuCategory.NOTIFICATIONS,
          GlobalSettingOptions.ALERT,
          true
        )}
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
        hasPermission={userPermissions.hasViewPermissions(
          ResourceEntity.TYPE,
          permissions
        )}
        path={getSettingCategoryPath(
          GlobalSettingsMenuCategory.CUSTOM_ATTRIBUTES
        )}
      />
    </Switch>
  );
};

export default GlobalSettingRouter;
