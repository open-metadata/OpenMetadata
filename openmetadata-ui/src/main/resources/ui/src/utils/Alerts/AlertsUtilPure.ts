/*
 *  Copyright 2025 Collate.
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

import type { RuleObject } from 'antd/lib/form';
import cryptoRandomString from 'crypto-random-string-with-promisify-polyfill';
import { isEmpty, isEqual, isUndefined, map, omitBy, startCase } from 'lodash';
import type { AlertEventDetailsToDisplay } from '../../components/Alerts/AlertDetails/AlertRecentEventsTab/AlertRecentEventsTab.interface';
import {
  DESTINATION_DROPDOWN_TABS,
  DESTINATION_SOURCE_ITEMS,
  EXTERNAL_CATEGORY_OPTIONS,
} from '../../constants/Alerts.constants';
import { OPEN_METADATA } from '../../constants/Services.constant';
import { AlertRecentEventFilters } from '../../enums/Alerts.enum';
import type { EventSubscriptionDiagnosticInfo } from '../../generated/events/api/eventSubscriptionDiagnosticInfo';
import type { ChangeEvent, TypedEvent } from '../../generated/events/api/typedEvent';
import { Status } from '../../generated/events/api/typedEvent';
import {
  Destination,
  SubscriptionCategory,
  SubscriptionType,
  type Webhook,
} from '../../generated/events/eventSubscription';
import type { ModifiedDestination } from '../../pages/AddObservabilityPage/AddObservabilityPage.interface';
import { t } from '../i18next/LocalUtil';

export const getFunctionDisplayName = (func: string): string => {
  switch (func) {
    case 'matchAnyEntityFqn':
      return t('label.fqn-uppercase');
    case 'matchAnyOwnerName':
      return t('label.owner-plural');
    case 'matchAnyEventType':
      return t('label.event-type');
    case 'matchTestResult':
      return t('label.test-entity', {
        entity: t('label.result-plural'),
      });
    case 'matchUpdatedBy':
      return t('label.updated-by');
    case 'matchAnyFieldChange':
      return t('label.field-change');
    case 'matchPipelineState':
      return t('label.pipeline-state');
    case 'matchIngestionPipelineState':
      return t('label.pipeline-state');
    case 'matchAnySource':
      return t('label.source-match');
    case 'matchAnyEntityId':
      return t('label.entity-id-match');
    default:
      return '';
  }
};

/**
 *
 * @param name Field name used to identify which field has error
 * @param minLengthRequired how many item should be there in the list
 * @returns If validation failed throws an error else resolve
 */
export const listLengthValidator =
  <T>(name: string, minLengthRequired = 1) =>
  async (_: RuleObject, list: T[]) => {
    if (!list || list.length < minLengthRequired) {
      throw new Error(
        t('message.length-validator-error', {
          length: minLengthRequired,
          field: name,
        })
      );
    }
  };

export const getAlertActionTypeDisplayName = (
  alertActionType: SubscriptionType
) => {
  switch (alertActionType) {
    case SubscriptionType.ActivityFeed:
      return t('label.activity-feed-plural');
    case SubscriptionType.Email:
      return t('label.email');
    case SubscriptionType.Webhook:
      return t('label.webhook');
    case SubscriptionType.Slack:
      return t('label.slack');
    case SubscriptionType.MSTeams:
      return t('label.ms-team-plural');
    case SubscriptionType.GChat:
      return t('label.g-chat');
    default:
      return '';
  }
};

export const getDisplayNameForEntities = (entity: string) => {
  switch (entity) {
    case 'kpi':
      return t('label.kpi-uppercase');
    case 'mlmodel':
      return t('label.ml-model');
    default:
      return startCase(entity);
  }
};

export const getSelectOptionsFromEnum = (type: { [s: number]: string }) =>
  map(type, (value) => ({
    label: startCase(value),
    value,
  }));

// Disabling all options except Email for SubscriptionCategory Users, Followers and Admins
// Since there is no provision for webhook subscription for users
export const getSubscriptionTypeOptions = (destinationType: string) => {
  return EXTERNAL_CATEGORY_OPTIONS.map((item) => {
    const isEmailType = isEqual(item.value, SubscriptionType.Email);
    const shouldDisable =
      isEqual(destinationType, SubscriptionCategory.Users) ||
      isEqual(destinationType, SubscriptionCategory.Followers) ||
      isEqual(destinationType, SubscriptionCategory.Admins);

    return {
      ...item,
      disabled: !isEmailType && shouldDisable,
    };
  });
};

/**
 * @description Function to get header object of webhook config from the form data
 * Since the form data is in the form of { key: string, value: string }[]
 */
