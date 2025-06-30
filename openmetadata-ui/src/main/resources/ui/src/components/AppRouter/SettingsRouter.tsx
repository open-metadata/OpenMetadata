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

import { useTranslation } from 'react-i18next';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ROUTES } from '../../constants/constants';
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
import AppearanceConfigSettingsPage from '../../pages/AppearanceConfigSettingsPage/AppearanceConfigSettingsPage';
import ApplicationPage from '../../pages/Application/ApplicationPage';
import BotsPageV1 from '../../pages/BotsPageV1/BotsPageV1.component';
import EditLoginConfiguration from '../../pages/Configuration/EditLoginConfiguration/EditLoginConfigurationPage';
import EditUrlConfigurationPage from '../../pages/Configuration/EditUrlConfiguration/EditUrlConfigurationPage';
import LoginConfigurationPage from '../../pages/Configuration/LoginConfigurationDetails/LoginConfigurationPage';
import UrlConfigurationPage from '../../pages/Configuration/UrlConfiguration/UrlConfigurationPage';
import { CustomPageSettings } from '../../pages/CustomPageSettings/CustomPageSettings';
import CustomPropertiesPageV1 from '../../pages/CustomPropertiesPageV1/CustomPropertiesPageV1';
import EditEmailConfigPage from '../../pages/EditEmailConfigPage/EditEmailConfigPage.component';
import EmailConfigSettingsPage from '../../pages/EmailConfigSettingsPage/EmailConfigSettingsPage.component';
import GlobalSettingCategoryPage from '../../pages/GlobalSettingPage/GlobalSettingCategory/GlobalSettingCategoryPage';
import GlobalSettingPage from '../../pages/GlobalSettingPage/GlobalSettingPage';
import LineageConfigPage from '../../pages/LineageConfigPage/LineageConfigPage';
import NotificationListPage from '../../pages/NotificationListPage/NotificationListPage';
import OmHealthPage from '../../pages/OmHealth/OmHealthPage';
import OnlineUsersPage from '../../pages/OnlineUsersPage/OnlineUsersPage';
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
import SearchSettingsPage from '../../pages/SearchSettingsPage/SearchSettingsPage';
import ServicesPage from '../../pages/ServicesPage/ServicesPage';
import ImportTeamsPage from '../../pages/TeamsPage/ImportTeamsPage/ImportTeamsPage';
import TeamsPage from '../../pages/TeamsPage/TeamsPage';
import UserListPageV1 from '../../pages/UserListPage/UserListPageV1';
import { checkPermission, userPermissions } from '../../utils/PermissionsUtils';
import {
  getSettingCategoryPath,
  getSettingPath,
  getSettingPathRelative,
  getTeamsWithFqnPath,
} from '../../utils/RouterUtils';
import EntitySearchSettings from '../SearchSettings/EntitySeachSettings/EntitySearchSettings';
import AppDetails from '../Settings/Applications/AppDetails/AppDetails.component';
import AdminProtectedRoute from './AdminProtectedRoute';
const NotificationAlertDetailsPage = () => (
  <AlertDetailsPage isNotificationAlert />
);

