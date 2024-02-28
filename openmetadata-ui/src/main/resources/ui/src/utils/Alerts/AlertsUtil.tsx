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

import { Col, Input, Select, Switch, Tooltip } from 'antd';
import Form, { RuleObject } from 'antd/lib/form';
import { AxiosError } from 'axios';
import i18next, { t } from 'i18next';
import { isEqual, isUndefined, map, startCase, uniqBy } from 'lodash';
import React from 'react';
import { ReactComponent as AllActivityIcon } from '../../assets/svg/all-activity.svg';
import { ReactComponent as MailIcon } from '../../assets/svg/ic-mail.svg';
import { ReactComponent as MSTeamsIcon } from '../../assets/svg/ms-teams.svg';
import { ReactComponent as SlackIcon } from '../../assets/svg/slack.svg';
import { ReactComponent as WebhookIcon } from '../../assets/svg/webhook.svg';
import { AsyncSelect } from '../../components/common/AsyncSelect/AsyncSelect';
import {
  DESTINATION_DROPDOWN_TABS,
  DESTINATION_SOURCE_ITEMS,
  DESTINATION_TYPE_BASED_PLACEHOLDERS,
  EXTERNAL_CATEGORY_OPTIONS,
} from '../../constants/Alerts.constants';
import { HTTP_STATUS_CODE } from '../../constants/Auth.constants';
import { PAGE_SIZE_LARGE } from '../../constants/constants';
import { SearchIndex } from '../../enums/search.enum';
import { StatusType } from '../../generated/entity/data/pipeline';
import { PipelineState } from '../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { CreateEventSubscription } from '../../generated/events/api/createEventSubscription';
import {
  EventFilterRule,
  EventSubscription,
  InputType,
  SubscriptionCategory,
  SubscriptionType,
} from '../../generated/events/eventSubscription';
import { TestCaseStatus } from '../../generated/tests/testCase';
import { EventType } from '../../generated/type/changeEvent';
import TeamAndUserSelectItem from '../../pages/AddObservabilityPage/DestinationFormItem/TeamAndUserSelectItem/TeamAndUserSelectItem';
import { searchData } from '../../rest/miscAPI';
import { getEntityName } from '../EntityUtils';
import { getConfigFieldFromDestinationType } from '../ObservabilityUtils';
import searchClassBase from '../SearchClassBase';
import { showErrorToast, showSuccessToast } from '../ToastUtils';

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
    case SubscriptionType.Generic:
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
    case 'matchPipelineState':
      return i18next.t('label.pipeline-state');
    case 'matchIngestionPipelineState':
      return i18next.t('label.pipeline-state');
    case 'matchAnySource':
      return i18next.t('label.source-match');
    case 'matchAnyEntityId':
      return i18next.t('label.entity-id-match');
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
  alertActionType: SubscriptionType
) => {
  switch (alertActionType) {
    case SubscriptionType.ActivityFeed:
      return i18next.t('label.activity-feed-plural');
    case SubscriptionType.Email:
      return i18next.t('label.email');
    case SubscriptionType.Generic:
      return i18next.t('label.webhook');
    case SubscriptionType.Slack:
      return i18next.t('label.slack');
    case SubscriptionType.MSTeams:
      return i18next.t('label.ms-team-plural');
    case SubscriptionType.GChat:
      return i18next.t('label.g-chat');
    default:
      return '';
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
export const EDIT_DATA_INSIGHT_REPORT_PATH = `/settings/notifications/edit-data-insight-report`;

const searchEntity = async ({
  searchText,
  searchIndex,
  filters,
  showDisplayNameAsLabel = true,
}: {
  searchText: string;
  searchIndex: SearchIndex | SearchIndex[];
  filters?: string;
  showDisplayNameAsLabel?: boolean;
}) => {
  try {
    const response = await searchData(
      searchText,
      1,
      PAGE_SIZE_LARGE,
      filters ?? '',
      '',
      '',
      searchIndex
    );

    return uniqBy(
      response.data.hits.hits.map((d) => {
        // Providing an option to hide display names, for inputs like 'fqnList',
        // where users can input text alongside selection options.
        // This helps avoid displaying the same option twice
        // when using regular expressions as inputs in the same field.
        const displayName = showDisplayNameAsLabel
          ? getEntityName(d._source)
          : d._source.fullyQualifiedName ?? '';

        return {
          label: displayName,
          value: d._source.fullyQualifiedName ?? '',
        };
      }),
      'label'
    );
  } catch (error) {
    return [];
  }
};

const getTableSuggestions = async (searchText: string) => {
  return searchEntity({
    searchText,
    searchIndex: SearchIndex.TABLE,
    showDisplayNameAsLabel: false,
  });
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
    filters: 'isBot:false',
  });
};

