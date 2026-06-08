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
import { checkPermission, userPermissions } from '../../utils/PermissionsUtils';
import {
  getSettingCategoryPath,
  getSettingPathRelative,
  getTeamsWithFqnPath,
} from '../../utils/RouterUtils';
import AdminProtectedRoute from './AdminProtectedRoute';
import withSuspenseFallback from './withSuspenseFallback';

const AddNotificationPage = withSuspenseFallback(
  React.lazy(
    () => import('../../pages/AddNotificationPage/AddNotificationPage')
  )
);

const AlertDetailsPage = withSuspenseFallback(
  React.lazy(() => import('../../pages/AlertDetailsPage/AlertDetailsPage'))
);

const AppearanceConfigSettingsPage = withSuspenseFallback(
  React.lazy(
    () =>
      import(
        '../../pages/AppearanceConfigSettingsPage/AppearanceConfigSettingsPage'
      )
  )
);

const ApplicationPage = withSuspenseFallback(
  React.lazy(() => import('../../pages/Application/ApplicationPage'))
);

const AuditLogsPage = withSuspenseFallback(
  React.lazy(() => import('../../pages/AuditLogsPage/AuditLogsPage'))
);

const BotsPageV1 = withSuspenseFallback(
  React.lazy(() => import('../../pages/BotsPageV1/BotsPageV1.component'))
);

const ColumnBulkOperations = withSuspenseFallback(
  React.lazy(
    () =>
      import('../../pages/ColumnBulkOperations/ColumnBulkOperations.component')
  )
);

const DataAssetRulesPage = withSuspenseFallback(
  React.lazy(
    () => import('../../pages/Configuration/DataAssetRules/DataAssetRulesPage')
  )
);

const EditLoginConfiguration = withSuspenseFallback(
  React.lazy(
    () =>
      import(
        '../../pages/Configuration/EditLoginConfiguration/EditLoginConfigurationPage'
      )
  )
);

