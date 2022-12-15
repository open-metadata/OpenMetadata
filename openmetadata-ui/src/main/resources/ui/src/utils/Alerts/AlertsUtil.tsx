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
import { ReactComponent as MSTeamsIcon } from '../../assets/svg/ms-teams.svg';
import { ReactComponent as SlackIcon } from '../../assets/svg/slack.svg';
import { ReactComponent as WebhookIcon } from '../../assets/svg/webhook-grey.svg';
import {
  COMMON_DROPDOWN_ITEMS,
  DASHBOARD_DROPDOWN_ITEMS,
  PIPELINE_DROPDOWN_ITEMS,
  TABLE_DROPDOWN_ITEMS,
} from '../../constants/AdvancedSearch.constants';
import { AlertActionType } from '../../generated/alerts/alertAction';

export const getAlertsActionTypeIcon = (type?: AlertActionType) => {
  switch (type) {
    case AlertActionType.SlackWebhook:
      return <SlackIcon height={16} width={16} />;
    case AlertActionType.MSTeamsWebhook:
      return <MSTeamsIcon height={16} width={16} />;
    case AlertActionType.Email:
      // TODO: update below with EMail icon
      return <MSTeamsIcon height={16} width={16} />;
    case AlertActionType.GenericWebhook:
    default:
      return <WebhookIcon height={16} width={16} />;
  }
};

export const getFilterOptionForEntity = (entity: string) => {
  switch (entity) {
    case 'testCase':
      return [...COMMON_DROPDOWN_ITEMS];
    case 'table':
      return [...TABLE_DROPDOWN_ITEMS, ...COMMON_DROPDOWN_ITEMS];
    case 'dashboard':
      return [...DASHBOARD_DROPDOWN_ITEMS, ...COMMON_DROPDOWN_ITEMS];
    case 'pipeline':
      return [...PIPELINE_DROPDOWN_ITEMS, ...COMMON_DROPDOWN_ITEMS];
    case 'mlmodel':
      return [
        ...COMMON_DROPDOWN_ITEMS.filter((item) => item.key !== 'service_type'),
      ];
    default:
      return [];
  }
};
