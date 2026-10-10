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
import { Grid, Toggle, Typography } from '@openmetadata/ui-core-components';
import { Button, Form, Select } from 'antd';
import { isEmpty } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import FormCardSection from '../../../components/common/FormCardSection/FormCardSection';
import {
  Effect,
  EventFilterRule,
} from '../../../generated/events/eventSubscription';
import { useAlertSelectionContext } from '../../../hooks/useAlertSelection';
import {
  getConditionalField,
  getSupportedFilterOptions,
} from '../../../utils/Alerts/AlertsUtil';
import { getLayoutGutter } from '../../../utils/common/layout.utils';
import { ObservabilityFormTriggerItemProps } from './ObservabilityFormTriggerItem.interface';

function ObservabilityFormTriggerItem({
  isViewMode = false,
}: Readonly<ObservabilityFormTriggerItemProps>) {
  const { t } = useTranslation();
  const { sources, support, search } = useAlertSelectionContext();
  const { supportedTriggers } = support;
  const form = Form.useFormInstance();

  // Watchers
  const selectedTriggers = Form.useWatch<EventFilterRule[]>(
    ['input', 'actions'],
    form
  );
  // Run time values needed for conditional rendering
  const triggerOptions = useMemo(() => {
    return getSupportedFilterOptions(selectedTriggers, supportedTriggers);
  }, [selectedTriggers, supportedTriggers]);

  return (
    <FormCardSection
      heading={t('label.trigger')}
      subHeading={t('message.alerts-trigger-description')}>
      <Form.List name={['input', 'actions']}>
        {(fields, { add, remove }, { errors }) => {
          const showAddTriggerButton =
            fields.length < (supportedTriggers?.length ?? 1) && !isViewMode;

          return (
            <Grid
              className="layout-row layout-grid"
              data-testid="triggers-list"
              key="triggers"
              style={{ ...getLayoutGutter(16, 16) }}>
              {fields.map(({ key, name }) => {
                const effect =
                  form.getFieldValue(['input', 'actions', name, 'effect']) ??
                  Effect.Include;

                const showConditionalFields =
                  !isEmpty(selectedTriggers) &&
                  !isEmpty(selectedTriggers[name]);

                return (
                  <Grid.Item
                    className="layout-column"
                    data-testid={`trigger-${name}`}
                    key={`observability-${key}`}
                    span={24}>
                    <div className="flex gap-4">
                      <div className="flex-1 w-min-0">
                        <Grid
                          className="layout-row layout-grid"
                          style={{ ...getLayoutGutter(8, 8) }}>
                          <Grid.Item className="layout-column" span={12}>
                            <Form.Item
                              key={`trigger-${key}`}
                              name={[name, 'name']}
                              rules={[
                                {
                                  required: true,
                                  message: t('message.field-text-is-required', {
                                    fieldText: t('label.trigger'),
                                  }),
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
                          </Grid.Item>
                          {showConditionalFields &&
                            getConditionalField(
                              selectedTriggers[name].name ?? '',
                              name,
                              search,
                              supportedTriggers
                            )}
                        </Grid>
                      </div>
                      {!isViewMode && (
                        <Button
                          data-testid={`remove-trigger-${name}`}
                          icon={<CloseOutlined />}
                          onClick={() => remove(name)}
                        />
                      )}
                    </div>
                    <Form.Item
                      label={<Typography>{t('label.include')}</Typography>}
                      labelAlign="left"
                      labelCol={{ span: 6 }}
                      name={[name, 'effect']}
                      normalize={(value) =>
                        value ? Effect.Include : Effect.Exclude
                      }>
                      <Toggle
                        data-testid={`trigger-switch-${name}`}
                        isDisabled={isViewMode}
                        isSelected={effect === Effect.Include}
                        size="sm"
                      />
                    </Form.Item>
                  </Grid.Item>
                );
              })}
              {showAddTriggerButton && (
                <Grid.Item className="layout-column" span={24}>
                  <Button
                    data-testid="add-trigger"
                    disabled={isEmpty(sources)}
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
                </Grid.Item>
              )}
              {/* Empty error lists must not reserve a grid row and its gutter. */}
              <Grid.Item className="layout-column tw:empty:hidden" span={24}>
                <Form.ErrorList errors={errors} />
              </Grid.Item>
            </Grid>
          );
        }}
      </Form.List>
    </FormCardSection>
  );
}

export default ObservabilityFormTriggerItem;
