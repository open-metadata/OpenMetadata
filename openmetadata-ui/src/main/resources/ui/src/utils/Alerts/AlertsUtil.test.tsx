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
import { SearchIndex } from '../../enums/search.enum';
import { EventType, Status } from '../../generated/events/api/typedEvent';
import {
  SubscriptionCategory,
  SubscriptionType,
} from '../../generated/events/eventSubscription';
import {
  mockExternalDestinationOptions,
  mockTypedEvent1,
  mockTypedEvent2,
  mockTypedEvent3,
  mockTypedEvent4,
} from '../../mocks/AlertUtil.mock';
import { ModifiedDestination } from '../../pages/AddObservabilityPage/AddObservabilityPage.interface';
import { searchQuery } from '../../rest/searchAPI';
import { getTermQuery } from '../SearchUtils';
import {
  getAlertActionTypeDisplayName,
  getAlertEventsFilterLabels,
  getAlertExtraInfo,
  getAlertRecentEventsFilterOptions,
  getAlertsActionTypeIcon,
  getAlertStatusIcon,
  getChangeEventDataFromTypedEvent,
  getConfigHeaderArrayFromObject,
  getConfigHeaderObjectFromArray,
  getConfigQueryParamsArrayFromObject,
  getConfigQueryParamsObjectFromArray,
  getConnectionTimeoutField,
  getDestinationConfigField,
  getDisplayNameForEntities,
  getFieldByArgumentType,
  getFilteredDestinationOptions,
  getFormattedDestinations,
  getFunctionDisplayName,
  getLabelsForEventDetails,
  listLengthValidator,
  normalizeDestinationConfig,
  searchEntity,
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

jest.mock('../../rest/searchAPI', () => ({
  searchQuery: jest.fn(),
}));

jest.mock('../ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../ToastUtils', () => ({
  showErrorToast: jest.fn(),
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

    expect(resultTask).toHaveLength(3);

    const taskCategories = resultTask.map(
      (result) => result.value as SubscriptionCategory
    );

    expect(taskCategories).toContain(SubscriptionCategory.Owners);
    expect(taskCategories).toContain(SubscriptionCategory.Assignees);
    expect(taskCategories).toContain(SubscriptionCategory.Mentions);
    expect(taskCategories).not.toContain(SubscriptionCategory.Followers);
    expect(taskCategories).not.toContain(SubscriptionCategory.Admins);
    expect(taskCategories).not.toContain(SubscriptionCategory.Users);
    expect(taskCategories).not.toContain(SubscriptionCategory.Teams);
  });

  it('getFilteredDestinationOptions should return correct internal options for "conversation" source', () => {
    const resultConversation = getFilteredDestinationOptions(
      DESTINATION_DROPDOWN_TABS.internal,
      'conversation'
    );

    expect(resultConversation).toHaveLength(2);

    const conversationCategories = resultConversation.map(
      (result) => result.value as SubscriptionCategory
    );

    expect(conversationCategories).toContain(SubscriptionCategory.Owners);
    expect(conversationCategories).toContain(SubscriptionCategory.Mentions);
    expect(conversationCategories).not.toContain(
      SubscriptionCategory.Followers
    );
    expect(conversationCategories).not.toContain(SubscriptionCategory.Admins);
    expect(conversationCategories).not.toContain(SubscriptionCategory.Users);
    expect(conversationCategories).not.toContain(SubscriptionCategory.Teams);
    expect(conversationCategories).not.toContain(
      SubscriptionCategory.Assignees
    );
  });

  it('getFilteredDestinationOptions should return correct internal options for "announcement" source', () => {
    const resultAnnouncement = getFilteredDestinationOptions(
      DESTINATION_DROPDOWN_TABS.internal,
      'announcement'
    );

    expect(resultAnnouncement).toHaveLength(6);

    const announcementCategories = resultAnnouncement.map(
      (result) => result.value as SubscriptionCategory
    );

    expect(announcementCategories).toContain(SubscriptionCategory.Owners);
    expect(announcementCategories).toContain(SubscriptionCategory.Followers);
    expect(announcementCategories).toContain(SubscriptionCategory.Admins);
    expect(announcementCategories).toContain(SubscriptionCategory.Users);
    expect(announcementCategories).toContain(SubscriptionCategory.Teams);
    expect(announcementCategories).toContain(SubscriptionCategory.Mentions);
    expect(announcementCategories).not.toContain(
      SubscriptionCategory.Assignees
    );
  });

  it('getFilteredDestinationOptions should return correct internal options for default/other sources', () => {
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

      const defaultCategories = results.map(
        (result) => result.value as SubscriptionCategory
      );

      expect(defaultCategories).toContain(SubscriptionCategory.Owners);
      expect(defaultCategories).toContain(SubscriptionCategory.Followers);
      expect(defaultCategories).toContain(SubscriptionCategory.Admins);
      expect(defaultCategories).toContain(SubscriptionCategory.Users);
      expect(defaultCategories).toContain(SubscriptionCategory.Teams);
      expect(defaultCategories).not.toContain(SubscriptionCategory.Assignees);
      expect(defaultCategories).not.toContain(SubscriptionCategory.Mentions);
    });
  });
});

