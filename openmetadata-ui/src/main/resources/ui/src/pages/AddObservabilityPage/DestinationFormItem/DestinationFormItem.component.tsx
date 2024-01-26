/*
 *  Copyright 2024 Collate.
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

import { CloseOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Row,
  Select,
  Tabs,
  Typography,
} from 'antd';
import { SelectProps } from 'antd/lib/select';
import { isEmpty, isNil } from 'lodash';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DESTINATION_SOURCE_ITEMS } from '../../../constants/Alerts.constants';
import { CreateEventSubscription } from '../../../generated/events/api/createEventSubscription';
import { SubscriptionCategory } from '../../../generated/events/eventSubscription';
import {
  getDestinationConfigField,
  getSubscriptionTypeOptions,
  listLengthValidator,
} from '../../../utils/Alerts/AlertsUtil';
import { checkIfDestinationIsInternal } from '../../../utils/ObservabilityUtils';
import { ModifiedDestination } from '../AddObservabilityPage.interface';
import './destination-form-item.less';

function DestinationFormItem({
  heading,
  subHeading,
  buttonLabel,
}: Readonly<{
  heading: string;
  subHeading: string;
  buttonLabel: string;
}>) {
  const { t } = useTranslation();
  const form = Form.useFormInstance();
  const [destinationOptions, setDestinationOptions] = useState(
    DESTINATION_SOURCE_ITEMS.internal
  );

  const selectedDestinations = Form.useWatch<ModifiedDestination[]>(
    'destinations',
    form
  );

  const [selectedTrigger] =
    Form.useWatch<CreateEventSubscription['resources']>(['resources'], form) ??
    [];

  const filteredOptions = destinationOptions.map((o) => {
    return {
      ...o,
      disabled: selectedDestinations?.some((d) => d.type === o.value),
    };
  });

  const showAddDestination = useMemo(
    () => filteredOptions.some((o) => !o.disabled),
    [filteredOptions]
  );

  const handleTabChange = useCallback((key) => {
    setDestinationOptions(
      DESTINATION_SOURCE_ITEMS[key as keyof typeof DESTINATION_SOURCE_ITEMS]
    );
  }, []);

  const customDestinationDropdown: SelectProps['dropdownRender'] = useCallback(
    (menu: React.ReactElement) => {
      return (
        <Tabs
          centered
          className="destination-select-dropdown"
          defaultActiveKey="internal"
          tabBarStyle={{
            background: 'white',
          }}
          onTabClick={handleTabChange}>
          <Tabs.TabPane key="internal" tab={t('label.internal')}>
            {menu}
          </Tabs.TabPane>
          <Tabs.TabPane key="external" tab={t('label.external')}>
            {menu}
          </Tabs.TabPane>
        </Tabs>
      );
    },
    [handleTabChange]
  );

  const getHiddenDestinationFields = (
    isInternalDestination: boolean,
    item: number,
    destinationType: string
  ) => (
    <>
      <Form.Item
        hidden
        initialValue={
          isInternalDestination
            ? destinationType
            : SubscriptionCategory.External
        }
        key={`${destinationType}-category`}
        name={[item, 'category']}
      />
      {!isInternalDestination && (
        <Form.Item
          hidden
          initialValue={destinationType}
          key={`${destinationType}-type`}
          name={[item, 'type']}
        />
      )}
    </>
  );

  return (
    <Card className="alert-form-item-container">
      <Row gutter={[8, 8]}>
        <Col span={24}>
          <Typography.Text className="font-medium">{heading}</Typography.Text>
        </Col>
        <Col span={24}>
          <Typography.Text className="text-xs text-grey-muted">
            {subHeading}
          </Typography.Text>
        </Col>
        <Col span={24}>
          <Form.List
            name={['destinations']}
            rules={[
              {
                validator: listLengthValidator(t('label.destination')),
              },
            ]}>
            {(fields, { add, remove }, { errors }) => {
              return (
                <>
                  {fields.map(({ key, name }) => {
                    const destinationType = form.getFieldValue([
                      'destinations',
                      name,
                      'destinationType',
                    ]);
                    const subscriptionType = form.getFieldValue([
                      'destinations',
                      name,
                      'type',
                    ]);

                    const isInternalDestinationSelected =
                      checkIfDestinationIsInternal(destinationType);

                    return (
                      <Row
                        className="p-b-md"
                        gutter={[16, 16]}
                        justify="space-between"
                        key={key}>
                        <Col flex="1 1 auto">
                          <Form.Item
                            required
                            messageVariables={{
                              fieldName: t('label.data-asset-plural'),
                            }}
                            name={[name, 'destinationType']}>
                            <Select
                              className="w-full"
                              data-testid="triggerConfig-type"
                              dropdownRender={customDestinationDropdown}
                              options={destinationOptions}
                              placeholder={t('label.select-field', {
                                field: t('label.destination'),
                              })}
                              onSelect={(value) => {
                                form.setFieldValue(['destinations', name], {
                                  destinationType: value,
                                });
                              }}
                            />
                          </Form.Item>
                        </Col>
                        <Col flex="1 1 40%">
                          {getHiddenDestinationFields(
                            isInternalDestinationSelected,
                            name,
                            destinationType
                          )}
                          {selectedDestinations &&
                            !isEmpty(selectedDestinations[name]) &&
                            selectedDestinations[name] &&
                            getDestinationConfigField(
                              selectedDestinations[name]?.destinationType,
                              name
                            )}
                        </Col>
                        <Col className="d-flex justify-end" flex="0 0 32px">
                          <Button
                            data-testid={`remove-action-rule-${name}`}
                            icon={<CloseOutlined />}
                            onClick={() => remove(name)}
                          />
                        </Col>
                        {destinationType &&
                          checkIfDestinationIsInternal(destinationType) && (
                            <Col span={24}>
                              <Form.Item
                                required
                                extra={
                                  destinationType &&
                                  subscriptionType && (
                                    <Alert
                                      closable
                                      className="m-t-sm"
                                      message={
                                        <Typography.Text className="font-medium text-sm">
                                          {t(
                                            'message.destination-selection-warning',
                                            {
                                              subscriptionCategory:
                                                destinationType,
                                              subscriptionType,
                                            }
                                          )}
                                        </Typography.Text>
                                      }
                                      type="warning"
                                    />
                                  )
                                }
                                messageVariables={{
                                  fieldName: t('label.data-asset-plural'),
                                }}
                                name={[name, 'type']}>
                                <Select
                                  className="w-full"
                                  data-testid="triggerConfig-type"
                                  options={getSubscriptionTypeOptions(
                                    destinationType
                                  )}
                                  placeholder={t('label.select-field', {
                                    field: t('label.destination'),
                                  })}
                                />
                              </Form.Item>
                            </Col>
                          )}
                      </Row>
                    );
                  })}

                  {showAddDestination && (
                    <Col span={24}>
                      <Button
                        disabled={
                          isEmpty(selectedTrigger) || isNil(selectedTrigger)
                        }
                        type="primary"
                        onClick={() => add({})}>
                        {buttonLabel}
                      </Button>
                    </Col>
                  )}
                  <Col span={24}>
                    <Form.ErrorList errors={errors} />
                  </Col>
                </>
              );
            }}
          </Form.List>
        </Col>
      </Row>
    </Card>
  );
}

export default DestinationFormItem;
