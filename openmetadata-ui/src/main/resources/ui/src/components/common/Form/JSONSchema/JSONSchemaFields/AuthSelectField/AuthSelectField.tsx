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

import { Typography } from '@openmetadata/ui-core-components';
import {
  FieldProps,
  getDiscriminatorFieldFromSchema,
  RJSFSchema,
} from '@rjsf/utils';
import { InfoCircle, Key01, Lock01 } from '@untitledui/icons';
import classNames from 'classnames';
import { startCase } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Radio as AriaRadio,
  RadioGroup as AriaRadioGroup,
} from 'react-aria-components';
import { Transi18next } from '../../../../../../utils/i18next/LocalUtil';

const KEY_BASED_METHOD = /(key|iam|token|certificate|azure|gcp|jwt|oauth|sso)/i;

const getMethodIcon = (title: string) =>
  KEY_BASED_METHOD.test(title) ? Key01 : Lock01;

const getOptionTitle = (option: RJSFSchema, index: number): string =>
  option.title ??
  startCase(
    typeof option.type === 'string' ? option.type : `option ${index + 1}`
  );

/**
 * Generic RJSF field that renders a `oneOf` of credential branches (e.g. an
 * `authType` property) as a segmented control where exactly one method's fields
 * are ever shown. Switching methods clears the previously selected branch's
 * data, which is the "password OR key, never both" guarantee. Activated via
 * `ui:field: 'authSelect'` — see {@link getUISchemaWithAuthFieldsAsSelect}.
 */
const AuthSelectField = (props: FieldProps) => {
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

  const recommendedTitle = (uiSchema?.['ui:options']?.recommended ??
    undefined) as string | undefined;

  const handleOptionChange = (newIndex: number) => {
    if (newIndex !== selectedOption) {
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
    }
  };

  const fieldLabel = label ?? schema.title ?? startCase(name);
  const activeTitle = getOptionTitle(selectedSchema, selectedOption);

  return (
    <div
      className="tw:flex tw:flex-col tw:gap-4"
      data-testid="auth-select-field"
      onFocusCapture={() => onFocus?.(idSchema.$id, formData)}>
      {!hideLabel && fieldLabel && (
        <div className="tw:flex tw:items-center tw:gap-0.5">
          <Typography
            as="label"
            className="tw:text-secondary"
            id={`${idSchema.$id}__title`}
            size="text-sm"
            weight="semibold">
            {fieldLabel}
          </Typography>
          {required && (
            <Typography
              as="span"
              className="tw:text-error-primary"
              size="text-sm">
              *
            </Typography>
          )}
        </div>
      )}

      <AriaRadioGroup
        aria-label={fieldLabel}
        className="tw:grid tw:gap-1 tw:rounded-[10px] tw:border tw:border-primary tw:bg-secondary tw:p-1"
        isDisabled={disabled || readonly}
        style={{
          gridTemplateColumns: `repeat(${resolvedOptions.length}, minmax(0, 1fr))`,
        }}
        value={String(selectedOption)}
        onChange={(val) => handleOptionChange(Number(val))}>
        {resolvedOptions.map((option, index) => {
          const optTitle = getOptionTitle(option, index);
          const MethodIcon = getMethodIcon(optTitle);
          const isRecommended = recommendedTitle === optTitle;

          return (
            <AriaRadio
              className={({ isSelected }) =>
                classNames(
                  'tw:flex tw:cursor-pointer tw:items-center tw:justify-center tw:gap-2 tw:rounded-[7px] tw:border tw:px-3 tw:py-2.5 tw:transition-colors',
                  isSelected
                    ? 'tw:border-primary tw:bg-primary tw:shadow-xs'
                    : 'tw:border-transparent'
                )
              }
              data-testid={`auth-method-${index}`}
              key={index}
              value={String(index)}>
              {({ isSelected }) => (
                <>
                  <MethodIcon
                    className={
                      isSelected
                        ? 'tw:text-brand-secondary'
                        : 'tw:text-fg-quaternary'
                    }
                    size={16}
                  />
                  <Typography
                    as="span"
                    className={
                      isSelected ? 'tw:text-primary' : 'tw:text-tertiary'
                    }
                    size="text-sm"
                    weight={isSelected ? 'semibold' : 'medium'}>
                    {optTitle}
                  </Typography>
                  {isRecommended && isSelected && (
                    <span
                      className="tw:size-1.5 tw:rounded-full tw:bg-fg-success-primary"
                      data-testid="recommended-indicator"
                    />
                  )}
                </>
              )}
            </AriaRadio>
          );
        })}
      </AriaRadioGroup>

      <div className="tw:flex tw:flex-col tw:gap-4">
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
          schema={{ ...selectedSchema, title: undefined }}
          uiSchema={{ ...uiSchema, 'ui:label': false }}
          onBlur={onBlur}
          onChange={onChange}
          onFocus={onFocus}
        />

        <div
          className="tw:flex tw:items-center tw:gap-1.5"
          data-testid="auth-affirmation">
          <InfoCircle className="tw:text-fg-quaternary" size={14} />
          <Typography as="span" className="tw:text-tertiary" size="text-xs">
            <Transi18next
              i18nKey="message.auth-single-credential-stored"
              renderElement={
                <strong className="tw:font-semibold tw:text-secondary" />
              }
              values={{ method: activeTitle }}
            />
          </Typography>
        </div>
      </div>
    </div>
  );
};

export default AuthSelectField;
