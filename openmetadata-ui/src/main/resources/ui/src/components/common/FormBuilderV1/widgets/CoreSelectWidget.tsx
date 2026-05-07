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
import { WidgetProps } from '@rjsf/utils';
import { Key, useMemo } from 'react';
import { getWidgetHint, getWidgetLabel } from './coreWidgetUtils';

const CoreSelectWidget = ({
  value,
  disabled,
  readonly,
  required,
  label,
  hideLabel,
  placeholder,
  rawErrors,
  schema,
  options,
  onChange,
}: WidgetProps) => {
  const items = useMemo(
    () =>
      (options.enumOptions ?? []).map((option) => ({
        id: String(option.value),
        label: String(option.label ?? option.value ?? ''),
      })),
    [options.enumOptions]
  );

  const optionValueMap = useMemo(
    () =>
      new Map(
        (options.enumOptions ?? []).map((option) => [
          String(option.value),
          option.value,
        ])
      ),
    [options.enumOptions]
  );

  return (
    <Select
      hint={getWidgetHint({ rawErrors, schema, options })}
      isDisabled={disabled || readonly}
      isInvalid={!!rawErrors?.length}
      isRequired={required}
      items={items}
      label={getWidgetLabel({ hideLabel, label })}
      placeholder={placeholder}
      selectedKey={value === undefined || value === null ? null : String(value)}
      onSelectionChange={(key: Key | null) => {
        if (key === null) {
          onChange(options.emptyValue ?? undefined);

          return;
        }

        onChange(optionValueMap.get(String(key)));
      }}>
      {(item) => (
        <Select.Item id={item.id} key={item.id} textValue={item.label}>
          {item.label}
        </Select.Item>
      )}
    </Select>
  );
};

export default CoreSelectWidget;
