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
  Input,
  Tooltip,
  TooltipTrigger,
} from '@openmetadata/ui-core-components';
import { WidgetProps } from '@rjsf/utils';
import { HelpCircle } from '@untitledui/icons';
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
  const showAsTooltip = Boolean(options.showDescriptionAsTooltip);
  const widgetLabel = getWidgetLabel({ hideLabel, label });
  const showTooltipRow = showAsTooltip && Boolean(widgetLabel);
  const hint = rawErrors?.[0] ?? (showTooltipRow ? undefined : description);
  const tooltip = showTooltipRow
    ? (description as string | undefined)
    : undefined;

  return (
    <div>
      {showTooltipRow ? (
        <div className="tw:mb-1.5 tw:flex tw:cursor-default tw:items-center tw:gap-1.5">
          <span
            aria-hidden
            className="tw:text-sm tw:font-medium tw:text-secondary">
            {widgetLabel}
          </span>
          {required && <span className="tw:text-error-primary">*</span>}
          <Tooltip placement="top" title={tooltip}>
            <TooltipTrigger className="tw:flex tw:cursor-pointer tw:items-center tw:text-fg-quaternary tw:transition tw:duration-200 tw:hover:text-fg-quaternary_hover">
              <HelpCircle className="tw:size-4" />
            </TooltipTrigger>
          </Tooltip>
        </div>
      ) : null}
      <Input
        aria-label={showTooltipRow ? widgetLabel : undefined}
        className={showTooltipRow ? 'tw:w-[86%]' : undefined}
        hint={hint}
        hintClassName="tw:text-xs"
        id={id}
        isDisabled={disabled || readonly}
        isInvalid={!!rawErrors?.length}
        isRequired={required}
        label={showTooltipRow ? undefined : widgetLabel}
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
