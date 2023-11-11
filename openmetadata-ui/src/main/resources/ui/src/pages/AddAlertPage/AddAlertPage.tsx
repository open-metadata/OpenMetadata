/* eslint-disable @typescript-eslint/ban-types */
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
import { PlusOutlined } from '@ant-design/icons';
import {
  Button,
  Checkbox,
  Col,
  Collapse,
  Divider,
  Form,
  Input,
  Row,
  Select,
  Skeleton,
  Space,
  TreeSelect,
  Typography,
} from 'antd';
import { useForm } from 'antd/lib/form/Form';
import { DefaultOptionType } from 'antd/lib/select';
import { AxiosError } from 'axios';
import { intersection, isEmpty, map, startCase, trim } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { AsyncSelect } from '../../components/AsyncSelect/AsyncSelect';
import RichTextEditor from '../../components/common/RichTextEditor/RichTextEditor';
import { HTTP_STATUS_CODE } from '../../constants/auth.constants';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../constants/GlobalSettings.constants';
import { ENTITY_NAME_REGEX } from '../../constants/regex.constants';
import { SubscriptionType } from '../../generated/events/api/createEventSubscription';
import {
  AlertType,
  Effect,
  EventFilterRule,
  EventSubscription,
  FilteringRules,
  ProviderType,
} from '../../generated/events/eventSubscription';
import { SubscriptionResourceDescriptor } from '../../generated/events/subscriptionResourceDescriptor';
import { Function } from '../../generated/type/function';
import {
  createAlert,
  getAlertsFromId,
  getFilterFunctions,
  getResourceFunctions,
  updateAlert,
} from '../../rest/alertsAPI';
import { getSuggestions } from '../../rest/miscAPI';
import {
  getAlertActionTypeDisplayName,
  getAlertsActionTypeIcon,
  getFunctionDisplayName,
  listLengthValidator,
  StyledCard,
} from '../../utils/Alerts/AlertsUtil';
import { getEntityName } from '../../utils/EntityUtils';
import { getSettingPath } from '../../utils/RouterUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { searchFormattedUsersAndTeams } from '../../utils/UserDataUtils';
import './add-alerts-page.styles.less';

