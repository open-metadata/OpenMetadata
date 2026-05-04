/*
 *  Copyright 2025 Collate.
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
  RadioButton,
  RadioGroup,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  FieldProps,
  getDiscriminatorFieldFromSchema,
  RJSFSchema,
} from '@rjsf/utils';
import { startCase } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';

const CoreOneOfField = (props: FieldProps) => {
  const {
    schema,
    formData,
    onChange,
    registry,
    uiSchema,
    idSchema,
    errorSchema,
    disabled,
    readonly,
    required,
    idPrefix,
    idSeparator,
    onBlur,
    onFocus,
    name,
    label,
    hideLabel,
    hideError,
    autofocus,
    rawErrors,
    formContext,
  } = props;

  const { schemaUtils, fields } = registry;
  const { SchemaField } = fields;

  const options = useMemo(
    () => (schema.oneOf ?? schema.anyOf ?? []) as RJSFSchema[],
    [schema.oneOf, schema.anyOf]
  );

  const resolvedOptions = useMemo(
    () => options.map((opt) => schemaUtils.retrieveSchema(opt, formData)),
    [options, formData, schemaUtils]
  );

  const getMatchingOption = useCallback(
    (currentOption: number, data: unknown, fieldOptions: RJSFSchema[]) =>
      schemaUtils.getClosestMatchingOption(
        data,
        fieldOptions,
        currentOption,
        getDiscriminatorFieldFromSchema(schema)
      ),
    [schema, schemaUtils]
  );

  const [selectedOption, setSelectedOption] = useState(() =>
    getMatchingOption(0, formData, resolvedOptions)
  );

  useEffect(() => {
    setSelectedOption((currentOption) => {
      const matchingOption = getMatchingOption(
        currentOption,
        formData,
        resolvedOptions
      );

      return matchingOption !== currentOption ? matchingOption : currentOption;
    });
  }, [formData, getMatchingOption, resolvedOptions]);

  const selectedSchema = resolvedOptions[selectedOption] ?? {};

  const selectedIdSchema = useMemo(
    () =>
      schemaUtils.toIdSchema(
        selectedSchema,
        idSchema.$id,
        formData,
        idPrefix ?? '',
        idSeparator ?? '/'
      ),
    [selectedSchema, idSchema.$id, formData, idPrefix, idSeparator, schemaUtils]
  );

  const handleOptionChange = (newIndex: number) => {
    if (newIndex === selectedOption) {
      return;
    }

    const newSchema = resolvedOptions[newIndex];
    const currentSchema =
      selectedOption >= 0 ? resolvedOptions[selectedOption] : undefined;
    const sanitizedFormData = schemaUtils.sanitizeDataForNewSchema(
      newSchema,
      currentSchema,
      formData
    );
    const newFormData = newSchema
      ? schemaUtils.getDefaultFormState(
          newSchema,
          sanitizedFormData,
          'excludeObjectChildren'
        )
      : sanitizedFormData;

    setSelectedOption(newIndex);
    onChange(
      newFormData ?? undefined,
      undefined,
      `${idSchema.$id}${schema.oneOf ? '__oneof_select' : '__anyof_select'}`
    );
  };

  const fieldLabel = label ?? schema.title ?? startCase(name);

  return (
    <div className="tw:flex tw:flex-col tw:gap-4">
      {!hideLabel && fieldLabel && (
        <div className="tw:flex tw:items-center tw:gap-0.5">
          <Typography
            as="label"
            className="tw:text-primary"
            id={`${idSchema.$id}__title`}
            size="text-sm"
            weight="semibold">
            {fieldLabel}
          </Typography>
          {required && (
            <span className="tw:text-[var(--color-error-primary)] tw:text-sm">
              *
            </span>
          )}
        </div>
      )}
      <RadioGroup
        className="tw:flex tw:flex-row tw:flex-wrap tw:gap-3"
        isDisabled={disabled || readonly}
        value={String(selectedOption)}
        onChange={(val) => handleOptionChange(Number(val))}>
        {resolvedOptions.map((option, index) => {
          const optTitle =
            option.title ??
            startCase(
              typeof option.type === 'string'
                ? option.type
                : `Option ${index + 1}`
            );

          return (
            <RadioButton
              className={(renderProps) =>
                `tw:flex-1 tw:min-w-[140px] tw:rounded-xl tw:border tw:px-4 tw:py-3 tw:transition-colors ${
                  renderProps.isSelected
                    ? 'tw:border-primary'
                    : 'tw:border-secondary tw:bg-primary hover:tw:border-brand-300'
                }`
              }
              key={index}
              label={optTitle}
              value={String(index)}
            />
          );
        })}
      </RadioGroup>

      <SchemaField
        autofocus={autofocus}
        disabled={disabled}
        errorSchema={errorSchema}
        formContext={formContext}
        formData={formData}
        hideError={hideError}
        hideLabel={hideLabel}
        idPrefix={idPrefix}
        idSchema={selectedIdSchema}
        idSeparator={idSeparator}
        name={name}
        rawErrors={rawErrors}
        readonly={readonly}
        registry={registry}
        required={required}
        schema={selectedSchema}
        uiSchema={uiSchema}
        onBlur={onBlur}
        onChange={onChange}
        onFocus={onFocus}
      />
    </div>
  );
};

export default CoreOneOfField;
