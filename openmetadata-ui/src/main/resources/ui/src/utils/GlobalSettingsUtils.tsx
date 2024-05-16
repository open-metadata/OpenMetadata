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

import i18next from 'i18next';
import { ReactComponent as AdminIcon } from '../assets/svg/admin-colored.svg';
import { ReactComponent as ApplicationIcon } from '../assets/svg/application-colored.svg';
import { ReactComponent as BotIcon } from '../assets/svg/bot-colored.svg';
import { ReactComponent as AppearanceIcon } from '../assets/svg/custom-logo-colored.svg';
import { ReactComponent as CustomDashboardLogoIcon } from '../assets/svg/customize-landing-page-colored.svg';
import { ReactComponent as DashboardIcon } from '../assets/svg/dashboard-colored.svg';
import { ReactComponent as DatabaseIcon } from '../assets/svg/database-colored.svg';
import { ReactComponent as SchemaIcon } from '../assets/svg/database-schema.svg';
import { ReactComponent as EmailIcon } from '../assets/svg/email-colored.svg';
import { ReactComponent as GlossaryIcon } from '../assets/svg/glossary-colored.svg';
import { ReactComponent as LoginIcon } from '../assets/svg/login-colored.svg';
import { ReactComponent as OpenMetadataIcon } from '../assets/svg/logo-monogram.svg';
import { ReactComponent as MessagingIcon } from '../assets/svg/messaging-colored.svg';
import { ReactComponent as MlModelIcon } from '../assets/svg/ml-model-colored.svg';
import { ReactComponent as OMHealthIcon } from '../assets/svg/om-health-colored.svg';
import { ReactComponent as PersonasIcon } from '../assets/svg/persona-colored.svg';
import { ReactComponent as PipelineIcon } from '../assets/svg/pipeline-colored.svg';
import { ReactComponent as PoliciesIcon } from '../assets/svg/policies-colored.svg';
import { ReactComponent as ProfilerConfigIcon } from '../assets/svg/profiler-configuration-logo.svg';
import { ReactComponent as RolesIcon } from '../assets/svg/role-colored.svg';
import { ReactComponent as SearchIcon } from '../assets/svg/search-colored.svg';
import { ReactComponent as AccessControlIcon } from '../assets/svg/setting-access-control.svg';
import { ReactComponent as CustomProperties } from '../assets/svg/setting-custom-properties.svg';
import { ReactComponent as ManagementIcon } from '../assets/svg/setting-management.svg';
import { ReactComponent as NotificationIcon } from '../assets/svg/setting-notification.svg';
import { ReactComponent as ServiceIcon } from '../assets/svg/setting-services.svg';
import { ReactComponent as StorageIcon } from '../assets/svg/storage-colored.svg';
import { ReactComponent as StoredProcedureIcon } from '../assets/svg/stored-procedure-colored.svg';
import { ReactComponent as TableIcon } from '../assets/svg/table-colored.svg';
import { ReactComponent as TeamsIcon } from '../assets/svg/teams-colored.svg';
import { ReactComponent as UsersIcon } from '../assets/svg/user-colored.svg';
import { PLACEHOLDER_ROUTE_FQN, ROUTES } from '../constants/constants';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../constants/GlobalSettings.constants';
import {
  ResourceEntity,
  UIPermission,
} from '../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../enums/entity.enum';
import { userPermissions } from '../utils/PermissionsUtils';
import { getSettingPath } from './RouterUtils';
import { getEncodedFqn } from './StringsUtils';

export interface SettingMenuItem {
  key: string;
  icon: SvgComponent;
  description: string;
  category?: string;
  label?: string;
  isBeta?: boolean;
  isProtected?: boolean;
  items?: SettingMenuItem[];
}