const AddAlertPage = () => {
  const { t } = useTranslation();
  const [form] = useForm<EventSubscription>();
  const history = useHistory();
  const { fqn } = useParams<{ fqn: string }>();
  // To block certain action based on provider of the Alert e.g. System / User
  const [provider, setProvider] = useState<ProviderType>(ProviderType.User);

  const [filterFunctions, setFilterFunctions] = useState<Function[]>();
  const [loadingCount, setLoadingCount] = useState(0);
  const [entityFunctions, setEntityFunctions] = useState<
    SubscriptionResourceDescriptor[]
  >([]);
  const [isButtonLoading, setIsButtonLoading] = useState<boolean>(false);
  const [alert, setAlert] = useState<EventSubscription>();

  const fetchAlert = async () => {
    try {
      setLoadingCount((count) => count + 1);

      const response: EventSubscription = await getAlertsFromId(fqn);
      setAlert(response);

      const requestFilteringRules =
        response.filteringRules?.rules?.map(
          (curr) =>
            ({
              ...curr,
              condition: curr.condition
                .replace(new RegExp(`${curr.name}\\('`), '')
                .replaceAll("'", '')
                .replace(new RegExp(`\\)`), '')
                .split(',')
                .map(trim),
            } as unknown as EventFilterRule)
        ) ?? [];

      setProvider(response.provider ?? ProviderType.User);

      form.setFieldsValue({
        ...response,
        filteringRules: {
          ...(response.filteringRules as FilteringRules),
          rules: requestFilteringRules,
        },
      });
    } catch {
      showErrorToast(
        t('server.entity-fetch-error', { entity: t('label.alert') }),
        fqn
      );
    } finally {
      setLoadingCount((count) => count - 1);
    }
  };

  useEffect(() => {
    if (fqn) {
      fetchAlert();
    }
  }, [fqn]);

  const fetchFunctions = async () => {
    try {
      setLoadingCount((count) => count + 1);
      const functions = await getFilterFunctions();
      const entityFunctions = await getResourceFunctions();

      setFilterFunctions(functions);
      setEntityFunctions(entityFunctions.data);
    } finally {
      setLoadingCount((count) => count - 1);
    }
  };

  useEffect(() => {
    fetchFunctions();
  }, []);

  const isEditMode = useMemo(() => !isEmpty(fqn), [fqn]);
  const resourcesOptions = useMemo(() => {
    const resources = entityFunctions.filter(
      (resource) => resource.name !== 'all'
    );
    const option = [
      {
        title: 'All',
        value: 'all',
        key: 'all',
        children: resources.map((resource) => ({
          title: startCase(resource.name),
          value: resource.name,
          key: resource.name,
        })),
      },
    ];

    return option;
  }, [entityFunctions]);

  const handleSave = async (data: EventSubscription) => {
    setIsButtonLoading(true);
    const { filteringRules } = data;

    const api = isEditMode ? updateAlert : createAlert;

    const requestFilteringRules = filteringRules?.rules?.map((curr) => ({
      ...curr,
      condition: `${curr.name}(${map(
        curr.condition,
        (v: string) => `'${v}'`
      )?.join(', ')})`,
    }));

    try {
      await api({
        ...data,
        filteringRules: {
          ...(filteringRules as FilteringRules),
          rules: requestFilteringRules,
        },
        alertType: AlertType.ChangeEvent,
        provider,
      });

      showSuccessToast(
        t(`server.${isEditMode ? 'update' : 'create'}-entity-success`, {
          entity: t('label.alert-plural'),
        })
      );
      history.push(
        getSettingPath(
          GlobalSettingsMenuCategory.NOTIFICATIONS,
          // We need this check to have correct redirection after updating the subscription
          alert?.name === 'ActivityFeedAlert'
            ? GlobalSettingOptions.ACTIVITY_FEED
            : GlobalSettingOptions.ALERTS
        )
      );
    } catch (error) {
      if (
        (error as AxiosError).response?.status === HTTP_STATUS_CODE.CONFLICT
      ) {
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
          t(
            `server.${
              isEditMode ? 'entity-updating-error' : 'entity-creation-error'
            }`,
            {
              entity: t('label.alert-lowercase'),
            }
          )
        );
      }
    } finally {
      setIsButtonLoading(false);
    }
  };

  const getUsersAndTeamsOptions = useCallback(async (search: string) => {
    try {
      const { teams, users } = await searchFormattedUsersAndTeams(search, 1);

      return [...teams, ...users].map((d) => ({
        label: getEntityName(d),
        value: d.name,
      }));
    } catch (error) {
      return [];
    }
  }, []);

  // To fetch FQN options
  const getEntityByFQN = useCallback(
    async (fqn: string): Promise<DefaultOptionType[]> => {
      try {
        const { data } = await getSuggestions(fqn);

        return data.suggest['metadata-suggest'][0].options.map((d) => ({
          label: d.text ?? d._source.name,
          value: d._source.fullyQualifiedName,
        }));
      } catch (error) {
        return [];
      }
    },
    []
  );

  // Render condition field based on function selected
  const getConditionField = (condition: string, name: number) => {
    const func = filterFunctions?.find((func) => func.name === condition);

    switch (condition) {
      case 'matchAnyEntityFqn':
        if (func) {
          return (
            <Form.Item className="w-full" name={[name, 'condition']}>
              <AsyncSelect
                api={getEntityByFQN}
                data-testid={`${condition}-select`}
                mode="multiple"
                placeholder={t('label.search-by-type', {
                  type: t('label.fqn-uppercase'),
                })}
                showArrow={false}
              />
            </Form.Item>
          );
        }

        break;
      case 'matchUpdatedBy':
      case 'matchAnyOwnerName':
        if (func) {
          return (
            <Form.Item className="w-full" name={[name, 'condition']}>
              <AsyncSelect
                api={getUsersAndTeamsOptions}
                data-testid={`${condition}-select`}
                mode="multiple"
                placeholder={t('label.search-by-type', {
                  type: getFunctionDisplayName(condition),
                })}
              />
            </Form.Item>
          );
        }

        break;
      default:
        if (func) {
          return (
            <Form.Item className="w-full" name={[name, 'condition']}>
              <Select
                showArrow
                data-testid={`${condition}-select`}
                mode="multiple"
                options={
                  func.paramAdditionalContext?.data?.map((d) => ({
                    label: startCase(d),
                    value: d,
                  })) ?? []
                }
                placeholder={t('label.select-field', {
                  field: getFunctionDisplayName(condition),
                })}
                showSearch={false}
              />
            </Form.Item>
          );
        }
    }

    return <></>;
  };

  // Watchers
  const filters = Form.useWatch(['filteringRules', 'rules'], form);
  const entitySelected = Form.useWatch(['filteringRules', 'resources'], form);
  const subscriptionType = Form.useWatch(['subscriptionType'], form);

  // Run time values needed for conditional rendering
  const functions = useMemo(() => {
    if (entityFunctions) {
      const exitingFunctions =
        filters?.map((f: EventFilterRule) => f.name) ?? [];

      const supportedFunctions: string[][] =
        entitySelected?.map((entity: string) => {
          const resource = entityFunctions.find((data) => data.name === entity);

          return resource?.supportedFilters || [];
        }) ?? [];

      const functions = intersection(...supportedFunctions)
        .sort()
        .map((func) => ({
          label: getFunctionDisplayName(func),
          value: func,
          disabled: exitingFunctions.includes(func),
        }));

      return functions as DefaultOptionType[];
    }

    return [];
  }, [entitySelected, entityFunctions, filters]);

  const handleChange = (changedValues: Partial<EventSubscription>) => {
    const { filteringRules } = changedValues;
    if (filteringRules?.resources) {
      form.resetFields([['filteringRules', 'rules'], 'condition']);
    }
  };

  const getDestinationConfigFields = useCallback(() => {
    const sendToCommonFields = (
      <Space align="baseline">
        <label>{t('label.send-to')}:</label>
        <Form.Item
          name={['subscriptionConfig', 'sendToAdmins']}
          valuePropName="checked">
          <Checkbox>{t('label.admin-plural')}</Checkbox>
        </Form.Item>
        <Form.Item
          name={['subscriptionConfig', 'sendToOwners']}
          valuePropName="checked">
          <Checkbox>{t('label.owner-plural')}</Checkbox>
        </Form.Item>
        <Form.Item
          name={['subscriptionConfig', 'sendToFollowers']}
          valuePropName="checked">
          <Checkbox>{t('label.follower-plural')}</Checkbox>
        </Form.Item>
      </Space>
    );

    if (subscriptionType) {
      switch (subscriptionType) {
        case SubscriptionType.Email:
          return (
            <>
              <Form.Item
                label={t('label.send-to')}
                labelCol={{ span: 24 }}
                name={['subscriptionConfig', 'receivers']}>
                <Select
                  showSearch
                  mode="tags"
                  open={false}
                  placeholder={t('label.enter-entity', {
                    entity: t('label.email-plural'),
                  })}
                />
              </Form.Item>
              {sendToCommonFields}
            </>
          );
        case SubscriptionType.GenericWebhook:
        case SubscriptionType.SlackWebhook:
        case SubscriptionType.MSTeamsWebhook:
        case SubscriptionType.GChatWebhook:
          return (
            <>
              <Form.Item required name={['subscriptionConfig', 'endpoint']}>
                <Input
                  disabled={provider === ProviderType.System}
                  placeholder={
                    t('label.endpoint-url') + ': ' + 'http(s)://www.example.com'
                  }
                />
              </Form.Item>
              {sendToCommonFields}
              <Collapse ghost>
                <Collapse.Panel
                  header={`${t('label.advanced-entity', {
                    entity: t('label.config'),
                  })}:`}
                  key="1">
                  <Space>
                    <Form.Item
                      initialValue={10}
                      label="Batch Size"
                      labelCol={{ span: 24 }}
                      name={['batchSize']}>
                      <Input disabled={provider === ProviderType.System} />
                    </Form.Item>
                    <Form.Item
                      colon
                      initialValue={10}
                      label={`${t('label.connection-timeout-plural')}`}
                      labelCol={{ span: 24 }}
                      name={['timeout']}>
                      <Input disabled={provider === ProviderType.System} />
                    </Form.Item>
                  </Space>
                  <Form.Item
                    label={t('label.secret-key')}
                    labelCol={{ span: 24 }}
                    name={['subscriptionConfig', 'secretKey']}>
                    <Input
                      disabled={provider === ProviderType.System}
                      placeholder={t('label.secret-key')}
                    />
                  </Form.Item>
                </Collapse.Panel>
              </Collapse>
            </>
          );
      }
    }

    return <></>;
  }, [subscriptionType]);

  return (
    <>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Typography.Title level={5}>
            {!isEmpty(fqn)
              ? t('label.edit-entity', { entity: t('label.alert-plural') })
              : t('label.create-entity', { entity: t('label.alert-plural') })}
          </Typography.Title>
          <Typography.Text>{t('message.alerts-description')}</Typography.Text>
        </Col>
        <Col span={24}>
          <Form<EventSubscription>
            className="alerts-notification-form"
            form={form}
            onFinish={handleSave}
            onValuesChange={handleChange}>
            {loadingCount > 0 ? (
              <Skeleton title paragraph={{ rows: 8 }} />
            ) : (
              <>
                <Form.Item
                  label={t('label.name')}
                  labelCol={{ span: 24 }}
                  name="name"
                  rules={[
                    { required: true },
                    {
                      pattern: ENTITY_NAME_REGEX,
                      message: t('message.entity-name-validation'),
                    },
                  ]}>
                  <Input disabled={isEditMode} placeholder={t('label.name')} />
                </Form.Item>
                <Form.Item
                  label={t('label.description')}
                  labelCol={{ span: 24 }}
                  name="description"
                  trigger="onTextChange"
                  valuePropName="initialValue">
                  <RichTextEditor
                    data-testid="description"
                    height="200px"
                    initialValue=""
                  />
                </Form.Item>
                <Row gutter={[16, 16]}>
                  <Col span={8}>
                    <Space className="w-full" direction="vertical" size={16}>
                      <StyledCard
                        heading={t('label.trigger')}
                        subHeading={t('message.alerts-trigger-description')}
                      />
                      <div>
                        <Form.Item
                          required
                          initialValue={['all']}
                          messageVariables={{
                            fieldName: t('label.data-asset-plural'),
                          }}
                          name={['filteringRules', 'resources']}>
                          <TreeSelect
                            treeCheckable
                            className="w-full"
                            data-testid="triggerConfig-type"
                            placeholder={t('label.select-field', {
                              field: t('label.data-asset-plural'),
                            })}
                            showCheckedStrategy={TreeSelect.SHOW_PARENT}
                            treeData={resourcesOptions}
                          />
                        </Form.Item>
                      </div>
                    </Space>
                  </Col>
                  <Col span={8}>
                    <Space className="w-full" direction="vertical" size={16}>
                      <StyledCard
                        heading={t('label.filter-plural')}
                        subHeading={t('message.alerts-filter-description')}
                      />

                      <Form.List
                        name={['filteringRules', 'rules']}
                        rules={[
                          {
                            validator: listLengthValidator(
                              t('label.filter-plural')
                            ),
                          },
                        ]}>
                        {(fields, { add, remove }, { errors }) => (
                          <>
                            <Button
                              block
                              data-testid="add-filters"
                              icon={<PlusOutlined />}
                              type="default"
                              onClick={() => add({}, 0)}>
                              {t('label.add-entity', {
                                entity: t('label.filter-plural'),
                              })}
                            </Button>
                            {fields.map(({ key, name }) => (
                              <div key={`filteringRules-${key}`}>
                                {name > 0 && (
                                  <Divider
                                    style={{
                                      margin: 0,
                                      marginBottom: '16px',
                                    }}
                                  />
                                )}
                                <Row>
                                  <Col span={22}>
                                    <div className="flex-1">
                                      <Form.Item
                                        key={key}
                                        name={[name, 'name']}>
                                        <Select
                                          options={functions}
                                          placeholder={t('label.select-field', {
                                            field: t('label.condition'),
                                          })}
                                        />
                                      </Form.Item>
                                      {filters &&
                                        filters[name] &&
                                        getConditionField(
                                          filters[name].name ?? '',
                                          name
                                        )}

                                      <Form.Item
                                        initialValue={Effect.Include}
                                        key={key}
                                        name={[name, 'effect']}>
                                        <Select
                                          options={map(
                                            Effect,
                                            (func: string) => ({
                                              label: startCase(func),
                                              value: func,
                                            })
                                          )}
                                          placeholder={t('label.select-field', {
                                            field: t('label.effect'),
                                          })}
                                        />
                                      </Form.Item>
                                    </div>
                                  </Col>
                                  <Col span={2}>
                                    <Button
                                      data-testid={`remove-filter-rule-${name}`}
                                      icon={
                                        <SVGIcons
                                          alt={t('label.delete')}
                                          className="w-4"
                                          icon={Icons.DELETE}
                                        />
                                      }
                                      type="text"
                                      onClick={() => remove(name)}
                                    />
                                  </Col>
                                </Row>
                              </div>
                            ))}
                            <Form.ErrorList errors={errors} />
                          </>
                        )}
                      </Form.List>
                    </Space>
                  </Col>
                  <Col span={8}>
                    <Space className="w-full" direction="vertical" size={16}>
                      <StyledCard
                        heading={t('label.destination')}
                        subHeading={t('message.alerts-destination-description')}
                      />
                      <Form.Item
                        required
                        name="subscriptionType"
                        rules={[
                          {
                            required: true,
                            message: t('label.field-required', {
                              field: t('label.destination'),
                            }),
                          },
                        ]}>
                        <Select
                          data-testid="alert-action-type"
                          disabled={provider === ProviderType.System}
                          placeholder={t('label.select-field', {
                            field: t('label.source'),
                          })}
                          showSearch={false}>
                          {map(SubscriptionType, (value) => {
                            return [
                              SubscriptionType.ActivityFeed,
                              SubscriptionType.DataInsight,
                            ].includes(value) ? null : (
                              <Select.Option key={value} value={value}>
                                <Space size={16}>
                                  {getAlertsActionTypeIcon(
                                    value as SubscriptionType
                                  )}
                                  {getAlertActionTypeDisplayName(value)}
                                </Space>
                              </Select.Option>
                            );
                          })}
                        </Select>
                      </Form.Item>
                      {getDestinationConfigFields()}
                    </Space>
                  </Col>
                  <Col className="footer" span={24}>
                    <Button onClick={() => history.goBack()}>
                      {t('label.cancel')}
                    </Button>
                    <Button
                      data-testid="save"
                      htmlType="submit"
                      loading={isButtonLoading}
                      type="primary">
                      {t('label.save')}
                    </Button>
                  </Col>
                </Row>
              </>
            )}
          </Form>
        </Col>
        <Col span={24} />
        <Col span={24} />
      </Row>
    </>
  );
};

export default AddAlertPage;
