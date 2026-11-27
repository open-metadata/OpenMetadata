/*
 *  Copyright 2026 Collate.
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

import {
  Box,
  DatePicker,
  FormField,
  FormItemLabel,
  Grid,
  HintText,
  Input,
  Select,
  Slider,
} from '@openmetadata/ui-core-components';
import { DateTime } from 'luxon';
import { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { KpiTargetType } from '../../generated/dataInsight/kpi/kpi';
import { useStagedPickerValue } from '../../hooks/useStagedPickerValue';
import {
  dateValueToMillis,
  millisToPickerDateValue,
  PickerDateValue,
} from '../../utils/date-time/calendarDate.utils';
import { KPIMetricTypeOptions } from '../../utils/KPI/KPIUtils';
import { KPIFormValues } from './KPIPage.interface';

const toPickerValue = (value: DateTime | null) =>
  millisToPickerDateValue(value?.toMillis());

const fromPickerValue = (value: PickerDateValue | null | undefined) =>
  value ? DateTime.fromMillis(dateValueToMillis(value)) : null;

interface KPIFormFieldsProps {
  form: UseFormReturn<KPIFormValues>;
  chartItems: Array<{ id: string; label: string }>;
  /** Chart and metric type identify a KPI, so they are fixed once it exists. */
  isEditing?: boolean;
}

const METRIC_TYPE_ITEMS = KPIMetricTypeOptions.map(({ label, value }) => ({
  id: value,
  label,
}));

