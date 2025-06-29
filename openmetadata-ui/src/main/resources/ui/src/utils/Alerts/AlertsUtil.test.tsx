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
import { fireEvent, render, screen } from '@testing-library/react';
import { ReactComponent as AlertIcon } from '../../assets/svg/alert.svg';
import { ReactComponent as AllActivityIcon } from '../../assets/svg/all-activity.svg';
import { ReactComponent as ClockIcon } from '../../assets/svg/clock.svg';
import { ReactComponent as CheckIcon } from '../../assets/svg/ic-check.svg';
import { ReactComponent as MailIcon } from '../../assets/svg/ic-mail.svg';
import { ReactComponent as MSTeamsIcon } from '../../assets/svg/ms-teams.svg';
import { ReactComponent as SlackIcon } from '../../assets/svg/slack.svg';
import { ReactComponent as WebhookIcon } from '../../assets/svg/webhook.svg';
import { AlertEventDetailsToDisplay } from '../../components/Alerts/AlertDetails/AlertRecentEventsTab/AlertRecentEventsTab.interface';
import { DESTINATION_DROPDOWN_TABS } from '../../constants/Alerts.constants';
import { AlertRecentEventFilters } from '../../enums/Alerts.enum';
import { EventType, Status } from '../../generated/events/api/typedEvent';
import {
  SubscriptionCategory,
  SubscriptionType,
} from '../../generated/events/eventSubscription';
import {
  mockExternalDestinationOptions,
  mockNonTaskInternalDestinationOptions,
  mockTaskInternalDestinationOptions,
  mockTypedEvent1,
  mockTypedEvent2,
  mockTypedEvent3,
  mockTypedEvent4,
} from '../../mocks/AlertUtil.mock';
import { searchData } from '../../rest/miscAPI';
import {
  getAlertActionTypeDisplayName,
  getAlertEventsFilterLabels,
  getAlertExtraInfo,
  getAlertRecentEventsFilterOptions,
  getAlertsActionTypeIcon,
  getAlertStatusIcon,
  getChangeEventDataFromTypedEvent,
  getConnectionTimeoutField,
  getDestinationConfigField,
  getDisplayNameForEntities,
  getFieldByArgumentType,
  getFilteredDestinationOptions,
  getFunctionDisplayName,
  getLabelsForEventDetails,
  listLengthValidator,
} from './AlertsUtil';

jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  Skeleton: {
    Button: jest.fn().mockImplementation(() => <div>Skeleton.Button</div>),
  },
}));

jest.mock('../../components/common/AsyncSelect/AsyncSelect', () => ({
  AsyncSelect: jest
    .fn()
    .mockImplementation(({ api }: { api: () => void }) => (
      <button onClick={() => api()}>AsyncSelect</button>
    )),
}));

jest.mock('../../rest/miscAPI', () => ({
  searchData: jest.fn(),
}));

describe('AlertsUtil tests', () => {
  it('getFunctionDisplayName should return correct text for matchAnyEntityFqn', () => {
    expect(getFunctionDisplayName('matchAnyEntityFqn')).toBe(
      'label.fqn-uppercase'
    );
  });

  it('getFunctionDisplayName should return correct text for matchAnyOwnerName', () => {
    expect(getFunctionDisplayName('matchAnyOwnerName')).toBe(
      'label.owner-plural'
    );
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
    const icon = getAlertsActionTypeIcon(SubscriptionType.Webhook);

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
    expect(getAlertActionTypeDisplayName(SubscriptionType.Webhook)).toBe(
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

      results.forEach((result) =>
        expect(
          mockExternalDestinationOptions.includes(
            result.value as Exclude<
              SubscriptionType,
              SubscriptionType.ActivityFeed
            >
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
            result.value as Exclude<
              SubscriptionCategory,
              SubscriptionCategory.External | SubscriptionCategory.Assignees
            >
          )
        ).toBeTruthy()
      );
    });
  });
});