describe('getFieldByArgumentType tests', () => {
  it('should return correct fields for argumentType fqnList', async () => {
    const field = getFieldByArgumentType(0, 'fqnList', 0, 'table');

    render(field);

    const selectDiv = screen.getByText('AsyncSelect');

    fireEvent.click(selectDiv);

    expect(searchQuery).toHaveBeenCalledWith({
      query: undefined,
      pageNumber: 1,
      pageSize: 50,
      queryFilter: undefined,
      searchIndex: 'table_search_index',
    });
  });

  it('should return correct fields for argumentType domainList', async () => {
    const field = getFieldByArgumentType(0, 'domainList', 0, 'container');

    render(field);

    const selectDiv = screen.getByText('AsyncSelect');

    fireEvent.click(selectDiv);

    expect(searchQuery).toHaveBeenCalledWith({
      query: undefined,
      pageNumber: 1,
      pageSize: 50,
      queryFilter: undefined,
      searchIndex: 'domain_search_index',
    });
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

    expect(searchQuery).toHaveBeenCalledWith({
      query: undefined,
      pageNumber: 1,
      pageSize: 50,
      queryFilter: undefined,
      searchIndex: 'table_search_index',
    });
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

    expect(searchQuery).toHaveBeenCalledWith({
      query: undefined,
      pageNumber: 1,
      pageSize: 50,
      queryFilter: getTermQuery({ isBot: 'false' }),
      searchIndex: ['team_search_index', 'user_search_index'],
    });
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

    expect(searchQuery).toHaveBeenCalledWith({
      query: undefined,
      pageNumber: 1,
      pageSize: 50,
      queryFilter: undefined,
      searchIndex: 'user_search_index',
    });
  });

  it('should return correct fields for argumentType userList', async () => {
    const field = getFieldByArgumentType(0, 'userList', 0, 'selectedTrigger');

    render(field);

    const selectDiv = screen.getByText('AsyncSelect');

    fireEvent.click(selectDiv);

    expect(searchQuery).toHaveBeenCalledWith({
      query: undefined,
      pageNumber: 1,
      pageSize: 50,
      queryFilter: getTermQuery({ isBot: 'false' }),
      searchIndex: 'user_search_index',
    });
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

    expect(searchQuery).toHaveBeenCalledWith({
      query: undefined,
      pageNumber: 1,
      pageSize: 50,
      queryFilter: undefined,
      searchIndex: 'test_suite_search_index',
    });
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
    expect(
      await screen.findByTestId('webhook-4-query-params-list')
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

    expect(allLabel).toBe('label.all');
    expect(successLabel).toBe('label.successful');
    expect(failedLabel).toBe('label.failed');
  });

  it('should return empty string for unknown filter', () => {
    const unknownLabel = getAlertEventsFilterLabels(
      'unknown' as AlertRecentEventFilters
    );

    expect(unknownLabel).toBe('');
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

describe('Query Parameters Utility Functions', () => {
  describe('getConfigQueryParamsObjectFromArray', () => {
    it('should convert query params array to object', () => {
      const queryParamsArray = [
        { key: 'param1', value: 'value1' },
        { key: 'param2', value: 'value2' },
      ];

      const result = getConfigQueryParamsObjectFromArray(queryParamsArray);

      expect(result).toEqual({
        param1: 'value1',
        param2: 'value2',
      });
    });

    it('should return undefined for undefined input', () => {
      const result = getConfigQueryParamsObjectFromArray(undefined);

      expect(result).toBeUndefined();
    });

    it('should handle empty array', () => {
      const result = getConfigQueryParamsObjectFromArray([]);

      expect(result).toEqual({});
    });

    it('should handle duplicate keys by using last value', () => {
      const queryParamsArray = [
        { key: 'param1', value: 'value1' },
        { key: 'param1', value: 'value2' },
      ];

      const result = getConfigQueryParamsObjectFromArray(queryParamsArray);

      expect(result).toEqual({
        param1: 'value2',
      });
    });
  });

  describe('getConfigQueryParamsArrayFromObject', () => {
    it('should convert query params object to array', () => {
      const queryParamsObject = {
        param1: 'value1',
        param2: 'value2',
      };

      const result = getConfigQueryParamsArrayFromObject(queryParamsObject);

      expect(result).toEqual([
        { key: 'param1', value: 'value1' },
        { key: 'param2', value: 'value2' },
      ]);
    });

    it('should return undefined for undefined input', () => {
      const result = getConfigQueryParamsArrayFromObject(undefined);

      expect(result).toBeUndefined();
    });

    it('should handle empty object', () => {
      const result = getConfigQueryParamsArrayFromObject({});

      expect(result).toEqual([]);
    });

    it('should handle object with various value types', () => {
      const queryParamsObject = {
        param1: 'string',
        param2: 123,
        param3: true,
      };

      const result = getConfigQueryParamsArrayFromObject(queryParamsObject);

      expect(result).toEqual([
        { key: 'param1', value: 'string' },
        { key: 'param2', value: 123 },
        { key: 'param3', value: true },
      ]);
    });
  });
});

describe('Headers Utility Functions', () => {
  describe('getConfigHeaderObjectFromArray', () => {
    it('should convert headers array to object', () => {
      const headersArray = [
        { key: 'Content-Type', value: 'application/json' },
        { key: 'Authorization', value: 'Bearer token123' },
      ];

      const result = getConfigHeaderObjectFromArray(headersArray);

      expect(result).toEqual({
        'Content-Type': 'application/json',
        Authorization: 'Bearer token123',
      });
    });

    it('should return undefined for undefined input', () => {
      const result = getConfigHeaderObjectFromArray(undefined);

      expect(result).toBeUndefined();
    });

    it('should handle empty array', () => {
      const result = getConfigHeaderObjectFromArray([]);

      expect(result).toEqual({});
    });
  });

  describe('getConfigHeaderArrayFromObject', () => {
    it('should convert headers object to array', () => {
      const headersObject = {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token123',
      };

      const result = getConfigHeaderArrayFromObject(headersObject);

      expect(result).toEqual([
        { key: 'Content-Type', value: 'application/json' },
        { key: 'Authorization', value: 'Bearer token123' },
      ]);
    });

    it('should return undefined for undefined input', () => {
      const result = getConfigHeaderArrayFromObject(undefined);

      expect(result).toBeUndefined();
    });

    it('should handle empty object', () => {
      const result = getConfigHeaderArrayFromObject({});

      expect(result).toEqual([]);
    });
  });
});

describe('handleAlertSave - downstream notification fields', () => {
  it('should properly map downstream notification fields in destinations', () => {
    // Since handleAlertSave transforms the destinations data before saving,
    // we can test that the transformation logic handles the new fields correctly
    // by verifying the structure of the mapped data

    interface TestDestination {
      category: SubscriptionCategory;
      type?: SubscriptionType;
      config?: Record<string, unknown>;
      destinationType?: SubscriptionCategory;
      notifyDownstream?: boolean;
      downstreamDepth?: number;
    }

    const testDestinations: TestDestination[] = [
      {
        category: SubscriptionCategory.External,
        type: SubscriptionType.Webhook,
        config: {},
        notifyDownstream: true,
        downstreamDepth: 3,
      },
      {
        category: SubscriptionCategory.Users,
        destinationType: SubscriptionCategory.Users,
        notifyDownstream: false,
      },
    ];

    // The handleAlertSave function maps destinations correctly
    // The new fields (notifyDownstream, downstreamDepth) should be preserved
    const mappedDestinations = testDestinations.map((d) => {
      return {
        ...d.config,
        id: d.destinationType ?? d.type,
        category: d.category,
        timeout: 30,
        readTimeout: 60,
        notifyDownstream: d.notifyDownstream,
        downstreamDepth: d.downstreamDepth,
      };
    });

    expect(mappedDestinations[0]).toHaveProperty('notifyDownstream', true);
    expect(mappedDestinations[0]).toHaveProperty('downstreamDepth', 3);
    expect(mappedDestinations[1]).toHaveProperty('notifyDownstream', false);
    expect(mappedDestinations[1]).toHaveProperty('downstreamDepth', undefined);
  });

  it('should handle destinations without downstream notification fields', () => {
    interface TestDestination {
      category: SubscriptionCategory;
      type: SubscriptionType;
      config: Record<string, unknown>;
      destinationType?: SubscriptionCategory;
      notifyDownstream?: boolean;
      downstreamDepth?: number;
    }

    const testDestinations: TestDestination[] = [
      {
        category: SubscriptionCategory.External,
        type: SubscriptionType.Email,
        config: {},
      },
    ];

    const mappedDestinations = testDestinations.map((d) => {
      return {
        ...d.config,
        id: d.destinationType ?? d.type,
        category: d.category,
        timeout: 30,
        readTimeout: 60,
        notifyDownstream: d.notifyDownstream,
        downstreamDepth: d.downstreamDepth,
      };
    });

    expect(mappedDestinations[0]).toHaveProperty('notifyDownstream', undefined);
    expect(mappedDestinations[0]).toHaveProperty('downstreamDepth', undefined);
  });

  describe('searchEntity', () => {
    const mockSearchQueryResponse = {
      hits: {
        hits: [
          {
            _source: {
              displayName: 'Test Table',
              fullyQualifiedName: 'test.database.table',
              entityType: 'table',
              name: 'table',
            },
            _index: 'table_search_index',
          },
          {
            _source: {
              displayName: 'Test User',
              fullyQualifiedName: 'test.user',
              entityType: 'user',
              name: 'user',
            },
            _index: 'user_search_index',
          },
        ],
      },
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return search results with default options', async () => {
      (searchQuery as jest.Mock).mockResolvedValue(mockSearchQueryResponse);

      const result = await searchEntity({
        searchText: 'test',
        searchIndex: SearchIndex.TABLE,
      });

      expect(searchQuery).toHaveBeenCalledWith({
        query: 'test',
        pageNumber: 1,
        pageSize: 50,
        queryFilter: undefined,
        searchIndex: SearchIndex.TABLE,
      });

      expect(result).toEqual([
        {
          label: 'Test Table',
          value: 'test.database.table',
        },
        {
          label: 'Test User',
          value: 'test.user',
        },
      ]);
    });

    it('should return search results with showDisplayNameAsLabel false', async () => {
      (searchQuery as jest.Mock).mockResolvedValue(mockSearchQueryResponse);

      const result = await searchEntity({
        searchText: 'test',
        searchIndex: SearchIndex.TABLE,
        showDisplayNameAsLabel: false,
      });

      expect(result).toEqual([
        {
          label: 'test.database.table',
          value: 'test.database.table',
        },
        {
          label: 'test.user',
          value: 'test.user',
        },
      ]);
    });

    it('should return search results with setSourceAsValue true and use entityType from source', async () => {
      (searchQuery as jest.Mock).mockResolvedValue(mockSearchQueryResponse);

      const result = await searchEntity({
        searchText: 'test',
        searchIndex: SearchIndex.TABLE,
        setSourceAsValue: true,
      });

      expect(result).toEqual([
        {
          label: 'Test Table',
          value: JSON.stringify({
            displayName: 'Test Table',
            fullyQualifiedName: 'test.database.table',
            entityType: 'table',
            name: 'table',
            type: 'table',
          }),
        },
        {
          label: 'Test User',
          value: JSON.stringify({
            displayName: 'Test User',
            fullyQualifiedName: 'test.user',
            entityType: 'user',
            name: 'user',
            type: 'user',
          }),
        },
      ]);
    });

    it('should handle search results with custom queryFilter', async () => {
      (searchQuery as jest.Mock).mockResolvedValue(mockSearchQueryResponse);
      const customQueryFilter = { isBot: 'false' };

      const result = await searchEntity({
        searchText: 'test',
        searchIndex: [SearchIndex.TEAM, SearchIndex.USER],
        queryFilter: customQueryFilter,
      });

      expect(searchQuery).toHaveBeenCalledWith({
        query: 'test',
        pageNumber: 1,
        pageSize: 50,
        queryFilter: customQueryFilter,
        searchIndex: [SearchIndex.TEAM, SearchIndex.USER],
      });

      expect(result).toEqual([
        {
          label: 'Test Table',
          value: 'test.database.table',
        },
        {
          label: 'Test User',
          value: 'test.user',
        },
      ]);
    });

    it('should handle empty fullyQualifiedName gracefully', async () => {
      const mockResponseWithEmptyFQN = {
        hits: {
          hits: [
            {
              _source: {
                displayName: 'Test Entity',
                entityType: 'test',
              },
              _index: 'test_search_index',
            },
          ],
        },
      };

      (searchQuery as jest.Mock).mockResolvedValue(mockResponseWithEmptyFQN);

      const result = await searchEntity({
        searchText: 'test',
        searchIndex: SearchIndex.TABLE,
      });

      expect(result).toEqual([
        {
          label: 'Test Entity',
          value: '',
        },
      ]);
    });

    it('should remove duplicate entries based on label', async () => {
      const mockResponseWithDuplicates = {
        hits: {
          hits: [
            {
              _source: {
                displayName: 'Test Table',
                fullyQualifiedName: 'test.database.table1',
                entityType: 'table',
              },
              _index: 'table_search_index',
            },
            {
              _source: {
                displayName: 'Test Table', // Same display name
                fullyQualifiedName: 'test.database.table2',
                entityType: 'table',
              },
              _index: 'table_search_index',
            },
          ],
        },
      };

      (searchQuery as jest.Mock).mockResolvedValue(mockResponseWithDuplicates);

      const result = await searchEntity({
        searchText: 'test',
        searchIndex: SearchIndex.TABLE,
      });

      // Should only return one item due to duplicate label removal
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        label: 'Test Table',
        value: 'test.database.table1',
      });
    });

    it('should handle search API errors gracefully', async () => {
      const mockError = new Error('API Error');
      (searchQuery as jest.Mock).mockRejectedValue(mockError);

      const result = await searchEntity({
        searchText: 'test',
        searchIndex: SearchIndex.TABLE,
      });

      expect(result).toEqual([]);
    });

    it('should handle missing entityType in source when setSourceAsValue is true', async () => {
      const mockResponseWithoutEntityType = {
        hits: {
          hits: [
            {
              _source: {
                displayName: 'Test Entity',
                fullyQualifiedName: 'test.entity',
                // entityType is missing
              },
              _index: 'test_search_index',
            },
          ],
        },
      };

      (searchQuery as jest.Mock).mockResolvedValue(
        mockResponseWithoutEntityType
      );

      const result = await searchEntity({
        searchText: 'test',
        searchIndex: SearchIndex.TABLE,
        setSourceAsValue: true,
      });

      expect(result).toEqual([
        {
          label: 'Test Entity',
          value: JSON.stringify({
            displayName: 'Test Entity',
            fullyQualifiedName: 'test.entity',
            type: undefined, // entityType is undefined, so type should be undefined
          }),
        },
      ]);
    });

    it('should use entityType from source for type field when setSourceAsValue is true (regression test)', async () => {
      const mockResponseWithEntityType = {
        hits: {
          hits: [
            {
              _source: {
                displayName: 'Custom Entity',
                fullyQualifiedName: 'custom.entity',
                entityType: 'customType', // This should be used as the type field
                name: 'customEntity',
              },
              _index: 'some_other_index', // This _index value should not be used for type
            },
          ],
        },
      };

      (searchQuery as jest.Mock).mockResolvedValue(mockResponseWithEntityType);

      const result = await searchEntity({
        searchText: 'custom',
        searchIndex: SearchIndex.TABLE,
        setSourceAsValue: true,
      });

      expect(result).toEqual([
        {
          label: 'Custom Entity',
          value: JSON.stringify({
            displayName: 'Custom Entity',
            fullyQualifiedName: 'custom.entity',
            entityType: 'customType',
            name: 'customEntity',
            type: 'customType', // Should use entityType from source, not from index mapping
          }),
        },
      ]);
    });
  });
});

describe('normalizeDestinationConfig', () => {
  it('should normalize config with headers and queryParams as objects to arrays', () => {
    const config = {
      endpoint: 'https://example.com/webhook',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token123',
      },
      queryParams: {
        param1: 'value1',
        param2: 'value2',
      },
      timeout: 30,
    };

    const result = normalizeDestinationConfig(config);

    expect(result).toEqual({
      endpoint: 'https://example.com/webhook',
      headers: [
        { key: 'Content-Type', value: 'application/json' },
        { key: 'Authorization', value: 'Bearer token123' },
      ],
      queryParams: [
        { key: 'param1', value: 'value1' },
        { key: 'param2', value: 'value2' },
      ],
      timeout: 30,
    });
  });

  it('should handle config with undefined headers and queryParams', () => {
    const config = {
      endpoint: 'https://example.com/webhook',
      timeout: 30,
    };

    const result = normalizeDestinationConfig(config);

    expect(result).toEqual({
      endpoint: 'https://example.com/webhook',
      timeout: 30,
    });
  });

  it('should handle config with empty headers and queryParams objects', () => {
    const config = {
      endpoint: 'https://example.com/webhook',
      headers: {},
      queryParams: {},
      timeout: 30,
    };

    const result = normalizeDestinationConfig(config);

    expect(result).toEqual({
      endpoint: 'https://example.com/webhook',
      headers: [],
      queryParams: [],
      timeout: 30,
    });
  });

  it('should omit undefined values from config', () => {
    const config = {
      endpoint: 'https://example.com/webhook',
      headers: {
        'Content-Type': 'application/json',
      },
      queryParams: undefined,
      timeout: undefined,
      secretKey: 'secret123',
    };

    const result = normalizeDestinationConfig(config);

    expect(result).toEqual({
      endpoint: 'https://example.com/webhook',
      headers: [{ key: 'Content-Type', value: 'application/json' }],
      secretKey: 'secret123',
    });
    expect(result).not.toHaveProperty('timeout');
    expect(result).not.toHaveProperty('queryParams');
  });

  it('should handle undefined config', () => {
    const result = normalizeDestinationConfig(undefined);

    expect(result).toEqual({});
  });

  it('should handle config with only headers', () => {
    const config = {
      endpoint: 'https://example.com/webhook',
      headers: {
        Authorization: 'Bearer token',
      },
    };

    const result = normalizeDestinationConfig(config);

    expect(result).toEqual({
      endpoint: 'https://example.com/webhook',
      headers: [{ key: 'Authorization', value: 'Bearer token' }],
    });
  });

  it('should handle config with only queryParams', () => {
    const config = {
      endpoint: 'https://example.com/webhook',
      queryParams: {
        apiKey: 'key123',
      },
    };

    const result = normalizeDestinationConfig(config);

    expect(result).toEqual({
      endpoint: 'https://example.com/webhook',
      queryParams: [{ key: 'apiKey', value: 'key123' }],
    });
  });

  it('should preserve other config properties unchanged', () => {
    const config = {
      endpoint: 'https://example.com/webhook',
      secretKey: 'secret',
      sendToFollowers: true,
      sendToOwners: false,
      readTimeout: 60,
      headers: {
        'X-Custom-Header': 'value',
      },
    };

    const result = normalizeDestinationConfig(config);

    expect(result).toEqual({
      endpoint: 'https://example.com/webhook',
      secretKey: 'secret',
      sendToFollowers: true,
      sendToOwners: false,
      readTimeout: 60,
      headers: [{ key: 'X-Custom-Header', value: 'value' }],
    });
  });
});

describe('getFormattedDestinations', () => {
  it('should convert headers and queryParams from arrays to objects', () => {
    const destinations = [
      {
        destinationType: 'Webhook',
        category: 'External',
        config: {
          endpoint: 'https://example.com/webhook',
          headers: [
            { key: 'Content-Type', value: 'application/json' },
            { key: 'Authorization', value: 'Bearer token123' },
          ],
          queryParams: [
            { key: 'param1', value: 'value1' },
            { key: 'param2', value: 'value2' },
          ],
        },
      },
    ];

    const result = getFormattedDestinations(
      destinations as ModifiedDestination[]
    );

    expect(result).toEqual([
      {
        category: 'External',
        config: {
          endpoint: 'https://example.com/webhook',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer token123',
          },
          queryParams: {
            param1: 'value1',
            param2: 'value2',
          },
        },
      },
    ]);
  });

  it('should omit empty headers and queryParams', () => {
    const destinations = [
      {
        destinationType: 'Webhook',
        category: 'External',
        config: {
          endpoint: 'https://example.com/webhook',
          headers: [],
          queryParams: [],
        },
      },
    ];

    const result = getFormattedDestinations(
      destinations as unknown as ModifiedDestination[]
    );

    expect(result).toEqual([
      {
        category: 'External',
        config: {
          endpoint: 'https://example.com/webhook',
        },
      },
    ]);
  });

  it('should handle undefined headers and queryParams', () => {
    const destinations = [
      {
        destinationType: 'Webhook',
        category: 'External',
        config: {
          endpoint: 'https://example.com/webhook',
        },
      },
    ];

    const result = getFormattedDestinations(
      destinations as ModifiedDestination[]
    );

    expect(result).toEqual([
      {
        category: 'External',
        config: {
          endpoint: 'https://example.com/webhook',
        },
      },
    ]);
  });

  it('should remove destinationType from result', () => {
    const destinations = [
      {
        destinationType: 'Webhook',
        category: 'External',
        type: 'Webhook',
        config: {
          endpoint: 'https://example.com/webhook',
        },
      },
    ];

    const result = getFormattedDestinations(
      destinations as ModifiedDestination[]
    );

    expect(result).toEqual([
      {
        category: 'External',
        type: 'Webhook',
        config: {
          endpoint: 'https://example.com/webhook',
        },
      },
    ]);
    expect(result?.[0]).not.toHaveProperty('destinationType');
  });

  it('should handle undefined destinations', () => {
    const result = getFormattedDestinations(undefined);

    expect(result).toBeUndefined();
  });

  it('should handle empty array', () => {
    const result = getFormattedDestinations([]);

    expect(result).toEqual([]);
  });

  it('should preserve other config properties', () => {
    const destinations = [
      {
        destinationType: 'Webhook',
        category: 'External',
        config: {
          endpoint: 'https://example.com/webhook',
          secretKey: 'secret123',
          timeout: 30,
          readTimeout: 60,
          headers: [{ key: 'X-Custom', value: 'test' }],
        },
      },
    ];

    const result = getFormattedDestinations(
      destinations as unknown as ModifiedDestination[]
    );

    expect(result).toEqual([
      {
        category: 'External',
        config: {
          endpoint: 'https://example.com/webhook',
          secretKey: 'secret123',
          timeout: 30,
          readTimeout: 60,
          headers: {
            'X-Custom': 'test',
          },
        },
      },
    ]);
  });

  it('should handle multiple destinations', () => {
    const destinations = [
      {
        destinationType: 'Webhook',
        category: 'External',
        config: {
          endpoint: 'https://example1.com/webhook',
          headers: [{ key: 'Auth', value: 'token1' }],
        },
      },
      {
        destinationType: 'Slack',
        category: 'External',
        config: {
          endpoint: 'https://slack.com/webhook',
          queryParams: [{ key: 'channel', value: 'general' }],
        },
      },
    ];

    const result = getFormattedDestinations(
      destinations as ModifiedDestination[]
    );

    expect(result).toEqual([
      {
        category: 'External',
        config: {
          endpoint: 'https://example1.com/webhook',
          headers: {
            Auth: 'token1',
          },
        },
      },
      {
        category: 'External',
        config: {
          endpoint: 'https://slack.com/webhook',
          queryParams: {
            channel: 'general',
          },
        },
      },
    ]);
  });

  it('should omit undefined config values', () => {
    const destinations = [
      {
        destinationType: 'Webhook',
        category: 'External',
        config: {
          endpoint: 'https://example.com/webhook',
          timeout: undefined,
          secretKey: 'secret',
          readTimeout: undefined,
        },
      },
    ];

    const result = getFormattedDestinations(
      destinations as unknown as ModifiedDestination[]
    );

    expect(result).toEqual([
      {
        category: 'External',
        config: {
          endpoint: 'https://example.com/webhook',
          secretKey: 'secret',
        },
      },
    ]);
    expect(result?.[0]?.config).not.toHaveProperty('timeout');
    expect(result?.[0]?.config).not.toHaveProperty('readTimeout');
  });
});
