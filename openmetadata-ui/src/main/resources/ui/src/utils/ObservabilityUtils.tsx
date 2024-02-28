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
import { MailOutlined } from '@ant-design/icons';
import { includes, isNil } from 'lodash';
import React from 'react';
import { ReactComponent as AdminIcon } from '../assets/svg/admin-colored-icon.svg';
import { ReactComponent as GChatIcon } from '../assets/svg/gchat.svg';
import { ReactComponent as MSTeamsIcon } from '../assets/svg/ms-teams.svg';
import { ReactComponent as SlackIcon } from '../assets/svg/slack.svg';
import { ReactComponent as TeamIcon } from '../assets/svg/team-colored-icon.svg';
import { ReactComponent as UserIcon } from '../assets/svg/user-colored-icon.svg';
import { ReactComponent as AssigneeIcon } from '../assets/svg/user.svg';
import { ReactComponent as GenericIcon } from '../assets/svg/webhook.svg';
import { SubscriptionCategory } from '../generated/events/eventSubscription';

export const getAlertDestinationCategoryIcons = (type: string) => {
  let Icon;

  switch (type) {
    case 'Teams':
      Icon = TeamIcon;

      break;
    case 'Users':
      Icon = UserIcon;

      break;
    case 'Admins':
      Icon = AdminIcon;

      break;
    case 'Assignees':
      Icon = AssigneeIcon;

      break;
    case 'GChat':
      Icon = GChatIcon;

      break;
    case 'Slack':
      Icon = SlackIcon;

      break;
    case 'Email':
      Icon = MailOutlined;

      break;
    case 'MsTeams':
    case 'Followers':
      Icon = MSTeamsIcon;

      break;
    case 'Generic':
    case 'Owners':
      Icon = GenericIcon;

      break;
  }

  if (!isNil(Icon)) {
    return <Icon height={16} width={16} />;
  }

  return null;
};

export const checkIfDestinationIsInternal = (destinationName: string) => {
  const isDestinationInternal = includes(SubscriptionCategory, destinationName);

  return isDestinationInternal;
};

export const getConfigFieldFromDestinationType = (destinationType: string) => {
  switch (destinationType) {
    case SubscriptionCategory.Admins:
      return 'sendToAdmins';
    case SubscriptionCategory.Owners:
      return 'sendToOwners';
    case SubscriptionCategory.Followers:
      return 'sendToFollowers';
    default:
      return '';
  }
};
