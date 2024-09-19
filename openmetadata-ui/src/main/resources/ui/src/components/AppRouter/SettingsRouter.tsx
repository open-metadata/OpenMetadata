/*
 *  Copyright 2024 Collate.
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
import { Navigate, Route, Routes } from 'react-router-dom';
import { ROUTES_RELATIVE } from '../../constants/constants';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../constants/GlobalSettings.constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../context/PermissionProvider/PermissionProvider.interface';
import { Operation } from '../../generated/entity/policies/accessControl/resourcePermission';
import { TeamType } from '../../generated/entity/teams/team';
import AddNotificationPage from '../../pages/AddNotificationPage/AddNotificationPage';
import AlertDetailsPage from '../../pages/AlertDetailsPage/AlertDetailsPage';
import AlertsActivityFeedPage from '../../pages/AlertsActivityFeedPage/AlertsActivityFeedPage';
import AppearanceConfigSettingsPage from '../../pages/AppearanceConfigSettingsPage/AppearanceConfigSettingsPage';
import ApplicationPage from '../../pages/Application/ApplicationPage';
import BotsPageV1 from '../../pages/BotsPageV1/BotsPageV1.component';
import EditLoginConfiguration from '../../pages/Configuration/EditLoginConfiguration/EditLoginConfigurationPage';
import LoginConfigurationPage from '../../pages/Configuration/LoginConfigurationDetails/LoginConfigurationPage';
import { CustomPageSettings } from '../../pages/CustomPageSettings/CustomPageSettings';
import CustomPropertiesPageV1 from '../../pages/CustomPropertiesPageV1/CustomPropertiesPageV1';
import EditEmailConfigPage from '../../pages/EditEmailConfigPage/EditEmailConfigPage.component';
import EmailConfigSettingsPage from '../../pages/EmailConfigSettingsPage/EmailConfigSettingsPage.component';
import GlobalSettingCategoryPage from '../../pages/GlobalSettingPage/GlobalSettingCategory/GlobalSettingCategoryPage';
import GlobalSettingPage from '../../pages/GlobalSettingPage/GlobalSettingPage';
import NotificationListPage from '../../pages/NotificationListPage/NotificationListPage';
import OmHealthPage from '../../pages/OmHealth/OmHealthPage';
import { PersonaDetailsPage } from '../../pages/Persona/PersonaDetailsPage/PersonaDetailsPage';
import { PersonaPage } from '../../pages/Persona/PersonaListPage/PersonaPage';
import AddPolicyPage from '../../pages/PoliciesPage/AddPolicyPage/AddPolicyPage';
import AddRulePage from '../../pages/PoliciesPage/PoliciesDetailPage/AddRulePage';
import EditRulePage from '../../pages/PoliciesPage/PoliciesDetailPage/EditRulePage';
import PoliciesDetailPage from '../../pages/PoliciesPage/PoliciesDetailPage/PoliciesDetailPage';
import PoliciesListPage from '../../pages/PoliciesPage/PoliciesListPage/PoliciesListPage';
import ProfilerConfigurationPage from '../../pages/ProfilerConfigurationPage/ProfilerConfigurationPage';
import AddRolePage from '../../pages/RolesPage/AddRolePage/AddRolePage';
import RolesDetailPage from '../../pages/RolesPage/RolesDetailPage/RolesDetailPage';
import RolesListPage from '../../pages/RolesPage/RolesListPage/RolesListPage';
import ServicesPage from '../../pages/ServicesPage/ServicesPage';
import ImportTeamsPage from '../../pages/TeamsPage/ImportTeamsPage/ImportTeamsPage';
import TeamsPage from '../../pages/TeamsPage/TeamsPage';
import UserListPageV1 from '../../pages/UserListPage/UserListPageV1';
import { checkPermission, userPermissions } from '../../utils/PermissionsUtils';
import {
  getSettingCategoryPath,
  getSettingPath,
  getTeamsWithFqnPath,
} from '../../utils/RouterUtils';
import AppDetails from '../Settings/Applications/AppDetails/AppDetails.component';
import AdminProtectedRoute from './AdminProtectedRoute';

const SettingsRouter = () => {
  const { permissions } = usePermissionProvider();

  return (
    <Routes>
      <Route element={<GlobalSettingPage />} path="/" />

      <Route
        element={
          <AdminProtectedRoute
            hasPermission={checkPermission(
              Operation.Create,
              ResourceEntity.ROLE,
              permissions
            )}
          />
        }>
        <Route element={<AddRolePage />} path={ROUTES_RELATIVE.ADD_ROLE} />
      </Route>

      <Route
        element={
          <AdminProtectedRoute
            hasPermission={checkPermission(
              Operation.Create,
              ResourceEntity.POLICY,
              permissions
            )}
          />
        }>
        <Route element={<AddPolicyPage />} path={ROUTES_RELATIVE.ADD_POLICY} />
      </Route>

      <Route element={<AddRulePage />} path={ROUTES_RELATIVE.ADD_POLICY_RULE} />
      <Route
        element={<EditRulePage />}
        path={ROUTES_RELATIVE.EDIT_POLICY_RULE}
      />

      <Route
        element={<GlobalSettingCategoryPage />}
        path={ROUTES_RELATIVE.SETTINGS_WITH_CATEGORY}
      />

      <Route
        element={
          <Navigate replace to={getTeamsWithFqnPath(TeamType.Organization)} />
        }
        path={getSettingPath()}
      />

      <Route element={<AdminProtectedRoute />}>
        <Route
          element={<EditEmailConfigPage />}
          path={ROUTES_RELATIVE.SETTINGS_EDIT_EMAIL_CONFIG}
        />
        <Route
          element={<EditLoginConfiguration />}
          path={ROUTES_RELATIVE.SETTINGS_EDIT_CUSTOM_LOGIN_CONFIG}
        />
        <Route
          element={<NotificationListPage />}
          path={getSettingPath(GlobalSettingsMenuCategory.NOTIFICATIONS)}
        />
        <Route
          element={<AlertDetailsPage isNotificationAlert />}
          path={ROUTES_RELATIVE.NOTIFICATION_ALERT_DETAILS}
        />
        <Route
          element={<AddNotificationPage />}
          path={getSettingPath(
            GlobalSettingsMenuCategory.NOTIFICATIONS,
            GlobalSettingOptions.EDIT_NOTIFICATION,
            true
          )}
        />
        <Route
          element={<AddNotificationPage />}
          path={getSettingPath(
            GlobalSettingsMenuCategory.NOTIFICATIONS,
            GlobalSettingOptions.ADD_NOTIFICATION
          )}
        />

        <Route
          element={<BotsPageV1 />}
          path={getSettingPath(GlobalSettingOptions.BOTS)}
        />
        <Route
          element={<ApplicationPage />}
          path={getSettingPath(GlobalSettingOptions.APPLICATIONS)}
        />
        <Route
          element={<AppDetails />}
          path={getSettingPath(
            GlobalSettingOptions.APPLICATIONS,
            undefined,
            true
          )}
        />
        <Route
          element={<RolesListPage />}
          path={getSettingPath(
            GlobalSettingsMenuCategory.ACCESS,
            GlobalSettingOptions.ROLES
          )}
        />

        <Route
          element={<PersonaPage />}
          path={getSettingPath(
            GlobalSettingsMenuCategory.MEMBERS,
            GlobalSettingOptions.PERSONA
          )}
        />

        <Route
          element={<PersonaDetailsPage />}
          path={getSettingPath(
            GlobalSettingsMenuCategory.MEMBERS,
            GlobalSettingOptions.PERSONA,
            true
          )}
        />

        <Route
          element={<RolesDetailPage />}
          path={getSettingPath(
            GlobalSettingsMenuCategory.ACCESS,
            GlobalSettingOptions.ROLES,
            true
          )}
        />

        <Route
          element={<PoliciesListPage />}
          path={getSettingPath(
            GlobalSettingsMenuCategory.ACCESS,
            GlobalSettingOptions.POLICIES
          )}
        />

        <Route
          element={<PoliciesDetailPage />}
          path={getSettingPath(
            GlobalSettingsMenuCategory.ACCESS,
            GlobalSettingOptions.POLICIES,
            true
          )}
        />

        <Route
          element={<EmailConfigSettingsPage />}
          path={getSettingPath(
            GlobalSettingsMenuCategory.PREFERENCES,
            GlobalSettingOptions.EMAIL
          )}
        />

        <Route
          element={<AppearanceConfigSettingsPage />}
          path={getSettingPath(
            GlobalSettingsMenuCategory.PREFERENCES,
            GlobalSettingOptions.APPEARANCE
          )}
        />

        <Route
          element={<ProfilerConfigurationPage />}
          path={getSettingPath(
            GlobalSettingsMenuCategory.PREFERENCES,
            GlobalSettingOptions.PROFILER_CONFIGURATION
          )}
        />
      </Route>

      <Route
        element={<LoginConfigurationPage />}
        path={getSettingPath(
          GlobalSettingsMenuCategory.PREFERENCES,
          GlobalSettingOptions.LOGIN_CONFIGURATION
        )}
      />

      <Route
        element={<CustomPageSettings />}
        path={getSettingPath(
          GlobalSettingsMenuCategory.PREFERENCES,
          GlobalSettingOptions.CUSTOMIZE_LANDING_PAGE
        )}
      />

      <Route
        element={<AlertsActivityFeedPage />}
        path={getSettingPath(
          GlobalSettingsMenuCategory.NOTIFICATIONS,
          GlobalSettingOptions.ACTIVITY_FEED
        )}
      />

      <Route
        element={<CustomPropertiesPageV1 />}
        path={getSettingCategoryPath(
          GlobalSettingsMenuCategory.CUSTOM_PROPERTIES
        )}
      />

      <Route
        element={<OmHealthPage />}
        path={getSettingPath(
          GlobalSettingsMenuCategory.PREFERENCES,
          GlobalSettingOptions.OM_HEALTH
        )}
      />

      <Route
        element={
          <AdminProtectedRoute
            hasPermission={userPermissions.hasViewPermissions(
              ResourceEntity.TEAM,
              permissions
            )}
          />
        }
        path={getSettingPath(
          GlobalSettingsMenuCategory.MEMBERS,
          GlobalSettingOptions.TEAMS,
          true
        )}>
        <TeamsPage />
      </Route>

      <Route
        element={
          <AdminProtectedRoute
            hasPermission={userPermissions.hasViewPermissions(
              ResourceEntity.TEAM,
              permissions
            )}
          />
        }
        path={getSettingPath(
          GlobalSettingsMenuCategory.MEMBERS,
          GlobalSettingOptions.TEAMS,
          true,
          true
        )}>
        <ImportTeamsPage />
      </Route>

      <Route
        element={
          <Navigate replace to={getTeamsWithFqnPath(TeamType.Organization)} />
        }
        path={getSettingPath(
          GlobalSettingsMenuCategory.MEMBERS,
          GlobalSettingOptions.TEAMS
        )}
      />

      <Route
        element={
          <AdminProtectedRoute
            hasPermission={userPermissions.hasViewPermissions(
              ResourceEntity.USER,
              permissions
            )}
          />
        }
        path={getSettingCategoryPath(GlobalSettingsMenuCategory.MEMBERS)}>
        <UserListPageV1 />
      </Route>

      <Route
        element={<ServicesPage />}
        path={getSettingCategoryPath(GlobalSettingsMenuCategory.SERVICES)}
      />
    </Routes>
  );
};

export default SettingsRouter;