const getUserOptions = async (searchText: string) => {
  return searchEntity({
    searchText,
    searchIndex: SearchIndex.USER,
    filters: 'isBot:false',
  });
};

const getTeamOptions = async (searchText: string) => {
  return searchEntity({ searchText, searchIndex: SearchIndex.TEAM });
};

const getSelectOptionsFromEnum = (type: { [s: number]: string }) =>
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

export const getDestinationConfigField = (
  type: SubscriptionType | SubscriptionCategory,
  fieldName: number
) => {
  switch (type) {
    case SubscriptionType.Slack:
    case SubscriptionType.MSTeams:
    case SubscriptionType.GChat:
    case SubscriptionType.Generic:
      return (
        <Col span={12}>
          <Form.Item
            name={[fieldName, 'config', 'endpoint']}
            rules={[
              {
                required: true,
                message: t('message.field-text-is-required', {
                  fieldText: t('label.endpoint-url'),
                }),
              },
            ]}>
            <Input
              data-testid={`endpoint-input-${fieldName}`}
              placeholder={DESTINATION_TYPE_BASED_PLACEHOLDERS[type] ?? ''}
            />
          </Form.Item>
        </Col>
      );
    case SubscriptionType.Email:
      return (
        <Col span={12}>
          <Form.Item
            name={[fieldName, 'config', 'receivers']}
            rules={[
              {
                required: true,
                message: t('message.field-text-is-required', {
                  fieldText: t('label.email'),
                }),
              },
            ]}>
            <Select
              className="w-full"
              data-testid={`email-input-${fieldName}`}
              mode="tags"
              open={false}
              placeholder={DESTINATION_TYPE_BASED_PLACEHOLDERS[type] ?? ''}
            />
          </Form.Item>
        </Col>
      );
    case SubscriptionCategory.Teams:
    case SubscriptionCategory.Users:
      return (
        <Col span={12}>
          <Form.Item
            name={[fieldName, 'config', 'receivers']}
            rules={[
              {
                required: true,
                message: t('message.field-text-is-required', {
                  fieldText: t('label.entity-list', {
                    entity: t('label.entity-name', {
                      entity:
                        type === SubscriptionCategory.Teams
                          ? t('label.team')
                          : t('label.user'),
                    }),
                  }),
                }),
              },
            ]}>
            <TeamAndUserSelectItem
              destinationNumber={fieldName}
              entityType={
                type === SubscriptionCategory.Teams
                  ? t('label.team-lowercase')
                  : t('label.user-lowercase')
              }
              fieldName={[fieldName, 'config', 'receivers']}
              onSearch={
                type === SubscriptionCategory.Teams
                  ? getTeamOptions
                  : getUserOptions
              }
            />
          </Form.Item>
        </Col>
      );
    case SubscriptionCategory.Admins:
    case SubscriptionCategory.Owners:
    case SubscriptionCategory.Followers:
      return (
        <Form.Item
          hidden
          initialValue
          name={[fieldName, 'config', getConfigFieldFromDestinationType(type)]}>
          <Switch />
        </Form.Item>
      );
    default:
      return null;
  }
};

