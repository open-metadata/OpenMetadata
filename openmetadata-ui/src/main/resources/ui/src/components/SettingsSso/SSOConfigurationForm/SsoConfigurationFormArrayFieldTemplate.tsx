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
  Autocomplete,
  Badge,
  Grid,
  Typography,
} from '@openmetadata/ui-core-components';
import { FieldProps } from '@rjsf/utils';
import classNames from 'classnames';
import { isArray, isEmpty, isObject, startCase } from 'lodash';
import { Key, KeyboardEvent, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DEPRECATED_SSO_PROPERTIES } from '../../../constants/Services.constant';
import { useClipboard } from '../../../hooks/useClipBoard';
import { splitCSV } from '../../../utils/CSV/CSVPureUtils';
import { isValidUrl } from '../../../utils/SSOUtils';
import './sso-configuration-form-array-field-template.less';

const getArrayFieldValue = (
  formData: FieldProps['formData'],
  isScopeField: boolean
): string[] => {
  if (isScopeField) {
    return typeof formData === 'string'
      ? formData.split(' ').filter(Boolean)
      : formData ?? [];
  }

  return formData ?? [];
};

const getArrayFieldErrorState = (
  isUrlField: boolean,
  value: string[],
  rawErrors?: string[]
): { hasInvalidUrls: boolean; hasError: boolean } => {
  const hasInvalidUrls =
    isUrlField && value.some((url: string) => !isValidUrl(url));
  const hasError = (rawErrors && rawErrors.length > 0) || hasInvalidUrls;

  return { hasInvalidUrls, hasError: Boolean(hasError) };
};

