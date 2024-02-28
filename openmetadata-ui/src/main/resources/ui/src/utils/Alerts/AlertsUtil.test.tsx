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
import React from 'react';
import { ReactComponent as AllActivityIcon } from '../../assets/svg/all-activity.svg';
import { ReactComponent as MailIcon } from '../../assets/svg/ic-mail.svg';
import { ReactComponent as MSTeamsIcon } from '../../assets/svg/ms-teams.svg';
import { ReactComponent as SlackIcon } from '../../assets/svg/slack.svg';
import { ReactComponent as WebhookIcon } from '../../assets/svg/webhook.svg';
import { DESTINATION_DROPDOWN_TABS } from '../../constants/Alerts.constants';
import {
  SubscriptionCategory,
  SubscriptionType,
} from '../../generated/events/eventSubscription';
import {
  mockExternalDestinationOptions,
  mockNonTaskInternalDestinationOptions,
  mockTaskInternalDestinationOptions,
} from '../../mocks/AlertUtil.mock';
import {
  getAlertActionTypeDisplayName,
  getAlertsActionTypeIcon,
  getDisplayNameForEntities,
  getFilteredDestinationOptions,
  getFunctionDisplayName,
  listLengthValidator,
} from './AlertsUtil';

describe('AlertsUtil tests', () => {
  it('getFunctionDisplayName should return correct text for matchAnyEntityFqn', () => {
    expect(getFunctionDisplayName('matchAnyEntityFqn')).toBe(
      'label.fqn-uppercase'
    );
  });

  it('getFunctionDisplayName should return correct text for matchAnyOwnerName', () => {
    expect(getFunctionDisplayName('matchAnyOwnerName')).toBe('label.owner');
  });

  it('getFunctionDisplayName should return correct text for matchAnyEventType', () => {
    expect(getFunctionDisplayName('matchAnyEventType')).toBe(
      'label.event-type'
    );
  });

  it('getFunctionDisplayName should return correct text for matchTestResult', () => {
    expect(getFunctionDisplayName('matchTestResult')).toBe('label.test-entity');
  });

  it('getFunctionDisplayName should return correct text for matchUpdatedBy', () => {
    expect(getFunctionDisplayName('matchUpdatedBy')).toBe('label.updated-by');
  });

  it('getFunctionDisplayName should return correct text for matchAnySource', () => {
    expect(getFunctionDisplayName('matchAnySource')).toBe('label.source-match');
  });

  it('getFunctionDisplayName should return correct text for matchAnyEntityId', () => {
    expect(getFunctionDisplayName('matchAnyEntityId')).toBe(
      'label.entity-id-match'
    );
  });

  it('getAlertsActionTypeIcon should return correct icon for Slack', () => {
    const icon = getAlertsActionTypeIcon(SubscriptionType.Slack);

    expect(icon).toStrictEqual(<SlackIcon height={16} width={16} />);
  });

  it('getAlertsActionTypeIcon should return correct icon for Email', () => {
    const icon = getAlertsActionTypeIcon(SubscriptionType.Email);

    expect(icon).toStrictEqual(<MailIcon height={16} width={16} />);
  });

  it('getAlertsActionTypeIcon should return correct icon for MSTeam', () => {
    const icon = getAlertsActionTypeIcon(SubscriptionType.MSTeams);

    expect(icon).toStrictEqual(<MSTeamsIcon height={16} width={16} />);
  });

  it('getAlertsActionTypeIcon should return correct icon for ActivityFeed', () => {
    const icon = getAlertsActionTypeIcon(SubscriptionType.ActivityFeed);

    expect(icon).toStrictEqual(<AllActivityIcon height={16} width={16} />);
  });

  it('getAlertsActionTypeIcon should return correct icon for generic', () => {
    const icon = getAlertsActionTypeIcon(SubscriptionType.Generic);

    expect(icon).toStrictEqual(<WebhookIcon height={16} width={16} />);
  });

  it('listLengthValidator should return error function', async () => {
    const error = listLengthValidator('name', 64);

    expect(typeof error).toBe('function');
  });

  it('getAlertActionTypeDisplayName should return correct text for Slack', () => {
    expect(getAlertActionTypeDisplayName(SubscriptionType.Slack)).toBe(
      'label.slack'
    );
  });

  it('getAlertActionTypeDisplayName should return correct text for Email', () => {
    expect(getAlertActionTypeDisplayName(SubscriptionType.Email)).toBe(
      'label.email'
    );
  });

  it('getAlertActionTypeDisplayName should return correct text for MSTeam', () => {
    expect(getAlertActionTypeDisplayName(SubscriptionType.MSTeams)).toBe(
      'label.ms-team-plural'
    );
  });

  it('getAlertActionTypeDisplayName should return correct text for ActivityFeed', () => {
    expect(getAlertActionTypeDisplayName(SubscriptionType.ActivityFeed)).toBe(
      'label.activity-feed-plural'
    );
  });

  it('getAlertActionTypeDisplayName should return correct text for generic', () => {
    expect(getAlertActionTypeDisplayName(SubscriptionType.Generic)).toBe(
      'label.webhook'
    );
  });

  it('getAlertActionTypeDisplayName should return correct text for GChat', () => {
    expect(getAlertActionTypeDisplayName(SubscriptionType.GChat)).toBe(
      'label.g-chat'
    );
  });

  it('getDisplayNameForEntities should return correct text', () => {
    expect(getDisplayNameForEntities('kpi')).toBe('label.kpi-uppercase');
    expect(getDisplayNameForEntities('mlmodel')).toBe('label.ml-model');

    expect(getDisplayNameForEntities('unknown')).toBe('Unknown');
  });

  it('getFilteredDestinationOptions should return all options for external tab key', () => {
    const resultTask = getFilteredDestinationOptions(
      DESTINATION_DROPDOWN_TABS.external,
      'task'
    );

    const resultTable = getFilteredDestinationOptions(
      DESTINATION_DROPDOWN_TABS.external,
      'table'
    );

    [resultTask, resultTable].forEach((results) => {
      expect(results).toHaveLength(5);

      results.map((result) =>
        expect(
          mockExternalDestinationOptions.includes(
            result.value as SubscriptionType
          )
        ).toBeTruthy()
      );
    });
  });

  it('getFilteredDestinationOptions should return correct internal options for "task" source', () => {
    const resultTask = getFilteredDestinationOptions(
      DESTINATION_DROPDOWN_TABS.internal,
      'task'
    );

    expect(resultTask).toHaveLength(2);

    resultTask.map((result) =>
      expect(
        mockTaskInternalDestinationOptions.includes(
          result.value as SubscriptionCategory
        )
      ).toBeTruthy()
    );
  });

  it('getFilteredDestinationOptions should return correct internal options for non "task" source', () => {
    const resultContainer = getFilteredDestinationOptions(
      DESTINATION_DROPDOWN_TABS.internal,
      'container'
    );
    const resultTestSuite = getFilteredDestinationOptions(
      DESTINATION_DROPDOWN_TABS.internal,
      'testSuite'
    );

    [resultContainer, resultTestSuite].forEach((results) => {
      expect(results).toHaveLength(5);

      results.map((result) =>
        expect(
          mockNonTaskInternalDestinationOptions.includes(
            result.value as SubscriptionCategory
          )
        ).toBeTruthy()
      );
    });
  });
});
