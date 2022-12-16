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
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  Row,
  Select,
  SelectProps,
  Skeleton,
  Space,
  Typography,
} from 'antd';
import { useForm } from 'antd/lib/form/Form';
import { DefaultOptionType } from 'antd/lib/select';
import { AxiosError } from 'axios';
import { debounce, intersection, map, startCase } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import {
  createAlert,
  getDefaultTriggerConfigs,
  getEntityFilterFunctions,
  getFilterFunctions,
} from '../../axiosAPIs/alertsAPI';
import {
  getSearchedUsersAndTeams,
  getSuggestions,
} from '../../axiosAPIs/miscAPI';
import PageContainerV1 from '../../components/containers/PageContainerV1';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../constants/GlobalSettings.constants';
import {
  Alerts,
  AlertTriggerType,
  Effect,
  TriggerConfig,
} from '../../generated/alerts/alerts';
import { AlertActionType } from '../../generated/alerts/api/createAlertAction';
import { EntitySpelFilters } from '../../generated/alerts/entitySpelFilters';
import { Function } from '../../generated/type/function';
import {
  getAlertsActionTypeIcon,
  getFunctionDisplayName,
} from '../../utils/Alerts/AlertsUtil';
import { getSettingPath } from '../../utils/RouterUtils';
import { showSuccessToast } from '../../utils/ToastUtils';