export const getConfigHeaderObjectFromArray = (
  headers?: {
    key: string;
    value: string;
  }[]
) =>
  headers?.reduce(
    (prev, curr) => ({
      ...prev,
      [curr.key]: curr.value,
    }),
    {} as { [key: string]: string }
  );

/**
 * @description Function to get header webhook config converted from an object
 * in the form of { key: string, value: string }[]
 * to render Form.List
 */
export const getConfigHeaderArrayFromObject = (headers?: Webhook['headers']) =>
  isUndefined(headers)
    ? headers
    : Object.entries(headers).map(([key, value]) => ({
        key,
        value,
      }));

/**
 * @description Function to get query params webhook config converted from an array
 */
export const getConfigQueryParamsObjectFromArray = (
  queryParams?: {
    key: string;
    value: string;
  }[]
) =>
  queryParams?.reduce(
    (prev, curr) => ({
      ...prev,
      [curr.key]: curr.value,
    }),
    {} as { [key: string]: string }
  );

/**
 * @description Function to get query params webhook config converted from an object
 */
export const getConfigQueryParamsArrayFromObject = (
  queryParams?: Webhook['queryParams']
) =>
  isUndefined(queryParams)
    ? queryParams
    : Object.entries(queryParams).map(([key, value]) => ({
        key,
        value,
      }));

/**
 * @description Normalizes destination config for comparison by converting headers and queryParams to array format
 */
export const normalizeDestinationConfig = (config?: Destination['config']) =>
  omitBy(
    {
      ...config,
      headers: getConfigHeaderArrayFromObject(config?.headers),
      queryParams: getConfigQueryParamsArrayFromObject(config?.queryParams),
    },
    isUndefined
  );

export const getFormattedDestinations = (
  destinations?: ModifiedDestination[]
) => {
  const formattedDestinations = destinations?.map((destination) => {
    const {
      destinationType: _destinationType,
      config,
      ...otherData
    } = destination;

    const headers = getConfigHeaderObjectFromArray(config?.headers);
    const queryParams = getConfigQueryParamsObjectFromArray(
      config?.queryParams
    );

    return {
      ...otherData,
      config: omitBy(
        {
          ...config,
          headers: isEmpty(headers) ? undefined : headers,
          queryParams: isEmpty(queryParams) ? undefined : queryParams,
        },
        isUndefined
      ),
    };
  });

  return formattedDestinations;
};

// Destination category exclusions by entity type
const DESTINATION_CATEGORY_EXCLUDES: Record<string, SubscriptionCategory[]> = {
  // Default: exclude Assignees and Mentions for all non-thread entities
  __default__: [SubscriptionCategory.Assignees, SubscriptionCategory.Mentions],
  // Thread-specific exclusions
  task: [
    SubscriptionCategory.Followers,
    SubscriptionCategory.Admins,
    SubscriptionCategory.Users,
    SubscriptionCategory.Teams,
  ],
  conversation: [
    SubscriptionCategory.Followers,
    SubscriptionCategory.Admins,
    SubscriptionCategory.Users,
    SubscriptionCategory.Teams,
    SubscriptionCategory.Assignees,
  ],
  announcement: [SubscriptionCategory.Assignees],
};

export const getFilteredDestinationOptions = (
  key: keyof typeof DESTINATION_SOURCE_ITEMS,
  selectedSource: string
) => {
  const options = DESTINATION_SOURCE_ITEMS[key];
  const isExternalDestination = !isEqual(
    key,
    DESTINATION_DROPDOWN_TABS.internal
  );

  if (isExternalDestination) {
    return options;
  }

  const excludedCategories =
    DESTINATION_CATEGORY_EXCLUDES[selectedSource] ||
    DESTINATION_CATEGORY_EXCLUDES.__default__;

  return options.filter(
    (option) =>
      !excludedCategories.includes(option.value as SubscriptionCategory)
  );
};

export const getAlertEventsFilterLabels = (status: AlertRecentEventFilters) => {
  switch (status) {
    case AlertRecentEventFilters.SUCCESSFUL:
      return t('label.successful');
    case AlertRecentEventFilters.FAILED:
      return t('label.failed');
    case AlertRecentEventFilters.ALL:
      return t('label.all');
    default:
      return '';
  }
};

export const getLabelsForEventDetails = (
  prop: keyof AlertEventDetailsToDisplay
) => {
  switch (prop) {
    case 'eventType':
      return t('label.event-type');
    case 'entityId':
      return t('label.entity-id', { entity: t('label.entity') });
    case 'userName':
      return t('label.user-name');
    case 'previousVersion':
      return t('label.previous-version');
    case 'currentVersion':
      return t('label.current-version');
    case 'reason':
      return t('label.reason');
    case 'source':
      return t('label.source');
    case 'failingSubscriptionId':
      return t('label.failing-subscription-id');
    default:
      return '';
  }
};

