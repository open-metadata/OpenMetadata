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

import { SearchOutlined } from '@ant-design/icons';
import { Badge } from 'antd';
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import classNames from 'classnames';
import i18next from 'i18next';
import React, { ReactNode } from 'react';
import { ReactComponent as AdminIcon } from '../assets/svg/admin.svg';
import { ReactComponent as AllActivityIcon } from '../assets/svg/all-activity.svg';
import { ReactComponent as AppIcon } from '../assets/svg/application.svg';
import { ReactComponent as BotIcon } from '../assets/svg/bot-profile.svg';
import { ReactComponent as DashboardIcon } from '../assets/svg/dashboard-grey.svg';
import { ReactComponent as EmailSettingsIcon } from '../assets/svg/email-settings.svg';
import { ReactComponent as GlossaryIcon } from '../assets/svg/glossary.svg';
import { ReactComponent as BellIcon } from '../assets/svg/ic-alert-bell.svg';
import { ReactComponent as CustomDashboardLogoIcon } from '../assets/svg/ic-custom-dashboard-logo.svg';
import { ReactComponent as CustomLogoIcon } from '../assets/svg/ic-custom-logo.svg';
import { ReactComponent as DataInsightReportIcon } from '../assets/svg/ic-data-insight-report.svg';
import { ReactComponent as DatabaseIcon } from '../assets/svg/ic-database.svg';
import { ReactComponent as PersonasIcon } from '../assets/svg/ic-personas.svg';
import { ReactComponent as SchemaIcon } from '../assets/svg/ic-schema.svg';
import { ReactComponent as StorageIcon } from '../assets/svg/ic-storage.svg';
import { ReactComponent as StoredProcedureIcon } from '../assets/svg/ic-stored-procedure.svg';
import { ReactComponent as RolesIcon } from '../assets/svg/icon-role-grey.svg';
import { ReactComponent as OMLogo } from '../assets/svg/metadata.svg';
import { ReactComponent as MlModelIcon } from '../assets/svg/mlmodal.svg';
import { ReactComponent as PipelineIcon } from '../assets/svg/pipeline-grey.svg';
import { ReactComponent as PoliciesIcon } from '../assets/svg/policies.svg';
import { ReactComponent as TableIcon } from '../assets/svg/table-grey.svg';
import { ReactComponent as TeamsIcon } from '../assets/svg/teams-grey.svg';
import { ReactComponent as TopicIcon } from '../assets/svg/topic-grey.svg';
import { ReactComponent as UsersIcon } from '../assets/svg/user.svg';
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
}
export interface MenuList {
  category: string;
  items: MenuListItem[];
  isBeta?: boolean;
  key: string;
}

