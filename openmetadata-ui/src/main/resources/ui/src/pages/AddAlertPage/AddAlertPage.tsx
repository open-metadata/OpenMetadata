/*
 *  Copyright 2021 Collate
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
  Col,
  Divider,
  Form,
  Input,
  Row,
  Select,
  Space,
  Switch,
  Typography,
} from 'antd';
import { useForm } from 'antd/lib/form/Form';
import { DefaultOptionType } from 'antd/lib/select';
import { AxiosError } from 'axios';
import { get, intersection, isEmpty, map, startCase } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { createAlertAction } from '../../axiosAPIs/alertActionAPI';
import {
  createAlert,
  getAlertsFromId,
  getDefaultTriggerConfigs,
  getEntityFilterFunctions,
  getFilterFunctions,
} from '../../axiosAPIs/alertsAPI';
import {
  getSearchedUsersAndTeams,
  getSuggestions,
} from '../../axiosAPIs/miscAPI';
import { AsyncSelect } from '../../components/AsyncSelect/AsyncSelect';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../constants/GlobalSettings.constants';
import { PROMISE_STATE } from '../../enums/common.enum';
import { AlertAction } from '../../generated/alerts/alertAction';
import {
  Alerts,
  AlertTriggerType,
  Effect,
  EntityReference,
  TriggerConfig,
} from '../../generated/alerts/alerts';
import { AlertActionType } from '../../generated/alerts/api/createAlertAction';
import { EntitySpelFilters } from '../../generated/alerts/entitySpelFilters';
import { Function } from '../../generated/type/function';
import {
  getAlertsActionTypeIcon,
  getDisplayNameForTriggerType,
  getFunctionDisplayName,
  StyledCard,
} from '../../utils/Alerts/AlertsUtil';
import { getSettingPath } from '../../utils/RouterUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import './add-alerts-page.styles.less';

const AddAlertPage = () => {
  const { t } = useTranslation();
  const [form] = useForm<Alerts>();
  const history = useHistory();
  const { fqn } = useParams<{ fqn: string }>();

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

      const requestFilteringRules =
        response.filteringRules?.map((curr) => ({
          ...curr,
          condition: curr.condition
            .replace(new RegExp(`${curr.name}\\('`), '')
            .replace(new RegExp(`'\\)`), ''),
        })) ?? [];

      form.setFieldsValue({
        ...response,
        filteringRules: requestFilteringRules,
      });
    } catch {
      showErrorToast(
        t('message.entity-fetch-error', { entity: t('label.alert') }),
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

  const handleSave = async (data: Alerts) => {
    const { filteringRules, alertActions } = data;

    const requestFilteringRules = filteringRules?.map((curr) => ({
      ...curr,
      condition: `${curr.name}(${map(
        curr.condition,
        (v: string) => `'${v}'`
      )?.join(', ')})`,
    }));

    try {
      const actions: AlertAction[] =
        alertActions?.map(
          (action) =>
            ({
              ...action,
              enabled: true,
            } as unknown as AlertAction)
        ) ?? [];

      const promises = actions.map((action) => createAlertAction(action));

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

      try {
        await createAlert({
          ...data,
          filteringRules: requestFilteringRules,
          alertActions: requestAlertActions,
        });

        showErrorToast(
          t('server.create-entity-success', { entity: t('alert-plural') })
        );
        history.push(
          getSettingPath(
            GlobalSettingsMenuCategory.COLLABORATION,
            GlobalSettingOptions.ALERTS
          )
        );
      } catch (error) {
        showErrorToast(
          t('server.entity-creation-error', {
            entity: t('label.alert-plural'),
          }),
          (error as AxiosError).message
        );
      }
    } catch (error) {
      showErrorToast(
        t('server.entity-creation-error', { entity: t('label.alert-plural') })
      );
    }
  };

  const getUsersAndTeamsOptions = useCallback(async (search: string) => {
    try {
      const response = await getSearchedUsersAndTeams(search, 1);

      return response.hits.hits.map((d) => ({
        label: d._source.displayName ?? d._source.name,
        value: d._source.id,
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
  const alertActions = Form.useWatch(['alertActions'], form);
  const entitySelected = Form.useWatch(['triggerConfig', 'entities'], form);
  const trigger = Form.useWatch(['triggerConfig', 'type'], form);

  // Run time values needed for conditional rendering
  const functions = useMemo(() => {
    if (entityFunctions) {
      if (!trigger || trigger === AlertTriggerType.AllDataAssets) {
        return entityFunctions['all'].supportedFunctions.sort();
      }

      const arrFunctions = entitySelected?.map(
        (entity) =>
          entityFunctions[entity as unknown as string].supportedFunctions
      );

      const functions = arrFunctions
        ? intersection(...arrFunctions).sort()
        : [];

      return functions as string[];
    }

    return [];
  }, [entitySelected, entityFunctions]);

  const selectedTrigger = useMemo(
    () => defaultTriggers.find(({ type }) => trigger === type),
    [defaultTriggers, trigger]
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
            onFinish={handleSave}>
            <Card loading={loadingCount > 0}>
              <Form.Item
                label={t('label.name')}
                labelCol={{ span: 24 }}
                name="name"
                rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item
                label={t('label.description')}
                labelCol={{ span: 24 }}
                name="description"
                rules={[{ required: true }]}>
                <Input.TextArea />
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
                        initialValue={AlertTriggerType.AllDataAssets}
                        name={['triggerConfig', 'type']}>
                        <Select
                          options={defaultTriggers.map((trigger) => ({
                            label: getDisplayNameForTriggerType(trigger.type),
                            value: trigger.type,
                          }))}
                        />
                      </Form.Item>
                      {selectedTrigger?.type ===
                        AlertTriggerType.SpecificDataAsset && (
                        <Form.Item name={['triggerConfig', 'entities']}>
                          <Select
                            showArrow
                            className="w-full"
                            mode="multiple"
                            options={
                              selectedTrigger.entities?.map((entity) => ({
                                value: entity,
                                label: startCase(entity),
                              })) ?? []
                            }
                            placeholder={t('label.select-data-assets')}
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

                    <Form.List name="filteringRules">
                      {(fields, { add, remove }) => (
                        <>
                          {fields.map(({ key, name }) => (
                            <div key={`filteringRules-${key}`}>
                              <div className="d-flex gap-1">
                                <div className="flex-1">
                                  <Form.Item key={key} name={[name, 'name']}>
                                    <Select
                                      options={functions?.map(
                                        (func: string) => ({
                                          label: getFunctionDisplayName(func),
                                          value: func,
                                        })
                                      )}
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
                                    initialValue={Effect.Allow}
                                    key={key}
                                    name={[name, 'effect']}>
                                    <Select
                                      options={map(Effect, (func: string) => ({
                                        label: startCase(func),
                                        value: func,
                                      }))}
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
                              {fields.length - 1 !== key && (
                                <Divider style={{ margin: '8px 0' }} />
                              )}
                            </div>
                          ))}
                          <Form.Item>
                            <Button
                              block
                              icon={<PlusOutlined />}
                              type="dashed"
                              onClick={() => add()}>
                              {t('label.add-entity', {
                                entity: t('label.filter-plural'),
                              })}
                            </Button>
                          </Form.Item>
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

                    <Form.List name="alertActions">
                      {(fields, { add, remove }) => (
                        <>
                          {fields.map(({ key, name }) => (
                            <div key={`alertActions-${key}`}>
                              <div className="d-flex" style={{ gap: '10px' }}>
                                <div className="flex-1">
                                  <Form.Item
                                    required
                                    key={key}
                                    name={[name, 'alertActionType']}>
                                    <Select
                                      placeholder={t('label.select-field', {
                                        field: t('label.source'),
                                      })}
                                      showSearch={false}>
                                      {map(AlertActionType, (value) => {
                                        return (
                                          <Select.Option
                                            key={value}
                                            value={value}>
                                            <Space size={16}>
                                              {getAlertsActionTypeIcon(
                                                value as AlertActionType
                                              )}
                                              {value}
                                            </Space>
                                          </Select.Option>
                                        );
                                      })}
                                    </Select>
                                  </Form.Item>
                                  <Form.Item required name={[name, 'name']}>
                                    <Input placeholder={t('label.name')} />
                                  </Form.Item>
                                  <Form.Item
                                    required
                                    name={[
                                      name,
                                      'alertActionConfig',
                                      'endpoint',
                                    ]}>
                                    <Input
                                      placeholder={
                                        t('label.endpoint-url') +
                                        ': ' +
                                        'http(s)://www.example.com'
                                      }
                                    />
                                  </Form.Item>

                                  <Form.Item
                                    label={t('label.advanced-config')}
                                    name={[name, 'enabled']}
                                    valuePropName="checked">
                                    <Switch />
                                  </Form.Item>
                                  {get(
                                    alertActions,
                                    `${name}.enabled`,
                                    false
                                  ) && (
                                    <>
                                      <Space className="w-full" size={16}>
                                        <Form.Item
                                          initialValue={10}
                                          label="Batch Size"
                                          labelCol={{ span: 24 }}
                                          name={[name, 'batchSize']}>
                                          <Input defaultValue={10} />
                                        </Form.Item>
                                        <Form.Item
                                          colon
                                          initialValue={10}
                                          label={`${t(
                                            'label.connection-timeout-plural-optional'
                                          )}`}
                                          labelCol={{ span: 24 }}
                                          name={[name, 'timeout']}>
                                          <Input />
                                        </Form.Item>
                                      </Space>
                                      <Form.Item
                                        label={t('label.secret-key')}
                                        labelCol={{ span: 24 }}
                                        name={[
                                          name,
                                          'alertActionConfig',
                                          'secretKey',
                                        ]}>
                                        <Input
                                          placeholder={t('label.secret-key')}
                                        />
                                      </Form.Item>
                                    </>
                                  )}
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

                              {fields.length - 1 !== key && <Divider />}
                            </div>
                          ))}
                          <Form.Item>
                            <Button
                              block
                              icon={<PlusOutlined />}
                              type="dashed"
                              onClick={() => add()}>
                              {t('label.add-entity', {
                                entity: t('label.destination'),
                              })}
                            </Button>
                          </Form.Item>
                        </>
                      )}
                    </Form.List>
                  </Space>
                </Col>
                <Col className="footer" span={24}>
                  <Button onClick={() => history.goBack()}>
                    {t('label.cancel')}
                  </Button>
                  <Button htmlType="submit" type="primary">
                    {t('label.save')}
                  </Button>
                </Col>
              </Row>
            </Card>
          </Form>
        </Col>
      </Row>
    </>
  );
};

export default AddAlertPage;
