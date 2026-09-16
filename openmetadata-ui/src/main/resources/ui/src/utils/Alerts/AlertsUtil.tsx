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

import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import {
  AlertProps,
  Checkbox,
  Col,
  Divider,
  MenuProps,
  Select,
  Skeleton,
  Tooltip,
  Typography,
} from 'antd';
import Form from 'antd/lib/form';
import { AxiosError } from 'axios';
import { isEmpty, uniqBy } from 'lodash';
import { Fragment } from 'react';
import { ReactComponent as AlertIcon } from '../../assets/svg/alert.svg';
import { ReactComponent as AllActivityIcon } from '../../assets/svg/all-activity.svg';
import { ReactComponent as ClockIcon } from '../../assets/svg/clock.svg';
import { ReactComponent as CheckIcon } from '../../assets/svg/ic-check.svg';
import { ReactComponent as MailIcon } from '../../assets/svg/ic-mail.svg';
import { ReactComponent as MSTeamsIcon } from '../../assets/svg/ms-teams.svg';
import { ReactComponent as SlackIcon } from '../../assets/svg/slack.svg';
import { ReactComponent as WebhookIcon } from '../../assets/svg/webhook.svg';
import FQNListSelect from '../../components/Alerts/FQNListSelect/FQNListSelect.component';
import { AsyncSelect } from '../../components/common/AsyncSelect/AsyncSelect';
import { DATA_CONTRACT_STATUS_OPTIONS } from '../../constants/Alerts.constants';
import { PAGE_SIZE_LARGE } from '../../constants/constants';
import { UUID_REGEX } from '../../constants/regex.constants';
import { AlertRecentEventFilters } from '../../enums/Alerts.enum';
import { EntityType } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import { StatusType } from '../../generated/entity/data/pipeline';
import { PipelineState } from '../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { EventsRecord } from '../../generated/events/api/eventsRecord';
import { Status } from '../../generated/events/api/typedEvent';
import {
  EventFilterRule,
  InputType,
  SubscriptionType,
} from '../../generated/events/eventSubscription';
import { Status as DestinationStatus } from '../../generated/events/testDestinationStatus';
import { TestCaseStatus } from '../../generated/tests/testCase';
import { EventType } from '../../generated/type/changeEvent';
import { searchContracts } from '../../rest/contractAPI';
import { searchQuery } from '../../rest/searchAPI';
import { ExtraInfoLabel } from '../DataAssetsHeader.utils';
import { EntityIconSize } from '../EntityIconUtils';
import { getEntityName, getEntityNameLabel } from '../EntityNameUtils';
import { t } from '../i18next/LocalUtil';
import searchClassBase from '../SearchClassBase';
import { getTermQuery } from '../SearchPureUtils';
import { showErrorToast } from '../ToastUtils';
import './alerts-util.less';
import {
  getAlertEventsFilterLabels,
  getMessageFromArgumentName,
  getSelectOptionsFromEnum,
  getSelectOptionsFromValues,
} from './AlertsUtilPure';

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
export const getFqnSearchIndexes = (
  selectedTrigger: string,
  containerEntities: string[] = []
): SearchIndex[] => {
  const mapping = searchClassBase.getEntityTypeSearchIndexMapping();
  const sourceIndex = mapping[selectedTrigger];

  // The "all" index already spans every entity, so ancestor indexes are redundant there.
  if (sourceIndex === SearchIndex.ALL) {
    return [sourceIndex];
  }

  return [selectedTrigger, ...containerEntities]
    .map((type) => mapping[type])
    .filter((index): index is SearchIndex => Boolean(index));
};

const getTableSuggestions = async (searchText: string) => {
  return searchEntity({
    searchText,
    searchIndex: SearchIndex.TABLE,
    showDisplayNameAsLabel: false,
  });
};

const getDataContractSuggestions = async (searchText = '') => {
  try {
    const contracts = await searchContracts(searchText, PAGE_SIZE_LARGE);

    return contracts
      .map((contract) => contract.fullyQualifiedName ?? '')
      .filter(Boolean)
      .map((fullyQualifiedName) => ({
        label: fullyQualifiedName,
        value: fullyQualifiedName,
      }));
  } catch (error) {
    showErrorToast(
      error as AxiosError,
      t('server.entity-fetch-error', {
        entity: t('label.data-contract'),
      })
    );

    return [];
  }
};

const getTestSuiteSuggestions = async (searchText: string) => {
  return searchEntity({ searchText, searchIndex: SearchIndex.TEST_SUITE });
};

const getDomainOptions = async (searchText: string) => {
  return searchEntity({ searchText, searchIndex: SearchIndex.DOMAIN });
};

const getOwnerOptions = async (searchText: string) => {
  return searchEntity({
    searchText,
    searchIndex: [SearchIndex.TEAM, SearchIndex.USER],
    queryFilter: getTermQuery({
      isBot: 'false',
    }),
  });
};

