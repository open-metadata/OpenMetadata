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
import { debounce, startCase } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { getAllAlertActions } from '../../axiosAPIs/alertActionAPI';
import {
  createAlert,
  getDefaultTriggerConfigs,
  getFilterFunctions,
} from '../../axiosAPIs/alertsAPI';
import { getSearchedUsersAndTeams } from '../../axiosAPIs/miscAPI';
import PageContainerV1 from '../../components/containers/PageContainerV1';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../constants/GlobalSettings.constants';
import { AlertAction } from '../../generated/alerts/alertAction';
import {
  Alerts,
  AlertTriggerType,
  Effect,
  TriggerConfig,
} from '../../generated/alerts/alerts';
import { Function } from '../../generated/type/function';
import { getAlertsActionTypeIcon } from '../../utils/Alerts/AlertsUtil';
import { getSettingPath } from '../../utils/RouterUtils';
import { showSuccessToast } from '../../utils/ToastUtils';

const AddAlertPage = () => {
  const { t } = useTranslation();
  const [form] = useForm<Alerts>();
  const [filterFunctions, setFilterFunctions] = useState<Function[]>();
  const [trigger, setTrigger] = useState(AlertTriggerType.OpenMetadataWide);
  const [defaultTriggers, setDefaultTriggers] = useState<Array<TriggerConfig>>(
    []
  );

  const history = useHistory();

  const [alertActions, setAlertActions] = useState<AlertAction[]>([]);
  const [loadingCount, setLoadingCount] = useState(0);

  const fetchFunctions = async () => {
    try {
      setLoadingCount((count) => count + 1);
      const functions = await getFilterFunctions();

      setFilterFunctions(functions);
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

  const fetchAlertsActions = async () => {
    try {
      setLoadingCount((count) => count + 1);
      const { data } = await getAllAlertActions();

      setAlertActions(data);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
    } finally {
      setLoadingCount((count) => count - 1);
    }
  };

  useEffect(() => {
    fetchFunctions();
    fetchDefaultTriggerConfig();
    fetchAlertsActions();
  }, []);

  const selectedTrigger = useMemo(
    () => defaultTriggers.find(({ type }) => trigger === type),
    [defaultTriggers, trigger]
  );

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

    // eslint-disable-next-line no-console
    console.log({ ...data, filteringRules, alertActions });

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
          label: d._source.displayName,
          value: d._source.id,
        }));
      } catch (error) {
        return [];
      }
    };

    switch (condition) {
      case 'matchAnyEntityId':
      case 'matchAnyEntityFqn':
      case 'matchAnyOwnerName':
        if (func) {
          return (
            <Form.Item name={[name, 'condition']}>
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
      case 'matchAnySource':
      default:
        if (func) {
          return (
            <Form.Item name={[name, 'condition']}>
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

  return (
    <PageContainerV1>
      {loadingCount > 0 && (
        <>
          <Skeleton />
        </>
      )}
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Typography.Title level={5}>Add alerts</Typography.Title>
          <Typography.Text>Alerts body</Typography.Text>
        </Col>
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
                    <Card>
                      <Typography.Title level={5}>Trigger</Typography.Title>
                      <Typography.Text>Enter a description</Typography.Text>
                    </Card>
                    <Form.Item name={['triggerConfig', 'type']}>
                      <Select
                        options={defaultTriggers.map((trigger) => ({
                          label: trigger.type,
                          value: trigger.type,
                        }))}
                        style={{ width: '100%' }}
                        value={trigger}
                        onSelect={setTrigger}
                      />
                    </Form.Item>
                    {selectedTrigger?.type ===
                      AlertTriggerType.EntitySpecific && (
                      <Form.Item name={['triggerConfig', 'eventFilters']}>
                        <Select
                          className="tw-w-full"
                          options={
                            selectedTrigger.eventFilters?.map(
                              ({ entityType }) => ({
                                value: entityType,
                                label: startCase(entityType),
                              })
                            ) ?? []
                          }
                          placeholder={t('label.select-entity')}
                        />
                      </Form.Item>
                    )}
                  </Space>
                </Col>
                <Col span={8}>
                  <Space className="w-full" direction="vertical" size={16}>
                    <Card>
                      <Typography.Title level={5}>Filter</Typography.Title>
                      <Typography.Text>Enter a description</Typography.Text>
                    </Card>
                    <Form.List name="filteringRules">
                      {(fields, { add, remove }) => (
                        <>
                          {fields.map(({ key, name }) => (
                            <Space
                              align="baseline"
                              className="w-full"
                              key={key}
                              size={16}>
                              <Form.Item name={[name, 'name']}>
                                <Select
                                  className="w-full"
                                  options={filterFunctions?.map((func) => ({
                                    label: func.name,
                                    value: func.name,
                                  }))}
                                  placeholder="Select condition"
                                />
                              </Form.Item>
                              {filters &&
                                filters[name] &&
                                getConditionField(
                                  filters[name].name ?? '',
                                  name
                                )}
                              <MinusCircleOutlined
                                onClick={() => remove(name)}
                              />
                            </Space>
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
                    <Card>
                      <Typography.Title level={5}>Destination</Typography.Title>
                      <Typography.Text>Enter a description</Typography.Text>
                    </Card>

                    <Form.List name="alertActions">
                      {(fields, { add, remove }) => (
                        <>
                          {fields.map(({ key, name }) => (
                            <Space
                              align="baseline"
                              className="w-full"
                              key={key}
                              size={16}>
                              <Form.Item name={[name, 'id']}>
                                <Select placeholder="Select source">
                                  {alertActions.map((action) => (
                                    <Select.Option
                                      key={action.id}
                                      label={action.displayName}
                                      value={action.id}>
                                      <Space size={8}>
                                        {getAlertsActionTypeIcon(
                                          action.alertActionType
                                        )}
                                        {action.displayName}
                                      </Space>
                                    </Select.Option>
                                  ))}
                                </Select>
                              </Form.Item>
                              <MinusCircleOutlined
                                onClick={() => remove(name)}
                              />
                            </Space>
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
      {...restProps}
    />
  );
};

export default AddAlertPage;
