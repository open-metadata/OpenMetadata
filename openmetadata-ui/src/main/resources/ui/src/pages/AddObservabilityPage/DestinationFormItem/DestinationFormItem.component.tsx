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
import React from 'react';
import { useTranslation } from 'react-i18next';
import { SubscriptionCategory } from '../../../generated/events/eventSubscription';

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
        <Col span={12}>
          <Form.List name="destinations">
            {(fields, { add, remove }) => {
              return (
                <Row gutter={[16, 16]}>
                  {fields.map((field, index) => (
                    <>
                      <Col span={11}>
                        <Form.Item
                          required
                          messageVariables={{
                            fieldName: t('label.data-asset-plural'),
                          }}
                          name={[index, 'type']}>
                          <Select
                            className="w-full"
                            data-testid="triggerConfig-type"
                            options={filterResources}
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
                          name={[index, 'category']}
                        />
                        <Form.Item
                          label=""
                          name={[index, 'config', 'receivers']}>
                          <Input placeholder="EndPoint URL" />
                        </Form.Item>
                      </Col>
                      <Col span={2}>
                        <Button
                          data-testid={`remove-action-rule-${name}`}
                          icon={<CloseOutlined />}
                          onClick={() => remove(field.name)}
                        />
                      </Col>
                    </>
                  ))}

                  <Form.Item>
                    <Button type="primary" onClick={add}>
                      {buttonLabel}
                    </Button>
                  </Form.Item>
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
