import { WidgetProps } from '@rjsf/utils';
import { Select } from 'antd';
import { capitalize } from 'lodash';
import React, { FC } from 'react';

const MultiSelectWidget: FC<WidgetProps> = ({
  onFocus,
  onBlur,
  onChange,
  ...rest
}) => {
  return (
    <Select
      mode={rest.multiple ? 'multiple' : 'tags'}
      className="d-block w-full"
      autoFocus={rest.autofocus}
      disabled={rest.disabled}
      id={rest.id}
      placeholder={rest.placeholder}
      value={rest.value}
      onBlur={() => onBlur(rest.id, rest.value)}
      onChange={(value) => onChange(value)}
      onFocus={() => onFocus(rest.id, rest.value)}>
      {(rest.options.enumOptions ?? []).map((option, index) => (
        <Select.Option key={index} value={option.value}>
          {capitalize(option.label)}
        </Select.Option>
      ))}
    </Select>
  );
};

export default MultiSelectWidget;
