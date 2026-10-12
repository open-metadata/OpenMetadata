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
import { getWidgetLabel } from './coreWidgetUtils';

const parseNumericValue = (
  nextValue: string,
  schemaType: string | string[] | undefined
): number | undefined => {
  if (nextValue === '') {
    return undefined;
  }
  const parsed =
    schemaType === 'integer'
      ? Number.parseInt(nextValue, 10)
      : Number.parseFloat(nextValue);

  return Number.isNaN(parsed) ? undefined : parsed;
};

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
      onChange(
        parseNumericValue(nextValue, schema.type) ??
          options.emptyValue ??
          undefined
      );

      return;
    }

    onChange(nextValue === '' ? options.emptyValue ?? undefined : nextValue);
  };

  const description =
    (options.help as string | undefined) ?? schema.description;
  const hint = rawErrors?.[0] ?? description;

  return (
    <div>
      <Input
        // eslint-disable-next-line jsx-a11y/no-autofocus -- autofocus is driven by the JSON schema widget config
        autoFocus={autofocus}
        hint={hint}
        hintClassName="tw:text-xs"
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
      {options.suffix && (
        <span className="tw:mt-1 tw:block tw:text-xs tw:font-medium tw:text-quaternary">
          {options.suffix as string}
        </span>
      )}
    </div>
  );
};

export default CoreInputWidget;