export const getChangeEventDataFromTypedEvent = (
  typedEvent: TypedEvent
): {
  changeEventData: ChangeEvent;
  changeEventDataToDisplay: AlertEventDetailsToDisplay;
} => {
  let changeEventData = typedEvent.data[0];

  // If the event is failed, the changeEventData object is nested inside the changeEventData object.
  if (
    typedEvent.status === Status.Failed &&
    !isUndefined(changeEventData.changeEvent)
  ) {
    changeEventData = changeEventData.changeEvent;
  }

  const { eventType, entityId, userName, previousVersion, currentVersion } =
    changeEventData;

  // Extracting the reason, source, and failingSubscriptionId from the failed changeEventData object.
  const { reason, source, failingSubscriptionId } = typedEvent.data[0];

  return {
    changeEventData,
    changeEventDataToDisplay: {
      reason,
      source,
      failingSubscriptionId,
      eventType,
      entityId,
      userName,
      previousVersion,
      currentVersion,
    },
  };
};

export const getDiagnosticItems = (
  diagnosticData: EventSubscriptionDiagnosticInfo | undefined
) => [
  {
    key: t('label.latest-offset'),
    value: diagnosticData?.latestOffset,
    description: t('message.latest-offset-description'),
  },
  {
    key: t('label.current-offset'),
    value: diagnosticData?.currentOffset,
    description: t('message.current-offset-description'),
  },
  {
    key: t('label.starting-offset'),
    value: diagnosticData?.startingOffset,
    description: t('message.starting-offset-description'),
  },
  {
    key: t('label.successful-event-plural'),
    value: diagnosticData?.successfulEventsCount,
    description: t('message.successful-events-description'),
  },
  {
    key: t('label.failed-event-plural'),
    value: diagnosticData?.failedEventsCount,
    description: t('message.failed-events-description'),
  },
  {
    key: t('label.processed-all-event-plural'),
    value: diagnosticData?.hasProcessedAllEvents,
    description: t('message.processed-all-events-description'),
  },
];

export const getRandomizedAlertName = () => {
  return `${OPEN_METADATA}_alert_${cryptoRandomString({
    length: 9,
    type: 'alphanumeric',
  })}`;
};

export const getMessageFromArgumentName = (argumentName: string) => {
  switch (argumentName) {
    case 'fqnList':
      return t('message.field-text-is-required', {
        fieldText: t('label.entity-list', {
          entity: t('label.fqn-uppercase'),
        }),
      });
    case 'domainList':
      return t('message.field-text-is-required', {
        fieldText: t('label.entity-list', {
          entity: t('label.domain'),
        }),
      });
    case 'tableNameList':
      return t('message.field-text-is-required', {
        fieldText: t('label.entity-list', {
          entity: t('label.entity-name', {
            entity: t('label.table'),
          }),
        }),
      });
    case 'entityNameList':
      return t('message.field-text-is-required', {
        fieldText: t('label.entity-list', {
          entity: t('label.entity-name', {
            entity: t('label.entity'),
          }),
        }),
      });
    case 'ownerNameList':
      return t('message.field-text-is-required', {
        fieldText: t('label.entity-list', {
          entity: t('label.entity-name', {
            entity: t('label.owner-plural'),
          }),
        }),
      });
    case 'updateByUserList':
    case 'userList':
      return t('message.field-text-is-required', {
        fieldText: t('label.entity-list', {
          entity: t('label.entity-name', {
            entity: t('label.user'),
          }),
        }),
      });
    case 'eventTypeList':
      return t('message.field-text-is-required', {
        fieldText: t('label.entity-list', {
          entity: t('label.entity-name', {
            entity: t('label.event'),
          }),
        }),
      });
    case 'entityIdList':
      return t('message.field-text-is-required', {
        fieldText: t('label.entity-list', {
          entity: t('label.entity-id', {
            entity: t('label.data-asset'),
          }),
        }),
      });
    case 'pipelineStateList':
    case 'ingestionPipelineStateList':
      return t('message.field-text-is-required', {
        fieldText: t('label.entity-list', {
          entity: t('label.pipeline-state'),
        }),
      });
    case 'testStatusList':
      return t('message.field-text-is-required', {
        fieldText: t('label.entity-list', {
          entity: t('label.test-suite-status'),
        }),
      });
    case 'testResultList':
      return t('message.field-text-is-required', {
        fieldText: t('label.entity-list', {
          entity: t('label.test-case-result'),
        }),
      });
    case 'contractStatusList':
      return t('message.field-text-is-required', {
        fieldText: t('label.entity-list', {
          entity: t('label.data-contract-status'),
        }),
      });
    case 'testSuiteList':
      return t('message.field-text-is-required', {
        fieldText: t('label.entity-list', {
          entity: t('label.test-suite'),
        }),
      });
    default:
      return '';
  }
};