export const getFieldByArgumentType = (
  fieldName: number,
  argument: string,
  index: number,
  selectedTrigger: string
) => {
  let field: JSX.Element;

  const getEntityByFQN = async (searchText: string) => {
    const searchIndexMapping =
      searchClassBase.getEntityTypeSearchIndexMapping();

    return searchEntity({
      searchText,
      searchIndex: searchIndexMapping[selectedTrigger],
      showDisplayNameAsLabel: false,
    });
  };

  switch (argument) {
    case 'fqnList':
      field = (
        <Col key="fqn-list-select" span={12}>
          <Form.Item
            name={[fieldName, 'arguments', index, 'input']}
            rules={[
              {
                required: true,
                message: t('message.field-text-is-required', {
                  fieldText: t('label.entity-list', {
                    entity: t('label.fqn-uppercase'),
                  }),
                }),
              },
            ]}>
            <AsyncSelect
              api={getEntityByFQN}
              className="w-full"
              data-testid="fqn-list-select"
              maxTagTextLength={45}
              mode="tags"
              optionFilterProp="label"
              placeholder={t('label.search-by-type', {
                type: t('label.fqn-uppercase'),
              })}
              showArrow={false}
            />
          </Form.Item>
        </Col>
      );

      break;

    case 'domainList':
      field = (
        <Col key="domain-select" span={12}>
          <Form.Item
            name={[fieldName, 'arguments', index, 'input']}
            rules={[
              {
                required: true,
                message: t('message.field-text-is-required', {
                  fieldText: t('label.entity-list', {
                    entity: t('label.domain'),
                  }),
                }),
              },
            ]}>
            <AsyncSelect
              api={getDomainOptions}
              className="w-full"
              data-testid="domain-select"
              mode="multiple"
              placeholder={t('label.search-by-type', {
                type: t('label.domain-lowercase'),
              })}
            />
          </Form.Item>
        </Col>
      );

      break;

    case 'tableNameList':
      field = (
        <Col key="table-name-select" span={12}>
          <Form.Item
            name={[fieldName, 'arguments', index, 'input']}
            rules={[
              {
                required: true,
                message: t('message.field-text-is-required', {
                  fieldText: t('label.entity-list', {
                    entity: t('label.entity-name', {
                      entity: t('label.table'),
                    }),
                  }),
                }),
              },
            ]}>
            <AsyncSelect
              api={getTableSuggestions}
              className="w-full"
              data-testid="table-name-select"
              maxTagTextLength={45}
              mode="tags"
              optionFilterProp="label"
              placeholder={t('label.search-by-type', {
                type: t('label.table-lowercase'),
              })}
            />
          </Form.Item>
        </Col>
      );

      break;

    case 'ownerNameList':
      field = (
        <Col key="owner-select" span={12}>
          <Form.Item
            name={[fieldName, 'arguments', index, 'input']}
            rules={[
              {
                required: true,
                message: t('message.field-text-is-required', {
                  fieldText: t('label.entity-list', {
                    entity: t('label.entity-name', {
                      entity: t('label.owner'),
                    }),
                  }),
                }),
              },
            ]}>
            <AsyncSelect
              api={getOwnerOptions}
              className="w-full"
              data-testid="owner-name-select"
              mode="multiple"
              placeholder={t('label.search-by-type', {
                type: t('label.owner-lowercase'),
              })}
            />
          </Form.Item>
        </Col>
      );

      break;

    case 'updateByUserList':
      field = (
        <Col key="user-select" span={12}>
          <Form.Item
            name={[fieldName, 'arguments', index, 'input']}
            rules={[
              {
                required: true,
                message: t('message.field-text-is-required', {
                  fieldText: t('label.entity-list', {
                    entity: t('label.entity-name', {
                      entity: t('label.user'),
                    }),
                  }),
                }),
              },
            ]}>
            <AsyncSelect
              api={getUserOptions}
              className="w-full"
              data-testid="user-name-select"
              mode="multiple"
              placeholder={t('label.search-by-type', {
                type: t('label.user'),
              })}
            />
          </Form.Item>
        </Col>
      );

      break;

    case 'eventTypeList':
      field = (
        <Col key="event-type-select" span={12}>
          <Form.Item
            name={[fieldName, 'arguments', index, 'input']}
            rules={[
              {
                required: true,
                message: t('message.field-text-is-required', {
                  fieldText: t('label.entity-list', {
                    entity: t('label.entity-name', {
                      entity: t('label.event'),
                    }),
                  }),
                }),
              },
            ]}>
            <Select
              className="w-full"
              data-testid="event-type-select"
              mode="multiple"
              options={getSelectOptionsFromEnum(EventType)}
              placeholder={t('label.search-by-type', {
                type: t('label.event-type-lowercase'),
              })}
            />
          </Form.Item>
        </Col>
      );

      break;

    case 'entityIdList':
      field = (
        <Col key="entity-id-select" span={12}>
          <Form.Item
            name={[fieldName, 'arguments', index, 'input']}
            rules={[
              {
                required: true,
                message: t('message.field-text-is-required', {
                  fieldText: t('label.entity-list', {
                    entity: t('label.entity-id', {
                      entity: t('label.data-asset'),
                    }),
                  }),
                }),
              },
            ]}>
            <Select
              className="w-full"
              data-testid="entity-id-select"
              mode="tags"
              open={false}
              placeholder={t('label.search-by-type', {
                type: t('label.entity-id', {
                  entity: t('label.data-asset'),
                }),
              })}
            />
          </Form.Item>
        </Col>
      );

      break;

    case 'pipelineStateList':
      field = (
        <Col key="pipeline-state-select" span={12}>
          <Form.Item
            name={[fieldName, 'arguments', index, 'input']}
            rules={[
              {
                required: true,
                message: t('message.field-text-is-required', {
                  fieldText: t('label.entity-list', {
                    entity: t('label.pipeline-state'),
                  }),
                }),
              },
            ]}>
            <Select
              className="w-full"
              data-testid="pipeline-status-select"
              mode="multiple"
              options={getSelectOptionsFromEnum(StatusType)}
              placeholder={t('label.select-field', {
                field: t('label.pipeline-state'),
              })}
            />
          </Form.Item>
        </Col>
      );

      break;

    case 'ingestionPipelineStateList':
      field = (
        <Col key="pipeline-state-select" span={11}>
          <Form.Item
            name={[fieldName, 'arguments', index, 'input']}
            rules={[
              {
                required: true,
                message: t('message.field-text-is-required', {
                  fieldText: t('label.entity-list', {
                    entity: t('label.pipeline-state'),
                  }),
                }),
              },
            ]}>
            <Select
              className="w-full"
              data-testid="pipeline-status-select"
              mode="multiple"
              options={getSelectOptionsFromEnum(PipelineState)}
              placeholder={t('label.select-field', {
                field: t('label.pipeline-state'),
              })}
            />
          </Form.Item>
        </Col>
      );

      break;

    case 'testStatusList':
      field = (
        <Col key="test-status-select" span={12}>
          <Form.Item
            name={[fieldName, 'arguments', index, 'input']}
            rules={[
              {
                required: true,
                message: t('message.field-text-is-required', {
                  fieldText: t('label.entity-list', {
                    entity: t('label.test-suite-status'),
                  }),
                }),
              },
            ]}>
            <Select
              className="w-full"
              data-testid="test-status-select"
              mode="multiple"
              options={getSelectOptionsFromEnum(TestCaseStatus)}
              placeholder={t('label.select-field', {
                field: t('label.test-suite-status'),
              })}
            />
          </Form.Item>
        </Col>
      );

      break;

    case 'testResultList':
      field = (
        <Col key="test-result-select" span={12}>
          <Form.Item
            name={[fieldName, 'arguments', index, 'input']}
            rules={[
              {
                required: true,
                message: t('message.field-text-is-required', {
                  fieldText: t('label.entity-list', {
                    entity: t('label.test-case-result'),
                  }),
                }),
              },
            ]}>
            <Select
              className="w-full"
              data-testid="test-result-select"
              mode="multiple"
              options={getSelectOptionsFromEnum(TestCaseStatus)}
              placeholder={t('label.select-field', {
                field: t('label.test-case-result'),
              })}
            />
          </Form.Item>
        </Col>
      );

      break;

    case 'testSuiteList':
      field = (
        <Col key="test-suite-select" span={12}>
          <Form.Item
            name={[fieldName, 'arguments', index, 'input']}
            rules={[
              {
                required: true,
                message: t('message.field-text-is-required', {
                  fieldText: t('label.entity-list', {
                    entity: t('label.test-suite'),
                  }),
                }),
              },
            ]}>
            <AsyncSelect
              api={getTestSuiteSuggestions}
              className="w-full"
              data-testid="test-suite-select"
              mode="multiple"
              placeholder={t('label.search-by-type', {
                type: t('label.test-suite'),
              })}
            />
          </Form.Item>
        </Col>
      );

      break;
    default:
      field = <></>;
  }

  return (
    <>
      {field}
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
  supportedActions?: EventFilterRule[]
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
        return getFieldByArgumentType(name, argument, index, selectedTrigger);
      })}
    </>
  );
};

