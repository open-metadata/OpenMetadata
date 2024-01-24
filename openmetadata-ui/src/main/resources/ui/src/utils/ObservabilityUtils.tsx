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
import { includes } from 'lodash';
import React from 'react';
import { ReactComponent as AdminIcon } from '../assets/svg/admin-colored-icon.svg';
import { ReactComponent as GChatIcon } from '../assets/svg/gchat.svg';
import { ReactComponent as PipelineIcon } from '../assets/svg/ic-pipeline.svg';
import { ReactComponent as ContainerIcon } from '../assets/svg/ic-storage.svg';
import { ReactComponent as TableIcon } from '../assets/svg/ic-table.svg';
import { ReactComponent as TopicIcon } from '../assets/svg/ic-topic.svg';
import { ReactComponent as IconTestSuite } from '../assets/svg/icon-test-suite.svg';
import { ReactComponent as MSTeamsIcon } from '../assets/svg/ms-teams.svg';
import { ReactComponent as SlackIcon } from '../assets/svg/slack.svg';
import { ReactComponent as TeamIcon } from '../assets/svg/team-colored-icon.svg';
import { ReactComponent as UserIcon } from '../assets/svg/user-colored-icon.svg';
import { ReactComponent as GenericIcon } from '../assets/svg/webhook.svg';
import { SubscriptionCategory } from '../generated/events/eventSubscription';

export const getIconForEntity = (type: string) => {
  switch (type) {
    case 'container':
      return <ContainerIcon height={16} width={16} />;
    case 'pipeline':
      return <PipelineIcon height={16} width={16} />;
    case 'topic':
      return <TopicIcon height={16} width={16} />;
    case 'table':
      return <TableIcon height={16} width={16} />;
    case 'testCase':
    case 'testSuite':
      return <IconTestSuite height={16} width={16} />;
    case 'Teams':
      return <TeamIcon height={16} width={16} />;
    case 'Users':
      return <UserIcon height={16} width={16} />;
    case 'Admins':
      return <AdminIcon height={16} width={16} />;
    case 'GChat':
      return <GChatIcon height={16} width={16} />;
    case 'Slack':
      return <SlackIcon height={16} width={16} />;
    case 'Email':
      return <MailOutlined height={16} width={16} />;
    case 'MsTeams':
    case 'Followers':
      return <MSTeamsIcon height={16} width={16} />;
    case 'Generic':
    case 'Owners':
      return <GenericIcon height={16} width={16} />;
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
