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

import { Col, Input, Select, Switch, Typography } from 'antd';
import Form, { RuleObject } from 'antd/lib/form';
import i18next, { t } from 'i18next';
import { isEqual, map, startCase } from 'lodash';
import React from 'react';
import { ReactComponent as AllActivityIcon } from '../../assets/svg/all-activity.svg';
import { ReactComponent as MailIcon } from '../../assets/svg/ic-mail.svg';
import { ReactComponent as MSTeamsIcon } from '../../assets/svg/ms-teams.svg';
import { ReactComponent as SlackIcon } from '../../assets/svg/slack.svg';
import { ReactComponent as WebhookIcon } from '../../assets/svg/webhook.svg';
import { AsyncSelect } from '../../components/AsyncSelect/AsyncSelect';
import {
  DESTINATION_TYPE_BASED_PLACEHOLDERS,
  EXTERNAL_CATEGORY_OPTIONS,
} from '../../constants/Alerts.constants';
import { PAGE_SIZE_LARGE } from '../../constants/constants';
import { SearchIndex } from '../../enums/search.enum';
import { PipelineState } from '../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import {
  EventFilterRule,
  InputType,
  SubscriptionCategory,
  SubscriptionType,
} from '../../generated/events/eventSubscription';
import { EventType } from '../../generated/type/changeEvent';
import { searchData } from '../../rest/miscAPI';
import { getEntityName } from '../EntityUtils';
import { getConfigFieldFromDestinationType } from '../ObservabilityUtils';
import searchClassBase from '../SearchClassBase';

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

const searchEntity = async (
  search: string,
  searchIndex: SearchIndex | SearchIndex[],
  filters?: string
) => {
  try {
    const response = await searchData(
      search,
      1,
      PAGE_SIZE_LARGE,
      filters ?? '',
      '',
      '',
      searchIndex
    );

    return response.data.hits.hits.map((d) => ({
      label: getEntityName(d._source),
      value: d._source.fullyQualifiedName,
    }));
  } catch (error) {
    return [];
  }
};

const getTableSuggestions = async (searchText: string) => {
  return searchEntity(searchText, SearchIndex.TABLE);
};

const getDomainOptions = async (searchText: string) => {
  return searchEntity(searchText, SearchIndex.DOMAIN);
};

const getOwnerOptions = async (searchText: string) => {
  return searchEntity(
    searchText,
    [SearchIndex.TEAM, SearchIndex.USER],
    'isBot:false'
  );
};

const getUserOptions = async (searchText: string) => {
  return searchEntity(searchText, SearchIndex.USER, 'isBot:false');
};

const getTeamOptions = async (searchText: string) => {
  return searchEntity(searchText, SearchIndex.TEAM);
};

const eventTypeOptions = map(EventType, (eventType) => ({
  label: eventType,
  value: eventType,
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
      <span data-testid={`${getEntityName(func)}-filter-option`}>
        {getEntityName(func)}
      </span>
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
      );
    case SubscriptionType.Email:
      return (
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
      );
    case SubscriptionCategory.Teams:
    case SubscriptionCategory.Users:
      return (
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
          <AsyncSelect
            api={
              type === SubscriptionCategory.Teams
                ? getTeamOptions
                : getUserOptions
            }
            className="w-full"
            data-testid={`${
              type === SubscriptionCategory.Teams
                ? t('label.team')
                : t('label.user')
            }-select`}
            mode="multiple"
            placeholder={t('label.search-by-type', {
              type:
                type === SubscriptionCategory.Teams
                  ? t('label.team-lowercase')
                  : t('label.user-lowercase'),
            })}
          />
        </Form.Item>
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

    return searchEntity(searchText, searchIndexMapping[selectedTrigger]);
  };

  switch (argument) {
    case 'fqnList':
      field = (
        <Col key="fqn-list-select" span={11}>
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
              mode="multiple"
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
        <Col key="domain-select" span={11}>
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
        <Col key="domain-select" span={11}>
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
              mode="multiple"
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
        <Col key="owner-select" span={11}>
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
        <Col key="owner-select" span={11}>
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
        <Col key="event-type-select" span={11}>
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
              options={eventTypeOptions}
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
        <Col key="entity-id-select" span={11}>
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
              options={map(PipelineState, (state) => ({
                label: startCase(state),
                value: state,
              }))}
              placeholder={t('label.select-field', {
                field: t('label.pipeline-state'),
              })}
            />
          </Form.Item>
        </Col>
      );

      break;

    case 'testResultList':
      field = (
        <Col key="test-result-select" span={11}>
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
              options={map(['success', 'aborted', 'failed'], (state) => ({
                label: startCase(state),
                value: state,
              }))}
              placeholder={t('label.select-field', {
                field: t('label.test-case-result'),
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