export const getGlobalSettingsMenuWithPermission = (
  permissions: UIPermission,
  isAdminUser: boolean | undefined
) => {
  return [
    {
      category: i18next.t('label.member-plural'),
      key: 'members',
      items: [
        {
          label: i18next.t('label.team-plural'),
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.TEAM,
            permissions
          ),
          key: 'members.teams',
          icon: <TeamsIcon className="side-panel-icons" />,
        },
        {
          label: i18next.t('label.user-plural'),
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.USER,
            permissions
          ),
          key: 'members.users',
          icon: <UsersIcon className="side-panel-icons" />,
        },
        {
          label: i18next.t('label.admin-plural'),
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.USER,
            permissions
          ),
          key: 'members.admins',
          icon: <AdminIcon className="side-panel-icons" />,
        },

        {
          label: i18next.t('label.persona-plural'),
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.USER,
            permissions
          ),
          key: 'members.persona',
          icon: <PersonasIcon className="side-panel-icons" />,
        },
      ],
    },
    {
      category: i18next.t('label.access'),
      key: 'access',
      items: [
        {
          label: i18next.t('label.role-plural'),
          isProtected: Boolean(isAdminUser),
          key: 'access.roles',
          icon: <RolesIcon className="side-panel-icons" />,
        },
        {
          label: i18next.t('label.policy-plural'),
          isProtected: Boolean(isAdminUser),
          key: 'access.policies',
          icon: <PoliciesIcon className="side-panel-icons" />,
        },
      ],
    },
    {
      category: i18next.t('label.service-plural'),
      key: 'services',
      items: [
        {
          label: i18next.t('label.database-plural'),
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.DATABASE_SERVICE,
            permissions
          ),
          key: 'services.databases',
          icon: <TableIcon className="side-panel-icons" />,
        },
        {
          label: i18next.t('label.messaging'),
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.MESSAGING_SERVICE,
            permissions
          ),
          key: 'services.messaging',
          icon: <TopicIcon className="side-panel-icons" />,
        },
        {
          label: i18next.t('label.dashboard-plural'),
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.DASHBOARD_SERVICE,
            permissions
          ),
          key: 'services.dashboards',
          icon: <DashboardIcon className="side-panel-icons" />,
        },
        {
          label: i18next.t('label.pipeline-plural'),
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.PIPELINE_SERVICE,
            permissions
          ),
          key: 'services.pipelines',
          icon: <PipelineIcon className="side-panel-icons" />,
        },
        {
          label: i18next.t('label.ml-model-plural'),
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.ML_MODEL_SERVICE,
            permissions
          ),
          key: 'services.mlModels',
          icon: <MlModelIcon className="side-panel-icons" />,
        },
        {
          label: i18next.t('label.metadata'),
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.METADATA_SERVICE,
            permissions
          ),
          key: 'services.metadata',
          icon: <OMLogo className="side-panel-icons w-4 h-4" />,
        },
        {
          label: i18next.t('label.storage-plural'),
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.STORAGE_SERVICE,
            permissions
          ),
          key: 'services.storages',
          icon: <StorageIcon className="side-panel-icons w-4 h-4" />,
        },
        {
          label: i18next.t('label.search'),
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.SEARCH_SERVICE,
            permissions
          ),
          key: 'services.search',
          icon: <SearchOutlined className="side-panel-icons w-4 h-4" />,
        },
      ],
    },

    {
      category: i18next.t('label.integration-plural'),
      key: 'integrations',
      items: [
        {
          label: i18next.t('label.application-plural'),
          isProtected: Boolean(isAdminUser),
          key: 'integrations.apps',
          icon: <AppIcon className="side-panel-icons" />,
        },
        {
          label: i18next.t('label.bot-plural'),
          isProtected: Boolean(isAdminUser),
          key: 'integrations.bots',
          icon: <BotIcon className="w-4 side-panel-icons" />,
        },
      ],
    },
    {
      category: i18next.t('label.notification-plural'),
      key: 'notifications',
      items: [
        {
          label: i18next.t('label.activity-feed-plural'),
          isProtected: Boolean(isAdminUser),
          key: 'notifications.activityFeeds',
          icon: <AllActivityIcon className="side-panel-icons" />,
        },
        {
          label: i18next.t('label.alert-plural'),
          isProtected: Boolean(isAdminUser),
          key: 'notifications.alerts',
          icon: <BellIcon className="side-panel-icons" />,
        },
        {
          label: i18next.t('label.data-insight-report'),
          isProtected: Boolean(isAdminUser),
          key: 'notifications.dataInsightReport',
          icon: <DataInsightReportIcon className="side-panel-icons" />,
        },
      ],
    },
    {
      category: i18next.t('label.custom-attribute-plural'),
      key: 'customAttributes',
      items: [
        {
          label: i18next.t('label.database'),
          isProtected: Boolean(isAdminUser),
          key: 'customAttributes.database',
          icon: <DatabaseIcon className="side-panel-icons" />,
        },
        {
          label: i18next.t('label.database-schema'),
          isProtected: Boolean(isAdminUser),
          key: 'customAttributes.databaseSchema',
          icon: <SchemaIcon className="side-panel-icons" />,
        },
        {
          label: i18next.t('label.table-plural'),
          isProtected: Boolean(isAdminUser),
          key: 'customAttributes.tables',
          icon: <TableIcon className="side-panel-icons" />,
        },
        {
          label: i18next.t('label.stored-procedure-plural'),
          isProtected: Boolean(isAdminUser),
          key: 'customAttributes.storedProcedure',
          icon: <StoredProcedureIcon className="side-panel-icons" />,
        },
        {
          label: i18next.t('label.dashboard-plural'),
          isProtected: Boolean(isAdminUser),
          key: 'customAttributes.dashboards',
          icon: <DashboardIcon className="side-panel-icons" />,
        },
        {
          label: i18next.t('label.pipeline-plural'),
          isProtected: Boolean(isAdminUser),
          key: 'customAttributes.pipelines',
          icon: <PipelineIcon className="side-panel-icons" />,
        },
        {
          label: i18next.t('label.topic-plural'),
          isProtected: Boolean(isAdminUser),
          key: 'customAttributes.topics',
          icon: <TopicIcon className="side-panel-icons" />,
        },
        {
          label: i18next.t('label.container-plural'),
          isProtected: Boolean(isAdminUser),
          key: 'customAttributes.containers',
          icon: <StorageIcon className="side-panel-icons" />,
        },
        {
          label: i18next.t('label.ml-model-plural'),
          isProtected: Boolean(isAdminUser),
          key: 'customAttributes.mlModels',
          icon: <MlModelIcon className="side-panel-icons" />,
        },
        {
          label: i18next.t('label.search-index'),
          isProtected: Boolean(isAdminUser),
          key: 'customAttributes.searchIndex',
          icon: <SearchOutlined className="side-panel-icons" />,
        },
        {
          label: i18next.t('label.glossary-term'),
          isProtected: Boolean(isAdminUser),
          key: 'customAttributes.glossaryTerm',
          icon: <GlossaryIcon className="side-panel-icons" />,
        },
      ],
    },
    {
      category: i18next.t('label.open-metadata'),
      key: 'openMetadata',
      items: [
        {
          label: i18next.t('label.email'),
          isProtected: Boolean(isAdminUser),
          key: 'openMetadata.email',
          icon: <EmailSettingsIcon className="w-4 side-panel-icons" />,
        },
        {
          label: i18next.t('label.customize-landing-page'),
          isProtected: Boolean(isAdminUser),
          key: 'openMetadata.customizeLandingPage',
          icon: <CustomDashboardLogoIcon className="w-4 side-panel-icons" />,
        },
        {
          label: i18next.t('label.custom-logo'),
          isProtected: Boolean(isAdminUser),
          key: 'openMetadata.customLogo',
          icon: <CustomLogoIcon className="w-4 side-panel-icons" />,
        },
      ],
    },
  ];
};

