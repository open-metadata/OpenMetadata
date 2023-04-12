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

import { Badge } from 'antd';
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import classNames from 'classnames';
import {
  ResourceEntity,
  UIPermission,
} from 'components/PermissionProvider/PermissionProvider.interface';
import i18next from 'i18next';
import React, { ReactNode } from 'react';
import { ReactComponent as AdminIcon } from '../../src/assets/svg/admin.svg';
import { ReactComponent as AllActivityIcon } from '../../src/assets/svg/all-activity.svg';
import { ReactComponent as BotIcon } from '../../src/assets/svg/bot-profile.svg';
import { ReactComponent as DashboardIcon } from '../../src/assets/svg/dashboard-grey.svg';
import { ReactComponent as ElasticSearchIcon } from '../../src/assets/svg/elasticsearch.svg';
import { ReactComponent as BellIcon } from '../../src/assets/svg/ic-alert-bell.svg';
import { ReactComponent as RolesIcon } from '../../src/assets/svg/icon-role-grey.svg';
import { ReactComponent as OMLogo } from '../../src/assets/svg/metadata.svg';
import { ReactComponent as MlModelIcon } from '../../src/assets/svg/mlmodal.svg';
import { ReactComponent as PipelineIcon } from '../../src/assets/svg/pipeline-grey.svg';
import { ReactComponent as PoliciesIcon } from '../../src/assets/svg/policies.svg';
import { ReactComponent as TableIcon } from '../../src/assets/svg/table-grey.svg';
import { ReactComponent as TeamsIcon } from '../../src/assets/svg/teams-grey.svg';
import { ReactComponent as TopicIcon } from '../../src/assets/svg/topic-grey.svg';
import { ReactComponent as UsersIcon } from '../../src/assets/svg/user.svg';
import { ReactComponent as StorageIcon } from '../assets/svg/ic-storage.svg';
import { userPermissions } from '../utils/PermissionsUtils';

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
      ],
    },
    {
      category: i18next.t('label.access'),
      key: 'access',
      items: [
        {
          label: i18next.t('label.role-plural'),
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.ROLE,
            permissions
          ),
          key: 'access.roles',
          icon: <RolesIcon className="side-panel-icons" />,
        },
        {
          label: i18next.t('label.policy-plural'),
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.POLICY,
            permissions
          ),
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
          isBeta: Boolean,
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
      ],
    },
    {
      category: i18next.t('label.custom-attribute-plural'),
      key: 'customAttributes',
      items: [
        {
          label: i18next.t('label.table-plural'),
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.TYPE,
            permissions
          ),
          key: 'customAttributes.tables',
          icon: <TableIcon className="side-panel-icons" />,
        },
        {
          label: i18next.t('label.topic-plural'),
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.TYPE,
            permissions
          ),
          key: 'customAttributes.topics',
          icon: <TopicIcon className="side-panel-icons" />,
        },
        {
          label: i18next.t('label.dashboard-plural'),
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.TYPE,
            permissions
          ),
          key: 'customAttributes.dashboards',
          icon: <DashboardIcon className="side-panel-icons" />,
        },
        {
          label: i18next.t('label.pipeline-plural'),
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.TYPE,
            permissions
          ),
          key: 'customAttributes.pipelines',
          icon: <PipelineIcon className="side-panel-icons" />,
        },
        {
          label: i18next.t('label.ml-model-plural'),
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.TYPE,
            permissions
          ),
          key: 'customAttributes.mlModels',
          icon: <MlModelIcon className="side-panel-icons" />,
        },
        {
          label: i18next.t('label.container-plural'),
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.TYPE,
            permissions
          ),
          key: 'customAttributes.containers',
          icon: <StorageIcon className="side-panel-icons" />,
        },
      ],
    },
    {
      category: i18next.t('label.event-publisher-plural'),
      key: 'eventPublishers',
      items: [
        {
          label: i18next.t('label.elasticsearch'),
          isProtected: Boolean(isAdminUser),
          key: 'eventPublishers.elasticsearch',
          icon: (
            <ElasticSearchIcon className="tw-w-4 tw-mt-1.5 side-panel-icons" />
          ),
        },
      ],
    },
    {
      category: i18next.t('label.integration-plural'),
      key: 'integrations',
      items: [
        {
          label: i18next.t('label.bot-plural'),
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.BOT,
            permissions
          ),
          key: 'integrations.bots',
          icon: <BotIcon className="tw-w-4 side-panel-icons" />,
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
        color="#7147e8"
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