export const getGlobalSettingsMenuWithPermission = (
  permissions: UIPermission,
  isAdminUser: boolean | undefined
): SettingMenuItem[] => {
  return [
    {
      category: i18next.t('label.service-plural'),
      key: GlobalSettingsMenuCategory.SERVICES,
      icon: ServiceIcon,
      description: i18next.t('message.service-description'),
      items: [
        {
          label: i18next.t('label.database-plural'),
          description: i18next.t('message.page-sub-header-for-databases'),
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.DATABASE_SERVICE,
            permissions
          ),
          key: `${GlobalSettingsMenuCategory.SERVICES}.${GlobalSettingOptions.DATABASES}`,
          icon: DatabaseIcon,
        },
        {
          label: i18next.t('label.messaging'),
          description: i18next.t('message.page-sub-header-for-messagings'),
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.MESSAGING_SERVICE,
            permissions
          ),
          key: `${GlobalSettingsMenuCategory.SERVICES}.${GlobalSettingOptions.MESSAGING}`,
          icon: MessagingIcon,
        },
        {
          label: i18next.t('label.dashboard-plural'),
          description: i18next.t('message.page-sub-header-for-dashboards'),
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.DASHBOARD_SERVICE,
            permissions
          ),
          key: `${GlobalSettingsMenuCategory.SERVICES}.${GlobalSettingOptions.DASHBOARDS}`,
          icon: DashboardIcon,
        },
        {
          label: i18next.t('label.pipeline-plural'),
          description: i18next.t('message.page-sub-header-for-pipelines'),
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.PIPELINE_SERVICE,
            permissions
          ),
          key: `${GlobalSettingsMenuCategory.SERVICES}.${GlobalSettingOptions.PIPELINES}`,
          icon: PipelineIcon,
        },
        {
          label: i18next.t('label.ml-model-plural'),
          description: i18next.t('message.page-sub-header-for-ml-models'),
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.ML_MODEL_SERVICE,
            permissions
          ),
          key: `${GlobalSettingsMenuCategory.SERVICES}.${GlobalSettingOptions.MLMODELS}`,
          icon: MlModelIcon,
        },
        {
          label: i18next.t('label.storage-plural'),
          description: i18next.t('message.page-sub-header-for-storages'),
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.STORAGE_SERVICE,
            permissions
          ),
          key: `${GlobalSettingsMenuCategory.SERVICES}.${GlobalSettingOptions.STORAGES}`,
          icon: StorageIcon,
        },
        {
          label: i18next.t('label.search'),
          description: i18next.t('message.page-sub-header-for-search'),
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.SEARCH_SERVICE,
            permissions
          ),
          key: `${GlobalSettingsMenuCategory.SERVICES}.${GlobalSettingOptions.SEARCH}`,
          icon: SearchIcon,
        },
        {
          label: i18next.t('label.metadata'),
          description: i18next.t('message.page-sub-header-for-metadata'),
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.METADATA_SERVICE,
            permissions
          ),
          key: `${GlobalSettingsMenuCategory.SERVICES}.${GlobalSettingOptions.METADATA}`,
          icon: OpenMetadataIcon,
        },
      ],
    },
    {
      category: i18next.t('label.application-plural'),
      isProtected: Boolean(isAdminUser),
      key: GlobalSettingOptions.APPLICATIONS,
      icon: ApplicationIcon,
      description: i18next.t('message.application-to-improve-data'),
    },
    {
      category: i18next.t('label.notification-plural'),
      key: GlobalSettingsMenuCategory.NOTIFICATIONS,
      icon: NotificationIcon,
      description: i18next.t('message.notification-description'),
      isProtected: Boolean(isAdminUser),
    },
    {
      category: i18next.t('label.team-user-management'),
      key: GlobalSettingsMenuCategory.MEMBERS,
      icon: ManagementIcon,
      description: i18next.t('message.member-description'),
      items: [
        {
          label: i18next.t('label.team-plural'),
          description: i18next.t('message.page-sub-header-for-teams'),
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.TEAM,
            permissions
          ),
          key: `${GlobalSettingsMenuCategory.MEMBERS}.${GlobalSettingOptions.TEAMS}`,
          icon: TeamsIcon,
        },
        {
          label: i18next.t('label.user-plural'),
          description: i18next.t('message.page-sub-header-for-users'),
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.USER,
            permissions
          ),
          key: `${GlobalSettingsMenuCategory.MEMBERS}.${GlobalSettingOptions.USERS}`,
          icon: UsersIcon,
        },
        {
          label: i18next.t('label.admin-plural'),
          description: i18next.t('message.page-sub-header-for-admins'),
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.USER,
            permissions
          ),
          key: `${GlobalSettingsMenuCategory.MEMBERS}.${GlobalSettingOptions.ADMINS}`,
          icon: AdminIcon,
        },

        {
          label: i18next.t('label.persona-plural'),
          description: i18next.t('message.page-sub-header-for-persona'),
          isProtected: Boolean(isAdminUser),
          key: `${GlobalSettingsMenuCategory.MEMBERS}.${GlobalSettingOptions.PERSONA}`,
          icon: PersonasIcon,
        },
      ],
    },
    {
      category: i18next.t('label.access-control'),
      key: GlobalSettingsMenuCategory.ACCESS,
      icon: AccessControlIcon,
      description: i18next.t('message.access-control-description'),
      items: [
        {
          label: i18next.t('label.role-plural'),
          description: i18next.t('message.page-sub-header-for-roles'),
          isProtected: Boolean(isAdminUser),
          key: `${GlobalSettingsMenuCategory.ACCESS}.${GlobalSettingOptions.ROLES}`,
          icon: RolesIcon,
        },
        {
          label: i18next.t('label.policy-plural'),
          description: i18next.t('message.page-sub-header-for-policies'),
          isProtected: Boolean(isAdminUser),
          key: `${GlobalSettingsMenuCategory.ACCESS}.${GlobalSettingOptions.POLICIES}`,
          icon: PoliciesIcon,
        },
      ],
    },
    {
      category: i18next.t('label.preference-plural'),
      key: GlobalSettingsMenuCategory.PREFERENCES,
      icon: OpenMetadataIcon,
      description: i18next.t('message.customize-open-metadata-description'),
      items: [
        {
          label: i18next.t('label.theme'),
          description: i18next.t('message.appearance-configuration-message'),
          isProtected: Boolean(isAdminUser),
          key: `${GlobalSettingsMenuCategory.PREFERENCES}.${GlobalSettingOptions.APPEARANCE}`,
          icon: AppearanceIcon,
        },
        {
          label: i18next.t('label.customize-entity', {
            entity: i18next.t('label.landing-page'),
          }),
          description: i18next.t(
            'message.page-sub-header-for-customize-landing-page'
          ),
          isProtected: Boolean(isAdminUser),
          key: `${GlobalSettingsMenuCategory.PREFERENCES}.${GlobalSettingOptions.CUSTOMIZE_LANDING_PAGE}`,
          icon: CustomDashboardLogoIcon,
        },
        {
          label: i18next.t('label.email'),
          description: i18next.t('message.email-configuration-message'),
          isProtected: Boolean(isAdminUser),
          key: `${GlobalSettingsMenuCategory.PREFERENCES}.${GlobalSettingOptions.EMAIL}`,
          icon: EmailIcon,
        },
        {
          label: i18next.t('label.login-configuration'),
          description: i18next.t(
            'message.page-sub-header-for-login-configuration'
          ),
          isProtected: Boolean(isAdminUser),
          key: `${GlobalSettingsMenuCategory.PREFERENCES}.${GlobalSettingOptions.LOGIN_CONFIGURATION}`,
          icon: LoginIcon,
        },
        {
          label: i18next.t('label.health-check'),
          description: i18next.t(
            'message.page-sub-header-for-om-health-configuration'
          ),
          isProtected: Boolean(isAdminUser),
          key: `${GlobalSettingsMenuCategory.PREFERENCES}.${GlobalSettingOptions.OM_HEALTH}`,
          icon: OMHealthIcon,
        },
        {
          label: i18next.t('label.profiler-configuration'),
          description: i18next.t(
            'message.page-sub-header-for-profiler-configuration'
          ),
          isProtected: Boolean(isAdminUser),
          key: `${GlobalSettingsMenuCategory.PREFERENCES}.${GlobalSettingOptions.PROFILER_CONFIGURATION}`,
          icon: ProfilerConfigIcon,
        },
      ],
    },
    {
      category: i18next.t('label.custom-property-plural'),
      key: GlobalSettingsMenuCategory.CUSTOM_PROPERTIES,
      icon: CustomProperties,
      description: i18next.t('message.custom-properties-description'),
      items: [
        {
          label: i18next.t('label.database'),
          description: i18next.t('message.define-custom-property-for-entity', {
            entity: i18next.t('label.database'),
          }),
          isProtected: Boolean(isAdminUser),
          key: `${GlobalSettingsMenuCategory.CUSTOM_PROPERTIES}.${GlobalSettingOptions.DATABASES}`,
          icon: DatabaseIcon,
        },
        {
          label: i18next.t('label.database-schema'),
          description: i18next.t('message.define-custom-property-for-entity', {
            entity: i18next.t('label.database-schema'),
          }),
          isProtected: Boolean(isAdminUser),
          key: `${GlobalSettingsMenuCategory.CUSTOM_PROPERTIES}.${GlobalSettingOptions.DATABASE_SCHEMA}`,
          icon: SchemaIcon,
        },
        {
          label: i18next.t('label.table-plural'),
          description: i18next.t('message.define-custom-property-for-entity', {
            entity: i18next.t('label.table-plural'),
          }),
          isProtected: Boolean(isAdminUser),
          key: `${GlobalSettingsMenuCategory.CUSTOM_PROPERTIES}.${GlobalSettingOptions.TABLES}`,
          icon: TableIcon,
        },
        {
          label: i18next.t('label.stored-procedure-plural'),
          description: i18next.t('message.define-custom-property-for-entity', {
            entity: i18next.t('label.stored-procedure-plural'),
          }),
          isProtected: Boolean(isAdminUser),
          key: `${GlobalSettingsMenuCategory.CUSTOM_PROPERTIES}.${GlobalSettingOptions.STORED_PROCEDURES}`,
          icon: StoredProcedureIcon,
        },
        {
          label: i18next.t('label.dashboard-plural'),
          description: i18next.t('message.define-custom-property-for-entity', {
            entity: i18next.t('label.dashboard-plural'),
          }),
          isProtected: Boolean(isAdminUser),
          key: `${GlobalSettingsMenuCategory.CUSTOM_PROPERTIES}.${GlobalSettingOptions.DASHBOARDS}`,
          icon: DashboardIcon,
        },
        {
          label: i18next.t('label.pipeline-plural'),
          description: i18next.t('message.define-custom-property-for-entity', {
            entity: i18next.t('label.pipeline-plural'),
          }),
          isProtected: Boolean(isAdminUser),
          key: `${GlobalSettingsMenuCategory.CUSTOM_PROPERTIES}.${GlobalSettingOptions.PIPELINES}`,
          icon: PipelineIcon,
        },
        {
          label: i18next.t('label.topic-plural'),
          description: i18next.t('message.define-custom-property-for-entity', {
            entity: i18next.t('label.topic-plural'),
          }),
          isProtected: Boolean(isAdminUser),
          key: `${GlobalSettingsMenuCategory.CUSTOM_PROPERTIES}.${GlobalSettingOptions.TOPICS}`,
          icon: MessagingIcon,
        },
        {
          label: i18next.t('label.container-plural'),
          description: i18next.t('message.define-custom-property-for-entity', {
            entity: i18next.t('label.container-plural'),
          }),
          isProtected: Boolean(isAdminUser),
          key: `${GlobalSettingsMenuCategory.CUSTOM_PROPERTIES}.${GlobalSettingOptions.CONTAINERS}`,
          icon: StorageIcon,
        },
        {
          label: i18next.t('label.ml-model-plural'),
          description: i18next.t('message.define-custom-property-for-entity', {
            entity: i18next.t('label.ml-model-plural'),
          }),
          isProtected: Boolean(isAdminUser),
          key: `${GlobalSettingsMenuCategory.CUSTOM_PROPERTIES}.${GlobalSettingOptions.MLMODELS}`,
          icon: MlModelIcon,
        },
        {
          label: i18next.t('label.search-index-plural'),
          description: i18next.t('message.define-custom-property-for-entity', {
            entity: i18next.t('label.search-index-plural'),
          }),
          isProtected: Boolean(isAdminUser),
          key: `${GlobalSettingsMenuCategory.CUSTOM_PROPERTIES}.${GlobalSettingOptions.SEARCH_INDEXES}`,
          icon: SearchIcon,
        },
        {
          label: i18next.t('label.glossary-term'),
          description: i18next.t('message.define-custom-property-for-entity', {
            entity: i18next.t('label.glossary-term'),
          }),
          isProtected: Boolean(isAdminUser),
          key: `${GlobalSettingsMenuCategory.CUSTOM_PROPERTIES}.${GlobalSettingOptions.GLOSSARY_TERM}`,
          icon: GlossaryIcon,
        },
      ].sort((a, b) => a.label.localeCompare(b.label)),
    },
    {
      category: i18next.t('label.bot-plural'),
      description: i18next.t('message.page-sub-header-for-bots'),
      isProtected: Boolean(isAdminUser),
      key: GlobalSettingOptions.BOTS,
      icon: BotIcon,
    },
  ];
};