export const getGlobalSettingMenuItem = (args: {
  label: string;
  key: string;
  category?: string;
  icon?: React.ReactNode;
  children?: {
    label: string;
    isProtected: boolean;
    icon: React.ReactNode;
    isBeta?: boolean;
    key: string;
  }[];
  type?: string;
  isBeta?: boolean;
  isChildren?: boolean;
}): {
  key: string;
  icon: React.ReactNode;
  children: ItemType[] | undefined;
  label: ReactNode;
  type: string | undefined;
} => {
  const { children, label, key, icon, category, isBeta, type, isChildren } =
    args;

  const subItems = children
    ? children
        .filter((menu) => menu.isProtected)
        .map(({ label, icon, isBeta: isChildBeta, key: subKey }) => {
          return getGlobalSettingMenuItem({
            label,
            key: subKey,
            category: category,
            icon,
            isBeta: isChildBeta,
            isChildren: true,
          });
        })
    : undefined;

  return {
    key: key,
    icon,
    children: subItems,
    label: isBeta ? (
      <Badge
        className={classNames({ 'text-xs text-grey-muted': !isChildren })}
        color="#0968da"
        count="beta"
        offset={[30, 8]}
        size="small">
        {label}
      </Badge>
    ) : (
      label
    ),
    type,
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
