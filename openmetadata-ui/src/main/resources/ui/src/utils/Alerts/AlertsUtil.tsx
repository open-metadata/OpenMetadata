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

import { Card, Typography } from 'antd';
import i18next from 'i18next';
import React from 'react';
import { ReactComponent as AllActivityIcon } from '../../assets/svg/all-activity.svg';
import { ReactComponent as MailIcon } from '../../assets/svg/ic-mail.svg';
import { ReactComponent as MSTeamsIcon } from '../../assets/svg/ms-teams-grey.svg';
import { ReactComponent as SlackIcon } from '../../assets/svg/slack-grey.svg';
import { ReactComponent as WebhookIcon } from '../../assets/svg/webhook-grey.svg';
import { AlertActionType } from '../../generated/alerts/alertAction';
import { AlertTriggerType } from '../../generated/alerts/alerts';

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
      return i18next.t('label.fqn-uppercase');
    case 'matchAnyOwnerName':
      return i18next.t('label.owner');
    case 'matchAnyEventType':
      return i18next.t('label.event-type');
    case 'matchTestResult':
      return i18next.t('label.test-results');
    case 'matchUpdatedBy':
      return i18next.t('label.updated-by');
    case 'matchAnySource':
    case 'matchAnyEntityId':
    default:
      return '';
  }
};

export const StyledCard = ({
  heading,
  subHeading,
}: {
  heading: string;
  subHeading: string;
}) => {
  return (
    <Card bordered={false} className="bg-grey">
      <Typography.Text>{heading}</Typography.Text>
      <br />
      <Typography.Text className="text-xs text-grey-muted">
        {subHeading}
      </Typography.Text>
    </Card>
  );
};

export const getDisplayNameForTriggerType = (type: AlertTriggerType) => {
  switch (type) {
    case AlertTriggerType.AllDataAssets:
      return i18next.t('label.all-data-assets');
    case AlertTriggerType.SpecificDataAsset:
      return i18next.t('label.specific-data-assets');
  }
};
