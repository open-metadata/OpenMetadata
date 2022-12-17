/*
 *  Copyright 2021 Collate
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
import { ReactComponent as AllActivityIcon } from '../../assets/svg/all-activity.svg';
import { ReactComponent as MailIcon } from '../../assets/svg/ic-mail.svg';
import { ReactComponent as MSTeamsIcon } from '../../assets/svg/ms-teams-grey.svg';
import { ReactComponent as SlackIcon } from '../../assets/svg/slack-grey.svg';
import { ReactComponent as WebhookIcon } from '../../assets/svg/webhook-grey.svg';
import { AlertActionType } from '../../generated/alerts/alertAction';

export const getAlertsActionTypeIcon = (type?: AlertActionType) => {
  switch (type) {
    case AlertActionType.SlackWebhook:
      return <SlackIcon height={16} width={16} />;
    case AlertActionType.MSTeamsWebhook:
      return <MSTeamsIcon height={16} width={16} />;
    case AlertActionType.Email:
      return <MailIcon height={16} width={16} />;
    case AlertActionType.ActivityFeed:
      return <AllActivityIcon height={16} width={16} />;
    case AlertActionType.GenericWebhook:
    default:
      return <WebhookIcon height={16} width={16} />;
  }
};

export const getFunctionDisplayName = (func: string): string => {
  switch (func) {
    case 'matchAnyEntityFqn':
      return 'Match FQN';
    case 'matchAnyOwnerName':
      return 'Match Owner';
    case 'matchAnyEventType':
      return 'Match Event Type';
    case 'matchTestResult':
      return 'Match Test Results';
    case 'matchUpdatedBy':
      return 'Match Updated By';
    case 'matchAnySource':
    case 'matchAnyEntityId':
    default:
      return '';
  }
};
