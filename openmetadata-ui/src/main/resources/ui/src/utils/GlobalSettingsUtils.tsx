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
import { ReactComponent as AdminIcon } from '../../src/assets/svg/admin.svg';
import { ReactComponent as AllActivityIcon } from '../../src/assets/svg/all-activity.svg';
import { ReactComponent as BotIcon } from '../../src/assets/svg/bot-profile.svg';
import { ReactComponent as DashboardIcon } from '../../src/assets/svg/dashboard-grey.svg';
import { ReactComponent as ElasticSearchIcon } from '../../src/assets/svg/elasticsearch.svg';
import { ReactComponent as RolesIcon } from '../../src/assets/svg/icon-role-grey.svg';
import { ReactComponent as TestSuite } from '../../src/assets/svg/icon-test-suite.svg';
import { ReactComponent as MlModelIcon } from '../../src/assets/svg/mlmodal.svg';
import { ReactComponent as MSTeamsIcon } from '../../src/assets/svg/ms-teams.svg';
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
import { userPermissions } from '../utils/PermissionsUtils';

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
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.TEAM,
            permissions
          ),

          icon: <TeamsIcon className="side-panel-icons" />,
        },
        {
          label: 'Users',
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.USER,
            permissions
          ),
          icon: <UsersIcon className="side-panel-icons" />,
        },
        {
          label: 'Admins',
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.USER,
            permissions
          ),
          icon: <AdminIcon className="side-panel-icons" />,
        },
      ],
    },
    {
      category: 'Access',
      items: [
        {
          label: 'Roles',
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.ROLE,
            permissions
          ),
          icon: <RolesIcon className="side-panel-icons" />,
        },
        {
          label: 'Policies',
          isProtected: userPermissions.hasViewPermissions(
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
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.DATABASE_SERVICE,
            permissions
          ),
          icon: <TableIcon className="side-panel-icons" />,
        },
        {
          label: 'Messaging',
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.MESSAGING_SERVICE,
            permissions
          ),
          icon: <TopicIcon className="side-panel-icons" />,
        },
        {
          label: 'Dashboards',
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.DASHBOARD_SERVICE,
            permissions
          ),
          icon: <DashboardIcon className="side-panel-icons" />,
        },
        {
          label: 'Pipelines',
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.PIPELINE_SERVICE,
            permissions
          ),
          icon: <PipelineIcon className="side-panel-icons" />,
        },
        {
          label: 'ML Models',
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.ML_MODEL_SERVICE,
            permissions
          ),
          icon: <MlModelIcon className="side-panel-icons" />,
        },
      ],
    },
    {
      category: 'Data Quality',
      items: [
        {
          label: 'Test Suite',
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.TEST_SUITE,
            permissions
          ),
          icon: <TestSuite className="side-panel-icons" />,
        },
      ],
    },
    {
      category: 'Collaboration',
      items: [
        {
          label: 'Activity Feed',
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.FEED,
            permissions
          ),
          icon: <AllActivityIcon className="side-panel-icons" />,
        },
      ],
    },
    {
      category: 'Custom Attributes',
      items: [
        {
          label: 'Tables',
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.TYPE,
            permissions
          ),
          icon: <TableIcon className="side-panel-icons" />,
        },
        {
          label: 'Topics',
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.TYPE,
            permissions
          ),
          icon: <TopicIcon className="side-panel-icons" />,
        },
        {
          label: 'Dashboards',
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.TYPE,
            permissions
          ),
          icon: <DashboardIcon className="side-panel-icons" />,
        },
        {
          label: 'Pipelines',
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.TYPE,
            permissions
          ),
          icon: <PipelineIcon className="side-panel-icons" />,
        },
        {
          label: 'ML Models',
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.TYPE,
            permissions
          ),
          icon: <MlModelIcon className="side-panel-icons" />,
        },
      ],
    },
    {
      category: 'Event Publishers',
      items: [
        {
          label: 'Elasticsearch',
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.ALL,
            permissions
          ),
          icon: (
            <ElasticSearchIcon className="tw-w-4 tw-mt-1.5 side-panel-icons" />
          ),
        },
      ],
    },
    {
      category: 'Integrations',
      items: [
        {
          label: 'Webhook',
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.WEBHOOK,
            permissions
          ),
          icon: <WebhookIcon className="tw-w-4 side-panel-icons" />,
        },
        {
          label: 'Slack',
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.WEBHOOK,
            permissions
          ),
          icon: <SlackIcon className="tw-w-4 side-panel-icons" />,
        },
        {
          label: 'MS Teams',
          isProtected: userPermissions.hasViewPermissions(
            ResourceEntity.WEBHOOK,
            permissions
          ),
          icon: <MSTeamsIcon className="tw-w-4 side-panel-icons" />,
        },
        {
          label: 'Bots',
          isProtected: userPermissions.hasViewPermissions(
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
