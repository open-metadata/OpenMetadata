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
  Box,
  DatePicker,
  HintText,
  Label,
  parseDate,
} from '@openmetadata/ui-core-components';
import { WidgetProps } from '@rjsf/utils';
import { getWidgetHint, getWidgetLabel } from './coreWidgetUtils';

// Core's own `parseDate`: the app and the design system resolve separate
// `@internationalized/date` copies, whose date classes are not interchangeable.
/** `format: "date"` fields store an ISO `YYYY-MM-DD` string. */
const toDateValue = (value: unknown) => {
  try {
    return typeof value === 'string' && value ? parseDate(value) : null;
  } catch {
    return null;
  }
};

const CoreDateWidget = ({
  id,
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
  const fieldLabel = getWidgetLabel({ hideLabel, label });
  const hint = getWidgetHint({ rawErrors, schema, options });

  return (
    <Box className="tw:gap-1.5" direction="col">
      {fieldLabel && (
        <Label htmlFor={id} isRequired={required}>
          {fieldLabel}
        </Label>
      )}
      <DatePicker
        aria-label={fieldLabel ?? id}
        data-testid={`date-widget-${id}`}
        id={id}
        isDisabled={disabled || readonly}
        isInvalid={Boolean(rawErrors?.length)}
        triggerVariant="input"
        value={toDateValue(value)}
        onChange={(selected) =>
          onChange(selected ? selected.toString() : options.emptyValue)
        }
      />
      {hint && (
        <HintText isInvalid={Boolean(rawErrors?.length)}>{hint}</HintText>
      )}
    </Box>
  );
};

export default CoreDateWidget;
