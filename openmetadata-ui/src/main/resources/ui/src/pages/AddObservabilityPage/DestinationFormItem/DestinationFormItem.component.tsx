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
import { isEmpty } from 'lodash';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { CreateEventSubscription } from '../../../generated/events/api/createEventSubscription';
import {
  SubscriptionCategory,
  SubscriptionType,
} from '../../../generated/events/eventSubscription';

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

  const filteredOptions = filterResources.filter((o) => {
    return !selectedDestinations?.some((d) => d.type === o.value);
  });

  const getConfigField = (type: SubscriptionType, fieldName: number) => {
    switch (type) {
      case SubscriptionType.Slack:
      case SubscriptionType.MSTeams:
      case SubscriptionType.GChat:
      case SubscriptionType.Generic:
        return (
          <Form.Item
            label=""
            name={[fieldName, 'config', 'endpoint']}
            rules={[{ required: true }]}>
            <Input placeholder="EndPoint URL" />
          </Form.Item>
        );
      case SubscriptionType.Email:
        return (
          <Form.Item label="" name={[fieldName, 'config', 'receivers']}>
            <Select mode="tags" open={false} placeholder="EMails" />
          </Form.Item>
        );
      default:
        return null;
    }
  };

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
          <Form.List name={['destinations']}>
            {(fields, { add, remove }, { errors }) => {
              return (
                <Row gutter={[16, 16]}>
                  {fields.map((field) => (
                    <React.Fragment key={field.key}>
                      <Col span={11}>
                        <Form.Item
                          required
                          messageVariables={{
                            fieldName: t('label.data-asset-plural'),
                          }}
                          name={[field.name, 'type']}>
                          <Select
                            className="w-full"
                            data-testid="triggerConfig-type"
                            options={filteredOptions}
                            placeholder={t('label.select-field', {
                              field: t('label.data-asset-plural'),
                            })}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={11}>
                        <Form.Item
                          hidden
                          initialValue={SubscriptionCategory.External}
                          name={[field.name, 'category']}
                        />
                        {selectedDestinations &&
                          !isEmpty(selectedDestinations[field.name]) &&
                          selectedDestinations[field.name] &&
                          getConfigField(
                            selectedDestinations[field.name]?.type,
                            field.name
                          )}
                      </Col>
                      <Col span={2}>
                        <Button
                          data-testid={`remove-action-rule-${name}`}
                          icon={<CloseOutlined />}
                          onClick={() => remove(field.name)}
                        />
                      </Col>
                    </React.Fragment>
                  ))}

                  <Col span={24}>
                    <Button type="primary" onClick={add}>
                      {buttonLabel}
                    </Button>
                  </Col>
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
