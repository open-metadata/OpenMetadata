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
import { ReactNode } from 'react';
import { ReactComponent as AdminIcon } from '../assets/svg/admin-colored.svg';
import { ReactComponent as AllActivityIcon } from '../assets/svg/all-activity.svg';
import { ReactComponent as CustomLogoIcon } from '../assets/svg/custom-logo-colored.svg';
import { ReactComponent as CustomDashboardLogoIcon } from '../assets/svg/customize-landing-page-colored.svg';
import { ReactComponent as EmailIcon } from '../assets/svg/email-colored.svg';
import { ReactComponent as GlossaryIcon } from '../assets/svg/glossary-colored.svg';
import { ReactComponent as BellIcon } from '../assets/svg/ic-alert-bell.svg';
import { ReactComponent as LoginIcon } from '../assets/svg/login-colored.svg';

import { ReactComponent as SchemaIcon } from '../assets/svg/database-schema.svg';

import { ReactComponent as PersonasIcon } from '../assets/svg/persona-colored.svg';
import { ReactComponent as RolesIcon } from '../assets/svg/role-colored.svg';
import { ReactComponent as StoredProcedureIcon } from '../assets/svg/stored-procedure-colored.svg';

import { ReactComponent as PoliciesIcon } from '../assets/svg/policies-colored.svg';
import { ReactComponent as TableIcon } from '../assets/svg/table-colored.svg';
import { ReactComponent as TeamsIcon } from '../assets/svg/teams-colored.svg';
import { ReactComponent as UsersIcon } from '../assets/svg/user-colored.svg';

import { ReactComponent as OpenMetadataIcon } from '../assets/svg/logo-monogram.svg';
import { ReactComponent as AccessControlIcon } from '../assets/svg/setting-access-control.svg';
import { ReactComponent as CustomProperties } from '../assets/svg/setting-custom-properties.svg';
import { ReactComponent as DataObservability } from '../assets/svg/setting-data-observability.svg';
import { ReactComponent as IntegrationIcon } from '../assets/svg/setting-integration.svg';
import { ReactComponent as ManagementIcon } from '../assets/svg/setting-management.svg';
import { ReactComponent as NotificationIcon } from '../assets/svg/setting-notification.svg';
import { ReactComponent as ServiceIcon } from '../assets/svg/setting-services.svg';

import { ReactComponent as ApplicationIcon } from '../assets/svg/application-colored.svg';
import { ReactComponent as BotIcon } from '../assets/svg/bot-colored.svg';

import { ReactComponent as DashboardIcon } from '../assets/svg/dashboard-colored.svg';
import { ReactComponent as DatabaseIcon } from '../assets/svg/database-colored.svg';
import { ReactComponent as MetadataIcon } from '../assets/svg/logo-monogram.svg';
import { ReactComponent as MessagingIcon } from '../assets/svg/messaging-colored.svg';
import { ReactComponent as MlModelIcon } from '../assets/svg/ml-model-colored.svg';
import { ReactComponent as PipelineIcon } from '../assets/svg/pipeline-colored.svg';
import { ReactComponent as SearchIcon } from '../assets/svg/search-colored.svg';
import { ReactComponent as StorageIcon } from '../assets/svg/storage-colored.svg';

import {
  ResourceEntity,
  UIPermission,
} from '../components/PermissionProvider/PermissionProvider.interface';
import { PLACEHOLDER_ROUTE_FQN, ROUTES } from '../constants/constants';
import { GlobalSettingOptions } from '../constants/GlobalSettings.constants';
import { EntityType } from '../enums/entity.enum';
import { userPermissions } from '../utils/PermissionsUtils';
import { getEncodedFqn } from './StringsUtils';