export const getGlobalSettingMenuItem = (
  args: SettingMenuItem
): SettingMenuItem => {
  return {
    ...args,
    items: args.items?.filter((item) => item.isProtected),
  };
};

export const getSettingOptionByEntityType = (entityType: EntityType) => {
  switch (entityType) {
    case EntityType.TOPIC:
      return GlobalSettingOptions.TOPICS;
    case EntityType.DASHBOARD:
      return GlobalSettingOptions.DASHBOARDS;
    case EntityType.PIPELINE:
      return GlobalSettingOptions.PIPELINES;
    case EntityType.MLMODEL:
      return GlobalSettingOptions.MLMODELS;
    case EntityType.CONTAINER:
      return GlobalSettingOptions.CONTAINERS;
    case EntityType.DATABASE:
      return GlobalSettingOptions.DATABASE;
    case EntityType.DATABASE_SCHEMA:
      return GlobalSettingOptions.DATABASE_SCHEMA;
    case EntityType.GLOSSARY_TERM:
      return GlobalSettingOptions.GLOSSARY_TERM;

    case EntityType.TABLE:
    default:
      return GlobalSettingOptions.TABLES;
  }
};

export const getCustomizePagePath = (personaFqn: string, pageFqn: string) => {
  const path = ROUTES.CUSTOMIZE_PAGE;

  return path
    .replaceAll(PLACEHOLDER_ROUTE_FQN, getEncodedFqn(personaFqn))
    .replace(':pageFqn', pageFqn);
};

