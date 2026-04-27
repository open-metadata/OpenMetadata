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

import { Input } from '@openmetadata/ui-core-components';
import { WidgetProps } from '@rjsf/utils';
import { getWidgetHint, getWidgetLabel } from './coreWidgetUtils';

const CoreInputWidget = ({
  id,
  value,
  readonly,
  disabled,
  required,
  label,
  hideLabel,
  placeholder,
  autofocus,
  rawErrors,
  schema,
  options,
  onChange,
  onBlur,
  onFocus,
}: WidgetProps) => {
  const inputType =
    options.inputType ??
    (schema.type === 'number' || schema.type === 'integer' ? 'number' : 'text');

  const handleChange = (nextValue: string) => {
    if (schema.type === 'number' || schema.type === 'integer') {
      if (nextValue === '') {
        onChange(options.emptyValue ?? undefined);

        return;
      }

      const parsedValue =
        schema.type === 'integer'
          ? Number.parseInt(nextValue, 10)
          : Number.parseFloat(nextValue);

      onChange(
        Number.isNaN(parsedValue)
          ? options.emptyValue ?? undefined
          : parsedValue
      );

      return;
    }

    onChange(nextValue);
  };

  return (
    <Input
      autoFocus={autofocus}
      hint={getWidgetHint({ rawErrors, schema, options })}
      id={id}
      isDisabled={disabled || readonly}
      isInvalid={!!rawErrors?.length}
      isRequired={required}
      label={getWidgetLabel({ hideLabel, label })}
      placeholder={placeholder}
      type={inputType}
      value={value ?? ''}
      onBlur={() => onBlur(id, value)}
      onChange={handleChange}
      onFocus={() => onFocus(id, value)}
    />
  );
};

export default CoreInputWidget;
