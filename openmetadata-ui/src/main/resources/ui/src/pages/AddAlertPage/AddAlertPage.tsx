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
  Card,
  Checkbox,
  Col,
  Collapse,
  Divider,
  Form,
  Input,
  Row,
  Select,
  Space,
  Typography,
} from 'antd';
import { useForm } from 'antd/lib/form/Form';
import { DefaultOptionType } from 'antd/lib/select';
import { AsyncSelect } from 'components/AsyncSelect/AsyncSelect';
import { get, intersection, isEmpty, map, pick, startCase, trim } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { createAlertAction, updateAlertAction } from 'rest/alertActionAPI';
import {
  createAlert,
  getAlertActionForAlerts,
  getAlertsFromId,
  getDefaultTriggerConfigs,
  getEntityFilterFunctions,
  getFilterFunctions,
  updateAlert,
} from 'rest/alertsAPI';
import { getSuggestions } from 'rest/miscAPI';
import { getEntityName } from 'utils/CommonUtils';
import { searchFormattedUsersAndTeams } from 'utils/UserDataUtils';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../constants/GlobalSettings.constants';
import { PROMISE_STATE } from '../../enums/common.enum';
import { AlertAction } from '../../generated/alerts/alertAction';
import {
  AlertFilterRule,
  Alerts,
  AlertTriggerType,
  Effect,
  EntityReference,
  ProviderType,
  TriggerConfig,
} from '../../generated/alerts/alerts';
import { AlertActionType } from '../../generated/alerts/api/createAlertAction';
import { EntitySpelFilters } from '../../generated/alerts/entitySpelFilters';
import { Function } from '../../generated/type/function';
import {
  getAlertActionTypeDisplayName,
  getAlertsActionTypeIcon,
  getDisplayNameForEntities,
  getDisplayNameForTriggerType,
  getFunctionDisplayName,
  listLengthValidator,
  StyledCard,
} from '../../utils/Alerts/AlertsUtil';
import { getSettingPath } from '../../utils/RouterUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import './add-alerts-page.styles.less';