const getUserOptions = async (searchText: string) => {
  return searchEntity({
    searchText,
    searchIndex: SearchIndex.USER,
    queryFilter: getTermQuery({
      isBot: 'false',
    }),
  });
};

const getUserBotOptions = async (searchText: string) => {
  return searchEntity({
    searchText,
    searchIndex: SearchIndex.USER,
  });
};

export const getSupportedFilterOptions = (
  selectedFilters: EventFilterRule[],
  supportedFilters?: EventFilterRule[]
) =>
  supportedFilters?.map((func) => ({
    label: (
      <Tooltip mouseEnterDelay={0.8} title={getEntityName(func)}>
        <span data-testid={`${getEntityName(func)}-filter-option`}>
          {getEntityName(func)}
        </span>
      </Tooltip>
    ),
    value: func.name,
    disabled: selectedFilters?.some((d) => d.name === func.name),
  }));

export const getFieldByArgumentType = (
  fieldName: number,
  argument: string,
  index: number,
  selectedTrigger: string,
  containerEntities: string[] = [],
  supportedEventTypes: EventType[] = []
) => {
  const getEntityByFQN = async (searchText: string) => {
    if (selectedTrigger === EntityType.DATA_CONTRACT) {
      return getDataContractSuggestions(searchText);
    }

    return searchEntity({
      searchText,
      searchIndex: getFqnSearchIndexes(selectedTrigger, containerEntities),
      showDisplayNameAsLabel: false,
      wildcardEntityTypes: containerEntities,
    });
  };

  const getEntityByIdSuggestions = async (searchText?: string) => {
    const searchIndexMapping =
      searchClassBase.getEntityTypeSearchIndexMapping();
    const trimmed = (searchText ?? '').trim();
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

          return {
            uuid: id,
            value: id,
            label: (
              <div className="entity-id-option">
                <div>{id}</div>
                <div className="entity-id-option-fqn">{fqn}</div>
              </div>
            ),
          };
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
  const translatedContractStatusOptions = DATA_CONTRACT_STATUS_OPTIONS.map(
    (option) => ({
      ...option,
      label: t(option.label),
    })
  );

  const fieldRenderers: Record<string, () => JSX.Element> = {
    fqnList: () => (
      <FQNListSelect
        api={getEntityByFQN}
        className="w-full"
        containerEntities={containerEntities}
        data-testid="fqn-list-select"
        mode="multiple"
        optionFilterProp="label"
        placeholder={t('label.search-by-type', {
          type: t('label.fqn-uppercase'),
        })}
        searchIndex={getFqnSearchIndexes(selectedTrigger, containerEntities)}
      />
    ),
    domainList: () => (
      <AsyncSelect
        api={getDomainOptions}
        className="w-full"
        data-testid="domain-select"
        mode="multiple"
        placeholder={t('label.search-by-type', {
          type: t('label.domain-lowercase'),
        })}
      />
    ),
    tableNameList: () => (
      <AsyncSelect
        api={getTableSuggestions}
        className="w-full"
        data-testid="table-name-select"
        maxTagTextLength={45}
        mode="multiple"
        optionFilterProp="label"
        placeholder={t('label.search-by-type', {
          type: t('label.table-lowercase'),
        })}
      />
    ),
    entityNameList: () => (
      <AsyncSelect
        api={getTableSuggestions}
        className="w-full"
        data-testid="entity-name-select"
        maxTagTextLength={45}
        mode="multiple"
        optionFilterProp="label"
        placeholder={t('label.search-by-type', {
          type: t('label.entity-lowercase'),
        })}
      />
    ),
    ownerNameList: () => (
      <AsyncSelect
        api={getOwnerOptions}
        className="w-full"
        data-testid="owner-name-select"
        mode="multiple"
        placeholder={t('label.search-by-type', {
          type: t('label.owner-lowercase-plural'),
        })}
      />
    ),
    // For updateByUserList, we need to show bot users as well; for userList,
    // which is an argument for `conversation` filters, only non-bot users.
    updateByUserList: () => (
      <AsyncSelect
        api={getUserBotOptions}
        className="w-full"
        data-testid="user-name-select"
        mode="multiple"
        placeholder={t('label.search-by-type', {
          type: t('label.user'),
        })}
      />
    ),
    userList: () => (
      <AsyncSelect
        api={getUserOptions}
        className="w-full"
        data-testid="user-name-select"
        mode="multiple"
        placeholder={t('label.search-by-type', {
          type: t('label.user'),
        })}
      />
    ),
    eventTypeList: () => (
      <Select
        className="w-full"
        data-testid="event-type-select"
        mode="multiple"
        options={
          isEmpty(supportedEventTypes)
            ? getSelectOptionsFromEnum(EventType)
            : getSelectOptionsFromValues(supportedEventTypes)
        }
        placeholder={t('label.search-by-type', {
          type: t('label.event-type-lowercase'),
        })}
      />
    ),
    entityIdList: () => (
      <AsyncSelect
        api={getEntityByIdSuggestions}
        className="w-full"
        data-testid="entity-id-select"
        maxTagTextLength={45}
        mode="multiple"
        optionLabelProp="uuid"
        placeholder={t('label.search-by-type', {
          type: t('label.entity-id', {
            entity: t('label.data-asset'),
          }),
        })}
      />
    ),
    pipelineStateList: () => (
      <Select
        className="w-full"
        data-testid="pipeline-status-select"
        mode="multiple"
        options={getSelectOptionsFromEnum(StatusType)}
        placeholder={t('label.select-field', {
          field: t('label.pipeline-state'),
        })}
      />
    ),
    ingestionPipelineStateList: () => (
      <Select
        className="w-full"
        data-testid="pipeline-status-select"
        mode="multiple"
        options={getSelectOptionsFromEnum(PipelineState)}
        placeholder={t('label.select-field', {
          field: t('label.pipeline-state'),
        })}
      />
    ),
    testStatusList: () => (
      <Select
        className="w-full"
        data-testid="test-status-select"
        mode="multiple"
        options={getSelectOptionsFromEnum(TestCaseStatus)}
        placeholder={t('label.select-field', {
          field: t('label.test-suite-status'),
        })}
      />
    ),
    testResultList: () => (
      <Select
        className="w-full"
        data-testid="test-result-select"
        mode="multiple"
        options={getSelectOptionsFromEnum(TestCaseStatus)}
        placeholder={t('label.select-field', {
          field: t('label.test-case-result'),
        })}
      />
    ),
    contractStatusList: () => (
      <Select
        className="w-full"
        data-testid="contract-status-select"
        mode="multiple"
        options={translatedContractStatusOptions}
        placeholder={t('label.select-field', {
          field: t('label.data-contract-status'),
        })}
      />
    ),
    testSuiteList: () => (
      <AsyncSelect
        api={getTestSuiteSuggestions}
        className="w-full"
        data-testid="test-suite-select"
        mode="multiple"
        placeholder={t('label.search-by-type', {
          type: t('label.test-suite'),
        })}
      />
    ),
  };

  const field = fieldRenderers[argument]?.() ?? <></>;

  return (
    <>
      <Col key={argument} span={12}>
        <Form.Item
          name={[fieldName, 'arguments', index, 'input']}
          rules={[
            {
              required: true,
              message: getMessageFromArgumentName(argument),
            },
          ]}>
          {field}
        </Form.Item>
      </Col>
      <Form.Item
        hidden
        dependencies={[fieldName, 'arguments', index, 'input']}
        initialValue={argument}
        key={`${argument}-name`}
        name={[fieldName, 'arguments', index, 'name']}
      />
    </>
  );
};

export const getConditionalField = (
  condition: string,
  name: number,
  selectedTrigger: string,
  supportedActions?: EventFilterRule[],
  containerEntities?: string[],
  supportedEventTypes?: EventType[]
) => {
  const selectedAction = supportedActions?.find(
    (action) => action.name === condition
  );
  const requireInput = selectedAction?.inputType === InputType.Runtime;
  const requiredArguments = selectedAction?.arguments;

  if (!requireInput) {
    return <></>;
  }

  return (
    <>
      {requiredArguments?.map((argument, index) => {
        return getFieldByArgumentType(
          name,
          argument,
          index,
          selectedTrigger,
          containerEntities,
          supportedEventTypes
        );
      })}
    </>
  );
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
          <Checkbox checked={selectedResource?.includes(resource)} />
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

export const getAlertRecentEventsFilterOptions = () => {
  const filters: MenuProps['items'] = Object.values(
    AlertRecentEventFilters
  ).map((status) => {
    const label = getAlertEventsFilterLabels(status);

    return {
      label: <Typography.Text>{label}</Typography.Text>,
      key: status,
    };
  });

  return filters;
};

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
              <Divider className="self-center" type="vertical" />
              <Skeleton.Button active className="extra-info-skeleton" />
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
  const alertType: AlertProps['type'] =
    destinationStatus === DestinationStatus.Success ? 'success' : 'error';
  const alertClassName =
    destinationStatus === DestinationStatus.Success
      ? 'destination-success-status'
      : 'destination-error-status';
  const alertIcon =
    destinationStatus === DestinationStatus.Success ? (
      <CheckCircleOutlined height={14} />
    ) : (
      <ExclamationCircleOutlined height={14} />
    );

  return {
    alertClassName,
    alertType,
    statusLabel,
    alertIcon,
  };
};
