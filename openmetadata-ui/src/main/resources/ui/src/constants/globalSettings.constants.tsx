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

import React from 'react';
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

export const GLOBAL_SETTINGS_MENU = [
  {
    category: 'Members',
    isProtected: false,
    items: [
      {
        label: 'Teams',
        isProtected: false,
        icon: <TeamsIcon className="side-panel-icons" />,
      },
      {
        label: 'Users',
        isProtected: true,
        icon: <UsersIcon className="side-panel-icons" />,
      },
      {
        label: 'Admins',
        isProtected: true,
        icon: <UsersIcon className="side-panel-icons" />,
      },
    ],
  },
  {
    category: 'Access',
    isProtected: false,
    items: [
      {
        label: 'Roles',
        isProtected: true,
        icon: <RolesIcon className="side-panel-icons" />,
      },
      {
        label: 'Policies',
        isProtected: true,
        icon: <PoliciesIcon className="side-panel-icons" />,
      },
    ],
  },
  {
    category: 'Services',
    isProtected: false,
    items: [
      {
        label: 'Databases',
        isProtected: false,
        icon: <TableIcon className="side-panel-icons" />,
      },
      {
        label: 'Messaging',
        isProtected: false,
        icon: <TopicIcon className="side-panel-icons" />,
      },
      {
        label: 'Dashboards',
        isProtected: false,
        icon: <DashboardIcon className="side-panel-icons" />,
      },
      {
        label: 'Pipelines',
        isProtected: false,
        icon: <PipelineIcon className="side-panel-icons" />,
      },
      {
        label: 'ML Models',
        isProtected: false,
        icon: <MlModelIcon className="side-panel-icons" />,
      },
    ],
  },
  {
    category: 'Custom Attributes',
    isProtected: true,
    items: [
      {
        label: 'Tables',
        isProtected: true,
        icon: <TableIcon className="side-panel-icons" />,
      },
      {
        label: 'Topics',
        isProtected: true,
        icon: <TopicIcon className="side-panel-icons" />,
      },
      {
        label: 'Dashboards',
        isProtected: true,
        icon: <DashboardIcon className="side-panel-icons" />,
      },
      {
        label: 'Pipelines',
        isProtected: true,
        icon: <PipelineIcon className="side-panel-icons" />,
      },
      {
        label: 'ML Models',
        isProtected: true,
        icon: <MlModelIcon className="side-panel-icons" />,
      },
    ],
  },
  {
    category: 'Integrations',
    isProtected: true,
    items: [
      {
        label: 'Webhook',
        isProtected: true,
        icon: <WebhookIcon className="tw-w-4 side-panel-icons" />,
      },
      {
        label: 'Slack',
        isProtected: true,
        icon: <SlackIcon className="tw-w-4 side-panel-icons" />,
      },
      {
        label: 'Bots',
        isProtected: true,
        icon: <BotIcon className="tw-w-4 side-panel-icons" />,
      },
    ],
  },
];

export const customAttributesPath = {
  tables: 'table',
  topics: 'topic',
  dashboards: 'dashboard',
  pipelines: 'pipeline',
  mlModels: 'mlmodel',
};

export enum GlobalSettingsMenuCategory {
  MEMBERS = 'members',
  ACCESS = 'access',
  SERVICES = 'services',
  CUSTOM_ATTRIBUTES = 'customAttributes',
  INTEGRATIONS = 'integrations',
}

export enum GlobalSettingOptions {
  USERS = 'users',
  ADMINS = 'admins',
  TEAMS = 'teams',
  ROLES = 'roles',
  POLICIES = 'policies',
  DATABASES = 'databases',
  MESSAGING = 'messaging',
  DASHBOARDS = 'dashboards',
  PIPELINES = 'pipelines',
  MLMODELS = 'mlModels',
  WEBHOOK = 'webhook',
  SLACK = 'slack',
  BOTS = 'bots',
  TABLES = 'tables',
}
