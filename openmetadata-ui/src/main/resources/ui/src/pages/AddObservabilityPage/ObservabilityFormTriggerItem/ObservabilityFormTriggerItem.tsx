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
import { Button, Card, Col, Form, Row, Select, Switch, Typography } from 'antd';
import { isEmpty, isNil } from 'lodash';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CreateEventSubscription } from '../../../generated/events/api/createEventSubscription';
import {
  Effect,
  EventFilterRule,
} from '../../../generated/events/eventSubscription';
import {
  getConditionalField,
  getSupportedFilterOptions,
} from '../../../utils/Alerts/AlertsUtil';
import { ObservabilityFormTriggerItemProps } from './ObservabilityFormTriggerItem.interface';

function ObservabilityFormTriggerItem({
  supportedTriggers,
}: Readonly<ObservabilityFormTriggerItemProps>) {
  const { t } = useTranslation();
  const form = Form.useFormInstance();

  // Watchers
  const selectedTriggers = Form.useWatch<EventFilterRule[]>(
    ['input', 'actions'],
    form
  );
  const [selectedTrigger] =
    Form.useWatch<CreateEventSubscription['resources']>(['resources'], form) ??
    [];

  // Run time values needed for conditional rendering
  const triggerOptions = useMemo(() => {
    return getSupportedFilterOptions(selectedTriggers, supportedTriggers);
  }, [selectedTriggers, supportedTriggers]);

  return (
    <Card className="alert-form-item-container">
      <Row gutter={[8, 8]}>
        <Col span={24}>
          <Typography.Text className="font-medium">
            {t('label.trigger')}
          </Typography.Text>
        </Col>
        <Col span={24}>
          <Typography.Text className="text-xs text-grey-muted">
            {t('message.alerts-trigger-description')}
          </Typography.Text>
        </Col>
        <Col span={24}>
          <Form.List name={['input', 'actions']}>
            {(fields, { add, remove }, { errors }) => {
              const showAddTriggerButton =
                fields.length < (supportedTriggers?.length ?? 1);

              return (
                <Row
                  data-testid="triggers-list"
                  gutter={[16, 16]}
                  key="triggers">
                  {fields.map(({ key, name }) => {
                    const effect =
                      form.getFieldValue([
                        'input',
                        'actions',
                        name,
                        'effect',
                      ]) ?? Effect.Include;

                    const showConditionalFields =
                      !isNil(supportedTriggers) &&
                      !isEmpty(selectedTriggers) &&
                      selectedTriggers[name];

                    return (
                      <Col
                        data-testid={`trigger-${name}`}
                        key={`observability-${key}`}
                        span={24}>
                        <div className="flex gap-4">
                          <div className="flex-1 w-min-0">
                            <Row gutter={[8, 8]}>
                              <Col span={12}>
                                <Form.Item
                                  key={`trigger-${key}`}
                                  name={[name, 'name']}
                                  rules={[
                                    {
                                      required: true,
                                      message: t(
                                        'message.field-text-is-required',
                                        {
                                          fieldText: t('label.trigger'),
                                        }
                                      ),
                                    },
                                  ]}>
                                  <Select
                                    data-testid={`trigger-select-${name}`}
                                    options={triggerOptions}
                                    placeholder={t('label.select-field', {
                                      field: t('label.trigger'),
                                    })}
                                    onChange={() => {
                                      form.setFieldValue(
                                        ['input', 'actions', name, 'arguments'],
                                        []
                                      );
                                    }}
                                  />
                                </Form.Item>
                              </Col>
                              {showConditionalFields &&
                                getConditionalField(
                                  selectedTriggers[name].name ?? '',
                                  name,
                                  selectedTrigger,
                                  supportedTriggers
                                )}
                            </Row>
                          </div>
                          <div>
                            <Button
                              data-testid={`remove-trigger-${name}`}
                              icon={<CloseOutlined />}
                              onClick={() => remove(name)}
                            />
                          </div>
                        </div>
                        <Form.Item
                          label={
                            <Typography.Text>
                              {t('label.include')}
                            </Typography.Text>
                          }
                          name={[name, 'effect']}
                          normalize={(value) =>
                            value ? Effect.Include : Effect.Exclude
                          }>
                          <Switch
                            checked={effect === Effect.Include}
                            data-testid={`trigger-switch-${name}`}
                          />
                        </Form.Item>
                      </Col>
                    );
                  })}
                  {showAddTriggerButton && (
                    <Col span={24}>
                      <Button
                        data-testid="add-trigger"
                        disabled={
                          isEmpty(selectedTrigger) || isNil(selectedTrigger)
                        }
                        type="primary"
                        onClick={() =>
                          add({
                            effect: Effect.Include,
                          })
                        }>
                        {t('label.add-entity', {
                          entity: t('label.trigger'),
                        })}
                      </Button>
                    </Col>
                  )}
                  <Form.ErrorList errors={errors} />
                </Row>
              );
            }}
          </Form.List>
        </Col>
      </Row>
    </Card>
  );
}

export default ObservabilityFormTriggerItem;
