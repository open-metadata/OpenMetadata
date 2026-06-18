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
import Form from 'antd/lib/form';
import { AxiosError } from 'axios';
import { uniqBy } from 'lodash';
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
import TeamAndUserSelectItem from '../../components/Alerts/DestinationFormItem/TeamAndUserSelectItem/TeamAndUserSelectItem';
import FQNListSelect from '../../components/Alerts/FQNListSelect/FQNListSelect.component';
import { AsyncSelect } from '../../components/common/AsyncSelect/AsyncSelect';
import {
  DATA_CONTRACT_STATUS_OPTIONS,
  DEFAULT_READ_TIMEOUT,
  DESTINATION_TYPE_BASED_PLACEHOLDERS,
} from '../../constants/Alerts.constants';
import { PAGE_SIZE_LARGE } from '../../constants/constants';
import { UUID_REGEX } from '../../constants/regex.constants';
import { AlertRecentEventFilters } from '../../enums/Alerts.enum';
import { SearchIndex } from '../../enums/search.enum';
import { StatusType } from '../../generated/entity/data/pipeline';
import { PipelineState } from '../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { EventsRecord } from '../../generated/events/api/eventsRecord';
import { Status } from '../../generated/events/api/typedEvent';
import {
  EventFilterRule,
  HTTPMethod,
  InputType,
  SubscriptionCategory,
  SubscriptionType,
  Type,
} from '../../generated/events/eventSubscription';
import { Status as DestinationStatus } from '../../generated/events/testDestinationStatus';
import { TestCaseStatus } from '../../generated/tests/testCase';
import { EventType } from '../../generated/type/changeEvent';
import { searchQuery } from '../../rest/searchAPI';
import { ExtraInfoLabel } from '../DataAssetsHeader.utils';
import { getEntityName, getEntityNameLabel } from '../EntityNameUtils';
import { t } from '../i18next/LocalUtil';
import { getConfigFieldFromDestinationType } from '../ObservabilityUtils';
import searchClassBase from '../SearchClassBase';
import { getTermQuery } from '../SearchPureUtils';
import { showErrorToast } from '../ToastUtils';
import './alerts-util.less';
import {
  getAlertEventsFilterLabels,
  getMessageFromArgumentName,
  getSelectOptionsFromEnum,
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

const getTeamOptions = async (searchText: string) => {
  return searchEntity({ searchText, searchIndex: SearchIndex.TEAM });
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
          {(type === SubscriptionType.Webhook ||
            type === SubscriptionType.Slack ||
            type === SubscriptionType.MSTeams ||
            type === SubscriptionType.GChat) && (
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
                    <Col data-testid="auth-type" span={24}>
                      <Form.Item
                        label={
                          <Typography.Text>{`${t(
                            'label.authentication-type'
                          )}:`}</Typography.Text>
                        }
                        labelCol={{ span: 24 }}
                        name={[fieldName, 'config', 'authType', 'type']}>
                        <Select
                          className="w-full"
                          data-testid={`auth-type-select-${fieldName}`}
                          options={[
                            {
                              label: t('label.no-authentication'),
                              value: Type.None,
                            },
                            {
                              label: t('label.bearer-hmac-signature'),
                              value: Type.Bearer,
                            },
                            {
                              label: t('label.oauth2-client-credential-plural'),
                              value: Type.Oauth2,
                            },
                          ]}
                          placeholder={t('label.authentication-type')}
                        />
                      </Form.Item>
                    </Col>
                    <Form.Item
                      noStyle
                      shouldUpdate={(prevValues, currentValues) => {
                        const prevType =
                          prevValues?.destinations?.[fieldName]?.config
                            ?.authType?.type;
                        const currentType =
                          currentValues?.destinations?.[fieldName]?.config
                            ?.authType?.type;

                        return prevType !== currentType;
                      }}>
                      {({ getFieldValue }) => {
                        const selectedAuthType = getFieldValue([
                          'destinations',
                          fieldName,
                          'config',
                          'authType',
                          'type',
                        ]);

                        if (selectedAuthType === Type.Bearer) {
                          return (
                            <Col data-testid="secret-key" span={24}>
                              <Form.Item
                                label={
                                  <Typography.Text>{`${t(
                                    'label.secret-key'
                                  )}:`}</Typography.Text>
                                }
                                labelCol={{ span: 24 }}
                                name={[
                                  fieldName,
                                  'config',
                                  'authType',
                                  'secretKey',
                                ]}
                                rules={[
                                  {
                                    required: true,
                                    message: t(
                                      'message.field-text-is-required',
                                      {
                                        fieldText: t('label.secret-key'),
                                      }
                                    ),
                                  },
                                ]}>
                                <Input.Password
                                  data-testid={`secret-key-input-${fieldName}`}
                                  placeholder={t('label.secret-key')}
                                />
                              </Form.Item>
                            </Col>
                          );
                        }

                        if (selectedAuthType === Type.Oauth2) {
                          return (
                            <>
                              <Col span={24}>
                                <Form.Item
                                  label={
                                    <Typography.Text>{`${t(
                                      'label.token-url'
                                    )}:`}</Typography.Text>
                                  }
                                  labelCol={{ span: 24 }}
                                  name={[
                                    fieldName,
                                    'config',
                                    'authType',
                                    'tokenUrl',
                                  ]}
                                  rules={[
                                    {
                                      required: true,
                                      message: t(
                                        'message.field-text-is-required',
                                        {
                                          fieldText: t('label.token-url'),
                                        }
                                      ),
                                    },
                                  ]}>
                                  <Input
                                    data-testid={`token-url-input-${fieldName}`}
                                    placeholder="https://auth.example.com/oauth/token"
                                  />
                                </Form.Item>
                              </Col>
                              <Col span={12}>
                                <Form.Item
                                  label={
                                    <Typography.Text>{`${t(
                                      'label.client-id'
                                    )}:`}</Typography.Text>
                                  }
                                  labelCol={{ span: 24 }}
                                  name={[
                                    fieldName,
                                    'config',
                                    'authType',
                                    'clientId',
                                  ]}
                                  rules={[
                                    {
                                      required: true,
                                      message: t(
                                        'message.field-text-is-required',
                                        {
                                          fieldText: t('label.client-id'),
                                        }
                                      ),
                                    },
                                  ]}>
                                  <Input.Password
                                    data-testid={`client-id-input-${fieldName}`}
                                    placeholder={t('label.client-id')}
                                  />
                                </Form.Item>
                              </Col>
                              <Col span={12}>
                                <Form.Item
                                  label={
                                    <Typography.Text>{`${t(
                                      'label.client-secret'
                                    )}:`}</Typography.Text>
                                  }
                                  labelCol={{ span: 24 }}
                                  name={[
                                    fieldName,
                                    'config',
                                    'authType',
                                    'clientSecret',
                                  ]}
                                  rules={[
                                    {
                                      required: true,
                                      message: t(
                                        'message.field-text-is-required',
                                        {
                                          fieldText: t('label.client-secret'),
                                        }
                                      ),
                                    },
                                  ]}>
                                  <Input.Password
                                    data-testid={`client-secret-input-${fieldName}`}
                                    placeholder={t('label.client-secret')}
                                  />
                                </Form.Item>
                              </Col>
                              <Col span={24}>
                                <Form.Item
                                  label={
                                    <Typography.Text>{`${t(
                                      'label.scope'
                                    )}:`}</Typography.Text>
                                  }
                                  labelCol={{ span: 24 }}
                                  name={[
                                    fieldName,
                                    'config',
                                    'authType',
                                    'scope',
                                  ]}>
                                  <Input
                                    data-testid={`scope-input-${fieldName}`}
                                    placeholder={`${t('label.scope')} (${t(
                                      'label.optional'
                                    )})`}
                                  />
                                </Form.Item>
                              </Col>
                            </>
                          );
                        }

                        return null;
                      }}
                    </Form.Item>
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
                                      data-testid={`add-header-button-${fieldName}`}
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
                    <Col span={24}>
                      <Form.List name={[fieldName, 'config', 'queryParams']}>
                        {(fields, { add, remove }, { errors }) => (
                          <Row
                            data-testid={`webhook-${fieldName}-query-params-list`}
                            gutter={[8, 8]}
                            key="queryParams">
                            <Col span={24}>
                              <Row align="middle" justify="space-between">
                                <Col>
                                  <Typography.Text>
                                    {`${t('label.query-parameter-plural')}:`}
                                  </Typography.Text>
                                </Col>
                                <Col>
                                  <Col>
                                    <Button
                                      data-testid={`add-query-param-button-${fieldName}`}
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
                                            data-testid={`query-param-key-input-${name}`}
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
                                            data-testid={`query-param-value-input-${name}`}
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

export const getFieldByArgumentType = (
  fieldName: number,
  argument: string,
  index: number,
  selectedTrigger: string,
  containerEntities: string[] = []
) => {
  let field: JSX.Element;

  const getEntityByFQN = async (searchText: string) => {
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

  switch (argument) {
    case 'fqnList':
      field = (
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
          mode="multiple"
          optionFilterProp="label"
          placeholder={t('label.search-by-type', {
            type: t('label.table-lowercase'),
          })}
        />
      );

      break;

    case 'entityNameList':
      field = (
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

    case 'contractStatusList':
      field = (
        <Select
          className="w-full"
          data-testid="contract-status-select"
          mode="multiple"
          options={translatedContractStatusOptions}
          placeholder={t('label.select-field', {
            field: t('label.data-contract-status'),
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
  supportedActions?: EventFilterRule[],
  containerEntities?: string[]
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
          containerEntities
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
        {new Array(3).fill(null).map((_, id) => (
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
