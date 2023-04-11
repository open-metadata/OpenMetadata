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
import { Form, FormRule, Input, Select, Space } from 'antd';
import Typography from 'antd/lib/typography/Typography';
import FilterPattern from 'components/common/FilterPattern/FilterPattern';
import { FilterPatternProps } from 'components/common/FilterPattern/filterPattern.interface';
import InfoPopover from 'components/common/InfoPopover/InfoPopover';
import ToggleSwitchV1, {
  ToggleSwitchV1Props,
} from 'components/common/toggle-switch/ToggleSwitchV1';
import React, { ReactNode } from 'react';
import { getSeparator } from './CommonUtils';
import i18n from './i18next/LocalUtil';

export enum FieldTypes {
  TEXT = 'text',
  FILTER_PATTERN = 'filter_pattern',
  SWITCH = 'switch',
  SELECT = 'select',
}

export interface FieldProp {
  label: ReactNode;
  name: string;
  type: FieldTypes;
  required: boolean;
  id: string;
  props?: Record<string, unknown>;
  rules?: FormRule[];
  helperText?: string;
  placeholder?: string;
  hasSeparator?: boolean;
}

const HIDE_LABEL = [FieldTypes.SWITCH];

export const getField = (field: FieldProp) => {
  const {
    label,
    name,
    type,
    required,
    props,
    rules = [],
    helperText,
    placeholder,
    hasSeparator = false,
  } = field;

  let fieldElement: ReactNode = null;
  let fieldRules = [...rules];
  let fieldLabel = label;
  if (required) {
    fieldRules = [
      ...fieldRules,
      { required, message: i18n.t('label.field-required', { field: name }) },
    ];
  }

  if (helperText) {
    fieldLabel = (
      <div>
        {fieldLabel}{' '}
        <InfoPopover
          content={
            <Typography className="text-grey-muted">{helperText}</Typography>
          }
        />
      </div>
    );
  }

  switch (type) {
    case FieldTypes.TEXT:
      fieldElement = <Input {...props} placeholder={placeholder} />;

      break;

    case FieldTypes.FILTER_PATTERN:
      fieldElement = (
        <FilterPattern {...(props as unknown as FilterPatternProps)} />
      );

      break;

    case FieldTypes.SWITCH:
      fieldElement = (
        <Space>
          {fieldLabel}
          <ToggleSwitchV1 {...(props as unknown as ToggleSwitchV1Props)} />
        </Space>
      );

      break;
    case FieldTypes.SELECT:
      fieldElement = <Select {...props} />;

      break;
    default:
      break;
  }

  return (
    <Form.Item
      label={!HIDE_LABEL.includes(type) ? fieldLabel : null}
      name={name}
      rules={fieldRules}>
      {fieldElement}
      {hasSeparator && getSeparator('')}
    </Form.Item>
  );
};

export const generateFormFields = (fields: FieldProp[]) => {
  return <>{fields.map((field) => getField(field))}</>;
};
