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

import { Box, Select, Typography } from '@openmetadata/ui-core-components';
import {
  FieldProps,
  getDiscriminatorFieldFromSchema,
  RJSFSchema,
} from '@rjsf/utils';
import { Hexagon01 } from '@untitledui/icons';
import classNames from 'classnames';
import { Key, useCallback, useEffect, useMemo, useState } from 'react';
import { getFormDisplayLabel } from '../formBuilderV1LabelUtils';

const SAMPLE_DATA_STORAGE_CONFIG_ID = '/sampleDataStorageConfig';
const STORAGE_CONFIG_ID_SUFFIX =
  '/sampleDataStorageConfig/config/storageConfig';
const AWS_S3_STORAGE_CONFIG_TITLE = 'AWS S3 Storage Config';
const MAX_SEGMENTED_OPTION_COUNT = 3;
const MAX_SEGMENTED_OPTION_LABEL_LENGTH = 28;
const COMPACT_SELECTOR_ID_PATTERN = /(source|projectId)$/i;

const isObjectLikeSchema = (option: RJSFSchema): boolean =>
  option.type === 'object' || Boolean(option.properties);

const getSafeOptionIndex = (option: number, optionCount: number) => {
  if (optionCount === 0) {
    return -1;
  }

  return option >= 0 && option < optionCount ? option : 0;
};

const getOptionTitle = (option: RJSFSchema, index: number): string =>
  getFormDisplayLabel(
    option.title ??
      (typeof option.type === 'string' ? option.type : `Option ${index + 1}`)
  );

const shouldRenderSegmentedOptions = (
  id: string,
  options: RJSFSchema[]
): boolean => {
  const optionLabels = options.map(getOptionTitle);

  return (
    options.length > 1 &&
    options.length <= MAX_SEGMENTED_OPTION_COUNT &&
    !id.includes(SAMPLE_DATA_STORAGE_CONFIG_ID) &&
    !COMPACT_SELECTOR_ID_PATTERN.test(id) &&
    optionLabels.every(
      (label) => label.length <= MAX_SEGMENTED_OPTION_LABEL_LENGTH
    ) &&
    options.every(isObjectLikeSchema)
  );
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
  const shouldRenderAsTabs = shouldRenderSegmentedOptions(
    idSchema.$id,
    resolvedOptions
  );
  const selectedBranchIsObjectLike = isObjectLikeSchema(selectedSchema);
  const shouldRenderInlineSelectedBranch =
    hasMultipleOptions && !selectedBranchIsObjectLike && !shouldRenderAsTabs;
  const shouldSuppressSelectedBranchLabel =
    hasMultipleOptions && selectedBranchIsObjectLike;
  const isStorageConfigSelector = idSchema.$id.endsWith(
    STORAGE_CONFIG_ID_SUFFIX
  );
  const recommendedTitle = (uiSchema?.['ui:options']?.recommended ??
    undefined) as string | undefined;

  const optionItems = useMemo(
    () =>
      resolvedOptions.map((option, index) => {
        const label = getOptionTitle(option, index);

        return {
          icon:
            isStorageConfigSelector && label === AWS_S3_STORAGE_CONFIG_TITLE ? (
              <Hexagon01
                aria-hidden="true"
                data-testid="storage-config-title-icon"
                size={16}
              />
            ) : undefined,
          id: String(index),
          isRecommended: recommendedTitle === label,
          label,
        };
      }),
    [isStorageConfigSelector, recommendedTitle, resolvedOptions]
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
    delete childUiSchema['ui:fieldReplacesAnyOrOneOf'];

    return shouldSuppressSelectedBranchLabel
      ? { ...childUiSchema, 'ui:label': false }
      : childUiSchema;
  }, [shouldSuppressSelectedBranchLabel, uiSchema]);

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

  const fieldLabel = label ?? schema.title ?? getFormDisplayLabel(name);
  const selectedKey =
    hasMultipleOptions && safeSelectedOption >= 0
      ? String(safeSelectedOption)
      : null;
  const selectedSchemaForRender =
    hasMultipleOptions && selectedSchema
      ? {
          ...selectedSchema,
          description: undefined,
          ...(shouldSuppressSelectedBranchLabel ? { title: undefined } : {}),
        }
      : selectedSchema;
  const selectedDescription =
    hasMultipleOptions && typeof selectedSchema.description === 'string'
      ? selectedSchema.description
      : undefined;

  return (
    <div
      className={classNames(
        'core-one-of-field',
        shouldRenderInlineSelectedBranch
          ? 'core-one-of-field-inline-selected tw:grid tw:[grid-template-columns:repeat(2,minmax(0,1fr))] tw:[gap:16px] tw:items-start tw:w-full tw:min-w-0'
          : 'tw:flex tw:flex-col tw:gap-4'
      )}
      data-field-id={idSchema.$id}>
      {hasMultipleOptions && shouldRenderAsTabs && (
        <div className="core-one-of-field-tabs tw:flex tw:flex-col tw:gap-1">
          {!hideLabel && fieldLabel && (
            <span
              className="core-one-of-field-tabs-label tw:text-sm tw:font-medium tw:text-secondary"
              id={`${idSchema.$id}__title`}>
              {fieldLabel}
            </span>
          )}
          <div
            aria-label={fieldLabel}
            className="tw:grid tw:gap-1 tw:rounded-lg tw:border tw:border-primary tw:bg-secondary tw:p-1"
            role="tablist"
            style={{
              gridTemplateColumns: `repeat(${resolvedOptions.length}, minmax(0, 1fr))`,
            }}>
            {optionItems.map((item) => {
              const isSelected = selectedKey === item.id;

              return (
                <button
                  aria-selected={isSelected}
                  className={classNames(
                    'tw:flex tw:min-h-10 tw:items-center tw:justify-center tw:rounded-lg tw:border tw:px-3 tw:py-2 tw:text-center tw:text-sm tw:leading-5 tw:transition-colors',
                    isSelected
                      ? 'tw:border-primary tw:bg-primary tw:font-medium tw:text-primary tw:shadow-xs'
                      : 'tw:border-transparent tw:font-medium tw:text-tertiary'
                  )}
                  data-selected={isSelected}
                  data-testid={`oneof-option-${item.id}`}
                  key={item.id}
                  role="tab"
                  type="button"
                  onClick={() => handleOptionChange(Number(item.id))}>
                  {item.label}
                  {item.isRecommended && isSelected && (
                    <span
                      className="tw:size-1.5 tw:rounded-full tw:bg-fg-success-primary"
                      data-testid="recommended-indicator"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <Box direction="col" gap={1}>
        {hasMultipleOptions && !shouldRenderAsTabs && (
          <Select
            className={classNames(
              'core-one-of-field-select',
              shouldRenderInlineSelectedBranch &&
                'tw:col-start-1 tw:self-stretch tw:w-full'
            )}
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
              <Select.Item
                icon={item.icon}
                id={item.id}
                key={item.id}
                textValue={item.label}>
                {item.label}
              </Select.Item>
            )}
          </Select>
        )}

        {selectedDescription && (
          <Typography as="span" className="tw:text-tertiary" size="text-xs">
            {selectedDescription}
          </Typography>
        )}
      </Box>

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
          schema={selectedSchemaForRender}
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