const AddAlertPage = () => {
  const { t } = useTranslation();
  const [form] = useForm<Alerts>();
  const [filterFunctions, setFilterFunctions] = useState<Function[]>();
  //   const [trigger, setTrigger] = useState(AlertTriggerType.OpenMetadataWide);
  const [defaultTriggers, setDefaultTriggers] = useState<Array<TriggerConfig>>(
    []
  );

  const history = useHistory();

  //   const [alertActions, setAlertActions] = useState<AlertAction[]>([]);
  const [loadingCount, setLoadingCount] = useState(0);
  const [entityFunctions, setEntityFunctions] =
    useState<Record<string, EntitySpelFilters>>();

  const fetchFunctions = async () => {
    try {
      setLoadingCount((count) => count + 1);
      const functions = await getFilterFunctions();
      const entityFunctions = await getEntityFilterFunctions();

      setFilterFunctions(functions);
      setEntityFunctions(entityFunctions);
    } catch (error) {
      const axiosError = error as AxiosError;
      // eslint-disable-next-line no-console
      console.error(axiosError.message);
    } finally {
      setLoadingCount((count) => count - 1);
    }
  };

  const fetchDefaultTriggerConfig = async () => {
    setLoadingCount((count) => count + 1);
    const triggers = await getDefaultTriggerConfigs();

    setDefaultTriggers(triggers);
    setLoadingCount((count) => count - 1);
  };

  //   const fetchAlertsActions = async () => {
  //     try {
  //       setLoadingCount((count) => count + 1);
  //       const { data } = await getAllAlertActions();

  //       setAlertActions(data);
  //     } catch (error) {
  //       // eslint-disable-next-line no-console
  //       console.error(error);
  //     } finally {
  //       setLoadingCount((count) => count - 1);
  //     }
  //   };

  useEffect(() => {
    fetchFunctions();
    fetchDefaultTriggerConfig();
    // fetchAlertsActions();
  }, []);

  const handleSave = async (data: Alerts) => {
    const filteringRules = data.filteringRules?.map((curr) => ({
      condition: `${curr.name}(${curr.condition
        .map((v) => `'${v}'`)
        ?.join(', ')})`,
      effect: Effect.Allow,
      name: curr.name,
    }));

    const alertActions = data.alertActions?.map((action) => ({
      ...action,
      type: 'alertAction',
    }));

    try {
      await createAlert({
        ...data,
        filteringRules,
        alertActions,
      });

      showSuccessToast('Alert created successful');
      history.push(
        getSettingPath(
          GlobalSettingsMenuCategory.COLLABORATION,
          GlobalSettingOptions.ALERTS
        )
      );
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
    }
  };

  const getConditionField = (condition: string, name: number) => {
    const func = filterFunctions?.find((func) => func.name === condition);

    const getUsersAndTeamsOptions = async (search: string) => {
      try {
        const response = await getSearchedUsersAndTeams(search, 1);

        return response.hits.hits.map((d) => ({
          label: d._source.displayName ?? d._source.name,
          value: d._source.id,
        }));
      } catch (error) {
        return [];
      }
    };

    const getEntityByFQN = async (
      fqn: string
    ): Promise<DefaultOptionType[]> => {
      try {
        const { data } = await getSuggestions(fqn);

        return data.suggest['metadata-suggest'][0].options.map((d) => ({
          label: d.text ?? d._source.name,
          value: d._source.fullyQualifiedName,
        }));
      } catch (error) {
        return [];
      }
    };

    switch (condition) {
      case 'matchAnyEntityFqn':
        if (func) {
          return (
            <Form.Item className="w-full" name={[name, 'condition']}>
              <AsyncSelect
                showSearch
                api={getEntityByFQN}
                filterOption={false}
                mode="multiple"
                notFoundContent={null}
                showArrow={false}
              />
            </Form.Item>
          );
        }

        break;
      case 'matchAnyOwnerName':
        if (func) {
          return (
            <Form.Item className="w-full" name={[name, 'condition']}>
              <AsyncSelect
                showSearch
                api={getUsersAndTeamsOptions}
                filterOption={false}
                mode="multiple"
                notFoundContent={null}
                showArrow={false}
              />
            </Form.Item>
          );
        }

        break;
      case 'matchAnyEventType':
      default:
        if (func) {
          return (
            <Form.Item className="w-full" name={[name, 'condition']}>
              <Select
                mode="multiple"
                options={
                  func.paramAdditionalContext?.data?.map((d) => ({
                    label: startCase(d),
                    value: d,
                  })) ?? []
                }
              />
            </Form.Item>
          );
        }
    }

    return <></>;
  };

  const filters = Form.useWatch(['filteringRules'], form);
  const entitySelected = Form.useWatch(['triggerConfig', 'eventFilters'], form);
  const trigger = Form.useWatch(['triggerConfig', 'type'], form);

  const functions = useMemo(() => {
    if (entityFunctions) {
      const arrFunctions = entitySelected?.map(
        (entity) =>
          entityFunctions[entity as unknown as string].supportedFunctions
      );

      const functions = arrFunctions ? intersection(...arrFunctions) : [];

      return functions;
    }

    return [];
  }, [entitySelected, entityFunctions]);

  const selectedTrigger = useMemo(
    () => defaultTriggers.find(({ type }) => trigger === type),
    [defaultTriggers, trigger]
  );

  const StyledCard = ({
    heading,
    subHeading,
  }: {
    heading: string;
    subHeading: string;
  }) => {
    return (
      <Card bodyStyle={{ background: '#DDE3EA' }} bordered={false}>
        <Typography.Text>{heading}</Typography.Text>
        <br />
        <Typography.Text className="text-xs text-grey-muted">
          {subHeading}
        </Typography.Text>
      </Card>
    );
  };

  return (
    <PageContainerV1>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Typography.Title level={5}>Create alerts</Typography.Title>
          <Typography.Text>
            Stay current with timely alerts using webhooks.
          </Typography.Text>
        </Col>
        {loadingCount > 0 ? (
          <Skeleton />
        ) : (
          <Col span={24}>
            <Form<Alerts>
              form={form}
              initialValues={{
                alertActions: [''],
              }}
              layout="vertical"
              onFinish={handleSave}>
              <Card>
                <Form.Item
                  label={t('label.name')}
                  name="name"
                  rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
                <Form.Item
                  label={t('label.description')}
                  name="description"
                  rules={[{ required: true }]}>
                  <Input.TextArea />
                </Form.Item>

                <Row gutter={[16, 16]}>
                  <Col span={8}>
                    <Space className="w-full" direction="vertical" size={16}>
                      <StyledCard
                        heading="Trigger"
                        subHeading="Trigger for all data assets or a specific entity."
                      />

                      <Form.Item
                        noStyle
                        initialValue={AlertTriggerType.OpenMetadataWide}
                        name={['triggerConfig', 'type']}>
                        <Select
                          notFoundContent="No relevant filters found"
                          options={defaultTriggers.map((trigger) => ({
                            label: trigger.type,
                            value: trigger.type,
                          }))}
                          style={{ width: '100%' }}
                        />
                      </Form.Item>
                      {selectedTrigger?.type ===
                        AlertTriggerType.EntitySpecific && (
                        <Form.Item
                          noStyle
                          name={['triggerConfig', 'eventFilters']}>
                          <Select
                            className="tw-w-full"
                            mode="multiple"
                            options={
                              selectedTrigger.eventFilters?.map(
                                ({ entityType }) => ({
                                  value: entityType,
                                  label: startCase(entityType),
                                })
                              ) ?? []
                            }
                            placeholder={t('label.select-data-assets')}
                          />
                        </Form.Item>
                      )}
                    </Space>
                  </Col>
                  <Col span={8}>
                    <Space className="w-full" direction="vertical" size={16}>
                      <StyledCard
                        heading="Filter"
                        subHeading="Specify the change events to narrow the scope of your alerts."
                      />

                      <Form.List name="filteringRules">
                        {(fields, { add, remove }) => (
                          <>
                            {fields.map(({ key, name }) => (
                              <>
                                <div className="d-flex w-full">
                                  <div className="flex-1">
                                    <Form.Item
                                      noStyle
                                      key={key}
                                      name={[name, 'name']}
                                      style={{ width: '80%' }}>
                                      <Select
                                        options={functions?.map(
                                          (func: string) => ({
                                            label: getFunctionDisplayName(func),
                                            value: func,
                                          })
                                        )}
                                        placeholder="Select condition"
                                      />
                                    </Form.Item>
                                    {filters &&
                                      filters[name] &&
                                      getConditionField(
                                        filters[name].name ?? '',
                                        name
                                      )}
                                  </div>
                                  <MinusCircleOutlined
                                    onClick={() => remove(name)}
                                  />
                                </div>
                                <Divider style={{ margin: '8px 0' }} />
                              </>
                            ))}
                            <Form.Item>
                              <Button
                                block
                                icon={<PlusOutlined />}
                                type="dashed"
                                onClick={() => add()}>
                                Add field
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
                        heading="Destination"
                        subHeading="Send notifications to Slack, MS Teams, Email, or and use Webhooks."
                      />

                      <Form.List name="alertActions">
                        {(fields, { add, remove }) => (
                          <>
                            {fields.map(({ key, name }) => (
                              <div key={key}>
                                <Form.Item noStyle name={[name, 'id']}>
                                  <Select placeholder="Select source">
                                    {map(AlertActionType, (value, key) => (
                                      <Select.Option
                                        key={key}
                                        label={value}
                                        value={value}>
                                        <Space size={8}>
                                          {getAlertsActionTypeIcon(
                                            key as AlertActionType
                                          )}
                                          {value}
                                        </Space>
                                      </Select.Option>
                                    ))}
                                  </Select>
                                </Form.Item>
                                <MinusCircleOutlined
                                  onClick={() => remove(name)}
                                />
                              </div>
                            ))}
                            <Form.Item>
                              <Button
                                block
                                icon={<PlusOutlined />}
                                type="dashed"
                                onClick={() => add()}>
                                Add field
                              </Button>
                            </Form.Item>
                          </>
                        )}
                      </Form.List>
                    </Space>
                  </Col>
                  <Col span={24}>
                    <Space>
                      <Button>Cancel</Button>
                      <Button htmlType="submit" type="primary">
                        Save
                      </Button>
                    </Space>
                  </Col>
                </Row>
              </Card>
            </Form>
          </Col>
        )}
      </Row>
    </PageContainerV1>
  );
};

export const AsyncSelect = ({
  options,
  api,

  ...restProps
}: SelectProps & {
  api: (queryString: string) => Promise<DefaultOptionType[]>;
}) => {
  const [optionsInternal, setOptionsInternal] = useState<DefaultOptionType[]>();
  const [searchText, setSearchText] = useState('');
  const [debouncedSearchText, setDebouncedSearchText] = useState('');
  const [loadingOptions, setLoadingOptions] = useState(false);
  useEffect(() => {
    setOptionsInternal(options);
  }, [options]);

  useEffect(() => {
    setLoadingOptions(true);
    api(debouncedSearchText).then((res) => {
      setOptionsInternal(res);
      setLoadingOptions(false);
    });
  }, [api, debouncedSearchText]);

  const updateDebounce = debounce(setDebouncedSearchText, 1000);

  const handleSearch = useCallback(
    (search: string) => {
      setSearchText(search);
      updateDebounce(search);
    },
    [setSearchText, updateDebounce]
  );

  return (
    <Select
      loading={loadingOptions}
      options={optionsInternal}
      searchValue={searchText}
      onSearch={handleSearch}
      onSelect={() => setSearchText('')}
      {...restProps}
    />
  );
};

export default AddAlertPage;
