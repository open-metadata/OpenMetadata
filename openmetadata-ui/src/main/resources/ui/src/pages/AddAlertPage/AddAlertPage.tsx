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
  Space,
  Typography,
} from 'antd';
import { useForm } from 'antd/lib/form/Form';
import { AxiosError } from 'axios';
import { startCase } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getAllAlertActions } from '../../axiosAPIs/alertActionAPI';
import {
  getDefaultTriggerConfigs,
  getFilterFunctions,
} from '../../axiosAPIs/alertsAPI';
import PageContainerV1 from '../../components/containers/PageContainerV1';
import { AlertAction } from '../../generated/alerts/alertAction';
import {
  Alerts,
  AlertTriggerType,
  TriggerConfig,
} from '../../generated/alerts/alerts';
import { Function } from '../../generated/type/function';
import { getAlertsActionTypeIcon } from '../../utils/Alerts/AlertsUtil';

const AddAlertPage = () => {
  const { t } = useTranslation();
  const [form] = useForm<Alerts>();
  const [filterFunctions, setFilterFunctions] = useState<Function[]>();
  const [trigger, setTrigger] = useState(AlertTriggerType.OpenMetadataWide);
  const [defaultTriggers, setDefaultTriggers] = useState<Array<TriggerConfig>>(
    []
  );

  const [alertActions, setAlertActions] = useState<AlertAction[]>([]);

  const fetchFunctions = async () => {
    try {
      const functions = await getFilterFunctions();

      setFilterFunctions(functions);
    } catch (error) {
      const axiosError = error as AxiosError;
      // eslint-disable-next-line no-console
      console.error(axiosError.message);
    }
  };

  const fetchDefaultTriggerConfig = async () => {
    const triggers = await getDefaultTriggerConfigs();

    setDefaultTriggers(triggers);
  };

  const fetchAlertsActions = async () => {
    try {
      const { data } = await getAllAlertActions();

      setAlertActions(data);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
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

  const handleSave = (data: Alerts) => {
    // eslint-disable-next-line no-console
    console.info({
      ...data,
      alertActions: data.alertActions.map((action) => ({
        id: action,
        type: 'alertAction',
      })),
    });
  };

  return (
    <PageContainerV1>
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
                          //   mode="multiple"
                          options={
                            selectedTrigger.eventFilters?.map(
                              ({ entityType }) => ({
                                value: entityType,
                                label: startCase(entityType),
                              })
                            ) ?? []
                          }
                          placeholder={t('label.select-entity')}
                          onSelect={(values) => {
                            // eslint-disable-next-line no-console
                            console.log(values);
                          }}
                        />
                      </Form.Item>
                    )}
                  </Space>
                </Col>
                <Col span={8}>
                  <Card>
                    <Typography.Title level={5}>Filter</Typography.Title>
                    <Typography.Text>Enter a description</Typography.Text>
                  </Card>
                  <Form.List name="filteringRules">
                    {(fields, { add, remove }) => (
                      <>
                        {fields.map(({ key, name }) => (
                          <Space key={key} size={16}>
                            <Form.Item name={[name, 'condition']}>
                              <Select
                                className="w-full"
                                options={filterFunctions?.map((func) => ({
                                  label: func.name,
                                  value: func.input,
                                }))}
                                placeholder="Select condition"
                              />
                            </Form.Item>
                            <MinusCircleOutlined onClick={() => remove(name)} />
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
                            <Space key={key} size={16}>
                              <Form.Item name={name}>
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

                    {/* {selectedAlertActions &&
                      selectedAlertActions.map((_, index) => (
                        
                      ))}
                    <Button
                      htmlType="button"
                      type="dashed"
                      onClick={() =>
                        form.setFieldsValue({ alertActions: [{ id: 'abc' }] })
                      }>
                      + Add more
                    </Button> */}
                    {/* <Form.Item name="alertActions[0]">
                      <Select placeholder="Select source">
                        {alertActions.map((action) => (
                          <Select.Option
                            key={action.id}
                            label={action.displayName}
                            value={action.id}>
                            <Space size={8}>
                              {getActionTypeIcon(action.alertActionType)}
                              {action.displayName}
                            </Space>
                          </Select.Option>
                        ))}
                      </Select>
                    </Form.Item> */}
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

export default AddAlertPage;
