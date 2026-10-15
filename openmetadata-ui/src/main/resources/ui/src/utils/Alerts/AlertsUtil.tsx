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

import { Checkbox, Divider, Skeleton } from '@openmetadata/ui-core-components';
import {
  AlertCircle,
  CheckCircle,
} from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { uniq, uniqBy } from 'lodash';
import { Fragment } from 'react';
import { ReactComponent as AlertIcon } from '../../assets/svg/alert.svg';
import { ReactComponent as AllActivityIcon } from '../../assets/svg/all-activity.svg';
import { ReactComponent as ClockIcon } from '../../assets/svg/clock.svg';
import { ReactComponent as CheckIcon } from '../../assets/svg/ic-check.svg';
import { ReactComponent as MailIcon } from '../../assets/svg/ic-mail.svg';
import { ReactComponent as MSTeamsIcon } from '../../assets/svg/ms-teams.svg';
import { ReactComponent as SlackIcon } from '../../assets/svg/slack.svg';
import { ReactComponent as WebhookIcon } from '../../assets/svg/webhook.svg';
import { InlineAlertType } from '../../components/common/InlineAlert/InlineAlert.interface';
import { PAGE_SIZE_LARGE } from '../../constants/constants';
import { UUID_REGEX } from '../../constants/regex.constants';
import { AlertRecentEventFilters } from '../../enums/Alerts.enum';
import { EntityType } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import { EventsRecord } from '../../generated/events/api/eventsRecord';
import { Status } from '../../generated/events/api/typedEvent';
import { SubscriptionType } from '../../generated/events/eventSubscription';
import { Status as DestinationStatus } from '../../generated/events/testDestinationStatus';
import { searchQuery } from '../../rest/searchAPI';
import alertsClassBase from '../AlertsClassBase';
import { ExtraInfoLabel } from '../DataAssetsHeader.utils';
import { EntityIconSize } from '../EntityIconUtils';
import { getEntityName, getEntityNameLabel } from '../EntityNameUtils';
import { t } from '../i18next/LocalUtil';
import searchClassBase from '../SearchClassBase';
import { getTermQuery } from '../SearchPureUtils';
import { showErrorToast } from '../ToastUtils';
import './alerts-util.less';
import { getAlertEventsFilterLabels } from './AlertsUtilPure';

export const getAlertsActionTypeIcon = (type?: SubscriptionType) => {
  switch (type) {
    case SubscriptionType.Slack:
      return <SlackIcon height={16} width={16} />;
    case SubscriptionType.MSTeams:
      return <MSTeamsIcon height={16} width={16} />;
    case SubscriptionType.Email:
      return <MailIcon height={16} width={16} />;
    case SubscriptionType.ActivityFeed:
      return <AllActivityIcon height={16} width={16} />;
    case SubscriptionType.Webhook:
    default:
      return <WebhookIcon height={16} width={16} />;
  }
};

export const EDIT_LINK_PATH = `/settings/notifications/edit-alert`;

export const searchEntity = async ({
  searchText,
  searchIndex,
  queryFilter,
  showDisplayNameAsLabel = true,
  setSourceAsValue = false,
  wildcardEntityTypes,
}: {
  searchText: string;
  searchIndex: SearchIndex | SearchIndex[];
  queryFilter?: Record<string, unknown>;
  showDisplayNameAsLabel?: boolean;
  setSourceAsValue?: boolean;
  wildcardEntityTypes?: string[];
}) => {
  try {
    const response = await searchQuery({
      query: searchText,
      pageNumber: 1,
      pageSize: PAGE_SIZE_LARGE,
      queryFilter,
      searchIndex,
    });

    return uniqBy(
      response.hits.hits.map((d) => {
        // Providing an option to hide display names, for inputs like 'fqnList',
        // where users can input text alongside selection options.
        // This helps avoid displaying the same option twice
        // when using regular expressions as inputs in the same field.
        const displayName = showDisplayNameAsLabel
          ? getEntityName(d._source)
          : d._source.fullyQualifiedName ?? '';

        // Container options (a type that has in-scope descendants) show a display-only ".*" hint
        // to convey "matches everything under this FQN"; the stored value stays the plain FQN.
        const isContainerOption =
          !!d._source.entityType &&
          (wildcardEntityTypes ?? []).includes(d._source.entityType);
        const label = isContainerOption ? `${displayName}.*` : displayName;

        const value = setSourceAsValue
          ? JSON.stringify({
              ...d._source,
              type: d._source.entityType,
            })
          : d._source.fullyQualifiedName ?? '';

        return {
          label,
          value,
        };
      }),
      'label'
    );
  } catch (error) {
    showErrorToast(
      error as AxiosError,
      t('server.entity-fetch-error', {
        entity: t('label.search'),
      })
    );

    return [];
  }
};

// Indexes to search for an Entity FQN filter: the source plus its ancestor (container) entity
// types from the resource descriptor, so a parent FQN can be selected to scope to its descendants.
// An alert can watch several sources, and a name filter then searches every one of them.
export const getFqnSearchIndexes = (
  selectedTrigger: string | string[],
  containerEntities: string[] = []
): SearchIndex[] => {
  const mapping = searchClassBase.getEntityTypeSearchIndexMapping();
  const sources = [selectedTrigger].flat();

  // The "all" index already spans every entity, so ancestor indexes are redundant there.
  if (sources.some((source) => mapping[source] === SearchIndex.ALL)) {
    return [SearchIndex.ALL];
  }

  return uniq(
    [...sources, ...containerEntities]
      .map((type) => mapping[type])
      .filter((index): index is SearchIndex => Boolean(index))
  );
};

export const getTableSuggestions = async (searchText: string) => {
  return searchEntity({
    searchText,
    searchIndex: SearchIndex.TABLE,
    showDisplayNameAsLabel: false,
  });
};