export const settingCategories = {
  [GlobalSettingsMenuCategory.SERVICES]: {
    name: i18next.t('label.service-plural'),
    url: GlobalSettingsMenuCategory.SERVICES,
  },
  [GlobalSettingsMenuCategory.NOTIFICATIONS]: {
    name: i18next.t('label.notification-plural'),
    url: GlobalSettingsMenuCategory.NOTIFICATIONS,
  },
  [GlobalSettingsMenuCategory.MEMBERS]: {
    name: i18next.t('label.member-plural'),
    url: GlobalSettingsMenuCategory.MEMBERS,
  },
  [GlobalSettingsMenuCategory.ACCESS]: {
    name: i18next.t('label.access-control'),
    url: GlobalSettingsMenuCategory.ACCESS,
  },
  [GlobalSettingsMenuCategory.PREFERENCES]: {
    name: i18next.t('label.preference-plural'),
    url: GlobalSettingsMenuCategory.PREFERENCES,
  },
  [GlobalSettingsMenuCategory.CUSTOM_PROPERTIES]: {
    name: i18next.t('label.custom-property-plural'),
    url: GlobalSettingsMenuCategory.CUSTOM_PROPERTIES,
  },
  [GlobalSettingsMenuCategory.BOTS]: {
    name: i18next.t('label.bot-plural'),
    url: GlobalSettingsMenuCategory.BOTS,
  },
  [GlobalSettingsMenuCategory.APPLICATIONS]: {
    name: i18next.t('label.application-plural'),
    url: GlobalSettingsMenuCategory.APPLICATIONS,
  },
};

export const getSettingPageEntityBreadCrumb = (
  category: GlobalSettingsMenuCategory,
  entityName?: string
) => {
  const categoryObject = settingCategories[category];

  return [
    {
      name: i18next.t('label.setting-plural'),
      url: ROUTES.SETTINGS,
    },
    {
      name: categoryObject.name,
      url: entityName ? getSettingPath(categoryObject.url) : '',
      activeTitle: !entityName,
    },
    ...(entityName
      ? [
          {
            name: entityName,
            url: '',
            activeTitle: true,
          },
        ]
      : []),
  ];
};