const SsoConfigurationFormArrayFieldTemplate = (props: FieldProps) => {
  const { t } = useTranslation();

  // Check if this is a URL field that needs validation
  const isUrlField =
    props.idSchema.$id.includes('publicKeyUrls') ||
    props.idSchema.$id.includes('Url') ||
    props.uiSchema?.['ui:validateUrl'] === true;

  // Check if this is the OIDC scope field that needs array UI with string backend
  const isScopeField = props.idSchema.$id.includes('scope');

  const isFilterPatternField = (id: string) => {
    return /FilterPattern/.test(id);
  };

  const handleFocus = () => {
    let id = props.idSchema.$id;

    if (isFilterPatternField(id)) {
      id = id.split('/').slice(0, 2).join('/');
    }
    props.formContext?.handleFocus?.(id);
  };

  const generateOptions = () => {
    if (
      isObject(props.schema.items) &&
      !isArray(props.schema.items) &&
      props.schema.items.type === 'string' &&
      isArray(props.schema.items.enum)
    ) {
      return (props.schema.items.enum as string[]).map((option) => ({
        id: option,
        label: option,
      }));
    }

    return undefined;
  };

  const getPlaceholderText = () => {
    const uiSchemaPlaceholder = props.uiSchema?.['ui:placeholder'];
    if (uiSchemaPlaceholder) {
      return uiSchemaPlaceholder;
    }

    return t('label.enter-each-value-and-press-enter');
  };

  const id = props.idSchema.$id;

  // Handle scope field conversion between string (backend) and array (UI)
  const value = getArrayFieldValue(props.formData, isScopeField);

  const options = generateOptions();
  const { onPasteFromClipBoard } = useClipboard(JSON.stringify(value));

  // Check if field has errors (including invalid URLs)
  const { hasInvalidUrls, hasError } = getArrayFieldErrorState(
    isUrlField,
    value,
    props.rawErrors
  );

  const handlePaste = useCallback(async () => {
    const text = await onPasteFromClipBoard();
    if (!text) {
      return;
    }

    let processedValues: string[] = [];

    // Try to parse as JSON array
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        processedValues = parsed.map((item) => String(item));
      }
    } catch {
      // Fallback to existing logic if not a JSON array
      processedValues = splitCSV(text);
    }

    if (!isEmpty(processedValues)) {
      // Use Set to ensure unique values
      const uniqueValues = Array.from(new Set([...value, ...processedValues]));
      const convertedValue = isScopeField
        ? uniqueValues.join(' ')
        : uniqueValues;
      props.onChange(convertedValue);
    }
  }, [onPasteFromClipBoard, props.onChange, value, isUrlField, isScopeField]);

  const handleInputSplit = useCallback(
    (inputValue: string) => {
      if (isEmpty(inputValue)) {
        return;
      }

      // Add the input value (valid or invalid)
      if (isUrlField) {
        const uniqueValues = Array.from(new Set([...value, inputValue]));
        const convertedValue = isScopeField
          ? uniqueValues.join(' ')
          : uniqueValues;
        props.onChange(convertedValue);

        // No temporary error handling needed - persistent validation handles it
      } else {
        // For non-URL fields, use CSV splitting
        const processedValues = splitCSV(inputValue);
        // Use Set to ensure unique values
        const uniqueValues = Array.from(
          new Set([...value, ...processedValues])
        );
        const convertedValue = isScopeField
          ? uniqueValues.join(' ')
          : uniqueValues;
        props.onChange(convertedValue);
      }
    },
    [value, props.onChange, isUrlField, isScopeField]
  );

  const handleChange = useCallback(
    (newValue: string[]) => {
      // Handle scope field conversion from array (UI) to string (backend)
      let convertedValue: string | string[] = newValue;
      if (isScopeField) {
        convertedValue = Array.isArray(newValue)
          ? newValue.join(' ')
          : newValue;
      }

      props.onChange(convertedValue);
      // Clear field-specific error when value changes
      if (props.formContext?.clearFieldError) {
        props.formContext.clearFieldError(props.idSchema.$id);
      }
    },
    [isScopeField, props.onChange, props.formContext, props.idSchema.$id]
  );

  const handleBlur = useCallback(() => {
    const convertedValue = isScopeField ? value.join(' ') : value;
    props.onBlur(id, convertedValue);
  }, [isScopeField, value, props.onBlur, id]);

  const isDeprecated = useMemo(
    () =>
      Boolean(props.schema.deprecated) ||
      DEPRECATED_SSO_PROPERTIES.includes(props.name),
    [props.schema.deprecated, props.name]
  );

  return (
    <Grid
      className={`layout-row layout-grid ${classNames('field-error', {
        'has-error': hasError,
      })}`}>
      <Grid.Item className="layout-column" span={24}>
        <Typography
          as="article"
          className={classNames('array-field-label', {
            'required-field': props.required,
            'sso-deprecated-field-label': isDeprecated,
          })}>
          {startCase(props.name)}
          {isDeprecated && (
            <Badge className="sso-deprecated-tag" color="warning" size="sm">
              {t('label.deprecated')}
            </Badge>
          )}
        </Typography>
      </Grid.Item>
      <Grid.Item className="layout-column tw:mt-1" span={24}>
        <Autocomplete
          multiple
          allowsCreation={!options}
          aria-label={startCase(props.name)}
          data-testid={`sso-configuration-form-array-field-template-${props.name}`}
          hideDropdown={!options}
          hint={hasInvalidUrls ? t('message.valid-urls-required') : undefined}
          id={id}
          isDisabled={props.disabled}
          isInvalid={hasError}
          items={options ?? []}
          placeholder={getPlaceholderText()}
          selectedItems={value.map((item) => ({ id: item, label: item }))}
          onBlur={handleBlur}
          onFocus={handleFocus}
          onItemCleared={(key: Key) =>
            handleChange(value.filter((item) => item !== key))
          }
          onItemInserted={(key: Key) =>
            options
              ? handleChange([...value, String(key)])
              : handleInputSplit(String(key))
          }
          onKeyDown={(e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'v' && !options) {
              e.preventDefault();
              handlePaste();
            }
          }}>
          {(item) => <Autocomplete.Item id={item.id} label={item.label} />}
        </Autocomplete>
      </Grid.Item>
    </Grid>
  );
};

export default SsoConfigurationFormArrayFieldTemplate;