// A data contract's name comes from the search its source brings, as in every alert form.
export const getDataContractSuggestions = (searchText = '') =>
  alertsClassBase.getSourceNameSearch()[EntityType.DATA_CONTRACT](searchText);

export const getTestSuiteSuggestions = async (searchText: string) => {
  return searchEntity({ searchText, searchIndex: SearchIndex.TEST_SUITE });
};

export const getDomainOptions = async (searchText: string) => {
  return searchEntity({ searchText, searchIndex: SearchIndex.DOMAIN });
};

export const getOwnerOptions = async (searchText: string) => {
  return searchEntity({
    searchText,
    searchIndex: [SearchIndex.TEAM, SearchIndex.USER],
    queryFilter: getTermQuery({
      isBot: 'false',
    }),
  });
};

export const getUserOptions = async (searchText: string) => {
  return searchEntity({
    searchText,
    searchIndex: SearchIndex.USER,
    queryFilter: getTermQuery({
      isBot: 'false',
    }),
  });
};

export const getUserBotOptions = async (searchText: string) => {
  return searchEntity({
    searchText,
    searchIndex: SearchIndex.USER,
  });
};

export const getEntityByIdOptions = async (
  searchText: string,
  selectedTrigger: string
) => {
  const searchIndexMapping = searchClassBase.getEntityTypeSearchIndexMapping();
  const trimmed = searchText.trim();
  const isUuidInput = UUID_REGEX.test(trimmed);

  try {
    const response = await searchQuery({
      query: trimmed,
      pageNumber: 1,
      pageSize: PAGE_SIZE_LARGE,
      queryFilter: isUuidInput ? getTermQuery({ id: trimmed }) : undefined,
      searchIndex: searchIndexMapping[selectedTrigger],
    });

    return uniqBy(
      response.hits.hits.map((d) => {
        const id = d._source.id ?? '';
        const fqn = d._source.fullyQualifiedName ?? '';

        return { label: `${id} (${fqn})`, value: id };
      }),
      'value'
    );
  } catch (error) {
    showErrorToast(
      error as AxiosError,
      t('server.entity-fetch-error', { entity: t('label.search') })
    );

    return [];
  }
};

export const getSourceOptionsFromResourceList = (
  resources: Array<string>,
  showCheckbox?: boolean,
  selectedResource?: string[],
  showIcon?: boolean
) =>
  resources.map((resource) => ({
    label: (
      <div
        className="d-flex items-center gap-2"
        data-testid={`${resource}-option`}>
        {showCheckbox && (
          <Checkbox
            isReadOnly
            aria-label={getEntityNameLabel(resource)}
            isSelected={selectedResource?.includes(resource)}
          />
        )}
        {showIcon &&
          searchClassBase.getEntityIconWithBg(
            resource ?? '',
            EntityIconSize.Size14
          )}
        <span>{getEntityNameLabel(resource ?? '')}</span>
      </div>
    ),
    value: resource ?? '',
  }));

export const getAlertRecentEventsFilterOptions = () =>
  Object.values(AlertRecentEventFilters).map((status) => ({
    label: getAlertEventsFilterLabels(status),
    key: status,
  }));

export const getAlertStatusIcon = (status: Status): JSX.Element | null => {
  switch (status) {
    case Status.Successful:
      return <CheckIcon className="status-icon successful-icon" />;
    case Status.Failed:
      return <AlertIcon className="status-icon failed-icon" />;
    case Status.Unprocessed:
      return <ClockIcon className="status-icon unprocessed-icon" />;
    default:
      return null;
  }
};

export const getAlertExtraInfo = (
  alertEventCountsLoading: boolean,
  alertEventCounts?: EventsRecord
) => {
  if (alertEventCountsLoading) {
    return (
      <>
        {Array.from({ length: 3 }, (_, id) => `alert-skeleton-${id}`).map(
          (skeletonKey) => (
            <Fragment key={skeletonKey}>
              <Divider
                className="tw:mx-2 tw:h-[0.9em] tw:self-center"
                orientation="vertical"
              />
              <Skeleton height={40} variant="rounded" width={80} />
            </Fragment>
          )
        )}
      </>
    );
  }

  return (
    <>
      <ExtraInfoLabel
        inlineLayout
        dataTestId="total-events-count"
        label={t('label.total-entity', {
          entity: t('label.event-plural'),
        })}
        value={alertEventCounts?.totalEventsCount ?? 0}
      />
      <ExtraInfoLabel
        inlineLayout
        dataTestId="pending-events-count"
        label={t('label.pending-entity', {
          entity: t('label.event-plural'),
        })}
        value={alertEventCounts?.pendingEventsCount ?? 0}
      />
      <ExtraInfoLabel
        inlineLayout
        dataTestId="failed-events-count"
        label={t('label.failed-entity', {
          entity: t('label.event-plural'),
        })}
        value={alertEventCounts?.failedEventsCount ?? 0}
      />
    </>
  );
};

export const getDestinationStatusAlertData = (destinationStatus?: string) => {
  const statusLabel =
    destinationStatus === DestinationStatus.Success
      ? t('label.success')
      : t('label.failed');
  const alertType: InlineAlertType =
    destinationStatus === DestinationStatus.Success ? 'success' : 'error';
  const alertClassName =
    destinationStatus === DestinationStatus.Success
      ? 'destination-success-status'
      : 'destination-error-status';
  const alertIcon =
    destinationStatus === DestinationStatus.Success ? (
      <CheckCircle height={14} width={14} />
    ) : (
      <AlertCircle height={14} width={14} />
    );

  return {
    alertClassName,
    alertType,
    statusLabel,
    alertIcon,
  };
};
