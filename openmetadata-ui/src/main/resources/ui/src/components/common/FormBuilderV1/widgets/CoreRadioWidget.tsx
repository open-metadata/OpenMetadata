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

import {
  HintText,
  Label,
  RadioButton,
  RadioGroup,
} from '@openmetadata/ui-core-components';
import { WidgetProps } from '@rjsf/utils';
import { useMemo } from 'react';
import { getWidgetHint, getWidgetLabel } from './coreWidgetUtils';

const CoreRadioWidget = ({
  value,
  disabled,
  readonly,
  required,
  label,
  hideLabel,
  rawErrors,
  schema,
  options,
  onChange,
}: WidgetProps) => {
  const hint = getWidgetHint({ rawErrors, schema, options });
  const displayLabel = getWidgetLabel({ hideLabel, label });
  const isHorizontal =
    options.inline === true || options.orientation === 'horizontal';

  const items = useMemo(
    () =>
      (options.enumOptions ?? []).map((option) => ({
        hint: option.schema?.description,
        label: String(option.label ?? option.value ?? ''),
        value: String(option.value),
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
    <div className="tw:flex tw:flex-col tw:gap-1.5">
      {displayLabel && <Label isRequired={required}>{displayLabel}</Label>}

      <RadioGroup
        className={
          isHorizontal
            ? 'tw:flex tw:flex-row tw:flex-wrap tw:gap-3'
            : 'tw:flex tw:flex-col tw:gap-3'
        }
        isDisabled={disabled || readonly}
        value={
          value === undefined || value === null ? undefined : String(value)
        }
        onChange={(nextValue) => onChange(optionValueMap.get(nextValue))}>
        {items.map((item) => (
          <RadioButton
            hint={item.hint}
            key={item.value}
            label={item.label}
            value={item.value}
          />
        ))}
      </RadioGroup>

      {hint && <HintText isInvalid={!!rawErrors?.length}>{hint}</HintText>}
    </div>
  );
};

export default CoreRadioWidget;