const EditUrlConfigurationPage = withSuspenseFallback(
  React.lazy(
    () =>
      import(
        '../../pages/Configuration/EditUrlConfiguration/EditUrlConfigurationPage'
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

const UrlConfigurationPage = withSuspenseFallback(
  React.lazy(
    () =>
      import('../../pages/Configuration/UrlConfiguration/UrlConfigurationPage')
  )
);

const CustomPropertiesPageV1 = withSuspenseFallback(
  React.lazy(
    () => import('../../pages/CustomPropertiesPageV1/CustomPropertiesPageV1')
  )
);

const EditEmailConfigPage = withSuspenseFallback(
  React.lazy(
    () =>
      import('../../pages/EditEmailConfigPage/EditEmailConfigPage.component')
  )
);

const EmailConfigSettingsPage = withSuspenseFallback(
  React.lazy(
    () =>
      import(
        '../../pages/EmailConfigSettingsPage/EmailConfigSettingsPage.component'
      )
  )
);

const GlobalSettingCategoryPage = withSuspenseFallback(
  React.lazy(
    () =>
      import(
        '../../pages/GlobalSettingPage/GlobalSettingCategory/GlobalSettingCategoryPage'
      )
  )
);

const GlobalSettingPage = withSuspenseFallback(
  React.lazy(() => import('../../pages/GlobalSettingPage/GlobalSettingPage'))
);

const GlossaryTermRelationSettingsPage = withSuspenseFallback(
  React.lazy(
    () =>
      import(
        '../../pages/GlossaryTermRelationSettings/GlossaryTermRelationSettings'
      )
  )
);

const LearningResourcesPage = withSuspenseFallback(
  React.lazy(() =>
    import('../../pages/LearningResourcesPage/LearningResourcesPage').then(
      (m) => ({ default: m.LearningResourcesPage })
    )
  )
);

const LineageConfigPage = withSuspenseFallback(
  React.lazy(() => import('../../pages/LineageConfigPage/LineageConfigPage'))
);

const NotificationListPage = withSuspenseFallback(
  React.lazy(
    () => import('../../pages/NotificationListPage/NotificationListPage')
  )
);

const OmHealthPage = withSuspenseFallback(
  React.lazy(() => import('../../pages/OmHealth/OmHealthPage'))
);

const OnlineUsersPage = withSuspenseFallback(
  React.lazy(() => import('../../pages/OnlineUsersPage/OnlineUsersPage'))
);

const PersonaDetailsPage = withSuspenseFallback(
  React.lazy(() =>
    import('../../pages/Persona/PersonaDetailsPage/PersonaDetailsPage').then(
      (m) => ({ default: m.PersonaDetailsPage })
    )
  )
);

const PersonaPage = withSuspenseFallback(
  React.lazy(() =>
    import('../../pages/Persona/PersonaListPage/PersonaPage').then((m) => ({
      default: m.PersonaPage,
    }))
  )
);

const AddPolicyPage = withSuspenseFallback(
  React.lazy(
    () => import('../../pages/PoliciesPage/AddPolicyPage/AddPolicyPage')
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

const ProfilerConfigurationPage = withSuspenseFallback(
  React.lazy(
    () =>
      import('../../pages/ProfilerConfigurationPage/ProfilerConfigurationPage')
  )
);

const AddRolePage = withSuspenseFallback(
  React.lazy(() => import('../../pages/RolesPage/AddRolePage/AddRolePage'))
);

const RolesDetailPage = withSuspenseFallback(
  React.lazy(
    () => import('../../pages/RolesPage/RolesDetailPage/RolesDetailPage')
  )
);

const RolesListPage = withSuspenseFallback(
  React.lazy(() => import('../../pages/RolesPage/RolesListPage/RolesListPage'))
);

const SearchSettingsPage = withSuspenseFallback(
  React.lazy(() => import('../../pages/SearchSettingsPage/SearchSettingsPage'))
);

const ServicesPage = withSuspenseFallback(
  React.lazy(() => import('../../pages/ServicesPage/ServicesPage'))
);

const TaskFormSettingsPage = withSuspenseFallback(
  React.lazy(
    () => import('../../pages/TaskFormSettingsPage/TaskFormSettingsPage')
  )
);

const IntakeFormsPage = withSuspenseFallback(
  React.lazy(() => import('../../pages/IntakeForms/IntakeFormsPage'))
);

const ImportTeamsPage = withSuspenseFallback(
  React.lazy(
    () => import('../../pages/TeamsPage/ImportTeamsPage/ImportTeamsPage')
  )
);

const TeamsPage = withSuspenseFallback(
  React.lazy(() => import('../../pages/TeamsPage/TeamsPage'))
);

const UserListPageV1 = withSuspenseFallback(
  React.lazy(() => import('../../pages/UserListPage/UserListPageV1'))
);

const WorkflowBuilderPage = withSuspenseFallback(
  React.lazy(
    () =>
      import('../../pages/WorkflowDefinitions/WorkflowBuilder/WorkflowBuilder')
  )
);

const WorkflowsListPage = withSuspenseFallback(
  React.lazy(
    () => import('../../pages/WorkflowDefinitions/WorkflowsPage/WorkflowsPage')
  )
);

const EntitySearchSettings = withSuspenseFallback(
  React.lazy(
    () => import('../SearchSettings/EntitySeachSettings/EntitySearchSettings')
  )
);

const AppDetails = withSuspenseFallback(
  React.lazy(
    () => import('../Settings/Applications/AppDetails/AppDetails.component')
  )
);

const AdminPermissionDebugger = withSuspenseFallback(
  React.lazy(
    () =>
      import(
        '../Settings/Users/AdminPermissionDebugger/AdminPermissionDebugger.component'
      )
  )
);

const SettingsSso = withSuspenseFallback(
  React.lazy(() => import('../SettingsSso/SettingsSso'))
);

const NotificationAlertDetailsPage = () => (
  <AlertDetailsPage isNotificationAlert />
);

const SettingsRouter = () => {
  const { permissions } = usePermissionProvider();
  const { t } = useTranslation();

  return (
    <Routes>
      <Route element={<GlobalSettingPage />} path="/" />
      <Route element={<SettingsSso />} path={ROUTES.SETTINGS_SSO} />

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
        path={ROUTES.NOTIFICATION_ALERT_LIST.replace(ROUTES.SETTINGS, '')}
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
        path={getSettingPathRelative(GlobalSettingOptions.PERSONA, '', true)}
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
          <AdminProtectedRoute>
            <DataAssetRulesPage />
          </AdminProtectedRoute>
        }
        path={getSettingPathRelative(
          GlobalSettingsMenuCategory.PREFERENCES,
          GlobalSettingOptions.DATA_ASSET_RULES
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
          <AdminProtectedRoute>
            <AdminPermissionDebugger />
          </AdminProtectedRoute>
        }
        path={getSettingPathRelative(
          GlobalSettingsMenuCategory.ACCESS,
          GlobalSettingOptions.PERMISSION_DEBUGGER
        )}
      />
      <Route
        element={
          <AdminProtectedRoute
            hasPermission={userPermissions.hasViewPermissions(
              ResourceEntity.AUDIT_LOG,
              permissions
            )}>
            <AuditLogsPage />
          </AdminProtectedRoute>
        }
        path={getSettingPathRelative(
          GlobalSettingsMenuCategory.ACCESS,
          GlobalSettingOptions.AUDIT_LOGS
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
            <ColumnBulkOperations />
          </AdminProtectedRoute>
        }
        path={ROUTES.COLUMN_BULK_OPERATIONS.replace(ROUTES.SETTINGS, '')}
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
      <Route
        element={
          <AdminProtectedRoute>
            <LearningResourcesPage />
          </AdminProtectedRoute>
        }
        path={getSettingPathRelative(
          GlobalSettingsMenuCategory.PREFERENCES,
          GlobalSettingOptions.LEARNING_RESOURCES
        )}
      />
      <Route
        element={<SettingsSso />}
        path={getSettingPathRelative(GlobalSettingsMenuCategory.SSO)}
      />
      <Route
        element={
          <AdminProtectedRoute>
            <GlossaryTermRelationSettingsPage />
          </AdminProtectedRoute>
        }
        path={getSettingPathRelative(
          GlobalSettingsMenuCategory.GOVERNANCE,
          GlobalSettingOptions.GLOSSARY_TERM_RELATIONS
        )}
      />
      <Route
        element={
          <AdminProtectedRoute>
            <WorkflowsListPage />
          </AdminProtectedRoute>
        }
        path={getSettingPathRelative(
          GlobalSettingsMenuCategory.GOVERNANCE,
          GlobalSettingOptions.WORKFLOW_DEFINITIONS
        )}
      />
      <Route
        element={
          <AdminProtectedRoute>
            <WorkflowBuilderPage />
          </AdminProtectedRoute>
        }
        path={getSettingPathRelative(
          GlobalSettingsMenuCategory.GOVERNANCE,
          GlobalSettingOptions.WORKFLOW_DEFINITIONS,
          true
        )}
      />
      <Route
        element={
          <AdminProtectedRoute>
            <IntakeFormsPage />
          </AdminProtectedRoute>
        }
        path={getSettingPathRelative(
          GlobalSettingsMenuCategory.GOVERNANCE,
          GlobalSettingOptions.INTAKE_FORMS
        )}
      />
      <Route
        element={
          <AdminProtectedRoute>
            <TaskFormSettingsPage />
          </AdminProtectedRoute>
        }
        path={getSettingPathRelative(
          GlobalSettingsMenuCategory.GOVERNANCE,
          GlobalSettingOptions.TASK_FORMS
        )}
      />
    </Routes>
  );
};

export default SettingsRouter;
