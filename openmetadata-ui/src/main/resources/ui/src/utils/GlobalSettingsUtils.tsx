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

import { ItemType } from 'antd/lib/menu/hooks/useItems';
import { camelCase } from 'lodash';
import React, { ReactNode } from 'react';
import { ReactComponent as BotIcon } from '../../src/assets/svg/bot-profile.svg';
import { ReactComponent as DashboardIcon } from '../../src/assets/svg/dashboard-grey.svg';
import { ReactComponent as RolesIcon } from '../../src/assets/svg/icon-role-grey.svg';
import { ReactComponent as MlModelIcon } from '../../src/assets/svg/mlmodal.svg';
import { ReactComponent as PipelineIcon } from '../../src/assets/svg/pipeline-grey.svg';
import { ReactComponent as PoliciesIcon } from '../../src/assets/svg/policies.svg';
import { ReactComponent as SlackIcon } from '../../src/assets/svg/slack.svg';
import { ReactComponent as TableIcon } from '../../src/assets/svg/table-grey.svg';
import { ReactComponent as TeamsIcon } from '../../src/assets/svg/teams-grey.svg';
import { ReactComponent as TopicIcon } from '../../src/assets/svg/topic-grey.svg';
import { ReactComponent as UsersIcon } from '../../src/assets/svg/user.svg';
import { ReactComponent as WebhookIcon } from '../../src/assets/svg/webhook-grey.svg';
import {
  ResourceEntity,
  UIPermission,
} from '../components/PermissionProvider/PermissionProvider.interface';
import { Operation } from '../generated/entity/policies/accessControl/rule';
import { checkPermission } from '../utils/PermissionsUtils';

export interface MenuListItem {
  label: string;
  isProtected: boolean;
  icon: ReactNode;
}
export interface MenuList {
  category: string;
  items: MenuListItem[];
}

export const getGlobalSettingsMenuWithPermission = (
  permissions: UIPermission
) => {
  return [
    {
      category: 'Members',
      items: [
        {
          label: 'Teams',
          isProtected: checkPermission(
            Operation.ViewAll,
            ResourceEntity.TEAM,
            permissions
          ),
          icon: <TeamsIcon className="side-panel-icons" />,
        },
        {
          label: 'Users',
          isProtected: checkPermission(
            Operation.ViewAll,
            ResourceEntity.USER,
            permissions
          ),
          icon: <UsersIcon className="side-panel-icons" />,
        },
        {
          label: 'Admins',
          isProtected: checkPermission(
            Operation.ViewAll,
            ResourceEntity.USER,
            permissions
          ),
          icon: <UsersIcon className="side-panel-icons" />,
        },
      ],
    },
    {
      category: 'Access',
      items: [
        {
          label: 'Roles',
          isProtected: checkPermission(
            Operation.ViewAll,
            ResourceEntity.ROLE,
            permissions
          ),
          icon: <RolesIcon className="side-panel-icons" />,
        },
        {
          label: 'Policies',
          isProtected: checkPermission(
            Operation.ViewAll,
            ResourceEntity.POLICY,
            permissions
          ),
          icon: <PoliciesIcon className="side-panel-icons" />,
        },
      ],
    },
    {
      category: 'Services',
      items: [
        {
          label: 'Databases',
          isProtected: checkPermission(
            Operation.ViewAll,
            ResourceEntity.DATABASE_SERVICE,
            permissions
          ),
          icon: <TableIcon className="side-panel-icons" />,
        },
        {
          label: 'Messaging',
          isProtected: checkPermission(
            Operation.ViewAll,
            ResourceEntity.MESSAGING_SERVICE,
            permissions
          ),
          icon: <TopicIcon className="side-panel-icons" />,
        },
        {
          label: 'Dashboards',
          isProtected: checkPermission(
            Operation.ViewAll,
            ResourceEntity.DASHBOARD_SERVICE,
            permissions
          ),
          icon: <DashboardIcon className="side-panel-icons" />,
        },
        {
          label: 'Pipelines',
          isProtected: checkPermission(
            Operation.ViewAll,
            ResourceEntity.PIPELINE_SERVICE,
            permissions
          ),
          icon: <PipelineIcon className="side-panel-icons" />,
        },
        {
          label: 'ML Models',
          isProtected: checkPermission(
            Operation.ViewAll,
            ResourceEntity.ML_MODEL_SERVICE,
            permissions
          ),
          icon: <MlModelIcon className="side-panel-icons" />,
        },
      ],
    },
    {
      category: 'Custom Attributes',
      items: [
        {
          label: 'Tables',
          isProtected: checkPermission(
            Operation.ViewAll,
            ResourceEntity.TYPE,
            permissions
          ),
          icon: <TableIcon className="side-panel-icons" />,
        },
        {
          label: 'Topics',
          isProtected: checkPermission(
            Operation.ViewAll,
            ResourceEntity.TYPE,
            permissions
          ),
          icon: <TopicIcon className="side-panel-icons" />,
        },
        {
          label: 'Dashboards',
          isProtected: checkPermission(
            Operation.ViewAll,
            ResourceEntity.TYPE,
            permissions
          ),
          icon: <DashboardIcon className="side-panel-icons" />,
        },
        {
          label: 'Pipelines',
          isProtected: checkPermission(
            Operation.ViewAll,
            ResourceEntity.TYPE,
            permissions
          ),
          icon: <PipelineIcon className="side-panel-icons" />,
        },
        {
          label: 'ML Models',
          isProtected: checkPermission(
            Operation.ViewAll,
            ResourceEntity.TYPE,
            permissions
          ),
          icon: <MlModelIcon className="side-panel-icons" />,
        },
      ],
    },
    {
      category: 'Integrations',
      items: [
        {
          label: 'Webhook',
          isProtected: checkPermission(
            Operation.ViewAll,
            ResourceEntity.WEBHOOK,
            permissions
          ),
          icon: <WebhookIcon className="tw-w-4 side-panel-icons" />,
        },
        {
          label: 'Slack',
          isProtected: checkPermission(
            Operation.ViewAll,
            ResourceEntity.WEBHOOK,
            permissions
          ),
          icon: <SlackIcon className="tw-w-4 side-panel-icons" />,
        },
        {
          label: 'Bots',
          isProtected: checkPermission(
            Operation.ViewAll,
            ResourceEntity.BOT,
            permissions
          ),
          icon: <BotIcon className="tw-w-4 side-panel-icons" />,
        },
      ],
    },
  ];
};

export const getGlobalSettingMenuItem = (
  label: string,
  key: string,
  category?: string,
  icon?: React.ReactNode,
  children?: {
    label: string;
    isProtected: boolean;
    icon: React.ReactNode;
  }[],
  type?: string
): {
  key: string;
  icon: React.ReactNode;
  children: ItemType[] | undefined;
  label: string;
  type: string | undefined;
} => {
  const subItems = children
    ? children
        .filter((menu) => menu.isProtected)
        .map(({ label, icon }) => {
          return getGlobalSettingMenuItem(label, camelCase(label), key, icon);
        })
    : undefined;

  return {
    key: `${category}.${key}`,
    icon,
    children: subItems,
    label,
    type,
  };
};
