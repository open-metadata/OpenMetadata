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
  CloseOutlined,
  ExclamationCircleOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import {
  AlertProps,
  Button,
  Checkbox,
  Col,
  Collapse,
  Divider,
  Input,
  MenuProps,
  Radio,
  Row,
  Select,
  Skeleton,
  Switch,
  Tooltip,
  Typography,
} from 'antd';
import Form, { RuleObject } from 'antd/lib/form';
import { AxiosError } from 'axios';
import cryptoRandomString from 'crypto-random-string-with-promisify-polyfill';
import { compare, Operation } from 'fast-json-patch';
import {
  isEmpty,
  isEqual,
  isUndefined,
  map,
  omitBy,
  startCase,
  trim,
  uniqBy,
} from 'lodash';
import { Fragment } from 'react';
import { ReactComponent as AlertIcon } from '../../assets/svg/alert.svg';
import { ReactComponent as AllActivityIcon } from '../../assets/svg/all-activity.svg';
import { ReactComponent as ClockIcon } from '../../assets/svg/clock.svg';
import { ReactComponent as ConfigIcon } from '../../assets/svg/configuration-icon.svg';
import { ReactComponent as CheckIcon } from '../../assets/svg/ic-check.svg';
import { ReactComponent as MailIcon } from '../../assets/svg/ic-mail.svg';
import { ReactComponent as MSTeamsIcon } from '../../assets/svg/ms-teams.svg';
import { ReactComponent as SlackIcon } from '../../assets/svg/slack.svg';
import { ReactComponent as WebhookIcon } from '../../assets/svg/webhook.svg';
import { AlertEventDetailsToDisplay } from '../../components/Alerts/AlertDetails/AlertRecentEventsTab/AlertRecentEventsTab.interface';
import TeamAndUserSelectItem from '../../components/Alerts/DestinationFormItem/TeamAndUserSelectItem/TeamAndUserSelectItem';
import { AsyncSelect } from '../../components/common/AsyncSelect/AsyncSelect';
import { InlineAlertProps } from '../../components/common/InlineAlert/InlineAlert.interface';
import {
  DEFAULT_READ_TIMEOUT,
  DESTINATION_DROPDOWN_TABS,
  DESTINATION_SOURCE_ITEMS,
  DESTINATION_TYPE_BASED_PLACEHOLDERS,
  EXTERNAL_CATEGORY_OPTIONS,
} from '../../constants/Alerts.constants';
import { PAGE_SIZE_LARGE } from '../../constants/constants';
import { OPEN_METADATA } from '../../constants/Services.constant';
import { AlertRecentEventFilters } from '../../enums/Alerts.enum';
import { EntityType } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import { StatusType } from '../../generated/entity/data/pipeline';
import { PipelineState } from '../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { User } from '../../generated/entity/teams/user';
import { CreateEventSubscription } from '../../generated/events/api/createEventSubscription';
import { EventsRecord } from '../../generated/events/api/eventsRecord';
import { EventSubscriptionDiagnosticInfo } from '../../generated/events/api/eventSubscriptionDiagnosticInfo';
import {
  ChangeEvent,
  Status,
  TypedEvent,
} from '../../generated/events/api/typedEvent';
import {
  EventFilterRule,
  EventSubscription,
  HTTPMethod,
  InputType,
  SubscriptionCategory,
  SubscriptionType,
  Webhook,
} from '../../generated/events/eventSubscription';
import { Status as DestinationStatus } from '../../generated/events/testDestinationStatus';
import { TestCaseStatus } from '../../generated/tests/testCase';
import { EventType } from '../../generated/type/changeEvent';
import {
  ModifiedCreateEventSubscription,
  ModifiedDestination,
  ModifiedEventSubscription,
} from '../../pages/AddObservabilityPage/AddObservabilityPage.interface';
import { searchData } from '../../rest/miscAPI';
import { ExtraInfoLabel } from '../DataAssetsHeader.utils';
import { getEntityName, getEntityNameLabel } from '../EntityUtils';
import { handleEntityCreationError } from '../formUtils';
import { t } from '../i18next/LocalUtil';
import { getConfigFieldFromDestinationType } from '../ObservabilityUtils';
import searchClassBase from '../SearchClassBase';
import { showErrorToast, showSuccessToast } from '../ToastUtils';
import './alerts-util.less';

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
  <T,>(name: string, minLengthRequired = 1) =>
  async (_: RuleObject, list: T[]) => {
    if (!list || list.length < minLengthRequired) {
      return Promise.reject(
        new Error(
          t('message.length-validator-error', {
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

export const EDIT_LINK_PATH = `/settings/notifications/edit-alert`;

export const searchEntity = async ({
  searchText,
  searchIndex,
  filters,
  showDisplayNameAsLabel = true,
  setSourceAsValue = false,
}: {
  searchText: string;
  searchIndex: SearchIndex | SearchIndex[];
  filters?: string;
  showDisplayNameAsLabel?: boolean;
  setSourceAsValue?: boolean;
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
    const searchIndexEntityTypeMapping =
      searchClassBase.getSearchIndexEntityTypeMapping();

    return uniqBy(
      response.data.hits.hits.map((d) => {
        // Providing an option to hide display names, for inputs like 'fqnList',
        // where users can input text alongside selection options.
        // This helps avoid displaying the same option twice
        // when using regular expressions as inputs in the same field.
        const displayName = showDisplayNameAsLabel
          ? getEntityName(d._source)
          : d._source.fullyQualifiedName ?? '';

        const value = setSourceAsValue
          ? JSON.stringify({
              ...d._source,
              type: searchIndexEntityTypeMapping[d._index],
            })
          : d._source.fullyQualifiedName ?? '';

        return {
          label: displayName,
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

const getUserBotOptions = async (searchText: string) => {
  return searchEntity({
    searchText,
    searchIndex: SearchIndex.USER,
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

export const getConnectionTimeoutField = () => (
  <Row align="middle">
    <Col span={7}>{`${t('label.connection-timeout')} (${t(
      'label.second-plural'
    )})`}</Col>
    <Col span={1}>:</Col>
    <Col data-testid="connection-timeout" span={16}>
      <Form.Item name="timeout">
        <Input
          data-testid="connection-timeout-input"
          defaultValue={10}
          placeholder={`${t('label.connection-timeout')} (${t(
            'label.second-plural'
          )})`}
          type="number"
        />
      </Form.Item>
    </Col>
  </Row>
);

export const getReadTimeoutField = () => (
  <>
    <Row align="middle" className="mt-4">
      <Col span={7}>{`${t('label.read-type', {
        type: t('label.timeout'),
      })} (${t('label.second-plural')})`}</Col>
      <Col span={1}>:</Col>
      <Col data-testid="read-timeout" span={16}>
        <Form.Item name="readTimeout">
          <Input
            data-testid="read-timeout-input"
            defaultValue={DEFAULT_READ_TIMEOUT}
            placeholder={`${t('label.read-type', {
              type: t('label.timeout'),
            })} (${t('label.second-plural')})`}
            type="number"
          />
        </Form.Item>
      </Col>
    </Row>
    <Divider className="p-x-xs" />
  </>
);

export const getDestinationConfigField = (
  type: SubscriptionType | SubscriptionCategory,
  fieldName: number
) => {
  switch (type) {
    case SubscriptionType.Slack:
    case SubscriptionType.MSTeams:
    case SubscriptionType.GChat:
    case SubscriptionType.Webhook:
      return (
        <>
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
          {type === SubscriptionType.Webhook && (
            <Col span={24}>
              <Collapse
                className="webhook-config-collapse"
                expandIconPosition="end">
                <Collapse.Panel
                  header={
                    <Row align="middle" gutter={[8, 8]}>
                      <Col>
                        <ConfigIcon className="configuration-icon" />
                      </Col>
                      <Col>
                        <Typography.Text>
                          {t('label.advanced-configuration')}
                        </Typography.Text>
                      </Col>
                    </Row>
                  }
                  key={`advanced-configuration-${fieldName}`}>
                  <Row align="middle" gutter={[8, 8]}>
                    <Col data-testid="secret-key" span={24}>
                      <Form.Item
                        label={
                          <Typography.Text>{`${t(
                            'label.secret-key'
                          )}:`}</Typography.Text>
                        }
                        labelCol={{ span: 24 }}
                        name={[fieldName, 'config', 'secretKey']}>
                        <Input.Password
                          data-testid={`secret-key-input-${fieldName}`}
                          placeholder={`${t('label.secret-key')} (${t(
                            'label.optional'
                          )})`}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={24}>
                      <Form.List name={[fieldName, 'config', 'headers']}>
                        {(fields, { add, remove }, { errors }) => (
                          <Row
                            data-testid={`webhook-${fieldName}-headers-list`}
                            gutter={[8, 8]}
                            key="headers">
                            <Col span={24}>
                              <Row align="middle" justify="space-between">
                                <Col>
                                  <Typography.Text>
                                    {`${t('label.header-plural')}:`}
                                  </Typography.Text>
                                </Col>
                                <Col>
                                  <Col>
                                    <Button
                                      icon={<PlusOutlined />}
                                      type="primary"
                                      onClick={() => add({})}
                                    />
                                  </Col>
                                </Col>
                              </Row>
                            </Col>
                            {fields.map(({ key, name }) => (
                              <Col key={key} span={24}>
                                <div className="flex gap-4">
                                  <div className="flex-1 w-min-0">
                                    <Row gutter={[8, 8]}>
                                      <Col span={12}>
                                        <Form.Item
                                          required
                                          name={[name, 'key']}
                                          rules={[
                                            {
                                              required: true,
                                              message: t(
                                                'message.field-text-is-required',
                                                {
                                                  fieldText: t('label.key'),
                                                }
                                              ),
                                            },
                                          ]}>
                                          <Input
                                            data-testid={`header-key-input-${name}`}
                                            placeholder={t('label.key')}
                                          />
                                        </Form.Item>
                                      </Col>
                                      <Col span={12}>
                                        <Form.Item
                                          required
                                          name={[name, 'value']}
                                          rules={[
                                            {
                                              required: true,
                                              message: t(
                                                'message.field-text-is-required',
                                                {
                                                  fieldText: t('label.value'),
                                                }
                                              ),
                                            },
                                          ]}>
                                          <Input
                                            data-testid={`header-value-input-${name}`}
                                            placeholder={t('label.value')}
                                          />
                                        </Form.Item>
                                      </Col>
                                    </Row>
                                  </div>

                                  <Button
                                    icon={<CloseOutlined />}
                                    onClick={() => remove(name)}
                                  />
                                </div>
                              </Col>
                            ))}

                            <Col span={24}>
                              <Form.ErrorList errors={errors} />
                            </Col>
                          </Row>
                        )}
                      </Form.List>
                    </Col>
                    <Col data-testid="http-method" span={24}>
                      <Form.Item
                        label={
                          <Typography.Text>{`${t(
                            'label.http-method'
                          )}:`}</Typography.Text>
                        }
                        labelCol={{ span: 24 }}
                        name={[fieldName, 'config', 'httpMethod']}>
                        <Radio.Group
                          data-testid={`http-method-${fieldName}`}
                          defaultValue={HTTPMethod.Post}
                          options={[
                            { label: HTTPMethod.Post, value: HTTPMethod.Post },
                            { label: HTTPMethod.Put, value: HTTPMethod.Put },
                          ]}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                </Collapse.Panel>
              </Collapse>
            </Col>
          )}
        </>
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
      );

      break;

    case 'domainList':
      field = (
        <AsyncSelect
          api={getDomainOptions}
          className="w-full"
          data-testid="domain-select"
          mode="multiple"
          placeholder={t('label.search-by-type', {
            type: t('label.domain-lowercase'),
          })}
        />
      );

      break;

    case 'tableNameList':
      field = (
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
      );

      break;

    case 'ownerNameList':
      field = (
        <AsyncSelect
          api={getOwnerOptions}
          className="w-full"
          data-testid="owner-name-select"
          mode="multiple"
          placeholder={t('label.search-by-type', {
            type: t('label.owner-lowercase-plural'),
          })}
        />
      );

      break;

    case 'updateByUserList':
    case 'userList':
      field = (
        <AsyncSelect
          api={
            argument === 'updateByUserList'
              ? getUserBotOptions // For updateByUserList, we need to show bot users as well
              : getUserOptions // For userList, which is an argument for `conversation` filters we need to show only non-bot users
          }
          className="w-full"
          data-testid="user-name-select"
          mode="multiple"
          placeholder={t('label.search-by-type', {
            type: t('label.user'),
          })}
        />
      );

      break;

    case 'eventTypeList':
      field = (
        <Select
          className="w-full"
          data-testid="event-type-select"
          mode="multiple"
          options={getSelectOptionsFromEnum(EventType)}
          placeholder={t('label.search-by-type', {
            type: t('label.event-type-lowercase'),
          })}
        />
      );

      break;

    case 'entityIdList':
      field = (
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
      );

      break;

    case 'pipelineStateList':
      field = (
        <Select
          className="w-full"
          data-testid="pipeline-status-select"
          mode="multiple"
          options={getSelectOptionsFromEnum(StatusType)}
          placeholder={t('label.select-field', {
            field: t('label.pipeline-state'),
          })}
        />
      );

      break;

    case 'ingestionPipelineStateList':
      field = (
        <Select
          className="w-full"
          data-testid="pipeline-status-select"
          mode="multiple"
          options={getSelectOptionsFromEnum(PipelineState)}
          placeholder={t('label.select-field', {
            field: t('label.pipeline-state'),
          })}
        />
      );

      break;

    case 'testStatusList':
      field = (
        <Select
          className="w-full"
          data-testid="test-status-select"
          mode="multiple"
          options={getSelectOptionsFromEnum(TestCaseStatus)}
          placeholder={t('label.select-field', {
            field: t('label.test-suite-status'),
          })}
        />
      );

      break;

    case 'testResultList':
      field = (
        <Select
          className="w-full"
          data-testid="test-result-select"
          mode="multiple"
          options={getSelectOptionsFromEnum(TestCaseStatus)}
          placeholder={t('label.select-field', {
            field: t('label.test-case-result'),
          })}
        />
      );

      break;

    case 'testSuiteList':
      field = (
        <AsyncSelect
          api={getTestSuiteSuggestions}
          className="w-full"
          data-testid="test-suite-select"
          mode="multiple"
          placeholder={t('label.search-by-type', {
            type: t('label.test-suite'),
          })}
        />
      );

      break;
    default:
      field = <></>;
  }

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

export const getRandomizedAlertName = () => {
  return `${OPEN_METADATA}_alert_${cryptoRandomString({
    length: 9,
    type: 'alphanumeric',
  })}`;
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

export const getFormattedDestinations = (
  destinations?: ModifiedDestination[]
) => {
  const formattedDestinations = destinations?.map((destination) => {
    const { destinationType, config, ...otherData } = destination;

    const headers = getConfigHeaderObjectFromArray(config?.headers);

    return {
      ...otherData,
      config: {
        ...config,
        headers: isEmpty(headers) ? undefined : headers,
      },
    };
  });

  return formattedDestinations;
};

export const handleAlertSave = async ({
  data,
  fqn,
  initialData,
  createAlertAPI,
  updateAlertAPI,
  afterSaveAction,
  setInlineAlertDetails,
  currentUser,
}: {
  initialData?: EventSubscription;
  data: ModifiedCreateEventSubscription;
  createAlertAPI: (
    alert: CreateEventSubscription
  ) => Promise<EventSubscription>;
  updateAlertAPI: (id: string, data: Operation[]) => Promise<EventSubscription>;
  afterSaveAction: (fqn: string) => Promise<void>;
  setInlineAlertDetails: (alertDetails?: InlineAlertProps | undefined) => void;
  fqn?: string;
  currentUser?: User;
}) => {
  try {
    const destinations = data.destinations?.map((d) => {
      const initialDestination = initialData?.destinations?.find(
        (destination) => destination.type === d.type
      );

      return {
        ...(initialDestination ?? {}),
        type: d.type,
        config: {
          ...d.config,
          headers: getConfigHeaderObjectFromArray(d.config?.headers),
        },
        category: d.category,
        timeout: data.timeout,
        readTimeout: data.readTimeout,
      };
    });
    let alertDetails;
    const alertName = trim(initialData?.name ?? getRandomizedAlertName());
    const alertDisplayName = trim(getEntityName(data));

    if (fqn && !isUndefined(initialData)) {
      const { description, input, owners, resources } = data;

      const newAlertData: EventSubscription = {
        ...initialData,
        description,
        displayName: alertDisplayName,
        name: alertName,
        input: {
          actions: input?.actions ?? [],
          filters: input?.filters ?? [],
        },
        owners,
        filteringRules: {
          ...initialData.filteringRules,
          resources: resources ?? [],
        },
        destinations: destinations ?? [],
      };

      const jsonPatch = compare(omitBy(initialData, isUndefined), newAlertData);

      alertDetails = await updateAlertAPI(initialData.id, jsonPatch);
    } else {
      // Remove timeout from alert object since it's only for UI
      const { timeout, readTimeout, ...finalData } = data;

      alertDetails = await createAlertAPI({
        ...finalData,
        destinations,
        name: alertName,
        displayName: alertDisplayName,
        ...(currentUser?.id
          ? {
              owners: [
                {
                  id: currentUser.id,
                  type: EntityType.USER,
                },
              ],
            }
          : {}),
      });
    }

    showSuccessToast(
      t(`server.${'create'}-entity-success`, {
        entity: t('label.alert-plural'),
      })
    );
    afterSaveAction(alertDetails.fullyQualifiedName ?? '');
  } catch (error) {
    handleEntityCreationError({
      error: error as AxiosError,
      entity: t('label.alert'),
      entityLowercase: t('label.alert-lowercase'),
      entityLowercasePlural: t('label.alert-lowercase-plural'),
      setInlineAlertDetails,
      name: data.name,
      defaultErrorType: 'create',
    });
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

    // Show all options except "Assignees" and "Mentions" for all sources.
    let shouldShowOption =
      option.value !== SubscriptionCategory.Assignees &&
      option.value !== SubscriptionCategory.Mentions;

    // Only show "Owners" and "Assignees" options for "Task" source.
    if (selectedSource === 'task') {
      shouldShowOption = [
        SubscriptionCategory.Owners,
        SubscriptionCategory.Assignees,
      ].includes(option.value as SubscriptionCategory);
    }

    // Only show "Owners" and "Mentions" options for "Conversation" source.
    if (selectedSource === 'conversation') {
      shouldShowOption = [
        SubscriptionCategory.Owners,
        SubscriptionCategory.Mentions,
      ].includes(option.value as SubscriptionCategory);
    }

    return shouldShowOption;
  });

  return filteredOptions;
};

export const getSourceOptionsFromResourceList = (
  resources: Array<string>,
  showCheckbox?: boolean,
  selectedResource?: string[],
  showIcon?: boolean
) =>
  resources.map((resource) => {
    const sourceIcon = searchClassBase.getEntityIcon(resource ?? '');

    return {
      label: (
        <div
          className="d-flex items-center gap-2"
          data-testid={`${resource}-option`}>
          {showCheckbox && (
            <Checkbox checked={selectedResource?.includes(resource)} />
          )}
          {sourceIcon && showIcon && (
            <div className="d-flex h-4 w-4">{sourceIcon}</div>
          )}
          <span>{getEntityNameLabel(resource ?? '')}</span>
        </div>
      ),
      value: resource ?? '',
    };
  });

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

export const getAlertExtraInfo = (
  alertEventCountsLoading: boolean,
  alertEventCounts?: EventsRecord
) => {
  if (alertEventCountsLoading) {
    return (
      <>
        {Array(3)
          .fill(null)
          .map((_, id) => (
            <Fragment key={id}>
              <Divider className="self-center" type="vertical" />
              <Skeleton.Button active className="extra-info-skeleton" />
            </Fragment>
          ))}
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

export const getModifiedAlertDataForForm = (
  alertData: EventSubscription
): ModifiedEventSubscription => {
  return {
    ...alertData,
    timeout: alertData.destinations[0].timeout ?? 10,
    readTimeout: alertData.destinations[0].readTimeout ?? DEFAULT_READ_TIMEOUT,
    destinations: alertData.destinations.map((destination) => {
      const isExternalDestination =
        destination.category === SubscriptionCategory.External;

      return {
        ...destination,
        destinationType: isExternalDestination
          ? destination.type
          : destination.category,
        config: {
          ...destination.config,
          headers: getConfigHeaderArrayFromObject(destination.config?.headers),
        },
      };
    }),
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