describe('getFieldByArgumentType tests', () => {
  it('should return correct fields for argumentType fqnList', async () => {
    const field = getFieldByArgumentType(0, 'fqnList', 0, 'table');

    render(field);

    const selectDiv = screen.getByText('AsyncSelect');

    fireEvent.click(selectDiv);

    expect(searchData).toHaveBeenCalledWith(
      undefined,
      1,
      50,
      '',
      '',
      '',
      'table_search_index'
    );
  });

  it('should return correct fields for argumentType domainList', async () => {
    const field = getFieldByArgumentType(0, 'domainList', 0, 'container');

    render(field);

    const selectDiv = screen.getByText('AsyncSelect');

    fireEvent.click(selectDiv);

    expect(searchData).toHaveBeenCalledWith(
      undefined,
      1,
      50,
      '',
      '',
      '',
      'domain_search_index'
    );
  });

  it('should return correct fields for argumentType tableNameList', async () => {
    const field = getFieldByArgumentType(
      0,
      'tableNameList',
      0,
      'selectedTrigger'
    );

    render(field);

    const selectDiv = screen.getByText('AsyncSelect');

    fireEvent.click(selectDiv);

    expect(searchData).toHaveBeenCalledWith(
      undefined,
      1,
      50,
      '',
      '',
      '',
      'table_search_index'
    );
  });

  it('should return correct fields for argumentType ownerNameList', async () => {
    const field = getFieldByArgumentType(
      0,
      'ownerNameList',
      0,
      'selectedTrigger'
    );

    render(field);

    const selectDiv = screen.getByText('AsyncSelect');

    fireEvent.click(selectDiv);

    expect(searchData).toHaveBeenCalledWith(
      undefined,
      1,
      50,
      'isBot:false',
      '',
      '',
      ['team_search_index', 'user_search_index']
    );
  });

  it('should return correct fields for argumentType updateByUserList', async () => {
    const field = getFieldByArgumentType(
      0,
      'updateByUserList',
      0,
      'selectedTrigger'
    );

    render(field);

    const selectDiv = screen.getByText('AsyncSelect');

    fireEvent.click(selectDiv);

    expect(searchData).toHaveBeenCalledWith(
      undefined,
      1,
      50,
      '',
      '',
      '',
      'user_search_index'
    );
  });

  it('should return correct fields for argumentType userList', async () => {
    const field = getFieldByArgumentType(0, 'userList', 0, 'selectedTrigger');

    render(field);

    const selectDiv = screen.getByText('AsyncSelect');

    fireEvent.click(selectDiv);

    expect(searchData).toHaveBeenCalledWith(
      undefined,
      1,
      50,
      'isBot:false',
      '',
      '',
      'user_search_index'
    );
  });

  it('should return correct fields for argumentType eventTypeList', async () => {
    const field = getFieldByArgumentType(
      0,
      'eventTypeList',
      0,
      'selectedTrigger'
    );

    render(field);

    const selectDiv = screen.getByTestId('event-type-select');

    expect(selectDiv).toBeInTheDocument();
  });

  it('should return correct fields for argumentType entityIdList', () => {
    const field = getFieldByArgumentType(
      0,
      'entityIdList',
      0,
      'selectedTrigger'
    );

    render(field);

    const selectDiv = screen.getByTestId('entity-id-select');

    expect(selectDiv).toBeInTheDocument();
  });

  it('should return correct fields for argumentType pipelineStateList', () => {
    const field = getFieldByArgumentType(
      0,
      'pipelineStateList',
      0,
      'selectedTrigger'
    );

    render(field);

    const selectDiv = screen.getByTestId('pipeline-status-select');

    expect(selectDiv).toBeInTheDocument();
  });

  it('should return correct fields for argumentType ingestionPipelineStateList', () => {
    const field = getFieldByArgumentType(
      0,
      'ingestionPipelineStateList',
      0,
      'selectedTrigger'
    );

    render(field);

    const selectDiv = screen.getByTestId('pipeline-status-select');

    expect(selectDiv).toBeInTheDocument();
  });

  it('should return correct fields for argumentType testStatusList', () => {
    const field = getFieldByArgumentType(
      0,
      'testStatusList',
      0,
      'selectedTrigger'
    );

    render(field);

    const selectDiv = screen.getByTestId('test-status-select');

    expect(selectDiv).toBeInTheDocument();
  });

  it('should return correct fields for argumentType testResultList', () => {
    const field = getFieldByArgumentType(
      0,
      'testResultList',
      0,
      'selectedTrigger'
    );

    render(field);

    const selectDiv = screen.getByTestId('test-result-select');

    expect(selectDiv).toBeInTheDocument();
  });

  it('should return correct fields for argumentType testSuiteList', async () => {
    const field = getFieldByArgumentType(
      0,
      'testSuiteList',
      0,
      'selectedTrigger'
    );

    render(field);

    const selectDiv = screen.getByText('AsyncSelect');

    fireEvent.click(selectDiv);

    expect(searchData).toHaveBeenCalledWith(
      undefined,
      1,
      50,
      '',
      '',
      '',
      'test_suite_search_index'
    );
  });

  it('should not return select component for random argumentType', () => {
    const field = getFieldByArgumentType(0, 'unknown', 0, 'selectedTrigger');

    render(field);

    const selectDiv = screen.queryByText('AsyncSelect');

    expect(selectDiv).toBeNull();
  });

  it('getDestinationConfigField should return advanced configurations for webhook type', async () => {
    const field = getDestinationConfigField(SubscriptionType.Webhook, 4) ?? (
      <></>
    );

    render(field);

    const secretKeyInput = screen.getByText('label.advanced-configuration');

    expect(secretKeyInput).toBeInTheDocument();

    fireEvent.click(secretKeyInput);

    expect(await screen.findByTestId('secret-key')).toBeInTheDocument();
    expect(
      await screen.findByTestId('webhook-4-headers-list')
    ).toBeInTheDocument();
    expect(await screen.findByTestId('http-method-4')).toBeInTheDocument();
  });

  it('getDestinationConfigField should not return advanced configurations for other type', () => {
    const field = getDestinationConfigField(SubscriptionType.Email, 4) ?? <></>;

    render(field);

    const secretKeyInput = screen.queryByText('label.advanced-configuration');

    expect(secretKeyInput).toBeNull();
  });

  it('getConnectionTimeoutField should return the connection timeout field', () => {
    const field = getConnectionTimeoutField();

    render(field);

    expect(screen.getByTestId('connection-timeout')).toBeInTheDocument();

    const input = screen.getByTestId('connection-timeout-input');

    expect(input).toHaveValue(10);
  });
});

