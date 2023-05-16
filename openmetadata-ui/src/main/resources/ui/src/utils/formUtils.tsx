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
import { ErrorTransformer } from '@rjsf/utils';
import {
  Divider,
  Form,
  FormItemProps,
  FormRule,
  Input,
  InputNumber,
  Select,
  Switch,
} from 'antd';
import classNames from 'classnames';
import FilterPattern from 'components/common/FilterPattern/FilterPattern';
import { FilterPatternProps } from 'components/common/FilterPattern/filterPattern.interface';
import RichTextEditor from 'components/common/rich-text-editor/RichTextEditor';
import { RichTextEditorProp } from 'components/common/rich-text-editor/RichTextEditor.interface';
import SliderWithInput from 'components/SliderWithInput/SliderWithInput';
import { SliderWithInputProps } from 'components/SliderWithInput/SliderWithInput.interface';
import { compact, startCase } from 'lodash';
import React, { Fragment, ReactNode } from 'react';
import i18n from './i18next/LocalUtil';

export type FormItemLayout = 'horizontal' | 'vertical';

export enum FieldTypes {
  TEXT = 'text',
  PASSWORD = 'password',
  FILTER_PATTERN = 'filter_pattern',
  SWITCH = 'switch',
  SELECT = 'select',
  NUMBER = 'number',
  SLIDER_INPUT = 'slider_input',
  DESCRIPTION = 'description',
}

export interface FieldProp {
  label: ReactNode;
  name: string;
  type: FieldTypes;
  required: boolean;
  id: string;
  props?: Record<string, unknown>;
  formItemProps?: FormItemProps;
  rules?: FormRule[];
  helperText?: string;
  placeholder?: string;
  hasSeparator?: boolean;
  formItemLayout?: FormItemLayout;
}

export const getField = (field: FieldProp) => {
  const {
    label,
    name,
    type,
    required,
    props,
    rules = [],
    placeholder,
    id,
    formItemProps,
    hasSeparator = false,
    formItemLayout = 'vertical',
  } = field;

  let fieldElement: ReactNode = null;
  let fieldRules = [...rules];
  if (required) {
    fieldRules = [
      ...fieldRules,
      { required, message: i18n.t('label.field-required', { field: name }) },
    ];
  }

  switch (type) {
    case FieldTypes.TEXT:
      fieldElement = <Input {...props} id={id} placeholder={placeholder} />;

      break;
    case FieldTypes.PASSWORD:
      fieldElement = (
        <Input.Password
          {...props}
          autoComplete="off"
          id={id}
          placeholder={placeholder}
        />
      );

      break;
    case FieldTypes.NUMBER:
      fieldElement = (
        <InputNumber
          {...props}
          id={id}
          placeholder={placeholder}
          size="small"
        />
      );

      break;

    case FieldTypes.FILTER_PATTERN:
      fieldElement = (
        <FilterPattern {...(props as unknown as FilterPatternProps)} />
      );

      break;

    case FieldTypes.SWITCH:
      fieldElement = <Switch {...props} id={id} />;

      break;
    case FieldTypes.SELECT:
      fieldElement = <Select {...props} id={id} />;

      break;
    case FieldTypes.SLIDER_INPUT:
      fieldElement = (
        <SliderWithInput {...(props as unknown as SliderWithInputProps)} />
      );

      break;
    case FieldTypes.DESCRIPTION:
      fieldElement = (
        <RichTextEditor {...(props as unknown as RichTextEditorProp)} />
      );

      break;
    default:
      break;
  }

  return (
    <Fragment key={id}>
      <Form.Item
        className={classNames({
          'form-item-horizontal': formItemLayout === 'horizontal',
          'form-item-vertical': formItemLayout === 'vertical',
        })}
        id={id}
        key={id}
        label={label}
        name={name}
        rules={fieldRules}
        {...formItemProps}>
        {fieldElement}
      </Form.Item>
      {hasSeparator && <Divider />}
    </Fragment>
  );
};

export const generateFormFields = (fields: FieldProp[]) => {
  return <>{fields.map((field) => getField(field))}</>;
};

export const transformErrors: ErrorTransformer = (errors) => {
  const errorRet = errors.map((error) => {
    const { property } = error;
    const id = 'root' + property?.replaceAll('.', '/');
    // If element is not present in DOM, ignore error
    if (document.getElementById(id)) {
      const fieldName = error.params?.missingProperty;
      if (fieldName) {
        const customMessage = i18n.t('message.field-text-is-required', {
          fieldText: startCase(fieldName),
        });
        error.message = customMessage;

        return error;
      }
    }

    return null;
  });

  return compact(errorRet);
};
