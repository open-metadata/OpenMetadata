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
import AdminIcon from '../assets/svg/admin-colored-icon.svg?react';
import GChatIcon from '../assets/svg/gchat.svg?react';
import MentionIcon from '../assets/svg/ic-mentions.svg?react';
import FollowingIcon from '../assets/svg/ic-star.svg?react';
import MSTeamsIcon from '../assets/svg/ms-teams.svg?react';
import SlackIcon from '../assets/svg/slack.svg?react';
import TeamIcon from '../assets/svg/team-colored-icon.svg?react';
import UserIcon from '../assets/svg/user-colored-icon.svg?react';
import {
  default as AssigneeIcon,
  default as OwnerIcon,
} from '../assets/svg/user.svg?react';
import GenericIcon from '../assets/svg/webhook.svg?react';
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
    case 'Mentions':
      Icon = MentionIcon;

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
      Icon = MSTeamsIcon;

      break;

    case 'Followers':
      Icon = FollowingIcon;

      break;

    case 'Webhook':
      Icon = GenericIcon;

      break;

    case 'Owners':
      Icon = OwnerIcon;

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