export const handleAlertSave = async ({
  data,
  fqn,
  createAlertAPI,
  updateAlertAPI,
  afterSaveAction,
}: {
  data: CreateEventSubscription;
  createAlertAPI: (
    alert: CreateEventSubscription
  ) => Promise<EventSubscription>;
  updateAlertAPI: (
    alert: CreateEventSubscription
  ) => Promise<EventSubscription>;
  afterSaveAction: () => void;
  fqn?: string;
}) => {
  try {
    const destinations = data.destinations?.map((d) => ({
      type: d.type,
      config: d.config,
      category: d.category,
    }));

    if (fqn && !isUndefined(alert)) {
      const {
        alertType,
        description,
        displayName,
        enabled,
        input,
        name,
        owner,
        provider,
        resources,
        trigger,
      } = data;

      const newData = {
        alertType,
        description,
        destinations,
        displayName,
        enabled,
        input,
        name,
        owner,
        provider,
        resources,
        trigger,
      };

      await updateAlertAPI(newData);
    } else {
      await createAlertAPI({
        ...data,
        destinations,
      });
    }

    showSuccessToast(
      t(`server.${'create'}-entity-success`, {
        entity: t('label.alert-plural'),
      })
    );
    afterSaveAction();
  } catch (error) {
    if ((error as AxiosError).response?.status === HTTP_STATUS_CODE.CONFLICT) {
      showErrorToast(
        t('server.entity-already-exist', {
          entity: t('label.alert'),
          entityPlural: t('label.alert-lowercase-plural'),
          name: data.name,
        })
      );
    } else {
      showErrorToast(
        error as AxiosError,
        t(`server.${'entity-creation-error'}`, {
          entity: t('label.alert-lowercase'),
        })
      );
    }
  }
};

export const getFilteredDestinationOptions = (
  key: keyof typeof DESTINATION_SOURCE_ITEMS,
  selectedSource: string
) => {
  // Get options based on destination type key ("Internal" OR "External").
  const newOptions = DESTINATION_SOURCE_ITEMS[key];

  const isInternalOptions = isEqual(key, DESTINATION_DROPDOWN_TABS.internal);

  // Logic to filter the options based on destination type and selected source.
  const filteredOptions = newOptions.filter((option) => {
    // If the destination type is external, always show all options.
    if (!isInternalOptions) {
      return true;
    }

    // Logic to filter options for destination type "Internal"

    // Show all options except "Assignees" for all sources.
    let shouldShowOption = option.value !== SubscriptionCategory.Assignees;

    // Only show "Owners" and "Assignees" options for "Task" source.
    if (selectedSource === 'task') {
      shouldShowOption = [
        SubscriptionCategory.Owners,
        SubscriptionCategory.Assignees,
      ].includes(option.value as SubscriptionCategory);
    }

    return shouldShowOption;
  });

  return filteredOptions;
};
