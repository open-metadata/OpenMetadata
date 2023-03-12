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

import { Typography } from 'antd';
import { RuleObject } from 'antd/lib/form';
import i18next from 'i18next';
import { startCase } from 'lodash';
import React from 'react';
import { ReactComponent as AllActivityIcon } from '../../assets/svg/all-activity.svg';
import { ReactComponent as MailIcon } from '../../assets/svg/ic-mail.svg';
import { ReactComponent as MSTeamsIcon } from '../../assets/svg/ms-teams.svg';
import { ReactComponent as SlackIcon } from '../../assets/svg/slack.svg';
import { ReactComponent as WebhookIcon } from '../../assets/svg/webhook.svg';
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
      return i18next.t('label.test-entity', {
        entity: i18next.t('label.result-plural'),
      });
    case 'matchUpdatedBy':
      return i18next.t('label.updated-by');
    case 'matchAnyFieldChange':
      return i18next.t('label.field-change');
    case 'matchIngestionPipelineState':
      return i18next.t('label.pipeline-state');
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
    <div className="bg-grey p-sm rounded-4 min-h-24">
      <Typography.Text>{heading}</Typography.Text>
      <br />
      <Typography.Text className="text-xs text-grey-muted">
        {subHeading}
      </Typography.Text>
    </div>
  );
};

export const getDisplayNameForTriggerType = (type: AlertTriggerType) => {
  switch (type) {
    case AlertTriggerType.AllDataAssets:
      return i18next.t('label.all-data-asset-plural');
    case AlertTriggerType.SpecificDataAsset:
      return i18next.t('label.specific-data-asset-plural');
  }
};

/**
 *
 * @param name Field name used to identify which field has error
 * @param minLengthRequired how many item should be there in the list
 * @returns If validation failed throws an error else resolve
 */
export const listLengthValidator =
  <T,>(name: string, minLengthRequired = 1) =>
  async (_: RuleObject, list: T[]) => {
    if (!list || list.length < minLengthRequired) {
      return Promise.reject(
        new Error(
          i18next.t('message.length-validator-error', {
            length: minLengthRequired,
            field: name,
          })
        )
      );
    }

    return Promise.resolve();
  };

export const getAlertActionTypeDisplayName = (
  alertActionType: AlertActionType
) => {
  switch (alertActionType) {
    case AlertActionType.ActivityFeed:
      return i18next.t('label.activity-feed-plural');
    case AlertActionType.Email:
      return i18next.t('label.email');
    case AlertActionType.GenericWebhook:
      return i18next.t('label.webhook');
    case AlertActionType.SlackWebhook:
      return i18next.t('label.slack');
    case AlertActionType.MSTeamsWebhook:
      return i18next.t('label.ms-team-plural');
    case AlertActionType.GChatWebhook:
      return i18next.t('label.g-chat');
  }
};

export const getDisplayNameForEntities = (entity: string) => {
  switch (entity) {
    case 'kpi':
      return i18next.t('label.kpi-uppercase');
    case 'mlmodel':
      return i18next.t('label.ml-model');
    default:
      return startCase(entity);
  }
};

export const EDIT_LINK_PATH = `/settings/notifications/edit-alert`;