export interface MenuListItem {
  label: string;
  isProtected: boolean;
  icon: ReactNode;
  key: string;
  description: string;
}
export interface MenuList {
  category: string;
  items: MenuListItem[];
  isBeta?: boolean;
  key: string;
  description: string;
}

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
      key: 'services',
      icon: ServiceIcon,
      description: i18next.t('label.service-description'),
      items: [
        {
          label: i18next.t('label.database-plural'),
          description: i18next.t('label.service-description'),
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.DATABASE_SERVICE,
            permissions
          ),
          key: 'services.databases',
          icon: DatabaseIcon,
        },
        {
          label: i18next.t('label.messaging'),
          description: i18next.t('label.service-description'),
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.MESSAGING_SERVICE,
            permissions
          ),
          key: 'services.messaging',
          icon: MessagingIcon,
        },
        {
          label: i18next.t('label.dashboard-plural'),
          description: i18next.t('label.service-description'),
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.DASHBOARD_SERVICE,
            permissions
          ),
          key: 'services.dashboards',
          icon: DashboardIcon,
        },
        {
          label: i18next.t('label.pipeline-plural'),
          description: i18next.t('label.service-description'),
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.PIPELINE_SERVICE,
            permissions
          ),
          key: 'services.pipelines',
          icon: PipelineIcon,
        },
        {
          label: i18next.t('label.ml-model-plural'),
          description: i18next.t('label.service-description'),
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.ML_MODEL_SERVICE,
            permissions
          ),
          key: 'services.mlmodels',
          icon: MlModelIcon,
        },
        {
          label: i18next.t('label.storage-plural'),
          description: i18next.t('label.service-description'),
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.STORAGE_SERVICE,
            permissions
          ),
          key: 'services.storages',
          icon: StorageIcon,
        },
        {
          label: i18next.t('label.search'),
          description: i18next.t('label.service-description'),
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.SEARCH_SERVICE,
            permissions
          ),
          key: 'services.search',
          icon: SearchIcon,
        },
        {
          label: i18next.t('label.metadata'),
          description: i18next.t('label.service-description'),
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.METADATA_SERVICE,
            permissions
          ),
          key: 'services.metadata',
          icon: MetadataIcon,
        },
      ],
    },
    {
      category: i18next.t('label.integration-plural'),
      key: 'integrations',
      icon: IntegrationIcon,
      description: i18next.t('label.service-description'),
      items: [
        {
          label: i18next.t('label.application-plural'),
          description: i18next.t('label.service-description'),
          isProtected: Boolean(isAdminUser),
          key: 'integrations.apps',
          icon: ApplicationIcon,
        },
        {
          label: i18next.t('label.bot-plural'),
          description: i18next.t('label.service-description'),
          isProtected: Boolean(isAdminUser),
          key: 'integrations.bots',
          icon: BotIcon,
        },
      ],
    },
    {
      category: i18next.t('label.data-observability'),
      key: 'data-observability',
      icon: DataObservability,
      description: i18next.t('label.service-description'),
      isProtected: Boolean(isAdminUser),
    },
    {
      category: i18next.t('label.notification-plural'),
      key: 'notifications',
      icon: NotificationIcon,
      description: i18next.t('label.service-description'),
      items: [
        {
          label: i18next.t('label.activity-feed-plural'),
          description: i18next.t('label.service-description'),
          isProtected: Boolean(isAdminUser),
          key: 'notifications.activityFeeds',
          icon: AllActivityIcon,
        },
        {
          label: i18next.t('label.alert-plural'),
          description: i18next.t('label.service-description'),
          isProtected: Boolean(isAdminUser),
          key: 'notifications.alerts',
          icon: BellIcon,
        },
      ],
    },
    {
      category: i18next.t('label.team-user-management'),
      key: 'members',
      icon: ManagementIcon,
      description: i18next.t('label.service-description'),
      items: [
        {
          label: i18next.t('label.team-plural'),
          description: i18next.t('label.service-description'),
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.TEAM,
            permissions
          ),
          key: 'members.teams',
          icon: TeamsIcon,
        },
        {
          label: i18next.t('label.user-plural'),
          description: i18next.t('label.service-description'),
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.USER,
            permissions
          ),
          key: 'members.users',
          icon: UsersIcon,
        },
        {
          label: i18next.t('label.admin-plural'),
          description: i18next.t('label.service-description'),
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.USER,
            permissions
          ),
          key: 'members.admins',
          icon: AdminIcon,
        },

        {
          label: i18next.t('label.persona-plural'),
          description: i18next.t('label.service-description'),
          isProtected: Boolean(isAdminUser),
          key: 'members.persona',
          icon: PersonasIcon,
        },
      ],
    },
    {
      category: i18next.t('label.access-control'),
      key: 'access',
      icon: AccessControlIcon,
      description: i18next.t('label.service-description'),
      items: [
        {
          label: i18next.t('label.role-plural'),
          description: i18next.t('label.service-description'),
          isProtected: Boolean(isAdminUser),
          key: 'access.roles',
          icon: RolesIcon,
        },
        {
          label: i18next.t('label.policy-plural'),
          description: i18next.t('label.service-description'),
          isProtected: Boolean(isAdminUser),
          key: 'access.policies',
          icon: PoliciesIcon,
        },
      ],
    },

    {
      category: i18next.t('label.customize-open-metadata'),
      key: 'openMetadata',
      icon: OpenMetadataIcon,
      description: i18next.t('label.service-description'),
      items: [
        {
          label: i18next.t('label.customize-entity', {
            entity: i18next.t('label.landing-page'),
          }),
          description: i18next.t('label.service-description'),
          isProtected: Boolean(isAdminUser),
          key: 'openMetadata.customizeLandingPage',
          icon: CustomDashboardLogoIcon,
        },
        {
          label: i18next.t('label.email'),
          description: i18next.t('label.service-description'),
          isProtected: Boolean(isAdminUser),
          key: 'openMetadata.email',
          icon: EmailIcon,
        },
        {
          label: i18next.t('label.custom-logo'),
          description: i18next.t('label.service-description'),
          isProtected: Boolean(isAdminUser),
          key: 'openMetadata.customLogo',
          icon: CustomLogoIcon,
        },
        {
          label: i18next.t('label.login-configuration'),
          description: i18next.t('label.service-description'),
          isProtected: Boolean(isAdminUser),
          key: 'openMetadata.loginConfiguration',
          icon: LoginIcon,
        },
      ],
    },
    {
      category: i18next.t('label.custom-property-plural'),
      key: 'customAttributes',
      icon: CustomProperties,
      description: i18next.t('label.service-description'),
      items: [
        {
          label: i18next.t('label.database'),
          description: i18next.t('label.service-description'),
          isProtected: Boolean(isAdminUser),
          key: 'customAttributes.databases',
          icon: DatabaseIcon,
        },
        {
          label: i18next.t('label.database-schema'),
          description: i18next.t('label.service-description'),
          isProtected: Boolean(isAdminUser),
          key: 'customAttributes.databaseSchemas',
          icon: SchemaIcon,
        },
        {
          label: i18next.t('label.table-plural'),
          description: i18next.t('label.service-description'),
          isProtected: Boolean(isAdminUser),
          key: 'customAttributes.tables',
          icon: TableIcon,
        },
        {
          label: i18next.t('label.stored-procedure-plural'),
          description: i18next.t('label.service-description'),
          isProtected: Boolean(isAdminUser),
          key: 'customAttributes.storedProcedures',
          icon: StoredProcedureIcon,
        },
        {
          label: i18next.t('label.dashboard-plural'),
          description: i18next.t('label.service-description'),
          isProtected: Boolean(isAdminUser),
          key: 'customAttributes.dashboards',
          icon: DashboardIcon,
        },
        {
          label: i18next.t('label.pipeline-plural'),
          description: i18next.t('label.service-description'),
          isProtected: Boolean(isAdminUser),
          key: 'customAttributes.pipelines',
          icon: PipelineIcon,
        },
        {
          label: i18next.t('label.topic-plural'),
          description: i18next.t('label.service-description'),
          isProtected: Boolean(isAdminUser),
          key: 'customAttributes.topics',
          icon: MessagingIcon,
        },
        {
          label: i18next.t('label.container-plural'),
          description: i18next.t('label.service-description'),
          isProtected: Boolean(isAdminUser),
          key: 'customAttributes.containers',
          icon: StorageIcon,
        },
        {
          label: i18next.t('label.ml-model-plural'),
          description: i18next.t('label.service-description'),
          isProtected: Boolean(isAdminUser),
          key: 'customAttributes.mlmodels',
          icon: MlModelIcon,
        },
        {
          label: i18next.t('label.search-index-plural'),
          description: i18next.t('label.service-description'),
          isProtected: Boolean(isAdminUser),
          key: 'customAttributes.searchIndexes',
          icon: SearchIcon,
        },
        {
          label: i18next.t('label.glossary-term'),
          description: i18next.t('label.service-description'),
          isProtected: Boolean(isAdminUser),
          key: 'customAttributes.glossaryTerm',
          icon: GlossaryIcon,
        },
      ],
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
