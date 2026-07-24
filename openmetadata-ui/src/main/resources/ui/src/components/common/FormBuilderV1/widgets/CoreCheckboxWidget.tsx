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

import { Checkbox } from '@openmetadata/ui-core-components';
import { WidgetProps } from '@rjsf/utils';
import { getWidgetHint, getWidgetLabel } from './coreWidgetUtils';

const CoreCheckboxWidget = ({
  value,
  disabled,
  readonly,
  label,
  hideLabel,
  rawErrors,
  schema,
  options,
  onChange,
}: WidgetProps) => {
  return (
    <Checkbox
      hint={getWidgetHint({ rawErrors, schema, options })}
      isDisabled={disabled || readonly}
      isSelected={Boolean(value)}
      label={getWidgetLabel({ hideLabel, label })}
      onChange={onChange}
    />
  );
};

export default CoreCheckboxWidget;
