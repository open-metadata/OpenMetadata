/*
 *  Copyright 2024 Collate.
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
import { WidgetProps } from '@rjsf/utils';
import { Select } from '../../../AntdCompat';;
import { capitalize } from 'lodash';
import { FC } from 'react';
import TreeSelectWidget from './TreeSelectWidget';

const SelectWidget: FC<WidgetProps> = (props) => {
  if (props.schema.uiFieldType === 'treeSelect') {
    return <TreeSelectWidget {...props} />;
  }

  const { onFocus, onBlur, onChange, ...rest } = props;

  return (
    <Select
      allowClear
      autoFocus={rest.autofocus}
      className="d-block w-full"
      data-testid="select-widget"
      disabled={rest.disabled}
      id={rest.id}
      mode={rest.multiple ? 'multiple' : undefined}
      open={props.readonly ? false : undefined}
      placeholder={rest.placeholder}
      value={rest.value}
      onBlur={() => onBlur(rest.id, rest.value)}
      onChange={(value) => onChange(value)}
      onFocus={() => onFocus(rest.id, rest.value)}>
      {(rest.options.enumOptions ?? []).map((option) => (
        <Select.Option
          data-testid={`select-option-${option.label}`}
          key={option.value}
          value={option.value}>
          {capitalize(option.label)}
        </Select.Option>
      ))}
    </Select>
  );
};

export default SelectWidget;