const AddAlertPage = () => {
  const { t } = useTranslation();
  const [form] = useForm<Alerts>();
  const history = useHistory();
  const { fqn } = useParams<{ fqn: string }>();
  // To block certain action based on provider of the Alert e.g. System / User
  const [provider, setProvider] = useState<ProviderType>(ProviderType.User);

  const [filterFunctions, setFilterFunctions] = useState<Function[]>();
  const [defaultTriggers, setDefaultTriggers] = useState<Array<TriggerConfig>>(
    []
  );
  const [loadingCount, setLoadingCount] = useState(0);
  const [entityFunctions, setEntityFunctions] =
    useState<Record<string, EntitySpelFilters>>();

  const fetchAlert = async () => {
    try {
      setLoadingCount((count) => count + 1);

      const response: Alerts = await getAlertsFromId(fqn);
      const alertActions = await getAlertActionForAlerts(response.id);

      const requestFilteringRules =
        response.filteringRules?.map(
          (curr) =>
            ({
              ...curr,
              condition: curr.condition
                .replace(new RegExp(`${curr.name}\\('`), '')
                .replaceAll("'", '')
                .replace(new RegExp(`\\)`), '')
                .split(',')
                .map(trim),
            } as unknown as AlertFilterRule)
        ) ?? [];

      setProvider(response.provider ?? ProviderType.User);

      form.setFieldsValue({
        ...response,
        filteringRules: requestFilteringRules,
        alertActions: alertActions as unknown as EntityReference[],
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
      const entityFunctions = await getEntityFilterFunctions();

      setFilterFunctions(functions);
      setEntityFunctions(entityFunctions);
    } finally {
      setLoadingCount((count) => count - 1);
    }
  };

  const fetchDefaultTriggerConfig = async () => {
    setLoadingCount((count) => count + 1);
    const triggers = await getDefaultTriggerConfigs();

    setDefaultTriggers(
      triggers.map((trigger) => ({
        ...trigger,
        entities: trigger.entities?.sort(),
      }))
    );
    setLoadingCount((count) => count - 1);
  };

  useEffect(() => {
    fetchFunctions();
    fetchDefaultTriggerConfig();
  }, []);

  const isEditMode = useMemo(() => !isEmpty(fqn), [fqn]);

  const updateCreateAlertActions = async (alertActions: AlertAction[]) => {
    if (isEditMode) {
      if (!form.isFieldTouched(['alertActions'])) {
        // If destination is not changed return given alertAction as it is
        return Promise.resolve(
          alertActions.map((action) => ({
            id: action.id ?? '',
            type: 'alertAction',
          }))
        );
      }
    }

    // Else Create AlertActions and return new IDs
    const promises =
      alertActions?.map((action) => {
        const api = action.id ? updateAlertAction : createAlertAction;
        const alertAction = pick(action, [
          'alertActionConfig',
          'alertActionType',
          'name',
          'displayName',
          'timeout',
          'batchSize',
        ]) as AlertAction;

        return api(alertAction);
      }) ?? [];

    const responses = await Promise.allSettled(promises);

    const requestAlertActions: EntityReference[] = responses.map((res) => {
      if (res.status === PROMISE_STATE.REJECTED) {
        throw res.reason;
      }

      return {
        id: res.status === PROMISE_STATE.FULFILLED ? res.value.id ?? '' : '',
        type: 'alertAction',
      };
    });

    return Promise.resolve(requestAlertActions);
  };

  const handleSave = async (data: Alerts) => {
    const { filteringRules, alertActions } = data;
    if (!alertActions?.length) {
      return;
    }

    const api = isEditMode ? updateAlert : createAlert;

    const requestFilteringRules = filteringRules?.map((curr) => ({
      ...curr,
      condition: `${curr.name}(${map(
        curr.condition,
        (v: string) => `'${v}'`
      )?.join(', ')})`,
    }));

    try {
      const requestAlertActions = await updateCreateAlertActions(
        alertActions as unknown as AlertAction[]
      );

      try {
        await api({
          ...data,
          filteringRules: requestFilteringRules,
          alertActions: requestAlertActions,
        });

        showSuccessToast(
          t(`server.${isEditMode ? 'update' : 'create'}-entity-success`, {
            entity: t('label.alert-plural'),
          })
        );
        history.push(
          getSettingPath(
            GlobalSettingsMenuCategory.NOTIFICATIONS,
            GlobalSettingOptions.ALERTS
          )
        );
      } catch (error) {
        showErrorToast(
          t(
            `server.${
              isEditMode ? 'entity-updating-error' : 'entity-creation-error'
            }`,
            {
              entity: t('label.alert-plural'),
            }
          )
        );
      }
    } catch (error) {
      showErrorToast(
        t(
          `server.${
            isEditMode ? 'entity-updating-error' : 'entity-creation-error'
          }`,
          { entity: t('label.alert-plural') }
        )
      );
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
  const filters = Form.useWatch(['filteringRules'], form);
  const entitySelected = Form.useWatch(['triggerConfig', 'entities'], form);
  const trigger = Form.useWatch(['triggerConfig', 'type'], form);
  const alertActions = Form.useWatch(['alertActions'], form);

  // Run time values needed for conditional rendering
  const functions = useMemo(() => {
    if (entityFunctions) {
      const exitingFunctions = filters?.map((f) => f.name) ?? [];
      let supportedFunctions: string[][] = [];

      if (!trigger || trigger === AlertTriggerType.AllDataAssets) {
        supportedFunctions = [entityFunctions['all'].supportedFunctions];
      } else {
        supportedFunctions =
          entitySelected?.map(
            (entity) =>
              entityFunctions[entity as unknown as string].supportedFunctions
          ) ?? [];
      }

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

  const selectedTrigger = useMemo(
    () => defaultTriggers.find(({ type }) => trigger === type),
    [defaultTriggers, trigger]
  );

  const handleChange = (changedValues: Partial<Alerts>) => {
    const { triggerConfig } = changedValues;
    if (triggerConfig?.entities || triggerConfig?.type) {
      form.resetFields(['filteringRules', 'condition']);
    }
  };

  const getDestinationConfigFields = useCallback(
    (name: number) => {
      const alertActionType = get(alertActions, [name, 'alertActionType']);
      if (alertActions && alertActions[name]) {
        switch (alertActionType) {
          case AlertActionType.Email:
            return (
              <>
                <Form.Item
                  label={t('label.send-to')}
                  labelCol={{ span: 24 }}
                  name={[name, 'alertActionConfig', 'receivers']}>
                  <Select
                    showSearch
                    mode="tags"
                    open={false}
                    placeholder={t('label.enter-entity', {
                      entity: t('label.email-plural'),
                    })}
                  />
                </Form.Item>
                <Space align="baseline">
                  <label>{t('label.send-to')}:</label>
                  <Form.Item
                    name={[name, 'alertActionConfig', 'sendToAdmins']}
                    valuePropName="checked">
                    <Checkbox>{t('label.admin-plural')}</Checkbox>
                  </Form.Item>
                  <Form.Item
                    name={[name, 'alertActionConfig', 'sendToOwners']}
                    valuePropName="checked">
                    <Checkbox>{t('label.owner-plural')}</Checkbox>
                  </Form.Item>
                  <Form.Item
                    name={[name, 'alertActionConfig', 'sendToFollowers']}
                    valuePropName="checked">
                    <Checkbox>{t('label.follower-plural')}</Checkbox>
                  </Form.Item>
                </Space>
              </>
            );
          case AlertActionType.GenericWebhook:
          case AlertActionType.SlackWebhook:
          case AlertActionType.MSTeamsWebhook:
            return (
              <>
                <Form.Item
                  required
                  name={[name, 'alertActionConfig', 'endpoint']}>
                  <Input
                    disabled={provider === ProviderType.System}
                    placeholder={
                      t('label.endpoint-url') +
                      ': ' +
                      'http(s)://www.example.com'
                    }
                  />
                </Form.Item>

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
                        name={[name, 'batchSize']}>
                        <Input disabled={provider === ProviderType.System} />
                      </Form.Item>
                      <Form.Item
                        colon
                        initialValue={10}
                        label={`${t('label.connection-timeout-plural')}`}
                        labelCol={{ span: 24 }}
                        name={[name, 'timeout']}>
                        <Input disabled={provider === ProviderType.System} />
                      </Form.Item>
                    </Space>
                    <Form.Item
                      label={t('label.secret-key')}
                      labelCol={{ span: 24 }}
                      name={[name, 'alertActionConfig', 'secretKey']}>
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
    },
    [alertActions]
  );

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
          <Form<Alerts>
            className="alerts-notification-form"
            form={form}
            onFinish={handleSave}
            onValuesChange={handleChange}>
            <Card loading={loadingCount > 0}>
              <Form.Item
                label={t('label.name')}
                labelCol={{ span: 24 }}
                name="name"
                rules={[{ required: true }]}>
                <Input disabled={isEditMode} />
              </Form.Item>
              <Form.Item
                label={t('label.description')}
                labelCol={{ span: 24 }}
                name="description"
                rules={[{ required: true }]}>
                <Input.TextArea />
              </Form.Item>
              <Form.Item>
                <Row gutter={[16, 16]}>
                  <Col span={8}>
                    <Space className="w-full" direction="vertical" size={16}>
                      <StyledCard
                        heading={t('label.trigger')}
                        subHeading={t('message.alerts-trigger-description')}
                      />
                      <div>
                        <Form.Item
                          initialValue={AlertTriggerType.AllDataAssets}
                          name={['triggerConfig', 'type']}>
                          <Select
                            data-testid="triggerConfig-type"
                            options={defaultTriggers.map((trigger) => ({
                              label: getDisplayNameForTriggerType(trigger.type),
                              value: trigger.type,
                            }))}
                          />
                        </Form.Item>
                        {selectedTrigger?.type ===
                          AlertTriggerType.SpecificDataAsset && (
                          <Form.Item
                            required
                            messageVariables={{
                              fieldName: t('label.data-asset-plural'),
                            }}
                            name={['triggerConfig', 'entities']}>
                            <Select
                              showArrow
                              className="w-full"
                              mode="multiple"
                              options={
                                selectedTrigger.entities?.map((entity) => ({
                                  value: entity,
                                  label: getDisplayNameForEntities(entity),
                                })) ?? []
                              }
                              placeholder={t('label.select-field', {
                                field: t('label.data-asset-plural'),
                              })}
                            />
                          </Form.Item>
                        )}
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
                        name="filteringRules"
                        rules={[
                          {
                            validator: listLengthValidator(
                              t('label.filter-plural')
                            ),
                          },
                        ]}>
                        {(fields, { add, remove }, { errors }) => (
                          <>
                            <Form.Item>
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
                            </Form.Item>
                            {fields.map(({ key, name }) => (
                              <div key={`filteringRules-${key}`}>
                                {name > 0 && (
                                  <Divider
                                    style={{ margin: 0, marginBottom: '16px' }}
                                  />
                                )}
                                <div className="d-flex gap-1">
                                  <div className="flex-1">
                                    <Form.Item key={key} name={[name, 'name']}>
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
                                </div>
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

                      <Form.List
                        name="alertActions"
                        rules={[
                          {
                            validator: listLengthValidator(
                              t('label.destination')
                            ),
                          },
                        ]}>
                        {(fields, { add, remove }, { errors }) => (
                          <>
                            <Form.Item>
                              <Button
                                block
                                data-testid="add=destination"
                                disabled={provider === ProviderType.System}
                                icon={<PlusOutlined />}
                                type="default"
                                onClick={() => add({}, 0)}>
                                {t('label.add-entity', {
                                  entity: t('label.destination'),
                                })}
                              </Button>
                            </Form.Item>
                            {fields.map(({ key, name }) => (
                              <div key={`alertActions-${key}`}>
                                {name > 0 && (
                                  <Divider
                                    style={{ margin: 0, marginBottom: '16px' }}
                                  />
                                )}
                                <div className="d-flex" style={{ gap: '10px' }}>
                                  <div className="flex-1">
                                    <Form.Item
                                      required
                                      key={key}
                                      name={[name, 'alertActionType']}>
                                      <Select
                                        data-testid="alert-action-type"
                                        disabled={
                                          provider === ProviderType.System
                                        }
                                        placeholder={t('label.select-field', {
                                          field: t('label.source'),
                                        })}
                                        showSearch={false}>
                                        {map(AlertActionType, (value) => {
                                          return value ===
                                            AlertActionType.ActivityFeed ? null : (
                                            <Select.Option
                                              key={value}
                                              value={value}>
                                              <Space size={16}>
                                                {getAlertsActionTypeIcon(
                                                  value as AlertActionType
                                                )}
                                                {getAlertActionTypeDisplayName(
                                                  value
                                                )}
                                              </Space>
                                            </Select.Option>
                                          );
                                        })}
                                      </Select>
                                    </Form.Item>
                                    {getDestinationConfigFields(name)}
                                  </div>
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
                                </div>
                              </div>
                            ))}
                            <Form.ErrorList errors={errors} />
                          </>
                        )}
                      </Form.List>
                    </Space>
                  </Col>
                  <Col className="footer" span={24}>
                    <Button onClick={() => history.goBack()}>
                      {t('label.cancel')}
                    </Button>
                    <Button data-testid="save" htmlType="submit" type="primary">
                      {t('label.save')}
                    </Button>
                  </Col>
                </Row>
              </Form.Item>
            </Card>
          </Form>
        </Col>
        <Col span={24} />
        <Col span={24} />
      </Row>
    </>
  );
};

export default AddAlertPage;
