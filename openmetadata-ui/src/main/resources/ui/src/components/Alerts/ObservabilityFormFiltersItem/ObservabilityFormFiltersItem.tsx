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
import { Button, Col, Form, Row, Switch, Typography } from 'antd';
import { isEmpty, isNil } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import FormCardSection from '../../../components/common/FormCardSection/FormCardSection';
import {
    CreateEventSubscription,
    Effect
} from '../../../generated/events/api/createEventSubscription';
import { EventFilterRule } from '../../../generated/events/eventSubscription';
import {
    getConditionalField,
    getSupportedFilterOptions
} from '../../../utils/Alerts/AlertsUtil';
import { Select } from '../../common/AntdCompat';
import { ObservabilityFormFiltersItemProps } from './ObservabilityFormFiltersItem.interface';
;

function ObservabilityFormFiltersItem({
  supportedFilters,
  isViewMode = false,
}: Readonly<ObservabilityFormFiltersItemProps>) {
  const { t } = useTranslation();

  const form = Form.useFormInstance();

  // Watchers
  const selectedFilters = Form.useWatch<EventFilterRule[]>(
    ['input', 'filters'],
    form
  );
  const [selectedTrigger] =
    Form.useWatch<CreateEventSubscription['resources']>(['resources'], form) ??
    [];

  // Run time values needed for conditional rendering
  const filterOptions = useMemo(() => {
    return getSupportedFilterOptions(selectedFilters, supportedFilters);
  }, [selectedFilters, supportedFilters]);

  return (
    <FormCardSection
      heading={t('label.filter-plural')}
      subHeading={t('message.alerts-filter-description')}>
      <Form.List name={['input', 'filters']}>
        {(fields, { add, remove }, { errors }) => {
          const showAddFilterButton =
            fields.length < (supportedFilters?.length ?? 1) && !isViewMode;

          return (
            <Row data-testid="filters-list" gutter={[16, 16]} key="filters">
              {fields.map(({ key, name }) => {
                const effect =
                  form.getFieldValue(['input', 'filters', name, 'effect']) ??
                  Effect.Include;

                const showConditionalFields =
                  !isEmpty(selectedFilters) && selectedFilters[name];

                return (
                  <Col
                    data-testid={`filter-${name}`}
                    key={`observability-${key}`}
                    span={24}>
                    <div className="flex gap-4">
                      <div className="flex-1 w-min-0">
                        <Row gutter={[8, 8]}>
                          <Col span={12}>
                            <Form.Item
                              key={`filter-${key}`}
                              name={[name, 'name']}
                              rules={[
                                {
                                  required: true,
                                  message: t('message.field-text-is-required', {
                                    fieldText: t('label.filter'),
                                  }),
                                },
                              ]}>
                              <Select
                                data-testid={`filter-select-${name}`}
                                options={filterOptions}
                                placeholder={t('label.select-field', {
                                  field: t('label.filter'),
                                })}
                                onChange={() => {
                                  form.setFieldValue(
                                    ['input', 'filters', name, 'arguments'],
                                    []
                                  );
                                }}
                              />
                            </Form.Item>
                          </Col>
                          {showConditionalFields &&
                            getConditionalField(
                              selectedFilters[name].name ?? '',
                              name,
                              selectedTrigger,
                              supportedFilters
                            )}
                        </Row>
                      </div>

                      {!isViewMode && (
                        <Button
                          data-testid={`remove-filter-${name}`}
                          icon={<CloseOutlined />}
                          onClick={() => remove(name)}
                        />
                      )}
                    </div>
                    <Form.Item
                      label={
                        <Typography.Text>{t('label.include')}</Typography.Text>
                      }
                      name={[name, 'effect']}
                      normalize={(value) =>
                        value ? Effect.Include : Effect.Exclude
                      }>
                      <Switch
                        checked={effect === Effect.Include}
                        data-testid={`filter-switch-${name}`}
                      />
                    </Form.Item>
                  </Col>
                );
              })}
              {showAddFilterButton ? (
                <Col span={24}>
                  <Button
                    data-testid="add-filters"
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
                      entity: t('label.filter'),
                    })}
                  </Button>
                </Col>
              ) : null}
              <Form.ErrorList errors={errors} />
            </Row>
          );
        }}
      </Form.List>
    </FormCardSection>
  );
}

export default ObservabilityFormFiltersItem;
