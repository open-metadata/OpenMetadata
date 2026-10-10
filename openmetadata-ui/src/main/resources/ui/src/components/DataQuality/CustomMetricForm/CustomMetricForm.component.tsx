/*
 *  Copyright 2023 Collate.
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
import { EditorView } from '@codemirror/view';
import {
  Box,
  FormField,
  FormItemLabel,
  HintText,
  HookForm,
  Input,
  Select,
} from '@openmetadata/ui-core-components';
import QueryString from 'qs';
import { lazy, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ENTITY_NAME_REGEX } from '../../../constants/regex.constants';
import { CSMode } from '../../../enums/codemirror.enum';
import { CustomMetric } from '../../../generated/tests/customMetric';
import useCustomLocation from '../../../hooks/useCustomLocation/useCustomLocation';
import { getEntityName } from '../../../utils/EntityNameUtils';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import { CustomMetricFormProps } from './CustomMetricForm.interface';

const SchemaEditor = withSuspenseFallback(
  lazy(() => import('../../Database/SchemaEditor/SchemaEditor'))
);

const CustomMetricForm = ({
  isColumnMetric,
  initialValues,
  onFinish,
  form,
  table,
  isEditMode = false,
}: CustomMetricFormProps) => {
  const { t } = useTranslation();
  const location = useCustomLocation();
  const localForm = useForm<CustomMetric>({
    defaultValues: { name: '', expression: '', ...initialValues },
  });
  const activeForm = form ?? localForm;
  const { reset, getValues } = activeForm;
  const queryLabel = t('label.sql-uppercase-query');
  const queryError = activeForm.formState.errors.expression?.message;
  const queryExtensions = useMemo(
    () => [
      EditorView.contentAttributes.of({
        'aria-label': queryLabel,
        'aria-invalid': String(Boolean(queryError)),
        ...(queryError ? { 'aria-describedby': 'metric-query-error' } : {}),
      }),
    ],
    [queryLabel, queryError]
  );

  const { activeColumnFqn } = useMemo(() => {
    const param = location.search;

    return QueryString.parse(
      param.startsWith('?') ? param.substring(1) : param
    ) as { activeColumnFqn: string };
  }, [location.search]);

  const { metricNames, columnOptions } = useMemo(() => {
    const customMetrics = isColumnMetric
      ? table?.columns?.find(
          (column) => column.fullyQualifiedName === activeColumnFqn
        )?.customMetrics ?? []
      : table?.customMetrics ?? [];

    return {
      metricNames: customMetrics.map((metric) => metric.name),
      columnOptions:
        table?.columns.map((column) => ({
          id: column.name,
          label: getEntityName(column),
        })) ?? [],
    };
  }, [activeColumnFqn, isColumnMetric, table]);

  useEffect(() => {
    if (initialValues) {
      reset({ ...getValues(), ...initialValues });
    }
  }, [initialValues, reset, getValues]);

  return (
    <HookForm
      className="tw:mb-6"
      data-testid="custom-metric-form"
      form={activeForm}
      id="custom-metric-form"
      validationBehavior="aria"
      onSubmit={activeForm.handleSubmit(({ name, expression, columnName }) =>
        onFinish({
          name,
          expression,
          ...(isColumnMetric ? { columnName } : {}),
        })
      )}>
      <Box direction="col" gap={6}>
        <FormField
          control={activeForm.control}
          name="name"
          rules={{
            required: t('label.field-required', { field: t('label.name') }),
            maxLength: {
              value: 128,
              message: t('message.entity-size-in-between', {
                entity: t('label.name'),
                min: 1,
                max: 128,
              }),
            },
            pattern: {
              value: ENTITY_NAME_REGEX,
              message: t('message.entity-name-validation'),
            },
            validate: (value) =>
              isEditMode ||
              !metricNames.includes(value) ||
              t('message.entity-already-exists', {
                entity: t('label.custom-metric'),
              }),
          }}>
          {({ field, fieldState }) => (
            <Input
              {...field}
              isRequired
              hint={fieldState.error?.message}
              inputDataTestId="custom-metric-name"
              isDisabled={isEditMode}
              isInvalid={!!fieldState.error}
              label={t('label.name')}
              placeholder={t('label.enter-entity', { entity: t('label.name') })}
            />
          )}
        </FormField>
        {isColumnMetric && (
          <FormField
            control={activeForm.control}
            name="columnName"
            rules={{
              required: t('message.field-text-is-required', {
                fieldText: t('label.column'),
              }),
            }}>
            {({ field, fieldState }) => (
              <Select
                isRequired
                data-testid="custom-metric-column"
                hint={fieldState.error?.message}
                isDisabled={isEditMode}
                isInvalid={!!fieldState.error}
                items={columnOptions}
                label={t('label.column')}
                placeholder={t('label.please-select-entity', {
                  entity: t('label.column'),
                })}
                selectedKey={field.value ?? null}
                onBlur={field.onBlur}
                onSelectionChange={(key) =>
                  field.onChange(key === null ? undefined : String(key))
                }>
                {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
              </Select>
            )}
          </FormField>
        )}
        <FormField
          control={activeForm.control}
          name="expression"
          rules={{
            required: t('message.field-text-is-required', {
              fieldText: queryLabel,
            }),
          }}>
          {({ field }) => (
            <Box data-testid="sql-editor-container" direction="col" gap={2}>
              <FormItemLabel required label={queryLabel} />
              <SchemaEditor
                className="custom-query-editor query-editor-h-200 custom-code-mirror-theme"
                extensions={queryExtensions}
                mode={{ name: CSMode.SQL }}
                showCopyButton={false}
                value={field.value}
                onChange={field.onChange}
              />
              {queryError && (
                <HintText isInvalid id="metric-query-error">
                  {queryError}
                </HintText>
              )}
            </Box>
          )}
        </FormField>
      </Box>
    </HookForm>
  );
};

export default CustomMetricForm;
