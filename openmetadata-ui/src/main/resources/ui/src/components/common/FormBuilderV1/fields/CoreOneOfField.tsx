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

import { Select } from '@openmetadata/ui-core-components';
import {
  FieldProps,
  getDiscriminatorFieldFromSchema,
  RJSFSchema,
} from '@rjsf/utils';
import { startCase } from 'lodash';
import { Key, useCallback, useEffect, useMemo, useState } from 'react';

const getSafeOptionIndex = (option: number, optionCount: number) => {
  if (optionCount === 0) {
    return -1;
  }

  return option >= 0 && option < optionCount ? option : 0;
};

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
    getSafeOptionIndex(
      getMatchingOption(0, formData, resolvedOptions),
      resolvedOptions.length
    )
  );

  useEffect(() => {
    setSelectedOption((currentOption) => {
      if (resolvedOptions.length <= 1) {
        return getSafeOptionIndex(currentOption, resolvedOptions.length);
      }

      const matchingOption = getMatchingOption(
        currentOption,
        formData,
        resolvedOptions
      );

      return getSafeOptionIndex(
        matchingOption !== currentOption ? matchingOption : currentOption,
        resolvedOptions.length
      );
    });
  }, [formData, getMatchingOption, resolvedOptions]);

  const safeSelectedOption = getSafeOptionIndex(
    selectedOption,
    resolvedOptions.length
  );
  const hasMultipleOptions = resolvedOptions.length > 1;
  const selectedSchema =
    safeSelectedOption >= 0 ? resolvedOptions[safeSelectedOption] ?? {} : {};
  const optionItems = useMemo(
    () =>
      resolvedOptions.map((option, index) => ({
        id: String(index),
        label:
          option.title ??
          startCase(
            typeof option.type === 'string'
              ? option.type
              : `Option ${index + 1}`
          ),
      })),
    [resolvedOptions]
  );

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

  const selectedFieldUiSchema = useMemo(() => {
    const childUiSchema = { ...(uiSchema ?? {}) };

    delete childUiSchema['ui:field'];

    return childUiSchema;
  }, [uiSchema]);

  const handleOptionChange = (newIndex: number) => {
    if (newIndex === safeSelectedOption) {
      return;
    }

    const newSchema = resolvedOptions[newIndex];
    const currentSchema =
      safeSelectedOption >= 0 ? resolvedOptions[safeSelectedOption] : undefined;
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

    setSelectedOption(getSafeOptionIndex(newIndex, resolvedOptions.length));
    onChange(
      newFormData ?? undefined,
      undefined,
      `${idSchema.$id}${schema.oneOf ? '__oneof_select' : '__anyof_select'}`
    );
  };

  const fieldLabel = label ?? schema.title ?? startCase(name);
  const selectedKey =
    hasMultipleOptions && safeSelectedOption >= 0
      ? String(safeSelectedOption)
      : null;

  return (
    <div
      className="core-one-of-field tw:flex tw:flex-col tw:gap-3"
      data-field-id={idSchema.$id}>
      {hasMultipleOptions && (
        <Select
          className="core-one-of-field-select"
          data-testid={`select-widget-${idSchema.$id}${
            schema.oneOf ? '__oneof_select' : '__anyof_select'
          }`}
          fontSize="sm"
          isDisabled={disabled || readonly}
          isRequired={required}
          items={optionItems}
          label={hideLabel ? undefined : fieldLabel}
          popoverClassName="core-one-of-field-select-popover"
          selectedKey={selectedKey}
          size="sm"
          onSelectionChange={(key: Key | null) => {
            if (key !== null) {
              handleOptionChange(Number(key));
            }
          }}>
          {(item) => (
            <Select.Item id={item.id} key={item.id} textValue={item.label}>
              {item.label}
            </Select.Item>
          )}
        </Select>
      )}

      <div className="core-one-of-field-selected">
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
          uiSchema={selectedFieldUiSchema}
          onBlur={onBlur}
          onChange={onChange}
          onFocus={onFocus}
        />
      </div>
    </div>
  );
};

export default CoreOneOfField;