describe('getAlertEventsFilterLabels', () => {
  it('should return correct filter labels', () => {
    const allLabel = getAlertEventsFilterLabels(AlertRecentEventFilters.ALL);
    const successLabel = getAlertEventsFilterLabels(
      AlertRecentEventFilters.SUCCESSFUL
    );
    const failedLabel = getAlertEventsFilterLabels(
      AlertRecentEventFilters.FAILED
    );

    expect(allLabel).toStrictEqual('label.all');
    expect(successLabel).toStrictEqual('label.successful');
    expect(failedLabel).toStrictEqual('label.failed');
  });

  it('should return empty string for unknown filter', () => {
    const unknownLabel = getAlertEventsFilterLabels(
      'unknown' as AlertRecentEventFilters
    );

    expect(unknownLabel).toStrictEqual('');
  });
});

describe('getAlertRecentEventsFilterOptions', () => {
  it('should return correct options', () => {
    const options = getAlertRecentEventsFilterOptions();

    expect(options).toHaveLength(3);
    expect(options[0]?.key).toStrictEqual(AlertRecentEventFilters.ALL);
    expect(options[1]?.key).toStrictEqual(AlertRecentEventFilters.SUCCESSFUL);
    expect(options[2]?.key).toStrictEqual(AlertRecentEventFilters.FAILED);
  });
});

describe('getAlertStatusIcon', () => {
  it('should return correct icon for Successful status', () => {
    const icon = getAlertStatusIcon(Status.Successful);

    expect(icon).toStrictEqual(
      <CheckIcon className="status-icon successful-icon" />
    );
  });

  it('should return correct icon for Failed status', () => {
    const icon = getAlertStatusIcon(Status.Failed);

    expect(icon).toStrictEqual(
      <AlertIcon className="status-icon failed-icon" />
    );
  });

  it('should return correct icon for Unprocessed status', () => {
    const icon = getAlertStatusIcon(Status.Unprocessed);

    expect(icon).toStrictEqual(
      <ClockIcon className="status-icon unprocessed-icon" />
    );
  });

  it('should return null for unknown status', () => {
    const icon = getAlertStatusIcon('unknown' as Status);

    expect(icon).toBeNull();
  });
});