/** The add/edit KPI fields; the page owns the form, description and actions. */
const KPIFormFields = ({ form, chartItems, isEditing }: KPIFormFieldsProps) => {
  const { t } = useTranslation();
  const metricType = form.watch('metricType');
  const startLabel = t('label.start-entity', { entity: t('label.date') });
  const todayValue = toPickerValue(DateTime.now());

  // A start date counts from the start of its day; an end date before it moves the start back.
  const handleStartDate = (value: DateTime | null) => {
    const startDate = value?.startOf('day') ?? null;
    const endDate = form.getValues('endDate');
    form.setValue('startDate', startDate, { shouldValidate: true });
    if (startDate && endDate && startDate > endDate) {
      form.setValue('endDate', null);
    }
  };

  const handleEndDate = (value: DateTime | null) => {
    const startDate = form.getValues('startDate');
    let endDate = value?.endOf('day') ?? null;
    if (endDate && startDate && endDate < startDate) {
      endDate = endDate.startOf('day');
      form.setValue('startDate', endDate);
    }
    form.setValue('endDate', endDate, { shouldValidate: true });
  };

  const startPicker = useStagedPickerValue(
    toPickerValue(form.watch('startDate')),
    (value) => handleStartDate(fromPickerValue(value))
  );
  const endPicker = useStagedPickerValue(
    toPickerValue(form.watch('endDate')),
    (value) => handleEndDate(fromPickerValue(value))
  );

  return (
    <>
      <FormField
        control={form.control}
        name="chartType"
        rules={{
          required: t('message.field-text-is-required', {
            fieldText: t('label.data-insight-chart'),
          }),
        }}>
        {({ field, fieldState }) => (
          <Select
            isRequired
            data-testid="chartType"
            hint={fieldState.error?.message}
            isDisabled={isEditing}
            isInvalid={fieldState.invalid}
            items={chartItems}
            label={t('label.select-a-chart')}
            placeholder={t('label.select-a-chart')}
            value={field.value}
            onChange={(key) => key !== null && field.onChange(String(key))}>
            {(item) => <Select.Item id={item.id} label={item.label} />}
          </Select>
        )}
      </FormField>

      <FormField control={form.control} name="displayName">
        {({ field }) => (
          <Input
            inputDataTestId="displayName"
            label={t('label.display-name')}
            placeholder={t('label.kpi-display-name')}
            value={field.value}
            onBlur={field.onBlur}
            onChange={field.onChange}
          />
        )}
      </FormField>

      <FormField control={form.control} name="metricType">
        {({ field }) => (
          <Select
            data-testid="metricType"
            isDisabled={isEditing}
            items={METRIC_TYPE_ITEMS}
            label={t('label.metric-type')}
            value={field.value}
            onChange={(key) =>
              key !== null && field.onChange(key as KpiTargetType)
            }>
            {(item) => <Select.Item id={item.id} label={item.label} />}
          </Select>
        )}
      </FormField>

      <FormField
        control={form.control}
        name="targetValue"
        rules={{
          validate: (value) => {
            if (Number.isNaN(value) || value < 0) {
              return t('message.field-text-is-required', {
                fieldText: t('label.metric-value'),
              });
            }

            // A percentage target is capped at 100, as the antd InputNumber max did.
            return (
              form.getValues('metricType') !== KpiTargetType.Percentage ||
              value <= 100 ||
              t('message.entity-size-in-between', {
                entity: t('label.metric-value'),
                min: 0,
                max: 100,
              })
            );
          },
        }}>
        {({ field, fieldState }) => {
          const isPercentage = metricType === KpiTargetType.Percentage;
          const valueInput = (
            <Input
              aria-label={t('label.metric-value')}
              inputDataTestId={isPercentage ? undefined : 'metric-number-input'}
              label={isPercentage ? undefined : t('label.metric-value')}
              type="number"
              value={String(field.value ?? '')}
              onChange={(value) =>
                field.onChange(value === '' ? Number.NaN : Number(value))
              }
            />
          );

          return (
            <Box direction="col">
              {isPercentage ? (
                <Grid className="tw:items-center" colGap="2">
                  <Grid.Item span={20}>
                    <Slider
                      aria-label={t('label.metric-value')}
                      className="tw:mx-3"
                      maxValue={100}
                      minValue={0}
                      value={Number.isNaN(field.value) ? 0 : field.value}
                      onChange={(value) =>
                        field.onChange(Array.isArray(value) ? value[0] : value)
                      }
                    />
                  </Grid.Item>
                  <Grid.Item span={4}>{valueInput}</Grid.Item>
                </Grid>
              ) : (
                valueInput
              )}
              {fieldState.error && (
                <HintText isInvalid>{fieldState.error.message}</HintText>
              )}
            </Box>
          );
        }}
      </FormField>

      <Grid gap="2">
        <Grid.Item span={12}>
          <FormField
            control={form.control}
            name="startDate"
            rules={{
              required: t('label.field-required', { field: startLabel }),
            }}>
            {({ fieldState }) => (
              <Box className="tw:gap-1.5" direction="col">
                <FormItemLabel required label={startLabel} />
                <DatePicker
                  aria-label={startLabel}
                  data-testid="start-date"
                  id="startDate"
                  isInvalid={Boolean(fieldState.error)}
                  minValue={todayValue}
                  triggerVariant="input"
                  {...startPicker}
                />
                {fieldState.error && (
                  <HintText isInvalid>{fieldState.error.message}</HintText>
                )}
              </Box>
            )}
          </FormField>
        </Grid.Item>
        <Grid.Item span={12}>
          <FormField
            control={form.control}
            name="endDate"
            rules={{
              required: t('label.field-required', {
                field: t('label.end-date'),
              }),
            }}>
            {({ fieldState }) => (
              <Box className="tw:gap-1.5" direction="col">
                <FormItemLabel required label={t('label.end-date')} />
                <DatePicker
                  aria-label={t('label.end-date')}
                  data-testid="end-date"
                  id="endDate"
                  isInvalid={Boolean(fieldState.error)}
                  minValue={todayValue}
                  triggerVariant="input"
                  {...endPicker}
                />
                {fieldState.error && (
                  <HintText isInvalid>{fieldState.error.message}</HintText>
                )}
              </Box>
            )}
          </FormField>
        </Grid.Item>
      </Grid>
    </>
  );
};

export default KPIFormFields;