const SettingsRouter = () => {
  const { permissions } = usePermissionProvider();
  const { t } = useTranslation();

  return (
    <Routes>
      <Route element={<GlobalSettingPage />} path="/" />

      {/* keep these route above the setting route always */}
      <Route
        element={
          <AdminProtectedRoute
            hasPermission={checkPermission(
              Operation.Create,
              ResourceEntity.ROLE,
              permissions
            )}>
            <AddRolePage
              pageTitle={t('label.add-new-entity', {
                entity: t('label.role'),
              })}
            />
          </AdminProtectedRoute>
        }
        path={ROUTES.ADD_ROLE.replace(ROUTES.SETTINGS, '')}
      />
      <Route
        element={
          <AdminProtectedRoute
            hasPermission={checkPermission(
              Operation.Create,
              ResourceEntity.POLICY,
              permissions
            )}>
            <AddPolicyPage
              pageTitle={t('label.add-entity', {
                entity: t('label.policy'),
              })}
            />
          </AdminProtectedRoute>
        }
        path={ROUTES.ADD_POLICY.replace(ROUTES.SETTINGS, '')}
      />
      <Route
        element={
          <AdminProtectedRoute
            hasPermission={checkPermission(
              Operation.EditAll,
              ResourceEntity.POLICY,
              permissions
            )}>
            <AddRulePage />
          </AdminProtectedRoute>
        }
        path={ROUTES.ADD_POLICY_RULE.replace(ROUTES.SETTINGS, '')}
      />

      <Route
        element={
          <AdminProtectedRoute hasPermission={false}>
            <EditEmailConfigPage
              pageTitle={t('label.edit-entity', {
                entity: t('label.entity-configuration', {
                  entity: t('label.email'),
                }),
              })}
            />
          </AdminProtectedRoute>
        }
        path={ROUTES.SETTINGS_EDIT_EMAIL_CONFIG.replace(ROUTES.SETTINGS, '')}
      />

      <Route
        element={
          <AdminProtectedRoute hasPermission={false}>
            <EditUrlConfigurationPage
              pageTitle={t('label.edit-entity', {
                entity: t('label.entity-configuration', {
                  entity: t('label.url-uppercase'),
                }),
              })}
            />
          </AdminProtectedRoute>
        }
        path={ROUTES.SETTINGS_OM_URL_CONFIG.replace(ROUTES.SETTINGS, '')}
      />

      <Route
        element={
          <AdminProtectedRoute hasPermission={false}>
            <EditLoginConfiguration
              pageTitle={t('label.edit-entity', {
                entity: t('label.login-configuration'),
              })}
            />
          </AdminProtectedRoute>
        }
        path={ROUTES.SETTINGS_EDIT_CUSTOM_LOGIN_CONFIG.replace(
          ROUTES.SETTINGS,
          ''
        )}
      />
      <Route
        element={
          <AdminProtectedRoute
            hasPermission={checkPermission(
              Operation.EditAll,
              ResourceEntity.POLICY,
              permissions
            )}>
            <EditRulePage />
          </AdminProtectedRoute>
        }
        path={ROUTES.EDIT_POLICY_RULE.replace(ROUTES.SETTINGS, '')}
      />
      {/*  Setting routes without any category will be places here */}
      <Route
        element={
          <AdminProtectedRoute
            hasPermission={userPermissions.hasViewPermissions(
              ResourceEntity.EVENT_SUBSCRIPTION,
              permissions
            )}>
            <NotificationListPage />
          </AdminProtectedRoute>
        }
        path={getSettingPathRelative(GlobalSettingsMenuCategory.NOTIFICATIONS)}
      />

      <Route
        element={
          <AdminProtectedRoute
            hasPermission={userPermissions.hasViewPermissions(
              ResourceEntity.EVENT_SUBSCRIPTION,
              permissions
            )}>
            <NotificationAlertDetailsPage />
          </AdminProtectedRoute>
        }
        path={ROUTES.NOTIFICATION_ALERT_DETAILS_WITH_TAB.replace(
          ROUTES.SETTINGS,
          ''
        )}
      />
      <Route
        element={
          <AddNotificationPage
            pageTitle={t('label.add-entity', {
              entity: t('label.notification-alert'),
            })}
          />
        }
        path={getSettingPathRelative(
          GlobalSettingsMenuCategory.NOTIFICATIONS,
          GlobalSettingOptions.EDIT_NOTIFICATION,
          true
        )}
      />
      <Route
        element={
          <AddNotificationPage
            pageTitle={t('label.add-entity', {
              entity: t('label.notification-alert'),
            })}
          />
        }
        path={getSettingPathRelative(
          GlobalSettingsMenuCategory.NOTIFICATIONS,
          GlobalSettingOptions.ADD_NOTIFICATION
        )}
      />

      <Route
        element={
          <AdminProtectedRoute
            hasPermission={userPermissions.hasViewPermissions(
              ResourceEntity.BOT,
              permissions
            )}>
            <BotsPageV1 />
          </AdminProtectedRoute>
        }
        path={getSettingPathRelative(GlobalSettingOptions.BOTS)}
      />
      <Route
        element={
          <AdminProtectedRoute
            hasPermission={userPermissions.hasViewPermissions(
              ResourceEntity.APPLICATION,
              permissions
            )}>
            <ApplicationPage />
          </AdminProtectedRoute>
        }
        path={getSettingPathRelative(GlobalSettingOptions.APPLICATIONS)}
      />
      <Route
        element={
          <AdminProtectedRoute
            hasPermission={userPermissions.hasViewPermissions(
              ResourceEntity.APPLICATION,
              permissions
            )}>
            <AppDetails />
          </AdminProtectedRoute>
        }
        path={getSettingPathRelative(
          GlobalSettingOptions.APPLICATIONS,
          undefined,
          true
        )}
      />

      {/* Setting Page Routes with categories */}

      <Route
        element={
          <AdminProtectedRoute>
            <PersonaPage pageTitle={t('label.persona-plural')} />
          </AdminProtectedRoute>
        }
        path={getSettingPathRelative(GlobalSettingOptions.PERSONA)}
      />

      <Route
        element={<GlobalSettingCategoryPage />}
        path={ROUTES.SETTINGS_WITH_CATEGORY.replace(ROUTES.SETTINGS, '')}
      />

      {/* <Route
        element={
          <Navigate replace to={getTeamsWithFqnPath(TeamType.Organization)} />
        }
        path={getSettingPathRelative()}
      /> */}
      <Route
        element={
          <AdminProtectedRoute
            hasPermission={userPermissions.hasViewPermissions(
              ResourceEntity.TEAM,
              permissions
            )}>
            <TeamsPage />
          </AdminProtectedRoute>
        }
        path={getSettingPathRelative(
          GlobalSettingsMenuCategory.MEMBERS,
          GlobalSettingOptions.TEAMS,
          true
        )}
      />
      <Route
        element={
          <AdminProtectedRoute
            hasPermission={checkPermission(
              Operation.EditAll,
              ResourceEntity.TEAM,
              permissions
            )}>
            <ImportTeamsPage />
          </AdminProtectedRoute>
        }
        path={getSettingPathRelative(
          GlobalSettingsMenuCategory.MEMBERS,
          GlobalSettingOptions.TEAMS,
          true,
          true
        )}
      />
      <Route
        element={
          <Navigate replace to={getTeamsWithFqnPath(TeamType.Organization)} />
        }
        path={getSettingPathRelative(
          GlobalSettingsMenuCategory.MEMBERS,
          GlobalSettingOptions.TEAMS
        )}
      />
      <Route
        element={
          <AdminProtectedRoute>
            <PersonaDetailsPage />
          </AdminProtectedRoute>
        }
        path={getSettingPath(GlobalSettingOptions.PERSONA, '', true)}
      />
      {/* Roles route start
       * Do not change the order of these route
       */}
      <Route
        element={
          <AdminProtectedRoute
            hasPermission={userPermissions.hasViewPermissions(
              ResourceEntity.ROLE,
              permissions
            )}>
            <RolesListPage />
          </AdminProtectedRoute>
        }
        path={getSettingPathRelative(
          GlobalSettingsMenuCategory.ACCESS,
          GlobalSettingOptions.ROLES
        )}
      />
      <Route
        element={
          <AdminProtectedRoute
            hasPermission={userPermissions.hasViewPermissions(
              ResourceEntity.ROLE,
              permissions
            )}>
            <RolesDetailPage />
          </AdminProtectedRoute>
        }
        path={getSettingPathRelative(
          GlobalSettingsMenuCategory.ACCESS,
          GlobalSettingOptions.ROLES,
          true
        )}
      />
      <Route
        element={
          <AdminProtectedRoute
            hasPermission={userPermissions.hasViewPermissions(
              ResourceEntity.ROLE,
              permissions
            )}>
            <RolesDetailPage />
          </AdminProtectedRoute>
        }
        path={getSettingPathRelative(
          GlobalSettingsMenuCategory.ACCESS,
          GlobalSettingOptions.ROLES,
          true
        )}
      />
      {/* Roles route end
       * Do not change the order of these route
       */}

      <Route
        element={
          <AdminProtectedRoute>
            <SearchSettingsPage />
          </AdminProtectedRoute>
        }
        path={getSettingPathRelative(
          GlobalSettingsMenuCategory.PREFERENCES,
          GlobalSettingOptions.SEARCH_SETTINGS
        )}
      />

      <Route
        element={
          <AdminProtectedRoute>
            <EntitySearchSettings />
          </AdminProtectedRoute>
        }
        path={getSettingPathRelative(
          GlobalSettingsMenuCategory.PREFERENCES,
          GlobalSettingOptions.SEARCH_SETTINGS,
          true
        )}
      />

      <Route
        element={
          <AdminProtectedRoute>
            <LineageConfigPage pageTitle={t('label.lineage-config')} />
          </AdminProtectedRoute>
        }
        path={getSettingPathRelative(
          GlobalSettingsMenuCategory.PREFERENCES,
          GlobalSettingOptions.LINEAGE_CONFIG
        )}
      />

      <Route
        element={
          <AdminProtectedRoute>
            <UrlConfigurationPage />
          </AdminProtectedRoute>
        }
        path={getSettingPathRelative(
          GlobalSettingsMenuCategory.PREFERENCES,
          GlobalSettingOptions.OM_URL_CONFIG
        )}
      />

      <Route
        element={
          <AdminProtectedRoute
            hasPermission={userPermissions.hasViewPermissions(
              ResourceEntity.POLICY,
              permissions
            )}>
            <PoliciesListPage />
          </AdminProtectedRoute>
        }
        path={getSettingPathRelative(
          GlobalSettingsMenuCategory.ACCESS,
          GlobalSettingOptions.POLICIES
        )}
      />
      <Route
        element={
          <AdminProtectedRoute
            hasPermission={userPermissions.hasViewPermissions(
              ResourceEntity.POLICY,
              permissions
            )}>
            <PoliciesDetailPage />
          </AdminProtectedRoute>
        }
        path={getSettingPathRelative(
          GlobalSettingsMenuCategory.ACCESS,
          GlobalSettingOptions.POLICIES,
          true
        )}
      />
      <Route
        element={
          <AdminProtectedRoute
            hasPermission={userPermissions.hasViewPermissions(
              ResourceEntity.USER,
              permissions
            )}>
            <UserListPageV1 />
          </AdminProtectedRoute>
        }
        path={getSettingCategoryPath(GlobalSettingsMenuCategory.MEMBERS)}
      />
      <Route
        element={
          <AdminProtectedRoute hasPermission>
            <OnlineUsersPage />
          </AdminProtectedRoute>
        }
        path={getSettingPathRelative(
          GlobalSettingsMenuCategory.MEMBERS,
          GlobalSettingOptions.ONLINE_USERS
        )}
      />
      <Route
        element={
          <AdminProtectedRoute hasPermission={false}>
            <EmailConfigSettingsPage />
          </AdminProtectedRoute>
        }
        path={getSettingPathRelative(
          GlobalSettingsMenuCategory.PREFERENCES,
          GlobalSettingOptions.EMAIL
        )}
      />
      <Route
        element={
          <AdminProtectedRoute hasPermission={false}>
            <AppearanceConfigSettingsPage />
          </AdminProtectedRoute>
        }
        path={getSettingPathRelative(
          GlobalSettingsMenuCategory.PREFERENCES,
          GlobalSettingOptions.APPEARANCE
        )}
      />
      <Route
        element={
          <AdminProtectedRoute hasPermission={false}>
            <ProfilerConfigurationPage />
          </AdminProtectedRoute>
        }
        path={getSettingPathRelative(
          GlobalSettingsMenuCategory.PREFERENCES,
          GlobalSettingOptions.PROFILER_CONFIGURATION
        )}
      />
      <Route
        element={
          <AdminProtectedRoute hasPermission={false}>
            <LoginConfigurationPage />
          </AdminProtectedRoute>
        }
        path={getSettingPathRelative(
          GlobalSettingsMenuCategory.PREFERENCES,
          GlobalSettingOptions.LOGIN_CONFIGURATION
        )}
      />
      <Route
        element={
          <AdminProtectedRoute
            hasPermission={checkPermission(
              Operation.EditAll,
              ResourceEntity.PERSONA,
              permissions
            )}>
            <CustomPageSettings />
          </AdminProtectedRoute>
        }
        path={getSettingPathRelative(
          GlobalSettingsMenuCategory.PREFERENCES,
          GlobalSettingOptions.CUSTOMIZE_LANDING_PAGE
        )}
      />

      <Route
        element={<ServicesPage />}
        path={getSettingCategoryPath(
          GlobalSettingsMenuCategory.SERVICES
        ).replace(ROUTES.SETTINGS, '')}
      />

      <Route
        element={
          <AdminProtectedRoute hasPermission={false}>
            <CustomPropertiesPageV1 />
          </AdminProtectedRoute>
        }
        path={getSettingCategoryPath(
          GlobalSettingsMenuCategory.CUSTOM_PROPERTIES
        )}
      />
      <Route
        element={
          <AdminProtectedRoute hasPermission={false}>
            <OmHealthPage />
          </AdminProtectedRoute>
        }
        path={getSettingPathRelative(
          GlobalSettingsMenuCategory.PREFERENCES,
          GlobalSettingOptions.OM_HEALTH
        )}
      />
    </Routes>
  );
};

export default SettingsRouter;
