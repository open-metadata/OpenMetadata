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
import { ObservabilityFormActionItemProps } from './ObservabilityFormActionItem.interface';

function ObservabilityFormActionItem({
  supportedActions,
}: Readonly<ObservabilityFormActionItemProps>) {
  const { t } = useTranslation();
  const form = Form.useFormInstance();

  // Watchers
  const selectedActions = Form.useWatch<EventFilterRule[]>(
    ['input', 'actions'],
    form
  );
  const [selectedTrigger] =
    Form.useWatch<CreateEventSubscription['resources']>(['resources'], form) ??
    [];

  // Run time values needed for conditional rendering
  const actionOptions = useMemo(() => {
    return getSupportedFilterOptions(selectedActions, supportedActions);
  }, [selectedActions, supportedActions]);

  return (
    <Card className="alert-form-item-container">
      <Row gutter={[8, 8]}>
        <Col span={24}>
          <Typography.Text className="font-medium">
            {t('label.action-plural')}
          </Typography.Text>
        </Col>
        <Col span={24}>
          <Typography.Text className="text-xs text-grey-muted">
            {t('message.alerts-action-description')}
          </Typography.Text>
        </Col>
        <Col span={24}>
          <Form.List name={['input', 'actions']}>
            {(fields, { add, remove }, { errors }) => {
              const showAddActionButton =
                fields.length < (supportedActions?.length ?? 1);

              return (
                <Row gutter={[16, 16]} key="actions">
                  {fields.map(({ key, name }) => {
                    const effect =
                      form.getFieldValue([
                        'input',
                        'actions',
                        name,
                        'effect',
                      ]) ?? Effect.Include;

                    const showConditionalFields =
                      !isNil(supportedActions) &&
                      !isEmpty(selectedActions) &&
                      selectedActions[name];

                    return (
                      <Col key={`observability-${key}`} span={24}>
                        <Row gutter={[8, 8]}>
                          <Col span={11}>
                            <Form.Item
                              key={`action-${key}`}
                              name={[name, 'name']}
                              rules={[
                                {
                                  required: true,
                                  message: t('message.field-text-is-required', {
                                    fieldText: t('label.action'),
                                  }),
                                },
                              ]}>
                              <Select
                                options={actionOptions}
                                placeholder={t('label.select-field', {
                                  field: t('label.action'),
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
                              selectedActions[name].name ?? '',
                              name,
                              selectedTrigger,
                              supportedActions
                            )}
                          <Col span={2}>
                            <Button
                              data-testid={`remove-action-rule-${name}`}
                              icon={<CloseOutlined />}
                              onClick={() => remove(name)}
                            />
                          </Col>
                        </Row>
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
                          <Switch checked={effect === Effect.Include} />
                        </Form.Item>
                      </Col>
                    );
                  })}
                  {showAddActionButton && (
                    <Col span={24}>
                      <Button
                        data-testid="add-action"
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
                          entity: t('label.action'),
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

export default ObservabilityFormActionItem;
