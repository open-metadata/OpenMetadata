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
  FormItemLabel,
  IconPickerField,
  IconPickerFieldProps,
} from '@openmetadata/ui-core-components';
import { FC, ReactNode } from 'react';

export interface IconPickerFieldWithLabelProps
  extends Omit<IconPickerFieldProps, 'value'> {
  label?: ReactNode;
  tooltip?: ReactNode;
  required?: boolean;
  value?: string;
}

const IconPickerFieldWithLabel: FC<IconPickerFieldWithLabelProps> = ({
  label,
  tooltip,
  required,
  value,
  ...iconPickerProps
}) => {
  // Plain string/undefined content is shown via FormItemLabel's own hover
  // tooltip. Anything else (e.g. iconTooltipDataRender()) is already a
  // fully-built icon+tooltip widget, so it's rendered as-is instead of being
  // wrapped in a second tooltip.
  const hasPlainTooltipContent = tooltip === undefined || typeof tooltip === 'string';

  return (
    <div className="tw:flex tw:flex-col tw:gap-1.5">
      {label &&
        (hasPlainTooltipContent ? (
          <FormItemLabel label={label} required={required} tooltip={tooltip} />
        ) : (
          <div className="tw:inline-flex tw:items-center tw:gap-1">
            <FormItemLabel label={label} required={required} />
            {tooltip}
          </div>
        ))}
      <IconPickerField {...iconPickerProps} value={value ?? ''} />
    </div>
  );
};

export default IconPickerFieldWithLabel;
