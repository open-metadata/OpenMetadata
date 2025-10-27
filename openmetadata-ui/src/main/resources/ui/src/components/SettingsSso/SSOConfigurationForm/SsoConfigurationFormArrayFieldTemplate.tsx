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

import { FieldProps } from '@rjsf/utils';
import { Col, Row, Select, Typography } from 'antd';
import classNames from 'classnames';
import { isArray, isEmpty, isObject, startCase } from 'lodash';
import type { CustomTagProps } from 'rc-select/lib/BaseSelect';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CloseIcon } from '../../../assets/svg/close.svg';
import { useClipboard } from '../../../hooks/useClipBoard';
import { splitCSV } from '../../../utils/CSV/CSV.utils';
import { isValidUrl } from '../../../utils/SSOUtils';
import './sso-configuration-form-array-field-template.less';

const SsoCustomTagRenderer = (props: CustomTagProps) => {
  const { label, closable, onClose } = props;

  return (
    <span className="ant-select-selection-item" title={(label as string) ?? ''}>
      <span className="ant-select-selection-item-content">{label}</span>
      {closable && (
        <button className="ant-select-selection-item-remove" onClick={onClose}>
          <CloseIcon width={8} />
        </button>
      )}
    </span>
  );
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
        label: option,
        value: option,
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
  let value: string[];
  if (isScopeField) {
    // Convert string to array for UI display
    value =
      typeof props.formData === 'string'
        ? props.formData.split(' ').filter(Boolean)
        : props.formData ?? [];
  } else {
    value = props.formData ?? [];
  }

  const options = generateOptions();
  const { onPasteFromClipBoard } = useClipboard(JSON.stringify(value));

  // Check if field has errors (including invalid URLs)
  const hasInvalidUrls =
    isUrlField && value.some((url: string) => !isValidUrl(url));
  const hasError =
    (props.rawErrors && props.rawErrors.length > 0) || hasInvalidUrls;

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
      const convertedValue = isScopeField
        ? Array.isArray(newValue)
          ? newValue.join(' ')
          : newValue
        : newValue;

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

  return (
    <Row className={classNames('field-error', { 'has-error': hasError })}>
      <Col span={24}>
        <Typography
          className={`array-field-label ${
            props.required ? 'required-field' : ''
          }`}>
          {startCase(props.name)}
        </Typography>
      </Col>
      <Col className="sso-select-container" span={24}>
        <Select
          className={classNames('m-t-xss w-full', {
            'ant-select-status-error': hasError,
          })}
          data-testid={`sso-configuration-form-array-field-template-${props.name}`}
          disabled={props.disabled}
          id={id}
          mode={options ? 'multiple' : 'tags'}
          open={options ? undefined : false}
          options={options}
          placeholder={getPlaceholderText()}
          status={hasError ? 'error' : undefined}
          tagRender={SsoCustomTagRenderer}
          value={value}
          onBlur={handleBlur}
          onChange={handleChange}
          onFocus={handleFocus}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'v' && !options) {
              e.preventDefault();
              handlePaste();
            }
            if (!options && e.key === 'Enter') {
              // If there are no options(mode is tags), we need to split the input value by comma
              e.preventDefault();
              const inputValue = (e.target as HTMLInputElement).value;
              if (inputValue) {
                handleInputSplit(inputValue);
              }
            }
          }}
        />
        {hasInvalidUrls && (
          <div className="ant-form-item-explain-error m-t-xss">
            {t('message.valid-urls-required')}
          </div>
        )}
      </Col>
    </Row>
  );
};

export default SsoConfigurationFormArrayFieldTemplate;