describe('getLabelsForEventDetails', () => {
  it('should return correct label for eventType', () => {
    const label = getLabelsForEventDetails('eventType');

    expect(label).toBe('label.event-type');
  });

  it('should return correct label for entityId', () => {
    const label = getLabelsForEventDetails('entityId');

    expect(label).toBe('label.entity-id');
  });

  it('should return correct label for userName', () => {
    const label = getLabelsForEventDetails('userName');

    expect(label).toBe('label.user-name');
  });

  it('should return correct label for previousVersion', () => {
    const label = getLabelsForEventDetails('previousVersion');

    expect(label).toBe('label.previous-version');
  });

  it('should return correct label for currentVersion', () => {
    const label = getLabelsForEventDetails('currentVersion');

    expect(label).toBe('label.current-version');
  });

  it('should return empty string for unknown prop', () => {
    const label = getLabelsForEventDetails(
      'unknown' as keyof AlertEventDetailsToDisplay
    );

    expect(label).toBe('');
  });
});

describe('getChangeEventDataFromTypedEvent', () => {
  it('should return correct change event data for successful event', () => {
    const { changeEventData, changeEventDataToDisplay } =
      getChangeEventDataFromTypedEvent(mockTypedEvent1);

    expect(changeEventData).toStrictEqual(mockTypedEvent1.data[0]);
    expect(changeEventDataToDisplay).toStrictEqual({
      eventType: EventType.EntityCreated,
      entityId: 'entityId1',
      userName: 'user1',
      previousVersion: 0.1,
      currentVersion: 0.2,
      reason: undefined,
      source: undefined,
      failingSubscriptionId: undefined,
    });
  });

  it('should return correct change event data for failed event', () => {
    const { changeEventData, changeEventDataToDisplay } =
      getChangeEventDataFromTypedEvent(mockTypedEvent2);

    expect(changeEventData).toStrictEqual(mockTypedEvent2.data[0].changeEvent);
    expect(changeEventDataToDisplay).toStrictEqual({
      eventType: EventType.EntityUpdated,
      entityId: 'entityId2',
      userName: 'user2',
      previousVersion: 0.2,
      currentVersion: 0.3,
      reason: 'Some reason',
      source: 'Some source',
      failingSubscriptionId: 'subscriptionId1',
    });
  });

  it('should return correct change event data for unprocessed event', () => {
    const { changeEventData, changeEventDataToDisplay } =
      getChangeEventDataFromTypedEvent(mockTypedEvent3);

    expect(changeEventData).toStrictEqual(mockTypedEvent3.data[0]);
    expect(changeEventDataToDisplay).toStrictEqual({
      eventType: EventType.EntityDeleted,
      entityId: 'entityId3',
      userName: 'user3',
      previousVersion: 0.3,
      currentVersion: 0.4,
      reason: undefined,
      source: undefined,
      failingSubscriptionId: undefined,
    });
  });

  it('should return correct change event data for unknown status', () => {
    const { changeEventData, changeEventDataToDisplay } =
      getChangeEventDataFromTypedEvent(mockTypedEvent4);

    expect(changeEventData).toStrictEqual(mockTypedEvent4.data[0]);
    expect(changeEventDataToDisplay).toStrictEqual({
      eventType: EventType.EntityCreated,
      entityId: 'entityId4',
      userName: 'user4',
      previousVersion: 0.4,
      currentVersion: 0.5,
      reason: undefined,
      source: undefined,
      failingSubscriptionId: undefined,
    });
  });
});

describe('getAlertExtraInfo', () => {
  it('should return skeletons when alertEventCountsLoading is true', () => {
    const alertExtraInfo = getAlertExtraInfo(true);

    render(alertExtraInfo);

    const skeletons = screen.getAllByText('Skeleton.Button');

    expect(skeletons).toHaveLength(3);
  });

  it('should return correct extra info when alertEventCountsLoading is false', () => {
    const alertEventCounts = {
      totalEventsCount: 100,
      pendingEventsCount: 5,
      failedEventsCount: 2,
    };

    const alertExtraInfo = getAlertExtraInfo(false, alertEventCounts);

    render(alertExtraInfo);

    const totalEvents = screen.getByText('100');
    const pendingEvents = screen.getByText('5');
    const failedEvents = screen.getByText('2');

    expect(totalEvents).toBeInTheDocument();
    expect(pendingEvents).toBeInTheDocument();
    expect(failedEvents).toBeInTheDocument();
  });

  it('should return zero values when alertEventCounts is undefined', () => {
    const alertExtraInfo = getAlertExtraInfo(false);

    render(alertExtraInfo);

    const eventCounts = screen.getAllByText('0');

    expect(eventCounts).toHaveLength(3);
  });
});
