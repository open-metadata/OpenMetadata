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
import { Effect } from '../../../generated/events/api/createEventSubscription';
import { EventFilterRule } from '../../../generated/events/eventSubscription';
import { useAlertSelectionContext } from '../../../hooks/useAlertSelection';
import {
  getConditionalField,
  getSupportedFilterOptions,
} from '../../../utils/Alerts/AlertsUtil';
import { getLayoutGutter } from '../../../utils/common/layout.utils';
import { ObservabilityFormFiltersItemProps } from './ObservabilityFormFiltersItem.interface';

function ObservabilityFormFiltersItem({
  isViewMode = false,
}: Readonly<ObservabilityFormFiltersItemProps>) {
  const { t } = useTranslation();
  const { sources, support, search } = useAlertSelectionContext();
  const { supportedFilters, supportedEventTypes } = support;

  const form = Form.useFormInstance();

  // Watchers
  const selectedFilters = Form.useWatch<EventFilterRule[]>(
    ['input', 'filters'],
    form
  );
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
            <Grid
              className="layout-row layout-grid"
              data-testid="filters-list"
              key="filters"
              style={{ ...getLayoutGutter(16, 16) }}>
              {fields.map(({ key, name }) => {
                const effect =
                  form.getFieldValue(['input', 'filters', name, 'effect']) ??
                  Effect.Include;

                const showConditionalFields =
                  !isEmpty(selectedFilters) && selectedFilters[name];

                return (
                  <Grid.Item
                    className="layout-column"
                    data-testid={`filter-${name}`}
                    key={`observability-${key}`}
                    span={24}>
                    <div className="flex gap-4">
                      <div className="flex-1 w-min-0">
                        <Grid
                          className="layout-row layout-grid"
                          style={{ ...getLayoutGutter(8, 8) }}>
                          <Grid.Item className="layout-column" span={12}>
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
                          </Grid.Item>
                          {showConditionalFields &&
                            getConditionalField(
                              selectedFilters[name].name ?? '',
                              name,
                              search,
                              supportedFilters,
                              supportedEventTypes
                            )}
                        </Grid>
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
                      label={<Typography>{t('label.include')}</Typography>}
                      name={[name, 'effect']}
                      normalize={(value) =>
                        value ? Effect.Include : Effect.Exclude
                      }>
                      <Toggle
                        data-testid={`filter-switch-${name}`}
                        isDisabled={isViewMode}
                        isSelected={effect === Effect.Include}
                        size="sm"
                      />
                    </Form.Item>
                  </Grid.Item>
                );
              })}
              {showAddFilterButton ? (
                <Grid.Item className="layout-column" span={24}>
                  <Button
                    data-testid="add-filters"
                    disabled={isEmpty(sources)}
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
                </Grid.Item>
              ) : null}
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

export default ObservabilityFormFiltersItem;
