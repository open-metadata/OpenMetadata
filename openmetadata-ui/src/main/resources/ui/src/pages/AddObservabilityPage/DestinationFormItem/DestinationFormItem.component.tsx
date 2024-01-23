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
import { Button, Card, Col, Form, Row, Select, Typography } from 'antd';
import Input from 'antd/lib/input/Input';
import { DefaultOptionType } from 'antd/lib/select';
import { isEmpty, isNil } from 'lodash';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CreateEventSubscription } from '../../../generated/events/api/createEventSubscription';
import {
  SubscriptionCategory,
  SubscriptionType,
} from '../../../generated/events/eventSubscription';
import { listLengthValidator } from '../../../utils/Alerts/AlertsUtil';

function DestinationFormItem({
  heading,
  subHeading,
  buttonLabel,
  filterResources,
}: Readonly<{
  heading: string;
  subHeading: string;
  buttonLabel: string;
  filterResources: DefaultOptionType[];
}>) {
  const { t } = useTranslation();
  const form = Form.useFormInstance();

  const selectedDestinations = Form.useWatch<
    CreateEventSubscription['destinations']
  >('destinations', form);

  const [selectedTrigger] =
    Form.useWatch<CreateEventSubscription['resources']>(['resources'], form) ??
    [];

  const filteredOptions = filterResources.map((o) => {
    return {
      ...o,
      disabled: selectedDestinations?.some((d) => d.type === o.value),
    };
  });

  const getPlaceholder = (type: SubscriptionType) => {
    switch (type) {
      case SubscriptionType.Slack:
        return 'https://hooks.slack.com/services/XXXXX/XXXXX/XXXXX';
      case SubscriptionType.MSTeams:
        return 'https://outlook.office.com/webhook/XXXXX/XXXXX/XXXXX';
      case SubscriptionType.GChat:
        return 'https://chat.googleapis.com/v1/spaces/XXXXX/messages?key=XXXXX';
      case SubscriptionType.Generic:
        return 'https://example.com';
      case SubscriptionType.Email:
        return 'Add ↵ seprated Email addresses';
      default:
        return '';
    }
  };

  const getConfigField = (type: SubscriptionType, fieldName: number) => {
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
            <Input placeholder={getPlaceholder(type)} />
          </Form.Item>
        );
      case SubscriptionType.Email:
        return (
          <Form.Item
            label=""
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
              mode="tags"
              open={false}
              placeholder={getPlaceholder(type)}
            />
          </Form.Item>
        );
      default:
        return null;
    }
  };

  const showAddDestination = useMemo(
    () => filteredOptions.some((o) => !o.disabled),
    [filteredOptions]
  );

  return (
    <Card className="trigger-item-container">
      <Row gutter={[8, 8]}>
        <Col span={24}>
          <Typography.Text>{heading}</Typography.Text>
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
                <Row gutter={[16, 16]}>
                  {fields.map(({ key, name }) => (
                    <React.Fragment key={key}>
                      <Col span={11}>
                        <Form.Item
                          required
                          messageVariables={{
                            fieldName: t('label.data-asset-plural'),
                          }}
                          name={[name, 'type']}>
                          <Select
                            className="w-full"
                            data-testid="triggerConfig-type"
                            options={filteredOptions}
                            placeholder={t('label.select-field', {
                              field: t('label.destination'),
                            })}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={11}>
                        <Form.Item
                          hidden
                          initialValue={SubscriptionCategory.External}
                          name={[name, 'category']}
                        />
                        {selectedDestinations &&
                          !isEmpty(selectedDestinations[name]) &&
                          selectedDestinations[name] &&
                          getConfigField(
                            selectedDestinations[name]?.type,
                            name
                          )}
                      </Col>
                      <Col span={2}>
                        <Button
                          data-testid={`remove-action-rule-${name}`}
                          icon={<CloseOutlined />}
                          onClick={() => remove(name)}
                        />
                      </Col>
                    </React.Fragment>
                  ))}

                  {showAddDestination && (
                    <Col span={24}>
                      <Button
                        disabled={
                          isEmpty(selectedTrigger) || isNil(selectedTrigger)
                        }
                        type="primary"
                        onClick={add}>
                        {buttonLabel}
                      </Button>
                    </Col>
                  )}
                  <Col span={24}>
                    <Form.ErrorList errors={errors} />
                  </Col>
                </Row>
              );
            }}
          </Form.List>
        </Col>
      </Row>
    </Card>
  );
}

export default DestinationFormItem;
