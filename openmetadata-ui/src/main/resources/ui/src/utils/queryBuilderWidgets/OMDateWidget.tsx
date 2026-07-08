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
import type { DateTimeWidgetProps } from '@react-awesome-query-builder/ui';
import type { FC } from 'react';

// Determine the input type based on the widget's time-related settings.
const getInputType = (operator: string): 'date' | 'datetime-local' | 'time' => {
  if (operator.includes('time') && !operator.includes('date')) {
    return 'time';
  }
  if (operator.includes('datetime') || operator.includes('date_time')) {
    return 'datetime-local';
  }

  return 'date';
};

const classNameValue =
  'tw:rounded-lg tw:bg-primary tw:px-3 tw:py-2 tw:text-sm tw:text-primary ' +
  'tw:shadow-xs tw:ring-1 tw:ring-primary tw:ring-inset tw:outline-hidden ' +
  'tw:transition tw:duration-100 focus:tw:ring-2 focus:tw:ring-brand ' +
  'disabled:tw:cursor-not-allowed disabled:tw:bg-disabled_subtle disabled:tw:text-disabled';

const OMDateWidget: FC<DateTimeWidgetProps> = ({
  value,
  setValue,
  placeholder,
  readonly,
  operator,
}) => (
  <input
    className={classNameValue}
    disabled={readonly}
    placeholder={placeholder}
    type={getInputType(operator)}
    value={String(value ?? '')}
    onChange={(e) => setValue(e.target.value || null)}
  />
);

export default OMDateWidget;
